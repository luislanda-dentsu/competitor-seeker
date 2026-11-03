"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isNavActive, NAV_ITEMS } from "@/lib/nav";

interface SidebarNavProps {
  /** En el Sheet móvil no hay modo colapsado ni tooltips. */
  collapsible?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavList({
  pathname,
  collapsible = true,
  collapsed = false,
  onNavigate,
}: SidebarNavProps & { pathname: string }): React.ReactElement {
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(href, pathname);
          const link = (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-card-2/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                active && "bg-card-2 font-medium text-fg",
                collapsible && "sb-collapsed:justify-center sb-collapsed:px-0",
              )}
              href={href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" className="size-[18px] shrink-0" />
              <span
                className={cn("truncate", collapsible && "sb-collapsed:sr-only")}
              >
                {label}
              </span>
            </Link>
          );
          return (
            <li key={href}>
              {collapsible && collapsed ? (
                <Tooltip>
                  <TooltipTrigger render={link} />
                  <TooltipPopup side="right">{label}</TooltipPopup>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NavListLive(props: SidebarNavProps): React.ReactElement {
  const pathname = usePathname() ?? "/";
  return <NavList pathname={pathname} {...props} />;
}

/**
 * Lista de navegación. `usePathname` es dato de runtime en rutas dinámicas
 * (Cache Components), así que va dentro de Suspense: el shell estático pinta
 * la lista sin ítem activo y el activo llega al instante en streaming.
 */
export function SidebarNav(props: SidebarNavProps): React.ReactElement {
  return (
    <Suspense fallback={<NavList pathname="" {...props} />}>
      <NavListLive {...props} />
    </Suspense>
  );
}
