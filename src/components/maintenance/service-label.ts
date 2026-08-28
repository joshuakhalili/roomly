import type { ServiceType } from "@/lib/types";

/**
 * What to call a service category.
 *
 * The seeded categories carry a slug and are translated, so a Chinese-reading
 * admin sees 保洁 rather than "Cleaning". Categories someone added themselves
 * have no slug and no translation to look up — those show exactly the text
 * that was typed, in whichever language they typed it.
 */
export function serviceLabel(
  t: (key: string) => string,
  service: Pick<ServiceType, "name" | "slug"> | null | undefined,
): string {
  if (!service) return "";
  return service.slug ? t(`maintenance.service.${service.slug}`) : service.name;
}
