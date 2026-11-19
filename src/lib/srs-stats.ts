// Thống kê bộ ôn tập của học viên, chạy ở máy chủ. Trang chủ và trang Tiến độ dùng chung.
import type { createClient } from "@/lib/supabase/server";
import { MASTERED_INTERVAL_DAYS } from "@/lib/srs";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * BR06: số từ "đã nắm" của học viên = số thẻ có khoảng cách ôn (interval_days) từ 21 ngày trở lên.
 * Lọc user_id rõ ràng vì quản trị viên được RLS cho đọc thẻ của mọi người.
 * Trả về null nếu không đọc được (để trang hiện "—" thay vì số 0 sai).
 */
export async function countMasteredWords(supabase: ServerClient, userId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("srs_cards")
    .select("word_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("interval_days", MASTERED_INTERVAL_DAYS);
  if (error) {
    console.error("[srs] Không đếm được số từ đã nắm:", error);
    return null;
  }
  return count ?? 0;
}
