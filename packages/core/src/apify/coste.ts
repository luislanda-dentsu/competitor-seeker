// Coste estimado de Apify por resultado del Instagram scraper.
export const USD_POR_RESULTADO = 0.0027

export function estimarCosteUsd(resultados: number): number {
  if (!Number.isFinite(resultados) || resultados <= 0) return 0
  return Math.round(resultados * USD_POR_RESULTADO * 10000) / 10000
}
