# Competitor-Seeker

> Inteligencia competitiva por marca para una agencia de contenido: agentes de Claude Code rastrean competidores, un analista clasifica y un verificador refuta; un panel web local (Next.js) lo muestra y lo opera.
> Categoría: agent-system + web-app · Stack: Claude Code (motor) + Next.js 16 / TS strict / Tailwind v4 / coss-ui + `packages/core` (zod) · Owner: All Media (2 usuarias, 2 Macs, coste 0)

Eres el **orquestador**. Las reglas de fondo viven en `agent.md` (flujo y formato de datos) y `soul.md` (criterio anti-alucinación). No las dupliques: léelas y aplícalas.

---

## ⚡ Operating System — Workflow Orchestration

1. **Plan Mode Default** — plan mode para cualquier tarea no trivial (3+ pasos o decisión de arquitectura). Si algo se tuerce a mitad, para y re-planifica.
2. **Subagent Strategy** — usa subagentes para investigación, exploración y análisis en paralelo; una tarea por subagente.
3. **Self-Improvement Loop** — tras cualquier corrección del owner, registra la lección en la bóveda (ver Knowledge & Memory) y una regla que evite repetirla.
4. **Verification Before Done** — nada está hecho sin prueba: tests, logs, captura. ¿Lo aprobaría un staff engineer?
5. **Demand Elegance (Balanced)** — en cambios no triviales pregúntate si hay una forma más elegante; no sobre-ingenierices lo simple.
6. **Autonomous Bug Fixing** — ante un bug, ve a los logs/tests y arréglalo sin pedir instrucciones.

**🟠 Regla de oro:** sé proactivo, piensa como dueño, actúa como senior. No me hagas repetirme.

## ✅ Task Management
1. Plan en `tasks/todo.md` como ítems marcables antes de codificar. 2. Confirma el plan con el owner. 3. Marca progreso. 4. Resume cada paso. 5. Sección "Revisión" al cerrar. 6. Lecciones → bóveda, no a archivos sueltos. 7. Builds grandes → el owner puede invocar `/mission-control` (nunca lo inicies tú).

## 🧠 Knowledge & Memory — léelo PRIMERO
- **Bóveda (el *porqué*)** → `~/SecondBrain/projects/competitor-seeker/MEMORY.md`: decisiones, glosario, contexto, gotchas. Al aprender algo no obvio, añade una nota de un hecho en `decisions/ | domain/ | context/ | reference/` con `[[wikilinks]]` y una línea en `MEMORY.md`.
- **Grafo de código (el *qué conecta con qué*)** → Graphify. Para "dónde se usa X / cómo fluye Y" ejecuta `/graphify query "…"` antes de leer archivos. Refresca con `/graphify . --update`; en clon nuevo `/graphify . --obsidian`. `graphify-out/` está gitignored.

Regla: pregunta de código → graphify primero. Pregunta de "por qué / plan / término" → bóveda primero.

## 🔌 Skill Discovery (sin excederse)
Antes de construir a mano algo común (tests, deploy, diseño, review), busca si ya hay skill: `npx skills find <query>` / skill **find-skills**. Solo cuando falte claramente una capacidad.

## 🌿 Git & Parallelization
- `main` es trunk y siempre desplegable. **Nunca commits directos a `main`.**
- Una unidad de trabajo → una rama (`feat/`, `fix/`, `chore/`, `refactor/<slug>`) → un PR pequeño (qué/por qué + test plan + criterios de aceptación). **Mergea un humano** con tests en verde.
- Modo elegido: **una sesión con subagentes** (un solo escritor del working tree). Si algún día se divide en varias sesiones: `git worktree add ../competitor-seeker-wt/<slug> -b feat/<slug>`, archivos disjuntos por sesión. `*-wt/` y `.worktrees/` están gitignored.
- Los datos (`marcas/`, `config.json`) se sincronizan por git entre las dos Macs: `log.jsonl` usa `merge=union` (`.gitattributes`).

## 🚦 Delivery — SAW nivel 1
Aplica por unidad de trabajo cuando toca `main`, tiene efectos externos o es no trivial. **Stop-the-line**: sin criterios de aceptación no se empieza. **Verificación independiente**: quien implementa no se aprueba a sí mismo (subagente revisor fresco o humano). **Evidencia antes de "hecho"**. Cadena: implementador → revisión → PR/CI → humano → merge.

---

## Estructura

```
marcas/<slug>/marca.json        ← marca + lista de vigilancia (competidores activos)
marcas/<slug>/log.jsonl         ← histórico append-only, una Entrada por línea (SOLO lo escribe scripts/cs)
marcas/<slug>/corridas/<id>.json← meta de cada corrida (intentos, verificado, objeciones, fuentes, apify)
data/                           ← estado local, no sincronizado (lock, streams, chats, notificaciones, secrets)
config.json                     ← presupuestos Apify y umbrales (sincronizado)
packages/core                   ← schemas zod + I/O + CLI `scripts/cs` + runner headless
apps/web                        ← panel Next.js (Home · Competidor · Asistente · Corridas · Ajustes)
.claude/agents, .claude/workflows/corrida.js, agent.md, soul.md ← el motor
```

Una corrida siempre es PARA UNA MARCA. Si no te la indican y hay varias en `marcas/`, pregunta (o corre todas si lo piden explícitamente, una corrida por marca). **Alta de marca**: `scripts/cs marca crear --nombre "<Nombre>"` y luego añadir competidores en `marca.json` (o desde Ajustes en la app).

## El grafo de una corrida

```
1. lee marcas/<slug>/marca.json → competidores activos  (no existe → avisa y detente)
2. ultimaCorrida = scripts/cs ultima-corrida <slug>      (null → primera corrida: últimas ~4 semanas)
   ultimaCorridaIg = scripts/cs ultima-corrida <slug> --fuente ig  (inicio de la ventana de Instagram)
2b. apify = el que te dieron en el prompt (la app ya lo decidió con la usuaria) o, si no, scripts/cs apify-uso --json
3. corridaId = el que te dieron o scripts/cs nuevo-id <slug>
4. Workflow scriptPath .claude/workflows/corrida.js — SIEMPRE por scriptPath (por nombre puede resolver un snapshot viejo)
   args: { marca, fechaCorrida (hoy), ultimaCorrida, ultimaCorridaIg, corridaId, apify: {habilitado, resultsLimit, motivo?, topePosts?},
           ventana?: {desde, hasta} (solo corrida histórica), competidores: [{nombre, url}] }
   └─ paralelo: rastreador-ig (todos los perfiles, navegador con sesión) + N rastreadores web + rastreador-apify (si habilitado)
      → analista (schema) → verificador (soul.md) → reintento con objeciones, máx. 3
   Devuelve { entradas, verificado, intentos, objeciones?, apify?, ig?, publicaciones, perfiles, lecturas }
5. REGISTRO — únicamente con el CLI (nunca edites log.jsonl ni corridas/ a mano):
     scripts/cs registrar --marca <slug> --corrida-id <id> [--modo terminal|ui] [--pendiente|--forzar] --desde-workflow <output_file del Workflow>
   (lee el `.result` del archivo de salida del workflow; nunca pegues el JSON en la línea de comando: en headless el filtro de permisos lo rechaza)
   · verificado:true  → se registra (corrida `registrada` + entradas al log).
   · verificado:false → interactivo: muestra las objeciones al usuario y pregunta; solo con su "sí" usa `--forzar`.
                        MODO HEADLESS: usa `--pendiente` (queda `pendiente-confirmacion`; la app pide confirmación).
6. Cierre: resume los movimientos detectados: qué hicieron y qué significa para nosotros. Tono analítico y frío, español.
```

Si el workflow no está disponible, ejecuta el grafo a mano: rastreadores en paralelo (varias llamadas Agent en un solo mensaje), analista y verificador con el mismo bucle acotado, y registra igual con `scripts/cs registrar`.

## Corrida histórica (periodo pasado)
Desde Corridas → «Periodo pasado» (o el prompt con `ventana`). El rastreador-ig baja por el grid y entrega las URLs de la ventana; Apify se consulta **solo con esas URLs** (un resultado por URL, hasta `topePosts`, sin seguidores) en vez de todo lo publicado hasta hoy. La app estima posts/coste (`GET /api/corridas/estimacion`) y pide confirmación antes de lanzar. Se registra con `tipo: "historica"` + `ventana`: no mueve `ultimaCorrida` ni la tarjeta «Última corrida». Sin sesión de IG no gasta Apify. Ventana máx. 92 días, terminada antes de hoy.

## Modo headless
Si el prompt dice **MODO HEADLESS** (la app web lanzó la corrida con `claude -p`): nadie puede responder preguntas → nunca uses AskUserQuestion; no uses Write/Edit; registra siempre con `scripts/cs registrar … --desde-workflow <output_file>` (`--pendiente` si el verificador no aprobó tras 3 intentos); no re-decidas Apify: viene decidido en el prompt; si Instagram reporta `SESIÓN NO DISPONIBLE`, sigue con web (+Apify) y déjalo en el JSON (`ig.sesion: "no-disponible"`); termina devolviendo el JSON pedido.

## Sesión de Instagram (Claude in Chrome)
El rastreador-ig usa el **MCP chrome-devtools** (`mcp__chrome-devtools__*`, definido en `.mcp.json` → `scripts/chrome-ig.sh mcp`) sobre un **perfil de Chrome dedicado** (`CS_CHROME_PROFILE` o `~/.competitor-seeker/chrome-profile`) donde la cuenta IG de la agencia tiene sesión. Login una vez por Mac: `scripts/chrome-ig.sh login` (o Ajustes → Abrir Instagram) y cerrar esa ventana. Claude in Chrome ya no se usa (el runner no pasa `--chrome`). Solo lectura: jamás like/follow/comentario; el agente abre su propia página y la cierra.
Si reporta `SESIÓN NO DISPONIBLE`: dile al usuario que cierre el Chrome dedicado si está abierto (SingletonLock) y, si IG pide login, rehaga `scripts/chrome-ig.sh login`. Challenge/captcha → la corrida sigue solo con web (+Apify); no se reintenta en bucle.

## Apify
**Apify es la única fuente de cifras** (likes, comentarios, vistas, seguidores; decisión del owner 2026-11-04): el navegador solo aporta existencia, URL, fecha, formato y caption, y el workflow descarta cualquier cifra suya. Sin Apify, los posts quedan sin cifras (ER «—»), nunca con cifras del navegador. `rastreador-apify` usa `mcp__apify__apify--instagram-scraper` (free tier $5/mes, ≈$0.0027/resultado). Solo entra si `scripts/cs apify-uso` lo habilita (presupuestos y umbrales en `config.json`; token en `data/secrets.json` o `APIFY_TOKEN`). El coste estimado de cada corrida queda en `corridas/<id>.json`.

## Build & Run
- `npm install` · `cp .env.example .env.local` (rellena `CLAUDE_BIN` absoluto si hace falta) · una vez: `scripts/chrome-ig.sh login` (perfil dedicado con IG logueado) y cerrar esa ventana
- Desarrollo: `npm run dev` → http://localhost:3040 (con `CS_AUTH=off` en `.env.local`: sin login, solo local) · `./scripts/cs --help`
- **Web (v2.5)**: la plataforma se sirve en https://competitorseeker.luislandadentsu.workers.dev desde una **copia de servicio** aparte (`~/Claude/Projects/competitor-seeker-servidor`, siempre en `main`) con `scripts/servidor.sh instalar|actualizar|estado` (next start :3030 + cloudflared como LaunchAgents). La puerta es el Worker de `infra/puerta` (Workers VPC → túnel de cada Mac; `scripts/puerta.sh`). Login Google + `usuarios.json`. Paso a paso: `docs/setup-mac.md`.
- Segunda Mac: `scripts/setup-maquina.sh`

## Test
- `npm test` (vitest: core + web) · `npm run typecheck` · `npm run lint`. Corre el smoke test antes de afirmar que algo funciona.

## Architecture
- Entrada: la app (`apps/web/app/api/corridas`) o la terminal lanza `claude -p` con `packages/core/src/claude/runner.ts`; el orquestador (este archivo) ejecuta el workflow; `scripts/cs registrar` persiste.
- Fronteras validadas con zod (`packages/core/src/schemas`): Entrada, Corrida, Marca, ConfigCompartida. El workflow valida la salida del analista/verificador con JSON Schema.
- La app solo lee archivos vía `@competitor-seeker/core`; el estado vivo (stream, lock, chats) vive en `data/`.
- Config externalizada: `config.json` (compartida), `.env.local` + `data/secrets.json` (local). Nunca hardcodees rutas de usuario.

## Critical Rules
- `log.jsonl` es **append-only** y lo escribe solo `scripts/cs registrar`. Nunca borres ni reescribas histórico; una baja de marca la archiva (`marcas/_archivo/`), no la borra.
- Nunca commitees secretos (`data/`, `.env*` están gitignored). Nunca push/publicación/borrado sin aprobación del owner.
- La app está expuesta a internet: todo route handler nuevo empieza con `exigirUsuario()` (admin si toca secretos/config), y cualquier ruta nueva con secretos se añade a los `deny` de `.claude/settings.headless.json`. Los agentes headless pasan además por el hook `scripts/hooks/guardia-agentes.mjs` (listas blancas: herramientas de chrome-devtools sin parámetros de archivo y solo Instagram; WebFetch sin `file:`/localhost/LAN, también por DNS; Read/Grep/Glob de la corrida solo dentro del repo sin `data/`/`.env*`/settings; asistente solo `marcas/` y `soul.md`; falla cerrado) y el navegador solo alcanza dominios de Instagram (`--allowedUrlPattern` en `scripts/chrome-ig.sh`, MCP fijado a 1.13.0): si un agente necesita más, se amplía ahí con test.
- Valida toda entrada externa en la frontera; los subagentes no escriben archivos.
- Datos inmutables; archivos pequeños (200–400 líneas, 800 máx). Español, tono analítico y frío.
- Trabaja solo dentro de esta carpeta (y la bóveda en `~/SecondBrain`).

## Gotchas
- El campo `marca` de cada Entrada es el **nombre del competidor** (herencia del v1); la marca-carpeta es `slug`. La UI nunca lo llama "marca".
- `Workflow` por nombre puede resolver un snapshot viejo: siempre `scriptPath`.
- En `claude -p --permission-mode dontAsk`, `Bash` se deniega salvo que vaya en `--allowedTools` (`Bash(scripts/cs *)`); con un JSON largo en la línea (heredoc o here-string) el filtro también deniega → `--desde-workflow <archivo>`.
- El login del perfil dedicado debe hacerse con `scripts/chrome-ig.sh login` (lanza Chrome con `--use-mock-keychain --password-store=basic`, como Puppeteer); un login con Chrome normal cifra las cookies con el llavero real y el MCP no ve la sesión.
- chrome-devtools-mcp: `--isolated` y `--user-data-dir` son excluyentes (no los combines). Si el perfil dedicado está abierto en otra ventana, el MCP no puede lanzar Chrome → `SESIÓN NO DISPONIBLE`. Los tools solo aparecen si el servidor está aprobado (`enabledMcpjsonServers` en `.claude/settings.json`).
