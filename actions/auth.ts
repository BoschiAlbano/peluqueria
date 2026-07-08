"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { emailSinteticoParaUsername } from "@/lib/auth-username";

export async function login(username: string, password: string): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const email = emailSinteticoParaUsername(username);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: data.user.id },
  });

  if (!usuario || !usuario.activo || !usuario.rol) {
    await supabase.auth.signOut();
    return { error: "Este usuario no tiene acceso al sistema." };
  }

  redirect("/ventas");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
