import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { listarCajeros, listarPeluqueros } from "@/actions/usuarios";
import { listarMetas, listarServicios } from "@/actions/configuracion";
import { ServiciosForm } from "@/components/configuracion/servicios-form";
import { ComisionForm } from "@/components/configuracion/comision-form";
import { CajerosForm } from "@/components/configuracion/cajeros-form";
import { PeluquerosForm } from "@/components/configuracion/peluqueros-form";
import { MetasForm } from "@/components/configuracion/metas-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export default async function ConfiguracionPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "DUENO") {
    redirect("/ventas");
  }

  const [servicios, configComision, cajeros, peluqueros, metas] =
    await Promise.all([
      listarServicios(),
      prisma.configuracionComision.findFirst({
        orderBy: { vigenteDesde: "desc" },
      }),
      listarCajeros(),
      listarPeluqueros(),
      listarMetas(),
    ]);

  return (
    <PageHeader
      title="Configuración"
      description="Precios de servicios, porcentaje de comisión, cajeros y peluqueros."
    >
      <Card>
        <CardHeader>
          <CardTitle>Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiciosForm servicios={servicios} />
        </CardContent>
      </Card>

      <ComisionForm
        porcentajePeluqueroActual={Number(
          configComision?.porcentajePeluquero ?? 60,
        )}
        porcentajeDuenoActual={Number(configComision?.porcentajeDueno ?? 40)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Cajeros</CardTitle>
        </CardHeader>
        <CardContent>
          <CajerosForm cajeros={cajeros} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peluqueros</CardTitle>
        </CardHeader>
        <CardContent>
          <PeluquerosForm peluqueros={peluqueros} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalones de bono</CardTitle>
        </CardHeader>
        <CardContent>
          <MetasForm metas={metas} />
        </CardContent>
      </Card>
    </PageHeader>
  );
}
