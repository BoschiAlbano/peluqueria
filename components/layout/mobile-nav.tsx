"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavLinks } from "@/components/layout/nav-links";
import type { Rol } from "@/generated/prisma/enums";

export function MobileNav({ rol }: { rol: Rol }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu />
        <span className="sr-only">Abrir menú</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>El Maestro Peluquería</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <NavLinks rol={rol} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
