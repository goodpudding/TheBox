import { NextRequest, NextResponse, connection } from "next/server";
import { logoutCurrent } from "@/lib/workstation/server";
import { jsonError } from "@/lib/workstation/errors";
import type { EndedBy } from "@/lib/workstation/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    let endedBy: EndedBy = "logout";
    try {
      const body = (await request.json()) as { endedBy?: EndedBy };
      if (
        body.endedBy === "idle" ||
        body.endedBy === "logout" ||
        body.endedBy === "staff"
      ) {
        endedBy = body.endedBy;
      }
    } catch {
      // empty body is fine
    }
    await logoutCurrent(request, endedBy);
    return NextResponse.json({
      ok: true,
      billed: true,
      note: "Workstation session ended. Prints and spooler jobs were not cancelled.",
    });
  } catch (err) {
    return jsonError(err);
  }
}
