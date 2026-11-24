"use server";

// Các thao tác của bộ máy phiên làm bài. Chạy ở máy chủ bằng phiên đăng nhập của học viên
// và chỉ gọi các hàm SQL security definer ở migration 0009 / 0010 (start_attempt, submit_answer,
// finish_attempt). Việc chọn câu, kiểm tra quyền, chấm điểm và lưu đều nằm trong database;
// đáp án không bao giờ đi qua trình duyệt trước khi học viên nộp câu đó.
// KHÔNG dùng service_role key.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ATTEMPT_MODES, toAnswerResult, type AnswerResult, type AttemptMode, type SessionConfig } from "@/lib/practice/session";
import { isQuestionType } from "@/lib/questions/types";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeWeaknesses,
  combinedCorrectRate,
  loadAnswerRecords,
  percent,
  recentAnswers,
} from "@/lib/weakness";

const NOT_SIGNED_IN = "Phiên đăng nhập đã hết hạn. Bạn vui lòng đăng nhập lại.";
const GENERIC_ERROR = "Đã có lỗi xảy ra. Bạn vui lòng thử lại.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Các mã lỗi mà hàm SQL đặt kèm câu thông báo tiếng Việt cho người dùng
const USER_FACING_CODES = new Set(["42501", "P0002", "22023", "55000"]);

type DbError = { code?: string; message: string };

function errorMessage(error: DbError, where: string): string {
  if (error.code && USER_FACING_CODES.has(error.code)) return error.message;
  console.error(`[practice] ${where}:`, error);
  return GENERIC_ERROR;
}

async function activeUser() {
  const user = await getCurrentUser();
  return user && user.status === "active" ? user : null;
}

/** Chỉ giữ các tham số đúng kiểu; database kiểm tra lại toàn bộ */
function cleanConfig(config: unknown): SessionConfig {
  const raw = (typeof config === "object" && config !== null ? config : {}) as Record<string, unknown>;
  const out: SessionConfig = {};
  if (Number.isInteger(raw.level_id)) out.level_id = raw.level_id as number;
  if (Number.isInteger(raw.grammar_point_id)) out.grammar_point_id = raw.grammar_point_id as number;
  if (Number.isInteger(raw.count)) out.count = raw.count as number;
  if (Array.isArray(raw.question_types)) {
    out.question_types = raw.question_types.filter((t): t is string => typeof t === "string").slice(0, 11);
  }
  if (typeof raw.tag === "string") out.tag = raw.tag.slice(0, 20);
  if (Array.isArray(raw.targets)) {
    out.targets = raw.targets.filter((t): t is string => typeof t === "string").slice(0, 10);
  }
  if (typeof raw.baseline === "number" && Number.isFinite(raw.baseline)) out.baseline = raw.baseline;
  return out;
}

export type StartResult = { ok: true; attemptId: string } | { ok: false; error: string };

export async function startPracticeSession(mode: AttemptMode, config: SessionConfig): Promise<StartResult> {
  if (!(await activeUser())) return { ok: false, error: NOT_SIGNED_IN };
  if (!(ATTEMPT_MODES as readonly string[]).includes(mode)) return { ok: false, error: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", { p_mode: mode, p_config: cleanConfig(config) });
  if (error) return { ok: false, error: errorMessage(error, "Không tạo được phiên") };
  return { ok: true, attemptId: String(data) };
}

export type SubmitResult = { ok: true; result: AnswerResult; locked: boolean } | { ok: false; error: string };

export async function submitPracticeAnswer(
  attemptId: string,
  questionId: string,
  response: unknown,
  isFlagged: boolean,
): Promise<SubmitResult> {
  if (!(await activeUser())) return { ok: false, error: NOT_SIGNED_IN };
  if (typeof attemptId !== "string" || !UUID.test(attemptId) || typeof questionId !== "string" || !UUID.test(questionId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_response: response ?? null,
    p_is_flagged: isFlagged === true,
  });
  if (error) return { ok: false, error: errorMessage(error, "Không nộp được câu trả lời") };

  const result = toAnswerResult(data);
  if (!result) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, result, locked: (data as { locked?: unknown }).locked === true };
}

export type FinishResult = { ok: true; correctCount: number; answeredCount: number; total: number } | { ok: false; error: string };

export async function finishPracticeSession(attemptId: string): Promise<FinishResult> {
  if (!(await activeUser())) return { ok: false, error: NOT_SIGNED_IN };
  if (typeof attemptId !== "string" || !UUID.test(attemptId)) return { ok: false, error: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_attempt", { p_attempt_id: attemptId });
  if (error) return { ok: false, error: errorMessage(error, "Không kết thúc được phiên") };

  const row = data as { correct_count?: number; answered_count?: number; total?: number };
  return { ok: true, correctCount: row.correct_count ?? 0, answeredCount: row.answered_count ?? 0, total: row.total ?? 0 };
}

// ---------------------------------------------------------------------
// Trang thử /practice/dev (chỉ quản trị viên)
// ---------------------------------------------------------------------

export type DevStartState = { error: string } | null;

export async function startDevSession(_prev: DevStartState, formData: FormData): Promise<DevStartState> {
  const user = await activeUser();
  if (!user || user.role !== "admin") return { error: "Trang này chỉ dành cho quản trị viên." };

  const level = Number(formData.get("level"));
  const config: SessionConfig = { count: 5, tag: "dev" };
  if (Number.isInteger(level) && level > 0) config.level_id = level;

  const result = await startPracticeSession("practice", config);
  if (!result.ok) return { error: result.error };
  redirect(`/practice/dev?attempt=${result.attemptId}`);
}

// ---------------------------------------------------------------------
// Trang Ôn tập (/review): bắt đầu 3 chế độ luyện tập rồi chuyển sang trang làm bài
// ---------------------------------------------------------------------

export type ReviewFormState = { error: string } | null;

/** Cấp HSK gửi từ form (1–9), sai dạng thì null; database kiểm tra lại cấp có tồn tại không */
function formLevel(value: FormDataEntryValue | null): number | null {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 9 ? level : null;
}

/** Ôn tổng hợp (BR17, BR18): 30 câu của cấp đã chọn */
export async function startMixedReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const level = formLevel(formData.get("level"));
  if (!level) return { error: "Bạn chọn cấp HSK trước nhé." };
  const result = await startPracticeSession("mixed", { level_id: level, count: 30 });
  if (!result.ok) return { error: result.error };
  redirect(`/practice/${result.attemptId}`);
}

/** Luyện theo dạng câu (UC06): 10 câu của dạng và cấp đã chọn */
export async function startTypePractice(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const level = formLevel(formData.get("level"));
  const type = formData.get("type");
  if (!level || !isQuestionType(type)) return { error: GENERIC_ERROR };
  const result = await startPracticeSession("practice", { level_id: level, question_types: [type], count: 10 });
  if (!result.ok) return { error: result.error };
  redirect(`/practice/${result.attemptId}`);
}

/**
 * Ôn điểm yếu (UC09): form gửi khóa của một điểm yếu ("type:…") hoặc "all" (Ôn tất cả).
 * Tính lại điểm yếu ở đây (không tin danh sách trình duyệt gửi lên), lấy tỷ lệ đúng trước đó
 * của các điểm yếu được chọn làm mốc so sánh khi xem kết quả.
 */
export async function startWeaknessReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const user = await activeUser();
  if (!user) return { error: NOT_SIGNED_IN };
  const choice = formData.get("target");
  if (typeof choice !== "string") return { error: GENERIC_ERROR };

  const supabase = await createClient();
  const { data: goal, error: goalError } = await supabase
    .from("study_goals")
    .select("level_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (goalError) {
    console.error("[practice] Không đọc được mục tiêu:", goalError);
    return { error: GENERIC_ERROR };
  }
  if (!goal) return { error: "Bạn cần đặt mục tiêu ôn thi trước." };

  const now = new Date();
  const records = await loadAnswerRecords(supabase, user.id, now);
  if (!records) return { error: GENERIC_ERROR };
  const report = analyzeWeaknesses(records, goal.level_id, now);
  if (report.status !== "ok") return { error: "Bạn chưa làm đủ câu để tìm điểm yếu." };

  const chosen = choice === "all" ? report.weaknesses.slice(0, 10) : report.weaknesses.filter((w) => w.key === choice);
  if (chosen.length === 0) {
    return { error: "Điểm yếu này đã thay đổi. Bạn tải lại trang để xem danh sách mới nhé." };
  }

  const baseline = combinedCorrectRate(
    recentAnswers(records, goal.level_id, now),
    chosen.map((w) => w.target),
  );
  const config: SessionConfig = { level_id: goal.level_id, targets: chosen.map((w) => w.key), count: 10 };
  if (baseline !== null) config.baseline = percent(baseline);

  const result = await startPracticeSession("weakness", config);
  if (!result.ok) return { error: result.error };
  redirect(`/practice/${result.attemptId}`);
}
