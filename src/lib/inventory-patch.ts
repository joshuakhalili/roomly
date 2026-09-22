import { z } from "zod";
const rating = z
  .enum(["excellent", "good", "fair", "poor", "unacceptable"])
  .nullable()
  .optional();
const schema = z.object({
  condition_rating: rating,
  cleanliness_rating: rating,
  description: z.string().trim().max(5000).nullable().optional(),
  flagged_for_maintenance: z.boolean().optional(),
});
/** A single-field autosave must not erase the rest of a room inspection. */
export function inventoryPatch(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Choose valid ratings, notes and maintenance status.",
    };
  const data = Object.fromEntries(
    Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        key === "description" && value === "" ? null : value,
      ]),
  );
  if (!Object.keys(data).length)
    return { ok: false as const, error: "No inventory changes supplied." };
  return { ok: true as const, data };
}
