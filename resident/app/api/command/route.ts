import { NextResponse } from "next/server";
import { currentActor } from "@/lib/auth";
import { requireActor, DomainError } from "@/lib/permissions";
import { transaction } from "@/lib/store";
import { execute } from "@/lib/domain";
import { contracts, type Operation } from "@/lib/contracts";
import { DemoAIProvider } from "@/lib/ai/provider";
import { OpenAIProvider } from "@/lib/ai/openai";
import { environment } from "@/lib/env";
import { checkOrigin, failure } from "@/lib/http";
import { supabase } from "@/lib/supabase/server";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const a = requireActor(await currentActor());
    const { operation, input } = await req.json();
    if (!(operation in contracts))
      throw new DomainError("INVALID_OPERATION", "Unknown action.");
    const parsed = contracts[operation as Operation].parse(input);
    if (operation === "claimInvite" && !environment().demo) {
      const p = contracts.claimInvite.parse(parsed);
      const { data, error } = await (
        await supabase()
      ).rpc("claim_invite", { raw_token: p.rawToken });
      if (error)
        throw new DomainError(
          "INVITE_UNAVAILABLE",
          "This invitation is unavailable for your account.",
        );
      return NextResponse.json({ ok: true, data: { membershipId: data } });
    }
    let retrievedIds: string[] | undefined;
    if (operation === "askRoomly" && !environment().demo) {
      const p = contracts.askRoomly.parse(parsed);
      const db = await supabase();
      const { data: profile } = await db
        .from("profiles")
        .select("locale")
        .eq("id", a.id)
        .single();
      const { data: ranked, error } = await db.rpc("search_home_content", {
        room: p.roomId,
        question: p.question,
        requested_locale: profile?.locale || "en-GB",
      });
      if (error)
        throw new DomainError(
          "RETRIEVAL_UNAVAILABLE",
          "Your guide could not be searched. Retry or contact your manager.",
        );
      retrievedIds = (ranked || []).map((b: { id: string }) => b.id);
    }
    const data = await transaction(a, (s) =>
      execute(
        s,
        a,
        operation as Operation,
        parsed,
        environment().demo ? new DemoAIProvider() : new OpenAIProvider(),
        { retrievedIds },
      ),
    );
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
