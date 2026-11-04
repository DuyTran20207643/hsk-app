"use client";

import { cn } from "@/lib/utils";
import { segmentItemClass, segmentTrackClass } from "./segment-styles";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string; // đọc cho trình đọc màn hình
  name?: string; // có name thì gửi kèm giá trị khi submit form
  className?: string;
};

// Segmented control kiểu iOS: chọn một trong vài lựa chọn ngắn.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  name,
  className,
}: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn(segmentTrackClass, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={segmentItemClass(option.value === value)}
        >
          {option.label}
        </button>
      ))}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
