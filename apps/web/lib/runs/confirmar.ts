// Solo servidor (Node): nunca importar desde componentes cliente.

import { execFile } from "node:child_process";
import path from "node:path";
import { repoRoot } from "@competitor-seeker/core";

export type AccionConfirmar = "registrar" | "descartar";

export interface ResultadoConfirmar {
  corridaId: string;
  estado: string;
  registradas: number;
  duplicadas: string[];
}

/**
 * Confirma una corrida `pendiente-confirmacion` a través del CLI `scripts/cs`
 * (único escritor de `log.jsonl`); la app nunca escribe el log por su cuenta.
 */
export function confirmarCorrida(marca: string, corridaId: string, accion: AccionConfirmar): Promise<ResultadoConfirmar> {
  const raiz = repoRoot();
  const cli = path.join(raiz, "scripts", "cs");
  const args = ["confirmar", "--marca", marca, "--corrida-id", corridaId, "--accion", accion];
  return new Promise((resolve, reject) => {
    execFile(cli, args, { cwd: raiz, env: process.env, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const detalle = String(stderr).trim().replace(/^cs:\s*/, "") || err.message;
        reject(new Error(detalle));
        return;
      }
      try {
        resolve(JSON.parse(String(stdout)) as ResultadoConfirmar);
      } catch {
        reject(new Error(`Respuesta inesperada del CLI: ${String(stdout).slice(0, 200)}`));
      }
    });
  });
}
