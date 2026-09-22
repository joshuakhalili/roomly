import { authDestination } from "./auth/destination";
import { homeHref } from "./home-navigation";
import { redirect } from "next/navigation";
import { currentActor } from "./auth";
import { readState } from "./store";
import { viewState } from "./domain";
import { Application } from "@/components/roomly/Application";
import { EmptyState, RoomlyLogo } from "@/components/roomly/primitives";
export async function renderApplication(
  path: string,
  options: { propertyId?: string; membershipId?: string; roomId?: string } = {},
) {
  const actor = await currentActor();
  if (!actor)
    redirect(
      `/sign-in?next=${encodeURIComponent(authDestination(homeHref(path, options.roomId)))}`,
    );
  const s = await readState();
  let roomId = options.roomId;
  if (options.propertyId) {
    roomId = s.rooms.find((r) => r.property_id === options.propertyId)?.id;
    if (!roomId)
      return (
        <main id="main" className="invite-page">
          <RoomlyLogo />
          <EmptyState
            title="Home unavailable"
            description="You do not have access to this property."
          />
        </main>
      );
  }
  if (options.membershipId) {
    const m = s.memberships.find(
      (m) =>
        m.id === options.membershipId &&
        m.profile_id === actor.id &&
        m.status === "active",
    );
    if (!m)
      return (
        <main id="main" className="invite-page">
          <RoomlyLogo />
          <EmptyState
            title="Membership unavailable"
            description="Sign in with the account that claimed this home."
          />
        </main>
      );
    roomId = m.room_id;
  }
  let view;
  try {
    view = viewState(s, actor, roomId);
  } catch {
    return (
      <main id="main" className="invite-page">
        <RoomlyLogo />
        <EmptyState
          title="Permission denied"
          description="Your account cannot access this home."
        />
      </main>
    );
  }
  if (path === "/home" && view.manager && !view.member) redirect("/manage");
  if (path === "/manage" && !view.manager) redirect("/onboarding/manager");
  if (path === "/onboarding/manager" && view.progress?.completed)
    redirect("/manage");
  return (
    <Application key={`${path}-${view.room?.id}`} initial={view} path={path} />
  );
}
