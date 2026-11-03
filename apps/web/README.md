# @competitor-seeker/web

Panel web local de Competitor-Seeker (Next.js 16 · React 19 · Tailwind v4 · coss/ui · React Bits).

## Correr

```bash
npm run dev -w apps/web        # http://localhost:3000
npm run lint -w apps/web
npm run typecheck -w apps/web
npm run build -w apps/web
```

## Estructura

```
app/            rutas (App Router): / · /competidores · /competidores/[slug] · /asistente · /corridas · /ajustes
components/ui   coss/ui (generado por el CLI; no editar a mano salvo necesidad)
components/bits React Bits: CountUp · AnimatedList · FadeContent · ShinyText
components/app  shell (AppShell, Sidebar, Topbar, BrandSwitcher, ThemeToggle, MobileNav, UsageMeter), kpi, signals, states
lib/            theme (tema claro/oscuro/sistema), sidebar (cookie cs-sidebar), nav, format, utils
```

## Tokens

Viven en `app/globals.css` (`:root` claro, `:root[data-theme="dark"]` oscuro, `@theme inline` para Tailwind).
Señales: `s-nuevo`, `s-confuso`, `s-sin-datos`, `s-no-funciona`, `s-invalida` (+ `-soft`). Acento de marca: `brand`,
`brand-soft`, `brand-line` (no `accent`, que coss/ui reserva para hover). Tipografía: `.t-page`, `.t-kpi`, `.t-label`.

## Instalar componentes

```bash
# coss/ui (ya hecho; vuelve a correrlo para actualizar)
npx shadcn@latest init @coss/style --yes
npx shadcn@latest add @coss/ui --yes --overwrite

# React Bits (solo estos 4; luego se mueven a components/bits/)
npx shadcn@latest add @react-bits/CountUp-TS-TW @react-bits/AnimatedList-TS-TW @react-bits/FadeContent-TS-TW @react-bits/ShinyText-TS-TW --yes
```
