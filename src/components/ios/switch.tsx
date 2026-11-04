"use client";

import { cn } from "@/lib/utils";

// Công tắc bật / tắt kiểu iOS (bật: nền xanh lá). Vùng bấm cao 44px.
export function Switch({
  checked,
  onCheckedChange,
  id,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group/switch flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "relative h-[31px] w-[51px] rounded-full transition-colors duration-200",
          checked ? "bg-green" : "bg-muted ring-1 ring-border ring-inset",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
