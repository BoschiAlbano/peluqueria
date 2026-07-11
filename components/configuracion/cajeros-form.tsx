"use client";

import { useRef, useState, useTransition } from "react";
import {
  crearCajero,
  actualizarCajero,
  cambiarPasswordCajero,
  cambiarEstadoCajero,
  designarCierreDia,
  quitarDesignacionCierreDia,
  type CajeroInfo,
} from "@/actions/usuarios";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function FilaCajero({ cajero }: { cajero: CajeroInfo }) {
  const [nombre, setNombre] = useState(cajero.nombre);
  const [username, setUsername] = useState(cajero.username ?? "");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const guardadoRef = useRef({ nombre: cajero.nombre, username: cajero.username ?? "" });

  function guardarDatos() {
    if (nombre === guardadoRef.current.nombre && username === guardadoRef.current.username) {
      return;
    }

    startTransition(async () => {
      try {
        await actualizarCajero({ id: cajero.id, nombre, username });
        guardadoRef.current = { nombre, username };
        toast.success("Datos actualizados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  function guardarPassword() {
    if (!nuevaPassword) return;
    startTransition(async () => {
      try {
        await cambiarPasswordCajero(cajero.id, nuevaPassword);
        toast.success("Contraseña actualizada.");
        setNuevaPassword("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  function toggleActivo() {
    startTransition(async () => {
      try {
        await cambiarEstadoCajero(cajero.id, !cajero.activo);
        toast.success(cajero.activo ? "Cajero desactivado." : "Cajero reactivado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  function toggleCierreDia() {
    startTransition(async () => {
      try {
        if (cajero.autorizadoCierreDia) {
          await quitarDesignacionCierreDia(cajero.id);
          toast.success("Ya no puede cerrar la caja del día.");
        } else {
          await designarCierreDia(cajero.id);
          toast.success(`${cajero.nombre} ahora puede cerrar la caja del día.`);
        }
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
          onBlur={guardarDatos}
          className="w-36"
        />
      </TableCell>
      <TableCell>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={guardarDatos}
          className="w-32"
        />
      </TableCell>
      <TableCell>
        <Badge variant={cajero.activo ? "default" : "secondary"}>
          {cajero.activo ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={cajero.autorizadoCierreDia ? "default" : "secondary"}>
            {cajero.autorizadoCierreDia ? "Autorizado" : "No autorizado"}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={toggleCierreDia}
          >
            {cajero.autorizadoCierreDia ? "Quitar" : "Designar"}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Input
            type="password"
            placeholder="Nueva contraseña"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            className="w-32"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || !nuevaPassword}
            onClick={guardarPassword}
          >
            Cambiar
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant={cajero.activo ? "destructive" : "outline"}
          disabled={isPending}
          onClick={toggleActivo}
        >
          {cajero.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function CajerosForm({ cajeros }: { cajeros: CajeroInfo[] }) {
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function crear() {
    startTransition(async () => {
      try {
        await crearCajero({ nombre, username, password });
        toast.success("Cajero creado.");
        setNombre("");
        setUsername("");
        setPassword("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el cajero.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cierre del día</TableHead>
            <TableHead>Contraseña</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cajeros.map((c) => (
            <FilaCajero key={c.id} cajero={c} />
          ))}
          {!cajeros.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin cajeros creados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="space-y-2 border-t pt-4">
        <Label>Nuevo cajero</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Input
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button
          disabled={isPending || !nombre || !username || !password}
          onClick={crear}
        >
          {isPending ? "Creando…" : "Crear cajero"}
        </Button>
      </div>
    </div>
  );
}
