import type { PeluqueroResumenDia } from "@/actions/caja";
import {
  addCenter,
  addExtremes,
  addSeparadorFuerte,
  addSeparator,
  formatoMonto,
} from "@/lib/ticket-texto";

export function TicketPeluquero({ peluquero }: { peluquero: PeluqueroResumenDia }) {
  const lineas: string[] = [];

  lineas.push("");
  lineas.push(addSeparadorFuerte());
  lineas.push(addCenter("Comisión del día"));
  lineas.push(addCenter(peluquero.nombre));
  lineas.push(addSeparadorFuerte());

  const porServicio = new Map<string, { cantidad: number; total: number }>();
  for (const d of peluquero.detalles) {
    const entry = porServicio.get(d.servicioNombre) ?? { cantidad: 0, total: 0 };
    entry.cantidad += 1;
    entry.total += d.comisionPeluquero;
    porServicio.set(d.servicioNombre, entry);
  }

  for (const [servicioNombre, { cantidad, total }] of porServicio) {
    lineas.push(addExtremes(`${servicioNombre} x${cantidad}`, formatoMonto(total)));
  }

  lineas.push(addSeparator());
  lineas.push(addExtremes("Total comisión", formatoMonto(peluquero.totalComision)));
  lineas.push(addSeparadorFuerte());

  return (
    <pre
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "1.3",
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {lineas.join("\n")}
    </pre>
  );
}
