"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, Wallet, Settings, LayoutDashboard, FileBarChart } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Rol } from "@/generated/prisma/enums";

const ITEMS = [
  { href: "/ventas", label: "Ventas", icon: Receipt, soloDueno: false },
  { href: "/caja", label: "Caja", icon: Wallet, soloDueno: false },
  { href: "/dueno/reportes", label: "Reportes", icon: FileBarChart, soloDueno: true },
  { href: "/dueno", label: "Dueño", icon: LayoutDashboard, soloDueno: true },
  { href: "/configuracion", label: "Configuración", icon: Settings, soloDueno: true },
] as const;

export function NavLinks({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {ITEMS.filter((item) => !item.soloDueno || rol === "DUENO").map((item) => {
        const activo = pathname === item.href;
        const Icono = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={activo}
              tooltip={item.label}
              render={
                <Link
                  href={item.href}
                  onClick={() => isMobile && setOpenMobile(false)}
                />
              }
            >
              <Icono />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
