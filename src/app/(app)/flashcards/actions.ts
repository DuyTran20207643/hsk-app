"use server";

// Lưu kết quả ôn một thẻ. Chạy ở máy chủ bằng phiên đăng nhập của học viên; RLS (srs_cards_own:
// user_id = auth.uid()) chặn ghi vào thẻ của người khác. KHÔNG dùng service_role key.
// Trình duyệt chỉ gửi lên mã từ và mức đánh giá; trạng thái mới luôn tính lại ở đây bằng SM-2
// từ dữ liệu trong database, không tin số liệu trình duyệt gửi lên.

import { getCurrentUser } from "@/lib/auth/session";
import { todayISO } from "@/lib/plan";
import { isRating, scheduleReview, type SrsState } from "@/lib/srs";
import { createClient } from "@/lib/supabase/server";

const NOT_SIGNED_IN = "Phiên đăng nhập đã hết hạn. Bạn vui lòng đăng nhập lại.";
const GENERIC_ERROR = "Chưa lưu được kết quả. Bạn vui lòng thử lại.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewResult =
  | { ok: true; state: SrsState; dueDate: string }
  | { ok: false; error: string };

type CardRow = {
  ease_factor: number | string;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string | null;
};

const toState = (row: CardRow): SrsState => ({
  ease_factor: Number(row.ease_factor),
  interval_days: row.interval_days,
  repetitions: row.repetitions,
});

export async function submitReview(wordId: string, rating: string): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return { ok: false, error: NOT_SIGNED_IN };
  if (typeof wordId !== "string" || !UUID.test(wordId) || !isRating(rating)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data: card, error: readError } = await supabase
    .from("srs_cards")
    .select("ease_factor, interval_days, repetitions, due_date, last_reviewed_at")
    .eq("user_id", user.id)
    .eq("word_id", wordId)
    .maybeSingle<CardRow>();
  if (readError) {
    console.error("[flashcards] Không đọc được thẻ:", readError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!card) return { ok: false, error: "Từ này không còn trong bộ ôn tập của bạn." };

  // "Hôm nay" theo giờ Việt Nam, không theo giờ máy chủ
  const today = todayISO();
  // Chỉ chấm thẻ đến hạn, hoặc thẻ vừa chọn Quên hôm nay (được xếp lại cuối lượt ôn).
  // Thẻ khác đã chấm rồi (ví dụ bấm hai lần, hoặc ôn ở tab khác) thì giữ nguyên, không cộng dồn.
  const failedToday =
    card.repetitions === 0 && card.last_reviewed_at !== null && todayISO(new Date(card.last_reviewed_at)) === today;
  if (card.due_date > today && !failedToday) {
    return { ok: true, state: toState(card), dueDate: card.due_date };
  }

  const next = scheduleReview(toState(card), rating, today);
  const { data: updated, error: writeError } = await supabase
    .from("srs_cards")
    .update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_date: next.due_date,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("word_id", wordId)
    // Chỉ ghi nếu thẻ chưa bị thay đổi kể từ lúc đọc (hai tab cùng chấm một thẻ)
    .eq("due_date", card.due_date)
    .eq("repetitions", card.repetitions)
    .select("word_id");
  if (writeError) {
    console.error("[flashcards] Không lưu được kết quả ôn:", writeError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated || updated.length === 0) {
    // Tab khác vừa chấm thẻ này: trả về trạng thái hiện có trong database
    const { data: fresh } = await supabase
      .from("srs_cards")
      .select("ease_factor, interval_days, repetitions, due_date, last_reviewed_at")
      .eq("user_id", user.id)
      .eq("word_id", wordId)
      .maybeSingle<CardRow>();
    return fresh ? { ok: true, state: toState(fresh), dueDate: fresh.due_date } : { ok: false, error: GENERIC_ERROR };
  }

  return {
    ok: true,
    state: { ease_factor: next.ease_factor, interval_days: next.interval_days, repetitions: next.repetitions },
    dueDate: next.due_date,
  };
}
