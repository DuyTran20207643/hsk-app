"use server";

// Mọi thao tác GHI của trang Quản trị ngữ pháp (UC19) chạy ở máy chủ, bằng phiên đăng nhập của
// quản trị viên. RLS (policy grammar_points_admin_all) là chốt chặn cuối: tài khoản không phải
// admin có gọi thẳng cũng bị từ chối. KHÔNG dùng service_role key.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import {
  GRAMMAR_COLUMNS,
  toGrammarPoint,
  validateGrammarPoint,
  type GrammarFieldErrors,
  type GrammarPoint,
  type RawGrammarInput,
} from "@/lib/grammar/grammar-input";
import { getLevelOptions } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const NOT_ADMIN = "Bạn không có quyền quản trị.";
const GENERIC_ERROR = "Đã có lỗi xảy ra. Bạn vui lòng thử lại.";
const NOT_FOUND = "Không tìm thấy ngữ pháp này. Có thể đã bị xóa.";

async function getAdminClient(): Promise<Supabase | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  return createClient();
}

function revalidateGrammarPages() {
  revalidatePath("/admin/grammar");
  revalidatePath("/grammar");
}

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

// Số câu hỏi đang gắn vào một điểm ngữ pháp (kể cả câu ngừng dùng: khóa ngoại vẫn chặn xóa).
// Không export: mọi hàm export trong file "use server" đều thành Server Action gọi được từ trình duyệt.
async function countLinkedQuestions(supabase: Supabase, grammarPointId: number) {
  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("grammar_point_id", grammarPointId);
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------
// Thêm / Sửa
// ---------------------------------------------------------------------

export type SaveGrammarResult =
  | { ok: true; point: GrammarPoint; message: string }
  | { ok: false; error?: string; fieldErrors?: GrammarFieldErrors };

export async function saveGrammarPoint(id: number | null, raw: RawGrammarInput): Promise<SaveGrammarResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, error: NOT_ADMIN };
  if (id !== null && !isId(id)) return { ok: false, error: GENERIC_ERROR };

  const levels = await getLevelOptions();
  const result = validateGrammarPoint(raw, new Set(levels.map((l) => l.id)));
  if (result.errors) return { ok: false, fieldErrors: result.errors };
  const values = result.values;

  try {
    // Điểm mới, hoặc điểm chuyển sang cấp khác: xếp xuống cuối danh sách của cấp đó
    let sortOrder: number | undefined;
    let before: { level_id: number } | null = null;
    if (id !== null) {
      const { data } = await supabase.from("grammar_points").select("level_id").eq("id", id).maybeSingle();
      if (!data) return { ok: false, error: NOT_FOUND };
      before = data;
    }
    if (!before || before.level_id !== values.level_id) {
      const { data: last } = await supabase
        .from("grammar_points")
        .select("sort_order")
        .eq("level_id", values.level_id)
        .not("sort_order", "is", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      sortOrder = (last?.sort_order ?? 0) + 1;
    }

    const row = sortOrder === undefined ? values : { ...values, sort_order: sortOrder };
    const query =
      id === null
        ? supabase.from("grammar_points").insert(row)
        : supabase.from("grammar_points").update(row).eq("id", id);
    const { data, error } = await query.select(GRAMMAR_COLUMNS).single();
    if (error) throw error;

    const point = toGrammarPoint(data);
    revalidateGrammarPages();
    return {
      ok: true,
      point,
      message: id === null ? `Đã thêm "${point.title}".` : `Đã lưu thay đổi cho "${point.title}".`,
    };
  } catch (error) {
    console.error("[admin/grammar] Không lưu được điểm ngữ pháp:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------
// Xóa: chỉ khi chưa có câu hỏi nào gắn vào; có rồi thì chỉ được ẩn
// ---------------------------------------------------------------------

export type DeleteGrammarResult = { ok: boolean; message: string };

export async function deleteGrammarPoint(id: number): Promise<DeleteGrammarResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: NOT_ADMIN };
  if (!isId(id)) return { ok: false, message: GENERIC_ERROR };

  try {
    const { data: point } = await supabase.from("grammar_points").select("id, title").eq("id", id).maybeSingle();
    if (!point) return { ok: false, message: NOT_FOUND };

    const linked = await countLinkedQuestions(supabase, id);
    const inUseMessage = (n: number) =>
      `Đã có ${n} câu hỏi gắn vào "${point.title}" nên không xóa được. Bạn có thể tắt Công khai để ẩn ngữ pháp này.`;
    if (linked > 0) return { ok: false, message: inUseMessage(linked) };

    const { error } = await supabase.from("grammar_points").delete().eq("id", id);
    if (error) {
      // 23503: vừa có câu hỏi gắn vào trong lúc đang xóa (khóa ngoại chặn)
      if (error.code === "23503") return { ok: false, message: inUseMessage(await countLinkedQuestions(supabase, id)) };
      throw error;
    }
    revalidateGrammarPages();
    return { ok: true, message: `Đã xóa "${point.title}".` };
  } catch (error) {
    console.error("[admin/grammar] Không xóa được điểm ngữ pháp:", error);
    return { ok: false, message: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------
// Sắp thứ tự: đổi chỗ với điểm ngay trên / dưới trong cùng cấp
// ---------------------------------------------------------------------

export async function moveGrammarPoint(id: number, direction: "up" | "down"): Promise<{ ok: boolean; message?: string }> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: NOT_ADMIN };
  if (!isId(id) || (direction !== "up" && direction !== "down")) return { ok: false, message: GENERIC_ERROR };

  try {
    const { data: point } = await supabase.from("grammar_points").select("level_id").eq("id", id).maybeSingle();
    if (!point) return { ok: false, message: NOT_FOUND };

    const { data: list, error } = await supabase
      .from("grammar_points")
      .select("id, sort_order")
      .eq("level_id", point.level_id)
      .order("sort_order", { nullsFirst: false })
      .order("id");
    if (error) throw error;

    const ids = (list ?? []).map((row) => row.id as number);
    const from = ids.indexOf(id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return { ok: true };
    [ids[from], ids[to]] = [ids[to], ids[from]];

    // Đánh số lại 1, 2, 3… cho cả cấp (sửa luôn các dòng thiếu / trùng số thứ tự), chỉ ghi dòng thay đổi
    const current = new Map((list ?? []).map((row) => [row.id as number, row.sort_order as number | null]));
    const updates = ids
      .map((pointId, index) => ({ pointId, sortOrder: index + 1 }))
      .filter(({ pointId, sortOrder }) => current.get(pointId) !== sortOrder);
    const results = await Promise.all(
      updates.map(({ pointId, sortOrder }) =>
        supabase.from("grammar_points").update({ sort_order: sortOrder }).eq("id", pointId),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;

    revalidateGrammarPages();
    return { ok: true };
  } catch (error) {
    console.error("[admin/grammar] Không sắp xếp được:", error);
    return { ok: false, message: GENERIC_ERROR };
  }
}
