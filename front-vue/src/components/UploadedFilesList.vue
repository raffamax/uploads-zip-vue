<script setup lang="ts">
import type { UploadedFile } from "../types/upload";
import { formatBytes } from "../utils/files";
import dayjs from "dayjs";
defineProps<{
  files: UploadedFile[];
  loading: boolean;
  openingPath: string | null;
  deletingPath: string | null;
}>();
const emit = defineEmits<{
  refresh: [];
  preview: [file: UploadedFile];
  open: [path: string];
  delete: [path: string];
}>();
</script>
<template>
  <section class="card">
    <div class="header-row">
      <h2>Arquivos enviados</h2>
      <button :disabled="loading" @click="emit('refresh')">
        <span v-if="loading" class="spinner" aria-hidden="true"></span
        >{{ loading ? "Atualizando..." : "Atualizar lista" }}
      </button>
    </div>
    <p v-if="loading">Carregando arquivos...</p>
    <p v-else-if="!files.length">Nenhum arquivo encontrado.</p>
    <ul v-else class="file-list">
      <li
        v-for="file in files"
        :key="file.path"
        class="file-item clickable"
        tabindex="0"
        @click="emit('preview', file)"
        @keydown.enter="emit('preview', file)"
      >
        <div class="file-heading">
          <span class="zip-icon" aria-hidden="true">ZIP</span>
          <div class="file-title">
            <strong>{{ file.name }}</strong
            ><span class="file-hint">Clique para abrir a prévia</span>
          </div>
        </div>
        <div class="file-details">
          <span><strong>Tamanho</strong>{{ formatBytes(file.size) }}</span
          ><span
            ><strong>Enviado em</strong
            >{{
              file.createdAt
                ? dayjs(file.createdAt).format("DD/MM/YYYY HH:mm")
                : "-"
            }}</span
          >
        </div>
        <div class="file-path" :title="file.path">{{ file.path }}</div>
        <div class="actions">
          <button
            class="primary"
            :disabled="openingPath === file.path"
            @click.stop="emit('open', file.path)"
          >
            <span
              v-if="openingPath === file.path"
              class="spinner"
              aria-hidden="true"
            ></span
            >{{
              openingPath === file.path ? "Abrindo..." : "Visualizar / Baixar"
            }}</button
          ><button
            class="danger"
            :disabled="deletingPath === file.path"
            @click.stop="emit('delete', file.path)"
          >
            <span
              v-if="deletingPath === file.path"
              class="spinner"
              aria-hidden="true"
            ></span
            >{{ deletingPath === file.path ? "Excluindo..." : "Excluir" }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
