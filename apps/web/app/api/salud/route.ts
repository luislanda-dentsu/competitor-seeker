import { NextResponse } from "next/server";

/** Sonda pública para la puerta de Cloudflare (¿responde esta Mac?). No expone datos. */
export function GET(): Response {
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
