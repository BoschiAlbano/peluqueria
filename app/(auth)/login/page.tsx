import Logo from "@/components/SVG/logo";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <Logo className="h-20 w-20 fill-foreground" />
      <Card className="w-full max-w-sm shadow-lg [--card-spacing:--spacing(6)]">
        <CardContent className="space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold">El Maestro Peluquería</h1>
            <p className="mt-1 text-sm text-muted-foreground">Iniciá sesión para continuar.</p>
          </div>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
