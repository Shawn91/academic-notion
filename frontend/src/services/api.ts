import wretch from 'wretch';
import { NotionPDInfo } from 'src/models';

const baseURL = process.env.DEV ? 'http://localhost:5000' : '';

export const api = wretch(baseURL, { mode: 'cors' })
  .errorType('json')
  .resolve((r) => r.json());

export interface Response<T> {
  data: T;
  success: boolean;
  message: string;
  code: number;
}

export async function searchPageDatabaseByTitle(query: string): Promise<Response<NotionPDInfo[]>> {
  return (await api.url('/search-by-title').post({ query: query, search_for: 'database' })) as Response<NotionPDInfo[]>;
}
