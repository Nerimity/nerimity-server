export const queryAsArray = (query?: any) => {
  if (!query || !query.length) return [];
  return Array.isArray(query) ? (query as string[]) : [query as string];
};
