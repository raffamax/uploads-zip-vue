import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias no .env",
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

app.use(
  cors({
    origin: corsOrigin,
  }),
);

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

type StorageListItem = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
    [key: string]: unknown;
  };
};

type NormalizedFile = {
  name: string;
  path: string;
  size: number;
  mimetype: string;
  createdAt: string | null;
  updatedAt: string | null;
};

async function listFilesRecursively(
  folder = "",
  accumulator: NormalizedFile[] = [],
): Promise<NormalizedFile[]> {
  const { data, error } = await supabase.storage.from(bucketName).list(folder, {
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw error;
  }

  for (const item of (data || []) as StorageListItem[]) {
    const currentPath = folder ? `${folder}/${item.name}` : item.name;

    const isFolder = !item.metadata;

    if (isFolder) {
      await listFilesRecursively(currentPath, accumulator);
      continue;
    }

    accumulator.push({
      name: item.name,
      path: currentPath,
      size: item.metadata?.size ?? 0,
      mimetype: item.metadata?.mimetype ?? "application/octet-stream",
      createdAt: item.created_at ?? null,
      updatedAt: item.updated_at ?? null,
    });
  }

  return accumulator;
}

app.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Arquivo não enviado",
      });
    }

    const originalName = req.file.originalname || "arquivos.zip";
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const filePath = `${year}/${month}/${Date.now()}-${originalName}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype || "application/zip",
        upsert: false,
      });

    if (error) {
      console.error("Erro Supabase upload:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Upload realizado com sucesso",
      file: {
        name: originalName,
        path: filePath,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error("Erro interno no upload:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Erro interno no upload",
    });
  }
});

app.get("/files", async (_req, res) => {
  try {
    const files = await listFilesRecursively();

    const normalized = files
      .filter((file) => file.name.toLowerCase().endsWith(".zip"))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

    return res.status(200).json({
      success: true,
      files: normalized,
    });
  } catch (error) {
    console.error("Erro ao listar arquivos:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Erro ao listar arquivos",
    });
  }
});

app.get("/files/signed-url", async (req, res) => {
  try {
    const path = req.query.path as string | undefined;

    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'O parâmetro "path" é obrigatório',
      });
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, 60 * 5);

    if (error) {
      console.error("Erro ao gerar signed URL:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      url: data.signedUrl,
    });
  } catch (error) {
    console.error("Erro interno ao gerar signed URL:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Erro interno ao gerar URL",
    });
  }
});

app.delete("/files", async (req, res) => {
  try {
    const path = req.query.path as string | undefined;

    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'O parâmetro "path" é obrigatório',
      });
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([path]);

    if (error) {
      console.error("Erro ao excluir arquivo:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Arquivo excluído com sucesso",
      data,
    });
  } catch (error) {
    console.error("Erro interno ao excluir arquivo:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro interno ao excluir arquivo",
    });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
