import { prisma } from "@/lib/prisma";
import { inicioDeRango } from "@/lib/rangos-fecha";

export type FiltroReporte = {
  desde: Date;
  hasta: Date;
  peluqueroId?: string;
  servicioId?: string;
};

export type FilaReporte = {
  fecha: Date;
  numeroTicket: number;
  peluqueroNombre: string;
  servicioNombre: string;
  metodoPago: string;
  precioCobrado: number;
  comisionPeluquero: number;
  comisionDueno: number;
  cuentaParaBono: boolean;
};

export async function obtenerFilasReporte(filtro: FiltroReporte): Promise<FilaReporte[]> {
  const detalles = await prisma.ventaDetalle.findMany({
    where: {
      venta: { fecha: { gte: filtro.desde, lte: filtro.hasta } },
      ...(filtro.peluqueroId ? { peluqueroId: filtro.peluqueroId } : {}),
      ...(filtro.servicioId ? { servicioId: filtro.servicioId } : {}),
    },
    include: { venta: true, peluquero: true, servicio: true },
    orderBy: { venta: { fecha: "asc" } },
  });

  return detalles.map((d) => ({
    fecha: d.venta.fecha,
    numeroTicket: d.venta.numeroTicket,
    peluqueroNombre: d.peluquero.nombre,
    servicioNombre: d.servicio.nombre,
    metodoPago: d.venta.metodoPago,
    precioCobrado: Number(d.precioCobrado),
    comisionPeluquero: Number(d.comisionPeluquero),
    comisionDueno: Number(d.comisionDueno),
    cuentaParaBono: d.servicio.cuentaParaBono,
  }));
}

// Convierte "YYYY-MM-DD" (input type=date) a un rango [00:00:00, 23:59:59.999]
// en el huso horario del negocio (no el del servidor) — ver lib/rangos-fecha.ts.
export function rangoDesdeParams(desdeStr?: string, hastaStr?: string): { desde: Date; hasta: Date } {
  const ahora = new Date();
  const OFFSET_NEGOCIO = "-03:00";

  const desde = desdeStr ? new Date(`${desdeStr}T00:00:00${OFFSET_NEGOCIO}`) : inicioDeRango("mes");
  const hasta = hastaStr ? new Date(`${hastaStr}T23:59:59.999${OFFSET_NEGOCIO}`) : ahora;

  return { desde, hasta };
}

function escaparCsv(valor: string | number): string {
  const s = String(valor);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function filasACsv(filas: FilaReporte[]): string {
  const encabezado = [
    "Fecha",
    "Ticket",
    "Peluquero",
    "Servicio",
    "Método de pago",
    "Precio",
    "Comisión peluquero",
    "Comisión dueño",
  ];

  const lineas = filas.map((f) =>
    [
      f.fecha.toLocaleString("es-AR"),
      f.numeroTicket,
      f.peluqueroNombre,
      f.servicioNombre,
      f.metodoPago,
      f.precioCobrado,
      f.comisionPeluquero,
      f.comisionDueno,
    ]
      .map(escaparCsv)
      .join(","),
  );

  return [encabezado.join(","), ...lineas].join("\n");
}
