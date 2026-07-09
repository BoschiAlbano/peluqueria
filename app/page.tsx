import Logo from "@/components/SVG/logo";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-16 text-center">
      <Logo className="h-32 w-32 fill-foreground sm:h-40 sm:w-40" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
          El Maestro Peluquería
        </h1>
        <p className="text-muted-foreground">
          Sistema de gestión de ventas, caja y comisiones.
        </p>
      </div>
      <Button render={<Link href="/login" />} nativeButton={false} size="lg">
        Ingresar
      </Button>
    </div>
  );
}
