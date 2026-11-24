"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleX } from "lucide-react";
import { WeakPointChip } from "@/components/ios/chips";
import { SegmentedControl } from "@/components/ios/segmented-control";
import { Button } from "@/components/ui/button";
import type { LookupOption } from "@/lib/lookups";
import type { QuestionType } from "@/lib/questions/types";
import { cn } from "@/lib/utils";
import { startMixedReview, startTypePractice, type ReviewFormState } from "../practice/actions";

function FormError({ state }: { state: ReviewFormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-subheadline text-destructive">
      <CircleX className="size-5 shrink-0" aria-hidden />
      {state.error}
    </p>
  );
}

// Thẻ "Ôn tổng hợp": chọn cấp (mặc định cấp mục tiêu) → 30 câu trộn mọi dạng.
// Đổi cấp thì đổi luôn địa chỉ trang (?level=), để danh sách "Luyện theo dạng câu" theo cùng cấp.
export function MixedReviewCard({ levels, level }: { levels: LookupOption[]; level: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(level));
  const [, startNavigation] = useTransition();
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(startMixedReview, null);
  const name = levels.find((l) => String(l.id) === value)?.name ?? "";

  return (
    <section aria-labelledby="mixed-heading" className="grid gap-4 rounded-[20px] bg-card p-5 sm:p-6 lg:grid-cols-2 lg:items-center lg:gap-8">
      <div className="flex flex-col gap-1">
        <h2 id="mixed-heading" className="text-title2">
          Ôn tổng hợp
        </h2>
        <p className="text-subheadline text-muted-foreground">
          30 câu trộn từ vựng, ngữ pháp và các dạng câu. Phần lớn là câu bạn đã gặp, xen một ít câu mới. Không tính
          giờ, dừng lúc nào cũng được.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <SegmentedControl
          label="Cấp HSK"
          name="level"
          options={levels.map((l) => ({ value: String(l.id), label: l.name }))}
          value={value}
          onChange={(next) => {
            setValue(next);
            startNavigation(() => router.replace(`/review?level=${next}`, { scroll: false }));
          }}
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Đang tạo phiên…" : `Bắt đầu ôn ${name} · 30 câu`}
        </Button>
        <FormError state={state} />
      </form>
    </section>
  );
}

export type TypeRow = {
  type: QuestionType;
  label: string;
  /** Tỷ lệ đúng 30 ngày qua (0–100); null = chưa làm câu nào */
  correctPercent: number | null;
  answered: number;
  weak: boolean;
  /** Cấp đang xem có câu hỏi dạng này không */
  available: boolean;
};

// Danh sách "Luyện theo dạng câu": mỗi hàng là một nút gửi form (dạng câu + cấp) → 10 câu.
export function TypePracticeList({ level, sections }: { level: number; sections: { title: string; rows: TypeRow[] }[] }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(startTypePractice, null);
  const [chosen, setChosen] = useState<QuestionType | null>(null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="level" value={level} />
      <FormError state={state} />
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col">
          <h3 className="mb-1.5 px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
            {section.title}
          </h3>
          <div className="overflow-hidden rounded-xl bg-card">
            {section.rows.map((row) => (
              <button
                key={row.type}
                type="submit"
                name="type"
                value={row.type}
                disabled={pending || !row.available}
                onClick={() => setChosen(row.type)}
                aria-label={`${row.label}${row.weak ? ", điểm yếu" : ""}${
                  row.correctPercent !== null ? `, đúng ${row.correctPercent}% (${row.answered} câu)` : ""
                }${row.available ? "" : ", chưa có câu hỏi"}`}
                className={cn(
                  "group/row flex w-full items-center gap-3 pl-4 text-left outline-none transition-colors",
                  row.available && "hover:bg-muted/60 focus-visible:bg-muted active:bg-muted",
                  "disabled:cursor-default",
                )}
              >
                <span className="flex min-h-12 flex-1 items-center gap-3 border-b border-border py-2.5 pr-4 group-last/row:border-b-0">
                  <span className={cn("flex-1 text-body", !row.available && "text-muted-foreground")}>{row.label}</span>
                  {row.weak && <WeakPointChip />}
                  <span className="shrink-0 text-subheadline text-muted-foreground tabular-nums">
                    {pending && chosen === row.type
                      ? "Đang tạo phiên…"
                      : !row.available
                        ? "Chưa có câu hỏi"
                        : row.correctPercent === null
                          ? "Chưa làm"
                          : `đúng ${row.correctPercent}%`}
                  </span>
                  <ChevronRight className={cn("size-5 shrink-0 text-input", !row.available && "invisible")} aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </form>
  );
}
