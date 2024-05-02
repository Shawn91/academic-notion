<!--流程：
1. PopupPage.vue 调用本组件时，传入一个 existedPDInfo 数组，存储的是过往已经上传过的 pages 或 databases
（暂时未考虑如果这个 page 或 database 已经删除了怎么办）
2. 本组件内，在搜索框输入关键字时，默认是从 existedPDInfo 中过滤
3. 在搜索框输入关键字后，点击搜索按钮，此时向后端发送请求，搜索包含关键字的 pages 或 databases，并覆盖 existedPDInfo
4. 如果搜索框中的关键字并不在 existedPDInfo 中，那么当搜索框失焦后，会自动删除关键字，因此为了确保点击搜索按钮时，
  还能获取到关键字，所以需要一个 titleQuery 变量，每当搜索框内容变化时（即调用 filter 函数时），更新 titleQuery
-->
<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { NPDInfo, NProperty, PDToWorkMapping, WorkPropertyKeys } from 'src/models/models';
import { Response } from 'src/services/api';
import { QSelect } from 'quasar';

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

// interface Props {
//   // existedPDInfo: NPDInfo[];
// }
//
// const props = defineProps<Props>();
// 用户使用关键词搜索 page 或 database 后，选中的那一个的 schema 会存储为 selectedPD
const selectedPD = defineModel<NPDInfo | null>('selectedPD', { default: null });
const existedPDInfo = defineModel<NPDInfo[]>('existedPDInfo', { default: [] });
// key 是 database 的 column 列名，value 中 PDPropertyName 还是 column 列名，PDProperty 是该列的属性，
// WorkPropertyLabel 是 DisplayedWorkProperties 中的各个 Label 值
const selectedPDMapToWork = ref<PDToWorkMapping>({});
const qSelectComponent = ref<QSelect | null>(null);
let titleQuery = ''; // 用于搜索page或database的关键字

// const pageDatabaseOptions = ref(existedPDInfo);
const filteredPDOptions = ref(existedPDInfo.value);

const emit = defineEmits(['database-work-mapped']);

function filterByTitle(val: string, update: (arg0: () => void) => void) {
  update(() => {
    titleQuery = val;
    const needle = val.toLowerCase();
    filteredPDOptions.value = existedPDInfo.value.filter(
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
        existedPDInfo.value = res.data.map((pdInfo) => {
          pdInfo.object = 'database';
          return pdInfo;
        });
        filteredPDOptions.value = existedPDInfo.value;
        nextTick(() => {
          qSelectComponent.value?.showPopup();
        });
      }
    }
  );
}

function handleWorkPropertySelection(
  PDProperty: NProperty,
  PDPropertyName: string,
  workPropertyName: WorkPropertyKeys,
  workPropertyLabel: string
) {
  if (selectedPDMapToWork.value) {
    selectedPDMapToWork.value[PDPropertyName] = {
      PDPropertyName: PDPropertyName,
      PDProperty: PDProperty,
      workPropertyName: workPropertyName,
      workPropertyLabel: workPropertyLabel,
    };
    // 去除掉值为 null 的 keys
    selectedPDMapToWork.value = Object.fromEntries(
      Object.entries(selectedPDMapToWork.value).filter(([_, value]) => value !== null)
    );
    emit('database-work-mapped', selectedPDMapToWork.value);
  }
}
</script>

<template>
  <div>
    <q-select
      ref="qSelectComponent"
      v-model="selectedPD"
      :options="filteredPDOptions"
      use-input
      rounded
      outlined
      input-debounce="0"
      :option-label="(opt) => opt['title'][0]['plain_text']"
      use-chips
      @filter="filterByTitle"
      label="Search for a database to upload to"
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
      <q-markup-table v-show="selectedPD !== null" flat bordered separator="horizontal">
        <thead class="bg-indigo-1">
          <tr>
            <th>Your Database Column</th>
            <th>Select Corresponding Paper Properties</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(property, propertyName) in selectedPD?.properties" :key="propertyName">
            <td>{{ propertyName }}</td>
            <td>
              <q-select
                filled
                :options="DisplayedWorkProperties"
                v-model="selectedPDMapToWork[propertyName]"
                clearable
                options-selected-class="text-deep-orange"
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
