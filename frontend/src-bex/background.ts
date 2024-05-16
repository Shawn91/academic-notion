import { bexBackground } from 'quasar/wrappers';
import { ArxivScraper } from 'src/services/scrapers';
import { fetchPageDatabaseByID, searchPageDatabaseByTitle, uploadWorks } from 'src/services/api';
import { Work } from 'src/models/models';
import { UserAuthManager, UserDataLocalManager } from 'src/services/user-data-manager';

function createNewWindow(): Promise<chrome.windows.Window> {
  return new Promise((resolve, reject) => {
    const windowWidth = 1000;
    const windowHeight = 700;
    chrome.windows.getCurrent({}, (currentWindow) => {
      if (
        currentWindow.left !== undefined &&
        currentWindow.top !== undefined &&
        currentWindow.width !== undefined &&
        currentWindow.height !== undefined
      ) {
        // 通过计算，让新弹出的窗口位于当前窗口中间
        const left = Math.round(currentWindow.left + currentWindow.width / 2 - windowWidth / 2);
        const top = Math.round(currentWindow.top + currentWindow.height / 2 - windowHeight / 2);

        // Create the new window at the calculated position
        chrome.windows.create(
          {
            url: chrome.runtime.getURL('www/index.html#popup'),
            type: 'popup',
            width: windowWidth,
            height: windowHeight,
            left: left,
            top: top,
          },
          (newWindow) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(newWindow as chrome.windows.Window);
            }
          }
        );
      }
    });
  });
}

// 流程：
// 1. 当用户正在访问 arxiv 或其他文献网站时，点击了插件 icon。打开新窗口
// 2. 等待窗口内的页面彻底加载完毕，然后通知文献网站的 content script，令其开始获取文献列表
// 3. 文献网站的 content script 获取当前页面的文献，然后将文献列表发送给 background script
// 4. background script 将接收到的文献列表发送给新窗口
chrome.action.onClicked.addListener((tab) => {
  let workTabId: number | undefined; // 文献网站所在 tab 的 id
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    workTabId = tabs[0].id;
    if (!workTabId) return;
    createNewWindow().then((newWindow) => {
      // 打开新窗口后要监听窗口是否加载内容完毕。加载完毕后再去获取文献列表
      chrome.runtime.onMessage.addListener(function listener(request, sender, sendResponse) {
        if (request.message === 'popup-mounted') {
          chrome.runtime.onMessage.removeListener(listener); // 新窗口的网页已经加载完毕，可以移除这个监听了
          // tell the tab that the popup has been opened
          chrome.tabs.sendMessage(workTabId as number, { message: 'scrape-works' }).then((res: Work[] | undefined) => {
            if (res) {
              chrome.tabs.sendMessage(newWindow.tabs?.[0].id as number, {
                message: 'works',
                data: res,
              });
            }
          });
        }
      });
    });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message == 'fetch-arxiv-works-info') {
    ArxivScraper.fetchRawWorksInfo(request.data).then((res) => {
      sendResponse({ data: res });
    });
  } else if (request.message == 'fetch-pages-databases') {
    // 根据关键字搜索数
    if (request.data.query) {
      UserDataLocalManager.getAccessTokenWithWorkspaces(undefined, request.data.workspaceId).then(
        (accessTokenWithWorkspace) => {
          searchPageDatabaseByTitle(request.data.query, accessTokenWithWorkspace?.access_token as string).then(
            (res) => {
              sendResponse(res);
            }
          );
        }
      );
    } else if (request.data.id) {
      // 根据 id 直接获取该 page/database 的最新信息
      UserDataLocalManager.getAccessTokenWithWorkspaces(undefined, request.data.workspaceId).then(
        (accessTokenWithWorkspace) => {
          fetchPageDatabaseByID(
            request.data.id,
            request.data.PDType,
            accessTokenWithWorkspace?.access_token as string
          ).then((res) => {
            sendResponse(res);
          });
        }
      );
    }
  } else if (request.message == 'upload-works') {
    UserDataLocalManager.getAccessTokenWithWorkspaces(undefined, request.data['workspaceId']).then(
      (accessTokenWithWorkspace) => {
        uploadWorks(
          request.data['pageDatabase'],
          request.data['works'],
          request.data['databaseToWorkMapping'],
          accessTokenWithWorkspace?.access_token as string
        ).then((res) => {
          sendResponse(res);
        });
      }
    );
  } else if (request.message == 'set-storage') {
    chrome.storage.local.set({ [request.data['key']]: request.data['value'] }, () => {
      sendResponse(true);
    });
  } else if (request.message == 'get-storage') {
    chrome.storage.local.get([request.data['key']], (items) => {
      sendResponse(items[request.data['key']]);
    });
  } else if (request.message == 'notion-auth') {
    UserAuthManager.notionAuth().then(() => {
      sendResponse(true);
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
