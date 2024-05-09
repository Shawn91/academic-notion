/**
 * 从任意格式的字符串中提取出年月日。目前支持的格式
 * 2014-07-02 年-月-日
 * 6 May 2024 日 英文月 年
 * May 2014 英文月 年
 */
export function extractDateNumsFromStr(str: string): { year: string; month: string; day: string } | undefined {
  const monthWords = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  for (const datePat of ['\\d{4}-\\d{2}-\\d{2}', `(\\d{1,2} )?(${monthWords.join('|')}) \\d{4}`]) {
    const regexp = new RegExp(datePat, 'i');
    const dateMatch = regexp.exec(str);
    if (!dateMatch) continue;
    const date = new Date(dateMatch[0]);
    if (isNaN(date.getTime())) {
      continue;
    }
    return {
      year: date.getFullYear().toString(),
      month: date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : (date.getMonth() + 1).toString(),
      day: date.getDate() < 10 ? `0${date.getDate()}` : date.getDate().toString(),
    };
  }
  return undefined;
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
  /* eslint-disable  @typescript-eslint/no-explicit-any */
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

export const enum BexEnvironment {
  Background = 'background',
  Content = 'content',
  Popup = 'popup', // 这个 Popup 指的是点击 icon 后的弹窗，而非插入到网页中的 iframe popup
  Options = 'options',
  Devtools = 'devtools',
}

/**
 * 当一个函数可能被 background.js 和 content.js 等调用时，需要判断当前运行环境
 */
export function detectBexEnvironment(): BexEnvironment {
  try {
    if (window.location.href.includes('/popup')) {
      return BexEnvironment.Popup;
    }
    // options 和 devtools 的判断方法还没查，这里是猜的
    if (window.location.href.includes('options.html')) {
      return BexEnvironment.Options;
    }
    if (window.location.href.includes('devtools.html')) {
      return BexEnvironment.Devtools;
    }
    return BexEnvironment.Content;
  } catch (e) {
    return BexEnvironment.Background;
  }
}

/**
 * 用于等待某个元素 X 被加载到 DOM 树中
 * @param parentNode X 被加载到 DOM 树中的父元素
 * @param selectors 多个 selection queries，其中任意一个被检索到视为 X 插入成功
 * @param timeout 最大等待时间（毫秒）
 */
export function waitForElement(parentNode: Element, selectors: string[], timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if the element already exists
    if (selectors.some((selector) => parentNode.querySelector(selector))) {
      resolve();
      return;
    }
    const observer = new MutationObserver((mutations, obs) => {
      if (selectors.some((selector) => parentNode.querySelector(selector))) {
        clearTimeout(timeoutId); // Clear the timeout if the element is found
        obs.disconnect();
        resolve();
      }
    });

    observer.observe(parentNode, {
      childList: true,
      subtree: true,
    });

    // Set up a timeout to stop waiting after a specified time
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout: Failed to find element within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * 从任意字符串中匹配类似 "Volume 101" 这样的文本，返回 101
 */
export function extractVolume(str: string): string | null {
  const match = str.match(/[Vv]olume\s+(\d+)/);
  return match ? match[1] : null;
}

/**
 * 从任意字符串中匹配类似 "Pages 101-102" 这样的文本，返回 101
 * @param str
 */
export function extractPages(str: string): string | null {
  const match = str.match(/Pages\s+(\d+-\d+)/);
  return match ? match[1] : null;
}
