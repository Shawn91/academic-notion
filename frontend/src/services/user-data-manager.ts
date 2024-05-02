import { NPDInfo, PDToWorkMapping } from 'src/models/models';
import { BexEnvironment, detectBexEnvironment } from 'src/services/utils';
import { is } from 'quasar';

export enum StorageKey {
  PDList = 'page-database-list',
  PDToWorkMapping = 'page-database-to-work-mapping',
  PDInfo = 'page-database-info',
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
        if (!is.deepEqual(oldPDList[index], pd)) {
          updatedPDList.push(pd);
        }
        oldPDList[index] = pd;
      }
    });

    await chrome.storage.local.set({ [StorageKey.PDList]: oldPDList });
    return updatedPDList;
  }

  /**
   * 保存一个 database 中的列与 work 字段的映射关系
   */
  static savePDToWorkMapping(mapping: PDToWorkMapping) {
    chrome.storage.local.set({ [StorageKey.PDToWorkMapping]: mapping });
  }

  /**
   * 获取一个 page/database 的 schema。如果 id=null，则返回所有本地保存过的 schemas
   */
  static async getPDInfo(id: string | null = null): Promise<NPDInfo | null | Record<string, NPDInfo>> {
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
}
