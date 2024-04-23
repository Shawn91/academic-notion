<!-- This is a popup page that runs inside an iframe. -->
<script setup lang="ts">
import { NotionPDInfo, Work } from 'src/models';
import WorkTable from 'components/WorkTable.vue';
import { ref } from 'vue';
import SearchPageDatabase from 'components/SearchPageDatabase.vue';

const works = ref<Work[]>([]); // 当前网页中提取的文献信息
const pageDatabaseObjs = ref<NotionPDInfo[]>([]); // 当前网页中提取的文献信息
let selectedWorks: Work[] = []; // 选中的文献
let selectedPD: NotionPDInfo | null = null;
let page = ref('page-1');

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
  <div>
    <div class="page-container q-pa-md flex column justify-between" v-show="page === 'page-1'">
      <div id="work-table-container" class="page-container q-mt-sm">
        <work-table
          v-if="works.length > 0"
          :works="works"
          :platform="works[0]?.['platform']"
          @works-selected="handleWorksSelected"
        ></work-table>
      </div>
      <div class="footer-button-group flex justify-end q-mt-sm">
        <q-btn color="white" text-color="black" label="Cancel" @click="closePopup()" />
        <q-btn color="secondary" class="q-ml-md" label="Next" @click="page = 'page-2'" />
      </div>
    </div>
  </div>
  <div class="page-container q-pa-md flex column justify-between" v-show="page === 'page-2'">
    <search-page-database
      :page-database-objs="pageDatabaseObjs"
      @page-database-selected="handlePDSelected"
    ></search-page-database>
    <div class="footer-button-group flex justify-end q-mt-sm">
      <q-btn color="primary" label="Upload" @click="uploadWorks" />
      <q-btn color="white" class="q-ml-md" text-color="black" label="Cancel" @click="closePopup()" />
      <q-btn color="secondary" class="q-ml-md" label="Previous" @click="page = 'page-1'" />
    </div>
  </div>
</template>

<style scoped>
.page-container {
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
