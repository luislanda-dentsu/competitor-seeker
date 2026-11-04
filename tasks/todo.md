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
- [ ] Pendiente: export HTML (plantilla legacy) sigue mostrando solo movimientos
