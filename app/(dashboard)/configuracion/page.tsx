import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { listarCajeros, listarPeluqueros } from "@/actions/usuarios";
import { listarMetas } from "@/actions/configuracion";
import { PreciosForm } from "@/components/configuracion/precios-form";
import { ComisionForm } from "@/components/configuracion/comision-form";
import { CajerosForm } from "@/components/configuracion/cajeros-form";
import { PeluquerosForm } from "@/components/configuracion/peluqueros-form";
import { MetasForm } from "@/components/configuracion/metas-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConfiguracionPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "DUENO") {
    redirect("/ventas");
  }

  const [servicios, configComision, cajeros, peluqueros, metas] = await Promise.all([
    prisma.servicio.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.configuracionComision.findFirst({ orderBy: { vigenteDesde: "desc" } }),
    listarCajeros(),
    listarPeluqueros(),
    listarMetas(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Precios de servicios, porcentaje de comisión, cajeros y peluqueros.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <PreciosForm
              servicios={servicios.map((s) => ({
                id: s.id,
                nombre: s.nombre,
                precio: Number(s.precio),
              }))}
            />
          </CardContent>
        </Card>

        <ComisionForm
          porcentajePeluqueroActual={Number(configComision?.porcentajePeluquero ?? 60)}
          porcentajeDuenoActual={Number(configComision?.porcentajeDueno ?? 40)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
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
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Escalones de bono</CardTitle>
        </CardHeader>
        <CardContent>
          <MetasForm metas={metas} />
        </CardContent>
      </Card>
    </div>
  );
}
