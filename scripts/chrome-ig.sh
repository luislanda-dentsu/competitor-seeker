#!/usr/bin/env bash
# Chrome dedicado para el rastreo de Instagram (MCP chrome-devtools).
#   scripts/chrome-ig.sh mcp     → arranca chrome-devtools-mcp sobre el perfil dedicado (lo usa .mcp.json)
#   scripts/chrome-ig.sh login   → abre ese perfil en instagram.com para iniciar sesión (una vez por Mac)
# El perfil vive fuera del repo: CS_CHROME_PROFILE o ~/.competitor-seeker/chrome-profile.
# Gotcha: si el perfil está abierto (login), ciérralo antes de una corrida: su SingletonLock
# impide que el MCP lance el navegador.
set -euo pipefail
PERFIL="${CS_CHROME_PROFILE:-$HOME/.competitor-seeker/chrome-profile}"
mkdir -p "$PERFIL"

case "${1:-mcp}" in
  mcp)
    # Sin --isolated: es excluyente con --user-data-dir en chrome-devtools-mcp.
    # Versión fijada (no @latest). Red del navegador limitada a Instagram y sus CDN
    # (--allowedUrlPattern, Chrome 149+): un texto inyectado no puede llevarlo a localhost,
    # a la red local ni a otra web. Sin navegación a file:. Ver scripts/hooks/guardia-agentes.mjs.
    exec npx -y chrome-devtools-mcp@1.13.0 --user-data-dir="$PERFIL" --channel=stable \
      --fileNavigations=false \
      --allowedUrlPattern='https://instagram.com/*' \
      --allowedUrlPattern='https://*.instagram.com/*' \
      --allowedUrlPattern='https://*.cdninstagram.com/*' \
      --allowedUrlPattern='https://*.fbcdn.net/*' \
      --allowedUrlPattern='https://*.facebook.com/*'
    ;;
  login)
    # Mismos flags de cifrado que Puppeteer (chrome-devtools-mcp): sin ellos las cookies se cifran
    # con el llavero real y el Chrome del MCP (--use-mock-keychain) no puede leerlas → sin sesión.
    open -na "Google Chrome" --args --user-data-dir="$PERFIL" --no-first-run \
      --use-mock-keychain --password-store=basic "https://www.instagram.com/"
    echo "Perfil dedicado abierto ($PERFIL). Inicia sesión con la cuenta de la agencia y CIERRA esa ventana de Chrome antes de correr."
    ;;
  ruta)
    echo "$PERFIL"
    ;;
  *)
    echo "uso: $0 [mcp|login|ruta]" >&2
    exit 2
    ;;
esac
