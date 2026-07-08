"use server";

import { prisma } from "@/lib/prisma";
import { MetodoPago } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/lib/auth";

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
    const comisionPeluquero =
      (precioCobrado * Number(config.porcentajePeluquero)) / 100;
    const comisionDueno = (precioCobrado * Number(config.porcentajeDueno)) / 100;

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
    const sesiones = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "SesionCaja" WHERE "horaCierre" IS NULL FOR UPDATE
    `;
    const sesionAbierta = sesiones[0];

    if (!sesionAbierta) {
      throw new Error("No hay una caja abierta. Abrí una sesión antes de cargar ventas.");
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
    })),
  };
}
