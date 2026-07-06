// import { PrismaPg } from "@prisma/adapter-pg";
// import { PrismaClient } from "@/generated/prisma/client";

// const globalForPrisma = globalThis as unknown as {
//   prisma: PrismaClient | undefined;
// };

// function createPrismaClient() {
//   const connectionString = process.env.DATABASE_URL;

//   if (!connectionString) {
//     throw new Error("DATABASE_URL no está definida en las variables de entorno.");
//   }

//   const adapter = new PrismaPg({ connectionString });

//   return new PrismaClient({ adapter });
// }

// export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// if (process.env.NODE_ENV !== "production") {
//   globalForPrisma.prisma = prisma;
// }

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg"; // 💡 IMPORTANTE: Debes importar 'pg' de forma nativa

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definida en las variables de entorno.",
    );
  }

  // 1. Instanciamos el Pool nativo de PostgreSQL usando pg
  const pool = new pg.Pool({
    connectionString,
    // 💡 Configuración de SSL recomendada para evitar bloqueos en Supabase
    ssl: { rejectUnauthorized: false },
  });

  // 2. Pasamos el pool nativo al adaptador oficial de Prisma 7
  const adapter = new PrismaPg(pool);

  // 3. Inicializamos el cliente inyectándole el driver configurado
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
