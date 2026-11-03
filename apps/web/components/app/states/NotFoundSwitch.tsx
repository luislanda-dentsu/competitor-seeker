"use client";

import { Compass } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/app/states/EmptyState";
import { NotFoundCompetidor } from "@/components/app/states/NotFoundCompetidor";

export function NotFoundGenerico(): React.ReactElement {
  return (
    <EmptyState
      accion={{ href: "/", label: "Volver al resumen" }}
      descripcion="La ruta no existe en el panel."
      icon={Compass}
      titulo="Página no encontrada"
    />
  );
}

function NotFoundPorRuta(): React.ReactElement {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/competidores/")) return <NotFoundCompetidor />;
  return <NotFoundGenerico />;
}

/**
 * 404 global: elige el mensaje según la ruta (el proxy reescribe los slugs
 * de competidor desconocidos aquí). usePathname es dato de runtime → Suspense.
 */
export function NotFoundSwitch(): React.ReactElement {
  return (
    <Suspense fallback={<NotFoundGenerico />}>
      <NotFoundPorRuta />
    </Suspense>
  );
}
