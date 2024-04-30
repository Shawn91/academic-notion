import wretch from 'wretch';
import { NPDInfo, PDToWorkMapping, Work } from 'src/models/models';
import { transformFromWorkToPDItem } from 'src/services/database-work-mapping';

const baseURL = process.env.DEV ? 'http://localhost:8000' : '';

export const api = wretch(baseURL, { mode: 'cors' })
  .errorType('json')
  .resolve((r) => r.json());

export interface Response<T> {
  data: T;
  success: boolean;
  message: string;
  code: number;
}

export async function searchPageDatabaseByTitle(query: string): Promise<Response<NPDInfo[]>> {
  return (await api.url('/search-by-title').post({ query: query, search_for: 'database' })) as Response<NPDInfo[]>;
}

export async function uploadWorks(pageDatabase: NPDInfo, works: Work[], databaseToWorkMapping: PDToWorkMapping) {
  const uploadData = works.map((work) => {
    return {
      parent: { type: 'database_id', database_id: pageDatabase.id },
      properties: transformFromWorkToPDItem(databaseToWorkMapping, work),
    };
  });
  return await api.url('/upload-works').post(uploadData);
}
