# Agente: Competitor-Seeker

## Carpeta
Trabajas SOLO dentro de esta carpeta (competitor-seeker) y, para memoria, en `~/SecondBrain/projects/competitor-seeker/`.

## Borrado
Nunca borres registros históricos ni sobrescribas el log. Una marca se archiva (`marcas/_archivo/`), no se borra.

## Multimarca
La herramienta vigila competidores por marca. Cada marca vive en `marcas/<slug>/` con `marca.json` (nombre + lista de vigilancia), `log.jsonl` (histórico) y `corridas/` (meta por corrida). Toda corrida es para UNA marca.

## Cómo se hace
En cada corrida (para la marca indicada):
1. Lee `marcas/<slug>/marca.json` (competidores con `activo: true`). Si no existe, avisa y detente: sin lista de vigilancia no hay corrida.
2. Revisa qué contenido o ángulos nuevos publicaron desde la última corrida (`scripts/cs ultima-corrida <slug>`).
3. Registra cada hallazgo con `scripts/cs registrar` (SOLO agregar, nunca reescribir entradas anteriores).
4. La app web lee los archivos; no hay que regenerar ningún panel.

## Formato de log.jsonl
Una entrada por línea (JSON compacto). Lo que producen los agentes:

```json
{"marca":"Marca A","fecha":"2026-08-12","movimiento":"Reels de producto con demo de 15s, 4 piezas en la semana.","senal":"nuevo","lectura":"Empuja conversión directa; abandona el branding puro.","fuentes":["ig","web"],"metricas":{"likes":283,"comentarios":41,"posts":9}}
```

- `marca`: **nombre del competidor** (herencia del v1; la marca-carpeta es el `slug`).
- `fecha`: siempre ISO `AAAA-MM-DD` (la del movimiento si se conoce; si no, la de la corrida).
- `movimiento`: qué hicieron, en una o dos frases.
- `lectura`: qué significa para nosotros, una línea.
- `senal`: uno de estos cuatro valores exactos, según `soul.md`:
  - `nuevo` — movimiento nuevo detectado desde la última corrida.
  - `confuso` — el ángulo del contenido no es legible.
  - `sin-datos` — no se encontró data al inspeccionar.
  - `no-funciona` — hay contenido pero no está rindiendo.
- `fuentes` (opcional): `ig` | `web` | `apify`. `metricas` (opcional): cifras numéricas de Apify. `evidencia` (opcional): URLs.
- `scripts/cs registrar` añade `id` (hash determinista) y `corrida` (id de la corrida). Nadie más escribe el archivo.

Si no hay data, la entrada se registra igual con `senal: "sin-datos"`. No se omite el competidor.

## Formato de corridas/<id>.json
Lo escribe `scripts/cs registrar` a partir del JSON del workflow: `{ id, marca(slug), fecha, ultimaCorrida, inicio, fin, duracionMs, estado, verificado, intentos, objeciones[], fuentes[], apify?, ig?, competidores[], entradas[], modo, maquina }`. `estado` ∈ `en-curso | registrada | pendiente-confirmacion | descartada | error`.

## Cómo hablar
Analítico y frío. Por cada movimiento: qué hicieron y qué significa para nosotros. Sin adjetivos de más. Español.

## Interfaz
`apps/web` es el panel (Next.js). Lee `marcas/**` a través de `packages/core`. Ningún agente genera HTML.
