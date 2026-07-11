"use client";

import { useRef, useState, useTransition } from "react";
import { useReactToPrint } from "react-to-print";
import { cerrarDia, reabrirDia, type CajeroPendiente, type CierreDiaResumen } from "@/actions/caja";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketCierreDia } from "@/components/ticket/ticket-cierre-dia";
import { toast } from "sonner";

export function CierreDiaCard({
  cajeros,
  cajeroIdConCajaAbierta,
  cierresDeHoy,
}: {
  cajeros: CajeroPendiente[];
  cajeroIdConCajaAbierta: string | null;
  cierresDeHoy: CierreDiaResumen[];
}) {
  const [isPending, startTransition] = useTransition();
  const [cierresDia, setCierresDia] = useState<CierreDiaResumen[] | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimirTickets = useReactToPrint({ contentRef: ticketRef });

  function handleCerrarDia() {
    toast.warning("¿Estás seguro que querés cerrar la caja del día?", {
      action: {
        label: "Sí, cerrar",
        onClick: confirmarCerrarDia,
      },
      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },
    });
  }

  function confirmarCerrarDia() {
    startTransition(async () => {
      try {
        const resultado = await cerrarDia();
        setCierresDia(resultado);
        toast.success("Día cerrado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cerrar el día.");
      }
    });
  }

  function handleReabrirDia() {
    toast.warning(
      "¿Reabrir la caja del día? Se van a poder abrir cajas de nuevo, y si se carga más actividad el bono puede recalcularse distinto al ya informado.",
      {
        action: {
          label: "Sí, reabrir",
          onClick: confirmarReabrirDia,
        },
        cancel: {
          label: "Cancelar",
          onClick: () => {},
        },
      },
    );
  }

  function confirmarReabrirDia() {
    startTransition(async () => {
      try {
        await reabrirDia();
        toast.success("Día reabierto.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo reabrir el día.");
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
          {cierresDeHoy.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ya se cerró la caja de hoy. Se puede volver a abrir mañana.
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setCierresDia(cierresDeHoy)}
              >
                Ver / reimprimir cierre de hoy
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={isPending}
                onClick={handleReabrirDia}
              >
                Reabrir caja del día
              </Button>
            </>
          ) : cajeros.length ? (
            <>
              <ul className="space-y-1 text-sm">
                {cajeros.map((c) => (
                  <li key={c.cajeroId} className="flex items-baseline justify-between">
                    <span>{c.cajeroNombre}</span>
                    <span className="text-muted-foreground">
                      {c.sesionesPendientes} sesión{c.sesionesPendientes === 1 ? "" : "es"},{" "}
                      {c.totalCortesPendientes} cortes
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                disabled={isPending || !!cajeroIdConCajaAbierta}
                onClick={handleCerrarDia}
              >
                {isPending ? "Cerrando…" : "Cerrar caja del día"}
              </Button>

              {cajeroIdConCajaAbierta && (
                <p className="text-xs text-muted-foreground">
                  Hay una caja abierta. Cerrala antes de liquidar el día.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay sesiones de caja pendientes de liquidar.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cierresDia} onOpenChange={(open) => !open && setCierresDia(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resumen del día</DialogTitle>
          </DialogHeader>

          {cierresDia && (
            <div ref={ticketRef}>
              <TicketCierreDia cierres={cierresDia} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCierresDia(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTickets()}>Imprimir tickets</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
