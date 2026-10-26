import { NextRequest, NextResponse, connection } from "next/server";
import { workstationConfigPayload } from "@/lib/workstation/payload";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await ctx.params;
  const config = await workstationConfigPayload(id);
  if (!config) {
    return NextResponse.json({ error: "Unknown workstation" }, { status: 404 });
  }
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}
