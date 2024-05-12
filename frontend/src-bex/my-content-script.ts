import { scrapeWorks } from 'src/services/scrapers';
import { bexContent } from 'quasar/wrappers';

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === 'scrape-works') {
    scrapeWorks(document).then((works) => {
      if (works) {
        sendResponse(works);
      } else {
        sendResponse([]);
      }
    });
  }
  return true;
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
