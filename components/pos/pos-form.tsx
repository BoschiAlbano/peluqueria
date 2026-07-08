"use client";

import { useRef, useState, useTransition } from "react";
import { useReactToPrint } from "react-to-print";
import { crearVenta, type CrearVentaResult } from "@/actions/ventas";
import { MetodoPago } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";

type Opcion = { id: string; nombre: string };
type ServicioOpcion = Opcion & { precio: number };

type LineaCarrito = {
  peluqueroId: string;
  peluqueroNombre: string;
  servicioId: string;
  servicioNombre: string;
  precio: number;
};

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  [MetodoPago.EFECTIVO]: "Efectivo",
  [MetodoPago.TARJETA]: "Tarjeta",
  [MetodoPago.TRANSFERENCIA]: "Transferencia",
};

export function PosForm({
  servicios,
  peluqueros,
}: {
  servicios: ServicioOpcion[];
  peluqueros: Opcion[];
}) {
  const [peluqueroId, setPeluqueroId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(
    MetodoPago.EFECTIVO,
  );
  const [comprobante4, setComprobante4] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [ticket, setTicket] = useState<CrearVentaResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimirTicket = useReactToPrint({ contentRef: ticketRef });

  const total = carrito.reduce((acc, l) => acc + l.precio, 0);
  const montoRecibidoNum = Number(montoRecibido) || 0;
  const vuelto = montoRecibidoNum - total;

  function agregarLinea() {
    const peluquero = peluqueros.find((p) => p.id === peluqueroId);
    const servicio = servicios.find((s) => s.id === servicioId);
    if (!peluquero || !servicio) {
      toast.error("Elegí peluquero y servicio antes de agregar.");
      return;
    }

    setCarrito((prev) => [
      ...prev,
      {
        peluqueroId: peluquero.id,
        peluqueroNombre: peluquero.nombre,
        servicioId: servicio.id,
        servicioNombre: servicio.nombre,
        precio: servicio.precio,
      },
    ]);
    setPeluqueroId("");
    setServicioId("");
  }

  function quitarLinea(index: number) {
    setCarrito((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmarVenta() {
    if (!carrito.length) {
      toast.error("Agregá al menos un servicio.");
      return;
    }

    startTransition(async () => {
      try {
        const resultado = await crearVenta({
          metodoPago,
          comprobanteTransferenciaUlt4:
            metodoPago === MetodoPago.TRANSFERENCIA ? comprobante4 : undefined,
          lineas: carrito.map((l) => ({
            peluqueroId: l.peluqueroId,
            servicioId: l.servicioId,
          })),
        });
        setTicket(resultado);
        setCarrito([]);
        setComprobante4("");
        setMontoRecibido("");
        toast.success(`Venta #${resultado.numeroTicket} registrada.`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al registrar la venta.",
        );
      }
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Nueva venta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Peluquero</Label>
              <Select
                value={peluqueroId}
                onValueChange={(v) => setPeluqueroId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Peluquero">
                    {(v: string | null) =>
                      peluqueros.find((p) => p.id === v)?.nombre ?? "Peluquero"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {peluqueros.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select
                value={servicioId}
                onValueChange={(v) => setServicioId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Servicio">
                    {(v: string | null) => {
                      const s = servicios.find((s) => s.id === v);
                      return s
                        ? `${s.nombre} — ${formatoMoneda.format(s.precio)}`
                        : "Servicio";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre} — {formatoMoneda.format(s.precio)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={agregarLinea}>
            Agregar al ticket
          </Button>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select
              value={metodoPago}
              onValueChange={(v) => setMetodoPago(v as MetodoPago)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: MetodoPago | null) => (v ? ETIQUETA_METODO_PAGO[v] : "")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MetodoPago.EFECTIVO}>Efectivo</SelectItem>
                <SelectItem value={MetodoPago.TARJETA}>Tarjeta</SelectItem>
                <SelectItem value={MetodoPago.TRANSFERENCIA}>
                  Transferencia
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {metodoPago === MetodoPago.EFECTIVO && (
            <div className="space-y-1.5">
              <Label>Paga con</Label>
              <Input
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder={total ? String(total) : "0"}
                inputMode="numeric"
              />
              {montoRecibido && (
                <p
                  className={
                    vuelto < 0
                      ? "text-sm text-destructive"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {vuelto < 0
                    ? `Falta ${formatoMoneda.format(-vuelto)}`
                    : `Vuelto: ${formatoMoneda.format(vuelto)}`}
                </p>
              )}
            </div>
          )}

          {metodoPago === MetodoPago.TRANSFERENCIA && (
            <div className="space-y-1.5">
              <Label>Últimos 4 dígitos del comprobante</Label>
              <Input
                value={comprobante4}
                onChange={(e) =>
                  setComprobante4(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                maxLength={4}
                placeholder="1234"
              />
            </div>
          )}

          <Button
            className="w-full"
            disabled={isPending || !carrito.length}
            onClick={confirmarVenta}
          >
            {isPending ? "Guardando…" : `Cobrar ${formatoMoneda.format(total)}`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ticket en curso</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Peluquero</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carrito.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>{l.servicioNombre}</TableCell>
                  <TableCell>{l.peluqueroNombre}</TableCell>
                  <TableCell className="text-right">
                    {formatoMoneda.format(l.precio)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => quitarLinea(i)}
                    >
                      Quitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!carrito.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin líneas todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!ticket} onOpenChange={(open) => !open && setTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Venta registrada</DialogTitle>
          </DialogHeader>
          {ticket && (
            <div ref={ticketRef}>
              <TicketCliente venta={ticket} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicket(null)}>
              Cerrar
            </Button>
            <Button onClick={() => imprimirTicket()}>Imprimir ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
