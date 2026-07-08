import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { filasACsv, obtenerFilasReporte, rangoDesdeParams } from "@/lib/reportes";

export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "DUENO") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const { desde, hasta } = rangoDesdeParams(
    params.get("desde") ?? undefined,
    params.get("hasta") ?? undefined,
  );

  const filas = await obtenerFilasReporte({
    desde,
    hasta,
    peluqueroId: params.get("peluqueroId") ?? undefined,
    servicioId: params.get("servicioId") ?? undefined,
  });

  const csv = filasACsv(filas);
  const nombreArchivo = `reporte_${desde.toISOString().slice(0, 10)}_a_${hasta
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
