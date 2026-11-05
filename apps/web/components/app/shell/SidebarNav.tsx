"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ChatSidebar } from "@/components/app/chat/ChatSidebar";
import { SignalDot } from "@/components/app/signals/SignalDot";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useContextoMarca } from "@/lib/brand-context";
import { cn } from "@/lib/utils";
import { isNavActive, NAV_ITEMS } from "@/lib/nav";

const MAX_SUBITEMS = 8;

/**
 * Sub-ítems bajo "Competidores": los competidores activos de la marca
 * (máx. 8) con su semáforo. Lee el contexto de marca con `use()`, por eso
 * va dentro de su propio Suspense (fallback vacío: no desplaza el menú).
 */
function CompetidorSubnavLive({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}): React.ReactElement | null {
  const { competidores } = useContextoMarca();
  if (competidores.length === 0) return null;
  const visibles = competidores.slice(0, MAX_SUBITEMS);
  const restantes = competidores.length - visibles.length;
  return (
    <ul aria-label="Competidores de la marca activa" className="mt-0.5 flex flex-col gap-0.5 ps-5">
      {visibles.map((c) => {
        const href = `/competidores/${c.slug}`;
        const active = pathname === href;
        return (
          <li key={c.slug}>
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-fg-muted transition-colors hover:bg-card-2/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                active && "bg-card-2 font-medium text-fg [&_svg]:text-action-text",
              )}
              href={href}
              onClick={onNavigate}
            >
              {c.senal ? (
                <SignalDot senal={c.senal} size="sm" />
              ) : (
                <span
                  aria-label="Sin registros"
                  className="inline-block size-1.5 shrink-0 rounded-full border border-border-strong"
                  role="img"
                />
              )}
              <span className="truncate">{c.nombre}</span>
            </Link>
          </li>
        );
      })}
      {restantes > 0 && (
        <li>
          <Link
            className="flex h-8 items-center px-2.5 text-xs text-fg-dim hover:text-fg"
            href="/competidores"
            onClick={onNavigate}
          >
            +{restantes} más
          </Link>
        </li>
      )}
    </ul>
  );
}

function CompetidorSubnav(props: {
  pathname: string;
  onNavigate?: () => void;
}): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <CompetidorSubnavLive {...props} />
    </Suspense>
  );
}

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
                active && "bg-card-2 font-medium text-fg [&_svg]:text-action-text",
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
              {href === "/competidores" && !(collapsible && collapsed) && (
                <div className={cn(collapsible && "sb-collapsed:hidden")}>
                  <CompetidorSubnav onNavigate={onNavigate} pathname={pathname} />
                </div>
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
  // Modo chat: en /asistente el menú se sustituye por Volver · Nuevo chat · historial.
  if (pathname === "/asistente" || pathname.startsWith("/asistente/")) {
    return <ChatSidebar collapsed={(props.collapsible ?? true) && (props.collapsed ?? false)} onNavigate={props.onNavigate} />;
  }
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
