#!/usr/bin/env bash
# Onboarding de una Mac nueva para Competitor-Seeker.
# Uso: bash scripts/setup-maquina.sh   (desde la raíz del repo ya clonado)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

echo "Competitor-Seeker · setup de máquina"
echo "1) Herramientas"
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then ok "node $(node -v)"; else fail "Node ≥ 22 requerido (https://nodejs.org)"; exit 1; fi
if command -v claude >/dev/null; then ok "claude $(claude --version 2>/dev/null | head -1)"; else fail "Claude Code no está en el PATH (npm i -g @anthropic-ai/claude-code)"; exit 1; fi
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then ok "gh autenticado"; else warn "gh no autenticado: ejecuta 'gh auth login' para que el sync por git funcione"; fi
if [ -d "/Applications/Google Chrome.app" ]; then ok "Google Chrome instalado"; else warn "Instala Google Chrome y la extensión Claude in Chrome"; fi

echo "2) Dependencias"
npm install --no-fund --no-audit >/dev/null && ok "npm install"

echo "3) Configuración local"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  sed -i '' "s|^CLAUDE_BIN=.*|CLAUDE_BIN=$(command -v claude)|" .env.local
  ok ".env.local creado (CLAUDE_BIN=$(command -v claude))"
else ok ".env.local ya existe"; fi
mkdir -p data && ok "data/ (estado local, gitignored)"
if [ ! -f .claude/settings.json ]; then
  cp docs/claude-settings.json .claude/settings.json && ok ".claude/settings.json creado desde docs/claude-settings.json"
else ok ".claude/settings.json ya existe"; fi

echo "4) Verificación"
npm test --silent >/dev/null 2>&1 && ok "tests en verde" || warn "tests fallaron: revisa 'npm test'"
./scripts/cs marca listar >/dev/null 2>&1 && ok "CLI scripts/cs responde" || warn "scripts/cs no responde"

cat <<'TXT'

Pendiente manual:
  · Abre Chrome, instala/activa la extensión Claude in Chrome y entra en instagram.com con la cuenta dedicada de la agencia.
  · Deja Chrome abierto durante las corridas.
  · Pega el token de Apify en Ajustes (o APIFY_TOKEN en .env.local).
  · Arranca el panel: npm run dev → http://localhost:3030
TXT
