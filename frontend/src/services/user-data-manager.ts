import { NAccessTokenWithWorkspace, NPDInfo, PDToWorkMapping, SavedPDToWorkMapping } from 'src/models/models';
import { BexEnvironment, detectBexEnvironment } from 'src/services/utils';
import _ from 'lodash';
import { exchangeCodeForToken } from 'src/services/api';

export class UserAuthManager {
  /**
   * notion 用户登录。应当在 background script 中运行。
   * 除了登录外，修改 page/database 授权范围也是用这个方法
   */
  static async notionAuth(): Promise<NAccessTokenWithWorkspace> {
    return new Promise((resolve, reject) => {
      const url = new URL('https://api.notion.com/v1/oauth/authorize');
      url.searchParams.append('client_id', process.env.notionClientID as string);
      url.searchParams.append('response_type', 'code');
      url.searchParams.append('owner', 'user');
      chrome.identity.launchWebAuthFlow({ url: url.href, interactive: true }, (callbackUrl) => {
        // callbackUrl 正常情况下是类似以下格式的网址
        // https://{chrome extension id}.chromiumapp.org/?code=036b31a6-0e27-4729-83b7-e9fede0b3a8c&state=
        // 需要取出  code 后面的值，发送到后端，后端再使用这个 code 从 notion 处获取 access token
        if (!callbackUrl) {
          reject(chrome.runtime.lastError);
        } else {
          const code = new URL(callbackUrl).searchParams.get('code');
          if (!code) {
            reject({ message: `Failed to get code from ${callbackUrl}` });
          } else {
            exchangeCodeForToken(code).then((res) => {
              UserDataLocalManager.saveAccessTokenWithWorkSpace(res.data).then(() => {
                resolve(res.data);
              });
            });
          }
        }
      });
    });
  }
}

export enum StorageKey {
  PDList = 'page-database-list',
  PDToWorkMapping = 'page-database-to-work-mapping',
  PDInfo = 'page-database-info',
  AccessTokenWithWorkspace = 'access-token-with-workspace',
}

export class UserDataLocalManager {
  /**
   * 保存或更新用户所有 page 或 database 列表与 schemas
   * @returns 有更新，或新插入的 page 或 database 列表
   */
  static async updatePDList(newPDList: NPDInfo[]): Promise<NPDInfo[]> {
    const oldPDList: NPDInfo[] = (await chrome.storage.local.get([StorageKey.PDList]))[StorageKey.PDList];
    const oldPDListIDs = oldPDList.map((pd) => pd.id);
    const updatedPDList: NPDInfo[] = [];
    newPDList.forEach((pd) => {
      if (!oldPDListIDs.includes(pd.id)) {
        oldPDList.push(pd);
        updatedPDList.push(pd);
      } else {
        const index = oldPDListIDs.indexOf(pd.id);
        if (!_.isEqual(oldPDList[index], pd)) {
          updatedPDList.push(pd);
        }
        oldPDList[index] = pd;
      }
    });

    await chrome.storage.local.set({ [StorageKey.PDList]: oldPDList });
    return updatedPDList;
  }

  /**
   * 获取一个 page/database 的 schema。如果 id=null，则返回所有本地保存过的 schemas
   */
  static async getPDInfo(id: string | null = null): Promise<NPDInfo | undefined | Record<string, NPDInfo>> {
    let pdInfos: Record<string, NPDInfo>; // {id: schema}
    if (detectBexEnvironment() === BexEnvironment.Background) {
      pdInfos = (await chrome.storage.local.get([StorageKey.PDInfo]))?.[StorageKey.PDInfo];
    } else {
      pdInfos = await chrome.runtime.sendMessage({ message: 'get-storage', data: { key: StorageKey.PDInfo } });
    }
    if (id) {
      return pdInfos?.[id];
    }
    return pdInfos;
  }

  /**
   * 存储的是所有上传过文献的数据库的 schema 到本地，格式为 {StorageKey.PDInfo: {id1: {schema}, id2: {schema}}}
   */
  static async savePDInfo(info: NPDInfo) {
    let existedPDInfos = (await UserDataLocalManager.getPDInfo()) as Record<string, NPDInfo> | null;
    if (!existedPDInfos) {
      existedPDInfos = {};
    }
    existedPDInfos[info.id] = info;
    if (detectBexEnvironment() === BexEnvironment.Background) {
      await chrome.storage.local.set({ [StorageKey.PDInfo]: existedPDInfos });
    } else {
      await chrome.runtime.sendMessage({
        message: 'set-storage',
        data: { key: StorageKey.PDInfo, value: existedPDInfos },
      });
    }
  }

  static async getPDToWorkMapping(
    PDId: string | null = null
  ): Promise<{ [key: string]: SavedPDToWorkMapping } | SavedPDToWorkMapping | null> {
    // key 是 database id。value 中包含了 mapping 本身，以及上次存储 mapping 到本地的时间（时间被传换成了 string 格式）
    let mappingLiterals: { [key: string]: { mapping: PDToWorkMapping; lastSaveTime: string; workspaceId: string } };
    if (detectBexEnvironment() === BexEnvironment.Background) {
      mappingLiterals = (await chrome.storage.local.get([StorageKey.PDToWorkMapping]))?.[StorageKey.PDToWorkMapping];
    } else {
      mappingLiterals = await chrome.runtime.sendMessage({
        message: 'get-storage',
        data: { key: StorageKey.PDToWorkMapping },
      });
    }
    if (!mappingLiterals) {
      return null;
    }
    // 将 mappingLiterals 中的 string 格式的 lastSaveTime 转换成 Date
    const mappings: { [key: string]: SavedPDToWorkMapping } = {};
    Object.keys(mappingLiterals).forEach((key) => {
      mappings[key] = {
        mapping: mappingLiterals[key]['mapping'],
        lastSaveTime: new Date(mappingLiterals[key]['lastSaveTime']),
        workspaceId: mappingLiterals[key]['workspaceId'],
      };
    });
    if (PDId) {
      return PDId in mappings ? mappings[PDId] : null;
    }
    return mappings;
  }

  /**
   * 存储数据库字段与文献字段的对应关系。格式为
   * {Storage.PDToWorkMapping: {id1: {'mapping': mapping, 'lastSaveTime': date}}}
   * 这里的 id 指的是数据库 id
   */
  static async savePDToWorkMapping(PDId: string, mapping: PDToWorkMapping, workspaceId: string) {
    let existedMappings = (await UserDataLocalManager.getPDToWorkMapping()) as {
      [key: string]: SavedPDToWorkMapping;
    } | null;
    if (!existedMappings) {
      existedMappings = {};
    }
    existedMappings[PDId] = { mapping: mapping, lastSaveTime: new Date(), workspaceId: workspaceId };
    if (detectBexEnvironment() === BexEnvironment.Background) {
      await chrome.storage.local.set({ [StorageKey.PDToWorkMapping]: existedMappings });
    } else {
      await chrome.runtime.sendMessage({
        message: 'set-storage',
        data: { key: StorageKey.PDToWorkMapping, value: existedMappings },
      });
    }
  }

  static async getAccessTokenWithWorkspaces(
    botId: string | undefined = undefined,
    workspaceId: string | undefined = undefined
  ): Promise<{ [key: string]: NAccessTokenWithWorkspace } | NAccessTokenWithWorkspace | null> {
    let accessTokenWithWorkspaces: { [key: string]: NAccessTokenWithWorkspace };
    if (detectBexEnvironment() === BexEnvironment.Background) {
      accessTokenWithWorkspaces = (await chrome.storage.local.get([StorageKey.AccessTokenWithWorkspace]))?.[
        StorageKey.AccessTokenWithWorkspace
      ];
    } else {
      accessTokenWithWorkspaces = await chrome.runtime.sendMessage({
        message: 'get-storage',
        data: { key: StorageKey.AccessTokenWithWorkspace },
      });
    }
    if (!accessTokenWithWorkspaces) {
      return null;
    }
    if (botId) {
      return botId in accessTokenWithWorkspaces ? accessTokenWithWorkspaces[botId] : null;
    }
    if (workspaceId) {
      const accessTokenWithWorkspace = _.find(
        Object.values(accessTokenWithWorkspaces),
        (value) => value.workspace_id === workspaceId
      );
      return accessTokenWithWorkspace ? accessTokenWithWorkspace : null;
    }
    return accessTokenWithWorkspaces;
  }

  /**
   * 保存下来的数据格式是 {bot_id1: NAccessTokenWithWorkspace1, bot_id2: NAccessTokenWithWorkspace2}
   * 之所以使用 bot_id 为 key，是因为这是 notion 文档推荐的做法。虽然尚不确定为何这么推荐
   */
  static async saveAccessTokenWithWorkSpace(accessTokenWithWorkspace: NAccessTokenWithWorkspace) {
    let accessTokenWithWorkspaces = (await UserDataLocalManager.getAccessTokenWithWorkspaces()) as {
      [key: string]: NAccessTokenWithWorkspace;
    } | null;
    if (!accessTokenWithWorkspaces) {
      accessTokenWithWorkspaces = {};
    }
    accessTokenWithWorkspaces[accessTokenWithWorkspace.bot_id] = accessTokenWithWorkspace;
    if (detectBexEnvironment() === BexEnvironment.Background) {
      await chrome.storage.local.set({ [StorageKey.AccessTokenWithWorkspace]: accessTokenWithWorkspaces });
    } else {
      await chrome.runtime.sendMessage({
        message: 'set-storage',
        data: { key: StorageKey.AccessTokenWithWorkspace, value: accessTokenWithWorkspaces },
      });
    }
  }
}
