import { z } from 'zod'
import { Entrada, EntradaAgente, FechaISO, Fuente } from './entrada.ts'

export const EstadoCorrida = z.enum(['en-curso', 'registrada', 'pendiente-confirmacion', 'descartada', 'error'])
export type EstadoCorrida = z.infer<typeof EstadoCorrida>

export const ModoCorrida = z.enum(['ui', 'terminal', 'migrada'])
export type ModoCorrida = z.infer<typeof ModoCorrida>

export const Objecion = z.object({
  marca: z.string(),
  problema: z.string(),
})
export type Objecion = z.infer<typeof Objecion>

export const ApifyCorrida = z.object({
  resultados: z.number().int().nonnegative().default(0),
  costeEstimadoUsd: z.number().nonnegative().default(0),
  incluido: z.boolean().optional(),
  omitido: z.boolean().optional(),
  /** Id del run en Apify. El workflow lo omite si no lo hay; `null` se tolera por compatibilidad. */
  runId: z.string().nullish(),
  /** Por qué se omitió. Ídem: ausente o `null`. */
  motivo: z.string().nullish(),
})
export type ApifyCorrida = z.infer<typeof ApifyCorrida>

/** `no-usado`: la corrida no tenía perfiles de IG; `error`: el rastreador-ig no respondió. */
export const SesionIg = z.enum(['ok', 'no-disponible', 'no-usado', 'error', 'desconocido'])
export type SesionIg = z.infer<typeof SesionIg>

export const Corrida = z.object({
  id: z.string().min(1),
  marca: z.string().min(1),
  fecha: FechaISO,
  ultimaCorrida: FechaISO.nullable(),
  inicio: z.string().min(1),
  fin: z.string().optional(),
  duracionMs: z.number().nonnegative().optional(),
  estado: EstadoCorrida,
  verificado: z.boolean(),
  intentos: z.number().int().nonnegative(),
  objeciones: z.array(Objecion).default([]),
  fuentes: z.array(Fuente).default([]),
  apify: ApifyCorrida.optional(),
  competidores: z.array(z.string()).default([]),
  entradas: z.array(Entrada).default([]),
  modo: ModoCorrida,
  maquina: z.string().min(1),
  sessionId: z.string().optional(),
  ig: z.object({ sesion: SesionIg }).optional(),
  git: z.object({ pushed: z.boolean(), error: z.string().optional() }).optional(),
  error: z.string().optional(),
})
export type Corrida = z.infer<typeof Corrida>

/** Lo que el workflow devuelve y `cs registrar` lee por stdin. */
export const ResultadoWorkflow = z.object({
  entradas: z.array(EntradaAgente),
  verificado: z.boolean(),
  intentos: z.number().int().nonnegative().default(1),
  objeciones: z.array(Objecion).optional(),
  apify: ApifyCorrida.optional(),
  ig: z.object({ sesion: SesionIg }).optional(),
  fuentes: z.array(Fuente).optional(),
  sessionId: z.string().optional(),
})
export type ResultadoWorkflow = z.infer<typeof ResultadoWorkflow>
