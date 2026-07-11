import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { CierreDiaCard } from "@/components/pos/cierre-dia-card";
import { VentasDiaCard } from "@/components/pos/ventas-dia-card";
import { TotalesHoyCard } from "@/components/pos/totales-hoy-card";
import {
  obtenerCajerosConPendientes,
  obtenerCierresDeHoy,
  obtenerTotalesDelDia,
} from "@/actions/caja";
import { obtenerServiciosDelDia } from "@/actions/ventas";
import { PageHeader } from "@/components/layout/page-header";

export default async function CierreCajaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    redirect("/login");
  }
  if (usuario.rol !== "DUENO" && !usuario.autorizadoCierreDia) {
    redirect("/caja");
  }

  const [estadoCierreDia, totalesDelDia, serviciosDelDia, cierresDeHoy] =
    await Promise.all([
      obtenerCajerosConPendientes(),
      obtenerTotalesDelDia(),
      obtenerServiciosDelDia(),
      obtenerCierresDeHoy(),
    ]);

  return (
    <PageHeader
      title="Cierre del día"
      description="Liquidá sueldo + bono del día de cada cajero, con los totales y servicios de todo el día comercial."
    >
      <CierreDiaCard
        cajeros={estadoCierreDia.cajeros}
        cajeroIdConCajaAbierta={estadoCierreDia.cajeroIdConCajaAbierta}
        cierresDeHoy={cierresDeHoy}
      />

      <TotalesHoyCard totales={totalesDelDia} />

      <VentasDiaCard
        ventas={serviciosDelDia}
        titulo="Servicios del día"
        mensajeVacio="Todavía no se cargaron ventas hoy."
      />
    </PageHeader>
  );
}
