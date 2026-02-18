/**
 * Fetches all rows from a Supabase query using automatic pagination.
 * Supabase has a default limit of 1000 rows per query.
 * This helper fetches in batches of 1000 until all rows are retrieved.
 */
export const fetchAllPaginated = async <T = any>(
  buildQuery: () => any,
  pageSize: number = 1000
): Promise<T[]> => {
  let allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) {
      allRows = allRows.concat(data);
    }
    hasMore = (data?.length ?? 0) === pageSize;
    from += pageSize;
  }
  return allRows;
};
