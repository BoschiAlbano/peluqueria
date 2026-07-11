"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Confirmación en Dialog (no toast) para acciones que modifican datos
// importantes — más visible y consistente con el resto de la app que un
// toast con botones inline, que es fácil de perder de vista.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending = false,
  variant = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant={variant} disabled={isPending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
