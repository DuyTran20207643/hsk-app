"use server";

// Thao tác của trang Sổ từ, chạy ở máy chủ bằng phiên đăng nhập của học viên.
// RLS (policy srs_cards_own: user_id = auth.uid()) là chốt chặn cuối: học viên chỉ đọc / ghi
// được thẻ ôn tập của chính mình. KHÔNG dùng service_role key.

import { getCurrentUser } from "@/lib/auth/session";
import { todayISO } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { sanitizeVocabFilters } from "./filters";
import { loadVocabBatch, type VocabBatch } from "./queries";

const NOT_SIGNED_IN = "Phiên đăng nhập đã hết hạn. Bạn vui lòng đăng nhập lại.";
const GENERIC_ERROR = "Đã có lỗi xảy ra. Bạn vui lòng thử lại.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OFFSET = 10_000;

async function getLearner() {
  const user = await getCurrentUser();
  return user && user.status === "active" ? user : null;
}

// Nút "Xem thêm": lấy 60 từ tiếp theo theo cùng bộ lọc
export async function loadMoreVocab(filters: unknown, offset: number): Promise<VocabBatch> {
  const user = await getLearner();
  if (!user || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    return { words: [], matchCount: 0, reviewDates: {}, error: true };
  }
  return loadVocabBatch(user.id, sanitizeVocabFilters(filters), offset);
}

export type AddToReviewResult =
  | { ok: true; dueDate: string; alreadyAdded: boolean }
  | { ok: false; error: string };

// "Thêm vào bộ ôn tập": tạo thẻ ôn cho học viên, ngày ôn đầu tiên là hôm nay (giờ Việt Nam)
export async function addToReview(wordId: string): Promise<AddToReviewResult> {
  const user = await getLearner();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  if (typeof wordId !== "string" || !UUID.test(wordId)) return { ok: false, error: GENERIC_ERROR };

  const supabase = await createClient();

  // Chỉ thêm từ đang hoạt động
  const { data: word, error: wordError } = await supabase
    .from("words")
    .select("id")
    .eq("id", wordId)
    .eq("status", "active")
    .maybeSingle();
  if (wordError) {
    console.error("[vocab] Không kiểm tra được từ:", wordError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!word) return { ok: false, error: "Từ này không còn trong sổ từ." };

  // "Hôm nay" tính theo giờ Việt Nam, không theo giờ máy chủ (Vercel chạy giờ UTC)
  const today = todayISO();
  const { error } = await supabase.from("srs_cards").insert({ user_id: user.id, word_id: wordId, due_date: today });

  if (error?.code === "23505") {
    // Đã có từ trước (ví dụ bấm ở tab khác): trả về ngày ôn hiện có
    const { data: card } = await supabase
      .from("srs_cards")
      .select("due_date")
      .eq("user_id", user.id)
      .eq("word_id", wordId)
      .maybeSingle();
    return { ok: true, dueDate: card?.due_date ?? today, alreadyAdded: true };
  }
  if (error) {
    console.error("[vocab] Không thêm được vào bộ ôn tập:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, dueDate: today, alreadyAdded: false };
}
