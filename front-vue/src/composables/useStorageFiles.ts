import { computed, ref, watch, type Ref } from "vue";
import dayjs from "dayjs";
import { storageBucket, supabase } from "../lib/supabase";
import { createZip } from "../utils/files";
import type { UploadedFile } from "../types/upload";

export function useStorageFiles(
  userId: Ref<string | undefined>,
  notify: (
    title: string,
    message: string,
    variant?: "info" | "success" | "error" | "confirm",
  ) => void,
) {
  const selectedFiles = ref<File[]>([]);
  const uploadedFiles = ref<UploadedFile[]>([]);
  const loadingUpload = ref(false);
  const loadingFiles = ref(false);
  const deletingPath = ref<string | null>(null);
  const openingPath = ref<string | null>(null);
  const errorMessage = ref("");
  const successMessage = ref("");
  const totalSize = computed(() =>
    selectedFiles.value.reduce((total, file) => total + file.size, 0),
  );

  function addFiles(files: File[]) {
    const keys = new Set(
      selectedFiles.value.map(
        (file) => `${file.name}-${file.size}-${file.lastModified}`,
      ),
    );
    selectedFiles.value = [
      ...selectedFiles.value,
      ...files.filter(
        (file) => !keys.has(`${file.name}-${file.size}-${file.lastModified}`),
      ),
    ];
    errorMessage.value = "";
    successMessage.value = "";
  }
  function removeSelectedFile(file: File) {
    selectedFiles.value = selectedFiles.value.filter((item) => item !== file);
  }
  function clearSelectedFiles() {
    selectedFiles.value = [];
    errorMessage.value = "";
    successMessage.value = "";
  }

  async function fetchFiles() {
    if (!userId.value) return;
    loadingFiles.value = true;
    try {
      const files: UploadedFile[] = [];
      async function listFolder(folder: string): Promise<void> {
        const { data, error } = await supabase.storage
          .from(storageBucket)
          .list(folder, {
            limit: 100,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          });
        if (error) throw error;
        for (const item of data ?? []) {
          const path = `${folder}/${item.name}`;
          if (!item.metadata) await listFolder(path);
          else if (item.name.toLowerCase().endsWith(".zip"))
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
      await listFolder(userId.value);
      uploadedFiles.value = files.sort(
        (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf(),
      );
    } catch (cause) {
      console.error("Erro ao listar arquivos:", cause);
      notify("Erro", "Erro ao carregar arquivos", "error");
    } finally {
      loadingFiles.value = false;
    }
  }

  async function upload() {
    if (!userId.value) return;
    if (!selectedFiles.value.length) {
      errorMessage.value = "Selecione ao menos um arquivo.";
      return;
    }
    loadingUpload.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const zip = await createZip(selectedFiles.value);
      const date = new Date();
      const path = `${userId.value}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${Date.now()}-${zip.name}`;
      const { error } = await supabase.storage
        .from(storageBucket)
        .upload(path, zip, { contentType: "application/zip", upsert: false });
      if (error) throw error;
      successMessage.value = `Upload concluído. Arquivo salvo com sucesso em: ${path}`;
      clearSelectedFiles();
      await fetchFiles();
    } catch (cause) {
      errorMessage.value =
        cause instanceof Error
          ? cause.message
          : "Erro ao enviar o arquivo ZIP.";
    } finally {
      loadingUpload.value = false;
    }
  }

  async function openFile(path: string) {
    openingPath.value = path;
    try {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(path, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (cause) {
      console.error(cause);
      notify("Erro", "Erro ao gerar link do arquivo", "error");
    } finally {
      openingPath.value = null;
    }
  }
  async function deleteFile(path: string) {
    deletingPath.value = path;
    try {
      const { error } = await supabase.storage
        .from(storageBucket)
        .remove([path]);
      if (error) throw error;
      uploadedFiles.value = uploadedFiles.value.filter(
        (file) => file.path !== path,
      );
      notify("Sucesso", "Arquivo excluído com sucesso", "success");
    } catch (cause) {
      console.error(cause);
      notify("Erro", "Erro ao excluir arquivo", "error");
    } finally {
      deletingPath.value = null;
    }
  }

  watch(
    userId,
    (id) => {
      if (id) fetchFiles();
      else {
        uploadedFiles.value = [];
        selectedFiles.value = [];
      }
    },
    { immediate: true },
  );
  return {
    selectedFiles,
    uploadedFiles,
    loadingUpload,
    loadingFiles,
    deletingPath,
    openingPath,
    errorMessage,
    successMessage,
    totalSize,
    addFiles,
    removeSelectedFile,
    clearSelectedFiles,
    upload,
    fetchFiles,
    openFile,
    deleteFile,
  };
}
