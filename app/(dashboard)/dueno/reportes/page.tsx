import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { obtenerFilasReporte, rangoDesdeParams } from "@/lib/reportes";
import { fechaComercialYMD } from "@/lib/rangos-fecha";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

// Usamos el huso horario del negocio (no toISOString, que es UTC) para que
// la fecha mostrada en el filtro coincida con el "hoy" real del dueño.
function aInputDate(d: Date): string {
  return fechaComercialYMD(d);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; peluqueroId?: string; servicioId?: string }>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "DUENO") {
    redirect("/ventas");
  }

  const params = await searchParams;
  const { desde, hasta } = rangoDesdeParams(params.desde, params.hasta);
  const peluqueroId = params.peluqueroId || undefined;
  const servicioId = params.servicioId || undefined;

  const [filas, peluqueros, servicios] = await Promise.all([
    obtenerFilasReporte({ desde, hasta, peluqueroId, servicioId }),
    prisma.usuario.findMany({ where: { esPeluquero: true }, orderBy: { nombre: "asc" } }),
    prisma.servicio.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const totalVentas = filas.reduce((acc, f) => acc + f.precioCobrado, 0);
  const totalComisionPeluqueros = filas.reduce((acc, f) => acc + f.comisionPeluquero, 0);
  const totalComisionDueno = filas.reduce((acc, f) => acc + f.comisionDueno, 0);

  const queryString = new URLSearchParams({
    desde: aInputDate(desde),
    hasta: params.hasta || aInputDate(hasta),
    ...(peluqueroId ? { peluqueroId } : {}),
    ...(servicioId ? { servicioId } : {}),
  }).toString();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Reportes históricos</h1>
        <p className="text-sm text-muted-foreground">
          Ventas por rango de fechas, filtrables por peluquero y servicio.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="desde">Desde</Label>
              <input
                id="desde"
                name="desde"
                type="date"
                defaultValue={params.desde || aInputDate(desde)}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hasta">Hasta</Label>
              <input
                id="hasta"
                name="hasta"
                type="date"
                defaultValue={params.hasta || aInputDate(hasta)}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="peluqueroId">Peluquero</Label>
              <select
                id="peluqueroId"
                name="peluqueroId"
                defaultValue={peluqueroId ?? ""}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Todos</option>
                {peluqueros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="servicioId">Servicio</Label>
              <select
                id="servicioId"
                name="servicioId"
                defaultValue={servicioId ?? ""}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Todos</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
              <Button type="submit">Filtrar</Button>
              <a href={`/api/reportes/csv?${queryString}`}>
                <Button type="button" variant="outline">
                  Descargar CSV
                </Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatoMoneda.format(totalVentas)}</p>
            <p className="text-xs text-muted-foreground">{filas.length} líneas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Comisión peluqueros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatoMoneda.format(totalComisionPeluqueros)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Ganancia del dueño</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatoMoneda.format(totalComisionDueno)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Peluquero</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Com. peluquero</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f, i) => (
                <TableRow key={i}>
                  <TableCell>{f.fecha.toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>#{f.numeroTicket}</TableCell>
                  <TableCell>{f.peluqueroNombre}</TableCell>
                  <TableCell>{f.servicioNombre}</TableCell>
                  <TableCell>{f.metodoPago}</TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(f.precioCobrado)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(f.comisionPeluquero)}
                  </TableCell>
                </TableRow>
              ))}
              {!filas.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Sin ventas en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
