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
</script>

<template>
  <work-table :works="works" :platform="works[0]?.['platform']"></work-table>
</template>

<style scoped></style>
