import wretch from 'wretch';

const baseURL = process.env.DEV ? 'http://localhost:5000' : '';

export const api = wretch(baseURL, { mode: 'cors' })
  .errorType('json')
  .resolve((r) => r.json());

export async function searchPageDatabaseByTitle(query: string) {
  const res = await api.url('/search-by-title').post({ query: query, search_for: 'database' });
  return res;
}
