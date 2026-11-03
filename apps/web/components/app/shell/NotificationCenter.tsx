"use client";

import { AtSign, Bell, CircleCheck, Gauge, GitBranch, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { toastManager } from "@/components/ui/toast";
import {
  agruparPorDia,
  fetchNotificaciones,
  guardarVistas,
  horaCorta,
  INTERVALO_NOTIFICACIONES_MS,
  leerVistas,
  marcarLeidaEnApi,
  marcarTodasLeidasEnApi,
  type Notificacion,
} from "@/lib/notifications/cliente";
import { cn } from "@/lib/utils";

const ICONO: Record<Notificacion["tipo"], typeof Bell> = {
  "apify-umbral": Gauge,
  "corrida-ok": CircleCheck,
  "corrida-rechazada": TriangleAlert,
  "git-error": GitBranch,
  "ig-sesion": AtSign,
};

const COLOR_NIVEL: Record<Notificacion["nivel"], string> = {
  info: "text-fg-muted",
  aviso: "text-s-confuso",
  critico: "text-s-no-funciona",
};

const TIPO_TOAST: Record<Notificacion["nivel"], "info" | "warning" | "error"> = {
  info: "info",
  aviso: "warning",
  critico: "error",
};

/** Máximo de toasts por tanda para no inundar al abrir la app con muchas pendientes. */
const MAX_TOASTS_POR_TANDA = 3;

function Item({ n, onAbrir }: { n: Notificacion; onAbrir: (n: Notificacion) => void }): React.ReactElement {
  const Icono = ICONO[n.tipo];
  return (
    <li>
      <button
        className={cn(
          "flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-card-2/70 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
          n.leida && "opacity-70",
        )}
        onClick={() => onAbrir(n)}
        type="button"
      >
        <Icono aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", COLOR_NIVEL[n.nivel])} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", !n.leida && "font-medium text-fg")}>{n.titulo}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg-dim">{horaCorta(n.ts)}</span>
          </span>
          <span className="line-clamp-2 text-xs text-fg-muted">{n.mensaje}</span>
        </span>
        {!n.leida && <span aria-label="no leída" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" role="img" />}
      </button>
    </li>
  );
}

function Grupo({ titulo, lista, onAbrir }: { titulo: string; lista: Notificacion[]; onAbrir: (n: Notificacion) => void }): React.ReactElement | null {
  if (lista.length === 0) return null;
  return (
    <section aria-label={titulo} className="flex flex-col gap-1">
      <h3 className="t-label px-2">{titulo}</h3>
      <ul className="flex flex-col">
        {lista.map((n) => (
          <Item key={n.id} n={n} onAbrir={onAbrir} />
        ))}
      </ul>
    </section>
  );
}

/** Solo se monta con el Popover abierto: `new Date()` (Hoy/Antes) nunca corre en el prerender. */
function Agrupadas({ lista, onAbrir }: { lista: Notificacion[]; onAbrir: (n: Notificacion) => void }): React.ReactElement {
  const { hoy, antes } = agruparPorDia(lista);
  return (
    <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
      <Grupo lista={hoy} onAbrir={onAbrir} titulo="Hoy" />
      <Grupo lista={antes} onAbrir={onAbrir} titulo="Antes" />
    </div>
  );
}

/**
 * Campana del Topbar: badge con no leídas, Popover agrupado Hoy/Antes y
 * "Marcar todas". Sondea `/api/notificaciones?noLeidas=1` cada 30 s y lanza un
 * toast por cada no leída que no se haya mostrado ya en esta sesión.
 */
export function NotificationCenter(): React.ReactElement {
  const router = useRouter();
  const [noLeidas, setNoLeidas] = useState<Notificacion[]>([]);
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const vistas = useRef<Set<string> | null>(null);

  const avisar = useCallback((pendientes: Notificacion[]) => {
    if (!vistas.current) vistas.current = leerVistas();
    const nuevas = pendientes.filter((n) => !vistas.current!.has(n.id));
    if (nuevas.length === 0) return;
    // Las más antiguas primero para que el toast más reciente quede arriba.
    const orden = [...nuevas].reverse();
    orden.slice(-MAX_TOASTS_POR_TANDA).forEach((n) => {
      toastManager.add({
        title: n.titulo,
        description: n.mensaje,
        type: TIPO_TOAST[n.nivel],
        timeout: n.nivel === "critico" ? 10_000 : 6_000,
        ...(n.href
          ? { actionProps: { children: "Ver", onClick: () => router.push(n.href!) } }
          : {}),
      });
    });
    for (const n of nuevas) vistas.current.add(n.id);
    guardarVistas(vistas.current);
  }, [router]);

  const sondear = useCallback(async () => {
    try {
      const r = await fetchNotificaciones({ noLeidas: true, limite: 100 });
      setNoLeidas(r.notificaciones);
      avisar(r.notificaciones);
    } catch {
      /* sin red o API caída: la campana conserva el último estado */
    }
  }, [avisar]);

  useEffect(() => {
    // Primer sondeo en un microtask: el estado se fija en el callback del fetch, no en el cuerpo del efecto.
    queueMicrotask(() => void sondear());
    const id = window.setInterval(() => void sondear(), INTERVALO_NOTIFICACIONES_MS);
    return () => window.clearInterval(id);
  }, [sondear]);

  const cargarLista = useCallback(async () => {
    try {
      const r = await fetchNotificaciones({ limite: 40 });
      setLista(r.notificaciones);
    } catch {
      /* se muestra lo que haya */
    }
  }, []);

  const onOpenChange = (open: boolean) => {
    setAbierto(open);
    if (open) void cargarLista();
  };

  const abrir = async (n: Notificacion) => {
    if (!n.leida) {
      setNoLeidas((prev) => prev.filter((x) => x.id !== n.id));
      setLista((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      marcarLeidaEnApi(n.id).catch(() => void sondear());
    }
    if (n.href) {
      setAbierto(false);
      router.push(n.href);
    }
  };

  const marcarTodas = async () => {
    setOcupado(true);
    try {
      await marcarTodasLeidasEnApi();
      setNoLeidas([]);
      setLista((prev) => prev.map((x) => ({ ...x, leida: true })));
    } catch {
      void sondear();
    } finally {
      setOcupado(false);
    }
  };

  const total = noLeidas.length;
  const mostradas = lista.length > 0 ? lista : noLeidas;
  const etiqueta = total === 0 ? "Notificaciones: ninguna sin leer" : `Notificaciones: ${total} sin leer`;

  return (
    <Popover onOpenChange={onOpenChange} open={abierto}>
      <PopoverTrigger
        render={<Button aria-label={etiqueta} className="relative text-fg-muted" size="icon-sm" variant="ghost" />}
      >
        <Bell aria-hidden="true" />
        <Badge
          aria-hidden="true"
          className={cn(
            "absolute -top-1 -right-1 h-4 min-w-4 px-1 font-mono text-[10px] sm:h-4 sm:min-w-4 sm:text-[10px]",
            total > 0 && "bg-primary text-primary-fg",
          )}
          variant={total > 0 ? "default" : "secondary"}
        >
          {total > 99 ? "99+" : total}
        </Badge>
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-[min(24rem,calc(100vw-2rem))]" side="bottom">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-fg">Notificaciones</h2>
            <Button disabled={total === 0 || ocupado} loading={ocupado} onClick={() => void marcarTodas()} size="xs" variant="ghost">
              Marcar todas
            </Button>
          </div>
          {mostradas.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-fg-muted">Sin notificaciones.</p>
          ) : (
            <Agrupadas lista={mostradas} onAbrir={(n) => void abrir(n)} />
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
