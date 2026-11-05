"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { seccionDe } from "@/lib/section";

/**
 * Copia la sección de la ruta a <html data-section>: los tokens de acento
 * (--sec-a/--sec-b) se resuelven en :root, así llegan también a los portales.
 */
export function SectionScope(): null {
  const pathname = usePathname() ?? "/";
  useEffect(() => {
    document.documentElement.dataset.section = seccionDe(pathname);
  }, [pathname]);
  return null;
}
