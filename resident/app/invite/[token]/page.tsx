import Link from "next/link";
import { currentActor } from "@/lib/auth";
import { environment } from "@/lib/env";
import { readState } from "@/lib/store";
import { resolveInvite } from "@/lib/domain";
import { supabase } from "@/lib/supabase/server";
import { RoomlyLogo } from "@/components/roomly/primitives";
import { InviteClaim } from "@/components/roomly/InviteClaim";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let preview;
  try {
    if (environment().demo) preview = resolveInvite(await readState(), token);
    else {
      const { data, error } = await (
        await supabase()
      ).rpc("resolve_invite", { raw_token: token });
      if (error || !data) throw new Error();
      preview = data as {
        propertyName: string;
        inviter: string;
        expiresAt: string;
        welcome: string;
      };
    }
  } catch {
    return (
      <main id="main" className="invite-page">
        <RoomlyLogo />
        <h1>Let’s get you a new invitation.</h1>
        <p>
          This invitation has expired, was revoked, or has already been claimed.
          Ask your manager for a replacement.
        </p>
        <Link className="button secondary section" href="/sign-in">
          Sign in to your home
        </Link>
      </main>
    );
  }
  const actor = await currentActor();
  return (
    <main id="main" className="invite-page">
      <RoomlyLogo />
      <span className="eyebrow">You’re invited</span>
      <h1>
        A new chapter.
        <br />A place to call home.
      </h1>
      <div className="invite-panel">
        <h2>{preview.propertyName}</h2>
        <p>{preview.inviter} has invited you to join.</p>
        <p>{preview.welcome}</p>
        <small>
          Invitation expires{" "}
          {new Date(preview.expiresAt).toLocaleDateString("en-GB")}.
        </small>
        {actor ? (
          <InviteClaim token={token} />
        ) : (
          <Link
            className="button primary"
            href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
          >
            Join this home
          </Link>
        )}
      </div>
      <p>
        <small>
          Your private home details become available after you sign in and claim
          this invitation.
        </small>
      </p>
      <section className="entry-next">
        <h2>Your first few steps</h2>
        <p>
          Join securely, choose your preferences and get to know your home. Your
          essentials and agreements become available after you join.
        </p>
      </section>
    </main>
  );
}
