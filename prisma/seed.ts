import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarUsername, emailSinteticoParaUsername } from "@/lib/auth-username";

// Crea la cuenta del dueño con login real (username, ver lib/auth-username.ts).
// El login es siempre por username -> email sintético interno, así que el
// email real no se usa para nada operativo (Supabase Auth lo pide igual,
// por eso se genera uno sintético a partir del username, no se guarda el
// real en ningún lado hoy).
async function crearDueno(nombre: string, usernameCrudo: string, password: string) {
  const username = normalizarUsername(usernameCrudo);

  const existente = await prisma.usuario.findUnique({ where: { username } });
  if (existente) return;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: emailSinteticoParaUsername(username),
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.warn(`✗ No se pudo crear el login del dueño: ${error?.message ?? "error desconocido"}`);
    return;
  }

  await prisma.usuario.create({
    data: {
      authUserId: data.user.id,
      username,
      nombre,
      rol: "DUENO",
      esPeluquero: false,
      activo: true,
    },
  });

  console.log(`✓ Dueño creado: usuario "${username}", contraseña "${password}".`);
}

async function main() {
  console.log("Sembrando servicios (Corte, Barba)...");
  await prisma.servicio.createMany({
    data: [
      { nombre: "Corte", precio: 8000, cuentaParaBono: true },
      { nombre: "Barba", precio: 4000, cuentaParaBono: false },
    ],
    skipDuplicates: true,
  });
  console.log("✓ Servicios creados.");

  console.log("Sembrando configuración de comisión (60% peluquero / 40% dueño)...");
  await prisma.configuracionComision.create({
    data: { porcentajePeluquero: 60, porcentajeDueno: 40 },
  });
  console.log("✓ Comisión configurada.");

  console.log("Sembrando escalones de bono (63 cortes = $5000, 100 cortes = $10000)...");
  await prisma.metaCajero.createMany({
    data: [
      { umbralCortes: 63, montoBono: 5000 },
      { umbralCortes: 100, montoBono: 10000 },
    ],
    skipDuplicates: true,
  });
  console.log("✓ Escalones de bono creados.");

  console.log("Sembrando peluqueros 1 a 6...");
  await prisma.usuario.createMany({
    data: [
      { nombre: "Peluquero 1", esPeluquero: true },
      { nombre: "Peluquero 2", esPeluquero: true },
      { nombre: "Peluquero 3", esPeluquero: true },
      { nombre: "Peluquero 4", esPeluquero: true },
      { nombre: "Peluquero 5", esPeluquero: true },
      { nombre: "Peluquero 6", esPeluquero: true },
    ],
    skipDuplicates: true,
  });
  console.log("✓ Peluqueros creados.");

  // Sin cajeros de prueba — el dueño los crea desde Configuración cuando los
  // necesite. Sin cajas ni ventas — arranca en cero.
  console.log("Sembrando cuenta del dueño...");
  await crearDueno("El Maestro", "El Maestro", "123456");

  console.log("Seed completado.");
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
