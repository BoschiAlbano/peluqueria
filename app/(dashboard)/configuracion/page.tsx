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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      <Tabs defaultValue="servicios">
        <TabsList>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="comision">Comisión</TabsTrigger>
          <TabsTrigger value="cajeros">Cajeros</TabsTrigger>
          <TabsTrigger value="peluqueros">Peluqueros</TabsTrigger>
          <TabsTrigger value="metas">Escalones de bono</TabsTrigger>
        </TabsList>

        <TabsContent value="servicios">
          <Card>
            <CardHeader>
              <CardTitle>Servicios</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiciosForm servicios={servicios} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comision">
          <ComisionForm
            porcentajePeluqueroActual={Number(configComision?.porcentajePeluquero ?? 60)}
            porcentajeDuenoActual={Number(configComision?.porcentajeDueno ?? 40)}
          />
        </TabsContent>

        <TabsContent value="cajeros">
          <Card>
            <CardHeader>
              <CardTitle>Cajeros</CardTitle>
            </CardHeader>
            <CardContent>
              <CajerosForm cajeros={cajeros} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="peluqueros">
          <Card>
            <CardHeader>
              <CardTitle>Peluqueros</CardTitle>
            </CardHeader>
            <CardContent>
              <PeluquerosForm peluqueros={peluqueros} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metas">
          <Card>
            <CardHeader>
              <CardTitle>Escalones de bono</CardTitle>
            </CardHeader>
            <CardContent>
              <MetasForm metas={metas} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageHeader>
  );
}
