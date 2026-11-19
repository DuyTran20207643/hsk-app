// Kiểu dữ liệu và quy tắc kiểm tra một điểm ngữ pháp (bảng grammar_points).
// Dùng chung cho sheet Thêm / Sửa ở trang quản trị và Server Action; máy chủ luôn kiểm tra lại.
// Đường dẫn tương đối kèm .ts để bài test (node --test) chạy được trực tiếp
import { normalizePinyin } from "../pinyin.ts";

/** Một câu ví dụ, lưu trong cột grammar_points.examples (jsonb) */
export type GrammarExample = { zh: string; pinyin: string; vi: string };

/** Một điểm ngữ pháp như hiển thị trên giao diện */
export type GrammarPoint = {
  id: number;
  levelId: number;
  title: string;
  structure: string;
  explanation: string;
  examples: GrammarExample[];
  sortOrder: number | null;
  isPublished: boolean;
};

export const GRAMMAR_COLUMNS = "id, level_id, title, structure, explanation, examples, sort_order, is_published";

type GrammarDbRow = {
  id: number;
  level_id: number;
  title: string;
  structure: string | null;
  explanation: string | null;
  examples: unknown;
  sort_order: number | null;
  is_published: boolean;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** Đọc mảng câu ví dụ từ jsonb; bỏ qua phần tử sai dạng thay vì làm hỏng cả trang */
export function parseExamples(value: unknown): GrammarExample[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({ zh: str(item.zh), pinyin: str(item.pinyin), vi: str(item.vi) }))
    .filter((item) => item.zh.trim() !== "");
}

export function toGrammarPoint(row: GrammarDbRow): GrammarPoint {
  return {
    id: row.id,
    levelId: row.level_id,
    title: row.title,
    structure: row.structure ?? "",
    explanation: row.explanation ?? "",
    examples: parseExamples(row.examples),
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  };
}

export const GRAMMAR_LIMITS = {
  title: 120,
  structure: 200,
  explanation: 2000,
  exampleZh: 200,
  examplePinyin: 300,
  exampleVi: 300,
  minExamples: 1,
  maxExamples: 10,
} as const;

/** Dữ liệu thô từ form (trình duyệt gửi lên, chưa tin được) */
export type RawGrammarInput = {
  levelId: unknown;
  title: unknown;
  structure: unknown;
  explanation: unknown;
  examples: unknown;
  isPublished: unknown;
};

/** Dữ liệu đã kiểm tra, sẵn sàng ghi vào bảng grammar_points (chưa gồm sort_order) */
export type GrammarValues = {
  level_id: number;
  title: string;
  structure: string;
  explanation: string;
  examples: GrammarExample[];
  is_published: boolean;
};

/** Lỗi theo ô: "title", "structure", "explanation", "levelId", "examples", "examples.0.zh"… */
export type GrammarFieldErrors = Record<string, string>;

export type GrammarValidation =
  | { values: GrammarValues; errors: null }
  | { values: null; errors: GrammarFieldErrors };

const clean = (value: unknown) => str(value).trim().replace(/\s+/g, " ");
// Giải thích được xuống dòng: chỉ bỏ khoảng trắng thừa ở đầu / cuối
const cleanMultiline = (value: unknown) => str(value).replace(/\r\n/g, "\n").trim();

export function validateGrammarPoint(raw: RawGrammarInput, levelIds: ReadonlySet<number>): GrammarValidation {
  const errors: GrammarFieldErrors = {};
  const L = GRAMMAR_LIMITS;

  const levelId = Number(raw.levelId);
  if (!levelIds.has(levelId)) errors.levelId = "Bạn hãy chọn cấp HSK.";

  const title = clean(raw.title);
  if (!title) errors.title = "Bạn hãy nhập tên ngữ pháp.";
  else if (title.length > L.title) errors.title = `Tên tối đa ${L.title} ký tự.`;

  const structure = clean(raw.structure);
  if (!structure) errors.structure = "Bạn hãy nhập cấu trúc, ví dụ: A + 把 + B + V + thành phần khác.";
  else if (structure.length > L.structure) errors.structure = `Cấu trúc tối đa ${L.structure} ký tự.`;

  const explanation = cleanMultiline(raw.explanation);
  if (!explanation) errors.explanation = "Bạn hãy nhập phần giải thích.";
  else if (explanation.length > L.explanation) errors.explanation = `Giải thích tối đa ${L.explanation} ký tự.`;

  const rawExamples = Array.isArray(raw.examples) ? raw.examples : [];
  const examples: GrammarExample[] = [];
  rawExamples.slice(0, L.maxExamples).forEach((item, i) => {
    const row = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    const zh = clean(row.zh);
    const pinyin = normalizePinyin(clean(row.pinyin));
    const vi = clean(row.vi);
    if (!zh) errors[`examples.${i}.zh`] = "Bạn hãy nhập câu chữ Hán.";
    else if (zh.length > L.exampleZh) errors[`examples.${i}.zh`] = `Tối đa ${L.exampleZh} ký tự.`;
    if (!pinyin) errors[`examples.${i}.pinyin`] = "Bạn hãy nhập pinyin.";
    else if (pinyin.length > L.examplePinyin) errors[`examples.${i}.pinyin`] = `Tối đa ${L.examplePinyin} ký tự.`;
    if (!vi) errors[`examples.${i}.vi`] = "Bạn hãy nhập nghĩa tiếng Việt.";
    else if (vi.length > L.exampleVi) errors[`examples.${i}.vi`] = `Tối đa ${L.exampleVi} ký tự.`;
    examples.push({ zh, pinyin, vi });
  });
  if (rawExamples.length < L.minExamples) errors.examples = "Cần ít nhất 1 câu ví dụ.";
  else if (rawExamples.length > L.maxExamples) errors.examples = `Tối đa ${L.maxExamples} câu ví dụ.`;

  if (Object.keys(errors).length > 0) return { values: null, errors };
  return {
    values: {
      level_id: levelId,
      title,
      structure,
      explanation,
      examples,
      is_published: raw.isPublished === true,
    },
    errors: null,
  };
}
