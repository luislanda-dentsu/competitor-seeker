# Competitor-Seeker v2 — Plan de trabajo

Plan completo: `~/.claude/plans/haz-un-levantamiento-completo-async-hejlsberg.md`.
Gates: rama por fase → PR → revisión independiente (`/code-review`) → merge humano.

## Fase 0 — Spike `claude -p` (`spike/claude-p`)
- [x] `scripts/spike-claude-p.sh` ejecutado; `docs/spike-claude-p.md` con los 5 criterios
- [x] Decisión: Workflow en headless FUNCIONA (sin fallback)

## Fase 1 — Scaffold + core + migración + knowledge (`feat/scaffold-core`)
- [ ] Monorepo npm workspaces (`apps/web`, `packages/core`), tsconfig.base, vitest
- [ ] `create-next-app apps/web` + `shadcn init @coss/style` + `add @coss/ui` + 4 React Bits
- [ ] `packages/core`: schemas zod, jsonl, log, corridas, marcas, competidores, migracion, cli
- [ ] `scripts/cs migrar kolareal` → `log.jsonl` (16) + `marca.json` + `corridas/2026-08-20-migrada.json`
- [ ] CLAUDE.md / agent.md / corrida.js / analista.md reescritos; panelista.md eliminado
- [ ] `.env.example`, `.gitattributes` (merge=union), `config.json`, README
- [ ] `~/SecondBrain/projects/competitor-seeker/` + HOME.md; `/graphify . --obsidian`
- [ ] `npm test` verde
- Paralelizable: subagente A (core + tests) ∥ subagente B (Next + coss + tokens + shell)

## Fase 2 — Shell + Home + Competidor (`feat/ui-home`)   ∥ Fase 3
- [ ] AppShell, Sidebar 240/64, Topbar, BrandSwitcher, ThemeToggle, ⌘K
- [ ] KPIs, SignalTrendChart, SignalDistribution, FunnelBars, CompetitorCard/Table, RunTimeline
- [ ] `/competidores/[slug]`: header, EntryTimeline, SignalStrip, PostMetricsTable
- [ ] Estados vacío / demo / loading / error

## Fase 3 — Runner de corridas (`feat/runner`)   ∥ Fase 2
- [ ] runner.ts, stream-json.ts, lock.ts, api/corridas/* (SSE), CS_RUNNER=mock
- [ ] RunLauncher, RunConsole (dark), PhaseStepper, RunHistoryTable, flujo verificado=false

## Fase 4 — Asistente (`feat/asistente`)   ∥ Fase 5
- [ ] agente asistente.md, api/asistente (SSE, --resume), chat UI, artefactos, historial local

## Fase 5 — Apify + uso + notificaciones + Ajustes (`feat/apify`)   ∥ Fase 4
- [ ] rastreador-apify.md, corrida.js, cs apify-uso, UsageMeter, NotificationCenter, Ajustes

## Fase 6 — Git sync + onboarding (`feat/git-sync`)
- [ ] git-sync.ts, api/sync, GitSyncStatus, pull/push automáticos, setup-maquina.sh, README

## Fase 7 — Pulido + export (`feat/pulido`)
- [ ] Export HTML estático, dark mode, reduced-motion, skeletons, 320px, copy, borrar log.json.migrado

## Revisión
(se completa al cerrar cada fase)
