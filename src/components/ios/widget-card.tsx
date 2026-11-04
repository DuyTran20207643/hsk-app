import { cn } from "@/lib/utils";

// Thẻ nội dung kiểu widget iOS: nền card, bo 20px, không viền, không bóng.
export function WidgetCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-[20px] bg-card p-5", className)} {...props} />;
}
