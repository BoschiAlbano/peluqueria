"use client";

import { useRef, useState, useTransition } from "react";
import {
  crearServicio,
  actualizarServicio,
  cambiarEstadoServicio,
  type ServicioInfo,
} from "@/actions/configuracion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

function FilaServicio({ servicio }: { servicio: ServicioInfo }) {
  const [nombre, setNombre] = useState(servicio.nombre);
  const [precio, setPrecio] = useState(String(servicio.precio));
  const [cuentaParaBono, setCuentaParaBono] = useState(servicio.cuentaParaBono);
  const [isPending, startTransition] = useTransition();
  const guardadoRef = useRef({
    nombre: servicio.nombre,
    precio: String(servicio.precio),
    cuentaParaBono: servicio.cuentaParaBono,
  });

  function guardar(cuentaParaBonoNuevo = cuentaParaBono) {
    if (
      nombre === guardadoRef.current.nombre &&
      precio === guardadoRef.current.precio &&
      cuentaParaBonoNuevo === guardadoRef.current.cuentaParaBono
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await actualizarServicio(servicio.id, nombre, Number(precio), cuentaParaBonoNuevo);
        guardadoRef.current = { nombre, precio, cuentaParaBono: cuentaParaBonoNuevo };
        toast.success("Servicio actualizado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  function toggleCuentaParaBono() {
    const nuevo = !cuentaParaBono;
    setCuentaParaBono(nuevo);
    guardar(nuevo);
  }

  function toggleActivo() {
    startTransition(async () => {
      try {
        await cambiarEstadoServicio(servicio.id, !servicio.activo);
        toast.success(servicio.activo ? "Servicio desactivado." : "Servicio reactivado.");
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
          onBlur={() => guardar()}
          className="w-32"
        />
      </TableCell>
      <TableCell>
        <Input
          value={precio}
          onChange={(e) => setPrecio(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => guardar()}
          className="w-24"
        />
      </TableCell>
      <TableCell>
        <Checkbox checked={cuentaParaBono} onCheckedChange={toggleCuentaParaBono} />
      </TableCell>
      <TableCell>
        <Badge variant={servicio.activo ? "default" : "secondary"}>
          {servicio.activo ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant={servicio.activo ? "destructive" : "outline"}
          disabled={isPending}
          onClick={toggleActivo}
        >
          {servicio.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ServiciosForm({ servicios }: { servicios: ServicioInfo[] }) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [cuentaParaBono, setCuentaParaBono] = useState(false);
  const [isPending, startTransition] = useTransition();

  function crear() {
    startTransition(async () => {
      try {
        await crearServicio(nombre, Number(precio), cuentaParaBono);
        toast.success("Servicio creado.");
        setNombre("");
        setPrecio("");
        setCuentaParaBono(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el servicio.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Servicio</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Cuenta para bono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {servicios.map((s) => (
            <FilaServicio key={s.id} servicio={s} />
          ))}
          {!servicios.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin servicios creados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="space-y-2 border-t pt-4">
        <Label>Nuevo servicio</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Nombre (ej. Tintura)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Input
            placeholder="Precio"
            value={precio}
            onChange={(e) => setPrecio(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={cuentaParaBono}
            onCheckedChange={(v) => setCuentaParaBono(v === true)}
          />
          Cuenta para el bono del cajero
        </label>
        <Button disabled={isPending || !nombre || !precio} onClick={crear}>
          {isPending ? "Creando…" : "Agregar servicio"}
        </Button>
      </div>
    </div>
  );
}
