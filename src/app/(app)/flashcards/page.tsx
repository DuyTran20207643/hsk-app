import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { todayISO } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { toWordRow, WORD_COLUMNS } from "@/lib/words/word-input";
import { FlashcardSession, type ReviewItem } from "./flashcard-session";

export const metadata: Metadata = { title: "Ôn thẻ từ · Hệ thống ôn thi HSK" };

// Mockup: docs/mockups/08a-the-tu-mat-truoc.png (mặt trước), 08b-the-tu-mat-sau.png (mặt sau)
// Use case UC05 — Ôn từ vựng bằng thẻ, quy tắc BR04–BR06 (thuật toán SM-2 trong src/lib/srs.ts).
export default function FlashcardsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Đọc phiên đăng nhập (cookie) nên phải nằm trong Suspense */}
      <Suspense fallback={<FlashcardsSkeleton />}>
        <FlashcardsLoader />
      </Suspense>
    </div>
  );
}

type DueRow = {
  word_id: string;
  ease_factor: number | string;
  interval_days: number;
  repetitions: number;
  due_date: string;
  words: Parameters<typeof toWordRow>[0] | null;
};

async function FlashcardsLoader() {
  // getCurrentUser đã gọi connection(): chỉ chạy khi có người truy cập thật
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/flashcards");

  const supabase = await createClient();
  const today = todayISO(); // giờ Việt Nam

  // Thẻ đến hạn: ngày ôn từ hôm nay trở về trước, quá hạn lâu nhất lên trước.
  // Lọc user_id rõ ràng vì quản trị viên được RLS cho đọc thẻ của mọi người.
  const { data, error } = await supabase
    .from("srs_cards")
    .select(`word_id, ease_factor, interval_days, repetitions, due_date, words!inner(${WORD_COLUMNS})`)
    .eq("user_id", user.id)
    .lte("due_date", today)
    .eq("words.status", "active")
    .order("due_date")
    .order("word_id")
    .returns<DueRow[]>();

  if (error) {
    console.error("[flashcards] Không tải được thẻ đến hạn:", error);
    return (
      <p className="rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
        Không tải được thẻ ôn tập. Bạn vui lòng tải lại trang.
      </p>
    );
  }

  const items: ReviewItem[] = (data ?? [])
    .filter((row): row is DueRow & { words: NonNullable<DueRow["words"]> } => row.words !== null)
    .map((row) => ({
      word: toWordRow(row.words),
      state: {
        ease_factor: Number(row.ease_factor),
        interval_days: row.interval_days,
        repetitions: row.repetitions,
      },
    }));

  // Không còn thẻ đến hạn: tìm ngày ôn gần nhất sắp tới, và xem bộ ôn tập có thẻ nào không
  let nextDueDate: string | null = null;
  if (items.length === 0) {
    const { data: upcoming } = await supabase
      .from("srs_cards")
      .select("due_date, words!inner(status)")
      .eq("user_id", user.id)
      .gt("due_date", today)
      .eq("words.status", "active")
      .order("due_date")
      .limit(1);
    nextDueDate = upcoming?.[0]?.due_date ?? null;
  }

  return <FlashcardSession items={items} today={today} nextDueDate={nextDueDate} />;
}

function FlashcardsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Đang tải thẻ ôn tập">
      <div className="h-11 animate-pulse rounded-xl bg-card/60" />
      <div className="h-1.5 animate-pulse rounded-full bg-card/60" />
      <div className="h-[22rem] animate-pulse rounded-[20px] bg-card/60" />
    </div>
  );
}
