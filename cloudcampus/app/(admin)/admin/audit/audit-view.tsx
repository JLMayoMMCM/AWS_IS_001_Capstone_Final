"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { AuditEntry } from "@/lib/queries";

type BadgeVariant = "secondary" | "success" | "destructive" | "warning";

function actionVariant(action: string): BadgeVariant {
  if (action.includes("FORCE")) return "warning";
  if (
    action.includes("REJECT") ||
    action.includes("CANCEL") ||
    action.includes("DELETE") ||
    action.includes("REVOKE")
  ) {
    return "destructive";
  }
  if (action.includes("APPROVE") || action.includes("PROMOTE")) {
    return "success";
  }
  return "secondary";
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value, null, 2);
}

export function AuditView({ entries }: { entries: AuditEntry[] }) {
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [action, setAction] = useState("");

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries],
  );
  const filtered = action
    ? entries.filter((e) => e.action === action)
    : entries;

  return (
    <>
      <NativeSelect
        value={action}
        onChange={(e) => setAction(e.target.value)}
        aria-label="Filter by action"
        className="w-full sm:w-64"
      >
        <NativeSelectOption value="">All actions</NativeSelectOption>
        {actions.map((a) => (
          <NativeSelectOption key={a} value={a}>
            {a}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No audit entries.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                  tabIndex={0}
                  aria-label={`Audit entry ${entry.action} — open details`}
                  onClick={() => setSelected(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(entry);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(entry.at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <UserAvatar name={entry.actorName} size="xs" />
                      {entry.actorName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(entry.action)}>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.entity}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {entry.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.action}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 overflow-y-auto px-4 pb-4 text-sm">
              <dl className="space-y-2">
                {[
                  ["When", new Date(selected.at).toLocaleString()],
                  ["Actor", selected.actorName],
                  ["Entity", selected.entity],
                  ["Target", selected.entityId ?? "—"],
                  ["IP", selected.ip ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-mono text-xs">{value}</dd>
                  </div>
                ))}
              </dl>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Before
                </p>
                <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {formatJson(selected.before)}
                </pre>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  After
                </p>
                <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {formatJson(selected.after)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
