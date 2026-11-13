// Solo servidor: ¿la otra Mac del equipo tiene una corrida en curso? (aviso, no bloqueo).
// Pregunta a la puerta de Cloudflare, que reenvía a la otra Mac con el secreto interno.
import { cargarEnv } from "@competitor-seeker/core";

export interface CorridaOtraMac {
  corridaId: string;
  marca: string;
  inicio: string;
}

/** null si no hay corrida, no hay otra Mac configurada o no responde en 4 s. */
export async function corridaEnOtraMac(): Promise<CorridaOtraMac | null> {
  const env = cargarEnv();
  if (!env.AUTH_URL || !env.CS_MAC || !env.CS_SECRETO_INTERNO) return null;
  try {
    const url = new URL("/__cs/otra-mac/api/corridas/estado", env.AUTH_URL);
    url.searchParams.set("desde", env.CS_MAC);
    const r = await fetch(url, { headers: { "x-cs-interno": env.CS_SECRETO_INTERNO }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const cuerpo = (await r.json()) as { enCurso?: CorridaOtraMac | null };
    return cuerpo.enCurso ?? null;
  } catch {
    return null;
  }
}
