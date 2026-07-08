import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Rol } from "@/generated/prisma/enums";

export type UsuarioActual = {
  id: string;
  nombre: string;
  rol: Rol;
};

// Devuelve el Usuario de Prisma vinculado a la sesión de Supabase Auth actual,
// o null si no hay sesión, o el usuario no existe/está inactivo en Prisma.
export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: user.id },
  });

  if (!usuario || !usuario.activo || !usuario.rol) return null;

  return { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
}

export async function requireUsuario(): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    throw new Error("No hay una sesión activa.");
  }
  return usuario;
}

export async function requireDueno(): Promise<UsuarioActual> {
  const usuario = await requireUsuario();
  if (usuario.rol !== "DUENO") {
    throw new Error("Esta acción es exclusiva del dueño.");
  }
  return usuario;
}
