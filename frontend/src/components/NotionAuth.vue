<script setup lang="ts">
import { ref } from 'vue';

const isLoggedIn = defineModel('isLoggedIn', { default: false });
// 正在登录/授权中（用户点击了授权，但是要等待1-2s 的网络时间）
const isAuthing = ref(false);

const emit = defineEmits(['auth-success', 'log-out']);

async function handleNotionAuth() {
  isAuthing.value = true;
  try {
    await chrome.runtime.sendMessage({ message: 'notion-auth' });
    isLoggedIn.value = true;
    emit('auth-success');
  } catch (error) {
    // 报错有两种可能： 1. 用户在授权页面点击了取消，没有进行授权。2. 授权正常进行，但授权失败
    // 第一种情况可以不用处理。第二种情况需要提示用户，但暂时先不处理
    console.log(error);
  }
  isAuthing.value = false;
}

function logout() {
  isLoggedIn.value = false;
  emit('log-out');
}
</script>

<template>
  <q-btn
    color="purple"
    :label="isLoggedIn ? 'Authorize Databases' : 'Log in to Proceed'"
    @click="handleNotionAuth"
    rounded
    :loading="isAuthing"
  ></q-btn>
  <span class="q-mx-sm"></span>
  <q-btn color="purple" label="Log out" @click="logout" v-show="isLoggedIn" outline rounded></q-btn>
</template>

<style scoped></style>
