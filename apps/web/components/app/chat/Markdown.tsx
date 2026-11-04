import { useMemo } from "react";
import { parsearMarkdown, type Bloque, type Inline } from "@/lib/chat/markdown";
import { cn } from "@/lib/utils";

function Inlines({ nodos }: { nodos: readonly Inline[] }): React.ReactElement {
  return (
    <>
      {nodos.map((n, i) => {
        switch (n.tipo) {
          case "negrita":
            return (
              <strong className="font-semibold text-fg" key={i}>
                <Inlines nodos={n.hijos} />
              </strong>
            );
          case "cursiva":
            return (
              <em key={i}>
                <Inlines nodos={n.hijos} />
              </em>
            );
          case "codigo":
            return (
              <code className="rounded-sm bg-card-2 px-1 py-0.5 font-mono text-[0.85em] text-fg" key={i}>
                {n.texto}
              </code>
            );
          default:
            return <span key={i}>{n.texto}</span>;
        }
      })}
    </>
  );
}

function BloqueView({ b }: { b: Bloque }): React.ReactElement {
  switch (b.tipo) {
    case "cabecera": {
      const cls = b.nivel === 1 ? "text-base font-semibold" : b.nivel === 2 ? "text-[15px] font-semibold" : "text-sm font-semibold";
      const Tag = b.nivel === 1 ? "h3" : b.nivel === 2 ? "h4" : "h5";
      return (
        <Tag className={cn(cls, "text-fg")}>
          <Inlines nodos={b.hijos} />
        </Tag>
      );
    }
    case "lista": {
      const Tag = b.ordenada ? "ol" : "ul";
      return (
        <Tag className={cn("flex flex-col gap-1 ps-5", b.ordenada ? "list-decimal" : "list-disc")}>
          {b.items.map((item, i) => (
            <li className="marker:text-fg-dim" key={i}>
              <Inlines nodos={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "codigo":
      return (
        <pre className="overflow-x-auto rounded-md bg-card-2 p-3 font-mono text-xs text-fg">
          <code>{b.texto}</code>
        </pre>
      );
    default:
      return (
        <p>
          <Inlines nodos={b.hijos} />
        </p>
      );
  }
}

/** Markdown simple (párrafos, listas, negritas, código) sin HTML crudo. */
export function Markdown({ texto, className }: { texto: string; className?: string }): React.ReactElement {
  const bloques = useMemo(() => parsearMarkdown(texto), [texto]);
  return (
    <div className={cn("flex flex-col gap-3 text-[15px] leading-relaxed text-fg", className)}>
      {bloques.map((b, i) => (
        <BloqueView b={b} key={i} />
      ))}
    </div>
  );
}
