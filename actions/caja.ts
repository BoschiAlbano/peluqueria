"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { SUELDO_BASE_CAJERO } from "@/lib/config-negocio";
import { MetodoPago } from "@/generated/prisma/enums";
import { requireUsuario } from "@/lib/auth";
import { inicioDelDia } from "@/lib/rangos-fecha";

const ERROR_CAJA_YA_ABIERTA = "Ya hay una caja abierta. Hay que cerrarla antes de abrir otra.";

export async function abrirSesion(etiqueta?: string) {
  const usuario = await requireUsuario();

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
};

export type TotalPorMetodoPago = {
  metodoPago: MetodoPago;
  total: number;
  cantidad: number;
};

export type ResumenServicio = {
  servicioNombre: string;
  cantidad: number;
  total: number;
};

export type ResumenSesionCajero = SesionCerradaResumen & {
  totalesPorMetodoPago: TotalPorMetodoPago[];
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
  fecha: Date;
  totalCortesDia: number;
  bonoAlcanzado: boolean;
  montoBonoPorCaja: number | null;
  sesiones: SesionCerradaResumen[];
  peluqueros: PeluqueroResumenDia[];
};

export type EstadoCierreDia = {
  sesionesPendientes: number;
  totalCortesPendientes: number;
  hayCajaAbierta: boolean;
};

export async function obtenerEstadoCierreDia(): Promise<EstadoCierreDia> {
  const [pendientes, sesionAbierta] = await Promise.all([
    prisma.sesionCaja.findMany({
      where: { cierreDiaId: null, horaCierre: { not: null } },
    }),
    prisma.sesionCaja.findFirst({ where: { horaCierre: null } }),
  ]);

  return {
    sesionesPendientes: pendientes.length,
    totalCortesPendientes: pendientes.reduce((acc, s) => acc + (s.totalCortesSesion ?? 0), 0),
    hayCajaAbierta: !!sesionAbierta,
  };
}

// Cortes que van a contar para el bono la próxima vez que se presione
// "Cerrar caja del día" — sesiones cerradas aún no liquidadas + lo que va de
// la sesión abierta en este momento (si hay una). Usar esto (y no una
// ventana de fecha "hoy") para mostrar el avance en vivo: cerrarDia() agrupa
// por sesión, no por el reloj, así que si una sesión cruza la medianoche,
// contar por fecha del ticket individual desincroniza el número en vivo del
// número que termina liquidándose.
export async function obtenerCortesHoyEnVivo(): Promise<number> {
  const [pendientes, sesionAbierta] = await Promise.all([
    prisma.sesionCaja.findMany({
      where: { cierreDiaId: null, horaCierre: { not: null } },
    }),
    prisma.sesionCaja.findFirst({ where: { horaCierre: null } }),
  ]);

  let cortes = pendientes.reduce((acc, s) => acc + (s.totalCortesSesion ?? 0), 0);

  if (sesionAbierta) {
    cortes += await prisma.ventaDetalle.count({
      where: { venta: { sesionCajaId: sesionAbierta.id }, servicio: { cuentaParaBono: true } },
    });
  }

  return cortes;
}

// Acción explícita del cajero/dueño: liquida todas las sesiones de caja
// cerradas y todavía no agrupadas en un CierreDia, calculando sueldo base +
// bono (según el total de cortes del día) para cada una, y la comisión de
// cada peluquero sobre las ventas de esas sesiones.
//
// Si ya se había presionado "Cerrar caja del día" antes en la misma fecha
// (por ejemplo, se abrió y cerró otra sesión después), se recalcula sobre
// TODAS las sesiones de esa fecha (no solo las nuevas): el bono se reevalúa
// con el total de cortes actualizado y se corrige retroactivamente en todas
// las sesiones de ese día, incluidas las ya liquidadas antes.
export async function cerrarDia(): Promise<CierreDiaResumen> {
  await requireUsuario();

  const sesionAbierta = await prisma.sesionCaja.findFirst({
    where: { horaCierre: null },
  });

  if (sesionAbierta) {
    throw new Error("Hay una caja abierta. Cerrala antes de cerrar el día.");
  }

  const sesionesPendientes = await prisma.sesionCaja.findMany({
    where: { cierreDiaId: null, horaCierre: { not: null } },
    orderBy: { horaApertura: "asc" },
  });

  if (!sesionesPendientes.length) {
    throw new Error("No hay sesiones de caja pendientes de liquidar.");
  }

  // inicioDelDia calcula la medianoche en el huso horario del negocio (no el
  // del servidor) — ver lib/rangos-fecha.ts.
  const fecha = inicioDelDia(sesionesPendientes[0].horaApertura);
  const finFecha = new Date(fecha);
  finFecha.setUTCDate(finFecha.getUTCDate() + 1);

  const sesionesDelDia = await prisma.sesionCaja.findMany({
    where: {
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
    where: { fecha },
    create: {
      fecha,
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
  const detallesDia = await prisma.ventaDetalle.findMany({
    where: { venta: { sesionCajaId: { in: sesionIds } } },
    include: { servicio: true, peluquero: true },
  });

  const peluqueroMap = new Map<string, PeluqueroResumenDia>();
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
  }

  revalidatePath("/caja");

  return {
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
    })),
    peluqueros: [...peluqueroMap.values()],
  };
}
