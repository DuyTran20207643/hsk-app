// Đọc một phiên làm bài (đề bài + câu đã trả lời) qua hàm SQL get_attempt (migration 0009).
// Hàm tự kiểm tra phiên thuộc người đang đăng nhập; đáp án chỉ kèm câu đã nộp.
import { toSessionView, type SessionView } from "@/lib/practice/session";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null nếu không có phiên này, hoặc phiên không phải của người đang đăng nhập */
export async function loadSession(attemptId: string): Promise<SessionView | null> {
  if (!UUID.test(attemptId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt", { p_attempt_id: attemptId });
  if (error) {
    if (error.code !== "P0002") console.error("[practice] Không mở được phiên:", error);
    return null;
  }
  return toSessionView(data);
}
