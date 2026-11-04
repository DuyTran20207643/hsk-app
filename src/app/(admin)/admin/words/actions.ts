"use server";

// Mọi thao tác GHI của trang Quản trị từ vựng chạy ở máy chủ, bằng phiên đăng nhập của
// quản trị viên. RLS trong database (policy words_admin_all, migration 0004 cho Storage)
// mới là chốt chặn cuối: tài khoản không phải admin có gọi thẳng cũng bị từ chối.
// KHÔNG dùng service_role key.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions, getTopicOptions } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import {
  duplicateKey,
  IMAGE_TYPES,
  imageError,
  toWordRow,
  validateWord,
  WORD_COLUMNS,
  type FieldErrors,
  type Lookups,
  type RawWordInput,
  type WordRow,
  type WordValues,
} from "@/lib/words/word-input";
import {
  IMPORT_MAX_ROWS,
  parseFalseFriend,
  parseLevel,
  sanitizeImportRows,
  type ImportPreview,
  type ImportRow,
} from "@/lib/words/import";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "word-images";
const PAGE_PATH = "/admin/words";
const NOT_ADMIN = "Bạn không có quyền quản trị.";
const GENERIC_ERROR = "Đã có lỗi xảy ra. Bạn vui lòng thử lại.";

async function getAdminClient(): Promise<Supabase | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  return createClient();
}

// Cấp và chủ đề lấy từ bộ nhớ sẵn ở máy chủ (src/lib/lookups.ts), không tốn lượt hỏi database
async function loadLookups() {
  const [levels, topics] = await Promise.all([getLevelOptions(), getTopicOptions()]);
  const lookups: Lookups = {
    levelIds: new Set(levels.map((l) => l.id)),
    topicIds: new Set(topics.map((t) => t.id)),
  };
  const topicByName = new Map<string, number>(topics.map((t) => [t.name.trim().toLowerCase(), t.id]));
  return { lookups, topicByName };
}

// Tìm các từ đã có trùng chữ Hán (chia nhỏ để đường dẫn yêu cầu không quá dài)
async function findByHanzi(supabase: Supabase, hanziList: string[]): Promise<WordRow[]> {
  const unique = [...new Set(hanziList)];
  const found: WordRow[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await supabase
      .from("words")
      .select(WORD_COLUMNS)
      .in("hanzi", unique.slice(i, i + 100));
    if (error) throw error;
    found.push(...(data ?? []).map(toWordRow));
  }
  return found;
}

// Lấy đường dẫn file trong bucket từ đường dẫn công khai của ảnh
function storagePath(imageUrl: string | null): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const at = imageUrl?.indexOf(marker) ?? -1;
  return imageUrl && at >= 0 ? decodeURIComponent(imageUrl.slice(at + marker.length)) : null;
}

async function removeImage(supabase: Supabase, imageUrl: string | null) {
  const path = storagePath(imageUrl);
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

// ---------------------------------------------------------------------
// Thêm / sửa từ (sheet)
// ---------------------------------------------------------------------

export type SaveWordResult =
  | { ok: true; message: string; word: WordRow }
  | { ok: false; error?: string; fieldErrors?: FieldErrors; imageError?: string; duplicate?: WordRow };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function saveWord(formData: FormData): Promise<SaveWordResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, error: NOT_ADMIN };

  const id = text(formData, "id") || null;
  const topicRaw = text(formData, "topicId");
  const raw: RawWordInput = {
    hanzi: text(formData, "hanzi"),
    pinyin: text(formData, "pinyin"),
    hanViet: text(formData, "hanViet"),
    meaningVi: text(formData, "meaningVi"),
    levelId: Number(text(formData, "levelId")) || null,
    topicId: topicRaw ? Number(topicRaw) : null,
    exampleZh: text(formData, "exampleZh"),
    exampleVi: text(formData, "exampleVi"),
    isFalseFriend: text(formData, "isFalseFriend") === "1",
    falseFriendNote: text(formData, "falseFriendNote"),
    status: text(formData, "status") === "inactive" ? "inactive" : "active",
  };

  const image = formData.get("image");
  const newImage = image instanceof File && image.size > 0 ? image : null;
  const dropImage = text(formData, "removeImage") === "1";
  if (newImage) {
    const problem = imageError(newImage);
    if (problem) return { ok: false, imageError: problem };
  }

  const { lookups } = await loadLookups();
  const result = validateWord(raw, lookups);
  if (result.errors) return { ok: false, fieldErrors: result.errors };
  const values = result.values;

  try {
    // BR13: cặp (chữ Hán, pinyin) đã tồn tại thì báo trùng, gợi ý mở từ cũ
    const key = duplicateKey(values.hanzi, values.pinyin);
    const duplicate = (await findByHanzi(supabase, [values.hanzi])).find(
      (word) => word.id !== id && duplicateKey(word.hanzi, word.pinyin) === key,
    );
    if (duplicate) {
      return {
        ok: false,
        error: `Từ ${duplicate.hanzi} (${duplicate.pinyin}) đã có trong danh sách.`,
        duplicate,
      };
    }

    let saved: WordRow;
    let previousImage: string | null = null;
    if (id) {
      const { data: before } = await supabase.from("words").select("image_url").eq("id", id).maybeSingle();
      if (!before) return { ok: false, error: "Không tìm thấy từ này. Có thể từ đã bị xóa." };
      previousImage = before.image_url;
      const { data, error } = await supabase
        .from("words")
        .update(values)
        .eq("id", id)
        .select(WORD_COLUMNS)
        .single();
      if (error) throw error;
      saved = toWordRow(data);
    } else {
      const { data, error } = await supabase.from("words").insert(values).select(WORD_COLUMNS).single();
      if (error) throw error;
      saved = toWordRow(data);
    }

    // Ảnh minh họa: tải ảnh mới lên (hoặc bỏ ảnh), rồi xóa file ảnh cũ
    let warning = "";
    if (newImage || dropImage) {
      let imageUrl: string | null = null;
      if (newImage) {
        const path = `${saved.id}/${crypto.randomUUID()}.${IMAGE_TYPES[newImage.type]}`;
        const upload = await supabase.storage
          .from(BUCKET)
          .upload(path, newImage, { contentType: newImage.type });
        if (upload.error) {
          console.error("[admin/words] Không tải được ảnh:", upload.error);
          warning = " Nhưng chưa tải được ảnh, bạn thử lại sau nhé.";
        } else {
          imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
      }
      if (!warning) {
        const { data, error } = await supabase
          .from("words")
          .update({ image_url: imageUrl })
          .eq("id", saved.id)
          .select(WORD_COLUMNS)
          .single();
        if (error) throw error;
        saved = toWordRow(data);
        await removeImage(supabase, previousImage);
      }
    }

    revalidatePath(PAGE_PATH);
    return {
      ok: true,
      word: saved,
      message: (id ? `Đã lưu thay đổi cho từ ${saved.hanzi}.` : `Đã thêm từ ${saved.hanzi}.`) + warning,
    };
  } catch (error) {
    // Hai người cùng thêm một từ trong cùng lúc: database chặn bằng ràng buộc unique
    if (isPostgresError(error, "23505")) {
      return { ok: false, error: `Từ ${values.hanzi} (${values.pinyin}) đã có trong danh sách.` };
    }
    console.error("[admin/words] Không lưu được từ:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

function isPostgresError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === code;
}

// ---------------------------------------------------------------------
// Xóa từ (BR14)
// ---------------------------------------------------------------------

export type DeleteWordResult = { ok: boolean; message: string; deactivated?: boolean };

export async function deleteWord(id: string): Promise<DeleteWordResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: NOT_ADMIN };

  const { data: word } = await supabase.from("words").select("id, image_url").eq("id", id).maybeSingle();
  if (!word) return { ok: false, message: "Không tìm thấy từ này. Có thể từ đã bị xóa." };

  // Từ đang dùng trong bài học (lesson_items) hoặc lịch ôn (srs_cards) thì không xóa hẳn
  const [lessonUse, srsUse] = await Promise.all([
    supabase.from("lesson_items").select("id", { count: "exact", head: true }).eq("word_id", id),
    supabase.from("srs_cards").select("id", { count: "exact", head: true }).eq("word_id", id),
  ]);
  if (lessonUse.error || srsUse.error) {
    console.error("[admin/words] Không kiểm tra được từ đang dùng:", lessonUse.error ?? srsUse.error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const inUse = (lessonUse.count ?? 0) > 0 || (srsUse.count ?? 0) > 0;

  if (!inUse) {
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (!error) {
      await removeImage(supabase, word.image_url);
      revalidatePath(PAGE_PATH);
      return { ok: true, message: "Đã xóa từ." };
    }
    // 23503: vừa có bài học / lịch ôn dùng từ này (khóa ngoại chặn xóa) → chuyển sang Ngừng dùng
    if (!isPostgresError(error, "23503")) {
      console.error("[admin/words] Không xóa được từ:", error);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  const { error } = await supabase.from("words").update({ status: "inactive" }).eq("id", id);
  if (error) {
    console.error("[admin/words] Không chuyển được sang Ngừng dùng:", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath(PAGE_PATH);
  return {
    ok: true,
    deactivated: true,
    message: "Từ đã được sử dụng nên chuyển sang Ngừng dùng.",
  };
}

// ---------------------------------------------------------------------
// Import Excel: trình duyệt đọc file, máy chủ kiểm tra và lưu
// ---------------------------------------------------------------------

async function checkImportRows(supabase: Supabase, rows: ImportRow[]) {
  const { lookups, topicByName } = await loadLookups();
  const preview: ImportPreview = { total: rows.length, valid: [], errors: [], duplicates: [] };
  const toInsert: WordValues[] = [];
  const candidates: { row: number; values: WordValues }[] = [];

  for (const row of rows) {
    const messages: string[] = [];
    const levelId = parseLevel(row.level);
    if (levelId === null || !lookups.levelIds.has(levelId)) messages.push("Cột level phải là 1, 2 hoặc 3 (hoặc HSK 1, HSK 2, HSK 3).");

    let topicId: number | null = null;
    if (row.topic.trim()) {
      topicId = topicByName.get(row.topic.trim().replace(/\s+/g, " ").toLowerCase()) ?? null;
      if (topicId === null) messages.push(`Chủ đề "${row.topic.trim()}" không có trong danh sách chủ đề.`);
    }

    const isFalseFriend = parseFalseFriend(row.is_false_friend);
    if (isFalseFriend === null) messages.push('Cột is_false_friend chỉ nhận "Có" hoặc "Không".');

    const result = validateWord(
      {
        hanzi: row.hanzi,
        pinyin: row.pinyin,
        hanViet: row.han_viet,
        meaningVi: row.meaning_vi,
        levelId: levelId ?? 0,
        topicId,
        exampleZh: row.example_zh,
        exampleVi: row.example_vi,
        isFalseFriend: isFalseFriend ?? false,
        falseFriendNote: row.false_friend_note,
        status: "active",
      },
      lookups,
    );
    if (result.errors) {
      // Lỗi cấp / chủ đề đã báo ở trên bằng câu dành riêng cho file Excel
      const fieldErrors = { ...result.errors };
      delete fieldErrors.levelId;
      delete fieldErrors.topicId;
      messages.push(...Object.values(fieldErrors));
    }

    if (messages.length > 0 || !result.values) preview.errors.push({ row: row.row, messages });
    else candidates.push({ row: row.row, values: result.values });
  }

  // BR13: trùng với dữ liệu đã có, hoặc trùng với một dòng phía trên trong cùng file
  const existing = new Set(
    (await findByHanzi(supabase, candidates.map((c) => c.values.hanzi))).map((w) =>
      duplicateKey(w.hanzi, w.pinyin),
    ),
  );
  const seenInFile = new Map<string, number>();
  for (const { row, values } of candidates) {
    const key = duplicateKey(values.hanzi, values.pinyin);
    const label = { row, hanzi: values.hanzi, pinyin: values.pinyin };
    if (existing.has(key)) {
      preview.duplicates.push({ ...label, reason: "Đã có trong danh sách từ vựng" });
    } else if (seenInFile.has(key)) {
      preview.duplicates.push({ ...label, reason: `Trùng với dòng ${seenInFile.get(key)} trong file` });
    } else {
      seenInFile.set(key, row);
      preview.valid.push(label);
      toInsert.push(values);
    }
  }
  return { preview, toInsert };
}

function checkRowLimit(rows: ImportRow[] | null): string | null {
  if (!rows || rows.length === 0) return "File không có dòng dữ liệu nào.";
  if (rows.length > IMPORT_MAX_ROWS) return `File có ${rows.length} dòng, vượt quá giới hạn ${IMPORT_MAX_ROWS} dòng.`;
  return null;
}

export type PreviewImportResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };

export async function previewImport(input: ImportRow[]): Promise<PreviewImportResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, error: NOT_ADMIN };
  const rows = sanitizeImportRows(input);
  const limitError = checkRowLimit(rows);
  if (limitError || !rows) return { ok: false, error: limitError ?? GENERIC_ERROR };

  try {
    const { preview } = await checkImportRows(supabase, rows);
    return { ok: true, preview };
  } catch (error) {
    console.error("[admin/words] Không kiểm tra được file import:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type CommitImportResult = { ok: boolean; message: string };

export async function commitImport(input: ImportRow[]): Promise<CommitImportResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: NOT_ADMIN };
  const rows = sanitizeImportRows(input);
  const limitError = checkRowLimit(rows);
  if (limitError || !rows) return { ok: false, message: limitError ?? GENERIC_ERROR };

  try {
    // Kiểm tra lại toàn bộ ở máy chủ, không tin kết quả xem trước gửi từ trình duyệt
    const { toInsert } = await checkImportRows(supabase, rows);
    if (toInsert.length === 0) return { ok: false, message: "Không có dòng hợp lệ nào để nhập." };

    // ignoreDuplicates: nếu ai đó vừa thêm cùng từ trong lúc này thì bỏ qua dòng đó, không lỗi cả lô
    const { data, error } = await supabase
      .from("words")
      .upsert(toInsert, { onConflict: "hanzi,pinyin", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;

    const inserted = data?.length ?? 0;
    const skipped = rows.length - inserted;
    revalidatePath(PAGE_PATH);
    return {
      ok: true,
      message:
        `Đã nhập ${inserted} từ mới.` +
        (skipped > 0 ? ` Bỏ qua ${skipped} dòng bị lỗi hoặc trùng.` : ""),
    };
  } catch (error) {
    console.error("[admin/words] Không nhập được file:", error);
    return { ok: false, message: GENERIC_ERROR };
  }
}
