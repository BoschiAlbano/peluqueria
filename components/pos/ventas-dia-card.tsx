"use client";

import { useRef, useState } from "react";
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

const ETIQUETA_METODO_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function VentasDiaCard({ ventas }: { ventas: CrearVentaResult[] }) {
  const [seleccionada, setSeleccionada] = useState<CrearVentaResult | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimirTicket = useReactToPrint({ contentRef: ticketRef });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mis ventas de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.map((v) => (
                <TableRow key={v.ventaId}>
                  <TableCell>#{v.numeroTicket}</TableCell>
                  <TableCell>{new Date(v.fecha).toLocaleTimeString("es-AR")}</TableCell>
                  <TableCell>{ETIQUETA_METODO_PAGO[v.metodoPago] ?? v.metodoPago}</TableCell>
                  <TableCell className="text-right">{formatoMoneda.format(v.total)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSeleccionada(v)}
                    >
                      Reimprimir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!ventas.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Todavía no cargaste ventas hoy.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!seleccionada} onOpenChange={(open) => !open && setSeleccionada(null)}>
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
