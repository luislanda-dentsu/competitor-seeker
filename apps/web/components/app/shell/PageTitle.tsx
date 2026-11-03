"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { titleForPath } from "@/lib/nav";

interface PageTitleCtx {
  override: string | null;
  setOverride: (t: string | null) => void;
}

const Ctx = createContext<PageTitleCtx>({
  override: null,
  setOverride: () => {},
});

export function PageTitleProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const [override, setOverride] = useState<string | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Título efectivo: override explícito de la página o el derivado de la ruta. */
export function usePageTitle(): string {
  const { override } = useContext(Ctx);
  const pathname = usePathname();
  return override ?? titleForPath(pathname ?? "/");
}

/** Una página lo renderiza para fijar su título en el Topbar. */
export function PageTitle({ title }: { title: string }): null {
  const { setOverride } = useContext(Ctx);
  useEffect(() => {
    setOverride(title);
    return () => setOverride(null);
  }, [title, setOverride]);
  return null;
}
