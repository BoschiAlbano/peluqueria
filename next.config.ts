import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite correr una segunda instancia de `next dev` (ej. para pruebas)
  // sin pisar el lock de compilación de la instancia principal en .next/.
  // Uso: NEXT_DIST_DIR=.next-test pnpm exec next dev -p 3001
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
