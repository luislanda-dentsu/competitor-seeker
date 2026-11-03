import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  /** CTA principal (Link). */
  accion?: { href: string; label: string };
  /** Enlace secundario, más discreto. */
  secundaria?: { href: string; label: string };
  /** Sin Card alrededor (para usarlo dentro de otra Card o Tab). */
  plano?: boolean;
  className?: string;
}

/** Estado vacío de coss/ui con icono, texto frío y CTA. */
export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  accion,
  secundaria,
  plano = false,
  className,
}: EmptyStateProps): React.ReactElement {
  const cuerpo = (
    <Empty className={cn(plano && "py-10 md:py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="font-medium text-lg">{titulo}</EmptyTitle>
        <EmptyDescription>{descripcion}</EmptyDescription>
      </EmptyHeader>
      {(accion || secundaria) && (
        <EmptyContent>
          {accion && (
            <Button render={<Link href={accion.href} />} size="sm">
              {accion.label}
            </Button>
          )}
          {secundaria && (
            <Link
              className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg"
              href={secundaria.href}
            >
              {secundaria.label}
            </Link>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
  if (plano) return cuerpo;
  return <Card className="rounded-lg">{cuerpo}</Card>;
}
