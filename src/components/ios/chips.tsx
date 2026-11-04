import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const chipBase = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 whitespace-nowrap";

// Âm Hán Việt của từ: chữ tint trên nền tint-fill (điểm khác biệt A)
export function HanVietChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(chipBase, "bg-secondary text-subheadline font-semibold text-primary", className)}>
      {children}
    </span>
  );
}

// Cảnh báo từ Hán Việt dễ nhầm nghĩa
export function FalseFriendChip({ className }: { className?: string }) {
  return (
    <span className={cn(chipBase, "bg-orange-fill text-caption font-bold text-orange uppercase", className)}>
      <TriangleAlert className="size-3.5" aria-hidden />
      Dễ nhầm
    </span>
  );
}

export type AnswerStatus = "correct" | "wrong" | "unsure";

const STATUS = {
  correct: { label: "Đúng", icon: CircleCheck, className: "bg-green-fill text-green" },
  wrong: { label: "Sai", icon: CircleX, className: "bg-red-fill text-destructive" },
  unsure: { label: "Chưa chắc", icon: CircleHelp, className: "bg-orange-fill text-orange" },
} as const;

// Trạng thái câu trả lời. Luôn có biểu tượng và chữ, không chỉ dựa vào màu.
export function StatusChip({
  status,
  label,
  className,
}: {
  status: AnswerStatus;
  label?: string; // ghi đè chữ mặc định, ví dụ "Chưa đạt · thiếu 5 điểm"
  className?: string;
}) {
  const { label: defaultLabel, icon: Icon, className: colors } = STATUS[status];
  return (
    <span className={cn(chipBase, "text-footnote font-semibold", colors, className)}>
      <Icon className="size-4" aria-hidden />
      {label ?? defaultLabel}
    </span>
  );
}
