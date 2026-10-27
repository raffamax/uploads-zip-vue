import JSZip from "jszip";
import dayjs from "dayjs";

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(2)} ${units[index]}`;
}

export async function createZip(files: File[]) {
  const zip = new JSZip();
  files.forEach((file, index) =>
    zip.file(`uploads/${index + 1}-${file.name}`, file),
  );
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return new File(
    [blob],
    `arquivos-${dayjs(Date.now()).format("YYYY-MM-DD-HH_mm")}.zip`,
    {
      type: "application/zip",
    },
  );
}

export function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
