"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";

// Hộp hỏi xác nhận kiểu iOS (alert): tiêu đề, mô tả, hai nút xếp ngang.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Hủy",
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean; // nút xác nhận màu đỏ (xóa…)
  pending?: boolean;
  onConfirm: () => void;
}) {
  const buttonClass =
    "min-h-11 flex-1 text-body outline-none hover:bg-muted/60 focus-visible:bg-muted disabled:opacity-50";
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] min-h-dvh bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[calc(100vw-3rem)] max-w-[300px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] bg-popover text-center shadow-2xl outline-none transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-105 data-starting-style:opacity-0">
          <div className="px-4 pt-5 pb-4">
            <AlertDialog.Title className="text-headline">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="mt-1 text-footnote text-muted-foreground">
                {description}
              </AlertDialog.Description>
            )}
          </div>
          <div className="flex border-t border-border">
            <AlertDialog.Close className={cn(buttonClass, "border-r border-border text-primary")} disabled={pending}>
              {cancelLabel}
            </AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className={cn(buttonClass, "font-semibold", destructive ? "text-destructive" : "text-primary")}
            >
              {pending ? "Đang xử lý…" : confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
