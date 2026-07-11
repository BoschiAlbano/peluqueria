"use client";

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import type { TotalesDeHoy } from "@/actions/caja";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TicketCajero } from "@/components/ticket/ticket-cajero";
import { TicketPeluquero } from "@/components/ticket/ticket-peluquero";

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type PeluqueroTotales = TotalesDeHoy["peluqueros"][number];
type CajeroTotales = TotalesDeHoy["cajeros"][number];

export function TotalesHoyCard({ totales }: { totales: TotalesDeHoy }) {
  const [peluqueroSeleccionado, setPeluqueroSeleccionado] = useState<PeluqueroTotales | null>(
    null,
  );
  const [cajeroSeleccionado, setCajeroSeleccionado] = useState<CajeroTotales | null>(null);
  const ticketPeluqueroRef = useRef<HTMLDivElement>(null);
  const ticketCajeroRef = useRef<HTMLDivElement>(null);
  const imprimirTicketPeluquero = useReactToPrint({ contentRef: ticketPeluqueroRef });
  const imprimirTicketCajero = useReactToPrint({ contentRef: ticketCajeroRef });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totales de hoy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Comisión peluqueros</p>
            <p className="text-2xl font-semibold">
              {formatoMoneda.format(totales.totalComisionPeluqueros)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ganancia del dueño</p>
            <p className="text-2xl font-semibold">
              {formatoMoneda.format(totales.totalComisionDueno)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">
              {formatoMoneda.format(
                totales.totalComisionPeluqueros + totales.totalComisionDueno,
              )}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Peluqueros</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peluquero</TableHead>
                <TableHead className="text-right">Servicios</TableHead>
                <TableHead className="text-right">Plata generada</TableHead>
                <TableHead className="text-right">Com. peluquero</TableHead>
                <TableHead className="text-right">Com. dueño</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totales.peluqueros.map((p) => (
                <TableRow key={p.peluqueroId}>
                  <TableCell>{p.peluqueroNombre}</TableCell>
                  <TableCell className="text-right">{p.totalServicios}</TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(p.totalPlataGenerada)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(p.totalComisionPeluquero)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(p.totalComisionDueno)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Imprimir resumen del día"
                      onClick={() => setPeluqueroSeleccionado(p)}
                    >
                      <Printer />
                      <span className="sr-only">Imprimir resumen del día</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!totales.peluqueros.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Sin servicios hoy.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Cajeros (estimado en vivo, se confirma al cerrar el día de cada uno)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cajero</TableHead>
                <TableHead className="text-right">Cortes (Bono)</TableHead>
                <TableHead className="text-right">Sueldo base</TableHead>
                <TableHead className="text-right">Bono</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Liquidado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totales.cajeros.map((c) => (
                <TableRow key={c.cajeroId}>
                  <TableCell>{c.cajeroNombre}</TableCell>
                  <TableCell className="text-right">{c.cortes}</TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(c.sueldoEstimado)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(c.bonoEstimado)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(c.totalEstimado)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.liquidado ? "default" : "secondary"}>
                      {c.liquidado ? "Sí" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Imprimir resumen del día"
                      onClick={() => setCajeroSeleccionado(c)}
                    >
                      <Printer />
                      <span className="sr-only">Imprimir resumen del día</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!totales.cajeros.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Sin actividad de caja hoy.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={!!peluqueroSeleccionado}
        onOpenChange={(open) => !open && setPeluqueroSeleccionado(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comisión del día — {peluqueroSeleccionado?.peluqueroNombre}</DialogTitle>
          </DialogHeader>

          {peluqueroSeleccionado && (
            <div ref={ticketPeluqueroRef}>
              <TicketPeluquero
                peluquero={{
                  peluqueroId: peluqueroSeleccionado.peluqueroId,
                  nombre: peluqueroSeleccionado.peluqueroNombre,
                  detalles: peluqueroSeleccionado.detalles,
                  totalComision: peluqueroSeleccionado.totalComisionPeluquero,
                }}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPeluqueroSeleccionado(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTicketPeluquero()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cajeroSeleccionado}
        onOpenChange={(open) => !open && setCajeroSeleccionado(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resumen del día — {cajeroSeleccionado?.cajeroNombre}</DialogTitle>
          </DialogHeader>

          {cajeroSeleccionado &&
            (cajeroSeleccionado.sesionesDetalle.length ? (
              <div ref={ticketCajeroRef}>
                {cajeroSeleccionado.sesionesDetalle.map((s) => (
                  <TicketCajero key={s.id} sesion={s} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no tiene sesiones cerradas hoy para imprimir.
              </p>
            ))}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCajeroSeleccionado(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTicketCajero()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
