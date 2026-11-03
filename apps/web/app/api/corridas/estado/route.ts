import { connection, NextResponse } from "next/server";
import { estadoRunner } from "@/lib/runs/runner";

/** GET /api/corridas/estado → `{ lock, enCurso }`. */
export async function GET(): Promise<Response> {
  await connection();
  return NextResponse.json(estadoRunner(), { headers: { "cache-control": "no-store" } });
}
