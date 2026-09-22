import { NextResponse } from "next/server";
import { currentActor } from "@/lib/auth";
import { requireActor } from "@/lib/permissions";
import { readState } from "@/lib/store";
import { viewState } from "@/lib/domain";
import { failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const actor = requireActor(await currentActor());
    const room = new URL(req.url).searchParams.get("room") || undefined;
    return NextResponse.json(
      { ok: true, data: viewState(await readState(), actor, room) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
