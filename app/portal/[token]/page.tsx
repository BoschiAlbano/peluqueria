import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerFilasReporte } from "@/lib/reportes";
import { obtenerCortesHoyEnVivo } from "@/actions/caja";
import {
  inicioDeHoy,
  inicioDeRango,
  type RangoFecha,
} from "@/lib/rangos-fecha";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const RANGOS: { valor: RangoFecha; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
];

export default async function PortalPeluqueroPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ rango?: string }>;
}) {
  const { token } = await params;

  const peluquero = await prisma.usuario.findUnique({
    where: { tokenPortal: token },
  });
  if (!peluquero || !peluquero.esPeluquero || !peluquero.activo) {
    notFound();
  }

  const { rango: rangoParam } = await searchParams;
  const rango: RangoFecha =
    rangoParam === "semana" || rangoParam === "mes" ? rangoParam : "hoy";

  const desde = inicioDeRango(rango);

  const [filas, miAporteHoy, cortesHoy, escalones] = await Promise.all([
    obtenerFilasReporte({
      desde,
      hasta: new Date(),
      peluqueroId: peluquero.id,
    }),
    prisma.ventaDetalle.count({
      where: {
        peluqueroId: peluquero.id,
        servicio: { cuentaParaBono: true },
        venta: { fecha: { gte: inicioDeHoy() } },
      },
    }),
    obtenerCortesHoyEnVivo(),
    prisma.metaCajero.findMany({
      where: { activo: true },
      orderBy: { umbralCortes: "asc" },
    }),
  ]);

  const totalGanancia = filas.reduce((acc, f) => acc + f.comisionPeluquero, 0);
  const totalServicios = filas.length;
  const proximoEscalon = escalones.find((e) => e.umbralCortes > cortesHoy);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{peluquero.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            Tus ganancias y servicios.
          </p>
        </div>

        <div className="flex gap-2">
          {RANGOS.map((r) => (
            <Link key={r.valor} href={`/portal/${token}?rango=${r.valor}`}>
              <Button
                variant={rango === r.valor ? "default" : "outline"}
                size="sm"
              >
                {r.etiqueta}
              </Button>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Tu ganancia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatoMoneda.format(totalGanancia)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Avance del bono hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-semibold">{miAporteHoy}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">
                    {cortesHoy}
                    {proximoEscalon ? `/${proximoEscalon.umbralCortes}` : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Servicios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{totalServicios}</p>
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
                  <TableHead>Servicio</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Tu comisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell>{f.fecha.toLocaleDateString("es-AR")}</TableCell>
                    <TableCell>{f.servicioNombre}</TableCell>
                    <TableCell>{f.metodoPago}</TableCell>
                    <TableCell className="text-right">
                      {formatoMoneda.format(f.comisionPeluquero)}
                    </TableCell>
                  </TableRow>
                ))}
                {!filas.length && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Sin servicios en este rango.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
