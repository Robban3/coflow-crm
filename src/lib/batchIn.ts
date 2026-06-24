// Batch helper: split an array of ids into chunks and run .in() queries in
// parallel, then merge the rows. Keeps PostgREST URLs under length limits when
// the id list is large (e.g. an admin with thousands of leads).
export async function batchIn<T>(
  queryFn: (ids: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  ids: string[],
  batchSize = 100,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }
  const results = await Promise.all(chunks.map((chunk) => queryFn(chunk)));
  return results.flatMap((r) => r.data ?? []);
}
