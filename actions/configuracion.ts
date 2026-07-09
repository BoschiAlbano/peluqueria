"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireDueno } from "@/lib/auth";

export type ServicioInfo = {
  id: string;
  nombre: string;
  precio: number;
  cuentaParaBono: boolean;
  activo: boolean;
};

export async function listarServicios(): Promise<ServicioInfo[]> {
  await requireDueno();

  const servicios = await prisma.servicio.findMany({ orderBy: { nombre: "asc" } });

  return servicios.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    precio: Number(s.precio),
    cuentaParaBono: s.cuentaParaBono,
    activo: s.activo,
  }));
}

function validarServicio(nombre: string, precio: number) {
  if (!nombre.trim()) {
    throw new Error("Falta el nombre.");
  }
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error("El precio debe ser un número mayor a 0.");
  }
}

export async function crearServicio(nombre: string, precio: number, cuentaParaBono: boolean) {
  await requireDueno();
  validarServicio(nombre, precio);

  await prisma.servicio.create({
    data: { nombre: nombre.trim(), precio, cuentaParaBono, activo: true },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ventas");
}

export async function actualizarServicio(
  id: string,
  nombre: string,
  precio: number,
  cuentaParaBono: boolean,
) {
  await requireDueno();
  validarServicio(nombre, precio);

  await prisma.servicio.update({
    where: { id },
    data: { nombre: nombre.trim(), precio, cuentaParaBono },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ventas");
}

export async function cambiarEstadoServicio(id: string, activo: boolean) {
  await requireDueno();

  await prisma.servicio.update({ where: { id }, data: { activo } });

  revalidatePath("/configuracion");
  revalidatePath("/ventas");
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
