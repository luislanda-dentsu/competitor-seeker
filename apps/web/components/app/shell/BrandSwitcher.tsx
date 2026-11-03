"use client";

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BrandOption {
  slug: string;
  nombre: string;
}

const DEFAULT_BRANDS: readonly BrandOption[] = [
  { slug: "kolareal", nombre: "kolareal" },
];

/**
 * Selector de marca activa (global). Por ahora una opción hardcodeada;
 * la lista real y la cookie `cs-marca` llegan en la fase de datos.
 */
export function BrandSwitcher({
  brands = DEFAULT_BRANDS,
  value,
  onChange,
}: {
  brands?: readonly BrandOption[];
  value?: string;
  onChange?: (slug: string) => void;
}): React.ReactElement {
  const items = brands.map((b) => ({ label: b.nombre, value: b.slug }));
  return (
    <Select
      defaultValue={brands[0]?.slug}
      items={items}
      onValueChange={(v) => {
        if (typeof v === "string") onChange?.(v);
      }}
      value={value}
    >
      <SelectTrigger
        aria-label="Marca activa"
        className="h-8 min-h-8 min-w-0 rounded-pill bg-card-2 text-fg sm:h-8 border-transparent shadow-none"
        size="sm"
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
