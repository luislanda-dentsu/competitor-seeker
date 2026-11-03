"use client";

import { ArrowLeft, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useContextoMarca } from "@/lib/brand-context";
import { invalidarHistorial, useHistorial } from "@/lib/chat/historial";
import type { ChatResumenUi } from "@/lib/chat/tipos";
import { cn } from "@/lib/utils";

const LINK = "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-card-2/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1";

function Accion({
  href,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof Plus;
  collapsed: boolean;
  onNavigate?: () => void;
}): React.ReactElement {
  const link = (
    <Link className={cn(LINK, collapsed && "sb-collapsed:justify-center sb-collapsed:px-0")} href={href} onClick={onNavigate}>
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      <span className={cn("truncate", collapsed && "sb-collapsed:sr-only")}>{label}</span>
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

function ItemChat({
  chat,
  marca,
  activo,
  onNavigate,
  onBorrar,
}: {
  chat: ChatResumenUi;
  marca: string;
  activo: boolean;
  onNavigate?: () => void;
  onBorrar: (chat: ChatResumenUi) => void;
}): React.ReactElement {
  void marca;
  return (
    <li className="group/chat relative">
      <Link
        aria-current={activo ? "page" : undefined}
        className={cn(LINK, "h-8 pe-8 text-[13px]", activo && "bg-card-2 font-medium text-fg")}
        href={`/asistente/${chat.id}`}
        onClick={onNavigate}
        title={chat.titulo}
      >
        <span className="truncate">{chat.titulo}</span>
      </Link>
      <Menu>
        <MenuTrigger
          render={
            <Button
              aria-label={`Opciones de «${chat.titulo}»`}
              className={cn(
                "absolute top-1/2 right-1 -translate-y-1/2 text-fg-dim opacity-0 group-focus-within/chat:opacity-100 group-hover/chat:opacity-100 data-popup-open:opacity-100 hover:text-fg",
                activo && "opacity-100",
              )}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="start" side="right">
          <MenuItem onClick={() => onBorrar(chat)} variant="destructive">
            <Trash2 aria-hidden="true" />
            Borrar
          </MenuItem>
        </MenuPopup>
      </Menu>
    </li>
  );
}

function HistorialLive({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }): React.ReactElement {
  const { activa } = useContextoMarca();
  const { grupos, cargando, error } = useHistorial(activa);
  const router = useRouter();
  const [aBorrar, setABorrar] = useState<ChatResumenUi | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const confirmarBorrado = async () => {
    if (!aBorrar || !activa) return;
    setBorrando(true);
    setErrorBorrar(null);
    try {
      const res = await fetch(`/api/asistente?chatId=${encodeURIComponent(aBorrar.id)}&marca=${encodeURIComponent(activa)}`, { method: "DELETE" });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(cuerpo.error ?? `Error ${res.status}`);
      }
      const eraActivo = pathname === `/asistente/${aBorrar.id}`;
      setABorrar(null);
      invalidarHistorial();
      if (eraActivo) router.push("/asistente");
    } catch (e) {
      setErrorBorrar((e as Error).message);
    } finally {
      setBorrando(false);
    }
  };

  if (!activa) return <p className="px-2.5 text-xs text-fg-dim">Sin marca activa.</p>;
  if (error) return <p className="px-2.5 text-xs text-s-no-funciona">No se pudo leer el historial: {error}</p>;
  if (cargando && grupos.length === 0) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 px-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-5/6" />
      </div>
    );
  }
  if (grupos.length === 0) return <p className="px-2.5 text-xs text-fg-dim">Aún no hay chats para esta marca.</p>;

  return (
    <>
      <nav aria-label="Historial de chats" className="flex flex-col gap-3">
        {grupos.map((g) => (
          <div key={g.grupo}>
            <h3 className="t-label mb-1 px-2.5 text-fg-dim">{g.grupo}</h3>
            <ul className="flex flex-col gap-0.5">
              {g.chats.map((c) => (
                <ItemChat activo={pathname === `/asistente/${c.id}`} chat={c} key={c.id} marca={activa} onBorrar={setABorrar} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <AlertDialog onOpenChange={(open) => !open && !borrando && setABorrar(null)} open={aBorrar !== null}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este chat?</AlertDialogTitle>
            <AlertDialogDescription>
              «{aBorrar?.titulo}» se eliminará del historial local. El log de la marca no se toca.
              {errorBorrar && <span className="mt-2 block text-s-no-funciona">{errorBorrar}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button disabled={borrando} variant="outline" />}>Cancelar</AlertDialogClose>
            <Button disabled={borrando} onClick={() => void confirmarBorrado()} variant="destructive">
              Borrar
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

export interface ChatSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Sidebar en modo chat: Volver, Nuevo chat y el historial agrupado por fecha. */
export function ChatSidebar({ collapsed = false, onNavigate }: ChatSidebarProps): React.ReactElement {
  const pathname = usePathname() ?? "/asistente";
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Asistente" className="flex flex-col gap-0.5">
        <Accion collapsed={collapsed} href="/" icon={ArrowLeft} label="Volver" onNavigate={onNavigate} />
        <Accion collapsed={collapsed} href="/asistente" icon={Plus} label="Nuevo chat" onNavigate={onNavigate} />
      </nav>
      {!collapsed && (
        <Suspense fallback={<Skeleton className="mx-2.5 h-7" />}>
          <HistorialLive onNavigate={onNavigate} pathname={pathname} />
        </Suspense>
      )}
    </div>
  );
}
