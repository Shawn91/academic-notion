import { NPDInfo, PDToWorkMapping, SavedPDToWorkMapping } from 'src/models/models';
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
    // key 是 database id。value 中包含了 mapping 本身，以及上次存储 mapping 到本地的时间
    let mappings: { [key: string]: SavedPDToWorkMapping };
    if (detectBexEnvironment() === BexEnvironment.Background) {
      mappings = (await chrome.storage.local.get([StorageKey.PDToWorkMapping]))?.[StorageKey.PDToWorkMapping];
    } else {
      mappings = await chrome.runtime.sendMessage({
        message: 'get-storage',
        data: { key: StorageKey.PDToWorkMapping },
      });
    }
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
  static async savePDToWorkMapping(PDId: string, mapping: PDToWorkMapping) {
    let existedMappings = (await UserDataLocalManager.getPDToWorkMapping()) as {
      [key: string]: SavedPDToWorkMapping;
    } | null;
    if (!existedMappings) {
      existedMappings = {};
    }
    existedMappings[PDId] = { mapping: mapping, lastSaveTime: new Date() };
    if (detectBexEnvironment() === BexEnvironment.Background) {
      await chrome.storage.local.set({ [StorageKey.PDToWorkMapping]: existedMappings });
    } else {
      await chrome.runtime.sendMessage({
        message: 'set-storage',
        data: { key: StorageKey.PDToWorkMapping, value: existedMappings },
      });
    }
  }
}
