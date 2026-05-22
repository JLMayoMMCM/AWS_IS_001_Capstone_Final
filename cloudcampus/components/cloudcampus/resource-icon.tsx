import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react";

import type { ResourceType } from "@/lib/types";

/** Renders the lucide icon for a given resource file type. */
export function ResourceIcon({
  type,
  className,
}: {
  type: ResourceType;
  className?: string;
}) {
  switch (type) {
    case "xlsx":
      return <FileSpreadsheet className={className} />;
    case "pptx":
      return <Presentation className={className} />;
    case "zip":
      return <FileArchive className={className} />;
    case "image":
      return <FileImage className={className} />;
    default:
      return <FileText className={className} />;
  }
}
