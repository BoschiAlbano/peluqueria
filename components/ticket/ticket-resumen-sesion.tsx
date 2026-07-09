import type { ResumenSesionCajero } from "@/actions/caja";
import { addCenter, addExtremes, addLine, addSeparator, formatoMonto } from "@/lib/ticket-texto";

const ETIQUETA_METODO_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

export function TicketResumenSesion({ sesion }: { sesion: ResumenSesionCajero }) {
  const lineas: string[] = [];

  lineas.push(addCenter("Control de caja"));
  lineas.push(
    addCenter(sesion.cajeroNombre + (sesion.etiqueta ? ` - ${sesion.etiqueta}` : "")),
  );
  lineas.push(
    addCenter(
      `${new Date(sesion.horaApertura).toLocaleTimeString("es-AR")} a ${new Date(
        sesion.horaCierre,
      ).toLocaleTimeString("es-AR")}`,
    ),
  );
  lineas.push(addSeparator());

  lineas.push(addLine("Formas de pago"));
  if (sesion.totalesPorMetodoPago.length) {
    for (const m of sesion.totalesPorMetodoPago) {
      lineas.push(
        addExtremes(
          `${ETIQUETA_METODO_PAGO[m.metodoPago] ?? m.metodoPago} (${m.cantidad})`,
          formatoMonto(m.total),
        ),
      );
    }
  } else {
    lineas.push(addLine("Sin ventas."));
  }

  lineas.push(addSeparator());

  lineas.push(addLine("Servicios"));
  if (sesion.servicios.length) {
    for (const s of sesion.servicios) {
      lineas.push(addExtremes(`${s.servicioNombre} x${s.cantidad}`, formatoMonto(s.total)));
    }
  } else {
    lineas.push(addLine("Sin servicios."));
  }

  lineas.push(addSeparator());
  lineas.push(addExtremes("Total en caja", formatoMonto(sesion.totalVentasSesion)));
  lineas.push(addExtremes("Cortes (bono)", String(sesion.totalCortesSesion)));

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
