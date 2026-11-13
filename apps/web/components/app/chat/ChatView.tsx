"use client";

import { PanelRightOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArtifactPanel } from "@/components/app/chat/ArtifactPanel";
import { ChatComposer } from "@/components/app/chat/ChatComposer";
import { ChatMessage, Pensando } from "@/components/app/chat/ChatMessage";
import { SuggestionCards } from "@/components/app/chat/SuggestionCards";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerDescription, DrawerHeader, DrawerPopup, DrawerTitle } from "@/components/ui/drawer";
import { ToastProvider } from "@/components/ui/toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { fmtFecha } from "@/lib/format";
import { invalidarHistorial } from "@/lib/chat/historial";
import type { ArtefactoUi, ChatUi, Sugerencia } from "@/lib/chat/tipos";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import { cn } from "@/lib/utils";

export interface ChatViewProps {
  marca: string;
  marcaNombre: string;
  chat: ChatUi | null;
  sugerencias: readonly Sugerencia[];
  /** La marca no tiene entradas en el log: sugerencias deshabilitadas + aviso. */
  sinEntradas: boolean;
}

function Inicio({
  marcaNombre,
  sugerencias,
  sinEntradas,
  onElegir,
}: {
  marcaNombre: string;
  sugerencias: readonly Sugerencia[];
  sinEntradas: boolean;
  onElegir: (t: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 pt-10 sm:pt-16">
      <h2 className="text-[26px] font-light leading-tight tracking-tight text-fg sm:text-3xl">¿Qué quieres saber de {marcaNombre}?</h2>
      {sinEntradas && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Sin hallazgos registrados</AlertTitle>
          <AlertDescription>El asistente responde solo sobre hallazgos registrados; corre primero.</AlertDescription>
          <AlertAction>
            <Button render={<Link href="/corridas" />} size="sm" variant="outline">
              Ir a Corridas
            </Button>
          </AlertAction>
        </Alert>
      )}
      <SuggestionCards disabled={sinEntradas} onElegir={onElegir} sugerencias={sugerencias} />
    </div>
  );
}

function ErrorSistema({ error, onReintentar, generando }: { error: string; onReintentar: () => void; generando: boolean }): React.ReactElement {
  return (
    <Alert role="alert" variant="error">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>El asistente no pudo responder</AlertTitle>
      <AlertDescription className="break-words">{error}</AlertDescription>
      <AlertAction>
        <Button disabled={generando} onClick={onReintentar} size="sm" variant="outline">
          Reintentar
        </Button>
      </AlertAction>
    </Alert>
  );
}

/** Página del asistente: hilo centrado, composer y panel de artefacto (grid en ≥1024, Drawer en móvil). */
export function ChatView({ marca, marcaNombre, chat, sugerencias, sinEntradas }: ChatViewProps): React.ReactElement {
  const [panel, setPanelState] = useState<ArtefactoUi | null>(null);
  // Último artefacto mostrado: permite reabrir el panel tras cerrarlo.
  const [ultimoPanel, setUltimoPanel] = useState<ArtefactoUi | null>(null);
  const setPanel = useCallback((a: ArtefactoUi | null) => {
    setPanelState(a);
    if (a) setUltimoPanel(a);
  }, []);
  const escritorio = useMediaQuery("lg");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pegadoAbajo = useRef(true);

  const onDone = useCallback(
    ({ chatId, nuevo }: { chatId: string; nuevo: boolean }) => {
      invalidarHistorial();
      // Chat nuevo: la URL pasa a /asistente/<id> sin recargar (el App Router sincroniza usePathname).
      if (nuevo && typeof window !== "undefined" && !window.location.pathname.endsWith(`/${chatId}`)) {
        window.history.replaceState(null, "", `/asistente/${chatId}`);
      }
    },
    [],
  );
  const onArtefacto = useCallback((a: ArtefactoUi) => setPanel(a), [setPanel]);

  const s = useChatStream({ marca, chat, onDone, onArtefacto });
  const { mensajes, generando, estado, error, pensando } = s;

  // Autoscroll mientras llega texto, solo si el usuario no subió a leer.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pegadoAbajo.current) return;
    el.scrollTop = el.scrollHeight;
  }, [mensajes, pensando, error]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Esc detiene la generación.
  useEffect(() => {
    if (!generando) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") s.detener();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generando, s]);

  const enviar = (t: string) => {
    pegadoAbajo.current = true;
    s.enviar(t);
  };

  const inicial = mensajes.length === 0 && estado !== "error";
  const ultimoAsistente = (() => {
    for (let i = mensajes.length - 1; i >= 0; i--) if (mensajes[i]!.rol === "asistente") return i;
    return -1;
  })();
  const panelAbierto = panel !== null;

  return (
    <ToastProvider position="bottom-center">
      <div className="flex h-[calc(100dvh-6rem)] min-h-[460px] flex-col lg:h-[calc(100dvh-9rem)]">
        <div className={cn("grid min-h-0 flex-1 gap-4", panelAbierto && "lg:grid-cols-[minmax(360px,1fr)_minmax(420px,45%)]")}>
          <section aria-label="Conversación" className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto" onScroll={onScroll} ref={scrollRef}>
              <div className="mx-auto w-full max-w-3xl px-1 pb-4">
                {chat && (
                  <div className="flex flex-col gap-1 pb-2 text-xs text-fg-dim">
                    <p className="break-words">Contexto del {fmtFecha(chat.contextoEn.slice(0, 10))}</p>
                    {chat.corridasNuevas && <p className="text-fg-muted">Hay corridas nuevas: abre un chat nuevo para incluirlas.</p>}
                  </div>
                )}
                {!panelAbierto && ultimoPanel && (
                  <div className="sticky top-0 z-10 flex justify-end pb-2">
                    <Button onClick={() => setPanel(ultimoPanel)} size="sm" variant="outline">
                      <PanelRightOpen aria-hidden="true" />
                      Mostrar panel
                    </Button>
                  </div>
                )}
                {inicial ? (
                  <Inicio marcaNombre={marcaNombre} onElegir={enviar} sinEntradas={sinEntradas} sugerencias={sugerencias} />
                ) : (
                  <ol aria-live="polite" className="flex flex-col gap-6 pt-2">
                    {mensajes.map((m, i) => (
                      <li key={`${m.ts}-${i}`}>
                        <ChatMessage
                          generando={generando}
                          indice={i}
                          mensaje={m}
                          onFeedback={(idx, f) => void s.setFeedback(idx, f)}
                          onRegenerar={s.regenerar}
                          onVerArtefacto={setPanel}
                          pensando={pensando}
                          ultimo={i === ultimoAsistente}
                        />
                      </li>
                    ))}
                    {generando && mensajes.at(-1)?.rol !== "asistente" && (
                      <li>
                        <Pensando texto={pensando} />
                      </li>
                    )}
                    {estado === "error" && error && (
                      <li>
                        <ErrorSistema error={error} generando={generando} onReintentar={s.reintentar} />
                      </li>
                    )}
                  </ol>
                )}
              </div>
            </div>
            <div className="mx-auto w-full max-w-3xl shrink-0 pt-3">
              <ChatComposer generando={generando} marcaNombre={marcaNombre} onDetener={s.detener} onEnviar={enviar} />
              <p className="mt-2 text-center text-[11px] text-fg-dim">Responde solo con lo registrado en el log de {marcaNombre}. Enter envía · Shift+Enter salto de línea.</p>
            </div>
          </section>

          {panelAbierto && escritorio && <ArtifactPanel artefacto={panel} className="min-h-0" onCerrar={() => setPanel(null)} />}
        </div>

        {panelAbierto && !escritorio && (
          <Drawer onOpenChange={(open) => !open && setPanel(null)} open>
            <DrawerPopup className="max-h-[85dvh]" showBar>
              <DrawerHeader>
                <DrawerTitle>{panel.titulo}</DrawerTitle>
                <DrawerDescription>
                  {panel.entradas.length} {panel.entradas.length === 1 ? "entrada citada" : "entradas citadas"}
                </DrawerDescription>
              </DrawerHeader>
              <ArtifactPanel artefacto={panel} className="min-h-0 flex-1 rounded-none border-0 bg-transparent" onCerrar={() => setPanel(null)} sinCabecera />
            </DrawerPopup>
          </Drawer>
        )}
      </div>
    </ToastProvider>
  );
}
