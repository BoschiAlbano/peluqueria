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

function construirWhereReporte(filtro: FiltroReporte) {
  return {
    venta: { fecha: { gte: filtro.desde, lte: filtro.hasta } },
    ...(filtro.peluqueroId ? { peluqueroId: filtro.peluqueroId } : {}),
    ...(filtro.servicioId ? { servicioId: filtro.servicioId } : {}),
  };
}

function mapearFila(d: {
  venta: { fecha: Date; numeroTicket: number; metodoPago: string };
  peluquero: { nombre: string };
  servicio: { nombre: string; cuentaParaBono: boolean };
  precioCobrado: unknown;
  comisionPeluquero: unknown;
  comisionDueno: unknown;
}): FilaReporte {
  return {
    fecha: d.venta.fecha,
    numeroTicket: d.venta.numeroTicket,
    peluqueroNombre: d.peluquero.nombre,
    servicioNombre: d.servicio.nombre,
    metodoPago: d.venta.metodoPago,
    precioCobrado: Number(d.precioCobrado),
    comisionPeluquero: Number(d.comisionPeluquero),
    comisionDueno: Number(d.comisionDueno),
    cuentaParaBono: d.servicio.cuentaParaBono,
  };
}

// Usada por la exportación a CSV, que necesita todas las filas del rango
// (no tiene sentido paginar un archivo descargable).
export async function obtenerFilasReporte(filtro: FiltroReporte): Promise<FilaReporte[]> {
  const detalles = await prisma.ventaDetalle.findMany({
    where: construirWhereReporte(filtro),
    include: { venta: true, peluquero: true, servicio: true },
    orderBy: { venta: { fecha: "asc" } },
  });

  return detalles.map(mapearFila);
}

export const FILAS_POR_PAGINA = 10;

export async function obtenerFilasReportePaginado(
  filtro: FiltroReporte,
  pagina: number,
): Promise<{ filas: FilaReporte[]; total: number; totalPaginas: number }> {
  const where = construirWhereReporte(filtro);

  const [detalles, total] = await Promise.all([
    prisma.ventaDetalle.findMany({
      where,
      include: { venta: true, peluquero: true, servicio: true },
      orderBy: { venta: { fecha: "asc" } },
      skip: (pagina - 1) * FILAS_POR_PAGINA,
      take: FILAS_POR_PAGINA,
    }),
    prisma.ventaDetalle.count({ where }),
  ]);

  return {
    filas: detalles.map(mapearFila),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / FILAS_POR_PAGINA)),
  };
}

// Totales del rango completo (no solo la página actual) — se calculan con un
// aggregate en la base en vez de traer todas las filas a JS para sumarlas.
export async function obtenerTotalesReporte(filtro: FiltroReporte): Promise<{
  totalVentas: number;
  totalComisionPeluqueros: number;
  totalComisionDueno: number;
}> {
  const resultado = await prisma.ventaDetalle.aggregate({
    where: construirWhereReporte(filtro),
    _sum: {
      precioCobrado: true,
      comisionPeluquero: true,
      comisionDueno: true,
    },
  });

  return {
    totalVentas: Number(resultado._sum.precioCobrado ?? 0),
    totalComisionPeluqueros: Number(resultado._sum.comisionPeluquero ?? 0),
    totalComisionDueno: Number(resultado._sum.comisionDueno ?? 0),
  };
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

export type FilaCierre = {
  id: string;
  fecha: Date;
  cajeroNombre: string;
  totalCortesDia: number;
  bonoAlcanzado: boolean;
  montoBonoPorCaja: number | null;
  sesiones: number;
  sueldoTotal: number;
  bonoTotal: number;
};

// Historial de cierres de caja (sueldo + bono liquidado por cajero, por
// día) — vive en Reportes porque es la misma audiencia (dueño) y el mismo
// patrón (rango de fechas) que el resto de la página; no hace falta una
// página separada.
export async function obtenerCierresHistoricos(desde: Date, hasta: Date): Promise<FilaCierre[]> {
  const cierres = await prisma.cierreDia.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
    include: { cajero: true, sesionesCaja: true },
    orderBy: { fecha: "desc" },
  });

  return cierres.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    cajeroNombre: c.cajero.nombre,
    totalCortesDia: c.totalCortesDia,
    bonoAlcanzado: c.bonoAlcanzado,
    montoBonoPorCaja: c.montoBonoPorCaja !== null ? Number(c.montoBonoPorCaja) : null,
    sesiones: c.sesionesCaja.length,
    sueldoTotal: c.sesionesCaja.reduce((acc, s) => acc + Number(s.sueldoBaseSesion ?? 0), 0),
    bonoTotal: c.sesionesCaja.reduce((acc, s) => acc + Number(s.bonoSesion ?? 0), 0),
  }));
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
