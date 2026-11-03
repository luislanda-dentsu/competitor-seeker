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

## Fase 4 — Asistente (`feat/asistente`)   ∥ Fase 5
- [ ] **PAUSADA 2026-11-03 por cupo.** Trabajo parcial en rama `wip/asistente` (8a1c1db, 11 archivos, SIN verificar). Base: feat/runner antiguo (63e2bdc).
  Para retomar: `git rebase --onto feat/runner 63e2bdc wip/asistente`, revisar qué falta del brief (packages/core/src/chats.ts, lib/chat/{contexto,artifacts}, api/asistente SSE con --resume, UI /asistente, sidebar modo chat), terminar, lint/tsc/vitest/build, E2E mock y real, revisión independiente, PR #4 (base feat/runner).

## Fase 5 — Apify + uso + notificaciones + Ajustes (`feat/apify`)   ∥ Fase 4
- [x] Implementada en `feat/apify` (76153e7, 71 tests, E2E hecho) sobre feat/runner ANTIGUO (63e2bdc)
- [ ] **PENDIENTE**: `git rebase --onto feat/runner 63e2bdc feat/apify` → 2 conflictos conocidos: `apps/web/lib/runs/apify.ts` (F3 usa `decidirApifyDesdeEstado`, F5 usa `obtenerUsoActual` → quedarse con `obtenerUsoActual` y que el CLI `cs apify-uso` también lo use) y `apps/web/lib/runs/runner.ts` (F5 solo añade import + `try { notificarFinCorrida(actualizada) } catch {}` tras `guardarCorrida` en `cerrarCorrida`). Luego lint/tsc/vitest/build, revisión independiente, PR #5 (base feat/runner).

## Fase 6 — Git sync + onboarding (`feat/git-sync`)
- [ ] git-sync.ts, api/sync, GitSyncStatus, pull/push automáticos, setup-maquina.sh, README

## Fase 7 — Pulido + export (`feat/pulido`)
- [ ] Export HTML estático, dark mode, reduced-motion, skeletons, 320px, copy, borrar log.json.migrado

## Estado al pausar (2026-11-03)
Ramas en origin: `main` (baseline) · `feat/scaffold-core` (PR #1) · `feat/ui-home` (PR #2) · `feat/runner` (PR #3) · `feat/apify` (sin PR, rebase pendiente) · `wip/asistente` (parcial).
Orden de merge: #1 → #2 → #3; después rebase de feat/apify y wip/asistente sobre main.
Pendiente del owner: mergear PRs; `cp docs/claude-settings.json .claude/settings.json`; token de Apify en Ajustes; invitar a la compañera al repo.
Próxima sesión (con `/model` Sonnet, un agente a la vez): Fase 5 rebase+PR → Fase 4 terminar → Fase 6 git sync + setup-maquina → Fase 7 pulido.

## Revisión
- Fase 0–3: hechas y revisadas; corrida real E2E desde la UI OK (5 entradas, verificada en intento 2, 4m38s).
- Lección: `.gitignore` con `data/` ignoraba `apps/web/lib/data` → usar `/data/`. Lección: `git add -A` con worktrees dentro de `.claude/` añade gitlinks → ignorar `.claude/worktrees/`.
