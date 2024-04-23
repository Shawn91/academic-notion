<!--流程：
1. PopupPage.vue 调用本组件时，传入一个 pageDatabaseObjs 数组，存储的是过往已经上传过的 pages 或 databases
（暂时未考虑如果这个 page 或 database 已经删除了怎么办）
2. 本组件内，在搜索框输入关键字时，默认是从 pageDatabaseObjs 中过滤
3. 在搜索框输入关键字后，点击搜索按钮，此时向后端发送请求，搜索包含关键字的 pages 或 databases，并覆盖 pageDatabaseObjs
4. 如果搜索框中的关键字并不在 pageDatabaseObjs 中，那么当搜索框失焦后，会自动删除关键字，因此为了确保点击搜索按钮时，
  还能获取到关键字，所以需要一个 titleQuery 变量，每当搜索框内容变化时（即调用 filter 函数时），更新 titleQuery
-->
<script setup lang="ts">
import { ref } from 'vue';
import { NotionPDInfo } from 'src/models';
import { Response } from 'src/services/api';
import { QSelect } from 'quasar';

interface Props {
  pageDatabaseObjs: NotionPDInfo[];
}

const props = defineProps<Props>();
const selectedPageDatabase = ref<NotionPDInfo | null>(null);
const qSelectComponent = ref<QSelect | null>(null);
let titleQuery = ''; // 用于搜索的关键字

const pageDatabaseOptions = ref(props.pageDatabaseObjs);
const filteredPageDatabaseOptions = ref(props.pageDatabaseObjs);
const emit = defineEmits(['page-database-selected']);

function filterByTitle(val: string, update: (arg0: () => void) => void) {
  update(() => {
    titleQuery = val;
    const needle = val.toLowerCase();
    filteredPageDatabaseOptions.value = pageDatabaseOptions.value.filter(
      (v) => v.title.toLowerCase().indexOf(needle) > -1
    );
  });
}

/**
 * 根据标题搜索 pages 或 databases
 */
function searchByTitle() {
  chrome.runtime.sendMessage(
    {
      message: 'fetch-pages-databases-by-title',
      data: { query: titleQuery },
    },
    function (res: Response<NotionPDInfo[]>) {
      if (res.success) {
        pageDatabaseOptions.value = res.data;
        selectedPageDatabase.value = null;
        qSelectComponent.value?.showPopup();
      }
    }
  );
}

/**
 * 每当用户选择一个 pages 或 databases 时，调用此函数，通知父组件
 */
function handleSelection() {
  emit('page-database-selected', selectedPageDatabase.value);
}
</script>

<template>
  <div>
    <q-select
      ref="qSelectComponent"
      v-model="selectedPageDatabase"
      :options="filteredPageDatabaseOptions"
      use-input
      rounded
      outlined
      input-debounce="0"
      option-label="title"
      use-chips
      @filter="filterByTitle"
      label="Search for a database to upload to"
      @update:model-value="handleSelection"
    >
      <template v-slot:prepend>
        <q-icon name="mdi-database-search-outline" />
      </template>
      <template v-slot:after>
        <q-btn round dense flat icon="mdi-magnify" size="1em" @click="searchByTitle" />
      </template>
    </q-select>
  </div>
</template>

<style scoped></style>
