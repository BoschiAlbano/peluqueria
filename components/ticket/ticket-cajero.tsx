import type { SesionCerradaResumen } from "@/actions/caja";
import { addCenter, addExtremes, addLine, addSeparator, formatoMonto } from "@/lib/ticket-texto";

export function TicketCajero({ sesion }: { sesion: SesionCerradaResumen }) {
  const total = (sesion.sueldoBaseSesion ?? 0) + (sesion.bonoSesion ?? 0);
  const lineas: string[] = [];

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
  lineas.push(addSeparator());
  lineas.push(addExtremes("Cortes sesión", String(sesion.totalCortesSesion)));
  lineas.push(addExtremes("Ventas sesión", formatoMonto(sesion.totalVentasSesion)));
  lineas.push(addSeparator());
  lineas.push(addExtremes("Sueldo base", formatoMonto(sesion.sueldoBaseSesion ?? 0)));
  lineas.push(addExtremes("Bono", formatoMonto(sesion.bonoSesion ?? 0)));
  lineas.push(addLine());
  lineas.push(addExtremes("Total a cobrar", formatoMonto(total)));

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
