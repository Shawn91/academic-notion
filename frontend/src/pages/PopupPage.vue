<!-- This is a popup page that runs inside an iframe. -->
<script setup lang="ts">
import { NPDInfo, PDToWorkMapping, SavedPDToWorkMapping, Work } from 'src/models/models';
import WorkTable from 'components/WorkTable.vue';
import { onBeforeMount, ref } from 'vue';
import SearchPageDatabase from 'components/SearchPageDatabase.vue';
import { UserDataLocalManager } from 'src/services/user-data-manager';
import _ from 'lodash';
import { areSameProperties } from 'src/services/database-work-mapping';

const works = ref<Work[]>([]); // 当前网页中提取的文献信息
const existedPDInfo = ref<{ [key: string]: NPDInfo }>({}); // 过往上传过文献的数据库的信息

// 存储当前用户选中的 database column 到 work property 的对应关系。
// key 是 database 的 column 列名
const existedPDToWorkMappings = ref<{ [key: string]: SavedPDToWorkMapping }>({});

let selectedWorks: Work[] = []; // 选中的文献
let selectedPDId = ref<string | undefined>(undefined);
// 当前 popup page 是分为了多页，当前展示第几页
let pageNum = ref('page-1');

const showPDInfoOutdatedDialog = ref(false);

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
  if (!selectedPDId.value) return;
  await chrome.runtime.sendMessage({
    data: {
      works: selectedWorks,
      pageDatabase: existedPDInfo.value[selectedPDId.value],
      databaseToWorkMapping: existedPDToWorkMappings.value[selectedPDId.value]['mapping'],
    },
    message: 'upload-works',
  });
}

/**
 * 点击上传按钮后:
 * 1. 要获取当前选中的 database 的最新的 schema（因为当前的 mapping 可能不是最新的，而是保存的旧的）
 * 2. 比较当前的 schema 与上次提交文献时，该 database 保存在本地的 schema 是否相同
 * 3. 如果不相同需要弹窗提示用户重新设置 mapping，如果相同则直接上传文献
 * 4. 根据新的 schema，尽可能帮用户自动推测 mapping，然后让用户调整。
 * 5. 当用户再次点击上传，此时的 schema 与 mapping 肯定已经对应上，直接上传
 */
async function handleUploadWorkButtonClicked() {
  if (!selectedPDId.value) return;
  // 1. ；远程获取当前选中的 database 的最新的 schema
  const selectedPDLatestInfo: NPDInfo = (
    await chrome.runtime.sendMessage({
      message: 'fetch-pages-databases',
      data: { id: selectedPDId.value, PDType: 'database' },
    })
  ).data;
  const selectedPDOldInfo = (await UserDataLocalManager.getPDInfo(selectedPDId.value)) as NPDInfo;
  if (areSameProperties(selectedPDLatestInfo.properties, selectedPDOldInfo?.properties)) {
    await UserDataLocalManager.savePDToWorkMapping(
      selectedPDId.value as string,
      existedPDToWorkMappings.value[selectedPDId.value]['mapping'] as PDToWorkMapping
    );
    await uploadWorks(); // 一致，直接上传文献
  } else {
    // 当 selectedPDOldInfo 为 null/undefined 时，说明是第一次上传，不需要提示用户重新设置 mapping。否则需要弹窗提示用户
    showPDInfoOutdatedDialog.value = Boolean(selectedPDOldInfo);
    // 更新展示的数据库列
    existedPDInfo.value[selectedPDId.value] = selectedPDLatestInfo;
    await UserDataLocalManager.savePDInfo(selectedPDLatestInfo);
  }
}

onBeforeMount(async () => {
  // 加载此前上传过文献的所有数据库的 schema
  const retrievedExistedPDInfo = (await UserDataLocalManager.getPDInfo()) as Record<string, NPDInfo> | null;
  if (retrievedExistedPDInfo) {
    existedPDInfo.value = retrievedExistedPDInfo;
  }
  // 加载此前上传过文献的数据库与文献属性的对应关系
  const retrievedPDToWorkMappings = (await UserDataLocalManager.getPDToWorkMapping()) as {
    [key: string]: SavedPDToWorkMapping;
  } | null;
  if (retrievedPDToWorkMappings) {
    existedPDToWorkMappings.value = retrievedPDToWorkMappings;
    // 找到最近一次上传的数据库，将 id 赋值给 selectedPDId
    const lastSavedPDIdAndMapping = _.maxBy(
      Object.entries(existedPDToWorkMappings.value),
      ([_, savedPDToWorkMapping]) => {
        return savedPDToWorkMapping['lastSaveTime'] ? savedPDToWorkMapping['lastSaveTime'].getTime() : 0;
      }
    );
    if (lastSavedPDIdAndMapping) {
      selectedPDId.value = lastSavedPDIdAndMapping[0];
    }
  }
});
</script>

<template>
  <div>
    <div class="page-container q-pa-md flex column justify-between" v-show="pageNum === 'page-1'">
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
        <q-btn color="secondary" class="q-ml-md" label="Next" @click="pageNum = 'page-2'" />
      </div>
    </div>
  </div>
  <div class="page-container q-pa-md flex column justify-between no-wrap" v-show="pageNum === 'page-2'">
    <div style="max-width: 800px; width: 100%; align-self: center; flex: 1; overflow-y: auto">
      <search-page-database
        v-model:existedPDInfo="existedPDInfo"
        v-model:selectedPDId="selectedPDId"
        v-model:existedPDToWorkMappings="existedPDToWorkMappings"
      ></search-page-database>
    </div>
    <div class="footer-button-group flex justify-end q-mt-sm">
      <q-btn color="primary" label="Upload" @click="handleUploadWorkButtonClicked" />
      <q-btn color="white" class="q-ml-md" text-color="black" label="Cancel" @click="closePopup()" />
      <q-btn color="secondary" class="q-ml-md" label="Back" @click="pageNum = 'page-1'" />
    </div>

    <q-dialog v-model="showPDInfoOutdatedDialog" persistent>
      <q-card>
        <q-card-section class="items-center column">
          <q-avatar icon="published_with_changes" color="primary" text-color="white" />
          <span class="q-ml-sm q-mt-md"
            >You have modified your database columns since last upload. Please double-check whether the mapping is
            correct and click the "UPLOAD" button again to proceed.</span
          >
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
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
