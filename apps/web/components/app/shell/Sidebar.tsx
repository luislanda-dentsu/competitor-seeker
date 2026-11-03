"use client";

import { CircleQuestionMark, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarCollapseButton } from "@/components/app/shell/SidebarCollapseButton";
import { SidebarNav } from "@/components/app/shell/SidebarNav";
import { UsageMeter } from "@/components/app/shell/UsageMeter";
import { isNavActive } from "@/lib/nav";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSidebar } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

function FooterLink({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Settings;
  collapsed: boolean;
  active: boolean;
}): React.ReactElement {
  const link = (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-card-2/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 sb-collapsed:justify-center sb-collapsed:px-0",
        active && "bg-card-2 font-medium text-fg",
      )}
      href={href}
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      <span className="truncate sb-collapsed:sr-only">{label}</span>
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipPopup side="right">{label}</TooltipPopup>
    </Tooltip>
  );
}

function FooterLinks({
  collapsed,
  pathname,
}: {
  collapsed: boolean;
  pathname: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <FooterLink
        active={false}
        collapsed={collapsed}
        href="/ajustes#ayuda"
        icon={CircleQuestionMark}
        label="Ayuda"
      />
      <FooterLink
        active={isNavActive("/ajustes", pathname)}
        collapsed={collapsed}
        href="/ajustes"
        icon={Settings}
        label="Ajustes"
      />
    </div>
  );
}

function FooterLinksLive({ collapsed }: { collapsed: boolean }): React.ReactElement {
  const pathname = usePathname() ?? "/";
  return <FooterLinks collapsed={collapsed} pathname={pathname} />;
}

/**
 * Sidebar de escritorio: 240px expandido / 64px colapsado.
 * El ancho lo gobierna el atributo <html data-sidebar> vía la variante
 * `sb-collapsed` (fijado antes del paint desde la cookie cs-sidebar), así no
 * hay salto al cargar. Entre 1024 y 1279px va siempre colapsado.
 */
export function Sidebar(): React.ReactElement {
  const { collapsed: byCookie } = useSidebar();
  const narrow = useMediaQuery("lg:max-xl");
  const collapsed = byCookie || narrow;
  return (
    <aside
      aria-label="Barra lateral"
      className="hidden min-h-0 flex-col border-e border-border bg-surface lg:flex"
    >
      {/* Marca + colapsar */}
      <div className="flex h-16 items-center justify-between gap-2 px-3 sb-collapsed:justify-center sb-collapsed:px-0">
        <Link
          aria-label="Competitor-Seeker · Resumen"
          className="flex min-w-0 items-center gap-2.5 rounded-md px-1.5 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
          href="/"
        >
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary font-mono text-[13px] font-semibold text-primary-fg"
          >
            cs
          </span>
          <span className="truncate text-sm font-medium text-fg sb-collapsed:sr-only">
            Competitor-Seeker
          </span>
        </Link>
        <SidebarCollapseButton className="sb-collapsed:hidden max-xl:hidden" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 sb-collapsed:px-2.5">
        <SidebarNav collapsed={collapsed} />
        <div className="hidden justify-center xl:sb-collapsed:flex">
          <SidebarCollapseButton />
        </div>
      </div>

      {/* Hueco UsageMeter + pie */}
      <div className="flex flex-col gap-2 px-3 pb-3 sb-collapsed:px-2.5">
        <UsageMeter collapsed={collapsed} />
        <Separator />
        <Suspense fallback={<FooterLinks collapsed={collapsed} pathname="" />}>
          <FooterLinksLive collapsed={collapsed} />
        </Suspense>
      </div>
    </aside>
  );
}
