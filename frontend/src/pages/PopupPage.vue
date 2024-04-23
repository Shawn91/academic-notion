<!-- This is a popup page that runs inside an iframe. -->
<script setup lang="ts">
import { NotionPDInfo, Work } from 'src/models';
import WorkTable from 'components/WorkTable.vue';
import SearchPageDatabase from 'components/SearchPageDatabase.vue';
import { ref } from 'vue';

const works = ref<Work[]>([]); // 当前网页中提取的文献信息
const pageDatabaseObjs = ref<NotionPDInfo[]>([]); // 当前网页中提取的文献信息
let selectedWorks: Work[] = []; // 选中的文献
let selectedPD: NotionPDInfo | null = null;

window.addEventListener('message', (event) => {
  if (event.data.message === 'works') {
    works.value = event.data.data;
  }
});

function closePopup() {
  window.parent.postMessage({ message: 'close-popup' }, '*');
}

/**
 * 用户勾选或取消勾选了文献时触发
 */
function handleWorksSelected(data: Work[]) {
  selectedWorks = data;
}

/**
 * 用户选择了一个 page 或 database 时触发
 */
function handlePDSelected(data: NotionPDInfo) {
  selectedPD = data;
}

function uploadWorks() {
  chrome.runtime.sendMessage(
    {
      data: { works: selectedWorks, pageDatabase: selectedPD },
      message: 'upload-works',
    },
    (res) => {
      console.log(res);
    }
  );
}
</script>

<template>
  <div class="q-pa-md flex column justify-between" id="popup-container">
    <search-page-database
      :page-database-objs="pageDatabaseObjs"
      @page-database-selected="handlePDSelected"
    ></search-page-database>
    <div id="work-table-container" class="q-mt-sm">
      <work-table
        v-if="works.length > 0"
        :works="works"
        :platform="works[0]?.['platform']"
        @works-selected="handleWorksSelected"
      ></work-table>
    </div>
    <div id="footer-button-group" class="flex justify-end q-mt-sm">
      <q-btn color="white" text-color="black" label="Cancel" @click="closePopup()" />
      <q-btn color="primary" class="q-ml-lg" label="Upload" @click="uploadWorks" />
    </div>
  </div>
</template>

<style scoped>
#popup-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#work-table-container {
  flex: 1;
  overflow-y: auto;
}

#footer-button-group {
  flex-shrink: 0;
}
</style>
