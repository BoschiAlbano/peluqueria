import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { NavLinks } from "@/components/layout/nav-links";
import { LogoutButton } from "@/components/layout/logout-button";
import Logo from "@/components/SVG/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sidebarAbierto = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarAbierto}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1">
            <Logo className="size-6 shrink-0 fill-sidebar-foreground" />
            <span className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              El Maestro
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <NavLinks rol={usuario.rol} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <LogoutButton />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="h-dvh overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b p-4 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <span className="truncate font-medium text-foreground">
              El Maestro Peluquería
            </span>
          </div>
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {usuario.nombre.trim().slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate text-muted-foreground">
              {usuario.nombre} ({usuario.rol === "DUENO" ? "Dueño" : "Cajero"})
            </span>
          </span>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6">
          <div className="mx-auto w-full flex flex-col items-center">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
