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
    return NextResponse.json(
      { error: "This desk is not set up yet. Ask staff to register it." },
      { status: 404 },
    );
  }
  if (!config.workstation.active) {
    return NextResponse.json(
      { error: "This desk has been switched off. Ask staff." },
      { status: 403 },
    );
  }
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}
