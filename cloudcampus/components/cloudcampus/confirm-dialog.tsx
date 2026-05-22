"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmVariant = React.ComponentProps<typeof Button>["variant"];

interface ConfirmCopy {
  /** Dialog heading, e.g. "Save changes?". */
  title: string;
  /** Dialog body — spell out what the action will do. */
  description: React.ReactNode;
  /** Label on the confirm button (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Label on the dismiss button (defaults to "Cancel"). */
  cancelLabel?: string;
  /** Variant of the confirm button, e.g. "destructive". */
  confirmVariant?: ConfirmVariant;
}

/**
 * A controlled confirmation dialog. The confirm button stays disabled and
 * shows a pending label while `onConfirm` runs, then the dialog closes.
 *
 * Use this for form submissions: have the form's `onSubmit` capture its data
 * and open the dialog instead of saving directly, so every submission path
 * (button click and Enter-to-submit alike) is gated.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  onConfirm,
}: ConfirmCopy & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The action to run when the user confirms. */
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Don't let an outside click or Escape dismiss mid-action.
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={busy}
            onClick={async (event) => {
              // Keep the dialog open while the async action runs.
              event.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A button that opens a {@link ConfirmDialog} before running its action — the
 * convenient form for direct actions (approve, reject, change a role). For a
 * button that submits a form, drive a `ConfirmDialog` from the form instead.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant,
  onConfirm,
  children,
  ...buttonProps
}: ConfirmCopy &
  Omit<React.ComponentProps<typeof Button>, "onClick"> & {
    onConfirm: () => void | Promise<void>;
  }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button {...buttonProps} type="button" onClick={() => setOpen(true)}>
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        confirmVariant={confirmVariant}
        onConfirm={onConfirm}
      />
    </>
  );
}
