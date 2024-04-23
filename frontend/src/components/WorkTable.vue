<script setup lang="ts">
import { Platform, Work } from 'src/models';
import { nextTick, ref } from 'vue';

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
const emit = defineEmits(['works-selected']);

const selectedWorks = ref<Work[]>([]);

function handleSelection() {
  // 如果不使用 nextTick，会在 selectedWorks 还没更新时就 emit，导致 emit 的是上一个状态的值
  nextTick(() => {
    emit('works-selected', selectedWorks.value);
  });
}
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
        @selection="handleSelection"
      ></q-table>
    </div>
  </div>
</template>

<style scoped></style>
