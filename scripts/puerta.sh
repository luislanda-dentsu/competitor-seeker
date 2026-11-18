#!/usr/bin/env bash
# Puerta de Cloudflare (infra/puerta): alta de una Mac y despliegue del Worker.
# Se ejecuta en la Mac que tiene `wrangler login` hecho con la cuenta de Cloudflare del equipo (la de Orbit).
#
#   scripts/puerta.sh alta-mac <MAC_LUIS|MAC_COMPANERA> <archivo-token>
#       crea el túnel cs-<mac> + su servicio VPC (→ 127.0.0.1:3030: la app solo escucha en IPv4; con
#       `localhost` cloudflared prueba antes [::1] y cada petición deja un ERR de conexión rechazada), guarda el token del túnel
#       en <archivo-token> (600) y deja el service_id en infra/puerta/wrangler.jsonc
#   scripts/puerta.sh desplegar          ← npx wrangler deploy de infra/puerta
#   scripts/puerta.sh secreto-interno    ← sube CS_SECRETO_INTERNO (de .env.local) como secreto del Worker
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUERTA="$ROOT/infra/puerta"
WRANGLER=(npx --yes wrangler@4.162.0)
CUENTA="${CS_CF_CUENTA:-4e537cbdbaa17503a88fe14c38353375}"

fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }

oauth() { grep -E '^oauth_token' "$HOME/Library/Preferences/.wrangler/config/default.toml" | cut -d'"' -f2; }

case "${1:-}" in
  alta-mac)
    mac="${2:-}"; destino="${3:-}"
    [[ "$mac" == MAC_LUIS || "$mac" == MAC_COMPANERA ]] || fail "uso: alta-mac <MAC_LUIS|MAC_COMPANERA> <archivo-token>"
    [ -n "$destino" ] || fail "falta el archivo donde guardar el token del túnel"
    nombre="cs-mac-$(echo "${mac#MAC_}" | tr '[:upper:]' '[:lower:]')"
    cd "$PUERTA"
    id="$("${WRANGLER[@]}" tunnel list 2>/dev/null | awk -v n="$nombre" '$0 ~ n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9a-f-]{36}$/) print $i}' | head -1)"
    if [ -z "$id" ]; then
      id="$("${WRANGLER[@]}" tunnel create "$nombre" 2>&1 | awk '/^ID:/{print $2}')"
      [ -n "$id" ] || fail "no se pudo crear el túnel $nombre"
      ok "túnel $nombre creado ($id)"
    else ok "túnel $nombre ya existe ($id)"; fi
    servicio="$("${WRANGLER[@]}" vpc service create "$nombre-web" --type http --tunnel-id "$id" --ipv4 127.0.0.1 --http-port 3030 2>&1 | awk '/Created VPC service:/{print $NF}')"
    [ -n "$servicio" ] || fail "no se pudo crear el servicio VPC (¿ya existe? wrangler vpc service list)"
    ok "servicio VPC $nombre-web ($servicio)"
    umask 077
    curl -fsS -H "Authorization: Bearer $(oauth)" \
      "https://api.cloudflare.com/client/v4/accounts/$CUENTA/cfd_tunnel/$id/token" \
      | python3 -c 'import json,sys; r=json.load(sys.stdin); assert r["success"], r["errors"]; sys.stdout.write(r["result"])' >"$destino"
    ok "token del túnel guardado en $destino (pásalo a esa Mac como data/cloudflared-token; no por chat ni correo)"
    python3 - "$PUERTA/wrangler.jsonc" "$mac" "$servicio" <<'PY'
import re, sys
ruta, mac, servicio = sys.argv[1:]
s = open(ruta).read()
linea = f'{{ "binding": "{mac}", "service_id": "{servicio}" }}'
if f'"binding": "{mac}"' in s:
    s = re.sub(r'\{ "binding": "%s", "service_id": "[^"]*" \}' % mac, linea, s)
else:
    s = s.replace('"vpc_services": [\n', '"vpc_services": [\n    ' + linea + ',\n', 1)
open(ruta, 'w').write(s)
PY
    ok "infra/puerta/wrangler.jsonc actualizado ($mac). Ahora: scripts/puerta.sh desplegar"
    ;;
  desplegar)
    cd "$PUERTA"
    grep -q REEMPLAZAR wrangler.jsonc && fail "wrangler.jsonc aún tiene un service_id sin rellenar (alta-mac primero)"
    "${WRANGLER[@]}" deploy
    ;;
  secreto-interno)
    v="$(grep -E '^CS_SECRETO_INTERNO=' "$ROOT/.env.local" | tail -1 | cut -d= -f2-)"
    [ -n "$v" ] || fail "falta CS_SECRETO_INTERNO en .env.local (openssl rand -hex 32)"
    cd "$PUERTA" && printf '%s' "$v" | "${WRANGLER[@]}" secret put CS_SECRETO_INTERNO
    ;;
  *) sed -n '2,11p' "$0"; exit 1 ;;
esac
