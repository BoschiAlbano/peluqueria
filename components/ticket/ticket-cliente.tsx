import type { CrearVentaResult } from "@/actions/ventas";
import { addCenter, addExtremes, addLine, addSeparator, formatoMonto } from "@/lib/ticket-texto";

const ETIQUETA_METODO_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

export function TicketCliente({ venta }: { venta: CrearVentaResult }) {
  const lineas: string[] = [];

  lineas.push(addCenter("El Maestro Peluquería"));
  lineas.push(addCenter(`Ticket #${venta.numeroTicket}`));
  lineas.push(addCenter(new Date(venta.fecha).toLocaleString("es-AR")));
  lineas.push(addSeparator());

  const porPeluquero = new Map<string, typeof venta.detalles>();
  for (const d of venta.detalles) {
    const grupo = porPeluquero.get(d.peluqueroNombre) ?? [];
    grupo.push(d);
    porPeluquero.set(d.peluqueroNombre, grupo);
  }

  for (const [peluqueroNombre, detalles] of porPeluquero) {
    lineas.push(addCenter(`(${peluqueroNombre})`));
    for (const d of detalles) {
      lineas.push(addExtremes(d.servicioNombre, formatoMonto(d.precioCobrado)));
    }
  }

  lineas.push(addSeparator());
  lineas.push(addExtremes("Total", formatoMonto(venta.total)));
  lineas.push(addLine());
  lineas.push(addLine(`Pago: ${ETIQUETA_METODO_PAGO[venta.metodoPago] ?? venta.metodoPago}`));
  if (venta.comprobanteTransferenciaUlt4) {
    lineas.push(addLine(`Comprobante: ****${venta.comprobanteTransferenciaUlt4}`));
  }
  lineas.push(addSeparator());
  lineas.push(addCenter("¡Gracias por su visita!"));

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
