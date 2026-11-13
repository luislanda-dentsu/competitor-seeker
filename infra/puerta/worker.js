// Puerta de Competitor-Seeker en Cloudflare (como Orbit, en *.workers.dev): no guarda nada,
// solo reenvía cada petición a una de las Macs del equipo por Cloudflare Tunnel + Workers VPC.
// El login y los datos viven en la Mac; si ninguna responde, muestra «panel no disponible».
import { COOKIE_MAC, leerCookie, macCaida, ordenMacs, otrasMacs, RUTA_OTRA_MAC, secretoValido } from './enrutar.js'

const NO_DISPONIBLE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel no disponible · Competitor-Seeker</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#010101;color:#f3f3f3;font:16px/1.5 system-ui,sans-serif;padding:16px}
main{max-width:28rem;background:#1a1a1a;border-radius:14px;padding:28px}h1{font-size:1.25rem;margin:0 0 8px}p{margin:0;color:#bdbdbd}</style></head>
<body><main><h1>Panel no disponible</h1><p>Ninguna de las Macs del equipo está encendida o conectada ahora mismo. Vuelve a intentarlo en un rato o avisa a quien tenga la Mac.</p></main></body></html>`

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** Una Mac pregunta si la otra tiene una corrida en curso (aviso en Corridas). Nada más pasa por aquí. */
async function consultaInterna(request, env, url, disponibles) {
  const secreto = request.headers.get('x-cs-interno')
  if (url.pathname !== RUTA_OTRA_MAC || !secretoValido(secreto, env.CS_SECRETO_INTERNO)) return json({ error: 'no encontrado' }, 404)
  for (const mac of otrasMacs(disponibles, url.searchParams.get('desde'))) {
    try {
      const r = await env[mac].fetch('http://localhost:3030/api/corridas/estado', { headers: { 'x-cs-interno': secreto } })
      if (r.ok) {
        const { enCurso } = await r.json()
        if (enCurso) return json({ enCurso, mac })
      }
    } catch {
      /* esa Mac no está: no hay nada que avisar */
    }
  }
  return json({ enCurso: null })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const disponibles = Object.keys(env).filter((k) => typeof env[k]?.fetch === 'function')
    if (url.pathname.startsWith('/__cs/')) return consultaInterna(request, env, url, disponibles)
    // El secreto interno nunca viaja desde un navegador.
    const limpias = new Headers(request.headers)
    limpias.delete('x-cs-interno')
    const orden = ordenMacs(disponibles, leerCookie(request.headers.get('cookie'), COOKIE_MAC))

    const cabeceras = limpias
    cabeceras.set('x-forwarded-host', url.host)
    cabeceras.set('x-forwarded-proto', 'https')
    // El cuerpo se lee una vez para poder reintentar en la otra Mac (son JSON pequeños).
    const cuerpo = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer()

    for (const mac of orden) {
      let res
      try {
        res = await env[mac].fetch(`http://localhost:3030${url.pathname}${url.search}`, {
          method: request.method,
          headers: cabeceras,
          body: cuerpo,
          redirect: 'manual',
        })
      } catch {
        continue
      }
      if (macCaida(res.status)) continue
      if (leerCookie(request.headers.get('cookie'), COOKIE_MAC) === mac) return res
      const salida = new Response(res.body, res)
      salida.headers.append('set-cookie', `${COOKIE_MAC}=${mac}; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax`)
      return salida
    }
    return new Response(NO_DISPONIBLE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '120' } })
  },
}
