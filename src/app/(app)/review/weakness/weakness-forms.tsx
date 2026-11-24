"use client";

import { useActionState, useState } from "react";
import { CircleX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startMixedReview, startWeaknessReview, type ReviewFormState } from "../../practice/actions";

function FormError({ state }: { state: ReviewFormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-subheadline text-destructive">
      <CircleX className="size-5 shrink-0" aria-hidden />
      {state.error}
    </p>
  );
}

/** Nút bắt đầu Ôn tổng hợp (gợi ý khi chưa đủ dữ liệu / không có điểm yếu) */
export function MixedStartButton({ level, label }: { level: number; label: string }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(startMixedReview, null);
  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <input type="hidden" name="level" value={level} />
      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo phiên…" : label}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export type WeaknessChoice = { key: string; kind: string; name: string; wrongPercent: number; answered: number };

// Tối đa 3 điểm yếu nặng nhất, mỗi điểm một nút "Ôn 10 câu", cuối cùng là "Ôn tất cả".
// Trình duyệt chỉ gửi khóa điểm yếu; máy chủ tính lại điểm yếu trước khi tạo phiên.
export function WeaknessChoices({ choices, total }: { choices: WeaknessChoice[]; total: number }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(startWeaknessReview, null);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol aria-label="Điểm yếu nặng nhất" className="flex flex-col overflow-hidden rounded-[20px] bg-card">
        {choices.map((c, i) => (
          <li key={c.key} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:px-5">
            <span className="w-6 text-headline text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-footnote font-semibold tracking-wide text-muted-foreground uppercase">{c.kind}</span>
              <span className="text-headline">{c.name}</span>
              <span className="text-subheadline text-muted-foreground tabular-nums">
                sai {c.wrongPercent}% · {c.answered} câu đã làm
              </span>
            </span>
            <Button
              type="submit"
              name="target"
              value={c.key}
              variant="tinted"
              disabled={pending}
              onClick={() => setChosen(c.key)}
              aria-label={`Ôn 10 câu: ${c.name}`}
            >
              <Play aria-hidden />
              {pending && chosen === c.key ? "Đang tạo phiên…" : "Ôn 10 câu"}
            </Button>
          </li>
        ))}
      </ol>
      <FormError state={state} />
      <Button
        type="submit"
        name="target"
        value="all"
        size="lg"
        disabled={pending}
        onClick={() => setChosen("all")}
      >
        {pending && chosen === "all" ? "Đang tạo phiên…" : `Ôn tất cả${total > 1 ? ` (${total} điểm yếu)` : ""} · 10 câu`}
      </Button>
    </form>
  );
}
