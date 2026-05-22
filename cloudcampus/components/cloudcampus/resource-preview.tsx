import { ResourceIcon } from "@/components/cloudcampus/resource-icon";
import type { ResourceType } from "@/lib/types";

/**
 * In-page preview of a resource file (FR-RES-02): PDFs render in an iframe,
 * images render inline, and other file types fall back to a download prompt.
 * Both the iframe and image load the file from S3 via the (inline) download
 * route, which redirects to a short-lived pre-signed URL.
 */
export function ResourcePreview({
  resourceId,
  type,
  title,
}: {
  resourceId: string;
  type: ResourceType;
  title: string;
}) {
  const src = `/api/resources/${resourceId}/download`;

  if (type === "pdf") {
    return (
      <iframe
        src={src}
        title={`${title} preview`}
        className="aspect-[3/4] w-full rounded-xl bg-muted ring-1 ring-foreground/10"
      />
    );
  }

  if (type === "image") {
    return (
      <div className="flex justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
        {/* Pre-signed S3 URL — must not be optimised by next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="max-h-[80vh] w-auto" />
      </div>
    );
  }

  // docx / xlsx / pptx / zip — no in-browser preview.
  return (
    <div className="ph-stripes flex aspect-[3/4] items-center justify-center rounded-xl ring-1 ring-foreground/10">
      <div className="max-w-xs px-4 text-center">
        <ResourceIcon
          type={type}
          className="mx-auto h-10 w-10 text-muted-foreground"
        />
        <p className="mt-2 text-sm font-medium">No in-browser preview</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This file type cannot be previewed. Use the download button to open
          it.
        </p>
      </div>
    </div>
  );
}
