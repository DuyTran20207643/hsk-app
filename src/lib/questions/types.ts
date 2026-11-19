// Cấu trúc dữ liệu của 11 dạng câu hỏi (bảng questions, cột content / answer / audio_text).
// Dùng chung cho trang quản trị, import Excel, thành phần hiển thị QuestionView và hàm chấm điểm.
// Không import "@/…" để bài test (node --test) chạy trực tiếp được.

export const QUESTION_TYPES = [
  "vocab_meaning",
  "grammar_fill",
  "listening_picture",
  "listening_true_false",
  "listening_short_dialogue",
  "listening_long_dialogue",
  "reading_match",
  "reading_fill_blank",
  "reading_comprehension",
  "writing_order",
  "writing_hanzi",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Skill = "vocabulary" | "grammar" | "listening" | "reading" | "writing";

/** Cột skill tự suy ra từ dạng câu */
export const SKILL_OF_TYPE: Record<QuestionType, Skill> = {
  vocab_meaning: "vocabulary",
  grammar_fill: "grammar",
  listening_picture: "listening",
  listening_true_false: "listening",
  listening_short_dialogue: "listening",
  listening_long_dialogue: "listening",
  reading_match: "reading",
  reading_fill_blank: "reading",
  reading_comprehension: "reading",
  writing_order: "writing",
  writing_hanzi: "writing",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  vocab_meaning: "Chọn nghĩa của từ",
  grammar_fill: "Điền ngữ pháp",
  listening_picture: "Nghe – chọn tranh",
  listening_true_false: "Nghe – đúng / sai",
  listening_short_dialogue: "Nghe – hội thoại ngắn",
  listening_long_dialogue: "Nghe – hội thoại dài",
  reading_match: "Đọc – chọn câu phù hợp",
  reading_fill_blank: "Đọc – điền từ",
  reading_comprehension: "Đọc hiểu",
  writing_order: "Viết – sắp xếp câu",
  writing_hanzi: "Viết – điền chữ Hán",
};

export const SKILL_LABEL: Record<Skill, string> = {
  vocabulary: "Từ vựng",
  grammar: "Ngữ pháp",
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
};

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

export function isListening(type: QuestionType): boolean {
  return SKILL_OF_TYPE[type] === "listening";
}

/** Dấu chỗ trống trong câu điền (chữ ＿ toàn khổ, U+FF3F) */
export const BLANK = "＿";

// --- Nội dung (content) và đáp án (answer) theo từng dạng -----------------

export type IndexAnswer = { index: number };
export type BooleanAnswer = { value: boolean };
export type SentenceAnswer = { sentence: string };
export type TextAnswer = { text: string };

type Spec = {
  vocab_meaning: { content: { stem: string; pinyin: string; options: string[] }; answer: IndexAnswer };
  grammar_fill: { content: { stem: string; pinyin?: string; options: string[] }; answer: IndexAnswer };
  /** images: 3 đường dẫn ảnh; null = chưa gắn ảnh (câu nhập từ Excel, chưa dùng được) */
  listening_picture: { content: { images: (string | null)[] }; answer: IndexAnswer };
  listening_true_false: { content: { statement: string }; answer: BooleanAnswer };
  listening_short_dialogue: { content: { question: string; options: string[] }; answer: IndexAnswer };
  listening_long_dialogue: { content: { question: string; options: string[] }; answer: IndexAnswer };
  reading_match: { content: { stem: string; options: string[] }; answer: IndexAnswer };
  reading_fill_blank: { content: { stem: string; options: string[] }; answer: IndexAnswer };
  reading_comprehension: { content: { passage: string; question: string; options: string[] }; answer: IndexAnswer };
  writing_order: { content: { tokens: string[] }; answer: SentenceAnswer };
  writing_hanzi: { content: { stem: string }; answer: TextAnswer };
};

export type QuestionContent<T extends QuestionType = QuestionType> = Spec[T]["content"];
export type QuestionAnswer<T extends QuestionType = QuestionType> = Spec[T]["answer"];

/** Đề bài như học viên thấy (không có đáp án) */
export type QuestionForView = {
  [K in QuestionType]: { type: K; content: Spec[K]["content"]; audioText: string | null };
}[QuestionType];

/** Đề bài kèm đáp án (dùng ở máy chủ để chấm, hoặc ở trang quản trị) */
export type QuestionWithAnswer = {
  [K in QuestionType]: { type: K; content: Spec[K]["content"]; answer: Spec[K]["answer"] };
}[QuestionType];

/** Số lựa chọn cho phép của các dạng có options */
export const OPTION_RANGE: Partial<Record<QuestionType, readonly [number, number]>> = {
  vocab_meaning: [3, 4],
  grammar_fill: [2, 4],
  listening_short_dialogue: [3, 3],
  listening_long_dialogue: [3, 3],
  reading_match: [3, 6],
  reading_fill_blank: [3, 6],
  reading_comprehension: [3, 3],
};
export const PICTURE_COUNT = 3;
export const TOKEN_RANGE = [3, 8] as const;

/** Kiểu câu trả lời của học viên (lưu vào answers.user_answer) */
export type UserResponse =
  | { index: number } // chọn đáp án / chọn tranh
  | { value: boolean } // đúng / sai
  | { order: number[] } // sắp xếp câu: thứ tự các cụm đã bấm
  | { text: string }; // điền chữ Hán

/** Dạng câu này trả lời bằng cách chọn một lựa chọn (A, B, C…) */
export function answersByIndex(type: QuestionType): boolean {
  return type !== "listening_true_false" && type !== "writing_order" && type !== "writing_hanzi";
}

/** Chữ cái của lựa chọn thứ i: 0 → A */
export const optionLetter = (index: number) => String.fromCharCode(65 + index);
