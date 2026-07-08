"use client";

import { useState, useTransition } from "react";
import { actualizarComision } from "@/actions/configuracion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function ComisionForm({
  porcentajePeluqueroActual,
  porcentajeDuenoActual,
}: {
  porcentajePeluqueroActual: number;
  porcentajeDuenoActual: number;
}) {
  const [peluquero, setPeluquero] = useState(String(porcentajePeluqueroActual));
  const [dueno, setDueno] = useState(String(porcentajeDuenoActual));
  const [isPending, startTransition] = useTransition();

  function guardar() {
    const porcentajePeluquero = Number(peluquero);
    const porcentajeDueno = Number(dueno);

    startTransition(async () => {
      try {
        await actualizarComision({ porcentajePeluquero, porcentajeDueno });
        toast.success("Comisión actualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comisión por servicio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>% Peluquero</Label>
            <Input
              value={peluquero}
              onChange={(e) => setPeluquero(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>% Dueño</Label>
            <Input
              value={dueno}
              onChange={(e) => setDueno(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Deben sumar 100%. Los cambios aplican solo a ventas nuevas — las ventas ya
          registradas conservan el % que tenían al momento de venderse.
        </p>
        <Button className="w-full" disabled={isPending} onClick={guardar}>
          {isPending ? "Guardando…" : "Guardar comisión"}
        </Button>
      </CardContent>
    </Card>
  );
}
