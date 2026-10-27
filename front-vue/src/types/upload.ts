export type UploadedFile = {
  name: string;
  path: string;
  size: number;
  mimetype: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NoticeVariant = "info" | "success" | "error" | "confirm";

export type Notice = {
  open: boolean;
  title: string;
  message: string;
  variant: NoticeVariant;
};
