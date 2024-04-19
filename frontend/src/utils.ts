/**
 * 从 2007-02-27 00:00:00 格式的字符串中提取出年月日
 */
export function extractDateNumsFromStr(str: string): { year: number; month: number; day: number } | null {
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    return null;
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function isNullOrUndefined(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * 对两个 objects 取并集。要符合如下规则，当一个 key 在 obj1 和 obj2 都有时：
 *   1. 如果 values 都是 array， 合并 array，并去除重复值
 *   2. 如果 value 一个是 null/undefined，另一个不是，取非 null/undefined
 *   3. 如果 values 是 object，则递归调用 mergeObjects 合并
 *   4. 其他情况下，取 obj1 的 value
 * 当 key 只在 obj1 或 obj2 中才有时，最终结果要包含这个值
 */
export function mergeObjects<T extends object, U extends object>(obj1: T, obj2: U): T & U {
  const result: any = {};

  // 获取两个对象所有的键
  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  keys.forEach((key) => {
    const value1 = obj1[key as keyof T];
    const value2 = obj2[key as keyof U];

    // 规则 1: 如果 values 都是 array，合并 array，并去除重复值
    if (Array.isArray(value1) && Array.isArray(value2)) {
      result[key] = Array.from(new Set([...value1, ...value2]));
    }
    // 规则 2: 如果 value 一个是 null/undefined，另一个不是，取非 null/undefined 的 value
    else if (isNullOrUndefined(value1)) {
      result[key] = value2;
    } else if (isNullOrUndefined(value2)) {
      result[key] = value1;
    }
    // 规则 3: 如果 values 是 object，则递归调用 mergeObjects 合并
    else if (typeof value1 === 'object' && value1 !== null && typeof value2 === 'object' && value2 !== null) {
      result[key] = mergeObjects(value1, value2);
    }
    // 规则 4: 其他情况下，取 obj1 的 value
    else {
      result[key] = value1;
    }
  });
  return result;
}
