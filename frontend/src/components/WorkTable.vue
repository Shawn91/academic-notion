<script setup lang="ts">
import { Platform, Work } from 'src/models';
import { ref } from 'vue';

const COLUMNS = [
  {
    name: 'title',
    label: 'Title',
    field: 'title',
    align: 'left' as const,
    style: 'width: 70%',
  },
  {
    name: 'publishedOn',
    label: 'Published On',
    field: (work: Work) => work.publishInfo?.containerTitle,
    align: 'left' as const,
    style: 'width: 20%',
  },
  {
    name: 'year',
    label: 'Year',
    field: (work: Work) => work.publishInfo?.year,
    align: 'left' as const,
    style: 'width: 10%',
  },
];

interface Props {
  works: Work[];
  platform: Platform | undefined; // 当前的 popup 是插入在哪个文献网站上的
}

const props = defineProps<Props>();
const emit = defineEmits(['close-popup']);

const selectedWorks = ref<Work[]>([]);
</script>

<template>
  <div id="work-table-container">
    <div id="work-table">
      <q-table
        :rows="props.works"
        :columns="COLUMNS"
        row-key="title"
        selection="multiple"
        v-model:selected="selectedWorks"
        :rows-per-page-options="[0]"
        bordered
        wrap-cells
        separator="cell"
      ></q-table>
    </div>
    <div id="work-table-footer" class="flex justify-end q-mt-lg q-mb-sm">
      <q-btn color="white" text-color="black" label="Cancel" @click="emit('close-popup')" />
      <q-btn color="primary" class="q-ml-lg" label="Upload" />
    </div>
  </div>
</template>

<style scoped>
#work-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

#work-table {
  flex: 1;
  overflow-y: auto;
}

#work-table-footer {
  flex-shrink: 0;
}
</style>
