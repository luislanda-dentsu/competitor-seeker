# Competitor-Seeker v2 — Plan de trabajo

Plan completo: `~/.claude/plans/haz-un-levantamiento-completo-async-hejlsberg.md`.
Gates: rama por fase → PR → revisión independiente (`/code-review`) → merge humano.

## Fase 0 — Spike `claude -p` (`spike/claude-p`)
- [x] `scripts/spike-claude-p.sh` ejecutado; `docs/spike-claude-p.md` con los 5 criterios
- [x] Decisión: Workflow en headless FUNCIONA (sin fallback)

## Fase 1 — Scaffold + core + migración + knowledge (`feat/scaffold-core`)
- [x] Monorepo npm workspaces (`apps/web`, `packages/core`), tsconfig.base, vitest
- [x] `create-next-app apps/web` + `shadcn init @coss/style` + `add @coss/ui` + 4 React Bits
- [x] `packages/core`: schemas zod, jsonl, log, corridas, marcas, competidores, migracion, cli
- [x] `scripts/cs migrar kolareal` → `log.jsonl` (16) + `marca.json` + `corridas/2026-08-20-migrada.json`
- [x] CLAUDE.md / agent.md / corrida.js / analista.md reescritos; panelista.md eliminado; rastreador-ig vía Claude in Chrome
- [x] `.env.example`, `.gitattributes` (merge=union), `config.json`, README, setup-maquina.sh
- [x] `~/SecondBrain/projects/competitor-seeker/` + HOME.md; `graphify update .` (1289 nodos)
- [x] `npm test` verde (35) · revisión independiente: 3 ALTA + 5 MEDIA + 5 BAJA → corrigiendo
- [x] PR #1 abierto (https://github.com/luislanda-dentsu/competitor-seeker/pull/1) — pendiente merge del owner
- [ ] PENDIENTE OWNER: `cp docs/claude-settings.json .claude/settings.json` (bloqueado para el agente)
- Paralelizable: subagente A (core + tests) ∥ subagente B (Next + coss + tokens + shell)

## Fase 2 — Shell + Home + Competidor (`feat/ui-home`)   ∥ Fase 3
- [x] AppShell, Sidebar 240/64, Topbar, BrandSwitcher (cookie cs-marca), ThemeToggle, ⌘K
- [x] KPIs, SignalTrendChart, SignalDistribution, FunnelBars, CompetitorCard/Table, RunTimeline
- [x] `/competidores/[slug]`: header, EntryTimeline, SignalStrip, PostMetricsTable; 404 vía proxy.ts
- [x] Estados vacío / loading / error · 47 tests · rama `feat/ui-home`
- [x] Revisión independiente corregida (420345d) · PR #2 abierto (base feat/scaffold-core) — pendiente merge

## Fase 3 — Runner de corridas (`feat/runner`)   ∥ Fase 2
- [x] lib/runs, api/corridas/* (SSE, lock, cancelar, confirmar), CS_RUNNER=mock
- [x] RunLauncher, RunConsole (dark), PhaseStepper, RunHistoryTable, flujo pendiente-confirmación
- [x] E2E real desde la UI: corrida registrada, 5 entradas, verificada en intento 2, 4m38s · rama `feat/runner`
- [x] Revisión independiente corregida (3c19ecd) · PR #3 abierto (base feat/ui-home) — pendiente merge

## Fase 4 — Asistente (`feat/asistente`) — PR #5
- [x] Chat con contexto + `--resume`, artefactos, historial, UI; E2E real de 2 turnos; revisión corregida
- [ ] Bajo: fecha de contexto en chats largos; podar `data/chats-vivos` al borrar chat

## Fase 5 — Apify + uso + notificaciones + Ajustes (`feat/apify-uso`) — PR #4
- [x] Rebaseada sobre main; revisión corregida (notificaciones atómicas con lock y tope)
- [ ] Bajo: archivar marca con corrida en curso → 409; slugs vacíos/repetidos en PUT competidores; deep-merge en PUT config

## Fase 6 — Git sync + onboarding (`feat/git-sync`) — PR #6 (mergear después de #4 y #5)
- [x] git-sync.ts, api/sync, GitSyncStatus, pull/push automáticos, setup-maquina.sh, README
- [x] Revisión corregida: sync solo en main y sin código sin commitear; timeouts; index.lock

## Fase 7 — Pulido + export (`feat/pulido`) — PR #7
- [x] Export HTML por marca; validaciones (archivar 409, slugs, deep-merge config); contexto del asistente; loading; docs
- [x] Revisión independiente corregida
- [ ] Verificar 320 px en navegador
- [ ] Prueba en la 2.ª Mac con `scripts/setup-maquina.sh`
- [ ] Owner: `cp docs/claude-settings.json .claude/settings.json`; token de Apify; invitar a la compañera

## Revisión
- Fase 0–3: hechas y revisadas; corrida real E2E desde la UI OK (5 entradas, verificada en intento 2, 4m38s).
- Lección: `.gitignore` con `data/` ignoraba `apps/web/lib/data` → usar `/data/`. Lección: `git add -A` con worktrees dentro de `.claude/` añade gitlinks → ignorar `.claude/worktrees/`.
- [ ] Pendiente: login IG en el perfil dedicado (`scripts/chrome-ig.sh login`) y corrida real de verificación
- [ ] Pendiente: export HTML (plantilla legacy) sigue mostrando solo movimientos → `feat/export-metricas`

## v2.1 — Panel de actividad + competidor profundo (plan: `~/.claude/plans/1-activa-chrome-dev-glittery-naur.md`)
- [x] Fase 1 `fix/sidebar-reabrir` — botón de expandir visible en todo ≥1024px; botón "Mostrar panel" en el Asistente (verificación visual pendiente)
- [x] Fase 2 `chore/ig-chrome-devtools` — rastreador-ig vuelve a chrome-devtools MCP (perfil dedicado)
- [x] Fase 3 `feat/datos-publicaciones` — Publicacion / PerfilSnapshot / LecturaCompetidor en corridas
- [x] Fase 4 `feat/metricas-agregadas` — core/metricas.ts (ER, cadencia, mix formatos, fallback)
- [x] Fase 5 `feat/periodo` — selector 7/30/90/todo/personalizado
- [x] Fase 6 `feat/panel-actividad` — Resumen con tarjetas por competidor
- [x] Fase 7 `feat/competidor-profundo` — Rendimiento / Publicaciones / Lectura / Estrategia (IA)
- PRs #13–#19; #17–#19 quedaron en la rama base → llevados a main con #20

## v2.2 — Piloto: rediseño AMGC + ajustes 320 px (`feat/rediseno-amgc`)
Base: auditoría del código de Orbit (`~/Claude/Projects/orbit`, 2026-11-05). La estructura de vistas y módulos NO cambia: solo lo visual.
- [x] Tipografía: Gotham Book (texto) + Medium (el «semibold») + Bold puntual, en el repo vía `next/font/local`
- [x] Tokens AMGC: #010101 fondo · #1A1A1A superficie · blanco tinta · naranja acción · verde ok · amarillo aviso · turquesa info; claro y oscuro (oscuro por defecto)
- [x] Acentos por vista con degradado (Resumen naranja→amarillo · Competidores amarillo→verde · Corridas verde→turquesa · Asistente turquesa→blanco · Ajustes naranja→amarillo)
- [x] Superficies planas: radio 14, sin sombras ni bordes, hueco de 8 px, separadores discontinuos, chips teñidos
- [x] Movimiento: anim-in escalonado, barras que crecen, líneas que se dibujan, contadores, SpotlightCard en KPIs, ClickSpark en el botón primario, barrido circular al cambiar de tema
- [x] KPIs compactos «15.5K» (no «15,5 mil»)
- [x] Componentes: sidebar tone-ink, topbar, KPI, tabla, botones, badges/señales, tabs en píldora, selects, gráficos (serie verde + paleta categórica)
- [x] 320 px: tabs de Ajustes (activa visible), tabs de Competidor (indicar que hay más), píldora «verificada · N intentos», «1 intentos»
- [x] `Date.now()` en el prerender de `/`
- [x] Puerto: `next dev` ignoraba `PORT` de `.env.local` y arrancaba en 3000; el script fija `--port 3030` (lo que dicen los docs)
- [ ] Verificación visual (claro/oscuro, 320 px y escritorio) + revisión independiente

## Siguiente (separado, core)
- [x] `fix/seguidores-apify`: las métricas solo cuentan seguidores con `fuente: 'apify'` (corrida parval 2026-11-04-1603 tiene snapshots del navegador)

## v2.3 — Corrida histórica (`feat/corrida-historica`, 2026-11-13)
Objetivo: lanzar desde la app una corrida sobre un periodo pasado (p. ej. nov–dic 2025) con lo cualitativo y las métricas de Apify (oficial), pagando solo los posts de la ventana.
Diseño: el navegador (rastreador-ig) recorre el grid hasta la ventana y entrega las URLs de esos posts; Apify oficial se consulta SOLO con esas URLs (verificado: 2 URLs → 2 resultados cobrados, con likes/comentarios/fecha). Sin seguidores (no relevantes).
- [x] Core: `Corrida.tipo` (`normal|historica`) + `ventana {desde, hasta}`; `ultimaCorrida*` y KPI «última corrida» ignoran las históricas; cobertura de métricas incluye las ventanas históricas
- [x] Core: estimación de coste por ventana (cadencia por competidor de los posts de Apify ya registrados) + tope de posts
- [x] Prompt + workflow: modo histórico (IG → URLs de la ventana → Apify por URL, con tope; web con la ventana; «nuevo» = dentro de la ventana; publicaciones filtradas a la ventana)
- [x] Agentes: rastreador-ig (modo histórico: recorrer grid, localizar límites, `urlsVentana`) y rastreador-apify (modo por URL, sin details)
- [x] API `POST /api/corridas` acepta `ventana` + tope (validado); `GET /api/corridas/estimacion`
- [x] UI: «Periodo pasado» en el lanzador (desde/hasta) con estimación y confirmación de coste antes de lanzar; etiqueta «histórica» en el historial
- [x] Tests (225 en verde), typecheck, lint
- [ ] Revisión independiente
- [ ] Verificación real: lanzar Parval 2025-11-01 → 2025-12-31 desde la app (la owner)

Criterios de aceptación:
1. Lanzar Parval 2025-11-01 → 2025-12-31 registra publicaciones con fecha dentro de esa ventana, con cifras de Apify.
2. Antes de lanzar, la app muestra posts estimados, coste estimado y coste máximo, y pide confirmación.
3. Apify nunca recibe más URLs que el tope confirmado; no se hace la llamada de seguidores.
4. Tras la histórica, la siguiente corrida normal sigue empezando en la última corrida normal (no se mueve la ventana) y la tarjeta «Última corrida» no cambia.
5. Si el navegador no tiene sesión, la corrida sigue solo con web, sin gastar Apify, y lo dice.

## v2.4 — Informe PDF de competidores (2026-11-13)
- [x] Competidores → «Exportar PDF»: abre `/informe?marca=…&<periodo>&imprimir=1` y lanza «Guardar como PDF» del navegador (sin dependencias).
- [x] Portada con comparativo + una ficha por competidor (página nueva): Rendimiento, Publicaciones (tema completo + URL), Lectura, Estrategia (todas las lecturas, sin plegar), Movimientos y Evolución.
- [x] Movimientos y Evolución acotados al periodo por la fecha de cada ENTRADA (una histórica de hoy trae entradas de 2025).
- [x] Papel siempre en claro (tokens propios de `.informe`), shell oculto al imprimir, filas sin partir, cabeceras repetidas.
- [x] Métricas: una histórica rehecha sobre la misma ventana reemplaza la lectura y el punto de serie de la anterior para ese competidor (Excel 12:10 vs 12:40).
- [x] Verificado: PDF real de Parval 01/11–31/12/2025 (18 páginas) con Chrome headless; 235 tests, typecheck y lint en verde.
