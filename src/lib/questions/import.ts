// Quy ước file Excel để import câu hỏi. Dùng chung cho trình duyệt (đọc file, tạo file mẫu)
// và máy chủ (kiểm tra, lưu). Giống cách làm của import từ vựng (src/lib/words/import.ts).
import { EMPTY_FIELDS, type QuestionFields } from "./validate.ts";
import { QUESTION_TYPE_LABEL, QUESTION_TYPES, type QuestionType } from "./types.ts";

export const QUESTION_IMPORT_MAX_ROWS = 1000;

const OPTION_COLUMNS = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"] as const;

// Đúng thứ tự cột trong file mẫu
export const QUESTION_IMPORT_COLUMNS = [
  "type",
  "level",
  "topic",
  "grammar_point",
  "stem",
  "pinyin",
  "passage",
  "question",
  "audio_text",
  ...OPTION_COLUMNS,
  "answer",
  "explanation",
] as const;

export type QuestionImportColumn = (typeof QUESTION_IMPORT_COLUMNS)[number];

/** Một dòng trong file (mọi ô đã đổi thành chữ). row: số dòng trong Excel (dòng tiêu đề là 1). */
export type QuestionImportRow = { row: number } & Record<QuestionImportColumn, string>;

type TemplateRow = Partial<Record<QuestionImportColumn, string | number>>;

/** File mẫu: mỗi dạng câu một dòng ví dụ */
export const QUESTION_IMPORT_TEMPLATE: TemplateRow[] = [
  { type: "vocab_meaning", level: 2, topic: "Giao thông và đi lại", stem: "机场", pinyin: "ji1chang3", option_a: "sân bay", option_b: "nhà ga", option_c: "bến xe", answer: "A" },
  { type: "grammar_fill", level: 3, grammar_point: "Mẫu câu với 把 (câu chữ 把)", stem: "我＿作业做完了。", option_a: "把", option_b: "被", answer: "A", explanation: "Câu chữ 把: 我把作业做完了。" },
  { type: "listening_picture", level: 1, audio_text: "我在机场。", answer: "B", explanation: "Nhập xong thì vào Sửa để gắn 3 ảnh." },
  { type: "listening_true_false", level: 1, stem: "他今天不上班。", audio_text: "我今天休息，不去公司。", answer: "Đúng" },
  { type: "listening_short_dialogue", level: 2, question: "男的去哪儿？", audio_text: "女：你去哪儿？男：我去机场接朋友。", option_a: "机场", option_b: "学校", option_c: "医院", answer: "A" },
  { type: "listening_long_dialogue", level: 3, question: "他们几点见面？", audio_text: "男：明天我们几点见面？女：九点吧。男：好，九点在学校门口见。", option_a: "八点", option_b: "九点", option_c: "十点", answer: "B" },
  { type: "reading_match", level: 2, stem: "你喝茶还是喝咖啡？", option_a: "我喝茶。", option_b: "他是老师。", option_c: "明天见。", answer: "A" },
  { type: "reading_fill_blank", level: 2, stem: "我想＿一杯茶。", option_a: "喝", option_b: "吃", option_c: "看", answer: "A" },
  { type: "reading_comprehension", level: 3, passage: "小王每天坐地铁上班，大概要四十分钟。", question: "小王怎么上班？", option_a: "坐地铁", option_b: "开车", option_c: "走路", answer: "A" },
  { type: "writing_order", level: 3, stem: "我 | 把作业 | 做完了", answer: "我把作业做完了。" },
  { type: "writing_hanzi", level: 3, stem: "fēi（ ）机", answer: "飞" },
];

/** "vocab_meaning" hoặc tên tiếng Việt ("Chọn nghĩa của từ") → mã dạng câu */
export function parseQuestionType(value: string): QuestionType | null {
  const v = value.trim().toLowerCase();
  return QUESTION_TYPES.find((t) => t === v || QUESTION_TYPE_LABEL[t].toLowerCase() === v) ?? null;
}

/** Đổi cột answer theo dạng câu. Trả về ô đáp án, hoặc câu báo lỗi. */
export function parseImportAnswer(
  type: QuestionType,
  value: string,
): { fields: Pick<QuestionFields, "answerIndex" | "answerValue" | "answerText"> } | { error: string } {
  const v = value.trim();
  const base = { answerIndex: null, answerValue: null, answerText: "" };
  if (type === "listening_true_false") {
    const lower = v.toLowerCase();
    if (lower === "đúng" || lower === "dung" || lower === "true") return { fields: { ...base, answerValue: true } };
    if (lower === "sai" || lower === "false") return { fields: { ...base, answerValue: false } };
    return { error: 'Cột answer của câu đúng / sai phải là "Đúng" hoặc "Sai".' };
  }
  if (type === "writing_order" || type === "writing_hanzi") {
    if (!v) return { error: type === "writing_order" ? "Cột answer cần câu hoàn chỉnh." : "Cột answer cần chữ Hán đúng." };
    return { fields: { ...base, answerText: v } };
  }
  const match = v.match(/^[A-Fa-f]$/);
  if (!match) return { error: "Cột answer phải là một chữ cái từ A đến F." };
  return { fields: { ...base, answerIndex: v.toUpperCase().charCodeAt(0) - 65 } };
}

/** Các ô phẳng của biểu mẫu từ một dòng Excel (chưa gồm đáp án) */
export function importRowToFields(type: QuestionType, row: QuestionImportRow): QuestionFields {
  const options = OPTION_COLUMNS.map((c) => row[c].trim());
  while (options.length > 0 && options[options.length - 1] === "") options.pop();
  return {
    ...EMPTY_FIELDS,
    stem: type === "writing_order" ? "" : row.stem,
    pinyin: row.pinyin,
    passage: row.passage,
    question: row.question,
    options,
    // Sắp xếp câu: cột stem chứa các cụm cách nhau bởi dấu |
    tokens: type === "writing_order" ? row.stem.split("|").map((t) => t.trim()) : [],
    images: [null, null, null], // ảnh không import được, gắn sau qua màn Sửa
  };
}

export type QuestionImportPreview = {
  total: number;
  valid: { row: number; type: QuestionType; summary: string; note?: string }[];
  errors: { row: number; messages: string[] }[];
};

// Máy chủ không tin dữ liệu gửi từ trình duyệt: chỉ giữ đúng các cột đã biết,
// đổi mọi ô thành chữ (chuẩn Unicode NFC, tối đa 3.000 ký tự mỗi ô).
export function sanitizeQuestionImportRows(input: unknown): QuestionImportRow[] | null {
  if (!Array.isArray(input)) return null;
  return input.map((item, index) => {
    const source = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    const row = { row: Number.isInteger(source.row) ? (source.row as number) : index + 2 } as QuestionImportRow;
    for (const column of QUESTION_IMPORT_COLUMNS) {
      const value = source[column];
      row[column] =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value).normalize("NFC").slice(0, 3000)
          : "";
    }
    return row;
  });
}
