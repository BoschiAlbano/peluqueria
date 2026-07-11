"use server";

import { prisma } from "@/lib/prisma";
import { MetodoPago } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/lib/auth";
import { inicioDeHoy } from "@/lib/rangos-fecha";

export type LineaVentaInput = {
  peluqueroId: string;
  servicioId: string;
};

export type CrearVentaInput = {
  metodoPago: MetodoPago;
  comprobanteTransferenciaUlt4?: string;
  lineas: LineaVentaInput[];
};

export type CrearVentaResult = {
  ventaId: string;
  numeroTicket: number;
  fecha: Date;
  total: number;
  metodoPago: MetodoPago;
  comprobanteTransferenciaUlt4: string | null;
  detalles: {
    servicioNombre: string;
    peluqueroNombre: string;
    precioCobrado: number;
    comisionPeluquero: number;
    comisionDueno: number;
  }[];
};

export async function crearVenta(
  input: CrearVentaInput,
): Promise<CrearVentaResult> {
  const usuario = await requireUsuario();

  if (!input.lineas.length) {
    throw new Error("La venta debe tener al menos un servicio.");
  }

  if (input.metodoPago === MetodoPago.TRANSFERENCIA) {
    if (!/^\d{4}$/.test(input.comprobanteTransferenciaUlt4 ?? "")) {
      throw new Error(
        "Para Transferencia hay que ingresar los últimos 4 dígitos del comprobante.",
      );
    }
  }

  const config = await prisma.configuracionComision.findFirst({
    orderBy: { vigenteDesde: "desc" },
  });

  if (!config) {
    throw new Error("No hay una configuración de comisión vigente.");
  }

  const servicioIds = [...new Set(input.lineas.map((l) => l.servicioId))];
  const servicios = await prisma.servicio.findMany({
    where: { id: { in: servicioIds }, activo: true },
  });
  const servicioPorId = new Map(servicios.map((s) => [s.id, s]));

  const peluqueroIds = [...new Set(input.lineas.map((l) => l.peluqueroId))];
  const peluqueros = await prisma.usuario.findMany({
    where: { id: { in: peluqueroIds }, esPeluquero: true, activo: true },
  });
  const peluqueroPorId = new Map(peluqueros.map((p) => [p.id, p]));

  let total = 0;
  const detallesData = input.lineas.map((linea) => {
    const servicio = servicioPorId.get(linea.servicioId);
    if (!servicio) {
      throw new Error("Uno de los servicios seleccionados no existe o está inactivo.");
    }
    if (!peluqueroPorId.has(linea.peluqueroId)) {
      throw new Error("Uno de los peluqueros seleccionados no existe o está inactivo.");
    }

    const precioCobrado = Number(servicio.precio);
    // La comisión del dueño se calcula como el resto (precio - comisión del
    // peluquero, ya redondeada a centavos) en vez de aplicar su propio
    // porcentaje de forma independiente: si se redondean las dos por
    // separado, un precio/porcentaje que caiga justo en medio centavo puede
    // hacer que ambas columnas redondeen para el mismo lado y la suma quede
    // un centavo por encima o por debajo del precio cobrado.
    const comisionPeluquero =
      Math.round(((precioCobrado * Number(config.porcentajePeluquero)) / 100) * 100) / 100;
    const comisionDueno = Math.round((precioCobrado - comisionPeluquero) * 100) / 100;

    total += precioCobrado;

    return {
      servicioId: linea.servicioId,
      peluqueroId: linea.peluqueroId,
      precioCobrado,
      comisionPeluquero,
      comisionDueno,
    };
  });

  // La sesión abierta se busca y bloquea (FOR UPDATE) dentro de la misma
  // transacción en la que se inserta la venta. Esto serializa esta acción
  // contra cerrarSesion(), que toma el mismo lock antes de calcular los
  // totales de la sesión — sin esto, una venta podría insertarse justo entre
  // el cálculo de totales y el cierre, quedando cobrada pero afuera del
  // ticket de control y del total usado para el bono.
  const venta = await prisma.$transaction(async (tx) => {
    const sesiones = await tx.$queryRaw<{ id: string; cajeroId: string; cajeroNombre: string }[]>`
      SELECT "SesionCaja".id, "SesionCaja"."cajeroId", "Usuario".nombre AS "cajeroNombre"
      FROM "SesionCaja"
      JOIN "Usuario" ON "Usuario".id = "SesionCaja"."cajeroId"
      WHERE "SesionCaja"."horaCierre" IS NULL
      FOR UPDATE OF "SesionCaja"
    `;
    const sesionAbierta = sesiones[0];

    if (!sesionAbierta) {
      throw new Error("No hay una caja abierta. Abrí una sesión antes de cargar ventas.");
    }

    if (sesionAbierta.cajeroId !== usuario.id) {
      throw new Error(
        `Hay una caja abierta de ${sesionAbierta.cajeroNombre}. Tiene que cerrarla antes de que abras la tuya.`,
      );
    }

    return tx.venta.create({
      data: {
        cajeroId: usuario.id,
        sesionCajaId: sesionAbierta.id,
        metodoPago: input.metodoPago,
        comprobanteTransferenciaUlt4:
          input.metodoPago === MetodoPago.TRANSFERENCIA
            ? input.comprobanteTransferenciaUlt4
            : null,
        total,
        detalles: { create: detallesData },
      },
      include: {
        detalles: true,
      },
    });
  });

  revalidatePath("/ventas");
  revalidatePath("/caja");

  return {
    ventaId: venta.id,
    numeroTicket: venta.numeroTicket,
    fecha: venta.fecha,
    total: Number(venta.total),
    metodoPago: venta.metodoPago,
    comprobanteTransferenciaUlt4: venta.comprobanteTransferenciaUlt4,
    detalles: venta.detalles.map((d) => ({
      servicioNombre: servicioPorId.get(d.servicioId)!.nombre,
      peluqueroNombre: peluqueroPorId.get(d.peluqueroId)!.nombre,
      precioCobrado: Number(d.precioCobrado),
      comisionPeluquero: Number(d.comisionPeluquero),
      comisionDueno: Number(d.comisionDueno),
    })),
  };
}

// Ventas de la sesión de caja actualmente abierta del cajero logueado — para
// que pueda controlar lo que vendió en este turno y reimprimir un ticket si
// el original falló al imprimir. Acotado a la sesión (no a todo el día
// comercial): si el cajero abrió una sesión nueva, no ve acá las ventas de
// una sesión anterior ya cerrada — eso quedaría mezclando turnos distintos.
export async function obtenerVentasDeLaSesionActual(): Promise<CrearVentaResult[]> {
  const usuario = await requireUsuario();

  const sesionAbierta = await prisma.sesionCaja.findFirst({
    where: { cajeroId: usuario.id, horaCierre: null },
  });

  if (!sesionAbierta) {
    return [];
  }

  const ventas = await prisma.venta.findMany({
    where: { sesionCajaId: sesionAbierta.id },
    include: { detalles: { include: { servicio: true, peluquero: true } } },
    orderBy: { fecha: "desc" },
  });

  return ventas.map((v) => ({
    ventaId: v.id,
    numeroTicket: v.numeroTicket,
    fecha: v.fecha,
    total: Number(v.total),
    metodoPago: v.metodoPago,
    comprobanteTransferenciaUlt4: v.comprobanteTransferenciaUlt4,
    detalles: v.detalles.map((d) => ({
      servicioNombre: d.servicio.nombre,
      peluqueroNombre: d.peluquero.nombre,
      precioCobrado: Number(d.precioCobrado),
      comisionPeluquero: Number(d.comisionPeluquero),
      comisionDueno: Number(d.comisionDueno),
    })),
  }));
}

// Todas las ventas del día comercial, de cualquier cajero — para la página
// de Cierre de caja, que ve el dueño o el cajero designado (no el cajero
// operativo del día a día, que solo ve las de su propia sesión).
export async function obtenerServiciosDelDia(): Promise<CrearVentaResult[]> {
  const usuario = await requireUsuario();
  if (usuario.rol !== "DUENO" && !usuario.autorizadoCierreDia) {
    throw new Error("No estás autorizado para ver el cierre de caja.");
  }

  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicioDeHoy() } },
    include: { detalles: { include: { servicio: true, peluquero: true } } },
    orderBy: { fecha: "desc" },
  });

  return ventas.map((v) => ({
    ventaId: v.id,
    numeroTicket: v.numeroTicket,
    fecha: v.fecha,
    total: Number(v.total),
    metodoPago: v.metodoPago,
    comprobanteTransferenciaUlt4: v.comprobanteTransferenciaUlt4,
    detalles: v.detalles.map((d) => ({
      servicioNombre: d.servicio.nombre,
      peluqueroNombre: d.peluquero.nombre,
      precioCobrado: Number(d.precioCobrado),
      comisionPeluquero: Number(d.comisionPeluquero),
      comisionDueno: Number(d.comisionDueno),
    })),
  }));
}
