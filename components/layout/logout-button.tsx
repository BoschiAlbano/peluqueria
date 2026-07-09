"use client";

import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/actions/auth";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

function confirmarLogout() {
  toast.warning("¿Estás seguro que querés cerrar sesión?", {
    action: {
      label: "Sí, salir",
      onClick: () => {
        logout();
      },
    },
    cancel: {
      label: "Cancelar",
      onClick: () => {},
    },
  });
}

export function LogoutButton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Salir" onClick={confirmarLogout}>
          <LogOut />
          <span>Salir</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
