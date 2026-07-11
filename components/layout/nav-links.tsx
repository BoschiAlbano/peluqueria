"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, Wallet, Settings, FileBarChart } from "lucide-react";
import {
  SidebarGroupLabel,
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
    seccion: "operativo",
  },
  {
    href: "/caja",
    label: "Caja Actual",
    icon: Wallet,
    soloDueno: false,
    soloCierreDia: false,
    seccion: "operativo",
  },
  {
    href: "/cierre-caja",
    label: "Cierre del día",
    icon: Wallet,
    soloDueno: false,
    soloCierreDia: true,
    seccion: "administracion",
  },
  {
    href: "/dueno/reportes",
    label: "Reportes",
    icon: FileBarChart,
    soloDueno: true,
    soloCierreDia: false,
    seccion: "administracion",
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    soloDueno: true,
    soloCierreDia: false,
    seccion: "administracion",
  },
] as const;

const ETIQUETA_SECCION: Record<string, string> = {
  operativo: "Operativo",
  administracion: "Administración",
};

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

  const visibles = ITEMS.filter((item) => !item.soloDueno || rol === "DUENO").filter(
    (item) => !item.soloCierreDia || puedeCerrarDia,
  );

  const secciones = [...new Set(visibles.map((item) => item.seccion))];

  return (
    <>
      {secciones.map((seccion) => (
        <div key={seccion}>
          <SidebarGroupLabel>{ETIQUETA_SECCION[seccion]}</SidebarGroupLabel>
          <SidebarMenu>
            {visibles
              .filter((item) => item.seccion === seccion)
              .map((item) => {
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
        </div>
      ))}
    </>
  );
}
