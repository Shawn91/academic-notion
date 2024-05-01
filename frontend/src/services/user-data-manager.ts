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
   * 获取一个 page/database 的 schema
   */
  static async getPDInfo(id: string): Promise<NPDInfo | null> {
    const key = `${StorageKey.PDInfo}-${id}`;
    if (detectBexEnvironment() === BexEnvironment.Background) {
      return (await chrome.storage.local.get([key]))[key];
    } else {
      return await chrome.runtime.sendMessage({ message: 'get-storage', data: { key: key } });
    }
  }

  static async savePDInfo(info: NPDInfo) {
    const key = `${StorageKey.PDInfo}-${info.id}`;
    if (detectBexEnvironment() === BexEnvironment.Background) {
      await chrome.storage.local.set({ [key]: info });
    } else {
      await chrome.runtime.sendMessage({ message: 'set-storage', data: { key: key, value: info } });
    }
  }
}
