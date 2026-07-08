// Genera los íconos de la PWA (y el favicon) a partir de public/Logo.svg.
// El color original del logo (#FDE5F2, rosa muy claro) casi no se ve sobre
// fondo blanco — se reemplaza por un gris oscuro neutro (mismo que
// --foreground en app/globals.css) para que el ícono tenga buen contraste.
//
// Uso: pnpm exec tsx scripts/generar-iconos.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import sharp from "sharp";

const RAIZ = path.join(__dirname, "..");
const COLOR_ICONO = "#171717";

const svgOriginal = readFileSync(path.join(RAIZ, "public/Logo.svg"), "utf-8");
const svgColoreado = svgOriginal.replaceAll("#FDE5F2", COLOR_ICONO);
const svgBuffer = Buffer.from(svgColoreado);

async function generar(
  destino: string,
  size: number,
  { escala = 1, fondo = "#ffffff" }: { escala?: number; fondo?: string } = {},
) {
  const logoResized = await sharp(svgBuffer)
    .resize(Math.round(size * escala), Math.round(size * escala), { fit: "contain", background: fondo })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: fondo },
  })
    .composite([{ input: logoResized, gravity: "center" }])
    .png()
    .toFile(destino);

  console.log("Generado:", path.relative(RAIZ, destino));
}

async function main() {
  mkdirSync(path.join(RAIZ, "public/icons"), { recursive: true });

  // Favicon / ícono principal (convención de Next.js: app/icon.png)
  await generar(path.join(RAIZ, "app/icon.png"), 512);

  // Apple touch icon (convención de Next.js: app/apple-icon.png)
  await generar(path.join(RAIZ, "app/apple-icon.png"), 180);

  // Íconos del manifest (public/, referenciados por app/manifest.ts)
  await generar(path.join(RAIZ, "public/icons/icon-192.png"), 192);
  await generar(path.join(RAIZ, "public/icons/icon-512.png"), 512);

  // Maskable: el logo ocupa menos espacio (safe zone ~80%) para que Android
  // no lo recorte al aplicar la máscara circular/redondeada.
  await generar(path.join(RAIZ, "public/icons/icon-maskable-512.png"), 512, { escala: 0.7 });

  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
