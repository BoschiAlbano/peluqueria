"use client";

import { useRef, useState, useTransition } from "react";
import { useReactToPrint } from "react-to-print";
import { abrirSesion, cerrarSesion, type ResumenSesionCajero } from "@/actions/caja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketResumenSesion } from "@/components/ticket/ticket-resumen-sesion";
import { toast } from "sonner";

type SesionAbierta = {
  id: string;
  cajeroNombre: string;
  horaApertura: Date;
  ventasRegistradas: number;
  cortesRegistrados: number;
};

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function SesionCajaCard({
  sesion,
  totalVentasSesion,
}: {
  sesion: SesionAbierta | null;
  totalVentasSesion: number;
}) {
  const [etiqueta, setEtiqueta] = useState("");
  const [isPending, startTransition] = useTransition();
  const [resumen, setResumen] = useState<ResumenSesionCajero | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimirTicket = useReactToPrint({ contentRef: ticketRef });

  function handleAbrir() {
    startTransition(async () => {
      try {
        await abrirSesion(etiqueta.trim() || undefined);
        toast.success("Caja abierta.");
        setEtiqueta("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo abrir la caja.");
      }
    });
  }

  function handleCerrar() {
    if (!sesion) return;

    toast.warning("¿Estás seguro que querés cerrar la caja?", {
      action: {
        label: "Sí, cerrar",
        onClick: () => confirmarCerrar(sesion.id),
      },
      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },
    });
  }

  function confirmarCerrar(sesionId: string) {
    startTransition(async () => {
      try {
        const resultado = await cerrarSesion(sesionId);
        setResumen(resultado);
        toast.success("Caja cerrada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cerrar la caja.");
      }
    });
  }

  return (
    <>
      {!sesion ? (
        <Card>
          <CardHeader>
            <CardTitle>Caja cerrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Abrí una sesión de caja para empezar a cargar ventas.
            </p>

            <div className="space-y-1.5">
              <Label>Etiqueta (opcional)</Label>
              <Input
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
                placeholder="Ej: Mañana"
              />
            </div>

            <Button className="w-full" disabled={isPending} onClick={handleAbrir}>
              {isPending ? "Abriendo…" : "Abrir caja"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Caja abierta — {sesion.cajeroNombre}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Desde: {sesion.horaApertura.toLocaleString("es-AR")}</p>
              <p>
                Ventas en esta sesión: {sesion.ventasRegistradas} (
                {formatoMoneda.format(totalVentasSesion)})
              </p>
              <p>Cortes en esta sesión: {sesion.cortesRegistrados}</p>
            </div>

            <Button
              className="w-full"
              variant="destructive"
              disabled={isPending}
              onClick={handleCerrar}
            >
              {isPending ? "Cerrando…" : "Cerrar caja"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!resumen} onOpenChange={(open) => !open && setResumen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Control de caja</DialogTitle>
          </DialogHeader>

          {resumen && (
            <div ref={ticketRef}>
              <TicketResumenSesion sesion={resumen} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResumen(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTicket()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
