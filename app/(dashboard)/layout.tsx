import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/layout/nav-links";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 border-r p-4 md:flex md:flex-col">
        <NavLinks rol={usuario.rol} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b p-4 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav rol={usuario.rol} />
            <span className="truncate">El Maestro Peluquería</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:inline">
              {usuario.nombre} ({usuario.rol === "DUENO" ? "Dueño" : "Cajero"})
            </span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
