"use client";

import { useRef, useState, useTransition } from "react";
import {
  crearPeluquero,
  actualizarPeluquero,
  cambiarEstadoPeluquero,
  type PeluqueroInfo,
} from "@/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function FilaPeluquero({ peluquero }: { peluquero: PeluqueroInfo }) {
  const [nombre, setNombre] = useState(peluquero.nombre);
  const [isPending, startTransition] = useTransition();
  const guardadoRef = useRef(peluquero.nombre);

  function guardarNombre() {
    if (nombre === guardadoRef.current) return;

    startTransition(async () => {
      try {
        await actualizarPeluquero(peluquero.id, nombre);
        guardadoRef.current = nombre;
        toast.success("Nombre actualizado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  function toggleActivo() {
    startTransition(async () => {
      try {
        await cambiarEstadoPeluquero(peluquero.id, !peluquero.activo);
        toast.success(peluquero.activo ? "Peluquero desactivado." : "Peluquero reactivado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarNombre}
          className="w-40"
        />
      </TableCell>
      <TableCell>
        <Badge variant={peluquero.activo ? "default" : "secondary"}>
          {peluquero.activo ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant={peluquero.activo ? "destructive" : "outline"}
          disabled={isPending}
          onClick={toggleActivo}
        >
          {peluquero.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function PeluquerosForm({ peluqueros }: { peluqueros: PeluqueroInfo[] }) {
  const [nombre, setNombre] = useState("");
  const [isPending, startTransition] = useTransition();

  function crear() {
    startTransition(async () => {
      try {
        await crearPeluquero(nombre);
        toast.success("Peluquero creado.");
        setNombre("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el peluquero.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {peluqueros.map((p) => (
            <FilaPeluquero key={p.id} peluquero={p} />
          ))}
          {!peluqueros.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin peluqueros creados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex gap-2 border-t pt-4">
        <Input
          placeholder="Nombre del peluquero"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button disabled={isPending || !nombre} onClick={crear}>
          {isPending ? "Creando…" : "Agregar"}
        </Button>
      </div>
    </div>
  );
}
