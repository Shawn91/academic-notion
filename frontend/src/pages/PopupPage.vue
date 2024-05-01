<!-- This is a popup page that runs inside an iframe. -->
<script setup lang="ts">
import { NPDInfo, PDToWorkMapping, Work } from 'src/models/models';
import WorkTable from 'components/WorkTable.vue';
import { ref } from 'vue';
import SearchPageDatabase from 'components/SearchPageDatabase.vue';
import { UserDataLocalManager } from 'src/services/user-data-manager';
import { is } from 'quasar';

const works = ref<Work[]>([]); // 当前网页中提取的文献信息
const pageDatabaseObjs = ref<NPDInfo[]>([]); // 当前网页中提取的文献信息
let selectedWorks: Work[] = []; // 选中的文献
let selectedPD = ref<NPDInfo | null>(null);
// 当前 popup page 是分为了多页，当前展示第几页
let page = ref('page-1');

// 存储用户定义的 database column 到 work property 的对应关系。
// key 是 database 的 column 列名，value 中 PDPropertyName 还是 column 列名，PDProperty 是该列的属性，
// WorkPropertyLabel 是 DisplayedWorkProperties 中的各个 Label 值
let databaseToWorkMapping: PDToWorkMapping = {};

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

async function uploadWorks() {
  await chrome.runtime.sendMessage({
    data: { works: selectedWorks, pageDatabase: selectedPD.value, databaseToWorkMapping: databaseToWorkMapping },
    message: 'upload-works',
  });
}

/**
 * 点击上传按钮后:
 * 1. 要获取当前选中的 database 的最新的 schema（因为当前的 mapping 可能不是最新的，而是保存的旧的）
 * 2. 比较当前的 schema 与保存在本地的 mapping 中的 schema 是否相同
 * 3. 如果不相同需要弹窗提示用户重新设置 schema，如果相同则直接上传
 * 4. 根据新的 schema，尽可能帮用户自动推测 mapping，然后让用户调整。
 * 5. 当用户再次点击上传，此时的 schema 与 mapping 肯定已经对应上，直接上传
 */
async function handleUploadWorkButtonClicked() {
  // 1. 获取当前选中的 database 的最新的 schema
  const selectedPDInfo: NPDInfo = (
    await chrome.runtime.sendMessage({
      message: 'fetch-pages-databases',
      data: { id: selectedPD.value?.id, PDType: 'database' },
    })
  ).data;
  const selectedPDOldInfo = await UserDataLocalManager.getPDInfo(selectedPDInfo.id);
  // 2. 比较最新 schema 与旧的 schema 之间是否一致
  if (is.deepEqual(selectedPDInfo.properties, selectedPDOldInfo?.properties)) {
    await uploadWorks(); // 一致，直接上传
  } else {
    // 保存最新的 schema 到本地
    await UserDataLocalManager.savePDInfo(selectedPDInfo);
  }
}

/**
 * 从 SearchPageDatabase.vue 子组件传递过来的用户定义的 database column 到 work property 的对应关系
 */
function handleDatabaseWorkMapping(data: PDToWorkMapping) {
  databaseToWorkMapping = data;
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
  <div class="page-container q-pa-md flex column justify-between no-wrap" v-show="page === 'page-2'">
    <div style="max-width: 800px; width: 100%; align-self: center; flex: 1; overflow-y: auto">
      <search-page-database
        :page-database-objs="pageDatabaseObjs"
        @database-work-mapped="handleDatabaseWorkMapping"
        v-model:selectedPD="selectedPD"
      ></search-page-database>
    </div>
    <div class="footer-button-group flex justify-end q-mt-sm">
      <q-btn color="primary" label="Upload" @click="handleUploadWorkButtonClicked" />
      <q-btn color="white" class="q-ml-md" text-color="black" label="Cancel" @click="closePopup()" />
      <q-btn color="secondary" class="q-ml-md" label="Back" @click="page = 'page-1'" />
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
</style>
