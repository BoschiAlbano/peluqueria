"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { SUELDO_BASE_CAJERO } from "@/lib/config-negocio";
import { MetodoPago } from "@/generated/prisma/enums";
import { requireUsuario } from "@/lib/auth";
import { inicioDelDia, inicioDeHoy } from "@/lib/rangos-fecha";

const ERROR_CAJA_YA_ABIERTA = "Ya hay una caja abierta. Hay que cerrarla antes de abrir otra.";
const ERROR_DIA_YA_CERRADO = "Ya se hizo el cierre de caja de hoy. Se puede volver a abrir mañana.";

// Una vez que se cierra la caja del día, nadie puede abrir una sesión nueva
// ni volver a cerrar hasta el día siguiente — es un límite real de fin de
// día, no algo reabrible. Se detecta buscando un CierreDia con la fecha
// comercial de hoy (cualquier cajero: alcanza con que uno se haya liquidado).
async function yaSeCerroHoy(): Promise<boolean> {
  const cierre = await prisma.cierreDia.findFirst({ where: { fecha: inicioDeHoy() } });
  return !!cierre;
}

export async function abrirSesion(etiqueta?: string) {
  const usuario = await requireUsuario();

  if (await yaSeCerroHoy()) {
    throw new Error(ERROR_DIA_YA_CERRADO);
  }

  // Chequeo optimista para dar un error claro en el caso común. La garantía
  // real contra dos aperturas simultáneas (condición de carrera) es el índice
  // único parcial en la base — ver migración 20260709000000_unica_caja_abierta.
  const sesionAbierta = await prisma.sesionCaja.findFirst({
    where: { horaCierre: null },
  });

  if (sesionAbierta) {
    throw new Error(ERROR_CAJA_YA_ABIERTA);
  }

  try {
    await prisma.sesionCaja.create({
      data: {
        cajeroId: usuario.id,
        etiqueta: etiqueta?.trim() || null,
        horaApertura: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(ERROR_CAJA_YA_ABIERTA);
    }
    throw error;
  }

  revalidatePath("/caja");
  revalidatePath("/ventas");
}

export type TotalPorMetodoPago = {
  metodoPago: MetodoPago;
  total: number;
  cantidad: number;
};

export type SesionCerradaResumen = {
  id: string;
  cajeroNombre: string;
  etiqueta: string | null;
  horaApertura: Date;
  horaCierre: Date;
  totalCortesSesion: number;
  totalVentasSesion: number;
  sueldoBaseSesion: number | null;
  bonoSesion: number | null;
  totalesPorMetodoPago: TotalPorMetodoPago[];
};

export type ResumenServicio = {
  servicioNombre: string;
  cantidad: number;
  total: number;
};

export type ResumenSesionCajero = SesionCerradaResumen & {
  servicios: ResumenServicio[];
};

// Cierra la sesión de caja: solo registra hora de cierre, cortes y ventas.
// El sueldo base y el bono se calculan recién con cerrarDia(). Además arma un
// resumen (desglose por método de pago y servicios) para que el cajero
// controle la plata en mano antes de irse — no implica ningún cálculo de pago.
export async function cerrarSesion(sesionId: string): Promise<ResumenSesionCajero> {
  await requireUsuario();

  // Bloquea (FOR UPDATE) la misma fila que crearVenta() bloquea al insertar
  // una venta, y recién ahí lee las ventas de la sesión — así ninguna venta
  // puede colarse entre el cálculo de totales y el cierre (ver comentario en
  // crearVenta).
  const { sesion, ventasSesion, totalCortesSesion, totalVentasSesion, horaCierre } =
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SesionCaja" WHERE id = ${sesionId} FOR UPDATE`;

      const sesion = await tx.sesionCaja.findUnique({
        where: { id: sesionId },
        include: { cajero: true },
      });

      if (!sesion) {
        throw new Error("La sesión de caja no existe.");
      }

      if (sesion.horaCierre) {
        throw new Error("Esta sesión ya está cerrada.");
      }

      const ventasSesion = await tx.venta.findMany({
        where: { sesionCajaId: sesionId },
        include: { detalles: { include: { servicio: true } } },
      });

      const totalVentasSesion = ventasSesion.reduce((acc, v) => acc + Number(v.total), 0);
      const totalCortesSesion = ventasSesion.reduce(
        (acc, v) => acc + v.detalles.filter((d) => d.servicio.cuentaParaBono).length,
        0,
      );

      const horaCierre = new Date();

      await tx.sesionCaja.update({
        where: { id: sesionId },
        data: { horaCierre, totalCortesSesion, totalVentasSesion },
      });

      return { sesion, ventasSesion, totalCortesSesion, totalVentasSesion, horaCierre };
    });

  const metodoPagoMap = new Map<MetodoPago, TotalPorMetodoPago>();
  for (const v of ventasSesion) {
    const entry = metodoPagoMap.get(v.metodoPago) ?? {
      metodoPago: v.metodoPago,
      total: 0,
      cantidad: 0,
    };
    entry.total += Number(v.total);
    entry.cantidad += 1;
    metodoPagoMap.set(v.metodoPago, entry);
  }

  const servicioMap = new Map<string, ResumenServicio>();
  for (const v of ventasSesion) {
    for (const d of v.detalles) {
      const entry = servicioMap.get(d.servicio.nombre) ?? {
        servicioNombre: d.servicio.nombre,
        cantidad: 0,
        total: 0,
      };
      entry.cantidad += 1;
      entry.total += Number(d.precioCobrado);
      servicioMap.set(d.servicio.nombre, entry);
    }
  }

  revalidatePath("/caja");
  revalidatePath("/ventas");

  return {
    id: sesion.id,
    cajeroNombre: sesion.cajero.nombre,
    etiqueta: sesion.etiqueta,
    horaApertura: sesion.horaApertura,
    horaCierre,
    totalCortesSesion,
    totalVentasSesion,
    sueldoBaseSesion: null,
    bonoSesion: null,
    totalesPorMetodoPago: [...metodoPagoMap.values()],
    servicios: [...servicioMap.values()],
  };
}

export type PeluqueroResumenDia = {
  peluqueroId: string;
  nombre: string;
  detalles: { servicioNombre: string; precioCobrado: number; comisionPeluquero: number }[];
  totalComision: number;
};

export type CierreDiaResumen = {
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  totalCortesDia: number;
  bonoAlcanzado: boolean;
  montoBonoPorCaja: number | null;
  sesiones: SesionCerradaResumen[];
  peluqueros: PeluqueroResumenDia[];
  totalComisionDueno: number;
};

export type CajeroPendiente = {
  cajeroId: string;
  cajeroNombre: string;
  sesionesPendientes: number;
  totalCortesPendientes: number;
};

export type EstadoCierreDia = {
  cajeros: CajeroPendiente[];
  cajeroIdConCajaAbierta: string | null;
};

// El bono ahora se liquida por cajero (no todos juntos): esta función agrupa
// las sesiones pendientes por cajero para que el dueño pueda elegir a quién
// liquidar. Excluye cajeros desactivados (no tiene sentido ofrecer cerrarle
// el día a alguien que ya no está activo).
export async function obtenerCajerosConPendientes(): Promise<EstadoCierreDia> {
  const [pendientes, sesionAbierta] = await Promise.all([
    prisma.sesionCaja.findMany({
      where: { cierreDiaId: null, horaCierre: { not: null }, cajero: { activo: true } },
      include: { cajero: true },
    }),
    prisma.sesionCaja.findFirst({ where: { horaCierre: null } }),
  ]);

  const mapa = new Map<string, CajeroPendiente>();
  for (const s of pendientes) {
    const entry = mapa.get(s.cajeroId) ?? {
      cajeroId: s.cajeroId,
      cajeroNombre: s.cajero.nombre,
      sesionesPendientes: 0,
      totalCortesPendientes: 0,
    };
    entry.sesionesPendientes += 1;
    entry.totalCortesPendientes += s.totalCortesSesion ?? 0;
    mapa.set(s.cajeroId, entry);
  }

  return {
    cajeros: [...mapa.values()],
    cajeroIdConCajaAbierta: sesionAbierta?.cajeroId ?? null,
  };
}

export type ProgresoBonoCajero = {
  cajeroId: string;
  cajeroNombre: string;
  cortes: number;
  proximoUmbral: number | null;
  montoBonoAlcanzado: number | null;
  liquidado: boolean;
};

// Avance del bono de cada cajero con sesiones HOY (cerradas o la abierta, si
// hay una), liquidado o no, contra los escalones de MetaCajero. Un cajero ya
// liquidado sigue apareciendo (para que "Totales de hoy" no lo haga
// desaparecer apenas se cierra su día) y muestra el monto de bono que
// efectivamente quedó guardado en su CierreDia, no un recálculo en vivo —
// así el número no se mueve aunque cambien los escalones después.
export async function obtenerProgresoBonoHoy(): Promise<ProgresoBonoCajero[]> {
  const inicioHoy = inicioDeHoy();

  const [sesionesHoy, sesionAbierta, escalones, cierresHoy] = await Promise.all([
    prisma.sesionCaja.findMany({
      where: { horaApertura: { gte: inicioHoy }, horaCierre: { not: null } },
      include: { cajero: true },
    }),
    prisma.sesionCaja.findFirst({ where: { horaCierre: null }, include: { cajero: true } }),
    prisma.metaCajero.findMany({ where: { activo: true }, orderBy: { umbralCortes: "asc" } }),
    prisma.cierreDia.findMany({ where: { fecha: inicioHoy } }),
  ]);

  const bonoLiquidadoPorCajero = new Map(
    cierresHoy.map((c) => [c.cajeroId, c.montoBonoPorCaja !== null ? Number(c.montoBonoPorCaja) : null]),
  );

  const mapa = new Map<string, { cajeroId: string; cajeroNombre: string; cortes: number }>();
  for (const s of sesionesHoy) {
    const entry = mapa.get(s.cajeroId) ?? {
      cajeroId: s.cajeroId,
      cajeroNombre: s.cajero.nombre,
      cortes: 0,
    };
    entry.cortes += s.totalCortesSesion ?? 0;
    mapa.set(s.cajeroId, entry);
  }

  if (sesionAbierta) {
    const cortesAbierta = await prisma.ventaDetalle.count({
      where: { venta: { sesionCajaId: sesionAbierta.id }, servicio: { cuentaParaBono: true } },
    });
    const entry = mapa.get(sesionAbierta.cajeroId) ?? {
      cajeroId: sesionAbierta.cajeroId,
      cajeroNombre: sesionAbierta.cajero.nombre,
      cortes: 0,
    };
    entry.cortes += cortesAbierta;
    mapa.set(sesionAbierta.cajeroId, entry);
  }

  return [...mapa.values()].map((c) => {
    const liquidado = bonoLiquidadoPorCajero.has(c.cajeroId);
    const escalonAlcanzado = [...escalones].reverse().find((e) => e.umbralCortes <= c.cortes);
    const proximoEscalon = escalones.find((e) => e.umbralCortes > c.cortes);
    return {
      cajeroId: c.cajeroId,
      cajeroNombre: c.cajeroNombre,
      cortes: c.cortes,
      proximoUmbral: proximoEscalon?.umbralCortes ?? null,
      montoBonoAlcanzado: liquidado
        ? (bonoLiquidadoPorCajero.get(c.cajeroId) ?? null)
        : escalonAlcanzado
          ? Number(escalonAlcanzado.montoBono)
          : null,
      liquidado,
    };
  });
}

export type TotalesDeHoy = {
  peluqueros: {
    peluqueroId: string;
    peluqueroNombre: string;
    totalServicios: number;
    totalPlataGenerada: number;
    totalComisionPeluquero: number;
    totalComisionDueno: number;
    detalles: { servicioNombre: string; precioCobrado: number; comisionPeluquero: number }[];
  }[];
  cajeros: {
    cajeroId: string;
    cajeroNombre: string;
    cortes: number;
    sesiones: number;
    sueldoEstimado: number;
    bonoEstimado: number;
    totalEstimado: number;
    liquidado: boolean;
    // Sesiones ya cerradas hoy de este cajero, con su desglose de ventas y
    // formas de pago — para poder imprimir exactamente lo mismo que
    // aparecería en su parte del ticket largo de cierre del día. La sesión
    // abierta (si hay una) no entra acá todavía: no tiene un cierre
    // definitivo, solo cuenta para la estimación de sesiones/sueldo/bono.
    sesionesDetalle: SesionCerradaResumen[];
  }[];
  totalComisionPeluqueros: number;
  totalComisionDueno: number;
};

type DetalleConRelaciones = {
  peluqueroId: string;
  peluquero: { nombre: string };
  servicio: { nombre: string };
  precioCobrado: Prisma.Decimal;
  comisionPeluquero: Prisma.Decimal;
  comisionDueno: Prisma.Decimal;
};

function agruparPorPeluquero(detalles: DetalleConRelaciones[]): TotalesDeHoy["peluqueros"] {
  const peluqueroMap = new Map<string, TotalesDeHoy["peluqueros"][number]>();
  for (const d of detalles) {
    const entry = peluqueroMap.get(d.peluqueroId) ?? {
      peluqueroId: d.peluqueroId,
      peluqueroNombre: d.peluquero.nombre,
      totalServicios: 0,
      totalPlataGenerada: 0,
      totalComisionPeluquero: 0,
      totalComisionDueno: 0,
      detalles: [],
    };
    entry.totalServicios += 1;
    entry.totalPlataGenerada += Number(d.precioCobrado);
    entry.totalComisionPeluquero += Number(d.comisionPeluquero);
    entry.totalComisionDueno += Number(d.comisionDueno);
    entry.detalles.push({
      servicioNombre: d.servicio.nombre,
      precioCobrado: Number(d.precioCobrado),
      comisionPeluquero: Number(d.comisionPeluquero),
    });
    peluqueroMap.set(d.peluqueroId, entry);
  }

  return [...peluqueroMap.values()].sort((a, b) => b.totalPlataGenerada - a.totalPlataGenerada);
}

function sumarComisiones(detalles: DetalleConRelaciones[]) {
  return {
    totalComisionPeluqueros: detalles.reduce((acc, d) => acc + Number(d.comisionPeluquero), 0),
    totalComisionDueno: detalles.reduce((acc, d) => acc + Number(d.comisionDueno), 0),
  };
}

// Para la página de Cierre de caja (dueño o cajero designado): lo que le
// correspondería a cada cajero con actividad hoy (estimado en vivo, se
// confirma recién al cerrar su día), y la comisión de peluqueros/dueño de
// todo el día comercial, sin importar quién haya cargado cada venta.
export async function obtenerTotalesDelDia(): Promise<TotalesDeHoy> {
  const inicioHoy = inicioDeHoy();

  const [progresoCajeros, sesionesCerradasHoy, detallesHoy] = await Promise.all([
    obtenerProgresoBonoHoy(),
    prisma.sesionCaja.findMany({
      where: { horaApertura: { gte: inicioHoy }, horaCierre: { not: null } },
      include: { cajero: true },
      orderBy: { horaApertura: "asc" },
    }),
    prisma.ventaDetalle.findMany({
      where: { venta: { fecha: { gte: inicioHoy } } },
      include: { peluquero: true, servicio: true },
    }),
  ]);

  const [sesionAbierta, totalesPorMetodoPago] = await Promise.all([
    prisma.sesionCaja.findFirst({ where: { horaCierre: null } }),
    armarTotalesPorMetodoPagoPorSesion(sesionesCerradasHoy.map((s) => s.id)),
  ]);

  const sesionesPorCajero = new Map<string, typeof sesionesCerradasHoy>();
  for (const s of sesionesCerradasHoy) {
    const lista = sesionesPorCajero.get(s.cajeroId) ?? [];
    lista.push(s);
    sesionesPorCajero.set(s.cajeroId, lista);
  }

  const cajeros = progresoCajeros.map((c) => {
    const sesionesCerradas = sesionesPorCajero.get(c.cajeroId) ?? [];
    const sesionAbiertaEsSuya = sesionAbierta?.cajeroId === c.cajeroId;
    const sesiones = sesionesCerradas.length + (sesionAbiertaEsSuya ? 1 : 0);
    const sueldoEstimado = SUELDO_BASE_CAJERO * sesiones;
    const bonoEstimado = (c.montoBonoAlcanzado ?? 0) * sesiones;
    return {
      cajeroId: c.cajeroId,
      cajeroNombre: c.cajeroNombre,
      cortes: c.cortes,
      sesiones,
      sueldoEstimado,
      bonoEstimado,
      totalEstimado: sueldoEstimado + bonoEstimado,
      liquidado: c.liquidado,
      sesionesDetalle: sesionesCerradas.map((s) => ({
        id: s.id,
        cajeroNombre: s.cajero.nombre,
        etiqueta: s.etiqueta,
        horaApertura: s.horaApertura,
        horaCierre: s.horaCierre!,
        totalCortesSesion: s.totalCortesSesion ?? 0,
        totalVentasSesion: Number(s.totalVentasSesion ?? 0),
        sueldoBaseSesion: c.liquidado ? Number(s.sueldoBaseSesion ?? 0) : SUELDO_BASE_CAJERO,
        bonoSesion: c.liquidado ? Number(s.bonoSesion ?? 0) : (c.montoBonoAlcanzado ?? 0),
        totalesPorMetodoPago: totalesPorMetodoPago.get(s.id) ?? [],
      })),
    };
  });

  return {
    peluqueros: agruparPorPeluquero(detallesHoy),
    cajeros,
    ...sumarComisiones(detallesHoy),
  };
}

// Para la página de Caja (uso operativo del cajero logueado): los
// peluqueros se acotan a la sesión abierta ahora mismo (lo que se hizo en
// este turno), pero la fila del propio cajero muestra el acumulado de TODO
// su día (todas sus sesiones, no solo esta) — es lo que efectivamente
// cobraría si cerrara su día ahora mismo, y por eso no tendría sentido
// mostrar un sueldo/bono calculado solo con esta sesión aislada.
export async function obtenerTotalesDeLaSesion(): Promise<TotalesDeHoy> {
  const usuario = await requireUsuario();

  const sesionAbierta = await prisma.sesionCaja.findFirst({
    where: { cajeroId: usuario.id, horaCierre: null },
  });

  if (!sesionAbierta) {
    return { peluqueros: [], cajeros: [], totalComisionPeluqueros: 0, totalComisionDueno: 0 };
  }

  const inicioHoy = inicioDeHoy();

  const [detallesSesion, progresoCajeros, sesionesCerradasHoy] = await Promise.all([
    prisma.ventaDetalle.findMany({
      where: { venta: { sesionCajaId: sesionAbierta.id } },
      include: { peluquero: true, servicio: true },
    }),
    obtenerProgresoBonoHoy(),
    prisma.sesionCaja.findMany({
      where: { cajeroId: usuario.id, horaApertura: { gte: inicioHoy }, horaCierre: { not: null } },
      include: { cajero: true },
      orderBy: { horaApertura: "asc" },
    }),
  ]);

  const totalesPorMetodoPago = await armarTotalesPorMetodoPagoPorSesion(
    sesionesCerradasHoy.map((s) => s.id),
  );

  const miProgreso = progresoCajeros.find((c) => c.cajeroId === usuario.id);
  const sesiones = sesionesCerradasHoy.length + 1; // +1 por la sesión abierta ahora mismo.
  const sueldoEstimado = SUELDO_BASE_CAJERO * sesiones;
  const bonoEstimado = (miProgreso?.montoBonoAlcanzado ?? 0) * sesiones;

  return {
    peluqueros: agruparPorPeluquero(detallesSesion),
    cajeros: [
      {
        cajeroId: usuario.id,
        cajeroNombre: usuario.nombre,
        cortes: miProgreso?.cortes ?? 0,
        sesiones,
        sueldoEstimado,
        bonoEstimado,
        totalEstimado: sueldoEstimado + bonoEstimado,
        liquidado: false,
        sesionesDetalle: sesionesCerradasHoy.map((s) => ({
          id: s.id,
          cajeroNombre: s.cajero.nombre,
          etiqueta: s.etiqueta,
          horaApertura: s.horaApertura,
          horaCierre: s.horaCierre!,
          totalCortesSesion: s.totalCortesSesion ?? 0,
          totalVentasSesion: Number(s.totalVentasSesion ?? 0),
          sueldoBaseSesion: SUELDO_BASE_CAJERO,
          bonoSesion: miProgreso?.montoBonoAlcanzado ?? 0,
          totalesPorMetodoPago: totalesPorMetodoPago.get(s.id) ?? [],
        })),
      },
    ],
    ...sumarComisiones(detallesSesion),
  };
}

// Liquida UN cajero para UN día comercial: calcula sueldo base + bono (según
// el total de cortes de ESE cajero en ESE día) para cada sesión, y la
// comisión de cada peluquero sobre las ventas de esas sesiones. El bono es
// por cajero: si el cajero de la mañana no llega a la meta y cierra, no
// cobra bono, y el cajero de la tarde arranca su propio conteo en 0 — no hay
// un total compartido entre cajeros.
//
// Si ya se había liquidado antes a este mismo cajero en la misma fecha (por
// ejemplo, abrió y cerró otra sesión después), se recalcula sobre TODAS las
// sesiones de ese cajero en esa fecha (no solo las nuevas): el bono se
// reevalúa con el total de cortes actualizado y se corrige retroactivamente,
// pero solo dentro de las sesiones de ESE cajero.
async function liquidarCajeroDelDia(cajeroId: string, fecha: Date): Promise<CierreDiaResumen> {
  const cajero = await prisma.usuario.findUniqueOrThrow({ where: { id: cajeroId } });

  const finFecha = new Date(fecha);
  finFecha.setUTCDate(finFecha.getUTCDate() + 1);

  const sesionesDelDia = await prisma.sesionCaja.findMany({
    where: {
      cajeroId,
      horaCierre: { not: null },
      horaApertura: { gte: fecha, lt: finFecha },
    },
    include: { cajero: true },
    orderBy: { horaApertura: "asc" },
  });

  const totalCortesDia = sesionesDelDia.reduce(
    (acc, s) => acc + (s.totalCortesSesion ?? 0),
    0,
  );

  const escalon = await prisma.metaCajero.findFirst({
    where: { activo: true, umbralCortes: { lte: totalCortesDia } },
    orderBy: { umbralCortes: "desc" },
  });

  const montoBonoPorCaja = escalon ? Number(escalon.montoBono) : null;

  const cierreDiaRow = await prisma.cierreDia.upsert({
    where: { fecha_cajeroId: { fecha, cajeroId } },
    create: {
      fecha,
      cajeroId,
      totalCortesDia,
      bonoAlcanzado: montoBonoPorCaja !== null,
      montoBonoPorCaja,
    },
    update: {
      totalCortesDia,
      bonoAlcanzado: montoBonoPorCaja !== null,
      montoBonoPorCaja,
    },
  });

  await prisma.sesionCaja.updateMany({
    where: { id: { in: sesionesDelDia.map((s) => s.id) } },
    data: {
      cierreDiaId: cierreDiaRow.id,
      sueldoBaseSesion: SUELDO_BASE_CAJERO,
      bonoSesion: montoBonoPorCaja ?? 0,
    },
  });

  const sesionIds = sesionesDelDia.map((s) => s.id);
  const [{ peluqueros, totalComisionDueno }, totalesPorMetodoPago] = await Promise.all([
    armarResumenComisiones(sesionIds),
    armarTotalesPorMetodoPagoPorSesion(sesionIds),
  ]);

  return {
    cajeroId,
    cajeroNombre: cajero.nombre,
    fecha,
    totalCortesDia,
    bonoAlcanzado: montoBonoPorCaja !== null,
    montoBonoPorCaja,
    sesiones: sesionesDelDia.map((s) => ({
      id: s.id,
      cajeroNombre: s.cajero.nombre,
      etiqueta: s.etiqueta,
      horaApertura: s.horaApertura,
      horaCierre: s.horaCierre!,
      totalCortesSesion: s.totalCortesSesion ?? 0,
      totalVentasSesion: Number(s.totalVentasSesion ?? 0),
      sueldoBaseSesion: SUELDO_BASE_CAJERO,
      bonoSesion: montoBonoPorCaja ?? 0,
      totalesPorMetodoPago: totalesPorMetodoPago.get(s.id) ?? [],
    })),
    peluqueros,
    totalComisionDueno,
  };
}

// Comisión de cada peluquero y del dueño sobre las ventas de un conjunto de
// sesiones ya cerradas — factorizado porque tanto liquidarCajeroDelDia
// (cierre nuevo) como reconstruirResumenCierre (reimprimir/ver un cierre ya
// hecho) arman el mismo desglose a partir de un conjunto de sesiones.
async function armarResumenComisiones(
  sesionIds: string[],
): Promise<{ peluqueros: PeluqueroResumenDia[]; totalComisionDueno: number }> {
  const detallesDia = await prisma.ventaDetalle.findMany({
    where: { venta: { sesionCajaId: { in: sesionIds } } },
    include: { servicio: true, peluquero: true },
  });

  const peluqueroMap = new Map<string, PeluqueroResumenDia>();
  let totalComisionDueno = 0;
  for (const d of detallesDia) {
    const entry = peluqueroMap.get(d.peluqueroId) ?? {
      peluqueroId: d.peluqueroId,
      nombre: d.peluquero.nombre,
      detalles: [],
      totalComision: 0,
    };
    entry.detalles.push({
      servicioNombre: d.servicio.nombre,
      precioCobrado: Number(d.precioCobrado),
      comisionPeluquero: Number(d.comisionPeluquero),
    });
    entry.totalComision += Number(d.comisionPeluquero);
    peluqueroMap.set(d.peluqueroId, entry);
    totalComisionDueno += Number(d.comisionDueno);
  }

  return { peluqueros: [...peluqueroMap.values()], totalComisionDueno };
}

// Desglose por método de pago de cada sesión, para mostrar en su ticket de
// liquidación — factorizado por la misma razón que armarResumenComisiones.
async function armarTotalesPorMetodoPagoPorSesion(
  sesionIds: string[],
): Promise<Map<string, TotalPorMetodoPago[]>> {
  const ventas = await prisma.venta.findMany({
    where: { sesionCajaId: { in: sesionIds } },
    select: { sesionCajaId: true, metodoPago: true, total: true },
  });

  const porSesion = new Map<string, Map<MetodoPago, TotalPorMetodoPago>>();
  for (const v of ventas) {
    const metodoPagoMap = porSesion.get(v.sesionCajaId) ?? new Map<MetodoPago, TotalPorMetodoPago>();
    const entry = metodoPagoMap.get(v.metodoPago) ?? {
      metodoPago: v.metodoPago,
      total: 0,
      cantidad: 0,
    };
    entry.total += Number(v.total);
    entry.cantidad += 1;
    metodoPagoMap.set(v.metodoPago, entry);
    porSesion.set(v.sesionCajaId, metodoPagoMap);
  }

  const resultado = new Map<string, TotalPorMetodoPago[]>();
  for (const [sesionId, metodoPagoMap] of porSesion) {
    resultado.set(sesionId, [...metodoPagoMap.values()]);
  }
  return resultado;
}

// Acción explícita del dueño (o del cajero designado): liquida de una vez a
// TODOS los cajeros con sesiones pendientes, agrupando por (cajero, día
// comercial) — un mismo cajero puede tener pendientes de más de un día si no
// se liquidó antes. No liquida a nadie si queda alguna caja abierta (de
// cualquier cajero): forzar a cerrar todo antes evita liquidar un día a
// medias mientras alguien todavía está vendiendo.
export async function cerrarDia(): Promise<CierreDiaResumen[]> {
  const usuario = await requireUsuario();

  if (usuario.rol !== "DUENO" && !usuario.autorizadoCierreDia) {
    throw new Error("No estás autorizado para cerrar la caja del día.");
  }

  if (await yaSeCerroHoy()) {
    throw new Error("Ya se cerró la caja de hoy. El próximo cierre estará disponible mañana.");
  }

  const sesionAbierta = await prisma.sesionCaja.findFirst({ where: { horaCierre: null } });
  if (sesionAbierta) {
    throw new Error("Hay una caja abierta. Cerrala antes de liquidar el día.");
  }

  const sesionesPendientes = await prisma.sesionCaja.findMany({
    where: { cierreDiaId: null, horaCierre: { not: null } },
    orderBy: { horaApertura: "asc" },
  });

  if (!sesionesPendientes.length) {
    throw new Error("No hay sesiones pendientes de liquidar.");
  }

  // inicioDelDia calcula la medianoche en el huso horario del negocio (no el
  // del servidor) — ver lib/rangos-fecha.ts.
  const buckets = new Map<string, { cajeroId: string; fecha: Date }>();
  for (const s of sesionesPendientes) {
    const fecha = inicioDelDia(s.horaApertura);
    const key = `${s.cajeroId}|${fecha.toISOString()}`;
    if (!buckets.has(key)) {
      buckets.set(key, { cajeroId: s.cajeroId, fecha });
    }
  }

  const resultados: CierreDiaResumen[] = [];
  for (const { cajeroId, fecha } of buckets.values()) {
    resultados.push(await liquidarCajeroDelDia(cajeroId, fecha));
  }

  revalidatePath("/caja");
  revalidatePath("/cierre-caja");

  return resultados;
}

// Reconstruye el CierreDiaResumen de una fila de CierreDia ya guardada, sin
// recalcular ni escribir nada — comparte lógica entre obtenerCierresDeHoy
// (reimprimir el cierre de hoy) y obtenerDetalleCierre (ver el detalle de
// cualquier cierre pasado, desde Reportes).
async function reconstruirResumenCierre(cierre: {
  id: string;
  cajeroId: string;
  cajero: { nombre: string };
  fecha: Date;
  totalCortesDia: number;
  bonoAlcanzado: boolean;
  montoBonoPorCaja: Prisma.Decimal | null;
}): Promise<CierreDiaResumen> {
  const sesiones = await prisma.sesionCaja.findMany({
    where: { cierreDiaId: cierre.id },
    include: { cajero: true },
    orderBy: { horaApertura: "asc" },
  });

  const sesionIds = sesiones.map((s) => s.id);
  const [{ peluqueros, totalComisionDueno }, totalesPorMetodoPago] = await Promise.all([
    armarResumenComisiones(sesionIds),
    armarTotalesPorMetodoPagoPorSesion(sesionIds),
  ]);

  return {
    cajeroId: cierre.cajeroId,
    cajeroNombre: cierre.cajero.nombre,
    fecha: cierre.fecha,
    totalCortesDia: cierre.totalCortesDia,
    bonoAlcanzado: cierre.bonoAlcanzado,
    montoBonoPorCaja: cierre.montoBonoPorCaja !== null ? Number(cierre.montoBonoPorCaja) : null,
    sesiones: sesiones.map((s) => ({
      id: s.id,
      cajeroNombre: s.cajero.nombre,
      etiqueta: s.etiqueta,
      horaApertura: s.horaApertura,
      horaCierre: s.horaCierre!,
      totalCortesSesion: s.totalCortesSesion ?? 0,
      totalVentasSesion: Number(s.totalVentasSesion ?? 0),
      sueldoBaseSesion: Number(s.sueldoBaseSesion ?? 0),
      bonoSesion: Number(s.bonoSesion ?? 0),
      totalesPorMetodoPago: totalesPorMetodoPago.get(s.id) ?? [],
    })),
    peluqueros,
    totalComisionDueno,
  };
}

// Reconstruye el resumen del cierre de HOY (si ya se hizo) para poder
// reimprimir los tickets sin volver a liquidar nada — usa los mismos datos
// que ya quedaron guardados en CierreDia y en las sesiones que apuntan a él.
export async function obtenerCierresDeHoy(): Promise<CierreDiaResumen[]> {
  const usuario = await requireUsuario();

  if (usuario.rol !== "DUENO" && !usuario.autorizadoCierreDia) {
    throw new Error("No estás autorizado para ver el cierre de caja.");
  }

  const cierres = await prisma.cierreDia.findMany({
    where: { fecha: inicioDeHoy() },
    include: { cajero: true },
  });

  const resultados: CierreDiaResumen[] = [];
  for (const cierre of cierres) {
    resultados.push(await reconstruirResumenCierre(cierre));
  }

  return resultados;
}

// Deshace el/los cierre(s) de HOY (por si se cerró por error): desvincula
// las sesiones de su CierreDia (vuelven a quedar pendientes, con
// sueldoBaseSesion/bonoSesion en null) y borra la fila de CierreDia. Mismo
// permiso que cerrarDia() — dueño o el cajero designado, ya que es la
// contracara de esa acción. Si después se carga más actividad y se vuelve a
// cerrar, el bono se recalcula de nuevo con el total actualizado.
export async function reabrirDia(): Promise<void> {
  const usuario = await requireUsuario();

  if (usuario.rol !== "DUENO" && !usuario.autorizadoCierreDia) {
    throw new Error("No estás autorizado para reabrir la caja del día.");
  }

  const cierresHoy = await prisma.cierreDia.findMany({ where: { fecha: inicioDeHoy() } });

  if (!cierresHoy.length) {
    throw new Error("No hay ningún cierre de hoy para reabrir.");
  }

  await prisma.$transaction([
    prisma.sesionCaja.updateMany({
      where: { cierreDiaId: { in: cierresHoy.map((c) => c.id) } },
      data: { cierreDiaId: null, sueldoBaseSesion: null, bonoSesion: null },
    }),
    prisma.cierreDia.deleteMany({ where: { id: { in: cierresHoy.map((c) => c.id) } } }),
  ]);

  revalidatePath("/caja");
  revalidatePath("/cierre-caja");
}

// Detalle de un cierre pasado (cualquier fecha), para la página de detalle
// que se abre desde Reportes históricos — solo el dueño ve reportes, así que
// solo el dueño puede pedir este detalle.
export async function obtenerDetalleCierre(cierreDiaId: string): Promise<CierreDiaResumen> {
  const usuario = await requireUsuario();

  if (usuario.rol !== "DUENO") {
    throw new Error("No estás autorizado para ver este detalle.");
  }

  const cierre = await prisma.cierreDia.findUniqueOrThrow({
    where: { id: cierreDiaId },
    include: { cajero: true },
  });

  return reconstruirResumenCierre(cierre);
}
