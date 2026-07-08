import { prisma } from "@/lib/prisma";
import { SesionCajaCard } from "@/components/pos/sesion-caja-card";
import { CierreDiaCard } from "@/components/pos/cierre-dia-card";
import { obtenerEstadoCierreDia } from "@/actions/caja";

export default async function CajaPage() {
  const [sesionAbierta, estadoCierreDia] = await Promise.all([
    prisma.sesionCaja.findFirst({
      where: { horaCierre: null },
      include: { cajero: true },
    }),
    obtenerEstadoCierreDia(),
  ]);

  let sesionInfo = null;
  let totalVentasSesion = 0;

  if (sesionAbierta) {
    const ventas = await prisma.venta.findMany({
      where: { sesionCajaId: sesionAbierta.id },
      include: { detalles: { include: { servicio: true } } },
    });

    totalVentasSesion = ventas.reduce((acc, v) => acc + Number(v.total), 0);
    const cortesRegistrados = ventas.reduce(
      (acc, v) => acc + v.detalles.filter((d) => d.servicio.cuentaParaBono).length,
      0,
    );

    sesionInfo = {
      id: sesionAbierta.id,
      cajeroNombre: sesionAbierta.cajero.nombre,
      horaApertura: sesionAbierta.horaApertura,
      ventasRegistradas: ventas.length,
      cortesRegistrados,
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Caja</h1>
        <p className="text-sm text-muted-foreground">
          Abrí y cerrá sesiones de caja durante el día (mañana, tarde, lo que haga falta),
          y liquidá sueldo + bono al cerrar la caja del día.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <SesionCajaCard sesion={sesionInfo} totalVentasSesion={totalVentasSesion} />

        <CierreDiaCard
          sesionesPendientes={estadoCierreDia.sesionesPendientes}
          totalCortesPendientes={estadoCierreDia.totalCortesPendientes}
          hayCajaAbierta={estadoCierreDia.hayCajaAbierta}
        />
      </div>
    </div>
  );
}
