import type { Actor, Block, Membership, State } from "../model";
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireActor(actor: Actor | null): Actor {
  if (!actor)
    throw new DomainError("UNAUTHENTICATED", "Please sign in to continue.");
  return actor;
}
export function isManager(
  s: State,
  actor: Actor,
  roomId: string,
  write = false,
) {
  const room = s.rooms.find((r) => r.id === roomId);
  const property = s.properties.find((p) => p.id === room?.property_id);
  return !!s.organisation_members.find(
    (m) =>
      m.profile_id === actor.id &&
      m.organisation_id === property?.organisation_id &&
      (!write || m.role !== "staff"),
  );
}
export function requireManager(s: State, a: Actor, room: string, write = true) {
  if (!isManager(s, a, room, write))
    throw new DomainError(
      "PERMISSION_DENIED",
      "You do not have permission to manage this home.",
    );
}
export function membership(s: State, a: Actor, roomId: string): Membership {
  const m = s.memberships.find(
    (m) =>
      m.room_id === roomId && m.profile_id === a.id && m.status === "active",
  );
  if (!m)
    throw new DomainError(
      "PERMISSION_DENIED",
      "An active membership is required for this home.",
    );
  return m;
}
export function ownMembership(s: State, a: Actor, id: string) {
  const m = s.memberships.find(
    (m) => m.id === id && m.profile_id === a.id && m.status === "active",
  );
  if (!m)
    throw new DomainError(
      "PERMISSION_DENIED",
      "This membership is not available to you.",
    );
  return m;
}
// Only the published snapshot is eligible, even if the manager has archived its working draft.
export function visibleBlocks(
  s: State,
  roomId: string,
  locale = "en-GB",
  now = Date.now(),
): Block[] {
  return s.content_blocks
    .filter((b) => b.room_id === roomId && b.published_snapshot)
    .map((b) => ({ ...b, ...b.published_snapshot!, published_snapshot: null }))
    .filter(
      (b) =>
        b.status === "published" &&
        b.visibility !== "manager_only" &&
        (b.visibility !== "scheduled" ||
          (!!b.visible_from && Date.parse(b.visible_from) <= now)),
    )
    .map((b) => {
      const t = s.translations.find(
        (t) =>
          t.content_block_id === b.id &&
          t.locale === locale &&
          (t.published_snapshot?.source_version === b.version ||
            (!t.published_snapshot &&
              t.status === "published" &&
              t.source_version === b.version)),
      );
      const published = t?.published_snapshot || t;
      return published
        ? {
            ...b,
            title: published.title,
            body: published.body,
            data: published.data,
          }
        : b;
    })
    .sort((a, b) => a.position - b.position);
}
export function residentBlocks(
  s: State,
  a: Actor,
  roomId: string,
  locale?: string,
) {
  membership(s, a, roomId);
  return visibleBlocks(s, roomId, locale);
}
