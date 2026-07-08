"use client";

import Link from "next/link";
import type { Rol } from "@/generated/prisma/enums";

export function NavLinks({ rol, onNavigate }: { rol: Rol; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-2 text-sm">
      <Link href="/ventas" onClick={onNavigate}>
        Ventas
      </Link>
      <Link href="/caja" onClick={onNavigate}>
        Caja
      </Link>
      {rol === "DUENO" && (
        <>
          <Link href="/configuracion" onClick={onNavigate}>
            Configuración
          </Link>
          <Link href="/dueno" onClick={onNavigate}>
            Dueño
          </Link>
          <Link href="/dueno/reportes" onClick={onNavigate}>
            Reportes
          </Link>
        </>
      )}
    </nav>
  );
}
