"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import type { FormLink } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Resolves a frame-able URL from whatever was saved for a form. Admins may
 * save a plain link, an "…?embedded=true" URL, or paste Google's whole
 * `<iframe … src="…">` embed snippet — handle all three. Google Forms only
 * render inside a frame when the URL carries the `embedded=true` flag, so add
 * it when it is missing.
 */
function resolveEmbedSrc(raw: string): string {
  let url = (raw ?? "").trim();
  const tagSrc = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(url);
  if (tagSrc) url = tagSrc[1].trim();
  // Google Forms render inside a frame only with embedded=true.
  if (
    url.includes("docs.google.com/forms") &&
    !/[?&]embedded=true/.test(url)
  ) {
    url += `${url.includes("?") ? "&" : "?"}embedded=true`;
  }
  // Microsoft Forms (forms.office.com / forms.cloud.microsoft) use embed=true.
  if (
    /forms\.(office\.com|cloud\.microsoft)/.test(url) &&
    !/[?&]embed=true/.test(url)
  ) {
    url += `${url.includes("?") ? "&" : "?"}embed=true`;
  }
  return url;
}

export function FormsView({ forms }: { forms: FormLink[] }) {
  const [activeId, setActiveId] = useState(forms[0]?.id);

  if (forms.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Forms"
          subtitle="Recruitment, feedback, and registration"
        />
        <EmptyState
          icon={FileText}
          title="No forms available"
          body="Check back soon — forms are published as the organization needs them."
        />
      </div>
    );
  }

  const active = forms.find((f) => f.id === activeId) ?? forms[0];
  const embedSrc = resolveEmbedSrc(active.embedHtml);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        subtitle="Recruitment, feedback, and registration"
      />

      {/* Selectable cards — one per form — replace the tab strip. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => {
          const selected = form.id === active.id;
          return (
            <button
              key={form.id}
              type="button"
              onClick={() => setActiveId(form.id)}
              aria-pressed={selected}
              className={cn(
                "rounded-xl bg-card p-4 text-left text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none",
                selected
                  ? "ring-2 ring-ring"
                  : "focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-tight">{form.title}</h3>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {form.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active form panel */}
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{active.title}</h2>
            <p className="text-sm text-muted-foreground">
              {active.description}
            </p>
          </div>
          <a
            href={active.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Open in new tab ↗
          </a>
        </div>
        {/*
          The live Google / Microsoft form. CSP frame-src (next.config.ts)
          allows docs.google.com and forms.office.com. resolveEmbedSrc copes
          with links saved as a plain URL or as a full <iframe> snippet.
        */}
        <iframe
          key={active.id}
          src={embedSrc}
          title={`${active.title} form`}
          className="h-[80vh] min-h-[600px] w-full bg-background md:min-h-[800px]"
        />
      </div>
    </div>
  );
}
