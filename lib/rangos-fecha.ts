export type RangoFecha = "hoy" | "semana" | "mes";

// El negocio opera en Argentina (UTC-3, sin horario de verano). Si el
// servidor corre en otro huso horario (ej. Vercel en UTC), usar
// `setHours(0,0,0,0)` sobre un Date trunca la medianoche del SERVIDOR, no la
// de Buenos Aires — el "día comercial" queda corrido hasta 3 horas. Por eso
// acá se calcula todo explícitamente contra este huso horario fijo, sin
// depender de la config del proceso de Node.
const ZONA_HORARIA_NEGOCIO = "America/Argentina/Buenos_Aires";
const OFFSET_NEGOCIO = "-03:00";

// "YYYY-MM-DD" de la fecha, tal como se ve en el huso horario del negocio.
export function fechaComercialYMD(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

// Medianoche (00:00 en Buenos Aires) del día que contiene `fecha`, como
// instante absoluto — sirve para armar rangos `gte`/`lt` en queries de Prisma
// sin importar el huso horario del proceso que corre el código.
export function inicioDelDia(fecha: Date): Date {
  return new Date(`${fechaComercialYMD(fecha)}T00:00:00${OFFSET_NEGOCIO}`);
}

function diaDeSemanaComercial(fecha: Date): number {
  // 0 = domingo … 6 = sábado, calculado en el huso horario del negocio.
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA_NEGOCIO,
    weekday: "short",
  }).format(fecha);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nombre);
}

export function inicioDeRango(rango: RangoFecha): Date {
  const ahora = new Date();

  if (rango === "hoy") {
    return inicioDelDia(ahora);
  }

  if (rango === "semana") {
    const inicioHoy = inicioDelDia(ahora);
    const diasDesdeLunes = (diaDeSemanaComercial(ahora) + 6) % 7;
    const inicio = new Date(inicioHoy);
    // inicioHoy es un instante fijo a las 00:00 ART; restar días enteros con
    // los métodos UTC no lo corre de horario porque el offset ART es fijo.
    inicio.setUTCDate(inicio.getUTCDate() - diasDesdeLunes);
    return inicio;
  }

  const [anio, mes] = fechaComercialYMD(ahora).split("-");
  return new Date(`${anio}-${mes}-01T00:00:00${OFFSET_NEGOCIO}`);
}

export function inicioDeHoy(): Date {
  return inicioDelDia(new Date());
}
