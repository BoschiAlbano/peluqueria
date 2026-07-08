// Login por nombre de usuario, no por email. Supabase Auth solo soporta
// login por email/teléfono, así que generamos un email "sintético" interno
// a partir del username — nunca se muestra ni se usa para enviar nada.
const DOMINIO_SINTETICO = "peluqueria.internal";

export function normalizarUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sacar acentos (á -> a, etc.)
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}

export function emailSinteticoParaUsername(username: string): string {
  return `${normalizarUsername(username)}@${DOMINIO_SINTETICO}`;
}
