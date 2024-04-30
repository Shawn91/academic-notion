import { NProperty, PDToWorkMapping, Work } from 'src/models/models';

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
    | string[]
    | boolean
    | {
        name: string;
        url: string;
      }[]
) {
  const t = PDProperty['type'];
  if (t === 'rich_text' || t === 'title') {
    return { [t]: [{ text: { content: workPropertyValue } }] };
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
    return { [t]: [{ name: workPropertyValue, external: { url: workPropertyValue } }] };
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
        PDItemValue = generatePDItemValue(mapping[PDPropertyName]?.['PDProperty'] as NProperty, date);
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
          work['publishInfo'][workPropertyName] as string
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
        work['digitalResources']?.[0][workPropertyName] as string
      );
    } else if (workPropertyName in work) {
      PDItemValue = generatePDItemValue(
        mapping[PDPropertyName]?.['PDProperty'] as NProperty,
        work[workPropertyName as keyof Work] as string
      );
    }
    if (PDItemValue) {
      result[PDPropertyName] = PDItemValue;
    }
  });
  return result;
}

/**
 * 判断文献的数据类型与数据库列的数据类型是否匹配
 */
function checkMappingType() {
  console.log('xxx');
}
