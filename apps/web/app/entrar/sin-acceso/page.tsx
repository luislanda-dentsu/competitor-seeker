import { PantallaAcceso } from "@/components/app/acceso/PantallaAcceso";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export const metadata = { title: "Sin acceso" };

/** Cuenta de Google válida pero sin invitación (o revocada). */
export default function SinAccesoPage(): React.ReactElement {
  return (
    <PantallaAcceso titulo="Tu cuenta no tiene acceso">
      <p className="text-sm text-fg-muted">
        Esa cuenta de Google no está en la lista de acceso. Pide a un admin que te invite desde Ajustes → Usuarios, o entra con otra cuenta.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/entrar" });
        }}
      >
        <Button className="w-full" type="submit" variant="outline">
          Entrar con otra cuenta
        </Button>
      </form>
    </PantallaAcceso>
  );
}
