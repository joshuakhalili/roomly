"use client";
import { useRouter } from "next/navigation";
import { command, useAction } from "./client";
import { StatusMessage } from "./primitives";
export function InviteClaim({ token }: { token: string }) {
  const action = useAction();
  const router = useRouter();
  return (
    <>
      <button
        className="button primary"
        disabled={action.busy}
        onClick={() =>
          action
            .run(
              () =>
                command<{ membershipId: string }>("claimInvite", {
                  rawToken: token,
                }),
              "Invitation claimed",
            )
            .then((r) => {
              if (r) router.push(`/onboarding/resident/${r.membershipId}`);
            })
        }
      >
        Join this home
      </button>
      <StatusMessage {...action} />
    </>
  );
}
