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
2b. apify = scripts/cs apify-uso --json                  (decide si Apify entra en esta corrida y con qué resultsLimit)
3. corridaId = el que te dieron o scripts/cs nuevo-id <slug>
4. Workflow scriptPath .claude/workflows/corrida.js — SIEMPRE por scriptPath (por nombre puede resolver un snapshot viejo)
   args: { marca, fechaCorrida (hoy), ultimaCorrida, corridaId, apify: {habilitado, resultsLimit, motivo?},
           competidores: [{nombre, url}] }
   └─ paralelo: rastreador-ig (todos los perfiles, navegador con sesión) + N rastreadores web + rastreador-apify (si habilitado)
      → analista (schema) → verificador (soul.md) → reintento con objeciones, máx. 3
   Devuelve { entradas, verificado, intentos, objeciones?, apify?, ig? }
5. REGISTRO — únicamente con el CLI (nunca edites log.jsonl ni corridas/ a mano):
     scripts/cs registrar --marca <slug> --corrida-id <id> [--modo terminal|ui] [--pendiente|--forzar] <<< '<JSON devuelto por el workflow, en UNA línea>'
   (here-string de una línea; en headless el heredoc multilínea `<<'EOF'` se deniega por el patrón de permisos)
   · verificado:true  → se registra (corrida `registrada` + entradas al log).
   · verificado:false → interactivo: muestra las objeciones al usuario y pregunta; solo con su "sí" usa `--forzar`.
                        MODO HEADLESS: usa `--pendiente` (queda `pendiente-confirmacion`; la app pide confirmación).
6. Cierre: resume los movimientos detectados: qué hicieron y qué significa para nosotros. Tono analítico y frío, español.
```

Si el workflow no está disponible, ejecuta el grafo a mano: rastreadores en paralelo (varias llamadas Agent en un solo mensaje), analista y verificador con el mismo bucle acotado, y registra igual con `scripts/cs registrar`.

## Modo headless
Si el prompt dice **MODO HEADLESS** (la app web lanzó la corrida con `claude -p`): nadie puede responder preguntas → nunca uses AskUserQuestion; no uses Write/Edit; registra siempre con `scripts/cs registrar` (`--pendiente` si el verificador no aprobó tras 3 intentos); si Instagram reporta `SESIÓN NO DISPONIBLE`, sigue con web (+Apify) y déjalo en el JSON (`ig.sesion: "no-disponible"`); termina devolviendo el JSON pedido.

## Sesión de Instagram (Claude in Chrome)
El rastreador-ig usa **Claude in Chrome** (`mcp__claude-in-chrome__*`) sobre el Chrome del usuario, en el perfil donde está instalada la extensión y la cuenta IG dedicada de la agencia ya tiene sesión. No hay perfil de Chrome aparte ni MCP chrome-devtools. En headless el runner pasa `--chrome`. Solo lectura: jamás like/follow/comentario; el agente trabaja en una pestaña propia y la cierra.
Si reporta `SESIÓN NO DISPONIBLE`: dile al usuario que abra Chrome (perfil con la extensión), compruebe que Instagram está logueado y que la extensión Claude in Chrome está conectada. Challenge/captcha → la corrida sigue solo con web (+Apify); no se reintenta en bucle.

## Apify
`rastreador-apify` usa `mcp__apify__apify--instagram-scraper` (free tier $5/mes, ≈$0.0027/resultado). Solo entra si `scripts/cs apify-uso` lo habilita (presupuestos y umbrales en `config.json`; token en `data/secrets.json` o `APIFY_TOKEN`). El coste estimado de cada corrida queda en `corridas/<id>.json`.

## Build & Run
- `npm install` · `cp .env.example .env.local` (rellena `CLAUDE_BIN` absoluto si hace falta) · Chrome abierto con la extensión Claude in Chrome e Instagram logueado
- `npm run dev` → http://localhost:3030 · `./scripts/cs --help`
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
- Valida toda entrada externa en la frontera; los subagentes no escriben archivos.
- Datos inmutables; archivos pequeños (200–400 líneas, 800 máx). Español, tono analítico y frío.
- Trabaja solo dentro de esta carpeta (y la bóveda en `~/SecondBrain`).

## Gotchas
- El campo `marca` de cada Entrada es el **nombre del competidor** (herencia del v1); la marca-carpeta es `slug`. La UI nunca lo llama "marca".
- `Workflow` por nombre puede resolver un snapshot viejo: siempre `scriptPath`.
- En `claude -p --permission-mode dontAsk`, `Bash` se deniega salvo que vaya en `--allowedTools` (`Bash(scripts/cs *)`); un heredoc multilínea no casa con ese patrón → usa here-string `<<< '…'` en una línea.
- Claude in Chrome solo existe si Chrome (perfil con la extensión) está abierto; en `claude -p` hay que pasar `--chrome` o los tools `mcp__claude-in-chrome__*` no aparecen.
