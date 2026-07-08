"use client";

import { useState, useTransition } from "react";
import { actualizarPrecioServicio } from "@/actions/configuracion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Servicio = { id: string; nombre: string; precio: number };

function FilaServicio({ servicio }: { servicio: Servicio }) {
  const [precio, setPrecio] = useState(String(servicio.precio));
  const [isPending, startTransition] = useTransition();

  function guardar() {
    const valor = Number(precio);
    startTransition(async () => {
      try {
        await actualizarPrecioServicio(servicio.id, valor);
        toast.success(`Precio de ${servicio.nombre} actualizado.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <TableRow>
      <TableCell>{servicio.nombre}</TableCell>
      <TableCell>
        <Input
          value={precio}
          onChange={(e) => setPrecio(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-28"
        />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={guardar}
        >
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function PreciosForm({ servicios }: { servicios: Servicio[] }) {
  return (
    <div className="space-y-2">
      <Label>Precios de servicios</Label>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Servicio</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {servicios.map((s) => (
            <FilaServicio key={s.id} servicio={s} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
