import { Suspense } from "react";
import { PantallaAcceso } from "@/components/app/acceso/PantallaAcceso";
import { Button } from "@/components/ui/button";
import { destinoSeguro } from "@/lib/acceso";
import { signIn } from "@/lib/auth";

export const metadata = { title: "Entrar" };

async function Formulario({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }): Promise<React.ReactElement> {
  const { desde } = await searchParams;
  const destino = destinoSeguro(typeof desde === "string" ? desde : null);
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: destino });
      }}
    >
      <Button className="w-full" size="lg" type="submit">
        Entrar con Google
      </Button>
    </form>
  );
}

/** Entrada: solo cuentas de Google invitadas por un admin (Ajustes → Usuarios). */
export default function EntrarPage({ searchParams }: PageProps<"/entrar">): React.ReactElement {
  return (
    <PantallaAcceso titulo="Inteligencia competitiva">
      <p className="text-sm text-fg-muted">Entra con la cuenta de Google que te invitaron. Solo se usan tu nombre, foto y correo.</p>
      <Suspense fallback={null}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </PantallaAcceso>
  );
}
