<!-- This is a popup page that runs inside an iframe. -->
<script setup lang="ts">
import { NotionPDInfo, Work } from 'src/models';
import WorkTable from 'components/WorkTable.vue';
import SearchPageDatabase from 'components/SearchPageDatabase.vue';
import { ref } from 'vue';

const works = ref<Work[]>([]); // 当前网页中提取的文献信息
const pageDatabaseObjs = ref<NotionPDInfo[]>([]); // 当前网页中提取的文献信息

window.addEventListener('message', (event) => {
  if (event.data.message === 'works') {
    works.value = event.data.data;
  }
});

function handleWorkTableMessage(message: string) {
  if (message === 'close-popup') {
    window.parent.postMessage({ message: 'close-popup' }, '*');
  }
}
</script>

<template>
  <div class="q-pa-md flex column justify-between" style="height: 100vh">
    <search-page-database :page-database-objs="pageDatabaseObjs"></search-page-database>
    <div style="height: 80%">
      <work-table
        v-if="works.length > 0"
        :works="works"
        :platform="works[0]?.['platform']"
        @close-popup="handleWorkTableMessage('close-popup')"
      ></work-table>
    </div>
  </div>
</template>

<style scoped></style>
