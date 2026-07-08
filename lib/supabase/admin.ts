import { createClient } from "@supabase/supabase-js";

// Cliente con la Service Role Key: puede crear/editar/borrar usuarios de Auth.
// Uso exclusivo en Server Actions que ya validaron que quien llama es DUEÑO.
// NUNCA importar desde un componente cliente ni exponer esta key al browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
