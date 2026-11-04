import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Nhóm danh sách inset kiểu iOS: tiêu đề nhỏ viết hoa phía trên,
// các hàng trong khung bo 12px, ghi chú nhỏ phía dưới.
export function ListGroup({
  header,
  footer,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { header?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col", className)} {...props}>
      {header && (
        <h2 className="mb-1.5 px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          {header}
        </h2>
      )}
      <div className="overflow-hidden rounded-xl bg-card">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-muted-foreground">{footer}</p>}
    </section>
  );
}

type ListRowProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode; // biểu tượng / chữ ở đầu hàng
  trailing?: React.ReactNode; // nội dung cuối hàng (giá trị, chip…)
  chevron?: boolean; // mũi tên ">" cuối hàng
  selected?: boolean; // dấu ✓ cuối hàng (hàng dạng lựa chọn)
  href?: string;
  onClick?: () => void;
  className?: string;
};

// Một hàng trong ListGroup. Đường phân cách thụt lề theo nội dung, hàng cuối không có.
// Có href → liên kết; có onClick → nút (kèm selected → hàng lựa chọn kiểu radio).
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron,
  selected,
  href,
  onClick,
  className,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="flex min-h-11 flex-1 items-center gap-3 border-b border-border py-2.5 pr-4 group-last/row:border-b-0">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body">{title}</span>
          {subtitle && <span className="text-subheadline text-muted-foreground">{subtitle}</span>}
        </span>
        {trailing && <span className="shrink-0 text-muted-foreground">{trailing}</span>}
        {selected && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
        {chevron && <ChevronRight className="size-5 shrink-0 text-input" aria-hidden />}
      </span>
    </>
  );
  const rowClass = cn(
    "group/row flex w-full items-center gap-3 pl-4 text-left",
    interactive && "transition-colors hover:bg-muted/60 active:bg-muted focus-visible:bg-muted outline-none",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={rowClass}
        {...(selected !== undefined && { role: "radio", "aria-checked": selected })}
      >
        {content}
      </button>
    );
  }
  return <div className={rowClass}>{content}</div>;
}
