// Kiểu dữ liệu và hàm đọc kết quả của bộ máy phiên làm bài (hàm SQL ở migration 0009).
// Hàm thuần: không gọi database. Không import "@/…" để bài test chạy trực tiếp được.
import {
  isQuestionType,
  type QuestionAnswer,
  type QuestionForView,
  type Skill,
  type UserResponse,
} from "../questions/types.ts";

export const ATTEMPT_MODES = ["practice", "mixed"] as const;
export type AttemptMode = (typeof ATTEMPT_MODES)[number];

export const MODE_LABEL: Record<string, string> = {
  practice: "Luyện tập",
  mixed: "Ôn tổng hợp",
  weakness: "Ôn điểm yếu",
  exam: "Thi thử",
  lesson: "Bài học",
};

/** Tham số gửi cho start_attempt (đều không bắt buộc) */
export type SessionConfig = {
  level_id?: number;
  question_types?: string[];
  grammar_point_id?: number;
  count?: number;
  tag?: string;
};

/** Kết quả một câu đã nộp. Phiên chưa hiện đáp án (thi thử) thì isCorrect / answer là null. */
export type AnswerResult = {
  userAnswer: UserResponse | null;
  isFlagged: boolean;
  isCorrect: boolean | null;
  answer: QuestionAnswer | null;
  explanation: string | null;
};

export type SessionQuestion = {
  id: string;
  skill: Skill;
  levelId: number;
  question: QuestionForView;
  result: AnswerResult | null;
};

export type SessionView = {
  id: string;
  mode: string;
  status: "in_progress" | "submitted";
  levelId: number | null;
  tag: string | null;
  startedAt: string;
  submittedAt: string | null;
  correctCount: number | null;
  questions: SessionQuestion[];
};

const SKILLS: readonly Skill[] = ["vocabulary", "grammar", "listening", "reading", "writing"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Câu trả lời đã lưu → đúng một trong 4 dạng UserResponse (dữ liệu lạ thì null) */
export function toUserResponse(raw: unknown): UserResponse | null {
  if (!isObject(raw)) return null;
  if (Number.isInteger(raw.index)) return { index: raw.index as number };
  if (typeof raw.value === "boolean") return { value: raw.value };
  if (Array.isArray(raw.order) && raw.order.every((i) => Number.isInteger(i))) return { order: raw.order as number[] };
  if (typeof raw.text === "string") return { text: raw.text };
  return null;
}

/** Kết quả của submit_answer() hoặc mục `result` trong get_attempt() */
export function toAnswerResult(raw: unknown): AnswerResult | null {
  if (!isObject(raw)) return null;
  return {
    userAnswer: toUserResponse(raw.user_answer),
    isFlagged: raw.is_flagged === true,
    isCorrect: typeof raw.is_correct === "boolean" ? raw.is_correct : null,
    answer: isObject(raw.answer) ? (raw.answer as QuestionAnswer) : null,
    explanation: str(raw.explanation),
  };
}

/** Kết quả của get_attempt() → dữ liệu cho giao diện; dữ liệu sai dạng thì null */
export function toSessionView(raw: unknown): SessionView | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !Array.isArray(raw.questions)) return null;
  const config = isObject(raw.config) ? raw.config : {};
  const questions: SessionQuestion[] = [];
  for (const q of raw.questions) {
    if (!isObject(q) || typeof q.id !== "string" || !isQuestionType(q.type) || !isObject(q.content)) continue;
    questions.push({
      id: q.id,
      skill: SKILLS.includes(q.skill as Skill) ? (q.skill as Skill) : "vocabulary",
      levelId: num(q.level_id) ?? 0,
      question: { type: q.type, content: q.content, audioText: str(q.audio_text) } as QuestionForView,
      result: toAnswerResult(q.result),
    });
  }
  return {
    id: raw.id,
    mode: str(raw.attempt_type) ?? "practice",
    status: raw.status === "submitted" ? "submitted" : "in_progress",
    levelId: num(config.level_id),
    tag: str(config.tag),
    startedAt: str(raw.started_at) ?? "",
    submittedAt: str(raw.submitted_at),
    correctCount: num(raw.correct_count),
    questions,
  };
}

/** Vị trí câu đang làm: câu đầu tiên chưa nộp (bằng số câu nếu đã làm hết) */
export function firstUnanswered(questions: Pick<SessionQuestion, "result">[]): number {
  const index = questions.findIndex((q) => q.result === null);
  return index === -1 ? questions.length : index;
}

export type SessionSummary = { total: number; answered: number; correct: number; wrong: number; flagged: number };

export function summarize(questions: Pick<SessionQuestion, "result">[]): SessionSummary {
  const answered = questions.filter((q) => q.result !== null);
  return {
    total: questions.length,
    answered: answered.length,
    correct: answered.filter((q) => q.result?.isCorrect === true).length,
    wrong: answered.filter((q) => q.result?.isCorrect === false).length,
    flagged: answered.filter((q) => q.result?.isFlagged).length,
  };
}
