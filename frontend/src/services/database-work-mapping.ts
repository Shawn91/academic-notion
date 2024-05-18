import { NPDInfo, NProperty, PDToWorkMapping, Work } from 'src/models/models';
import _ from 'lodash';

function extractDate(work: Work): string | null {
  const year = work['publishInfo']?.['year'];
  const month = work['publishInfo']?.['month'] ? work['publishInfo']['month'] : '01';
  const day = work['publishInfo']?.['day'] ? work['publishInfo']['day'] : '01';
  if (year) {
    return [year, month, day].join('-');
  }
  return null;
}

/**
 * 假设 database 有一列的列名是 description，则向这里插入数据时使用的数据格式为
 * {
 *   "description": {
 *             "rich_text": [
 *                 {
 *                     "text": {
 *                         "content": "A dark green leafy vegetable"
 *                     }
 *                 }
 *             ]
 *         }
 * }
 * 本函数的作用是给定 "A dark green leafy vegetable"（即 workPropertyValue 值）
 * 以及 description 字段的属性（即 PDProperty），生成上述格式中 "description" 的 value
 */
function generatePDItemValue(
  PDProperty: NProperty,
  workPropertyValue:
    | string
    | number
    | string[]
    | boolean
    | {
        name: string;
        url: string;
      }[],
  work: Work
) {
  const t = PDProperty['type'];
  if (typeof workPropertyValue === 'string') {
    workPropertyValue = workPropertyValue.slice(0, 2000);
  }
  if (t === 'rich_text' || t === 'title') {
    let value: string | undefined;
    if (typeof workPropertyValue === 'string') {
      value = workPropertyValue;
    } else if (typeof workPropertyValue === 'number') {
      value = workPropertyValue.toString();
      // @ts-ignore 虽然已经判断了是 array，但是 workPropertyValue.every 这里会报错。疑似是 ts bug，而且要到 5.2 版本才会修复
    } else if (workPropertyValue instanceof Array && workPropertyValue.every((ele) => typeof ele === 'string')) {
      value = workPropertyValue.join(';\n').slice(0, 2000);
    }
    if (value) {
      return { [t]: [{ text: { content: value } }] };
    }
  } else if (t === 'select' || t === 'status') {
    return { [t]: { name: workPropertyValue } };
  } else if (t === 'multi_select' && workPropertyValue instanceof Array) {
    return { [t]: workPropertyValue.map((v) => ({ name: v })) };
  } else if (t === 'url' || t === 'checkbox') {
    return { [t]: workPropertyValue };
  } else if (t === 'number') {
    return { [t]: typeof workPropertyValue === 'number' ? workPropertyValue : parseFloat(workPropertyValue as string) };
  } else if (t === 'date') {
    return { [t]: { start: workPropertyValue } };
  } else if (t === 'files' && typeof workPropertyValue === 'string') {
    // 默认 workPropertyValue 是文件下载链接

    // 这里使用了 "external" 字段，表示文件并非 notion 内的链接，而是外部链接
    // 如果想要改为 notion 内的文件，将 "external" 改为 "file"
    // 无论是notion内的链接，还是外部链接，插入后，在数据库中都是以超链接的形式展现，而非附件
    return { [t]: [{ name: work['title']?.slice(0, 100), external: { url: workPropertyValue } }] };
  }
  return null;
}

export function transformFromWorkToPDItem(mapping: PDToWorkMapping, work: Work) {
  const result: { [key: string]: any } = {};
  Object.keys(mapping).forEach((PDPropertyName) => {
    if (mapping[PDPropertyName] === null) return;
    const workPropertyName = mapping[PDPropertyName]?.['workPropertyName'];
    let PDItemValue;
    if (workPropertyName === 'date') {
      const date = extractDate(work);
      if (date) {
        PDItemValue = generatePDItemValue(mapping[PDPropertyName]?.['PDProperty'] as NProperty, date, work);
      }
    } else if (
      workPropertyName === 'publisher' ||
      workPropertyName === 'containerTitle' ||
      workPropertyName === 'pages' ||
      workPropertyName === 'volume' ||
      workPropertyName === 'issue' ||
      workPropertyName === 'year'
    ) {
      if (work['publishInfo']?.[workPropertyName]) {
        PDItemValue = generatePDItemValue(
          mapping[PDPropertyName]?.['PDProperty'] as NProperty,
          work['publishInfo'][workPropertyName] as string,
          work
        );
      }
    } else if (
      workPropertyName === 'resourceLink' &&
      work['digitalResources'] instanceof Array &&
      work['digitalResources']?.length > 0 &&
      work['digitalResources'][0][workPropertyName]
    ) {
      PDItemValue = generatePDItemValue(
        mapping[PDPropertyName]?.['PDProperty'] as NProperty,
        work['digitalResources']?.[0][workPropertyName] as string,
        work
      );
    } else if (workPropertyName === 'authors' && work['authors'] instanceof Array && work['authors'].length > 0) {
      PDItemValue = generatePDItemValue(
        mapping[PDPropertyName]?.['PDProperty'] as NProperty,
        work['authors'].map((ele) => ele.fullName as string),
        work
      );
    } else if (workPropertyName in work) {
      PDItemValue = generatePDItemValue(
        mapping[PDPropertyName]?.['PDProperty'] as NProperty,
        work[workPropertyName as keyof Work] as string,
        work
      );
    }
    if (PDItemValue) {
      result[PDPropertyName] = PDItemValue;
    }
  });
  return result;
}

/**
 * 部分 notion 数据库列的数据类型是不可能对应到一个文献字段上的。这里返回可能对应上的数据类型
 */
export function isCompatiblePDPropertyType(PDProperty: NProperty): boolean {
  return (
    PDProperty.type === 'date' ||
    PDProperty.type === 'files' ||
    PDProperty.type === 'multi_select' ||
    PDProperty.type === 'number' ||
    PDProperty.type === 'rich_text' ||
    PDProperty.type === 'select' ||
    PDProperty.type === 'title' ||
    PDProperty.type === 'url'
  );
}

/**
 * 用于比较一个 database 的新旧两个 schema 中的 properties 是否一致。
 * 只考虑 type 和 property name 即可。且只考虑 isCompatiblePDPropertyType 返回 true 的 property
 * @param properties1
 * @param properties2
 */
export function areSameProperties(
  properties1: { [p: string]: NProperty } | undefined,
  properties2: { [p: string]: NProperty } | undefined
): boolean {
  if (!properties1 || !properties2) return false;
  const compatibleProperties1 = Object.values(properties1).filter((p) => isCompatiblePDPropertyType(p));
  const compatibleProperties2 = Object.values(properties2).filter((p) => isCompatiblePDPropertyType(p));
  if (compatibleProperties1.length !== compatibleProperties2.length) return false;
  return _.isEqual(
    compatibleProperties1.reduce<{ [key: string]: string }>((acc, cur) => {
      acc[cur.name] = cur.type;
      return acc;
    }, {}),
    compatibleProperties2.reduce<{ [key: string]: string }>((acc, cur) => {
      acc[cur.name] = cur.type;
      return acc;
    }, {})
  );
}

/**
 * 根据新的数据库 schema，更新 mapping。考虑 3 种情况：
 * 1. 数据库新增了列，本函数不做处理
 * 2. 数据库删除了列，本函数会删除 mapping 中对应的属性
 * 3. 数据库修改了某个列的数据类型，本函数会修改 mapping 中对应的属性
 */
export function updateExistedPDToWorkMapping(mapping: PDToWorkMapping, newPDInfo: NPDInfo): PDToWorkMapping {
  // 数据库删除了某个列，mapping 中也要删除该列
  Object.keys(mapping).forEach((PDPropertyName) => {
    if (!(PDPropertyName in newPDInfo.properties)) {
      delete mapping[PDPropertyName];
    }
  });
  // 某个列的数据类型改变了，mapping 中也要修改该列
  Object.entries(newPDInfo.properties).forEach(([PDPropertyName, PDProperty]) => {
    if (PDPropertyName in mapping && PDProperty.type !== mapping[PDPropertyName]?.['PDProperty'].type) {
      mapping[PDPropertyName]['PDProperty'] = PDProperty;
    }
  });
  return mapping;
}
