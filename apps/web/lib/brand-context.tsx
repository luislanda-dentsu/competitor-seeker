"use client";

import { createContext, use, useContext, type ReactNode } from "react";
import type { ContextoMarca } from "@/lib/brand";

const VACIO: ContextoMarca = { marcas: [], activa: null, competidores: [] };
const Ctx = createContext<Promise<ContextoMarca> | null>(null);

/**
 * Transporta la promesa del contexto de marca (creada en el AppShell, en el
 * servidor) hasta los componentes cliente del shell. No la resuelve aquí:
 * cada consumidor hace `use()` dentro de su propio Suspense, así el shell
 * estático se pinta sin esperar a cookies ni disco.
 */
export function BrandProvider({
  promise,
  children,
}: {
  promise: Promise<ContextoMarca>;
  children: ReactNode;
}): React.ReactElement {
  return <Ctx.Provider value={promise}>{children}</Ctx.Provider>;
}

/** Resuelve el contexto de marca. Suspende: envolver en <Suspense>. */
export function useContextoMarca(): ContextoMarca {
  const promise = useContext(Ctx);
  if (!promise) return VACIO;
  return use(promise);
}
