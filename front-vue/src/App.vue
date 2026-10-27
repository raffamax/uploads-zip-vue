<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import JSZip from "jszip";
import dayjs from "dayjs";
import { storageBucket, supabase } from "./lib/supabase";

type UploadedFile = {
  name: string;
  path: string;
  size: number;
  mimetype: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const selectedFiles = ref<File[]>([]);
const loadingUpload = ref(false);
const loadingFiles = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const uploadedFiles = ref<UploadedFile[]>([]);
const deletingPath = ref<string | null>(null);
const openingPath = ref<string | null>(null);
const previewFile = ref<UploadedFile | null>(null);
const previewEntries = ref<JSZip.JSZipObject[]>([]);
const selectedPreviewEntry = ref<JSZip.JSZipObject | null>(null);
const previewUrl = ref("");
const previewText = ref("");
const loadingPreview = ref(false);
const loadingPreviewEntry = ref<string | null>(null);
const previewError = ref("");
const noticeDialog = ref({
  open: false,
  title: "",
  message: "",
  variant: "info" as "info" | "success" | "error" | "confirm",
});
const pendingDeletePath = ref<string | null>(null);
const authUser = ref<import("@supabase/supabase-js").User | null>(null);
const authMode = ref<"login" | "signup">("login");
const authEmail = ref("");
const authPassword = ref("");
const authLoading = ref(false);
const authError = ref("");
const authMessage = ref("");

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

  const newFiles = Array.from(input.files);
  const existingKeys = new Set(
    selectedFiles.value.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
  );

  selectedFiles.value = [
    ...selectedFiles.value,
    ...newFiles.filter(
      (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`),
    ),
  ];
  errorMessage.value = "";
  successMessage.value = "";
  input.value = "";
}

async function submitAuth() {
  authError.value = "";
  authMessage.value = "";
  authLoading.value = true;

  try {
    const result = authMode.value === "login"
      ? await supabase.auth.signInWithPassword({
          email: authEmail.value,
          password: authPassword.value,
        })
      : await supabase.auth.signUp({
          email: authEmail.value,
          password: authPassword.value,
        });

    if (result.error) throw result.error;

    if (authMode.value === "signup" && !result.data.session) {
      authMessage.value = "Cadastro realizado. Verifique seu e-mail para confirmar a conta.";
      authMode.value = "login";
      return;
    }

    authUser.value = result.data.user;
    authEmail.value = "";
    authPassword.value = "";
    await fetchFiles();
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "Não foi possível autenticar.";
  } finally {
    authLoading.value = false;
  }
}

async function signOut() {
  await supabase.auth.signOut();
  authUser.value = null;
  uploadedFiles.value = [];
  selectedFiles.value = [];
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
  if (!authUser.value) return;
  if (selectedFiles.value.length === 0) {
    errorMessage.value = "Selecione ao menos um arquivo.";
    return;
  }

  try {
    loadingUpload.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    const zipFile = await createZip(selectedFiles.value);
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const filePath = `${authUser.value.id}/${year}/${month}/${Date.now()}-${zipFile.name}`;

    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(filePath, zipFile, {
        contentType: "application/zip",
        upsert: false,
      });

    if (error) throw error;

    successMessage.value = `Upload concluído. Arquivo salvo com sucesso em: ${filePath}`;
    selectedFiles.value = [];

    await fetchFiles();
  } catch (error) {
    console.error("Erro ao enviar o arquivo ZIP:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "Erro ao enviar o arquivo ZIP.";
  } finally {
    loadingUpload.value = false;
  }
}

async function fetchFiles() {
  if (!authUser.value) return;

  try {
    loadingFiles.value = true;
    const files: UploadedFile[] = [];

    async function listFolder(folder = "") {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .list(folder, {
          limit: 100,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) throw error;

      for (const item of data ?? []) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (!item.metadata) {
          await listFolder(path);
        } else if (item.name.toLowerCase().endsWith(".zip")) {
          files.push({
            name: item.name,
            path,
            size: item.metadata.size ?? 0,
            mimetype: item.metadata.mimetype ?? "application/zip",
            createdAt: item.created_at ?? null,
            updatedAt: item.updated_at ?? null,
          });
        }
      }
    }

    await listFolder(authUser.value.id);
    uploadedFiles.value = files.sort(
      (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf(),
    );
  } catch (error) {
    console.error("Erro ao listar arquivos:", error);
    showNotice("Erro", "Erro ao carregar arquivos", "error");
  } finally {
    loadingFiles.value = false;
  }
}

async function openFile(path: string) {
  try {
    openingPath.value = path;
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(path, 60 * 5);
    if (error) throw error;
    const url = data.signedUrl;

    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("Erro ao abrir arquivo:", error);
    showNotice("Erro", "Erro ao gerar link do arquivo", "error");
  } finally {
    openingPath.value = null;
  }
}

function clearPreviewContent() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  previewText.value = "";
  selectedPreviewEntry.value = null;
}

async function previewUploadedFile(file: UploadedFile) {
  clearPreviewContent();
  previewFile.value = file;
  previewEntries.value = [];
  previewError.value = "";
  loadingPreview.value = true;

  try {
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(file.path, 60 * 5);
    if (error) throw error;

    const response = await fetch(data.signedUrl);
    if (!response.ok)
      throw new Error("Não foi possível baixar o arquivo para a prévia.");

    const zip = await JSZip.loadAsync(await response.blob());
    previewEntries.value = Object.values(zip.files).filter(
      (entry) => !entry.dir,
    );
  } catch (error) {
    console.error("Erro ao carregar prévia:", error);
    previewError.value =
      error instanceof Error ? error.message : "Erro ao carregar a prévia.";
  } finally {
    loadingPreview.value = false;
  }
}

async function previewEntry(entry: JSZip.JSZipObject) {
  loadingPreviewEntry.value = entry.name;

  try {
    clearPreviewContent();
    selectedPreviewEntry.value = entry;

    const extension = entry.name.split(".").pop()?.toLowerCase() ?? "";
    const textExtensions = [
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
    const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
    const audioExtensions = ["mp3", "wav", "ogg", "oga", "aac", "m4a", "flac", "opus"];
    const videoExtensions = ["mp4", "webm", "ogv", "mov", "m4v", "avi", "mkv"];

    if (textExtensions.includes(extension)) {
      previewText.value = await entry.async("text");
      return;
    }

    if (
      imageExtensions.includes(extension) ||
      audioExtensions.includes(extension) ||
      videoExtensions.includes(extension) ||
      extension === "pdf"
    ) {
      const mimeTypes: Record<string, string> = {
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
      const content = await entry.async("arraybuffer");
      const blob = new Blob([content], { type: mimeTypes[extension] });
      previewUrl.value = URL.createObjectURL(blob);
    }
  } finally {
    loadingPreviewEntry.value = null;
  }
}

function closePreview() {
  clearPreviewContent();
  previewEntries.value = [];
  previewFile.value = null;
  previewError.value = "";
}

function showNotice(
  title: string,
  message: string,
  variant: "info" | "success" | "error" | "confirm" = "info",
) {
  noticeDialog.value = { open: true, title, message, variant };
}

function closeNotice() {
  noticeDialog.value.open = false;
  pendingDeletePath.value = null;
}

function requestDelete(path: string) {
  pendingDeletePath.value = path;
  showNotice(
    "Excluir arquivo",
    "Tem certeza que deseja excluir este arquivo?",
    "confirm",
  );
}

function confirmDelete() {
  if (pendingDeletePath.value) {
    deleteFile(pendingDeletePath.value);
  }
}

async function deleteFile(path: string) {
  closeNotice();

  try {
    deletingPath.value = path;

    const { error } = await supabase.storage.from(storageBucket).remove([path]);
    if (error) throw error;

    uploadedFiles.value = uploadedFiles.value.filter(
      (file) => file.path !== path,
    );
    showNotice("Sucesso", "Arquivo excluído com sucesso", "success");
  } catch (error) {
    console.error("Erro ao excluir arquivo:", error);
    showNotice("Erro", "Erro ao excluir arquivo", "error");
  } finally {
    deletingPath.value = null;
  }
}

function clearSelectedFiles() {
  selectedFiles.value = [];
  errorMessage.value = "";
  successMessage.value = "";
}

function removeSelectedFile(fileToRemove: File) {
  selectedFiles.value = selectedFiles.value.filter(
    (file) => file !== fileToRemove,
  );
  errorMessage.value = "";
  successMessage.value = "";
}

onMounted(() => {
  supabase.auth.getSession().then(({ data }) => {
    authUser.value = data.session?.user ?? null;
    if (authUser.value) fetchFiles();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    authUser.value = session?.user ?? null;
    if (authUser.value) fetchFiles();
  });
});
</script>

<template>
  <main v-if="!authUser" class="page auth-page">
    <section class="card auth-card">
      <h1>{{ authMode === "login" ? "Entrar" : "Criar conta" }}</h1>
      <p>
        {{ authMode === "login"
          ? "Entre para acessar seus arquivos enviados."
          : "Crie sua conta para manter seus arquivos privados e vinculados a você." }}
      </p>

      <form class="auth-form" @submit.prevent="submitAuth">
        <label>
          E-mail
          <input v-model="authEmail" type="email" autocomplete="email" required />
        </label>
        <label>
          Senha
          <input
            v-model="authPassword"
            type="password"
            autocomplete="current-password"
            minlength="6"
            required
          />
        </label>
        <button class="primary" type="submit" :disabled="authLoading">
          <span v-if="authLoading" class="spinner" aria-hidden="true"></span>
          {{ authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Cadastrar" }}
        </button>
      </form>

      <p v-if="authMessage" class="success">{{ authMessage }}</p>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="auth-switch" type="button" @click="authMode = authMode === 'login' ? 'signup' : 'login'">
        {{ authMode === "login" ? "Ainda não tenho uma conta" : "Já tenho uma conta" }}
      </button>
    </section>
  </main>

  <main v-else class="page">
    <div class="user-bar">
      <span>Logado como <strong>{{ authUser.email }}</strong></span>
      <button class="secondary" type="button" @click="signOut">Sair</button>
    </div>

    <section class="card">
      <h1>Upload múltiplo em ZIP</h1>
      <p>
        Selecione vários arquivos. O front gera um único arquivo
        <strong>.zip</strong> sem compressão e envia diretamente para o
        Supabase. Limite de 20MB no total dos arquivos.
      </p>

      <input type="file" multiple @change="handleFiles" />

      <div v-if="selectedFiles.length" class="summary">
        <p><strong>Arquivos:</strong> {{ selectedFiles.length }}</p>
        <p><strong>Tamanho total:</strong> {{ totalSizeLabel }}</p>

        <ul>
          <li
            v-for="file in selectedFiles"
            :key="`${file.name}-${file.size}-${file.lastModified}`"
            class="selected-file"
          >
            <span class="selected-file-name">
              {{ file.name }} — {{ (file.size / 1024).toFixed(2) }} KB
            </span>
            <button
              type="button"
              class="remove-file"
              :aria-label="`Remover ${file.name}`"
              @click="removeSelectedFile(file)"
            >
              Remover
            </button>
          </li>
        </ul>
      </div>

      <div class="actions">
        <button
          :disabled="loadingUpload || !selectedFiles.length"
          class="primary"
          @click="uploadZip"
        >
          <span v-if="loadingUpload" class="spinner" aria-hidden="true"></span>
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
          <span v-if="loadingFiles" class="spinner" aria-hidden="true"></span>
          {{ loadingFiles ? "Atualizando..." : "Atualizar lista" }}
        </button>
      </div>

      <p v-if="loadingFiles">Carregando arquivos...</p>
      <p v-else-if="uploadedFiles.length === 0">Nenhum arquivo encontrado.</p>

      <ul v-else class="file-list">
        <li
          v-for="file in uploadedFiles"
          :key="file.path"
          class="file-item clickable"
          tabindex="0"
          @click="previewUploadedFile(file)"
          @keydown.enter="previewUploadedFile(file)"
        >
          <div class="file-heading">
            <span class="zip-icon" aria-hidden="true">ZIP</span>
            <div class="file-title">
              <strong>{{ file.name }}</strong>
              <span class="file-hint">Clique para abrir a prévia</span>
            </div>
          </div>
          <div class="file-details">
            <span><strong>Tamanho</strong>{{ formatBytes(file.size) }}</span>
            <span
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
              @click.stop="openFile(file.path)"
            >
              <span
                v-if="openingPath === file.path"
                class="spinner"
                aria-hidden="true"
              ></span>
              {{ openingPath === file.path ? "Abrindo..." : "Baixar" }}
            </button>
            <button
              class="danger"
              :disabled="deletingPath === file.path"
              @click.stop="requestDelete(file.path)"
            >
              <span
                v-if="deletingPath === file.path"
                class="spinner"
                aria-hidden="true"
              ></span>
              {{ deletingPath === file.path ? "Excluindo..." : "Excluir" }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <div v-if="previewFile" class="dialog-backdrop" @click.self="closePreview">
      <section
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <div class="header-row">
          <div>
            <h2 id="preview-title">Prévia do arquivo</h2>
            <p>{{ previewFile.name }}</p>
          </div>
          <button class="secondary" @click="closePreview">Fechar</button>
        </div>

        <p v-if="loadingPreview">Carregando conteúdo do ZIP...</p>
        <p v-else-if="previewError" class="error">{{ previewError }}</p>
        <div v-else class="preview-layout">
          <div class="entry-list">
            <strong>Arquivos ({{ previewEntries.length }})</strong>
            <button
              v-for="entry in previewEntries"
              :key="entry.name"
              class="entry-button"
              :class="{ selected: selectedPreviewEntry?.name === entry.name }"
              :disabled="loadingPreviewEntry !== null"
              @click="previewEntry(entry)"
            >
              <span
                v-if="loadingPreviewEntry === entry.name"
                class="spinner spinner-dark"
                aria-hidden="true"
              ></span>
              {{ entry.name }}
            </button>
          </div>

          <div class="preview-content">
            <template v-if="previewText">
              <pre>{{ previewText }}</pre>
            </template>
            <img
              v-else-if="
                previewUrl &&
                selectedPreviewEntry?.name.match(
                  /\.(png|jpe?g|gif|webp|svg|bmp)$/i,
                )
              "
              :src="previewUrl"
              alt="Prévia da imagem"
            />
            <audio
              v-else-if="
                previewUrl &&
                selectedPreviewEntry?.name.match(
                  /\.(mp3|wav|ogg|oga|aac|m4a|flac|opus)$/i,
                )
              "
              :src="previewUrl"
              controls
            ></audio>
            <video
              v-else-if="
                previewUrl &&
                selectedPreviewEntry?.name.match(
                  /\.(mp4|webm|ogv|mov|m4v|avi|mkv)$/i,
                )
              "
              :src="previewUrl"
              controls
            ></video>
            <iframe
              v-else-if="previewUrl"
              :src="previewUrl"
              title="Prévia do PDF"
            ></iframe>
            <p v-else>
              Selecione um arquivo para visualizar. Imagens, PDFs, áudios,
              vídeos e arquivos de texto são suportados.
            </p>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="noticeDialog.open"
      class="dialog-backdrop"
      @click.self="closeNotice"
    >
      <section
        class="dialog notice-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notice-title"
      >
        <h2 id="notice-title">{{ noticeDialog.title }}</h2>
        <p :class="noticeDialog.variant">{{ noticeDialog.message }}</p>
        <div class="actions dialog-actions">
          <template v-if="noticeDialog.variant === 'confirm'">
            <button class="secondary" @click="closeNotice">Cancelar</button>
            <button class="danger" @click="confirmDelete">Excluir</button>
          </template>
          <button v-else class="primary" @click="closeNotice">OK</button>
        </div>
      </section>
    </div>
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

.auth-card {
  max-width: 440px;
}

.auth-form {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.auth-form label {
  display: grid;
  gap: 6px;
  color: #334155;
  font-weight: 600;
}

.auth-form input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
}

.auth-form input:focus {
  border-color: #2563eb;
  outline: 3px solid rgba(37, 99, 235, 0.15);
}

.auth-switch {
  width: 100%;
  margin-top: 12px;
  background: transparent;
  color: #2563eb;
}

.user-bar {
  display: flex;
  width: min(100%, 720px);
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  color: #475569;
  font-size: 0.9rem;
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

.summary ul {
  display: grid;
  gap: 8px;
  padding-left: 0;
  list-style: none;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff;
}

.selected-file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-file {
  flex: 0 0 auto;
  padding: 6px 10px;
  background: transparent;
  color: #b91c1c;
  font-size: 0.82rem;
}

.remove-file:hover {
  background: #fee2e2;
  color: #991b1b;
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

.file-list {
  display: grid;
  gap: 12px;
  max-height: 440px;
  margin: 20px 0 0;
  padding: 2px;
  overflow: auto;
  list-style: none;
}

.file-item {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease,
    background 160ms ease;
}

.file-item.clickable {
  cursor: pointer;
}

.file-item.clickable:hover,
.file-item.clickable:focus-visible {
  border-color: #2563eb;
  background: #f8fbff;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.14);
  transform: translateY(-2px);
  outline: none;
}

.file-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.zip-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 11px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.file-title {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.file-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-hint {
  color: #64748b;
  font-size: 0.78rem;
}

.file-details {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: #475569;
  font-size: 0.88rem;
}

.file-details span {
  display: inline-flex;
  gap: 6px;
}

.file-details strong {
  color: #64748b;
  font-weight: 600;
}

.file-path {
  overflow: hidden;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
}

.dialog {
  width: min(100%, 900px);
  max-height: 90vh;
  overflow: hidden;
  padding: 24px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.dialog h2 {
  margin: 0;
}

.notice-dialog {
  width: min(100%, 460px);
}

.dialog-actions {
  justify-content: flex-end;
  margin-top: 24px;
}

.dialog p {
  margin: 6px 0 0;
}

.preview-layout {
  display: grid;
  grid-template-columns: minmax(180px, 280px) 1fr;
  gap: 18px;
  margin-top: 20px;
  min-height: 360px;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.entry-button {
  padding: 9px 10px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f1f5f9;
  color: #0f172a;
}

.entry-button.selected,
.entry-button:hover {
  background: #dbeafe;
}

.preview-content {
  display: grid;
  place-items: center;
  min-width: 0;
  overflow: auto;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}

.preview-content img {
  max-width: 100%;
  max-height: 520px;
}

.preview-content iframe {
  width: 100%;
  height: 520px;
  border: 0;
}

.preview-content audio,
.preview-content video {
  width: 100%;
  max-width: 640px;
}

.preview-content video {
  max-height: 520px;
}

.preview-content pre {
  width: 100%;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-align: left;
}

@media (max-width: 700px) {
  .preview-layout {
    grid-template-columns: 1fr;
  }
}

button {
  border: 0;
  padding: 12px 18px;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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

.spinner {
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-dark {
  color: #0f172a;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success {
  color: #166534;
}

.error {
  color: #b91c1c;
}
</style>
