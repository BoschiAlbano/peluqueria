"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireDueno } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarUsername, emailSinteticoParaUsername } from "@/lib/auth-username";
import { revalidatePath } from "next/cache";

export type CajeroInfo = {
  id: string;
  nombre: string;
  username: string | null;
  activo: boolean;
  autorizadoCierreDia: boolean;
};

export async function listarCajeros(): Promise<CajeroInfo[]> {
  await requireDueno();

  const cajeros = await prisma.usuario.findMany({
    where: { rol: "CAJERO" },
    orderBy: { nombre: "asc" },
  });

  return cajeros.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    username: c.username,
    activo: c.activo,
    autorizadoCierreDia: c.autorizadoCierreDia,
  }));
}

// El dueño designa a UN cajero (además de sí mismo) habilitado para cerrar
// la caja del día. Nunca puede haber más de uno: designar a uno se lo quita
// automáticamente a cualquier otro que lo tuviera.
export async function designarCierreDia(cajeroId: string) {
  await requireDueno();

  await prisma.$transaction([
    prisma.usuario.updateMany({
      where: { autorizadoCierreDia: true },
      data: { autorizadoCierreDia: false },
    }),
    prisma.usuario.update({
      where: { id: cajeroId },
      data: { autorizadoCierreDia: true },
    }),
  ]);

  revalidatePath("/configuracion");
}

export async function quitarDesignacionCierreDia(cajeroId: string) {
  await requireDueno();

  await prisma.usuario.update({
    where: { id: cajeroId },
    data: { autorizadoCierreDia: false },
  });

  revalidatePath("/configuracion");
}

export type CrearCajeroInput = {
  nombre: string;
  username: string;
  password: string;
};

export async function crearCajero(input: CrearCajeroInput) {
  await requireDueno();

  if (!input.nombre.trim()) {
    throw new Error("Falta el nombre.");
  }

  const username = normalizarUsername(input.username);
  if (!username) {
    throw new Error("Falta el usuario.");
  }
  if (input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  const existente = await prisma.usuario.findUnique({ where: { username } });
  if (existente) {
    throw new Error("Ese nombre de usuario ya está en uso.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: emailSinteticoParaUsername(username),
    password: input.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "No se pudo crear el usuario de acceso.");
  }

  try {
    await prisma.usuario.create({
      data: {
        authUserId: data.user.id,
        username,
        nombre: input.nombre.trim(),
        rol: "CAJERO",
        esPeluquero: false,
        activo: true,
      },
    });
  } catch (e) {
    // Si falla la creación en Prisma, no dejamos un usuario de Auth huérfano.
    await admin.auth.admin.deleteUser(data.user.id);
    throw e;
  }

  revalidatePath("/configuracion");
}

export type ActualizarCajeroInput = {
  id: string;
  nombre: string;
  username: string;
};

export async function actualizarCajero(input: ActualizarCajeroInput) {
  await requireDueno();

  if (!input.nombre.trim()) {
    throw new Error("Falta el nombre.");
  }

  const username = normalizarUsername(input.username);
  if (!username) {
    throw new Error("Falta el usuario.");
  }

  const cajero = await prisma.usuario.findUniqueOrThrow({ where: { id: input.id } });

  if (username !== cajero.username) {
    const existente = await prisma.usuario.findUnique({ where: { username } });
    if (existente && existente.id !== input.id) {
      throw new Error("Ese nombre de usuario ya está en uso.");
    }

    if (!cajero.authUserId) {
      throw new Error("Este cajero no tiene una cuenta de acceso vinculada.");
    }

    // El login se resuelve a partir del username → hay que actualizar también
    // el email sintético en Supabase Auth, si no el login queda desincronizado.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(cajero.authUserId, {
      email: emailSinteticoParaUsername(username),
      email_confirm: true,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await prisma.usuario.update({
    where: { id: input.id },
    data: { nombre: input.nombre.trim(), username },
  });

  revalidatePath("/configuracion");
}

export async function cambiarPasswordCajero(cajeroId: string, password: string) {
  await requireDueno();

  if (password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  const cajero = await prisma.usuario.findUniqueOrThrow({ where: { id: cajeroId } });
  if (!cajero.authUserId) {
    throw new Error("Este cajero no tiene una cuenta de acceso vinculada.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(cajero.authUserId, { password });

  if (error) {
    throw new Error(error.message);
  }
}

export async function cambiarEstadoCajero(cajeroId: string, activo: boolean) {
  await requireDueno();

  await prisma.usuario.update({
    where: { id: cajeroId },
    data: { activo },
  });

  revalidatePath("/configuracion");
}

export type PeluqueroInfo = {
  id: string;
  nombre: string;
  activo: boolean;
  tokenPortal: string | null;
};

export async function listarPeluqueros(): Promise<PeluqueroInfo[]> {
  await requireDueno();

  const peluqueros = await prisma.usuario.findMany({
    where: { esPeluquero: true },
    orderBy: { nombre: "asc" },
  });

  return peluqueros.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    activo: p.activo,
    tokenPortal: p.tokenPortal,
  }));
}

export async function crearPeluquero(nombre: string) {
  await requireDueno();

  if (!nombre.trim()) {
    throw new Error("Falta el nombre.");
  }

  await prisma.usuario.create({
    data: { nombre: nombre.trim(), esPeluquero: true, activo: true },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ventas");
}

export async function actualizarPeluquero(id: string, nombre: string) {
  await requireDueno();

  if (!nombre.trim()) {
    throw new Error("Falta el nombre.");
  }

  await prisma.usuario.update({
    where: { id },
    data: { nombre: nombre.trim() },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ventas");
}

export async function cambiarEstadoPeluquero(id: string, activo: boolean) {
  await requireDueno();

  await prisma.usuario.update({
    where: { id },
    data: { activo },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ventas");
}

export async function generarTokenPortal(id: string): Promise<string> {
  await requireDueno();

  const token = randomBytes(24).toString("base64url");

  await prisma.usuario.update({
    where: { id },
    data: { tokenPortal: token },
  });

  revalidatePath("/configuracion");
  return token;
}

export async function eliminarTokenPortal(id: string) {
  await requireDueno();

  await prisma.usuario.update({
    where: { id },
    data: { tokenPortal: null },
  });

  revalidatePath("/configuracion");
}
