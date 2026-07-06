import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const start = performance.now();

    const [userCount, servicioCount, ventaCount] = await Promise.all([
      prisma.usuario.count(),
      prisma.servicio.count(),
      prisma.venta.count(),
    ]);

    const elapsed = Math.round(performance.now() - start);

    return NextResponse.json({
      status: "ok",
      elapsed: `${elapsed}ms`,
      counts: {
        usuarios: userCount,
        servicios: servicioCount,
        ventas: ventaCount,
      },
    });
  } catch (error) {
    console.error("Error de conexión Prisma:", error);

    let message = "Error desconocido";
    if (error instanceof Error) {
      message = error.message;
    }

    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
