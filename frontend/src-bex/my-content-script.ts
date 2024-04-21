import { ArxivScraper } from 'src/services/scrapers';
import { bexContent } from 'quasar/wrappers';

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message == 'popup-open') {
    const workIds = ArxivScraper.getWorkIds(document);
    // 向 background script 发送搜索结果页所有文献的 id，以便后端可以获取文献的详细信息
    chrome.runtime.sendMessage({ data: workIds, message: 'fetch-arxiv-works-info' }, (res) => {
      // 将获取到的 xml 格式文献信息解析后，发送给 popup
      const popup = document.getElementById('academic-notion-popup') as HTMLIFrameElement;
      if (popup) {
        popup.contentWindow?.postMessage(
          { data: ArxivScraper.parseWorks(res.data), message: 'works' },
          chrome.runtime.getURL('www/index.html#popup')
        );
      }
      sendResponse();
    });
  }
  return true;
});

window.addEventListener('message', function (event) {
  if (event.data.message === 'close-popup') {
    document.getElementById('academic-notion-popup')?.remove();
  }
});

export default bexContent((/* bridge */) => {
  // Hook into the bridge to listen for events sent from the client BEX.
  /*
  bridge.on('some.event', event => {
    if (event.data.yourProp) {
      // Access a DOM element from here.
      // Document in this instance is the underlying website the contentScript runs on
      const el = document.getElementById('some-id')
      if (el) {
        el.value = 'Quasar Rocks!'
      }
    }
  })
  */
});
