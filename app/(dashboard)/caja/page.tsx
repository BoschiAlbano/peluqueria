import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { SesionCajaCard } from "@/components/pos/sesion-caja-card";
import { VentasDiaCard } from "@/components/pos/ventas-dia-card";
import { TotalesHoyCard } from "@/components/pos/totales-hoy-card";
import { obtenerTotalesDeLaSesion } from "@/actions/caja";
import { obtenerVentasDeLaSesionActual } from "@/actions/ventas";
import { PageHeader } from "@/components/layout/page-header";

export default async function CajaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    redirect("/login");
  }

  const [sesionAbierta, ventasDeLaSesion, totalesDeLaSesion] =
    await Promise.all([
      prisma.sesionCaja.findFirst({
        where: { horaCierre: null },
        include: { cajero: true },
      }),
      obtenerVentasDeLaSesionActual(),
      obtenerTotalesDeLaSesion(),
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
      (acc, v) =>
        acc + v.detalles.filter((d) => d.servicio.cuentaParaBono).length,
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
    <PageHeader
      title="Caja Actual"
      description="Abrí y cerrá sesiones de caja durante el día (mañana, tarde, lo que haga falta)."
    >
      <SesionCajaCard
        sesion={sesionInfo}
        totalVentasSesion={totalVentasSesion}
      />

      <TotalesHoyCard totales={totalesDeLaSesion} />
      <VentasDiaCard ventas={ventasDeLaSesion} />
    </PageHeader>
  );
}
