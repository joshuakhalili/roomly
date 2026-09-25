"use server";

import { requireMember } from "@/lib/actions/helpers";

export type SearchHit = {
  kind: "property" | "room" | "tenant";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const LIMIT = 6;

/**
 * The header search. Row level security keeps every query inside the
 * signed-in organisation; this only decides what counts as a match.
 *
 * PostgREST filter strings treat commas, brackets and wildcards as syntax, so
 * those are stripped from the term rather than escaped. Nobody searches for a
 * tenant by a comma.
 */
export async function searchWorkspace(raw: string): Promise<SearchHit[]> {
  const term = raw.replace(/[%_,()*\\:."']/g, " ").trim().slice(0, 60);
  if (term.length < 2) return [];
  const auth = await requireMember();
  if (!auth.ok) return [];
  const { supabase } = auth;
  const like = `%${term}%`;

  const [properties, rooms, tenants] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, address")
      .or(`name.ilike.${like},address.ilike.${like}`)
      .limit(LIMIT),
    supabase
      .from("rooms")
      .select("id, name, property_id, properties(name)")
      .ilike("name", like)
      .eq("is_common_area", false)
      .limit(LIMIT),
    supabase
      .from("tenants")
      .select("id, first_name, surname, email, phone")
      .or(
        `first_name.ilike.${like},surname.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
      )
      .limit(LIMIT),
  ]);

  // A full name typed with a space ("Fang Li") matches neither column alone.
  let people = tenants.data ?? [];
  const [first, ...rest] = term.split(/\s+/);
  if (!people.length && rest.length) {
    const { data } = await supabase
      .from("tenants")
      .select("id, first_name, surname, email, phone")
      .ilike("first_name", `%${first}%`)
      .ilike("surname", `%${rest.join(" ")}%`)
      .limit(LIMIT);
    people = data ?? [];
  }

  return [
    ...people.map((p) => ({
      kind: "tenant" as const,
      id: p.id as string,
      title: `${p.first_name} ${p.surname}`,
      subtitle: (p.email ?? p.phone ?? "") as string,
      href: `/tenants/${p.id}`,
    })),
    ...(properties.data ?? []).map((p) => ({
      kind: "property" as const,
      id: p.id as string,
      title: p.name as string,
      subtitle: (p.address ?? "") as string,
      href: `/properties/${p.id}`,
    })),
    ...(rooms.data ?? []).map((r) => {
      const parent = r.properties as unknown as { name: string } | null;
      return {
        kind: "room" as const,
        id: r.id as string,
        title: r.name as string,
        subtitle: parent?.name ?? "",
        href: `/properties/${r.property_id}/rooms/${r.id}`,
      };
    }),
  ];
}
