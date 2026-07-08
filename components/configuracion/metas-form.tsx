"use client";

import { useRef, useState, useTransition } from "react";
import {
  crearMeta,
  actualizarMeta,
  cambiarEstadoMeta,
  type MetaCajeroInfo,
} from "@/actions/configuracion";
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

function FilaMeta({ meta }: { meta: MetaCajeroInfo }) {
  const [umbralCortes, setUmbralCortes] = useState(String(meta.umbralCortes));
  const [montoBono, setMontoBono] = useState(String(meta.montoBono));
  const [isPending, startTransition] = useTransition();
  const guardadoRef = useRef({
    umbralCortes: String(meta.umbralCortes),
    montoBono: String(meta.montoBono),
  });

  function guardar() {
    if (
      umbralCortes === guardadoRef.current.umbralCortes &&
      montoBono === guardadoRef.current.montoBono
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await actualizarMeta(meta.id, Number(umbralCortes), Number(montoBono));
        guardadoRef.current = { umbralCortes, montoBono };
        toast.success("Escalón actualizado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  function toggleActivo() {
    startTransition(async () => {
      try {
        await cambiarEstadoMeta(meta.id, !meta.activo);
        toast.success(meta.activo ? "Escalón desactivado." : "Escalón reactivado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          value={umbralCortes}
          onChange={(e) => setUmbralCortes(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={guardar}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Input
          value={montoBono}
          onChange={(e) => setMontoBono(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={guardar}
          className="w-28"
        />
      </TableCell>
      <TableCell>
        <Badge variant={meta.activo ? "default" : "secondary"}>
          {meta.activo ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant={meta.activo ? "destructive" : "outline"}
          disabled={isPending}
          onClick={toggleActivo}
        >
          {meta.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function MetasForm({ metas }: { metas: MetaCajeroInfo[] }) {
  const [umbralCortes, setUmbralCortes] = useState("");
  const [montoBono, setMontoBono] = useState("");
  const [isPending, startTransition] = useTransition();

  function crear() {
    startTransition(async () => {
      try {
        await crearMeta(Number(umbralCortes), Number(montoBono));
        toast.success("Escalón creado.");
        setUmbralCortes("");
        setMontoBono("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el escalón.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cortes en el día</TableHead>
            <TableHead>Bono por sesión</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {metas.map((m) => (
            <FilaMeta key={m.id} meta={m} />
          ))}
          {!metas.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin escalones configurados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="space-y-2 border-t pt-4">
        <Label>Nuevo escalón</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Cortes (ej. 60)"
            value={umbralCortes}
            onChange={(e) => setUmbralCortes(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <Input
            placeholder="Bono (ej. 5000)"
            value={montoBono}
            onChange={(e) => setMontoBono(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
        <Button disabled={isPending || !umbralCortes || !montoBono} onClick={crear}>
          {isPending ? "Creando…" : "Agregar escalón"}
        </Button>
      </div>
    </div>
  );
}
