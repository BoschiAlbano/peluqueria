import Link from "next/link";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PosForm } from "@/components/pos/pos-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default async function VentasPage() {
  const [servicios, peluqueros, sesionAbierta] = await Promise.all([
    prisma.servicio.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({
      where: { esPeluquero: true, activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.sesionCaja.findFirst({ where: { horaCierre: null } }),
  ]);

  return (
    <PageHeader title="Ventas" description="Cargá la venta, seleccioná peluquero y método de pago.">
      {sesionAbierta ? (
        <PosForm
          servicios={servicios.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            precio: Number(s.precio),
          }))}
          peluqueros={peluqueros.map((p) => ({ id: p.id, nombre: p.nombre }))}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No hay una caja abierta</p>
            <p className="text-sm text-muted-foreground">
              Abrí una sesión de caja para poder cargar ventas.
            </p>
          </div>
          <Button render={<Link href="/caja" />} nativeButton={false}>
            Ir a Caja
          </Button>
        </div>
      )}
    </PageHeader>
  );
}
