import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8">
        <div>
          <h1 className="text-xl font-semibold">El Maestro Peluquería</h1>
          <p className="mt-1 text-sm text-muted-foreground">Iniciá sesión para continuar.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
