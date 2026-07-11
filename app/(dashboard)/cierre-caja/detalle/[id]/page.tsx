import { notFound, redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { obtenerDetalleCierre } from "@/actions/caja";
import { formatoFechaSoloDia } from "@/lib/rangos-fecha";
import { DetalleCierreView } from "@/components/reportes/detalle-cierre-view";
import { PageHeader } from "@/components/layout/page-header";

export default async function DetalleCierrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "DUENO") {
    redirect("/ventas");
  }

  const { id } = await params;

  let cierre;
  try {
    cierre = await obtenerDetalleCierre(id);
  } catch {
    notFound();
  }

  return (
    <PageHeader
      title={`Cierre del ${formatoFechaSoloDia(cierre.fecha)} — ${cierre.cajeroNombre}`}
      description="Detalle del cierre de caja: sesiones y comisión de cada peluquero."
    >
      <DetalleCierreView cierre={cierre} />
    </PageHeader>
  );
}
