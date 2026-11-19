"use server";

// Mọi thao tác GHI của trang Quản trị câu hỏi (UC13) chạy ở máy chủ, bằng phiên đăng nhập của
// quản trị viên. RLS (policy questions_admin_all, migration 0008 cho Storage) là chốt chặn cuối:
// tài khoản không phải admin có gọi thẳng cũng bị từ chối. KHÔNG dùng service_role key.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions, getTopicOptions } from "@/lib/lookups";
import { ADMIN_QUESTION_COLUMNS, questionImages, toAdminQuestion, type AdminQuestion } from "@/lib/questions/admin-row";
import {
  importRowToFields,
  parseImportAnswer,
  parseQuestionType,
  QUESTION_IMPORT_MAX_ROWS,
  sanitizeQuestionImportRows,
  type QuestionImportPreview,
  type QuestionImportRow,
} from "@/lib/questions/import";
import { questionSummary } from "@/lib/questions/summary";
import { PICTURE_COUNT } from "@/lib/questions/types";
import {
  sanitizeFields,
  validateQuestion,
  type QuestionErrors,
  type QuestionLookups,
  type QuestionValues,
} from "@/lib/questions/validate";
import { createClient } from "@/lib/supabase/server";
import { parseLevel } from "@/lib/words/import";
import { IMAGE_TYPES, imageError } from "@/lib/words/word-input";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "question-images";
const PAGE_PATH = "/admin/questions";
const NOT_ADMIN = "Bạn không có quyền quản trị.";
const GENERIC_ERROR = "Đã có lỗi xảy ra. Bạn vui lòng thử lại.";
const NOT_FOUND = "Không tìm thấy câu hỏi này. Có thể câu đã bị xóa.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAdminClient(): Promise<Supabase | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  return createClient();
}

// Cấp, chủ đề (bộ nhớ sẵn) và danh sách ngữ pháp (để kiểm tra mã và tìm theo tên khi import)
async function loadLookups(supabase: Supabase) {
  const [levels, topics, grammar] = await Promise.all([
    getLevelOptions(),
    getTopicOptions(),
    supabase.from("grammar_points").select("id, title, level_id"),
  ]);
  if (grammar.error) throw grammar.error;
  const lookups: QuestionLookups = {
    levelIds: new Set(levels.map((l) => l.id)),
    topicIds: new Set(topics.map((t) => t.id)),
    grammarPointIds: new Set((grammar.data ?? []).map((g) => g.id as number)),
  };
  const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const topicByName = new Map(topics.map((t) => [key(t.name), t.id]));
  const grammarByTitle = new Map((grammar.data ?? []).map((g) => [`${g.level_id}|${key(g.title)}`, g.id as number]));
  return { lookups, topicByName, grammarByTitle, key };
}

// Đọc đầy đủ một câu (kể cả đáp án) qua hàm admin_get_questions()
async function findQuestion(supabase: Supabase, id: string): Promise<AdminQuestion | null> {
  const { data, error } = await supabase.rpc("admin_get_questions", {}).select(ADMIN_QUESTION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toAdminQuestion(data as Parameters<typeof toAdminQuestion>[0]) : null;
}

// Lấy đường dẫn file trong bucket từ đường dẫn công khai của ảnh
function storagePath(imageUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const at = imageUrl.indexOf(marker);
  return at >= 0 ? decodeURIComponent(imageUrl.slice(at + marker.length)) : null;
}

async function removeImages(supabase: Supabase, urls: string[]) {
  const paths = urls.map(storagePath).filter((p): p is string => p !== null);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.error("[admin/questions] Không xóa được ảnh cũ:", error);
}

// ---------------------------------------------------------------------
// Thêm / Sửa
// ---------------------------------------------------------------------

export type SaveQuestionResult =
  | { ok: true; message: string }
  | { ok: false; error?: string; fieldErrors?: QuestionErrors };

/**
 * formData gồm:
 * - "payload": JSON { id, type, levelId, topicId, grammarPointId, status, explanation, audioText, fields }
 *   (fields.images: đường dẫn ảnh đang giữ, null = không có ảnh);
 * - "image_0" … "image_2": ảnh mới chọn cho tranh A, B, C (nếu có).
 */
export async function saveQuestion(formData: FormData): Promise<SaveQuestionResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, error: NOT_ADMIN };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
  const id = typeof payload.id === "string" && UUID.test(payload.id) ? payload.id : null;
  if (payload.id && !id) return { ok: false, error: GENERIC_ERROR };

  // Ảnh mới: kiểm tra trước, chỉ tải lên khi mọi thứ khác đã hợp lệ
  const newImages = new Map<number, File>();
  for (let i = 0; i < PICTURE_COUNT; i++) {
    const file = formData.get(`image_${i}`);
    if (file instanceof File && file.size > 0) {
      const problem = imageError(file);
      if (problem) return { ok: false, fieldErrors: { [`images.${i}`]: problem } };
      newImages.set(i, file);
    }
  }

  try {
    const before = id ? await findQuestion(supabase, id) : null;
    if (id && !before) return { ok: false, error: NOT_FOUND };

    // Chỉ giữ ảnh cũ đúng là của câu này (không tin đường dẫn lạ từ trình duyệt)
    const fields = sanitizeFields(payload.fields);
    const ownImages = new Set(before ? questionImages(before.content) : []);
    fields.images = fields.images.map((url, i) =>
      newImages.has(i) ? "pending-upload" : url && ownImages.has(url) ? url : null,
    );

    const { lookups } = await loadLookups(supabase);
    const result = validateQuestion(
      {
        type: payload.type,
        levelId: payload.levelId,
        topicId: payload.topicId,
        grammarPointId: payload.grammarPointId,
        status: payload.status,
        explanation: payload.explanation,
        audioText: payload.audioText,
        fields,
      },
      lookups,
    );
    if (result.errors) return { ok: false, fieldErrors: result.errors };
    const values: QuestionValues = result.values;

    // Tải ảnh mới lên
    const uploaded: string[] = [];
    if (newImages.size > 0 && values.question_type === "listening_picture") {
      const images = [...(values.content as { images: (string | null)[] }).images];
      const folder = id ?? crypto.randomUUID();
      for (const [i, file] of newImages) {
        const path = `${folder}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
        const upload = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (upload.error) {
          console.error("[admin/questions] Không tải được ảnh:", upload.error);
          await removeImages(supabase, uploaded);
          return { ok: false, error: "Chưa tải được ảnh lên. Bạn kiểm tra đã chạy migration 0008 chưa, rồi thử lại." };
        }
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        uploaded.push(url);
        images[i] = url;
      }
      values.content = { images };
    }

    const { error } = id
      ? await supabase.from("questions").update(values).eq("id", id)
      : await supabase.from("questions").insert(values);
    if (error) {
      await removeImages(supabase, uploaded);
      throw error;
    }

    // Ảnh cũ không còn dùng (đã thay, đã bỏ, hoặc đổi sang dạng câu khác) thì xóa khỏi kho
    const kept = new Set(questionImages(values.content));
    await removeImages(supabase, [...ownImages].filter((url) => !kept.has(url)));

    revalidatePath(PAGE_PATH);
    return { ok: true, message: id ? "Đã lưu thay đổi cho câu hỏi." : "Đã thêm câu hỏi." };
  } catch (error) {
    console.error("[admin/questions] Không lưu được câu hỏi:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------
// Xóa: câu đã nằm trong đề thi hoặc đã có câu trả lời của học viên thì chỉ chuyển sang Ngừng dùng
// ---------------------------------------------------------------------

export type DeleteQuestionResult = { ok: boolean; message: string; deactivated?: boolean };

export async function deleteQuestion(id: string): Promise<DeleteQuestionResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: NOT_ADMIN };
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, message: GENERIC_ERROR };

  try {
    const question = await findQuestion(supabase, id);
    if (!question) return { ok: false, message: NOT_FOUND };

    const [examUse, answerUse, lessonUse] = await Promise.all([
      supabase.from("exam_questions").select("question_id", { count: "exact", head: true }).eq("question_id", id),
      supabase.from("answers").select("id", { count: "exact", head: true }).eq("question_id", id),
      supabase.from("lesson_items").select("id", { count: "exact", head: true }).eq("question_id", id),
    ]);
    const checkError = examUse.error ?? answerUse.error ?? lessonUse.error;
    if (checkError) throw checkError;
    const inUse = (examUse.count ?? 0) + (answerUse.count ?? 0) + (lessonUse.count ?? 0) > 0;

    if (!inUse) {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (!error) {
        await removeImages(supabase, questionImages(question.content));
        revalidatePath(PAGE_PATH);
        return { ok: true, message: "Đã xóa câu hỏi." };
      }
      // 23503: vừa có đề thi / câu trả lời dùng câu này (khóa ngoại chặn xóa) → chuyển sang Ngừng dùng
      if (error.code !== "23503") throw error;
    }

    const { error } = await supabase.from("questions").update({ status: "inactive" }).eq("id", id);
    if (error) throw error;
    revalidatePath(PAGE_PATH);
    return {
      ok: true,
      deactivated: true,
      message: "Câu hỏi đã nằm trong đề thi, bài học hoặc đã có học viên trả lời nên chuyển sang Ngừng dùng.",
    };
  } catch (error) {
    console.error("[admin/questions] Không xóa được câu hỏi:", error);
    return { ok: false, message: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------
// Import Excel: trình duyệt đọc file, máy chủ kiểm tra và lưu
// ---------------------------------------------------------------------

async function checkImportRows(supabase: Supabase, rows: QuestionImportRow[]) {
  const { lookups, topicByName, grammarByTitle, key } = await loadLookups(supabase);
  const preview: QuestionImportPreview = { total: rows.length, valid: [], errors: [] };
  const toInsert: QuestionValues[] = [];

  for (const row of rows) {
    const messages: string[] = [];
    const type = parseQuestionType(row.type);
    if (!type) {
      preview.errors.push({ row: row.row, messages: [`Cột type "${row.type.trim()}" không phải dạng câu hợp lệ.`] });
      continue;
    }

    const levelId = parseLevel(row.level);
    if (levelId === null || !lookups.levelIds.has(levelId)) {
      messages.push("Cột level phải là 1, 2 hoặc 3 (hoặc HSK 1, HSK 2, HSK 3).");
    }
    let topicId: number | null = null;
    if (row.topic.trim()) {
      topicId = topicByName.get(key(row.topic)) ?? null;
      if (topicId === null) messages.push(`Chủ đề "${row.topic.trim()}" không có trong danh sách chủ đề.`);
    }
    let grammarPointId: number | null = null;
    if (row.grammar_point.trim()) {
      grammarPointId = grammarByTitle.get(`${levelId}|${key(row.grammar_point)}`) ?? null;
      if (grammarPointId === null) {
        messages.push(`Ngữ pháp "${row.grammar_point.trim()}" không có ở cấp này (chép đúng tên ở trang quản trị Ngữ pháp).`);
      }
    }

    const answer = parseImportAnswer(type, row.answer);
    if ("error" in answer) messages.push(answer.error);

    // Câu nghe chọn tranh không import được ảnh: lưu ở trạng thái Ngừng dùng, gắn ảnh sau
    const isPicture = type === "listening_picture";
    const result = validateQuestion(
      {
        type,
        levelId: levelId ?? 0,
        topicId,
        grammarPointId,
        status: isPicture ? "inactive" : "active",
        explanation: row.explanation,
        audioText: row.audio_text,
        fields: { ...importRowToFields(type, row), ...("fields" in answer ? answer.fields : {}) },
      },
      lookups,
    );
    if (result.errors) {
      const fieldErrors = { ...result.errors };
      // Lỗi cấp / chủ đề / ngữ pháp / đáp án đã báo ở trên bằng câu dành riêng cho file Excel
      delete fieldErrors.levelId;
      delete fieldErrors.topicId;
      delete fieldErrors.grammarPointId;
      if ("error" in answer) delete fieldErrors.answer;
      messages.push(...Object.entries(fieldErrors).map(([field, message]) => `${columnLabel(field)}: ${message}`));
    }

    if (messages.length > 0 || !result.values) {
      preview.errors.push({ row: row.row, messages });
    } else {
      preview.valid.push({
        row: row.row,
        type,
        summary: questionSummary(type, result.values.content, result.values.audio_text),
        note: isPicture ? "Chưa có ảnh: lưu ở trạng thái Ngừng dùng, vào Sửa để gắn 3 ảnh." : undefined,
      });
      toInsert.push(result.values);
    }
  }
  return { preview, toInsert };
}

// Tên cột Excel tương ứng với ô báo lỗi, để quản trị viên biết sửa ô nào
function columnLabel(field: string): string {
  const option = field.match(/^options\.(\d)$/);
  if (option) return `option_${String.fromCharCode(97 + Number(option[1]))}`;
  const map: Record<string, string> = {
    stem: "stem",
    tokens: "stem (các cụm)",
    pinyin: "pinyin",
    passage: "passage",
    question: "question",
    options: "option_a … option_f",
    answer: "answer",
    audioText: "audio_text",
    explanation: "explanation",
    images: "ảnh",
  };
  return map[field] ?? field;
}

function checkRowLimit(rows: QuestionImportRow[] | null): string | null {
  if (!rows || rows.length === 0) return "File không có dòng dữ liệu nào.";
  if (rows.length > QUESTION_IMPORT_MAX_ROWS) {
    return `File có ${rows.length} dòng, vượt quá giới hạn ${QUESTION_IMPORT_MAX_ROWS} dòng.`;
  }
  return null;
}

export type PreviewQuestionImportResult = { ok: true; preview: QuestionImportPreview } | { ok: false; error: string };

export async function previewQuestionImport(input: QuestionImportRow[]): Promise<PreviewQuestionImportResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, error: NOT_ADMIN };
  const rows = sanitizeQuestionImportRows(input);
  const limitError = checkRowLimit(rows);
  if (limitError || !rows) return { ok: false, error: limitError ?? GENERIC_ERROR };

  try {
    const { preview } = await checkImportRows(supabase, rows);
    return { ok: true, preview };
  } catch (error) {
    console.error("[admin/questions] Không kiểm tra được file import:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type CommitQuestionImportResult = { ok: boolean; message: string };

export async function commitQuestionImport(input: QuestionImportRow[]): Promise<CommitQuestionImportResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: NOT_ADMIN };
  const rows = sanitizeQuestionImportRows(input);
  const limitError = checkRowLimit(rows);
  if (limitError || !rows) return { ok: false, message: limitError ?? GENERIC_ERROR };

  try {
    // Kiểm tra lại toàn bộ ở máy chủ, không tin kết quả xem trước gửi từ trình duyệt
    const { toInsert, preview } = await checkImportRows(supabase, rows);
    if (toInsert.length === 0) return { ok: false, message: "Không có dòng hợp lệ nào để nhập." };

    const { error } = await supabase.from("questions").insert(toInsert);
    if (error) throw error;

    const pictures = toInsert.filter((q) => q.question_type === "listening_picture").length;
    revalidatePath(PAGE_PATH);
    return {
      ok: true,
      message:
        `Đã nhập ${toInsert.length} câu hỏi.` +
        (preview.errors.length > 0 ? ` Bỏ qua ${preview.errors.length} dòng lỗi.` : "") +
        (pictures > 0 ? ` Có ${pictures} câu nghe chọn tranh đang Ngừng dùng, chờ gắn ảnh.` : ""),
    };
  } catch (error) {
    console.error("[admin/questions] Không nhập được file:", error);
    return { ok: false, message: GENERIC_ERROR };
  }
}
