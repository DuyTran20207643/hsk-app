"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { CalendarCheck, ChevronLeft, CircleCheck } from "lucide-react";
import { FalseFriendNote, WordDetails } from "@/components/words/word-details";
import { buttonVariants } from "@/components/ui/button";
import { addDaysISO, formatDateVN } from "@/lib/plan";
import { RATING_LABEL, RATINGS, scheduleReview, type Rating, type SrsState } from "@/lib/srs";
import { cn } from "@/lib/utils";
import type { WordRow } from "@/lib/words/word-input";
import { submitReview } from "./actions";

export type ReviewItem = { word: WordRow; state: SrsState };

type Props = {
  items: ReviewItem[];
  today: string;
  /** Khi không có thẻ đến hạn: ngày ôn gần nhất sắp tới (null nếu bộ ôn tập trống) */
  nextDueDate: string | null;
};

const RATING_STYLE: Record<Rating, string> = {
  again: "bg-red-fill text-destructive",
  hard: "bg-muted text-foreground",
  good: "bg-secondary text-primary",
  easy: "bg-green-fill text-green",
};

export function FlashcardSession({ items, today, nextDueDate }: Props) {
  // Hàng đợi của lượt ôn: thẻ đầu tiên là thẻ đang ôn. Chọn Quên thì thẻ xuống cuối hàng.
  const [queue, setQueue] = useState(items);
  const [flipped, setFlipped] = useState(false);
  // Số thẻ đã xong (chọn Khó / Nhớ / Dễ); thẻ chọn Quên chưa tính là xong
  const [completed, setCompleted] = useState(0);
  // Kết quả lần đầu gặp mỗi thẻ trong lượt này (true = nhớ), để tính tỷ lệ nhớ
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const frontRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const total = items.length;
  const current = queue[0];

  // Đổi thẻ hoặc lật thẻ thì đưa con trỏ bàn phím vào đúng chỗ (người dùng trình đọc màn hình biết đã đổi)
  useEffect(() => {
    if (!current) return;
    (flipped ? backRef.current : frontRef.current)?.focus({ preventScroll: true });
  }, [flipped, current]);

  function rate(rating: Rating) {
    if (!current || isSaving) return;
    const { word } = current;
    setError(null);
    startSaving(async () => {
      const result = await submitReview(word.id, rating);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFirstTry((prev) => (word.id in prev ? prev : { ...prev, [word.id]: rating !== "again" }));
      setQueue((prev) => {
        const [head, ...rest] = prev;
        if (!head || head.word.id !== word.id) return prev;
        // Quên: xếp lại cuối hàng đợi với trạng thái mới máy chủ vừa tính
        return rating === "again" ? [...rest, { ...head, state: result.state }] : rest;
      });
      if (rating !== "again") setCompleted((n) => n + 1);
      setFlipped(false);
    });
  }

  // Phím tắt: Space lật thẻ, 1–4 chọn Quên / Khó / Nhớ / Dễ
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!current || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

    if (event.key === " " && !flipped) {
      event.preventDefault(); // không cuộn trang, không bấm hai lần vào nút đang chọn
      setFlipped(true);
      return;
    }
    const index = ["1", "2", "3", "4"].indexOf(event.key);
    if (flipped && index >= 0) {
      event.preventDefault();
      rate(RATINGS[index]);
    }
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const position = Math.min(completed + 1, total);

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh trên: quay lại | tiêu đề | bộ đếm */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Link
          href="/home"
          className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-body text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Trang chủ
        </Link>
        <h1 className="text-headline">
          <span lang="zh-CN" className="font-hanzi">
            复习
          </span>{" "}
          · Ôn thẻ từ
        </h1>
        {total > 0 && current && (
          <p className="justify-self-end text-subheadline text-muted-foreground tabular-nums">
            <span className="sr-only">Thẻ </span>
            {position} / {total}
          </p>
        )}
      </div>

      {total > 0 && (
        <div
          role="progressbar"
          aria-label="Tiến độ lượt ôn"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-valuetext={`Đã ôn xong ${completed} trên ${total} thẻ`}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      )}

      {total === 0 ? (
        <NothingDue today={today} nextDueDate={nextDueDate} />
      ) : !current ? (
        <SessionSummary reviewed={Object.keys(firstTry).length} remembered={Object.values(firstTry).filter(Boolean).length} />
      ) : !flipped ? (
        // Mặt trước: chỉ có chữ Hán
        <button
          ref={frontRef}
          type="button"
          onClick={() => setFlipped(true)}
          aria-label={`Thẻ ${current.word.hanzi}. Nhớ nghĩa rồi bấm để lật thẻ.`}
          className="flex min-h-[22rem] flex-col items-center justify-center gap-6 rounded-[20px] bg-card p-6 shadow-[0_8px_24px_rgb(0_0_0/0.08)] outline-none transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80"
        >
          <span lang="zh-CN" className="font-hanzi text-[5.5rem] leading-none font-semibold sm:text-[7rem]">
            {current.word.hanzi}
          </span>
          <span className="rounded-full bg-secondary px-4 py-2 text-subheadline font-semibold text-primary">
            Nhớ nghĩa rồi bấm để lật thẻ
          </span>
        </button>
      ) : (
        // Mặt sau
        <>
          <div
            ref={backRef}
            tabIndex={-1}
            aria-label={`Mặt sau thẻ ${current.word.hanzi}`}
            className="flex flex-col gap-4 rounded-[20px] bg-card p-4 shadow-[0_8px_24px_rgb(0_0_0/0.08)] outline-none sm:p-6"
          >
            <WordDetails word={current.word} />
            <FalseFriendNote word={current.word} />
          </div>

          <div className="flex flex-col gap-2">
            <p
              id="rating-heading"
              className="px-1 text-footnote font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Bạn nhớ từ này ở mức nào? · Lần ôn sau
            </p>
            <div role="group" aria-labelledby="rating-heading" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((rating, i) => {
                // Ngày ôn tiếp theo tính sẵn bằng chính hàm SM-2 (máy chủ tính lại khi lưu)
                const days = scheduleReview(current.state, rating, today).interval_days;
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => rate(rating)}
                    disabled={isSaving}
                    aria-keyshortcuts={String(i + 1)}
                    aria-label={`${RATING_LABEL[rating]}, ôn lại sau ${days} ngày`}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-70 disabled:opacity-50",
                      RATING_STYLE[rating],
                    )}
                  >
                    <span className="text-headline">{RATING_LABEL[rating]}</span>
                    <span className="text-footnote text-foreground/80">{days} ngày</span>
                  </button>
                );
              })}
            </div>
            {error && (
              <p role="alert" className="text-center text-footnote text-destructive">
                {error}
              </p>
            )}
          </div>
        </>
      )}

      {total > 0 && current && (
        <p className="hidden text-center text-footnote text-muted-foreground sm:block">
          Phím tắt: Space để lật thẻ, phím 1–4 để chọn Quên / Khó / Nhớ / Dễ.
        </p>
      )}
    </div>
  );
}

function SessionSummary({ reviewed, remembered }: { reviewed: number; remembered: number }) {
  const rate = reviewed > 0 ? Math.round((remembered / reviewed) * 100) : 0;
  return (
    <div role="status" className="flex flex-col items-center gap-4 rounded-[20px] bg-card p-6 text-center">
      <CircleCheck className="size-12 text-green" aria-hidden />
      <h2 className="text-title2">Bạn đã ôn xong lượt hôm nay</h2>
      <dl className="grid w-full max-w-sm grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-footnote text-muted-foreground">Số thẻ đã ôn</dt>
          <dd className="text-title1 tabular-nums">{reviewed}</dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-footnote text-muted-foreground">Tỷ lệ nhớ</dt>
          <dd className="text-title1 tabular-nums">{rate}%</dd>
        </div>
      </dl>
      <p className="max-w-md text-footnote text-muted-foreground">
        Tỷ lệ nhớ tính theo lần đầu gặp mỗi thẻ trong lượt này: chọn Khó, Nhớ hoặc Dễ là nhớ. Thẻ chọn Quên sẽ quay lại vào ngày mai.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/home" className={buttonVariants({ variant: "filled" })}>
          Về trang chủ
        </Link>
        <Link href="/vocab" className={buttonVariants({ variant: "gray" })}>
          Mở Sổ từ
        </Link>
      </div>
    </div>
  );
}

function NothingDue({ today, nextDueDate }: { today: string; nextDueDate: string | null }) {
  const when =
    nextDueDate === null
      ? null
      : nextDueDate === addDaysISO(today, 1)
        ? `ngày mai (${formatDateVN(nextDueDate)})`
        : formatDateVN(nextDueDate);
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-[20px] bg-card p-6 text-center">
      <CalendarCheck className="size-12 text-primary" aria-hidden />
      {when ? (
        <>
          <h2 className="text-title2">Bạn đã ôn hết từ của hôm nay</h2>
          <p className="text-body text-muted-foreground">Ngày ôn gần nhất: {when}.</p>
        </>
      ) : (
        <>
          <h2 className="text-title2">Bộ ôn tập của bạn chưa có từ nào</h2>
          <p className="text-body text-muted-foreground">
            Bạn mở Sổ từ, chọn một từ rồi bấm &quot;Thêm vào bộ ôn tập&quot;.
          </p>
        </>
      )}
      <Link href="/vocab" className={cn(buttonVariants({ variant: "filled" }), "mt-2")}>
        Sang Sổ từ
      </Link>
    </div>
  );
}
