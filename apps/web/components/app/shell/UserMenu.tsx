"use client";

import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { salir } from "@/lib/acciones-sesion";

interface Sesion {
  email: string;
  rol: "admin" | "miembro";
  nombre: string | null;
  imagen: string | null;
}

const iniciales = (s: Sesion): string =>
  (s.nombre ?? s.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Avatar + «Salir». No aparece en modo local (CS_AUTH=off), donde no hay sesión de Google. */
export function UserMenu(): React.ReactElement | null {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/sesion", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Sesion>) : null))
      .then((s) => vivo && setSesion(s))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  if (!sesion || sesion.email === "local") return null;
  return (
    <Menu>
      <MenuTrigger render={<Button aria-label={`Cuenta de ${sesion.email}`} className="rounded-full p-0" size="icon-sm" variant="ghost" />}>
        <Avatar className="size-8">
          {sesion.imagen && <AvatarImage alt="" referrerPolicy="no-referrer" src={sesion.imagen} />}
          <AvatarFallback>{iniciales(sesion)}</AvatarFallback>
        </Avatar>
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuGroupLabel>
          <span className="block text-fg">{sesion.nombre ?? sesion.email}</span>
          <span className="block text-xs font-normal text-fg-muted">
            {sesion.email} · {sesion.rol}
          </span>
        </MenuGroupLabel>
        <MenuSeparator />
        <MenuItem onClick={() => void salir()}>
          <LogOut aria-hidden="true" />
          Salir
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
