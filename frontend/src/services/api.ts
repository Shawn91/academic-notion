import wretch from 'wretch';
import QueryStringAddon from 'wretch/addons/queryString';
import { NPDInfo, PDToWorkMapping, Work } from 'src/models/models';
import { transformFromWorkToPDItem } from 'src/services/database-work-mapping';

const baseURL = process.env.DEV ? 'http://localhost:8000' : '';

export const api = wretch(baseURL, { mode: 'cors' })
  .addon(QueryStringAddon)
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

/**
 * 给定 id，返回一个 page 或 database 的详细信息
 */
export async function fetchPageDatabaseByID(
  id: string,
  PDType: 'page' | 'database' = 'database'
): Promise<Response<NPDInfo>> {
  return (await api.url('/page-database/').query({ PDId: id, PDType: PDType }).get()) as Response<NPDInfo>;
}
