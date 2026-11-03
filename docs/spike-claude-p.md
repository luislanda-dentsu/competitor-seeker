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
