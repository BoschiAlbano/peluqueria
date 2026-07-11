"use client";

import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import type { CierreDiaResumen } from "@/actions/caja";
import { Button } from "@/components/ui/button";
import { TicketCierreDia } from "@/components/ticket/ticket-cierre-dia";

export function DetalleCierreView({ cierre }: { cierre: CierreDiaResumen }) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const imprimir = useReactToPrint({ contentRef: ticketRef });

  return (
    <div className="w-full max-w-2xl space-y-4">
      <Button onClick={() => imprimir()}>Imprimir</Button>

      <div ref={ticketRef}>
        <TicketCierreDia cierres={[cierre]} />
      </div>
    </div>
  );
}
