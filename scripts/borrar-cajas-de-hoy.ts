// Utilidad para pruebas: borra las sesiones de caja abiertas/cerradas HOY
// (día comercial en huso horario de Buenos Aires — ver lib/rangos-fecha.ts),
// junto con las ventas y cierres de caja que dependan de ellas. No toca
// cajeros, peluqueros, servicios ni nada de otros días.
//
// Orden de borrado (de "hijo" a "padre", por las foreign keys sin cascade):
// VentaDetalle -> Venta -> SesionCaja -> CierreDia.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { inicioDeHoy } from "@/lib/rangos-fecha";

async function main() {
  const inicioHoy = inicioDeHoy();

  const sesionesHoy = await prisma.sesionCaja.findMany({
    where: { horaApertura: { gte: inicioHoy } },
    select: { id: true },
  });
  const sesionIds = sesionesHoy.map((s) => s.id);

  if (!sesionIds.length) {
    console.log("No hay sesiones de caja de hoy para borrar.");
    return;
  }

  const ventasHoy = await prisma.venta.findMany({
    where: { sesionCajaId: { in: sesionIds } },
    select: { id: true },
  });
  const ventaIds = ventasHoy.map((v) => v.id);

  const { count: detallesBorrados } = await prisma.ventaDetalle.deleteMany({
    where: { ventaId: { in: ventaIds } },
  });
  const { count: ventasBorradas } = await prisma.venta.deleteMany({
    where: { id: { in: ventaIds } },
  });
  const { count: sesionesBorradas } = await prisma.sesionCaja.deleteMany({
    where: { id: { in: sesionIds } },
  });
  const { count: cierresBorrados } = await prisma.cierreDia.deleteMany({
    where: { fecha: inicioHoy },
  });

  console.log(`Borrado: ${sesionesBorradas} sesión(es) de caja, ${ventasBorradas} venta(s), ${detallesBorrados} detalle(s), ${cierresBorrados} cierre(s) de día.`);
}

main().finally(() => prisma.$disconnect());
