"use client";

import { useRef, useState, useTransition } from "react";
import { useReactToPrint } from "react-to-print";
import { cerrarDia, type CierreDiaResumen } from "@/actions/caja";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketCajero } from "@/components/ticket/ticket-cajero";
import { TicketPeluquero } from "@/components/ticket/ticket-peluquero";
import { addExtremes, addSeparator, formatoMonto } from "@/lib/ticket-texto";
import { toast } from "sonner";

export function CierreDiaCard({
  sesionesPendientes,
  totalCortesPendientes,
  hayCajaAbierta,
}: {
  sesionesPendientes: number;
  totalCortesPendientes: number;
  hayCajaAbierta: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [cierreDia, setCierreDia] = useState<CierreDiaResumen | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimirTickets = useReactToPrint({ contentRef: ticketRef });

  function handleCerrarDia() {
    startTransition(async () => {
      try {
        const resultado = await cerrarDia();
        setCierreDia(resultado);
        toast.success("Día cerrado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cerrar el día.");
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Cierre del día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Sesiones cerradas pendientes de liquidar: {sesionesPendientes}</p>
            <p>Cortes acumulados hoy: {totalCortesPendientes}</p>
          </div>

          <Button
            className="w-full"
            disabled={isPending || hayCajaAbierta || sesionesPendientes === 0}
            onClick={handleCerrarDia}
          >
            {isPending ? "Cerrando…" : "Cerrar caja del día"}
          </Button>

          {hayCajaAbierta && (
            <p className="text-xs text-muted-foreground">
              Hay una caja abierta. Cerrala antes de liquidar el día.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cierreDia} onOpenChange={(open) => !open && setCierreDia(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resumen del día</DialogTitle>
          </DialogHeader>

          {cierreDia && (
            <div ref={ticketRef}>
              <pre
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: "1.3",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {[
                  addExtremes("Cortes totales:", String(cierreDia.totalCortesDia)),
                  addExtremes(
                    "Bono/sesión:",
                    cierreDia.bonoAlcanzado
                      ? formatoMonto(cierreDia.montoBonoPorCaja ?? 0)
                      : "no alcanzado",
                  ),
                  addSeparator(),
                ].join("\n")}
              </pre>

              <div>
                {cierreDia.sesiones.map((s) => (
                  <div key={s.id} className="ticket-block">
                    <TicketCajero sesion={s} />
                  </div>
                ))}
                {cierreDia.peluqueros.map((p) => (
                  <div key={p.peluqueroId} className="ticket-block">
                    <TicketPeluquero peluquero={p} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCierreDia(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTickets()}>Imprimir tickets</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
