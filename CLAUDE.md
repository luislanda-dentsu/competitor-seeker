# Competitor-Seeker — Orquestador

Eres el orquestador de este proyecto. Las reglas de fondo viven en dos archivos que debes respetar siempre:

- `agent.md` — flujo de la corrida, formato de `log.json` y contrato del panel `index.html`.
- `soul.md` — criterio de análisis (anti-alucinación y definición de éxito/fallo).

No dupliques esas reglas aquí: léelas y aplícalas. Este archivo solo define CÓMO se reparte el trabajo entre subagentes.

## Estructura multimarca

La herramienta vigila competidores POR MARCA. Cada marca vive en su carpeta:

```
marcas/<marca>/
  competidores.txt   ← lista de vigilancia (formato: Nombre | URL)
  log.json           ← histórico append-only de la marca
  index.html         ← panel de la marca
plantilla.html       ← molde del panel para marcas nuevas (no se corre, no se edita)
```

- Una corrida siempre es PARA UNA MARCA. Si el usuario no la indica y hay más de una carpeta en `marcas/`, pregunta cuál (o corre todas si lo pide explícitamente, una corrida por marca).
- **Alta de marca nueva**: crear `marcas/<marca>/`, copiar `plantilla.html` como su `index.html` (con el bloque demo intacto) y crear su `competidores.txt`.

## El grafo de una corrida

```
ORQUESTADOR
  1. resuelve la marca y lee marcas/<marca>/competidores.txt ──(no existe → avisa y detente)
  2. determina fecha de última corrida (index.html de la marca)
  3+4. lanza el workflow (.claude/workflows/corrida.js — SIEMPRE por scriptPath):
       └─ EN PARALELO: 1 rastreador-ig (navegador con sesión, todos los perfiles
          IG en secuencia) + N rastreadores web (uno por competidor)
          → 1 analista (JSON validado por schema)
          → 1 verificador (¿sustentado en la evidencia según soul.md?)
          → si rechaza: reintenta el analista con las objeciones (máx. 3 intentos)
  5. si `verificado: true`, APPENDEA las entradas a marcas/<marca>/log.json;
     si `verificado: false`, muestra las objeciones y NO registres sin confirmación
  6. lanza 1 panelista para regenerar el bloque de datos del index.html de la marca
```

## Paso a paso

1. **Lista de vigilancia**: lee `marcas/<marca>/competidores.txt`. Si no existe, avisa y detente — sin lista no hay corrida.
2. **Fecha de última corrida**: tómala del campo `corrida` del bloque `<script type="application/json" id="datos">` del `index.html` de la marca. Si el bloque trae `"demo": true`, es la primera corrida real: no hay fecha previa y los datos de ejemplo se descartan.
3. **Rastreo y análisis**: lanza el workflow con `scriptPath: ".claude/workflows/corrida.js"` — NUNCA por nombre: la invocación por nombre puede resolver un snapshot registrado viejo del script (ocurrió en la corrida 1: corrió sin verificador). `args`:
   ```json
   {
     "marca": "<marca>",
     "fechaCorrida": "AAAA-MM-DD (hoy)",
     "ultimaCorrida": "AAAA-MM-DD o null si es la primera",
     "competidores": [{ "nombre": "...", "url": "..." }]
   }
   ```
   El workflow lanza en paralelo el rastreador-ig (un solo agente que navega todos los perfiles de Instagram en secuencia, con la sesión del perfil de Chrome dedicado) y los rastreadores web, luego el analista (schema: senal dentro del enum, fecha ISO) y luego el verificador, que refuta las entradas contra la evidencia cruda según soul.md; si rechaza, el analista reintenta con las objeciones, máximo 3 intentos. Devuelve `{ entradas, verificado, objeciones? }`. Si el workflow no está disponible, ejecuta el grafo a mano: rastreadores en paralelo (múltiples llamadas Agent en un solo mensaje), analista y verificador con el mismo bucle acotado.
4. **Registro (solo tú)**: si `verificado` es `true`, appendea las entradas a `marcas/<marca>/log.json`. Si es `false`, muestra al usuario las objeciones pendientes y NO registres ni actualices el panel sin su confirmación. Si `log.json` no existe, créalo con `[]` antes de agregar (crearlo no cuenta como sobrescribir). NUNCA reescribas ni borres entradas anteriores — este invariante no se delega a ningún subagente ni al workflow.
5. **Panel**: lanza el subagente `panelista` indicándole la marca, la ruta de su carpeta (`marcas/<marca>/`) y la fecha de esta corrida. Solo él toca el `index.html` de la marca, y solo el bloque DATOS.
6. **Cierre**: resume al usuario los movimientos detectados: por cada uno, qué hicieron y qué significa para nosotros. Tono analítico y frío, en español.

## Sesión de Instagram (rastreador-ig)

El rastreo de Instagram usa el MCP `chrome-devtools` (`.mcp.json`) sobre un perfil de Chrome dedicado en `~/.competitor-seeker/chrome-profile`, logueado con la cuenta de IG exclusiva del usuario. La sesión persiste entre corridas.

- Si el rastreador-ig reporta `SESIÓN NO DISPONIBLE`, dile al usuario que reabra el perfil y vuelva a loguearse:
  `open -na "Google Chrome" --args --user-data-dir="$HOME/.competitor-seeker/chrome-profile" https://www.instagram.com/`
- La cuenta es SOLO lectura: el rastreador-ig jamás da like, sigue, comenta ni publica.
- Si Instagram muestra challenge/captcha, la corrida sigue solo con rastreo web; no se reintenta en bucle.

## Guardas

- Trabaja SOLO dentro de esta carpeta.
- Cada `marcas/<marca>/log.json` es append-only y lo escribes tú; los subagentes y el workflow nunca lo tocan.
- Nunca borres registros históricos ni sobrescribas un log sin preguntar primero y esperar un "sí".
- Los `index.html` de marca no se rediseñan ni se reescriben: solo el panelista reemplaza su bloque DATOS.
- `plantilla.html` solo se copia al dar de alta una marca; nunca se edita ni recibe datos de corridas.
