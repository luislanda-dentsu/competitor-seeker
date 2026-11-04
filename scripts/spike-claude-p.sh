#!/usr/bin/env bash
# Fase 0 — Spike: ¿corre el workflow de corrida bajo `claude -p` (headless)?
# No registra nada: solo lanza el workflow para UN competidor y vuelca el stream.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="docs/spike"
mkdir -p "$OUT"
FECHA="$(date +%F)"
PROMPT="MODO SPIKE HEADLESS (nadie puede responder preguntas; no uses AskUserQuestion). \
Lanza el workflow .claude/workflows/corrida.js por scriptPath (scriptPath: \".claude/workflows/corrida.js\") con args \
{\"marca\":\"kolareal\",\"fechaCorrida\":\"$FECHA\",\"ultimaCorrida\":\"2026-08-20\",\"competidores\":[{\"nombre\":\"Country Club RD\",\"url\":\"https://www.instagram.com/countryclubrd/\"}]}. \
NO registres nada en log.json ni toques index.html: este es un spike. Cuando el workflow termine, devuelve como respuesta final SOLO el JSON {verificado, intentos, entradas: <n entradas>, igSesion: \"ok\"|\"no-disponible\"|\"desconocido\"}."
SCHEMA='{"type":"object","properties":{"verificado":{"type":"boolean"},"intentos":{"type":"integer"},"entradas":{"type":"integer"},"igSesion":{"type":"string"}},"required":["verificado","intentos","entradas","igSesion"]}'
echo "[spike] inicio $(date -Is)" | tee "$OUT/stderr.log"
set +e
claude -p "$PROMPT" \
  --output-format stream-json --verbose --include-partial-messages --forward-subagent-text \
  --permission-mode dontAsk --permission-prompts none \
  --settings .claude/settings.headless.json \
  --allowedTools "Workflow" "Agent" "Read" "Grep" "Glob" "WebSearch" "WebFetch" "mcp__chrome-devtools__*" "mcp__apify__*" \
  --json-schema "$SCHEMA" \
  --name "spike claude -p" \
  > "$OUT/salida.jsonl" 2>> "$OUT/stderr.log"
CODE=$?
set -e
echo "[spike] fin $(date -Is) exit=$CODE" | tee -a "$OUT/stderr.log"
echo "--- resumen ---"
echo "líneas stream: $(wc -l < "$OUT/salida.jsonl")"
echo "tool_use Workflow: $(grep -c '"name":"Workflow"' "$OUT/salida.jsonl" || true)"
echo "tool_use Agent: $(grep -c '"name":"Agent"' "$OUT/salida.jsonl" || true)"
echo "chrome-devtools: $(grep -c 'mcp__chrome-devtools__' "$OUT/salida.jsonl" || true)"
echo "apify: $(grep -c 'mcp__apify__' "$OUT/salida.jsonl" || true)"
echo "denegaciones: $(grep -ciE 'permission|denied|not allowed' "$OUT/salida.jsonl" || true)"
echo "result:"; grep '"type":"result"' "$OUT/salida.jsonl" | tail -1 | cut -c1-1500
exit $CODE
