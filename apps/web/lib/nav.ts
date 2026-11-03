import {
  Bot,
  LayoutDashboard,
  Play,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/competidores", label: "Competidores", icon: Users },
  { href: "/asistente", label: "Asistente", icon: Bot },
  { href: "/corridas", label: "Corridas", icon: Play },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

/** ¿El ítem está activo para este pathname? Raíz solo con igualdad exacta. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Título por defecto de la página a partir del pathname. */
export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Resumen";
  if (pathname.startsWith("/competidores/")) return "Competidor";
  const item = NAV_ITEMS.find((i) => isNavActive(i.href, pathname));
  return item?.label ?? "Competitor-Seeker";
}
