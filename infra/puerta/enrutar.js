// Lógica pura de la puerta (sin APIs de Workers): orden de Macs y si una respuesta es «Mac caída».

/** Cookie de afinidad: cada navegador se queda en la Mac que lo atendió mientras responda. */
export const COOKIE_MAC = 'cs-mac'

/** Bindings de VPC en orden de preferencia: la Mac de Luis es la principal. */
export const MACS = ['MAC_LUIS', 'MAC_COMPANERA']

export function leerCookie(cabecera, nombre) {
  if (!cabecera) return null
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nombre) return v.join('=') || null
  }
  return null
}

/** Macs a probar, en orden: la de la cookie (si existe y está configurada) y luego las demás. */
export function ordenMacs(disponibles, preferida) {
  const lista = MACS.filter((m) => disponibles.includes(m))
  if (!preferida || !lista.includes(preferida)) return lista
  return [preferida, ...lista.filter((m) => m !== preferida)]
}

/**
 * ¿La respuesta indica que la Mac no está (túnel caído o app apagada)? La app nunca responde
 * 502/504/530 por sí misma; un 503 suyo (p. ej. «acceso no configurado») sí se entrega tal cual.
 */
export function macCaida(status) {
  return status === 502 || status === 504 || status === 530
}

/** Ruta interna Mac → Worker → otra Mac: solo el estado de corridas. */
export const RUTA_OTRA_MAC = '/__cs/otra-mac/api/corridas/estado'

/** Macs a consultar para «la otra Mac» de `desde` (todas las configuradas menos ella). */
export function otrasMacs(disponibles, desde) {
  return MACS.filter((m) => disponibles.includes(m) && m !== desde)
}

export function secretoValido(recibido, esperado) {
  if (!recibido || !esperado || recibido.length !== esperado.length) return false
  let dif = 0
  for (let i = 0; i < esperado.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i)
  return dif === 0
}
