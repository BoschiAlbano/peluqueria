import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PosForm } from "@/components/pos/pos-form";
import { PageHeader } from "@/components/layout/page-header";

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
        <p className="text-sm text-muted-foreground">
          No hay una caja abierta. Abrila desde{" "}
          <Link href="/caja" className="underline">
            Caja
          </Link>{" "}
          para poder cargar ventas.
        </p>
      )}
    </PageHeader>
  );
}
