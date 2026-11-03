// Validación compartida cliente/servidor de los formularios de Ajustes (zod,
// sin node). Las rutas API la aplican en la frontera; los formularios la usan
// para avisar antes de enviar.
import { z } from "zod";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CuerpoNuevaMarca = z.object({
  nombre: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
});
export type CuerpoNuevaMarca = z.infer<typeof CuerpoNuevaMarca>;

export const CuerpoArchivarMarca = z.object({
  /** Debe coincidir con el nombre de la marca: confirmación explícita. */
  nombre: z.string().trim().min(1, "Escribe el nombre de la marca"),
});

export const CuerpoToken = z.object({
  token: z
    .string()
    .trim()
    .min(8, "El token parece demasiado corto")
    .regex(/^[A-Za-z0-9_.-]+$/, "El token solo admite letras, números, guiones y puntos"),
});
export type CuerpoToken = z.infer<typeof CuerpoToken>;

export function esUrlHttp(valor: string): boolean {
  if (!/^https?:\/\//i.test(valor)) return false;
  try {
    new URL(valor);
    return true;
  } catch {
    return false;
  }
}

export function esUrlInstagram(valor: string | undefined): boolean {
  if (!valor) return false;
  try {
    return /(^|\.)instagram\.com$/i.test(new URL(valor).hostname);
  } catch {
    return false;
  }
}

export const CompetidorForm = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre"),
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || esUrlHttp(v), "Debe empezar por http:// o https://"),
  activo: z.boolean(),
});
export type CompetidorForm = z.infer<typeof CompetidorForm>;

export const CuerpoCompetidores = z.object({
  competidores: z
    .array(CompetidorForm)
    .superRefine((lista, ctx) => {
      const vistos = new Set<string>();
      lista.forEach((c, i) => {
        const clave = c.nombre.toLowerCase();
        if (vistos.has(clave)) ctx.addIssue({ code: "custom", message: `Nombre repetido: ${c.nombre}`, path: [i, "nombre"] });
        vistos.add(clave);
      });
    }),
});
export type CuerpoCompetidores = z.infer<typeof CuerpoCompetidores>;

/** Presupuesto en USD o null ("auto"). */
const usdONull = z.number().nonnegative("No puede ser negativo").nullable();

export const ConfigApifyForm = z.object({
  habilitado: z.boolean(),
  resultsLimitPorPerfil: z.number().int("Debe ser entero").min(1, "Mínimo 1").max(200, "Máximo 200"),
  presupuesto: z.object({ mensualUsd: usdONull, diarioUsd: usdONull, semanalUsd: usdONull }),
  umbrales: z.array(z.number().min(0).max(100)).length(3, "Son tres umbrales"),
  saltarSiPctMensual: z.number().min(0).max(100),
});
export type ConfigApifyForm = z.infer<typeof ConfigApifyForm>;

/** Primer mensaje legible de un ZodError. */
export function primerError(e: z.ZodError): string {
  const i = e.issues[0];
  if (!i) return "Datos inválidos";
  return i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message;
}
