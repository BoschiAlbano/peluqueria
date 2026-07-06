import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 💡 Prisma 7 usa esto para conectarse a la base de datos durante la migración local.
    // Usamos DIRECT_URL (puerto 5432) para saltarnos el bloqueo del pooler de Supabase.
    url: env("DIRECT_URL"),
  },
});
