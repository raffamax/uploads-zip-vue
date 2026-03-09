<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import axios from "axios";
import JSZip from "jszip";
import dayjs from "dayjs";

type UploadedFile = {
  name: string;
  path: string;
  size: number;
  mimetype: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const API_URL = import.meta.env.VITE_API_URL;

const selectedFiles = ref<File[]>([]);
const loadingUpload = ref(false);
const loadingFiles = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const uploadedFiles = ref<UploadedFile[]>([]);
const deletingPath = ref<string | null>(null);

const totalSizeLabel = computed(() => {
  const totalBytes = selectedFiles.value.reduce(
    (acc, file) => acc + file.size,
    0,
  );

  if (totalBytes < 1024) return `${totalBytes} B`;
  if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(2)} KB`;
  if (totalBytes < 1024 * 1024 * 1024)
    return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;

  selectedFiles.value = Array.from(input.files);
  errorMessage.value = "";
  successMessage.value = "";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

async function createZip(files: File[]) {
  const zip = new JSZip();

  files.forEach((file, index) => {
    zip.file(`uploads/${index + 1}-${file.name}`, file);
  });

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
  });

  return new File(
    [zipBlob],
    `arquivos-${dayjs(Date.now()).format("YYYY-MM-DD-HH_mm")}.zip`,
    {
      type: "application/zip",
    },
  );
}

async function uploadZip() {
  if (selectedFiles.value.length === 0) {
    errorMessage.value = "Selecione ao menos um arquivo.";
    return;
  }

  try {
    loadingUpload.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    const zipFile = await createZip(selectedFiles.value);
    const formData = new FormData();
    formData.append("file", zipFile);

    const response = await axios.post(`${API_URL}/upload`, formData);

    successMessage.value = `Upload concluído. Arquivo salvo com sucesso em: ${response.data.file.path}`;
    selectedFiles.value = [];

    await fetchFiles();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      const status = error.response?.status;

      if (typeof data === "object" && data !== null && "message" in data) {
        errorMessage.value = (data as { message: string }).message;
      } else if (
        status === 413 ||
        (typeof data === "string" && data.includes("File too large"))
      ) {
        errorMessage.value =
          "Arquivo muito grande. O limite permitido é 20 MB no total dos arquivos.";
      } else {
        errorMessage.value = "Erro ao enviar o arquivo ZIP.";
      }
      return;
    }

    errorMessage.value = "Erro inesperado ao processar o upload.";
  } finally {
    loadingUpload.value = false;
  }
}

async function fetchFiles() {
  try {
    loadingFiles.value = true;

    const { data } = await axios.get(`${API_URL}/files`);
    uploadedFiles.value = data.files ?? [];
  } catch (error) {
    console.error("Erro ao listar arquivos:", error);
    alert("Erro ao carregar arquivos");
  } finally {
    loadingFiles.value = false;
  }
}

async function openFile(path: string) {
  try {
    const response = await axios.get(`${API_URL}/files/signed-url`, {
      params: { path },
    });

    const url = response.data?.url;

    if (!url) {
      throw new Error("URL assinada não retornada pela API");
    }

    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("Erro ao abrir arquivo:", error);
    alert("Erro ao gerar link do arquivo");
  }
}

async function deleteFile(path: string) {
  const confirmed = window.confirm(
    "Tem certeza que deseja excluir este arquivo?",
  );

  if (!confirmed) {
    return;
  }

  try {
    deletingPath.value = path;

    await axios.delete(`${API_URL}/files`, {
      params: { path },
    });

    uploadedFiles.value = uploadedFiles.value.filter(
      (file) => file.path !== path,
    );
    alert("Arquivo excluído com sucesso");
  } catch (error) {
    console.error("Erro ao excluir arquivo:", error);
    alert("Erro ao excluir arquivo");
  } finally {
    deletingPath.value = null;
  }
}

function clearSelectedFiles() {
  selectedFiles.value = [];
  errorMessage.value = "";
  successMessage.value = "";
}

onMounted(() => {
  fetchFiles();
});
</script>

<template>
  <main class="page">
    <section class="card">
      <h1>Upload múltiplo em ZIP</h1>
      <p>
        Selecione vários arquivos. O front gera um único arquivo
        <strong>.zip</strong> sem compressão e envia para a API. Limite de 20MB
        no total dos arquivos.
      </p>

      <input type="file" multiple @change="handleFiles" />

      <div v-if="selectedFiles.length" class="summary">
        <p><strong>Arquivos:</strong> {{ selectedFiles.length }}</p>
        <p><strong>Tamanho total:</strong> {{ totalSizeLabel }}</p>

        <ul>
          <li
            v-for="file in selectedFiles"
            :key="`${file.name}-${file.lastModified}`"
          >
            {{ file.name }} — {{ (file.size / 1024).toFixed(2) }} KB
          </li>
        </ul>
      </div>

      <div class="actions">
        <button
          :disabled="loadingUpload || !selectedFiles.length"
          class="primary"
          @click="uploadZip"
        >
          {{
            loadingUpload ? "Gerando ZIP e enviando..." : "Gerar ZIP e enviar"
          }}
        </button>

        <button
          v-if="selectedFiles.length"
          class="secondary"
          @click="clearSelectedFiles"
        >
          Limpar seleção de arquivos
        </button>
      </div>

      <p v-if="successMessage" class="success">{{ successMessage }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </section>

    <section class="card">
      <div class="header-row">
        <h2>Arquivos enviados</h2>
        <button :disabled="loadingFiles" @click="fetchFiles">
          {{ loadingFiles ? "Atualizando..." : "Atualizar lista" }}
        </button>
      </div>

      <p v-if="loadingFiles">Carregando arquivos...</p>
      <p v-else-if="uploadedFiles.length === 0">Nenhum arquivo encontrado.</p>

      <ul v-else class="file-list">
        <li v-for="file in uploadedFiles" :key="file.path" class="file-item">
          <div>
            <strong>{{ file.name }}</strong>
          </div>
          <div>Tamanho: {{ formatBytes(file.size) }}</div>
          <div>Caminho: {{ file.path }}</div>
          <div>
            Criado em:
            {{ dayjs(file.createdAt).format("DD/MM/YYYY HH:mm") ?? "-" }}
          </div>

          <div class="actions">
            <button class="primary" @click="openFile(file.path)">
              Visualizar / Baixar
            </button>
            <button
              class="danger"
              :disabled="deletingPath === file.path"
              @click="deleteFile(file.path)"
            >
              {{ deletingPath === file.path ? "Excluindo..." : "Excluir" }}
            </button>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.card {
  width: 100%;
  max-width: 720px;
  background: #fff;
  padding: 24px;
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  margin-bottom: 24px;
}

h1 {
  margin-top: 0;
}

input[type="file"] {
  width: 100%;
  margin: 16px 0;
}

.summary {
  margin: 16px 0;
  padding: 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

ul {
  margin: 12px 0 0;
  padding-left: 18px;
  max-height: 180px;
  overflow: auto;
}

.actions {
  display: flex;
  gap: 12px;
}

button {
  border: 0;
  padding: 12px 18px;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
}

button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

button.primary:not(:disabled):hover {
  background: #1d4ed8;
}

button.secondary {
  background: #64748b;
}

button.secondary:hover {
  background: #475569;
}

button.danger {
  background: #b91c1c;
}

button.danger:hover {
  background: #991b1b;
}

.success {
  color: #166534;
}

.error {
  color: #b91c1c;
}
</style>
