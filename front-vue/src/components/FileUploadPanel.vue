<script setup lang="ts">
import { formatBytes } from "../utils/files";
defineProps<{
  files: File[];
  totalSize: number;
  loading: boolean;
  error: string;
  success: string;
}>();
const emit = defineEmits<{
  add: [files: File[]];
  remove: [file: File];
  clear: [];
  upload: [];
}>();
function onChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    emit("add", Array.from(input.files));
    input.value = "";
  }
}
</script>
<template>
  <section class="card">
    <h1>Upload múltiplo em ZIP</h1>
    <p>
      Selecione vários arquivos. O front gera um único arquivo
      <strong>.zip</strong> sem compressão e envia diretamente para o Supabase.
      Limite de 20MB no total dos arquivos.
    </p>
    <input type="file" multiple @change="onChange" />
    <div v-if="files.length" class="summary">
      <p><strong>Arquivos:</strong> {{ files.length }}</p>
      <p><strong>Tamanho total:</strong> {{ formatBytes(totalSize) }}</p>
      <ul class="selected-files">
        <li
          v-for="file in files"
          :key="`${file.name}-${file.size}-${file.lastModified}`"
          class="selected-file"
        >
          <span class="selected-file-name"
            >{{ file.name }} — {{ formatBytes(file.size) }}</span
          ><button
            type="button"
            class="remove-file"
            @click="emit('remove', file)"
          >
            Remover
          </button>
        </li>
      </ul>
    </div>
    <div class="actions">
      <button
        class="primary"
        :disabled="loading || !files.length"
        @click="emit('upload')"
      >
        <span v-if="loading" class="spinner" aria-hidden="true"></span
        >{{
          loading ? "Gerando ZIP e enviando..." : "Gerar ZIP e enviar"
        }}</button
      ><button v-if="files.length" class="secondary" @click="emit('clear')">
        Limpar seleção de arquivos
      </button>
    </div>
    <p v-if="success" class="success">{{ success }}</p>
    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>
