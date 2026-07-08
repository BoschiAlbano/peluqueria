import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarUsername, emailSinteticoParaUsername } from "@/lib/auth-username";

// Contraseña de desarrollo para los cajeros de prueba — no se usa en producción.
const PASSWORD_SEED = "prueba123456";

// Crea (si no existe ya) un cajero con una cuenta de Supabase Auth real y
// vinculada, para que se pueda loguear de verdad con el flujo actual
// (login por username, ver lib/auth-username.ts). Antes el seed solo creaba
// la fila en Prisma sin username/authUserId, así que estos usuarios de
// prueba nunca podían loguearse.
async function crearCajeroDePrueba(nombre: string, usernameCrudo: string) {
  const username = normalizarUsername(usernameCrudo);

  const existente = await prisma.usuario.findUnique({ where: { username } });
  if (existente) return;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: emailSinteticoParaUsername(username),
    password: PASSWORD_SEED,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.warn(`No se pudo crear el login de ${nombre}: ${error?.message ?? "error desconocido"}`);
    return;
  }

  await prisma.usuario.create({
    data: {
      authUserId: data.user.id,
      username,
      nombre,
      rol: "CAJERO",
      esPeluquero: false,
      activo: true,
    },
  });
}

async function main() {
  await prisma.servicio.createMany({
    data: [
      { nombre: "Corte", precio: 8000, cuentaParaBono: true },
      { nombre: "Barba", precio: 4000, cuentaParaBono: false },
      { nombre: "Afeitado", precio: 5000, cuentaParaBono: false },
    ],
    skipDuplicates: true,
  });

  await prisma.configuracionComision.create({
    data: { porcentajePeluquero: 60, porcentajeDueno: 40 },
  });

  await prisma.metaCajero.createMany({
    data: [
      { umbralCortes: 60, montoBono: 5000 },
      { umbralCortes: 100, montoBono: 10000 },
    ],
    skipDuplicates: true,
  });

  // El dueño NO se crea acá: su cuenta se aprovisiona una única vez a mano
  // (Service Role Key + vinculación manual, ver plan §2.1) para no terminar
  // con una segunda cuenta "Dueño" duplicada si el seed se corre de nuevo.
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

  await crearCajeroDePrueba("Juan (Cajero)", "juan");
  await crearCajeroDePrueba("Ana (Cajera)", "ana");

  console.log(`Seed completado. Cajeros de prueba: "juan" / "ana", contraseña "${PASSWORD_SEED}".`);
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
