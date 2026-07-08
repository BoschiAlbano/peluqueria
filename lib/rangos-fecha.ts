export type RangoFecha = "hoy" | "semana" | "mes";

export function inicioDeRango(rango: RangoFecha): Date {
  const ahora = new Date();

  if (rango === "hoy") {
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  if (rango === "semana") {
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    // Lunes como inicio de semana.
    const diaSemana = (inicio.getDay() + 6) % 7;
    inicio.setDate(inicio.getDate() - diaSemana);
    return inicio;
  }

  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export function inicioDeHoy(): Date {
  return inicioDeRango("hoy");
}
