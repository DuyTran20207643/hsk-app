"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

// Sheet bật lên kiểu iOS (form sheet): thanh trên có nút Hủy | tiêu đề | nút hành động,
// nội dung trên nền xám nhóm, cuộn được khi dài. Xem mockup 16b-them-tu-vung.png.
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Hủy",
  action,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string; // đọc cho trình đọc màn hình
  cancelLabel?: string;
  action?: React.ReactNode; // nút bên phải thanh trên, ví dụ "Lưu"
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black/30 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[14px] bg-background shadow-2xl outline-none transition-[scale,opacity] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-bar px-2">
            <Dialog.Close className="min-h-11 justify-self-start rounded-lg px-2 text-body text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50">
              {cancelLabel}
            </Dialog.Close>
            <Dialog.Title className="text-headline">{title}</Dialog.Title>
            <div className="justify-self-end">{action}</div>
          </div>
          {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Nhóm ô nhập trong sheet (khung trắng bo góc, các hàng có đường kẻ)
export function FormGroup({
  footer,
  className,
  children,
}: {
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="overflow-hidden rounded-xl bg-card">{children}</div>
      {footer && <div className="mt-1.5 px-4 text-footnote text-muted-foreground">{footer}</div>}
    </div>
  );
}

// Một hàng trong FormGroup: nhãn bên trái, ô nhập bên phải, lỗi (nếu có) ở dưới
export function FormRow({
  label,
  htmlFor,
  error,
  errorId,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group/row pl-4", className)}>
      <div className="flex flex-col border-b border-border py-1 pr-4 group-last/row:border-b-0">
        <div className="flex min-h-11 items-center gap-3">
          <label htmlFor={htmlFor} className="w-28 shrink-0 text-body sm:w-32">
            {label}
          </label>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        {error && (
          <p id={errorId} className="pb-2 text-footnote text-destructive sm:pl-35">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// Class cho ô nhập chữ không viền đặt trong FormRow
export const sheetInputClass =
  "min-h-11 w-full bg-transparent text-body outline-none placeholder:text-muted-foreground/70 aria-invalid:placeholder:text-destructive/60";
