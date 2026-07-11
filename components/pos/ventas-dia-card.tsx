"use client";

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import type { CrearVentaResult } from "@/actions/ventas";
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
import { TicketCliente } from "@/components/ticket/ticket-cliente";

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function VentasDiaCard({
  ventas,
  titulo = "Servicios de esta sesión",
  mensajeVacio = "Todavía no cargaste ventas en esta sesión.",
}: {
  ventas: CrearVentaResult[];
  titulo?: string;
  mensajeVacio?: string;
}) {
  const [seleccionada, setSeleccionada] = useState<CrearVentaResult | null>(
    null,
  );
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimirTicket = useReactToPrint({ contentRef: ticketRef });

  const filas = ventas.flatMap((v) =>
    v.detalles.map((d, i) => ({
      key: `${v.ventaId}-${i}`,
      venta: v,
      ...d,
    })),
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Peluquero</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Com. peluquero</TableHead>
                <TableHead className="text-right">Com. dueño</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.key}>
                  <TableCell>#{f.venta.numeroTicket}</TableCell>
                  <TableCell>{f.peluqueroNombre}</TableCell>
                  <TableCell>{f.servicioNombre}</TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(f.precioCobrado)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(f.comisionPeluquero)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(f.comisionDueno)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Reimprimir ticket"
                      onClick={() => setSeleccionada(f.venta)}
                    >
                      <Printer />
                      <span className="sr-only">Reimprimir ticket</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filas.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Todavía no cargaste ventas en esta sesión.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!seleccionada}
        onOpenChange={(open) => !open && setSeleccionada(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reimprimir ticket</DialogTitle>
          </DialogHeader>

          {seleccionada && (
            <div ref={ticketRef}>
              <TicketCliente venta={seleccionada} copia />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSeleccionada(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTicket()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
