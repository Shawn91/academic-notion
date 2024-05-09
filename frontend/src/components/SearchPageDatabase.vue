<!--流程：
1. PopupPage.vue 调用本组件时，传入一个 existedPDInfo 数组，存储的是过往已经上传过的 pages 或 databases
（暂时未考虑如果这个 page 或 database 已经删除了怎么办）
2. 本组件内，在搜索框输入关键字时，默认是从 existedPDInfo 中过滤
3. 在搜索框输入关键字后，点击搜索按钮，此时向后端发送请求，搜索包含关键字的 pages 或 databases，并覆盖 existedPDInfo
4. 如果搜索框中的关键字并不在 existedPDInfo 中，那么当搜索框失焦后，会自动删除关键字，因此为了确保点击搜索按钮时，
  还能获取到关键字，所以需要一个 titleQuery 变量，每当搜索框内容变化时（即调用 filter 函数时），更新 titleQuery
-->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  NPDInfo,
  NProperty,
  PDToWorkMapping,
  Platform,
  SavedPDToWorkMapping,
  WorkPropertyKeys,
} from 'src/models/models';
import { Response } from 'src/services/api';
import { QSelect } from 'quasar';
import { isCompatiblePDPropertyType } from 'src/services/database-work-mapping';

// 用于在 q-select 中提示用户，本程序支持哪些文献属性
const DisplayedWorkProperties: {
  label: string;
  icon: string;
  children: { label: string; key: WorkPropertyKeys; description: string }[];
}[] = [
  {
    label: 'Basic Info',
    icon: 'mdi-information-outline',
    children: [
      {
        label: 'Title',
        key: 'title',
        description: 'The title of the paper',
      },
      {
        label: 'Authors',
        key: 'authors',
        description: 'Names of all authors',
      },
      {
        label: 'Abstract',
        key: 'abstract',
        description: 'The abstract of a paper',
      },
      {
        label: 'Subjects/Tags/Keywords',
        key: 'subjects',
        description: 'The subjects, tags or keywords of a paper.',
      },
      {
        label: 'Highlights',
        key: 'highlights',
        description: 'Highlights of a paper',
      },
    ],
  },
  {
    label: 'Publication Info',
    icon: 'newspaper',
    children: [
      {
        label: 'DOI',
        key: 'DOI',
        description: 'The DOI of a paper',
      },
      {
        label: 'Publisher',
        key: 'publisher',
        description: 'The institution that published the journal that the paper belongs to',
      },
      {
        label: 'Journal/Conference',
        key: 'containerTitle',
        description: 'The name of the journal or conference that the paper belongs to',
      },
      {
        label: 'Issue',
        key: 'issue',
        description: 'The issue of the journal or conference that the paper belongs to',
      },
      {
        label: 'Volume',
        key: 'volume',
        description: 'The volume of the journal or conference that the paper belongs to',
      },
      {
        label: 'Pages',
        key: 'pages',
        description: 'The page numbers of the paper on the journal',
      },
      {
        label: 'Year',
        key: 'year',
        description: 'The year that the paper was published',
      },
      {
        label: 'Date',
        key: 'date',
        description: 'The full date that the paper was published',
      },
    ],
  },
  {
    label: 'Citation/Reference Info',
    icon: 'add_link',
    children: [
      {
        label: 'Citation Count',
        key: 'referencedByCount',
        description: 'The number of citations of the paper',
      },
    ],
  },
  {
    label: 'Online Access Information',
    icon: 'filter_drama',
    children: [
      {
        label: 'URL',
        key: 'url',
        description: 'The url of the paper detail page',
      },
      {
        label: 'Download Link',
        key: 'resourceLink',
        description: 'The download link of the paper ',
      },
      {
        label: 'Platform',
        key: 'platform',
        description: 'The website or database that the paper is found.',
      },
    ],
  },
  {
    label: 'Other Info',
    icon: 'info',
    children: [
      {
        label: 'Author Comments',
        key: 'authorComments',
        description: 'The comments of the author',
      },
    ],
  },
];

const existedPDInfo = defineModel<{ [p: string]: NPDInfo }>('existedPDInfo', { default: {} });
// 用户使用关键词搜索 page 或 database 后，选中的那一个的 schema 会存储为 selectedPDId
const selectedPDId = defineModel<string | undefined>('selectedPDId', { default: undefined });
const selectedPDInfo = computed(() => (selectedPDId.value ? existedPDInfo.value[selectedPDId.value] : undefined));
const props = defineProps<{
  platform: Platform | undefined;
}>();

// 选中的数据库中，哪些列是可能有对应的文献属性的
const selectedPDCompatibleProperties = computed(() => {
  if (selectedPDId.value && selectedPDInfo.value) {
    return Object.keys(selectedPDInfo.value.properties as Record<string, NProperty>).reduce<Record<string, NProperty>>(
      (acc, key) => {
        if (isCompatiblePDPropertyType(selectedPDInfo.value?.properties[key] as NProperty)) {
          acc[key] = selectedPDInfo.value?.properties[key] as NProperty;
        }
        return acc;
      },
      {}
    );
  }
  return {};
});

const existedPDToWorkMappings = defineModel<{
  [key: string]: SavedPDToWorkMapping;
}>('existedPDToWorkMappings', { default: {} });

const selectedPDMapToWork = ref<PDToWorkMapping>(
  selectedPDId.value ? existedPDToWorkMappings.value[selectedPDId.value]['mapping'] : {}
);

const qSelectComponent = ref<QSelect | null>(null);
let titleQuery = ''; // 用于搜索page或database的关键字

const filteredPDOptions = ref(Object.values(existedPDInfo.value));

watch(existedPDInfo, (newValue) => {
  filteredPDOptions.value = Object.values(newValue);
});

watch(selectedPDId, (newValue) => {
  selectedPDMapToWork.value =
    newValue && newValue in existedPDToWorkMappings.value ? existedPDToWorkMappings.value[newValue]['mapping'] : {};
});

watch(existedPDToWorkMappings, (newValue) => {
  selectedPDMapToWork.value =
    selectedPDId.value && selectedPDId.value in newValue ? newValue[selectedPDId.value]['mapping'] : {};
});

function filterByTitle(val: string, update: (arg0: () => void) => void) {
  update(() => {
    titleQuery = val;
    const needle = val.toLowerCase();
    filteredPDOptions.value = Object.values(existedPDInfo.value).filter(
      (pdInfo) => pdInfo.title[0].plain_text.toLowerCase().indexOf(needle) > -1
    );
  });
}

/**
 * 根据标题搜索 pages 或 databases
 */
function searchByTitle() {
  chrome.runtime.sendMessage(
    {
      message: 'fetch-pages-databases',
      data: { query: titleQuery },
    },
    function (res: Response<NPDInfo[]>) {
      if (res.success) {
        selectedPDId.value = undefined;
        existedPDInfo.value = res.data.reduce<{ [key: string]: NPDInfo }>((acc, cur) => {
          acc[cur.id] = cur;
          return acc;
        }, {});
        // 候选的数据库列表变化了，相应地 existedPDToWorkMappings 也要变化
        Object.keys(existedPDInfo.value).forEach((PDId: string) => {
          if (PDId in existedPDToWorkMappings.value) return;
          existedPDToWorkMappings.value[PDId] = { mapping: {} };
        });
        nextTick(() => {
          qSelectComponent.value?.showPopup();
        });
      }
    }
  );
}

/**
 * 当用户选定了要上传的数据库后，需要更新 selectedPDMapToWork 的值
 * @param pdId 选中的数据库的 id。注意，当本函数被调用时，selectedPDId 可能还没有被更新，但是 nextTick 更新后，值就是这里的 pdId
 */
function handlePDSelection(pdId: string) {
  if (pdId in existedPDToWorkMappings.value) {
    selectedPDMapToWork.value = existedPDToWorkMappings.value[pdId]['mapping'] as PDToWorkMapping;
  } else {
    selectedPDMapToWork.value = {};
    existedPDToWorkMappings.value[pdId] = { mapping: selectedPDMapToWork.value };
  }
}

function handleWorkPropertySelection(
  PDProperty: NProperty,
  PDPropertyName: string,
  workPropertyName: WorkPropertyKeys,
  workPropertyLabel: string
) {
  selectedPDMapToWork.value[PDPropertyName] = {
    PDPropertyName: PDPropertyName,
    PDProperty: PDProperty,
    workPropertyName: workPropertyName,
    workPropertyLabel: workPropertyLabel,
  };
}
</script>

<template>
  <div>
    <q-select
      ref="qSelectComponent"
      v-model="selectedPDId"
      :options="filteredPDOptions"
      use-input
      rounded
      outlined
      input-debounce="0"
      :option-value="(opt:NPDInfo) => opt.id"
      :option-label="(opt:NPDInfo) => opt['title']?.[0]?.['plain_text']"
      map-options
      emit-value
      use-chips
      @filter="filterByTitle"
      label="Search for a database to upload to"
      @update:model-value="handlePDSelection"
    >
      <template v-slot:prepend>
        <q-icon name="mdi-database-search-outline" />
      </template>
      <template v-slot:after>
        <q-btn round dense flat icon="mdi-magnify" size="1em" @click="searchByTitle" />
      </template>
    </q-select>
    <p class="text-caption q-mt-xs">If you don't see your database in the dropdown, please click the Magnifier icon.</p>
    <div class="q-mt-lg">
      <q-markup-table v-if="selectedPDId" flat bordered separator="horizontal">
        <thead class="bg-indigo-1">
          <tr>
            <th>Your Database Column</th>
            <th>Select Corresponding Paper Properties</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="2" class="text-caption text-grey" style="white-space: pre-wrap">
              1. Some columns may not be displayed here due to incompatible types. <br />
              2. The order of columns displayed here may differ from their order in your database.
              <span v-show="props.platform === 'GoogleScholar'"
                ><br />
                3. The author list and the journal name may be incomplete for some papers from Google Scholar.</span
              >
            </td>
          </tr>
          <tr v-for="(property, propertyName) in selectedPDCompatibleProperties" :key="propertyName">
            <td>{{ propertyName }}</td>
            <td>
              <q-select
                filled
                :options="DisplayedWorkProperties"
                v-model="selectedPDMapToWork[propertyName]"
                clearable
                :display-value="selectedPDMapToWork[propertyName]?.['workPropertyLabel'] as string"
              >
                <template v-slot:option="scope">
                  <q-list separator>
                    <q-item :disable="true">
                      <q-item-section side>
                        <q-icon :name="scope.opt.icon"></q-icon>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label class="text-weight-bold" header>{{ scope.opt.label }}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <template v-for="child in scope.opt.children" :key="child.label">
                      <q-item
                        clickable
                        v-ripple
                        v-close-popup
                        @click="handleWorkPropertySelection(property, propertyName as string, child.key, child.label)"
                      >
                        <q-item-section>
                          <q-item-label class="q-ml-lg">{{ child.label }}</q-item-label>
                        </q-item-section>
                        <q-item-section>
                          <q-item-label caption>{{ child.description }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-list>
                </template>
              </q-select>
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </div>
  </div>
</template>

<style scoped>
th {
  text-align: left;
}
</style>
