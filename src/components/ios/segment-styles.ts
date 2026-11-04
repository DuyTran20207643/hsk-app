import { cn } from "@/lib/utils";

// Kiểu dáng segmented control dùng chung cho SegmentedControl (chọn giá trị)
// và thanh điều hướng (liên kết). Mỗi ô cao tối thiểu 44px.
export const segmentTrackClass = "flex rounded-xl bg-muted p-0.5";

export function segmentItemClass(active: boolean) {
  return cn(
    "flex min-h-11 flex-1 shrink-0 items-center justify-center rounded-[10px] px-3 text-subheadline whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-4",
    active
      ? "bg-card font-semibold shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-[#636366]"
      : "text-foreground/80 hover:text-foreground",
  );
}
