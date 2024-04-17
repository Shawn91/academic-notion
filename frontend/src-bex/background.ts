import { bexBackground } from 'quasar/wrappers';

/**
 * This function will be injected into active tab.
 * Therefore, it has access to 'document' and 'window' objects.
 */
function InjectPopup() {
  const popup = document.createElement('iframe');
  popup.src = chrome.runtime.getURL('www/index.html#popup');
  popup.style.width = '60vw';
  popup.style.height = '70vh';
  popup.style.margin = 'auto';
  popup.style.padding = '16px';
  popup.style.background = '#fff';
  popup.style.position = 'fixed';
  popup.style.left = '20vw';
  popup.style.top = '15vh';
  popup.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  popup.style.border = 'none';
  popup.style.zIndex = '9999';
  popup.id = 'academic-notion-popup';
  document.body.appendChild(popup);
  return popup;
}

// chrome.runtime.onInstalled.addListener(openExtension);
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    // @ts-ignore: 'tabId' raises an error warning in PyCharm while it actually works fine.
    target: { tabId: tab.id },
    func: InjectPopup,
  });
});

declare module '@quasar/app-vite' {
  interface BexEventMap {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    log: [{ message: string; data?: any[] }, never];
    getTime: [never, number];

    'storage.get': [{ key: string | null }, any];
    'storage.set': [{ key: string; value: any }, any];
    'storage.remove': [{ key: string }, any];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

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
  // Usage:
  // await bridge.send('storage.remove', { key: 'someKey' })

  /*
  // EXAMPLES
  // Listen to a message from the client
  bridge.on('test', d => {
    console.log(d)
  })

  // Send a message to the client based on something happening.
  chrome.tabs.onCreated.addListener(tab => {
    bridge.send('browserTabCreated', { tab })
  })

  // Send a message to the client based on something happening.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      bridge.send('browserTabUpdated', { tab, changeInfo })
    }
  })
   */
});
