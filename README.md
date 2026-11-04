# Competitor-Seeker

Inteligencia competitiva por marca para una agencia de contenido. Agentes de Claude Code (rastreador de Instagram con navegador, rastreadores web, rastreador Apify, analista y verificador) detectan qué están haciendo los competidores y qué tan bien les funciona; un panel web local lo muestra, lanza corridas, conversa sobre los hallazgos y sincroniza los datos entre las Macs del equipo por git. Coste de operación: 0 (suscripción de Claude Code + free tiers).

## Requisitos
- Node ≥ 22, npm ≥ 10
- Claude Code instalado y logueado (`claude --version`)
- `gh` autenticado (sync por GitHub)
- Google Chrome. El rastreador de IG usa el MCP **chrome-devtools** sobre un perfil dedicado (`~/.competitor-seeker/chrome-profile`) con la cuenta IG de la agencia logueada

## Arranque
```bash
npm install
cp .env.example .env.local        # ajusta CLAUDE_BIN si hace falta
./scripts/cs marca listar         # ver marcas
npm run dev                       # http://localhost:3030
```
Segunda máquina: `scripts/setup-maquina.sh` (clona, instala, crea `.env.local` y comprueba `claude`/`gh`).

Sesión de Instagram (una vez por máquina): `scripts/chrome-ig.sh login`, inicia sesión con la cuenta dedicada y cierra esa ventana (durante la corrida el MCP lanza el perfil por su cuenta).

## Primer uso
1. Clona el repo privado: `git clone <url-del-repo> competitor-seeker && cd competitor-seeker`.
2. Ejecuta `scripts/setup-maquina.sh` (instala dependencias, crea `.env.local` y comprueba `claude` y `gh`), luego `npm run dev`.
3. Comprueba que el Chrome dedicado tiene sesión en Instagram (`scripts/chrome-ig.sh login`) y que esa ventana está cerrada antes de correr.
4. En **Ajustes**, pega el token de Apify (opcional: sin él la corrida usa solo el rastreo con navegador y web).
5. En **Corridas**, elige la marca y lanza la primera corrida; al terminar, los hallazgos aparecen en el Resumen.

## Cómo funciona una corrida
1. La app (o tú, en la terminal con `claude`) pide "corre la marca X".
2. El orquestador (`CLAUDE.md`) lanza `.claude/workflows/corrida.js`: rastreadores en paralelo → analista → verificador (máx. 3 intentos).
3. El resultado se registra con `scripts/cs registrar` en `marcas/<slug>/corridas/<id>.json` y, si fue verificado, en `marcas/<slug>/log.jsonl` (append-only).
4. La app hace commit + push de `marcas/` y la otra Mac lo recibe al abrir el panel.

## Estructura
```
apps/web          panel Next.js 16 (coss/ui + React Bits + Recharts)
packages/core     schemas zod, I/O de datos, CLI `scripts/cs`, runner headless, git sync, apify
marcas/<slug>     marca.json · log.jsonl · corridas/*.json   (datos, sincronizados)
data/             lock, streams, chats, notificaciones, secrets (local, gitignored)
.claude/          agentes y workflow del motor
docs/             spike headless, panel legacy
```

## Sincronización entre Macs

- Los datos (`marcas/**` y `config.json`) viajan por el repo privado `origin`; `data/` y `.env.local` son locales.
- Se hace `pull --rebase` al abrir la Home (máx. 1/min) y antes de cada corrida, y `commit + push` al cerrarla o tras cambiar ajustes. `CS_SYNC_AUTO=0` lo deja solo manual.
- `log.jsonl` usa `merge=union` y cada corrida es un archivo con hostname en el id, así que dos Macs rara vez chocan.
- La píldora de git del Topbar muestra el estado y permite "Sincronizar ahora"; `GET/POST /api/sync` expone lo mismo.
- Si hay conflicto (p. ej. `marca.json` editado en ambas): `git pull --rebase`, edita, `git rebase --continue`.

## Scripts
- `npm run dev | build | test | typecheck | lint`
- `./scripts/cs registrar|confirmar|migrar|ultima-corrida|nuevo-id|marca|apify-uso|config`
- `./scripts/spike-claude-p.sh` — verifica que el workflow corre en headless

## Reglas
- `log.jsonl` nunca se edita a mano ni se reescribe.
- Ramas `feat/*` → PR → revisión → merge humano. `main` siempre desplegable.
- La bóveda de memoria del proyecto vive en `~/SecondBrain/projects/competitor-seeker/`.
