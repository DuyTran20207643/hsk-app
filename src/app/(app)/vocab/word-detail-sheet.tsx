"use client";

import { useState, useTransition } from "react";
import { BookmarkCheck, Plus } from "lucide-react";
import { Sheet } from "@/components/ios/sheet";
import { FalseFriendNote, WordDetails } from "@/components/words/word-details";
import { Button } from "@/components/ui/button";
import { addDaysISO } from "@/lib/plan";
import type { WordRow } from "@/lib/words/word-input";
import { addToReview } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: WordRow | null;
  levelName: string | undefined;
  /** Ngày ôn tiếp theo nếu từ đã có trong bộ ôn tập, null nếu chưa có */
  dueDate: string | null;
  today: string;
  onAdded: (wordId: string, dueDate: string) => void;
};

// "YYYY-MM-DD" → "hôm nay" / "ngày mai" / "15/11/2026"
function formatDueDate(dueDate: string, today: string): string {
  if (dueDate <= today) return "hôm nay";
  if (dueDate === addDaysISO(today, 1)) return "ngày mai";
  const [y, m, d] = dueDate.split("-");
  return `ngày ${d}/${m}/${y}`;
}

// Sheet chi tiết một từ. Bố cục theo mặt sau thẻ từ: docs/mockups/08b-the-tu-mat-sau.png
export function WordDetailSheet({ open, onOpenChange, word, levelName, dueDate, today, onAdded }: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Chi tiết từ"
      cancelLabel="Đóng"
      description={word ? `Chi tiết từ ${word.hanzi}` : undefined}
    >
      {word && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-card p-4">
            <WordDetails word={word} levelName={levelName} />
          </div>

          <FalseFriendNote word={word} />

          {/* key: đổi từ thì xóa lỗi / trạng thái đang thêm của từ trước */}
          <ReviewAction key={word.id} wordId={word.id} dueDate={dueDate} today={today} onAdded={onAdded} />
        </div>
      )}
    </Sheet>
  );
}

function ReviewAction({
  wordId,
  dueDate,
  today,
  onAdded,
}: {
  wordId: string;
  dueDate: string | null;
  today: string;
  onAdded: (wordId: string, dueDate: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (dueDate) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3">
        <BookmarkCheck className="size-6 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col">
          <p className="text-headline">Đã có trong bộ ôn tập</p>
          <p className="text-subheadline text-muted-foreground">Ôn tiếp: {formatDueDate(dueDate, today)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="w-full"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await addToReview(wordId);
            if (result.ok) onAdded(wordId, result.dueDate);
            else setError(result.error);
          });
        }}
      >
        <Plus aria-hidden />
        {isPending ? "Đang thêm…" : "Thêm vào bộ ôn tập"}
      </Button>
      {error && (
        <p role="alert" className="text-center text-footnote text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
