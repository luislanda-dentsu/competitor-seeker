import { execFile } from "node:child_process";
import { exigirUsuario } from "@/lib/sesion";
import path from "node:path";
import { repoRoot } from "@competitor-seeker/core";
import { errorJson, okJson } from "@/lib/settings/api";

const URL_INSTAGRAM = "https://www.instagram.com/";

/**
 * POST /api/ajustes/chrome/abrir → abre Instagram en el perfil de Chrome DEDICADO
 * (el que usa el MCP chrome-devtools) para iniciar sesión. Delega en
 * `scripts/chrome-ig.sh login`. Solo macOS (`open -na`).
 */
export async function POST(): Promise<Response> {
  const usuario = await exigirUsuario({ admin: true });
  if (usuario instanceof Response) return usuario;
  if (process.platform !== "darwin") return errorJson("Abrir Chrome solo está soportado en macOS.", 501);
  const script = path.join(repoRoot(), "scripts", "chrome-ig.sh");
  return new Promise<Response>((resolve) => {
    execFile("bash", [script, "login"], { timeout: 10_000 }, (err) => {
      if (err) resolve(errorJson(`No se pudo abrir el Chrome dedicado: ${err.message}`, 500));
      else resolve(okJson({ ok: true, url: URL_INSTAGRAM }));
    });
  });
}
