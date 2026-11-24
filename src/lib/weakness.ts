// Tính điểm yếu của học viên (UC09, quy tắc BR10, BR11). Trang Ôn tập, Ôn điểm yếu,
// và sau này Trang chủ, Tiến độ dùng chung file này.
//
// Quy tắc:
// - Chỉ xét câu trả lời ĐÃ CHẤM trong 30 ngày gần nhất, thuộc một cấp HSK (thường là cấp mục tiêu).
// - Gom theo 3 kiểu: dạng câu, chủ đề, ngữ pháp. Một câu trả lời có thể rơi vào cả 3 nhóm.
// - Câu đúng nhưng học viên đánh dấu "Chưa chắc chắn" tính là SAI (đoán trúng chưa phải là nắm chắc).
// - Điểm yếu = nhóm có ít nhất 5 câu trả lời và tỷ lệ sai từ 30% trở lên.
// - Chưa đủ 20 câu trả lời trong 30 ngày thì chưa kết luận (báo chưa đủ dữ liệu).
//
// Phần tính toán là hàm thuần (không đọc database, "bây giờ" truyền vào) để viết bài test.
// Hàm đọc database ở cuối file chỉ chạy ở máy chủ.
// Không import "@/…" (trừ import type) để bài test chạy trực tiếp được.
import type { createClient } from "@/lib/supabase/server";
import { isQuestionType, type QuestionType } from "./questions/types.ts";

/** Chỉ xét câu trả lời trong bấy nhiêu ngày gần nhất */
export const WEAKNESS_WINDOW_DAYS = 30;
/** BR10: một nhóm cần từ 5 câu trả lời trở lên mới đủ để kết luận */
export const WEAK_MIN_ANSWERS = 5;
/** BR10: tỷ lệ sai từ 30% trở lên là điểm yếu */
export const WEAK_WRONG_RATE = 0.3;
/** BR11: dưới 20 câu trả lời trong 30 ngày thì chưa phân tích điểm yếu */
export const MIN_ANSWERS_FOR_ANALYSIS = 20;
/** Màn Ôn điểm yếu chỉ đưa ra tối đa 3 điểm yếu nặng nhất */
export const MAX_WEAKNESS_CHOICES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeaknessKind = "type" | "topic" | "grammar";

/** Một câu trả lời của học viên, kèm thông tin của câu hỏi */
export type AnswerRecord = {
  /** Thời điểm trả lời, dạng ISO */
  answeredAt: string;
  /** null = chưa chấm (ví dụ bài thi chưa nộp), không tính */
  isCorrect: boolean | null;
  isFlagged: boolean;
  levelId: number;
  questionType: QuestionType;
  topicId: number | null;
  grammarPointId: number | null;
};

/** Một nhóm cần xét: dạng câu (value là mã dạng), chủ đề hoặc ngữ pháp (value là id) */
export type WeaknessTarget =
  | { kind: "type"; value: QuestionType }
  | { kind: "topic"; value: number }
  | { kind: "grammar"; value: number };

export type GroupStats = {
  target: WeaknessTarget;
  /** Khóa dạng chữ, ví dụ "type:writing_order", "topic:3" (dùng trong địa chỉ trang, form) */
  key: string;
  answered: number;
  wrong: number;
  /** Từ 0 đến 1 */
  wrongRate: number;
  isWeak: boolean;
};

export type WeaknessReport =
  | { status: "not_enough_data"; answered: number; groups: GroupStats[] }
  | { status: "ok"; answered: number; groups: GroupStats[]; weaknesses: GroupStats[] };

/** Câu trả lời này có tính là sai không (sai, hoặc đúng nhưng chưa chắc chắn) */
export function countsAsWrong(record: Pick<AnswerRecord, "isCorrect" | "isFlagged">): boolean {
  return record.isCorrect !== true || record.isFlagged;
}

/** Các câu trả lời đã chấm, thuộc cấp `levelId`, trong 30 ngày tính đến `now` */
export function recentAnswers(records: readonly AnswerRecord[], levelId: number, now: Date): AnswerRecord[] {
  const end = now.getTime();
  const start = end - WEAKNESS_WINDOW_DAYS * DAY_MS;
  return records.filter((r) => {
    if (r.isCorrect === null || r.levelId !== levelId) return false;
    const at = Date.parse(r.answeredAt);
    return Number.isFinite(at) && at >= start && at <= end;
  });
}

export function weaknessKey(target: WeaknessTarget): string {
  return `${target.kind}:${target.value}`;
}

/** "type:writing_order" → nhóm tương ứng; chuỗi sai dạng thì null */
export function parseWeaknessKey(key: unknown): WeaknessTarget | null {
  if (typeof key !== "string") return null;
  const [kind, value, ...rest] = key.split(":");
  if (rest.length > 0 || value === undefined) return null;
  if (kind === "type") return isQuestionType(value) ? { kind, value } : null;
  if ((kind === "topic" || kind === "grammar") && /^[1-9]\d{0,8}$/.test(value)) return { kind, value: Number(value) };
  return null;
}

/** Câu trả lời có thuộc nhóm này không */
export function matchesTarget(record: AnswerRecord, target: WeaknessTarget): boolean {
  if (target.kind === "type") return record.questionType === target.value;
  if (target.kind === "topic") return record.topicId === target.value;
  return record.grammarPointId === target.value;
}

function targetsOf(record: AnswerRecord): WeaknessTarget[] {
  const out: WeaknessTarget[] = [{ kind: "type", value: record.questionType }];
  if (record.topicId !== null) out.push({ kind: "topic", value: record.topicId });
  if (record.grammarPointId !== null) out.push({ kind: "grammar", value: record.grammarPointId });
  return out;
}

const KIND_ORDER: Record<WeaknessKind, number> = { type: 0, topic: 1, grammar: 2 };

/** Nặng nhất lên trước: tỷ lệ sai cao hơn, rồi nhiều câu hơn */
function bySeverity(a: GroupStats, b: GroupStats): number {
  return (
    b.wrongRate - a.wrongRate ||
    b.answered - a.answered ||
    KIND_ORDER[a.target.kind] - KIND_ORDER[b.target.kind] ||
    a.key.localeCompare(b.key)
  );
}

/** Thống kê từng nhóm (dạng câu, chủ đề, ngữ pháp) từ các câu trả lời đã lọc */
export function groupStats(records: readonly AnswerRecord[]): GroupStats[] {
  const groups = new Map<string, { target: WeaknessTarget; answered: number; wrong: number }>();
  for (const record of records) {
    if (record.isCorrect === null) continue;
    const wrong = countsAsWrong(record);
    for (const target of targetsOf(record)) {
      const key = weaknessKey(target);
      const group = groups.get(key) ?? { target, answered: 0, wrong: 0 };
      group.answered += 1;
      if (wrong) group.wrong += 1;
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const wrongRate = g.wrong / g.answered;
      return {
        target: g.target,
        key,
        answered: g.answered,
        wrong: g.wrong,
        wrongRate,
        isWeak: g.answered >= WEAK_MIN_ANSWERS && wrongRate >= WEAK_WRONG_RATE,
      };
    })
    .sort(bySeverity);
}

/**
 * Phân tích điểm yếu của một cấp HSK.
 * Chưa đủ 20 câu trả lời trong 30 ngày → "not_enough_data" (vẫn kèm thống kê từng nhóm để hiện tỷ lệ đúng).
 */
export function analyzeWeaknesses(records: readonly AnswerRecord[], levelId: number, now: Date): WeaknessReport {
  const recent = recentAnswers(records, levelId, now);
  const groups = groupStats(recent);
  if (recent.length < MIN_ANSWERS_FOR_ANALYSIS) {
    return { status: "not_enough_data", answered: recent.length, groups };
  }
  return { status: "ok", answered: recent.length, groups, weaknesses: groups.filter((g) => g.isWeak) };
}

/**
 * Tỷ lệ đúng (0–1) của các câu trả lời thuộc ít nhất một trong các nhóm (mỗi câu trả lời tính một lần).
 * Dùng làm mốc "trước đó" để so với kết quả bài ôn điểm yếu. Không có câu nào thì null.
 */
export function combinedCorrectRate(records: readonly AnswerRecord[], targets: readonly WeaknessTarget[]): number | null {
  const matched = records.filter((r) => r.isCorrect !== null && targets.some((t) => matchesTarget(r, t)));
  if (matched.length === 0) return null;
  return matched.filter((r) => !countsAsWrong(r)).length / matched.length;
}

/** Tỷ lệ đúng theo từng dạng câu (chỉ dạng đã có câu trả lời) */
export function correctRateByType(groups: readonly GroupStats[]): Partial<Record<QuestionType, GroupStats>> {
  const out: Partial<Record<QuestionType, GroupStats>> = {};
  for (const g of groups) if (g.target.kind === "type") out[g.target.value] = g;
  return out;
}

/** 0,456 → 46 (phần trăm, làm tròn) */
export function percent(rate: number): number {
  return Math.round(rate * 100);
}

// ---------------------------------------------------------------------
// Đọc database (chỉ chạy ở máy chủ)
// ---------------------------------------------------------------------

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type AnswerRow = {
  is_correct: boolean | null;
  is_flagged: boolean;
  answered_at: string;
  attempts: { status: string; config: { feedback?: unknown } | null } | null;
  questions: { level_id: number; question_type: string; topic_id: number | null; grammar_point_id: number | null } | null;
};

/** Dòng đọc từ database → AnswerRecord; bỏ dòng thiếu dữ liệu và câu của bài thi chưa nộp (còn sửa được) */
export function toAnswerRecords(rows: readonly AnswerRow[]): AnswerRecord[] {
  const out: AnswerRecord[] = [];
  for (const row of rows) {
    const q = row.questions;
    if (!q || !isQuestionType(q.question_type) || !row.attempts) continue;
    const deferred = row.attempts.config?.feedback === "deferred";
    if (deferred && row.attempts.status !== "submitted") continue;
    out.push({
      answeredAt: row.answered_at,
      isCorrect: row.is_correct,
      isFlagged: row.is_flagged,
      levelId: q.level_id,
      questionType: q.question_type,
      topicId: q.topic_id,
      grammarPointId: q.grammar_point_id,
    });
  }
  return out;
}

/**
 * Câu trả lời đã chấm của học viên trong 30 ngày tính đến `now` (mọi cấp).
 * Lọc user_id rõ ràng vì quản trị viên được RLS cho đọc bài làm của mọi người.
 * Trả về null nếu không đọc được (trang hiện thông báo lỗi thay vì kết luận sai).
 */
export async function loadAnswerRecords(supabase: ServerClient, userId: string, now: Date): Promise<AnswerRecord[] | null> {
  const since = new Date(now.getTime() - WEAKNESS_WINDOW_DAYS * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from("answers")
    .select(
      "is_correct, is_flagged, answered_at, attempts!inner(user_id, status, config), questions!inner(level_id, question_type, topic_id, grammar_point_id)",
    )
    .eq("attempts.user_id", userId)
    .gte("answered_at", since)
    .not("is_correct", "is", null)
    .order("answered_at", { ascending: false })
    .limit(5000)
    .returns<AnswerRow[]>();
  if (error) {
    console.error("[weakness] Không tải được câu trả lời:", error);
    return null;
  }
  return toAnswerRecords(data ?? []);
}
