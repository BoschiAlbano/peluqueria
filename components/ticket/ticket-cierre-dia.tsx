import type { CierreDiaResumen, PeluqueroResumenDia } from "@/actions/caja";
import { TicketCajero } from "@/components/ticket/ticket-cajero";
import { TicketPeluquero } from "@/components/ticket/ticket-peluquero";
import {
  addCenter,
  addExtremes,
  addSeparadorFuerte,
  addSeparator,
  formatoMonto,
} from "@/lib/ticket-texto";

const preStyle = {
  fontFamily: "monospace",
  fontSize: "12px",
  lineHeight: "1.3",
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
} as const;

// Un mismo peluquero puede haber trabajado bajo más de un cajero el mismo
// día (turno mañana con un cajero, turno tarde con otro) — se agrupan en una
// sola liquidación en vez de repetirlo una vez por cada cajero.
function agruparPeluqueros(cierres: CierreDiaResumen[]): PeluqueroResumenDia[] {
  const peluqueroMap = new Map<string, PeluqueroResumenDia>();
  for (const p of cierres.flatMap((c) => c.peluqueros)) {
    const entry = peluqueroMap.get(p.peluqueroId) ?? {
      peluqueroId: p.peluqueroId,
      nombre: p.nombre,
      detalles: [],
      totalComision: 0,
    };
    entry.detalles.push(...p.detalles);
    entry.totalComision += p.totalComision;
    peluqueroMap.set(p.peluqueroId, entry);
  }
  return [...peluqueroMap.values()];
}

// Ticket de cierre de caja: 3 secciones — liquidación de cada caja, la
// comisión de cada peluquero (agrupada, no repetida por cajero), y al final
// lo que le corresponde al dueño en total (ya descontado lo pagado a los
// cajeros, no solo la comisión bruta).
export function TicketCierreDia({ cierres }: { cierres: CierreDiaResumen[] }) {
  const sesiones = cierres.flatMap((c) => c.sesiones);
  const peluqueros = agruparPeluqueros(cierres);
  const detalles = peluqueros.flatMap((p) => p.detalles);

  const totalServicios = detalles.length;
  const totalIngresoNeto = detalles.reduce((acc, d) => acc + d.precioCobrado, 0);
  const totalComisionPeluqueros = peluqueros.reduce((acc, p) => acc + p.totalComision, 0);
  const totalGananciaCajeros = sesiones.reduce(
    (acc, s) => acc + (s.sueldoBaseSesion ?? 0) + (s.bonoSesion ?? 0),
    0,
  );
  const gananciaDueno = cierres.reduce((acc, c) => acc + c.totalComisionDueno, 0);
  const gananciaNetaDueno = gananciaDueno - totalGananciaCajeros;

  return (
    <div className="space-y-2">
      <pre style={preStyle}>{[addCenter("Resumen del día"), addSeparator()].join("\n")}</pre>

      <pre style={preStyle}>
        {["", addCenter("Liquidación cajas"), addSeparator()].join("\n")}
      </pre>
      {sesiones.map((s) => (
        <TicketCajero key={s.id} sesion={s} />
      ))}

      <pre style={preStyle}>
        {["", addCenter("Liquidación peluqueros"), addSeparator()].join("\n")}
      </pre>
      {peluqueros.map((p) => (
        <TicketPeluquero key={p.peluqueroId} peluquero={p} />
      ))}

      <pre style={preStyle}>
        {[
          "",
          addSeparadorFuerte(),
          addCenter("Liquidación dueño"),
          addSeparadorFuerte(),
          addExtremes("Servicios:", String(totalServicios)),
          addExtremes("Ingresos:", formatoMonto(totalIngresoNeto)),
          addExtremes("Com. peluq.:", formatoMonto(totalComisionPeluqueros)),
          addExtremes("Gan. cajeros:", formatoMonto(totalGananciaCajeros)),
          addExtremes("Gan. dueño:", formatoMonto(gananciaDueno)),
          addSeparator(),
          addExtremes("Gan. neta:", formatoMonto(gananciaNetaDueno)),
          addSeparadorFuerte(),
        ].join("\n")}
      </pre>
    </div>
  );
}
