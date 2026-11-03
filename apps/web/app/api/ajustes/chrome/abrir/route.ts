import { execFile } from "node:child_process";
import { errorJson, okJson } from "@/lib/settings/api";

const URL_INSTAGRAM = "https://www.instagram.com/";

/**
 * POST /api/ajustes/chrome/abrir → abre Instagram en el Chrome del usuario
 * (el perfil con la extensión Claude in Chrome). Solo macOS (`open -a`).
 */
export async function POST(): Promise<Response> {
  if (process.platform !== "darwin") return errorJson("Abrir Chrome solo está soportado en macOS.", 501);
  return new Promise<Response>((resolve) => {
    execFile("open", ["-a", "Google Chrome", URL_INSTAGRAM], { timeout: 10_000 }, (err) => {
      if (err) resolve(errorJson(`No se pudo abrir Google Chrome: ${err.message}`, 500));
      else resolve(okJson({ ok: true, url: URL_INSTAGRAM }));
    });
  });
}
