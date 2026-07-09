"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// El Calendar (react-day-picker) no tiene forma nativa de asociarse a un
// <form> como el <input type="date"> que reemplaza — por eso mandamos su
// valor a través de un input oculto sincronizado, para no tener que
// convertir toda la página de Reportes de un GET form nativo a JS.
function aFechaLocal(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function aISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function DatePickerField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [fecha, setFecha] = useState<Date | undefined>(aFechaLocal(defaultValue));
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input type="hidden" name={name} value={fecha ? aISO(fecha) : ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="w-full justify-start gap-1.5 font-normal"
            />
          }
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {fecha ? fecha.toLocaleDateString("es-AR") : "Elegir fecha"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={fecha}
            onSelect={(dia) => {
              setFecha(dia);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
