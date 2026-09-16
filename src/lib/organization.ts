export type OrganizationRole = "owner" | "admin" | "staff" | "viewer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Every private Storage object starts with the organisation UUID. Keeping the
 * rule in one helper prevents one upload surface from accidentally returning
 * to the old shared root.
 */
export function organizationStoragePath(
  organizationId: string,
  ...segments: string[]
): string {
  if (!UUID_PATTERN.test(organizationId))
    throw new Error("Invalid organization id.");

  const clean = segments.map((segment) => segment.replace(/^\/+|\/+$/g, ""));
  if (
    clean.some(
      (segment) => !segment || segment.split("/").some((part) => part === ".."),
    )
  )
    throw new Error("Invalid storage path.");

  return [organizationId, ...clean].join("/");
}
