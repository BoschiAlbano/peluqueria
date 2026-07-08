"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireDueno } from "@/lib/auth";

export async function actualizarPrecioServicio(servicioId: string, precio: number) {
  await requireDueno();

  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error("El precio debe ser un número mayor a 0.");
  }

  await prisma.servicio.update({
    where: { id: servicioId },
    data: { precio },
  });

  revalidatePath("/configuracion");
}

export type ActualizarComisionInput = {
  porcentajePeluquero: number;
  porcentajeDueno: number;
};

export async function actualizarComision(input: ActualizarComisionInput) {
  await requireDueno();

  const { porcentajePeluquero, porcentajeDueno } = input;

  if (
    !Number.isFinite(porcentajePeluquero) ||
    !Number.isFinite(porcentajeDueno) ||
    porcentajePeluquero < 0 ||
    porcentajeDueno < 0
  ) {
    throw new Error("Los porcentajes deben ser números positivos.");
  }

  if (Math.round((porcentajePeluquero + porcentajeDueno) * 100) !== 10000) {
    throw new Error("Los porcentajes de peluquero y dueño deben sumar 100%.");
  }

  // Se guarda como una nueva fila (no se actualiza la vigente): las ventas ya
  // registradas mantienen el % que tenían al momento de venderse (plan §3.1).
  await prisma.configuracionComision.create({
    data: { porcentajePeluquero, porcentajeDueno },
  });

  revalidatePath("/configuracion");
}

export type MetaCajeroInfo = {
  id: string;
  umbralCortes: number;
  montoBono: number;
  activo: boolean;
};

export async function listarMetas(): Promise<MetaCajeroInfo[]> {
  await requireDueno();

  const metas = await prisma.metaCajero.findMany({ orderBy: { umbralCortes: "asc" } });

  return metas.map((m) => ({
    id: m.id,
    umbralCortes: m.umbralCortes,
    montoBono: Number(m.montoBono),
    activo: m.activo,
  }));
}

async function validarEscalon(umbralCortes: number, montoBono: number, idAExcluir?: string) {
  if (!Number.isInteger(umbralCortes) || umbralCortes <= 0) {
    throw new Error("El umbral de cortes debe ser un número entero mayor a 0.");
  }
  if (!Number.isFinite(montoBono) || montoBono <= 0) {
    throw new Error("El monto del bono debe ser un número mayor a 0.");
  }

  const existente = await prisma.metaCajero.findFirst({
    where: { umbralCortes, activo: true, ...(idAExcluir ? { id: { not: idAExcluir } } : {}) },
  });
  if (existente) {
    throw new Error("Ya existe un escalón activo con ese umbral de cortes.");
  }
}

export async function crearMeta(umbralCortes: number, montoBono: number) {
  await requireDueno();
  await validarEscalon(umbralCortes, montoBono);

  await prisma.metaCajero.create({ data: { umbralCortes, montoBono, activo: true } });

  revalidatePath("/configuracion");
}

export async function actualizarMeta(id: string, umbralCortes: number, montoBono: number) {
  await requireDueno();
  await validarEscalon(umbralCortes, montoBono, id);

  await prisma.metaCajero.update({ where: { id }, data: { umbralCortes, montoBono } });

  revalidatePath("/configuracion");
}

export async function cambiarEstadoMeta(id: string, activo: boolean) {
  await requireDueno();

  // Reactivar puede volver a chocar con el mismo umbral de otro escalón que
  // se haya creado mientras este estaba inactivo — hay que revalidar, no
  // solo al crear/editar.
  if (activo) {
    const meta = await prisma.metaCajero.findUniqueOrThrow({ where: { id } });
    await validarEscalon(meta.umbralCortes, Number(meta.montoBono), id);
  }

  await prisma.metaCajero.update({ where: { id }, data: { activo } });

  revalidatePath("/configuracion");
}
