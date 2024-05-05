<script setup lang="ts">
import { Platform, Work } from 'src/models/models';

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
// 如果当前页面只有一篇论文，则自动勾选上。如果有多篇论文，则默认都不勾选
const selectedWorks = defineModel<Work[]>('selectedWorks', { default: [] });
</script>

<template>
  <div id="work-table-container">
    <div id="work-table">
      <q-table
        :rows="props.works"
        :columns="COLUMNS"
        title="Select Papers to Upload"
        row-key="title"
        selection="multiple"
        v-model:selected="selectedWorks"
        :rows-per-page-options="[0]"
        bordered
        wrap-cells
        separator="cell"
      ></q-table>
    </div>
  </div>
</template>

<style scoped></style>
