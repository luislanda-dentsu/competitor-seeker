import { commitYPush } from "@competitor-seeker/core";

/** commit + push de `marcas/` y `config.json` tras un cambio de ajustes. Nunca lanza ni rompe la ruta. */
export async function sincronizarAjustes(mensaje: string): Promise<void> {
  try {
    await commitYPush(mensaje, { auto: true });
  } catch {
    /* el cambio ya está guardado en disco; git se reintenta en la próxima sincronización */
  }
}
