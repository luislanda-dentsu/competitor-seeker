"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Las pantallas de entrada (/entrar…) van sin barra lateral ni superior: aún no hay sesión. */
export function ShellSegunRuta({ conShell, sinShell }: { conShell: ReactNode; sinShell: ReactNode }): ReactNode {
  const pathname = usePathname() ?? "/";
  return pathname === "/entrar" || pathname.startsWith("/entrar/") ? sinShell : conShell;
}
