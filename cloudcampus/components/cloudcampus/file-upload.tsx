"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Result of an actually-completed upload to S3. */
export interface UploadedFile {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
}

type Purpose = "resource" | "photo" | "cover" | "attachment";

/**
 * Picks a file and holds it client-side. The parent form is responsible for
 * uploading via {@link uploadFile} when its save action runs, so an abandoned
 * form never leaves an orphan in S3.
 */
export function FileUpload({
  purpose: _purpose,
  accept,
  disabled,
  onChange,
}: {
  purpose: Purpose;
  accept?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function pickFile(file: File | null) {
    setFileName(file?.name ?? null);
    onChange(file);
    if (!file && inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {fileName ? "Replace file" : "Choose file"}
        </Button>
        {fileName && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => pickFile(null)}
          >
            <X />
            Remove
          </Button>
        )}
      </div>
      {fileName && (
        <p className="truncate text-xs text-muted-foreground">{fileName}</p>
      )}
    </div>
  );
}

/**
 * Mints a pre-signed PUT URL from /api/uploads and uploads `file` directly to
 * S3. Returns the resulting object key + metadata for the form payload.
 * Callers should invoke this from their save handler, only when the form
 * is actually being submitted.
 */
export async function uploadFile(
  file: File,
  purpose: Purpose,
): Promise<UploadedFile> {
  const contentType = file.type || "application/octet-stream";
  const presign = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, fileName: file.name, contentType }),
  });
  if (!presign.ok) {
    const data = (await presign.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not start the upload.");
  }
  const { uploadUrl, key } = (await presign.json()) as {
    uploadUrl: string;
    key: string;
  };
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("The file could not be uploaded to S3.");
  return { key, fileName: file.name, contentType, size: file.size };
}
