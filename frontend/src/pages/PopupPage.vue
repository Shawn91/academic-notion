<script setup lang="ts">
import { Work } from 'src/models';

window.addEventListener('message', (event) => {
  if (event.data.message === 'works') {
    const works: Work[] = event.data.data;
  }
});
</script>

<template>
  <div>Nihc</div>
</template>

<style scoped></style>
