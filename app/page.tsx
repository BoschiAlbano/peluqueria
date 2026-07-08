import Logo from "@/components/SVG/logo";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col align-middle items-center justify-center py-32 px-16 ">
        <Logo className="fill-black h-100" />
        <h1 className="text-4xl font-bold text-black dark:text-white">
          pagina de inicio
        </h1>
        {/* Login */}
        <Button render={<Link href="/login" />}>Login</Button>
      </main>
    </div>
  );
}
