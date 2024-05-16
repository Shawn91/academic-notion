<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    color?: string;
  }>(),
  { color: 'purple' }
);

const emit = defineEmits(['auth-success']);

async function handleNotionAuth() {
  try {
    await chrome.runtime.sendMessage({ message: 'notion-auth' });
    emit('auth-success');
  } catch (error) {
    // 报错有两种可能： 1. 用户在授权页面点击了取消，没有进行授权。2. 授权正常进行，但授权失败
    // 第一种情况可以不用处理。第二种情况需要提示用户，但暂时先不处理
    console.log(error);
  }
}
</script>

<template>
  <q-btn :color="props.color" :label="props.label" @click="handleNotionAuth"></q-btn>
</template>

<style scoped></style>
