import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { obtenerCortesHoyEnVivo } from "@/actions/caja";
import { inicioDeRango, type RangoFecha } from "@/lib/rangos-fecha";
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
import { PageHeader } from "@/components/layout/page-header";

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

export default async function DuenoPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "DUENO") {
    redirect("/ventas");
  }

  const { rango: rangoParam } = await searchParams;
  const rango: RangoFecha =
    rangoParam === "semana" || rangoParam === "mes" ? rangoParam : "hoy";

  const inicio = inicioDeRango(rango);

  const [detallesRango, ventasRango, cortesHoy, escalones, configComision] = await Promise.all([
    prisma.ventaDetalle.findMany({
      where: { venta: { fecha: { gte: inicio } } },
      include: { servicio: true, peluquero: true },
    }),
    prisma.venta.findMany({
      where: { fecha: { gte: inicio } },
      select: { total: true },
    }),
    obtenerCortesHoyEnVivo(),
    prisma.metaCajero.findMany({ where: { activo: true }, orderBy: { umbralCortes: "asc" } }),
    prisma.configuracionComision.findFirst({ orderBy: { vigenteDesde: "desc" } }),
  ]);

  const porcentajeDueno = Number(configComision?.porcentajeDueno ?? 40);
  const porcentajePeluquero = Number(configComision?.porcentajePeluquero ?? 60);

  const totalVentas = ventasRango.reduce((acc, v) => acc + Number(v.total), 0);
  const cantidadVentas = ventasRango.length;
  const gananciaDueno = detallesRango.reduce((acc, d) => acc + Number(d.comisionDueno), 0);

  const rankingMap = new Map<
    string,
    { nombre: string; bono: number; servicios: number; plataGenerada: number; comision: number }
  >();
  for (const d of detallesRango) {
    const entry = rankingMap.get(d.peluqueroId) ?? {
      nombre: d.peluquero.nombre,
      bono: 0,
      servicios: 0,
      plataGenerada: 0,
      comision: 0,
    };
    entry.servicios += 1;
    if (d.servicio.cuentaParaBono) entry.bono += 1;
    entry.plataGenerada += Number(d.precioCobrado);
    entry.comision += Number(d.comisionPeluquero);
    rankingMap.set(d.peluqueroId, entry);
  }
  const ranking = [...rankingMap.values()].sort((a, b) => b.plataGenerada - a.plataGenerada);

  const escalonAlcanzado = [...escalones].reverse().find((e) => e.umbralCortes <= cortesHoy);
  const proximoEscalon = escalones.find((e) => e.umbralCortes > cortesHoy);

  return (
    <PageHeader
      title="Dashboard del dueño"
      description="Ventas, ranking de peluqueros y avance del bono del día."
    >
      <div className="flex gap-2">
        {RANGOS.map((r) => (
          <Link key={r.valor} href={`/dueno?rango=${r.valor}`}>
            <Button variant={rango === r.valor ? "default" : "outline"} size="sm">
              {r.etiqueta}
            </Button>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatoMoneda.format(totalVentas)}</p>
            <p className="text-xs text-muted-foreground">{cantidadVentas} ventas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Ganancia del dueño ({porcentajeDueno}%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatoMoneda.format(gananciaDueno)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Avance del bono — hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {cortesHoy}
              {proximoEscalon ? `/${proximoEscalon.umbralCortes}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {escalonAlcanzado
                ? `Bono alcanzado: ${formatoMoneda.format(Number(escalonAlcanzado.montoBono))} por sesión`
                : proximoEscalon
                  ? `Faltan ${proximoEscalon.umbralCortes - cortesHoy} servicios para el próximo bono`
                  : "Sin escalones de bono configurados"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de peluqueros</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peluquero</TableHead>
                <TableHead className="text-right">Bono</TableHead>
                <TableHead className="text-right">Servicios</TableHead>
                <TableHead className="text-right">Plata generada</TableHead>
                <TableHead className="text-right">Comisión ({porcentajePeluquero}%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => (
                <TableRow key={r.nombre}>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell className="text-right">{r.bono}</TableCell>
                  <TableCell className="text-right">{r.servicios}</TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(r.plataGenerada)}
                  </TableCell>
                  <TableCell className="text-right">{formatoMoneda.format(r.comision)}</TableCell>
                </TableRow>
              ))}
              {!ranking.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
