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
if [ -d "/Applications/Google Chrome.app" ]; then ok "Google Chrome instalado"; else warn "Instala Google Chrome (el rastreo de IG usa un perfil dedicado vía MCP chrome-devtools)"; fi

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

echo "4) Sincronización git"
if url="$(git remote get-url origin 2>/dev/null)"; then
  ok "remoto origin: $url"
  git pull --rebase --autostash >/dev/null 2>&1 && ok "git pull --rebase inicial" || warn "git pull --rebase falló (¿sin sesión de gh o conflicto?): resuélvelo antes de correr"
else
  warn "No hay remoto 'origin': sin él los datos no viajan entre Macs (git remote add origin <url-privada>)"
fi

echo "5) Verificación"
npm test --silent >/dev/null 2>&1 && ok "tests en verde" || warn "tests fallaron: revisa 'npm test'"
./scripts/cs marca listar >/dev/null 2>&1 && ok "CLI scripts/cs responde" || warn "scripts/cs no responde"

cat <<'TXT'

Pendiente manual:
  · Sesión de Instagram (una vez): scripts/chrome-ig.sh login → inicia sesión con la cuenta de la agencia y CIERRA esa ventana.
  · Aprueba el MCP chrome-devtools la primera vez que abras 'claude' en este repo (o ya va en .claude/settings.json).
  · Pega el token de Apify en Ajustes (o APIFY_TOKEN en .env.local).
  · Arranca el panel: npm run dev → http://localhost:3030
TXT
