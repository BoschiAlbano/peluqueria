"use client";

// import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, Wallet, Settings, FileBarChart } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Rol } from "@/generated/prisma/enums";

const ITEMS = [
  {
    href: "/ventas",
    label: "Ventas",
    icon: Receipt,
    soloDueno: false,
    soloCierreDia: false,
  },
  {
    href: "/caja",
    label: "Caja Actual",
    icon: Wallet,
    soloDueno: false,
    soloCierreDia: false,
  },
  {
    href: "/cierre-caja",
    label: "Cierre del día",
    icon: Wallet,
    soloDueno: false,
    soloCierreDia: true,
  },
  {
    href: "/dueno/reportes",
    label: "Reportes",
    icon: FileBarChart,
    soloDueno: true,
    soloCierreDia: false,
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    soloDueno: true,
    soloCierreDia: false,
  },
] as const;

export function NavLinks({
  rol,
  autorizadoCierreDia,
}: {
  rol: Rol;
  autorizadoCierreDia: boolean;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const puedeCerrarDia = rol === "DUENO" || autorizadoCierreDia;

  return (
    <SidebarMenu>
      {ITEMS.filter((item) => !item.soloDueno || rol === "DUENO")
        .filter((item) => !item.soloCierreDia || puedeCerrarDia)
        .map((item) => {
          const activo = pathname === item.href;
          const Icono = item.icon;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={activo}
                tooltip={item.label}
                render={
                  <a
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
