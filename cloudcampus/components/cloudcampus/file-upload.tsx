"use client";

import { useRef, useState } from "react";
import { Check, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Metadata returned once a file has been uploaded to S3. */
export interface UploadedFile {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
}

/**
 * Picks a file, requests a pre-signed URL from /api/uploads, uploads the file
 * directly to S3, and reports the resulting object key to the parent form.
 */
export function FileUpload({
  purpose,
  accept,
  disabled,
  onUploaded,
}: {
  purpose: "resource" | "photo" | "cover" | "attachment";
  accept?: string;
  disabled?: boolean;
  onUploaded: (file: UploadedFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Key of the file this picker last uploaded. If the user picks again before
  // the form is saved, that earlier object is orphaned and gets cleaned up.
  const lastKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setStatus("uploading");
    setFileName(file.name);
    try {
      const presign = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!presign.ok) {
        const data = (await presign.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Could not start the upload.");
      }
      const { uploadUrl, key } = (await presign.json()) as {
        uploadUrl: string;
        key: string;
      };

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!put.ok) throw new Error("The file could not be uploaded to S3.");

      // The new upload succeeded — discard the previous one it superseded so
      // abandoned files do not pile up in the bucket (fire-and-forget).
      const supersededKey = lastKeyRef.current;
      lastKeyRef.current = key;
      if (supersededKey && supersededKey !== key) {
        void fetch("/api/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose, key: supersededKey }),
        });
      }

      setStatus("done");
      onUploaded({
        key,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || status === "uploading"}
        onClick={() => inputRef.current?.click()}
      >
        {status === "done" ? <Check /> : <Upload />}
        {status === "uploading"
          ? "Uploading…"
          : status === "done"
            ? "Replace file"
            : "Choose file"}
      </Button>
      {fileName && status !== "idle" && (
        <p className="truncate text-xs text-muted-foreground">{fileName}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
