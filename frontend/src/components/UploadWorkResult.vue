<script setup lang="ts">
import { Work } from 'src/models/models';
import { ref, watch } from 'vue';
import { mdiCheckCircleOutline } from '@quasar/extras/mdi-v7';
// 哪些文献上传失败了。在上传过程中，值为 null；如果全部上传成功，值为空数组
const failedUploadWorks = defineModel<Work[] | null>('failedUploadWorks', { default: null });
const closeCountDown = ref<number | null>(null);

watch(failedUploadWorks, (newValue) => {
  // 空数组，说明全部上传成功，开始执行 count down
  if (newValue instanceof Array && newValue.length === 0) {
    closeCountDown.value = 3;
    setInterval(() => {
      if (closeCountDown.value === 0) {
        chrome.windows.getCurrent().then((window) => {
          if (window.id) {
            chrome.windows.remove(window.id);
          }
        });
      } else if (closeCountDown.value !== null && closeCountDown.value > 0) {
        closeCountDown.value--;
      }
    }, 1000);
  }
});
</script>

<template>
  <div style="width: 60%; height: 100%; align-self: center" class="flex">
    <div v-show="failedUploadWorks === null" style="width: 100%; position: relative">
      <q-inner-loading
        showing
        label="Papers are being uploaded. This window will close automatically when all papers are uploaded successfully. Otherwise, the failed papers will be listed here."
        label-class="text-teal"
        label-style="font-size: 1.1em"
      />
    </div>
    <div v-show="failedUploadWorks instanceof Array && failedUploadWorks.length > 0">
      <h5>The following papers failed to upload.</h5>
      <p>
        You can try uploading them later but the upload could fail again... My email is support@texcel.app and you can
        always contact me.
      </p>
      <ul>
        <li v-for="work in failedUploadWorks" :key="work['title']">{{ work['title'] }}</li>
      </ul>
    </div>
    <div
      v-show="failedUploadWorks instanceof Array && failedUploadWorks.length === 0"
      class="text-teal flex column"
      style="align-self: center"
    >
      <div style="align-self: center">
        <q-icon :name="mdiCheckCircleOutline" size="64px"></q-icon>
      </div>
      <p class="text-body1 q-mt-sm">All papers have been uploaded successfully.</p>
      <p class="text-body1">This window will be closed automatically in {{ closeCountDown }} seconds.</p>
    </div>
  </div>
</template>

<style scoped></style>
