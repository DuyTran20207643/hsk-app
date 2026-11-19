// Đọc danh sách từ cho trang Sổ từ, dùng chung cho lần tải đầu (page.tsx) và nút "Xem thêm" (actions.ts).
// Chạy ở máy chủ bằng phiên đăng nhập của học viên; RLS chỉ cho đọc từ đang hoạt động.

import { plainPinyin } from "@/lib/pinyin";
import { createClient } from "@/lib/supabase/server";
import { toWordRow, WORD_COLUMNS, type WordRow } from "@/lib/words/word-input";
import { VOCAB_BATCH_SIZE, type VocabFilters } from "./filters";

export type VocabBatch = {
  words: WordRow[];
  /** Số từ khớp bộ lọc (tất cả các lần tải cộng lại) */
  matchCount: number;
  /** Từ nào đã có trong bộ ôn tập của học viên → ngày ôn tiếp theo ("YYYY-MM-DD") */
  reviewDates: Record<string, string>;
  error: boolean;
};

// Bỏ các ký tự có nghĩa đặc biệt trong cú pháp lọc của Supabase (dấu phẩy, ngoặc, %, _…)
function sanitizeSearch(value: string) {
  return value.replace(/[,()%_*\\"'.:]/g, " ").replace(/\s+/g, " ").trim();
}

export async function loadVocabBatch(userId: string, filters: VocabFilters, offset: number): Promise<VocabBatch> {
  const supabase = await createClient();

  let list = supabase
    .from("words")
    .select(WORD_COLUMNS, { count: "exact" })
    .eq("status", "active") // quản trị viên đọc được cả từ ngừng dùng, nên lọc rõ ở đây
    .order("level_id")
    .order("created_at")
    .order("id");
  if (filters.level) list = list.eq("level_id", filters.level);
  if (filters.topic) list = list.eq("topic_id", filters.topic);
  if (filters.falseFriendOnly) list = list.eq("is_false_friend", true);

  const q = sanitizeSearch(filters.q);
  if (q) {
    // Chữ Hán, âm Hán Việt, nghĩa; pinyin gõ không dấu vẫn tìm được nhờ cột pinyin_plain (migration 0005)
    const conditions = [`hanzi.ilike.%${q}%`, `han_viet.ilike.%${q}%`, `meaning_vi.ilike.%${q}%`];
    const pinyin = plainPinyin(q);
    if (pinyin) conditions.push(`pinyin_plain.ilike.%${pinyin}%`);
    list = list.or(conditions.join(","));
  }

  const { data, count, error } = await list.range(offset, offset + VOCAB_BATCH_SIZE - 1);
  if (error) {
    console.error("[vocab] Không tải được danh sách từ:", error);
    return { words: [], matchCount: 0, reviewDates: {}, error: true };
  }
  const words = (data ?? []).map(toWordRow);

  // Từ nào trong đợt này đã có trong bộ ôn tập. Lọc user_id rõ ràng vì quản trị viên
  // được RLS cho đọc thẻ của mọi người (policy srs_cards_select_admin).
  const reviewDates: Record<string, string> = {};
  if (words.length > 0) {
    const { data: cards, error: cardsError } = await supabase
      .from("srs_cards")
      .select("word_id, due_date")
      .eq("user_id", userId)
      .in(
        "word_id",
        words.map((w) => w.id),
      );
    if (cardsError) console.error("[vocab] Không tải được bộ ôn tập:", cardsError);
    for (const card of cards ?? []) reviewDates[card.word_id] = card.due_date;
  }

  return { words, matchCount: count ?? 0, reviewDates, error: false };
}
