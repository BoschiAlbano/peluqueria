import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite correr una segunda instancia de `next dev` (ej. para pruebas)
  // sin pisar el lock de compilación de la instancia principal en .next/.
  // Uso: NEXT_DIST_DIR=.next-test pnpm exec next dev -p 3001
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // El estado de la caja (abierta/cerrada) y del bono cambian todo el
    // tiempo y son críticos para el POS — no queremos que el Router Cache
    // del cliente muestre una versión vieja al navegar entre páginas
    // (ver revalidatePath en actions/caja.ts, que no alcanza a invalidar
    // el caché del cliente de forma confiable en producción/Vercel).
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
