<script setup lang="ts">
import { computed, ref } from "vue";
import AuthForm from "./components/AuthForm.vue";
import FileUploadPanel from "./components/FileUploadPanel.vue";
import UploadedFilesList from "./components/UploadedFilesList.vue";
import ZipPreviewDialog from "./components/ZipPreviewDialog.vue";
import NoticeDialog from "./components/NoticeDialog.vue";
import { useAuth } from "./composables/useAuth";
import { useStorageFiles } from "./composables/useStorageFiles";
import type { Notice, UploadedFile } from "./types/upload";

const auth = useAuth();
const notice = ref<Notice>({
  open: false,
  title: "",
  message: "",
  variant: "info",
});
const previewFile = ref<UploadedFile | null>(null);
const pendingDeletePath = ref<string | null>(null);

function notify(
  title: string,
  message: string,
  variant: Notice["variant"] = "info",
) {
  notice.value = { open: true, title, message, variant };
}
function closeNotice() {
  notice.value.open = false;
  pendingDeletePath.value = null;
}
function requestDelete(path: string) {
  pendingDeletePath.value = path;
  notify(
    "Excluir arquivo",
    "Tem certeza que deseja excluir este arquivo?",
    "confirm",
  );
}

const files = useStorageFiles(
  computed(() => auth.user.value?.id),
  notify,
);
function confirmDelete() {
  if (!pendingDeletePath.value) return;
  const path = pendingDeletePath.value;
  closeNotice();
  files.deleteFile(path);
}
</script>

<template>
  <main v-if="!auth.user.value" class="page auth-page">
    <AuthForm
      v-model:email="auth.email.value"
      v-model:password="auth.password.value"
      :mode="auth.mode.value"
      :loading="auth.loading.value"
      :error="auth.error.value"
      :message="auth.message.value"
      @submit="auth.submit"
      @switch-mode="
        auth.mode.value = auth.mode.value === 'login' ? 'signup' : 'login'
      "
    />
  </main>
  <main v-else class="page">
    <div class="user-bar">
      <span
        >Logado como <strong>{{ auth.user.value.email }}</strong></span
      >
      <button class="secondary" type="button" @click="auth.signOut">
        Sair
      </button>
    </div>
    <FileUploadPanel
      :files="files.selectedFiles.value"
      :total-size="files.totalSize.value"
      :loading="files.loadingUpload.value"
      :error="files.errorMessage.value"
      :success="files.successMessage.value"
      @add="files.addFiles"
      @remove="files.removeSelectedFile"
      @clear="files.clearSelectedFiles"
      @upload="files.upload"
    />
    <UploadedFilesList
      :files="files.uploadedFiles.value"
      :loading="files.loadingFiles.value"
      :opening-path="files.openingPath.value"
      :deleting-path="files.deletingPath.value"
      @refresh="files.fetchFiles"
      @preview="previewFile = $event"
      @open="files.openFile"
      @delete="requestDelete"
    />
    <ZipPreviewDialog :file="previewFile" @close="previewFile = null" />
    <NoticeDialog
      :notice="notice"
      @close="closeNotice"
      @confirm="confirmDelete"
    />
  </main>
</template>
