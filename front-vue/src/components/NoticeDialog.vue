<script setup lang="ts">
import type { Notice } from "../types/upload";
defineProps<{ notice: Notice; loading?: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>
<template>
  <div
    v-if="notice.open"
    class="dialog-backdrop"
    @click.self="!loading && emit('close')"
  >
    <section class="dialog notice-dialog" role="alertdialog" aria-modal="true">
      <h2>{{ notice.title }}</h2>
      <p :class="notice.variant">{{ notice.message }}</p>
      <div class="actions dialog-actions">
        <template v-if="notice.variant === 'confirm'"
          ><button class="secondary" :disabled="loading" @click="emit('close')">
            Cancelar</button
          ><button class="danger" :disabled="loading" @click="emit('confirm')">
            <span v-if="loading" class="spinner" aria-hidden="true"></span>
            {{ loading ? "Excluindo..." : "Excluir" }}
          </button></template
        ><button v-else class="primary" @click="emit('close')">OK</button>
      </div>
    </section>
  </div>
</template>
