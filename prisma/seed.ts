import "dotenv/config";
import { prisma } from "@/lib/prisma";

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

  await prisma.usuario.createMany({
    data: [
      { nombre: "Juan (Cajero)", rol: "CAJERO", esPeluquero: false },
      { nombre: "Ana (Cajera)", rol: "CAJERO", esPeluquero: false },
      { nombre: "Dueño", rol: "DUENO", esPeluquero: false },
      { nombre: "Peluquero 1", esPeluquero: true },
      { nombre: "Peluquero 2", esPeluquero: true },
      { nombre: "Peluquero 3", esPeluquero: true },
      { nombre: "Peluquero 4", esPeluquero: true },
      { nombre: "Peluquero 5", esPeluquero: true },
      { nombre: "Peluquero 6", esPeluquero: true },
    ],
    skipDuplicates: true,
  });

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
