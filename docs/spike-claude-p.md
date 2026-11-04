# Spike Fase 0 — ¿corre la corrida bajo `claude -p` (headless)?

Fecha: 2026-11-03 · Script: `scripts/spike-claude-p.sh` · Salida cruda: `docs/spike/salida.jsonl` (gitignored)

## Comando probado

```
claude -p "<prompt: lanza .claude/workflows/corrida.js por scriptPath para Country Club RD, no registres nada>" \
  --output-format stream-json --verbose --include-partial-messages --forward-subagent-text \
  --permission-mode dontAsk --permission-prompts none \
  --settings .claude/settings.headless.json \
  --allowedTools Workflow Agent Read Grep Glob WebSearch WebFetch "mcp__chrome-devtools__*" "mcp__apify__*" \
  --json-schema '{...verificado, intentos, entradas, igSesion...}'
```

## Criterios y resultado

| # | Criterio | Resultado |
|---|---|---|
| 1 | `tool_use` de `Workflow` visible y el workflow corre por fases | ✅ `task_started` (task_type `local_workflow`) → `task_progress` con `description: "Rastreo: rastreo-ig:todos"`, `"Rastreo: rastreo-web:Country Club RD"`, `"Análisis: analista:intento-1"`, `"Verificación: verificacion:intento-1"` → `task_updated status: completed` (29 s) |
| 2 | El rastreador-ig usa `mcp__chrome-devtools__*` | ✅ el navegador abrió el perfil; IG mostró modal de login → el agente reportó `SESIÓN NO DISPONIBLE` correctamente (la sesión del perfil caducó; no es un fallo del headless) |
| 3 | `mcp__apify__*` disponible | ✅ en `system/init` aparece `apify: connected` y sus 12 tools |
| 4 | Cero denegaciones de permisos relevantes | ⚠️ 3 denegaciones: `Bash` ×2 y `Monitor` ×1 (el orquestador intentó leer el journal del workflow). En `dontAsk`, Bash se deniega aunque sea solo lectura → el runner pasará `--allowedTools "Bash(scripts/cs *)"` para el registro |
| 5 | `result` respeta `--json-schema` | ✅ `structured_output: {verificado:true, intentos:1, entradas:2, igSesion:"no-disponible"}` |

Otros datos: 494 líneas de stream; `result.duration_api_ms` 85 842; eventos útiles para la consola: `system/task_progress.description` (fase + label), `system/task_notification` (fin), `stream_event` (texto parcial), `system/permission_denied`.

## Decisión

**Workflow en headless: SÍ.** No hace falta fallback A/B/C. El runner (`packages/core/src/claude/runner.ts`) usa exactamente estos flags más `--allowedTools "Bash(scripts/cs *)"`. Pendiente: confirmar que `Bash(scripts/cs *)` en `--allowedTools` se respeta en `dontAsk` cuando exista el CLI (Fase 3).

## Addendum: Claude in Chrome en headless (mismo día)

El usuario indicó usar su Chrome (perfil "luis", con la extensión Claude in Chrome e IG logueado) en vez del perfil dedicado. Mini-spike: `claude -p "<abre instagram.com/countryclubrd y di si está logueado>" --chrome --permission-mode dontAsk --permission-prompts none --allowedTools "mcp__claude-in-chrome__*" --json-schema …` → `{chromeDisponible:true, logueado:true}` en 18 s; en `system/init` aparecen los tools `mcp__claude-in-chrome__*` solo cuando se pasa `--chrome`. Decisión: el rastreador-ig usa Claude in Chrome; se elimina `.mcp.json` (chrome-devtools) y el perfil dedicado; el runner añade `--chrome` y `mcp__claude-in-chrome__*` a `--allowedTools`.

## Addendum: Bash en headless (Fase 3, runner desde la UI)

Pendiente de la Fase 0: ¿se respeta `Bash(scripts/cs *)` en `--allowedTools` bajo `--permission-mode dontAsk`? Probado una vez con Claude Code 2.1.317 desde la raíz del repo:

```
claude -p "Ejecuta exactamente este comando con Bash y devuelve su salida: ./scripts/cs nuevo-id kolareal" \
  --output-format json --permission-mode dontAsk --permission-prompts none \
  --allowedTools "Bash(./scripts/cs *)" "Bash(scripts/cs *)"
```

Resultado: `permission_denials: []`, `num_turns: 2`, `result: "2026-11-03-1222-administrast"` (3,9 s). **La sintaxis con espacio `Bash(<prefijo> *)` funciona**; no hizo falta probar la de dos puntos (`Bash(./scripts/cs:*)`). `allowedToolsCorrida` en `packages/core/src/claude/prompts.ts` mantiene las dos variantes de prefijo (`scripts/cs` y `./scripts/cs`) porque el orquestador escribe el comando de ambas formas.

Decisiones del runner (`apps/web/lib/runs/runner.ts`):
- Stream crudo en `data/corridas-vivas/<marca>/<id>.stream.jsonl` (+ `.fin` al cerrar el proceso); `GET /api/corridas/[id]/stream` lo sirve por SSE con `id: <offset en bytes>` y reanuda por `Last-Event-ID` o `?desde=`.
- `corridas/<id>.json` se crea `en-curso` antes de lanzar `claude -p`; si al terminar el proceso sigue `en-curso` (el orquestador no llegó a `cs registrar`), el runner la cierra como `error` con el último texto del stream (o `cancelada` tras un `DELETE`). En `CS_RUNNER=mock` esto ocurre siempre: el stream grabado no registra nada.
- Lock `data/corrida.lock` con el pid del proceso de Next; se libera siempre en `finally`. Segundo `POST /api/corridas` con lock vivo → 409 con la corrida en curso.
- Confirmación de corridas `pendiente-confirmacion` vía `scripts/cs confirmar` (execFile): la app nunca escribe `log.jsonl` por su cuenta.

### Corrida real desde la UI (misma fecha)

`POST /api/corridas {marca: kolareal}` con `CS_RUNNER=real` → `registrada` en 4 min 38 s: 5 entradas, verificada en el intento 2 (`analista:intento-2` + `verificacion:intento-2` visibles en el stepper), `ig.sesion: ok`, lock liberado, Home/histórico refrescados. 3 denegaciones de Bash, todas esperables o recuperadas:
- `ls …` ×1: fuera del prefijo permitido (correcto).
- `scripts/cs registrar … <<'EOF'` ×2: **el heredoc multilínea NO pasa el filtro `Bash(scripts/cs *)`** en `dontAsk`. El tercer intento, con here-string en una sola línea (`scripts/cs registrar … <<< '{…}'`), sí pasó y registró. `promptCorrida` ahora pide explícitamente la forma `<<< '<JSON>'`. CLAUDE.md (paso 5) sigue mostrando la forma heredoc para el modo interactivo; en headless debe usarse here-string.
