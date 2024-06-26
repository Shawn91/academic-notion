import wretch from 'wretch';
import QueryStringAddon from 'wretch/addons/queryString';
import { NAccessTokenWithWorkspace, NPDInfo, PDToWorkMapping, Work } from 'src/models/models';
import { transformFromWorkToPDItem } from 'src/services/database-work-mapping';

const baseURL = process.env.DEV ? 'http://localhost:8000' : 'https://academic-notion-backend-q5zb8.ondigitalocean.app';

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

export async function searchPageDatabaseByTitle(
  query: string,
  accessToken: string,
  workspaceId: string | undefined = undefined
): Promise<Response<NPDInfo[]>> {
  const response = (await api.url('/search-by-title').post({
    query: query,
    search_for: 'database',
    access_token: accessToken,
  })) as Response<NPDInfo[]>;
  if (workspaceId) {
    response.data.forEach((pd) => (pd.workspaceId = workspaceId));
  }
  return response;
}

export async function uploadWorks(
  pageDatabase: NPDInfo,
  works: Work[],
  databaseToWorkMapping: PDToWorkMapping,
  accessToken: string
): Promise<Work[]> {
  const uploadData = works.map((work) => {
    return {
      parent: { type: 'database_id', database_id: pageDatabase.id },
      properties: transformFromWorkToPDItem(databaseToWorkMapping, work),
    };
  });
  const res = (await api.url('/upload-works').post({ access_token: accessToken, data: uploadData })) as Response<
    number[]
  >;
  // res.data 是上传出错的文献在 works 变量中的下标
  return res.data.map((i) => works[i]);
}

/**
 * 给定 id，返回一个 page 或 database 的详细信息
 */
export async function fetchPageDatabaseByID(
  id: string,
  PDType: 'page' | 'database' = 'database',
  accessToken?: string,
  workspaceId?: string
): Promise<Response<NPDInfo>> {
  const res = (await api.url('/page-database/').post({
    PDId: id,
    PDType: PDType,
    access_token: accessToken,
  })) as Response<NPDInfo>;
  if (workspaceId) {
    res.data.workspaceId = workspaceId;
  }
  return res;
}

/**
 * 用户通过 notion 的 oauth 登录后，拿到的是一个 code，将这个 code 发送到后端，由后端再次向 notion 获取 access token
 */
export async function exchangeCodeForToken(code: string): Promise<Response<NAccessTokenWithWorkspace>> {
  return (await api.url('/exchange-code-for-token').post({ code: code })) as Response<NAccessTokenWithWorkspace>;
}
