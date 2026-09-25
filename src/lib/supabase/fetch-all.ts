/**
 * Every row a query matches, not just the first thousand.
 *
 * PostgREST caps a single response at the project's max-rows setting (1,000 on
 * Supabase by default) and says nothing when it does. A portfolio that grows
 * past that does not error; it quietly loses rent rows, alerts and totals. So
 * anything that reads a whole table pages through it here instead.
 *
 * `build` must return a fresh query each time, with a stable `order` so pages
 * neither overlap nor skip rows.
 */
const PAGE = 1000;

type PagedResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAll<T>(
  build: (from: number, to: number) => PagedResult<T>,
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}
