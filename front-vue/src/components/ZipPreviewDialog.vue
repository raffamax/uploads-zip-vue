<script setup lang="ts">
import { ref, watch } from "vue";
import JSZip from "jszip";
import { storageBucket, supabase } from "../lib/supabase";
import type { UploadedFile } from "../types/upload";
import { friendlyError } from "../utils/errors";
const props = defineProps<{ file: UploadedFile | null }>();
const emit = defineEmits<{ close: [] }>();
const entries = ref<JSZip.JSZipObject[]>([]);
const selected = ref<JSZip.JSZipObject | null>(null);
const url = ref("");
const text = ref("");
const loading = ref(false);
const entryLoading = ref<string | null>(null);
const error = ref("");
function clear() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = "";
  text.value = "";
  selected.value = null;
}
function close() {
  clear();
  entries.value = [];
  error.value = "";
  emit("close");
}
watch(
  () => props.file,
  async (file) => {
    if (!file) return;
    clear();
    entries.value = [];
    error.value = "";
    loading.value = true;
    try {
      const { data, error: signedError } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(file.path, 300);
      if (signedError) throw signedError;
      const response = await fetch(data.signedUrl);
      if (!response.ok)
        throw new Error("Não foi possível baixar o arquivo para a prévia.");
      const zip = await JSZip.loadAsync(await response.blob());
      entries.value = Object.values(zip.files).filter((entry) => !entry.dir);
    } catch (cause) {
      error.value = friendlyError(cause, "Não foi possível carregar a prévia do arquivo.");
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
async function selectEntry(entry: JSZip.JSZipObject) {
  entryLoading.value = entry.name;
  try {
    clear();
    selected.value = entry;
    const extension = entry.name.split(".").pop()?.toLowerCase() ?? "";
    const textTypes = [
      "txt",
      "csv",
      "json",
      "md",
      "xml",
      "html",
      "css",
      "js",
      "ts",
    ];
    const mediaTypes = [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
      "bmp",
      "pdf",
      "mp3",
      "wav",
      "ogg",
      "oga",
      "aac",
      "m4a",
      "flac",
      "opus",
      "mp4",
      "webm",
      "ogv",
      "mov",
      "m4v",
      "avi",
      "mkv",
    ];
    if (textTypes.includes(extension)) text.value = await entry.async("text");
    else if (mediaTypes.includes(extension)) {
      const mime: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",
        pdf: "application/pdf",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        oga: "audio/ogg",
        aac: "audio/aac",
        m4a: "audio/mp4",
        flac: "audio/flac",
        opus: "audio/opus",
        mp4: "video/mp4",
        webm: "video/webm",
        ogv: "video/ogg",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        avi: "video/x-msvideo",
        mkv: "video/x-matroska",
      };
      url.value = URL.createObjectURL(
        new Blob([await entry.async("arraybuffer")], { type: mime[extension] }),
      );
    }
  } catch (cause) {
    error.value = friendlyError(cause, "Não foi possível abrir este arquivo na prévia.");
  } finally {
    entryLoading.value = null;
  }
}
</script>
<template>
  <div v-if="file" class="dialog-backdrop" @click.self="close">
    <section class="dialog" role="dialog" aria-modal="true">
      <div class="header-row">
        <div>
          <h2>Prévia do arquivo</h2>
          <p>{{ file.name }}</p>
        </div>
        <button class="secondary" @click="close">Fechar</button>
      </div>
      <p v-if="loading">Carregando conteúdo do ZIP...</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <div v-else class="preview-layout">
        <div class="entry-list">
          <strong>Arquivos ({{ entries.length }})</strong
          ><button
            v-for="entry in entries"
            :key="entry.name"
            class="entry-button"
            :class="{ selected: selected?.name === entry.name }"
            :disabled="entryLoading !== null"
            @click="selectEntry(entry)"
          >
            <span
              v-if="entryLoading === entry.name"
              class="spinner spinner-dark"
              aria-hidden="true"
            ></span
            >{{ entry.name }}
          </button>
        </div>
        <div class="preview-content">
          <pre v-if="text">{{ text }}</pre>
          <img
            v-else-if="
              url && selected?.name.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i)
            "
            :src="url"
            alt="Prévia da imagem"
          /><audio
            v-else-if="
              url &&
              selected?.name.match(/\.(mp3|wav|ogg|oga|aac|m4a|flac|opus)$/i)
            "
            :src="url"
            controls
          ></audio
          ><video
            v-else-if="
              url && selected?.name.match(/\.(mp4|webm|ogv|mov|m4v|avi|mkv)$/i)
            "
            :src="url"
            controls
          ></video
          ><iframe v-else-if="url" :src="url" title="Prévia do PDF"></iframe>
          <p v-else>Selecione um arquivo para visualizar.</p>
        </div>
      </div>
    </section>
  </div>
</template>
