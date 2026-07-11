"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Confirmación visual breve para formularios que guardan solo, al perder el
// foco (sin botón "Guardar" explícito) — el toast desaparece rápido y puede
// pasar desapercibido si se edita más de un campo seguido; este check da una
// señal junto al campo mismo. Cada vez que `trigger` cambia (incrementar un
// contador tras guardar con éxito) se muestra un instante y se apaga solo.
export function SavedCheck({ trigger }: { trigger: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <Check
      className={cn(
        "size-4 shrink-0 text-green-600 transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0",
      )}
      aria-hidden={!show}
    />
  );
}
