<!-- This is a popup page that runs inside an iframe. -->
<script setup lang="ts">
import { Work } from 'src/models';
import WorkTable from 'components/WorkTable.vue';
import { ref } from 'vue';

let works = ref<Work[]>([]);

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
  <div style="height: 100vh">
    <work-table
      v-if="works.length > 0"
      :works="works"
      :platform="works[0]?.['platform']"
      @close-popup="handleWorkTableMessage('close-popup')"
    ></work-table>
  </div>
</template>

<style scoped></style>
