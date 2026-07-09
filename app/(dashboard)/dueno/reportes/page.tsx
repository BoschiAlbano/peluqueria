import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { obtenerFilasReporte, rangoDesdeParams } from "@/lib/reportes";
import { fechaComercialYMD } from "@/lib/rangos-fecha";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { DatePickerField } from "@/components/reportes/date-picker-field";

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
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    peluqueroId?: string;
    servicioId?: string;
  }>;
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
    prisma.usuario.findMany({
      where: { esPeluquero: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.servicio.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const totalVentas = filas.reduce((acc, f) => acc + f.precioCobrado, 0);
  const totalComisionPeluqueros = filas.reduce(
    (acc, f) => acc + f.comisionPeluquero,
    0,
  );
  const totalComisionDueno = filas.reduce((acc, f) => acc + f.comisionDueno, 0);

  const queryString = new URLSearchParams({
    desde: aInputDate(desde),
    hasta: params.hasta || aInputDate(hasta),
    ...(peluqueroId ? { peluqueroId } : {}),
    ...(servicioId ? { servicioId } : {}),
  }).toString();

  return (
    <PageHeader
      title="Reportes históricos"
      description="Ventas por rango de fechas, filtrables por peluquero y servicio."
    >
      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DatePickerField
              id="desde"
              name="desde"
              label="Desde"
              defaultValue={params.desde || aInputDate(desde)}
            />
            <DatePickerField
              id="hasta"
              name="hasta"
              label="Hasta"
              defaultValue={params.hasta || aInputDate(hasta)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="peluqueroId">Peluquero</Label>
              <Select
                name="peluqueroId"
                defaultValue={peluqueroId ?? ""}
                items={[
                  { value: "", label: "Todos" },
                  ...peluqueros.map((p) => ({ value: p.id, label: p.nombre })),
                ]}
              >
                <SelectTrigger id="peluqueroId" className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {peluqueros.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="servicioId">Servicio</Label>
              <Select
                name="servicioId"
                defaultValue={servicioId ?? ""}
                items={[
                  { value: "", label: "Todos" },
                  ...servicios.map((s) => ({ value: s.id, label: s.nombre })),
                ]}
              >
                <SelectTrigger id="servicioId" className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <div className="grid gap-4 sm:grid-cols-3">
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
            <CardTitle className="text-sm text-muted-foreground">
              Comisión peluqueros
            </CardTitle>
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
            <p className="text-2xl font-semibold">
              {formatoMoneda.format(totalComisionDueno)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
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
    </PageHeader>
  );
}
