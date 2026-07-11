import type { SesionCerradaResumen } from "@/actions/caja";
import {
  ETIQUETA_METODO_PAGO,
  addCenter,
  addExtremes,
  addLine,
  addSeparadorFuerte,
  addSeparator,
  formatoMonto,
} from "@/lib/ticket-texto";

export function TicketCajero({ sesion }: { sesion: SesionCerradaResumen }) {
  const total = (sesion.sueldoBaseSesion ?? 0) + (sesion.bonoSesion ?? 0);
  const lineas: string[] = [];

  lineas.push("");
  lineas.push(addSeparadorFuerte());
  lineas.push(addCenter("Liquidación de caja"));
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
  lineas.push(addSeparadorFuerte());
  lineas.push(addExtremes("Cortes (Bono)", String(sesion.totalCortesSesion)));
  lineas.push(addExtremes("Ventas sesión", formatoMonto(sesion.totalVentasSesion)));
  if (sesion.totalesPorMetodoPago.length) {
    lineas.push(addSeparator());
    lineas.push(addLine("Formas de pago"));
    for (const m of sesion.totalesPorMetodoPago) {
      lineas.push(
        addExtremes(
          `${ETIQUETA_METODO_PAGO[m.metodoPago] ?? m.metodoPago} (${m.cantidad})`,
          formatoMonto(m.total),
        ),
      );
    }
  }
  lineas.push(addSeparator());
  lineas.push(addExtremes("Sueldo base", formatoMonto(sesion.sueldoBaseSesion ?? 0)));
  lineas.push(addExtremes("Bono", formatoMonto(sesion.bonoSesion ?? 0)));
  lineas.push(addLine());
  lineas.push(addExtremes("Total a cobrar", formatoMonto(total)));
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
