// Antes de un `prisma migrate reset` (que solo borra las tablas que maneja
// Prisma) hay que borrar a mano las cuentas de Supabase Auth asociadas, que
// viven en un esquema aparte y quedarían huérfanas — sin esto, "El Maestro"
// / "Ana" / etc. seguirían existiendo como usuarios de Auth aunque su fila
// en la tabla Usuario ya no exista. Se ejecuta como parte de `pnpm db:reset`
// (ver package.json), siempre ANTES del reset, mientras todavía podemos leer
// el authUserId de cada fila.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const usuarios = await prisma.usuario.findMany({
    where: { authUserId: { not: null } },
  });

  if (!usuarios.length) {
    console.log("No hay cuentas de Supabase Auth para borrar.");
    return;
  }

  const admin = createAdminClient();

  for (const u of usuarios) {
    const { error } = await admin.auth.admin.deleteUser(u.authUserId!);
    if (error) {
      console.warn(`No se pudo borrar de Auth a "${u.nombre}": ${error.message}`);
    } else {
      console.log(`Borrado de Supabase Auth: ${u.nombre} (${u.username ?? "sin username"})`);
    }
  }
}

main().finally(() => prisma.$disconnect());
