"use server";

// Các thao tác của bộ máy phiên làm bài. Chạy ở máy chủ bằng phiên đăng nhập của học viên
// và chỉ gọi các hàm SQL security definer ở migration 0009 (start_attempt, submit_answer,
// finish_attempt). Việc chọn câu, kiểm tra quyền, chấm điểm và lưu đều nằm trong database;
// đáp án không bao giờ đi qua trình duyệt trước khi học viên nộp câu đó.
// KHÔNG dùng service_role key.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ATTEMPT_MODES, toAnswerResult, type AnswerResult, type AttemptMode, type SessionConfig } from "@/lib/practice/session";
import { createClient } from "@/lib/supabase/server";

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
