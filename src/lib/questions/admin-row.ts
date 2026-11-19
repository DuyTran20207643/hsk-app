// Một câu hỏi như trang quản trị dùng (đọc qua hàm admin_get_questions(), có cả đáp án).
import { isQuestionType, type QuestionAnswer, type QuestionContent, type QuestionType } from "./types.ts";

export type AdminQuestion = {
  id: string;
  type: QuestionType;
  levelId: number;
  topicId: number | null;
  grammarPointId: number | null;
  content: QuestionContent;
  answer: QuestionAnswer;
  explanation: string | null;
  audioText: string | null;
  status: "active" | "inactive";
};

export const ADMIN_QUESTION_COLUMNS =
  "id, question_type, level_id, topic_id, grammar_point_id, content, answer, explanation, audio_text, status";

type DbRow = {
  id: string;
  question_type: string;
  level_id: number;
  topic_id: number | null;
  grammar_point_id: number | null;
  content: unknown;
  answer: unknown;
  explanation: string | null;
  audio_text: string | null;
  status: string;
};

export function toAdminQuestion(row: DbRow): AdminQuestion | null {
  if (!isQuestionType(row.question_type)) return null;
  return {
    id: row.id,
    type: row.question_type,
    levelId: row.level_id,
    topicId: row.topic_id,
    grammarPointId: row.grammar_point_id,
    content: (row.content ?? {}) as QuestionContent,
    answer: (row.answer ?? {}) as QuestionAnswer,
    explanation: row.explanation,
    audioText: row.audio_text,
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

/** Ảnh của câu (nghe chọn tranh) */
export function questionImages(content: unknown): string[] {
  const images = (content as { images?: unknown } | null)?.images;
  return Array.isArray(images) ? images.filter((x): x is string => typeof x === "string" && x !== "") : [];
}
