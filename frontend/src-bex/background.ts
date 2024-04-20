import { bexBackground } from 'quasar/wrappers';
import { ArxivScraper } from 'src/services/scrapers';

/**
 * This function will be injected into active tab.
 * Therefore, it has access to 'document' and 'window' objects.
 */
function InjectPopup() {
  // 多次打开弹窗，只保留最新的一个
  if (document.getElementById('academic-notion-popup')) {
    document.body.removeChild(document.getElementById('academic-notion-popup') as HTMLIFrameElement);
  }
  const popup = document.createElement('iframe');
  popup.src = chrome.runtime.getURL('www/index.html#popup');
  const popupWidth = 70; // 页面宽度的百分比
  const popupHeight = 70; // 页面可视高度的百分比
  popup.style.width = `${popupWidth}vw`;
  popup.style.height = `${popupHeight}vh`;
  popup.style.padding = '16px';
  popup.style.background = '#fff';
  popup.style.position = 'fixed';
  popup.style.left = `${(100 - popupWidth) / 2}vw`;
  popup.style.top = `${(100 - popupHeight) / 2}vh`;
  popup.style.boxShadow = '0 0 32px rgba(0, 0, 0, 0.5)';
  popup.style.border = 'none';
  popup.style.zIndex = '9999';
  popup.id = 'academic-notion-popup';
  document.body.appendChild(popup);
  return popup;
}

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting
    .executeScript({
      // @ts-ignore: 'tabId' raises an error warning in PyCharm while it actually works fine.
      target: { tabId: tab.id },
      func: InjectPopup,
    })
    .then(() => {
      // tell the active tab that the popup has been opened
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id as number, { message: 'popup-open' });
      });
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message == 'fetch-arxiv-works-info') {
    ArxivScraper.fetchRawWorksInfo(request.data).then((res) => {
      sendResponse({ data: res });
    });
  }
  return true;
});

export default bexBackground((bridge /* , allActiveConnections */) => {
  bridge.on('log', ({ data, respond }) => {
    console.log(`[BEX] ${data.message}`, ...(data.data || []));
    // @ts-ignore: 'respond()' raises an error warning in PyCharm while it actually works fine.
    respond();
  });

  bridge.on('getTime', ({ respond }) => {
    respond(Date.now());
  });

  bridge.on('storage.get', ({ data, respond }) => {
    const { key } = data;
    if (key === null) {
      chrome.storage.local.get(null, (items) => {
        // Group the values up into an array to take advantage of the bridge's chunk splitting.
        respond(Object.values(items));
      });
    } else {
      chrome.storage.local.get([key], (items) => {
        respond(items[key]);
      });
    }
  });
  // Usage:
  // const { data } = await bridge.send('storage.get', { key: 'someKey' })

  bridge.on('storage.set', ({ data, respond }) => {
    chrome.storage.local.set({ [data.key]: data.value }, () => {
      respond();
    });
  });
  // Usage:
  // await bridge.send('storage.set', { key: 'someKey', value: 'someValue' })

  bridge.on('storage.remove', ({ data, respond }) => {
    chrome.storage.local.remove(data.key, () => {
      respond();
    });
  });
});
