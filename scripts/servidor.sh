#!/usr/bin/env bash
# Servicio web de Competitor-Seeker en una Mac (v2.5): la app en producción (localhost:3030)
# + el conector de Cloudflare Tunnel, ambos como LaunchAgents (arrancan al iniciar sesión,
# se reinician si caen) y con caffeinate para que la Mac no duerma mientras sirve.
#
# Se ejecuta DESDE LA COPIA DE SERVICIO (clon aparte, fijo en main), nunca desde la de desarrollo.
#
#   scripts/servidor.sh comprobar      ← verifica .env.local, rama y token del túnel
#   scripts/servidor.sh instalar       ← build + LaunchAgents (app y túnel) y arranque
#   scripts/servidor.sh actualizar     ← git pull (main) + npm ci + build + reinicio de la app
#   scripts/servidor.sh estado | logs | detener
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_LABEL="com.allmedia.competitor-seeker.web"
TUNEL_LABEL="com.allmedia.competitor-seeker.tunel"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$ROOT/data/logs"
TOKEN_FILE="$ROOT/data/cloudflared-token"
CLOUDFLARED="${CS_CLOUDFLARED:-$HOME/.competitor-seeker/bin/cloudflared}"
PUERTO=3030

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }

valor_env() { grep -E "^$1=" .env.local 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

comprobar() {
  echo "Comprobando la copia de servicio ($ROOT)"
  [ -f .env.local ] || fail "falta .env.local (cp .env.example .env.local y rellénalo)"
  for v in AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET AUTH_URL CS_ADMIN_EMAIL; do
    [ -n "$(valor_env "$v")" ] || fail "falta $v en .env.local (sin login la app no se publica)"
  done
  [ "$(valor_env CS_AUTH)" != "off" ] || fail "CS_AUTH=off es solo para desarrollo: quítalo de la copia de servicio"
  ! grep -qE '^CS_AUTH=off' .env 2>/dev/null || fail "CS_AUTH=off en .env: quítalo de la copia de servicio"
  chmod 600 .env.local; [ -f data/secrets.json ] && chmod 600 data/secrets.json
  ok ".env.local y data/secrets.json solo legibles por ti (600)"
  [ "$(valor_env AUTH_SECRET | tr -d '\n' | wc -c | tr -d ' ')" -ge 32 ] || fail "AUTH_SECRET demasiado corto (openssl rand -hex 32)"
  ok "login configurado ($(valor_env AUTH_URL))"
  local rama; rama="$(git rev-parse --abbrev-ref HEAD)"
  [ "$rama" = "main" ] || fail "la copia de servicio debe estar en main (está en $rama)"
  ok "rama main"
  command -v node >/dev/null || fail "node no está en el PATH"
  ok "node $(node -v) en $(command -v node)"
  [ -x "$CLOUDFLARED" ] || fail "no encuentro cloudflared en $CLOUDFLARED (ver docs/setup-mac.md)"
  ok "cloudflared $("$CLOUDFLARED" --version | awk '{print $3}')"
  [ -s "$TOKEN_FILE" ] || fail "falta el token del túnel en data/cloudflared-token (ver docs/setup-mac.md)"
  chmod 600 "$TOKEN_FILE"
  ok "token del túnel (data/cloudflared-token, 600)"
}

compilar() {
  echo "Instalando dependencias y compilando"
  npm ci --no-fund --no-audit >/dev/null
  ok "npm ci"
  npm run build >"$LOGS/build.log" 2>&1 || { tail -30 "$LOGS/build.log"; fail "falló el build (data/logs/build.log)"; }
  ok "next build"
}

plist_app() {
  local node_bin; node_bin="$(command -v node)"
  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$APP_LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/caffeinate</string><string>-i</string><string>-s</string>
    <string>$node_bin</string><string>$ROOT/node_modules/next/dist/bin/next</string>
    <string>start</string><string>--port</string><string>$PUERTO</string><string>--hostname</string><string>127.0.0.1</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT/apps/web</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$(dirname "$node_bin"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key><string>production</string>
    <key>CS_REPO_ROOT</key><string>$ROOT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$LOGS/web.log</string>
  <key>StandardErrorPath</key><string>$LOGS/web.log</string>
</dict></plist>
PLIST
}

plist_tunel() {
  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$TUNEL_LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$CLOUDFLARED</string><string>tunnel</string><string>--no-autoupdate</string>
    <string>--protocol</string><string>quic</string><string>run</string>
    <string>--token-file</string><string>$TOKEN_FILE</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$LOGS/tunel.log</string>
  <key>StandardErrorPath</key><string>$LOGS/tunel.log</string>
</dict></plist>
PLIST
}

cargar() { # label plist
  local destino="$AGENTS/$1.plist"
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  printf '%s\n' "$2" >"$destino"
  plutil -lint "$destino" >/dev/null || fail "plist inválido: $destino"
  launchctl bootstrap "gui/$(id -u)" "$destino"
  ok "$1 cargado"
}

esperar_app() {
  for _ in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:$PUERTO/api/salud" >/dev/null 2>&1 && { ok "la app responde en localhost:$PUERTO"; return 0; }
    sleep 1
  done
  tail -30 "$LOGS/web.log" || true
  fail "la app no responde tras 60 s (data/logs/web.log)"
}

mkdir -p "$LOGS" "$AGENTS"
case "${1:-}" in
  comprobar) comprobar ;;
  instalar)
    comprobar
    if lsof -nP -iTCP:$PUERTO -sTCP:LISTEN >/dev/null 2>&1 && ! launchctl print "gui/$(id -u)/$APP_LABEL" >/dev/null 2>&1; then
      fail "el puerto $PUERTO está ocupado (¿un 'npm run dev' antiguo? el desarrollo usa ahora el 3040)"
    fi
    compilar
    cargar "$APP_LABEL" "$(plist_app)"
    esperar_app
    cargar "$TUNEL_LABEL" "$(plist_tunel)"
    echo "Listo. Abre $(valor_env AUTH_URL)"
    ;;
  actualizar)
    comprobar
    git pull --ff-only origin main
    compilar
    launchctl kickstart -k "gui/$(id -u)/$APP_LABEL"
    esperar_app
    ;;
  estado)
    for l in "$APP_LABEL" "$TUNEL_LABEL"; do
      if launchctl print "gui/$(id -u)/$l" >/dev/null 2>&1; then
        ok "$l: $(launchctl print "gui/$(id -u)/$l" | awk -F'= ' '/state =/{print $2; exit}')"
      else warn "$l: no instalado"; fi
    done
    curl -fsS "http://127.0.0.1:$PUERTO/api/salud" >/dev/null 2>&1 && ok "app responde" || warn "la app no responde"
    ;;
  logs) tail -n 50 -f "$LOGS/web.log" "$LOGS/tunel.log" ;;
  detener)
    for l in "$APP_LABEL" "$TUNEL_LABEL"; do launchctl bootout "gui/$(id -u)/$l" 2>/dev/null && ok "$l detenido" || true; done
    ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
