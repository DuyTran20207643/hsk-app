// Kiểm tra hợp lệ một câu hỏi cho cả 11 dạng.
// Biểu mẫu quản trị và file Excel đều đưa về cùng một dạng "ô phẳng" (QuestionFields),
// hàm này kiểm tra theo dạng câu rồi dựng content / answer đúng cấu trúc trong types.ts.
// Máy chủ luôn kiểm tra lại bằng hàm này trước khi ghi.
import { normalizePinyin } from "../pinyin.ts";
import {
  BLANK,
  isListening,
  isQuestionType,
  OPTION_RANGE,
  PICTURE_COUNT,
  SKILL_OF_TYPE,
  TOKEN_RANGE,
  type QuestionAnswer,
  type QuestionContent,
  type QuestionType,
  type Skill,
} from "./types.ts";

/** Các ô nhập dùng chung cho mọi dạng; mỗi dạng chỉ dùng một phần */
export type QuestionFields = {
  stem: string; // đề bài / từ cần hỏi / câu nhận định (đúng sai) / câu có chỗ trống
  pinyin: string;
  passage: string; // đoạn văn (đọc hiểu)
  question: string; // câu hỏi (hội thoại, đọc hiểu)
  options: string[];
  tokens: string[]; // các cụm (sắp xếp câu)
  images: (string | null)[]; // 3 ảnh (nghe chọn tranh)
  answerIndex: number | null;
  answerValue: boolean | null;
  answerText: string; // câu hoàn chỉnh (sắp xếp câu) hoặc chữ Hán (điền chữ Hán)
};

export const EMPTY_FIELDS: QuestionFields = {
  stem: "",
  pinyin: "",
  passage: "",
  question: "",
  options: ["", "", ""],
  tokens: ["", "", ""],
  images: [null, null, null],
  answerIndex: null,
  answerValue: null,
  answerText: "",
};

export type QuestionStatus = "active" | "inactive";

export type QuestionInput = {
  type: unknown;
  levelId: unknown;
  topicId: unknown;
  grammarPointId: unknown;
  status: unknown;
  explanation: unknown;
  audioText: unknown;
  fields: unknown;
};

/** Một dòng sẵn sàng ghi vào bảng questions */
export type QuestionValues = {
  question_type: QuestionType;
  skill: Skill;
  level_id: number;
  topic_id: number | null;
  grammar_point_id: number | null;
  content: QuestionContent;
  answer: QuestionAnswer;
  explanation: string | null;
  audio_text: string | null;
  status: QuestionStatus;
};

export type QuestionLookups = {
  levelIds: ReadonlySet<number>;
  topicIds: ReadonlySet<number>;
  grammarPointIds: ReadonlySet<number>;
};

/** Lỗi theo ô: "type", "levelId", "stem", "options", "options.2", "answer", "audioText", "images"… */
export type QuestionErrors = Record<string, string>;

export const QUESTION_LIMITS = {
  stem: 500,
  pinyin: 500,
  passage: 3000,
  question: 300,
  option: 200,
  token: 50,
  answerText: 300,
  explanation: 1000,
  audioText: 3000,
} as const;

const str = (value: unknown) => (typeof value === "string" ? value : "");
const clean = (value: unknown) => str(value).normalize("NFC").replace(/\s+/g, " ").trim();
const cleanMultiline = (value: unknown) => str(value).normalize("NFC").replace(/\r\n/g, "\n").trim();
const optionalId = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

/** Bỏ khoảng trắng và dấu câu để so sánh (chấm điểm, kiểm tra câu ghép từ các cụm) */
export function normalizeForCompare(value: string): string {
  return value.normalize("NFC").replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
}

/** Các ô phẳng từ dữ liệu thô (trình duyệt gửi lên, chưa tin được) */
export function sanitizeFields(value: unknown): QuestionFields {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max).map((x) => str(x)) : []);
  const images = Array.isArray(raw.images) ? raw.images.slice(0, PICTURE_COUNT) : [];
  return {
    stem: str(raw.stem),
    pinyin: str(raw.pinyin),
    passage: str(raw.passage),
    question: str(raw.question),
    options: list(raw.options, 10),
    tokens: list(raw.tokens, 12),
    images: Array.from({ length: PICTURE_COUNT }, (_, i) => (typeof images[i] === "string" && images[i] ? (images[i] as string) : null)),
    answerIndex: Number.isInteger(raw.answerIndex) ? (raw.answerIndex as number) : null,
    answerValue: typeof raw.answerValue === "boolean" ? raw.answerValue : null,
    answerText: str(raw.answerText),
  };
}

/** Đổi câu hỏi đã lưu về các ô phẳng (để mở trong biểu mẫu Sửa) */
export function fieldsFromQuestion(type: QuestionType, content: unknown, answer: unknown): QuestionFields {
  const c = (typeof content === "object" && content !== null ? content : {}) as Record<string, unknown>;
  const a = (typeof answer === "object" && answer !== null ? answer : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)) : []);
  const fields: QuestionFields = {
    ...EMPTY_FIELDS,
    stem: type === "listening_true_false" ? str(c.statement) : str(c.stem),
    pinyin: str(c.pinyin),
    passage: str(c.passage),
    question: str(c.question),
    options: list(c.options).length > 0 ? list(c.options) : EMPTY_FIELDS.options,
    tokens: list(c.tokens).length > 0 ? list(c.tokens) : EMPTY_FIELDS.tokens,
    images: Array.from({ length: PICTURE_COUNT }, (_, i) => {
      const img = Array.isArray(c.images) ? c.images[i] : null;
      return typeof img === "string" && img ? img : null;
    }),
    answerIndex: Number.isInteger(a.index) ? (a.index as number) : null,
    answerValue: typeof a.value === "boolean" ? a.value : null,
    answerText: str(type === "writing_order" ? a.sentence : a.text),
  };
  return fields;
}

export type QuestionValidation =
  | { values: QuestionValues; errors: null }
  | { values: null; errors: QuestionErrors };

/** Kiểm tra phần nội dung và đáp án theo dạng câu; trả về content / answer đã chuẩn hóa */
export function buildContent(
  type: QuestionType,
  fields: QuestionFields,
  errors: QuestionErrors,
  options: { requireImages: boolean },
): { content: QuestionContent; answer: QuestionAnswer } | null {
  const L = QUESTION_LIMITS;
  const text = (key: "stem" | "passage" | "question", label: string, max: number, multiline = false) => {
    const value = multiline ? cleanMultiline(fields[key]) : clean(fields[key]);
    if (!value) errors[key] = `Bạn hãy nhập ${label}.`;
    else if (value.length > max) errors[key] = `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max} ký tự.`;
    return value;
  };

  // Câu có chỗ trống: "___" hoặc "_" gõ bằng bàn phím được đổi thành dấu ＿
  const blankStem = () => {
    const value = clean(fields.stem).replace(/_+/g, BLANK);
    if (!value) errors.stem = `Bạn hãy nhập câu có chỗ trống (dùng dấu ${BLANK} hoặc _).`;
    else if (!value.includes(BLANK)) errors.stem = `Câu cần có chỗ trống, đánh dấu bằng ${BLANK} hoặc _.`;
    else if (value.length > L.stem) errors.stem = `Câu tối đa ${L.stem} ký tự.`;
    return value;
  };

  const choiceList = () => {
    const [min, max] = OPTION_RANGE[type] ?? [2, 6];
    // Bỏ các ô trống ở cuối (biểu mẫu để sẵn ô trống), giữ nguyên thứ tự
    const raw = fields.options.map((o) => clean(o));
    while (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();
    raw.forEach((option, i) => {
      if (!option) errors[`options.${i}`] = "Lựa chọn không được để trống.";
      else if (option.length > L.option) errors[`options.${i}`] = `Tối đa ${L.option} ký tự.`;
    });
    if (raw.length < min || raw.length > max) {
      errors.options = min === max ? `Dạng câu này cần đúng ${min} lựa chọn.` : `Dạng câu này cần từ ${min} đến ${max} lựa chọn.`;
    } else if (new Set(raw.map((o) => normalizeForCompare(o))).size !== raw.length) {
      errors.options = "Có hai lựa chọn trùng nhau.";
    }
    return raw;
  };

  const indexAnswer = (count: number): QuestionAnswer => {
    const index = fields.answerIndex;
    if (index === null || index < 0 || index >= count) errors.answer = "Bạn hãy chọn đáp án đúng.";
    return { index: index ?? 0 };
  };

  switch (type) {
    case "vocab_meaning": {
      const stem = text("stem", "từ cần hỏi", L.stem);
      const pinyin = normalizePinyin(clean(fields.pinyin));
      if (!pinyin) errors.pinyin = "Bạn hãy nhập pinyin.";
      else if (pinyin.length > L.pinyin) errors.pinyin = `Pinyin tối đa ${L.pinyin} ký tự.`;
      const opts = choiceList();
      return { content: { stem, pinyin, options: opts }, answer: indexAnswer(opts.length) };
    }
    case "grammar_fill": {
      const stem = blankStem();
      const pinyin = normalizePinyin(clean(fields.pinyin));
      if (pinyin.length > L.pinyin) errors.pinyin = `Pinyin tối đa ${L.pinyin} ký tự.`;
      const opts = choiceList();
      const content: QuestionContent<"grammar_fill"> = pinyin ? { stem, pinyin, options: opts } : { stem, options: opts };
      return { content, answer: indexAnswer(opts.length) };
    }
    case "listening_picture": {
      const images = Array.from({ length: PICTURE_COUNT }, (_, i) => fields.images[i] ?? null);
      if (options.requireImages && images.some((img) => !img)) {
        errors.images = `Cần đủ ${PICTURE_COUNT} ảnh. Câu chưa đủ ảnh chỉ lưu được ở trạng thái Ngừng dùng.`;
      }
      return { content: { images }, answer: indexAnswer(PICTURE_COUNT) };
    }
    case "listening_true_false": {
      const statement = text("stem", "câu nhận định", L.stem);
      if (fields.answerValue === null) errors.answer = "Bạn hãy chọn Đúng hoặc Sai.";
      return { content: { statement }, answer: { value: fields.answerValue ?? false } };
    }
    case "listening_short_dialogue":
    case "listening_long_dialogue": {
      const question = text("question", "câu hỏi", L.question);
      const opts = choiceList();
      return { content: { question, options: opts }, answer: indexAnswer(opts.length) };
    }
    case "reading_match": {
      const stem = text("stem", "câu đề bài", L.stem);
      const opts = choiceList();
      return { content: { stem, options: opts }, answer: indexAnswer(opts.length) };
    }
    case "reading_fill_blank": {
      const stem = blankStem();
      const opts = choiceList();
      return { content: { stem, options: opts }, answer: indexAnswer(opts.length) };
    }
    case "reading_comprehension": {
      const passage = text("passage", "đoạn văn", L.passage, true);
      const question = text("question", "câu hỏi", L.question);
      const opts = choiceList();
      return { content: { passage, question, options: opts }, answer: indexAnswer(opts.length) };
    }
    case "writing_order": {
      const tokens = fields.tokens.map((t) => clean(t)).filter((t) => t !== "");
      const [min, max] = TOKEN_RANGE;
      if (tokens.length < min || tokens.length > max) errors.tokens = `Cần từ ${min} đến ${max} cụm.`;
      else if (tokens.some((t) => t.length > L.token)) errors.tokens = `Mỗi cụm tối đa ${L.token} ký tự.`;
      const sentence = clean(fields.answerText);
      if (!sentence) errors.answer = "Bạn hãy nhập câu hoàn chỉnh (đáp án).";
      else if (sentence.length > L.answerText) errors.answer = `Câu đáp án tối đa ${L.answerText} ký tự.`;
      else if (!errors.tokens && !sameCharacters(sentence, tokens.join(""))) {
        errors.answer = "Câu đáp án phải ghép đúng và đủ từ các cụm đã cho.";
      }
      return { content: { tokens }, answer: { sentence } };
    }
    case "writing_hanzi": {
      const stem = text("stem", "đề bài", L.stem);
      const answerText = clean(fields.answerText);
      if (!answerText) errors.answer = "Bạn hãy nhập chữ Hán đúng (đáp án).";
      else if (answerText.length > L.answerText) errors.answer = `Đáp án tối đa ${L.answerText} ký tự.`;
      return { content: { stem }, answer: { text: answerText } };
    }
  }
}

// Hai chuỗi có cùng các ký tự (không tính khoảng trắng, dấu câu), không quan tâm thứ tự
function sameCharacters(a: string, b: string): boolean {
  const sort = (s: string) => [...normalizeForCompare(s)].sort().join("");
  return sort(a) === sort(b);
}

export function validateQuestion(input: QuestionInput, lookups: QuestionLookups): QuestionValidation {
  const errors: QuestionErrors = {};

  if (!isQuestionType(input.type)) {
    return { values: null, errors: { type: "Bạn hãy chọn dạng câu." } };
  }
  const type = input.type;

  const levelId = Number(input.levelId);
  if (!lookups.levelIds.has(levelId)) errors.levelId = "Bạn hãy chọn cấp HSK.";
  const topicId = optionalId(input.topicId);
  if (topicId !== null && !lookups.topicIds.has(topicId)) errors.topicId = "Chủ đề không hợp lệ.";
  const grammarPointId = optionalId(input.grammarPointId);
  if (grammarPointId !== null && !lookups.grammarPointIds.has(grammarPointId)) {
    errors.grammarPointId = "Ngữ pháp không hợp lệ.";
  }

  const status: QuestionStatus = input.status === "inactive" ? "inactive" : "active";

  const explanation = cleanMultiline(input.explanation);
  if (explanation.length > QUESTION_LIMITS.explanation) {
    errors.explanation = `Giải thích tối đa ${QUESTION_LIMITS.explanation} ký tự.`;
  }

  // Câu nghe: máy đọc to audio_text; dạng khác không dùng cột này
  let audioText: string | null = null;
  if (isListening(type)) {
    audioText = cleanMultiline(input.audioText);
    if (!audioText) errors.audioText = "Câu nghe cần có lời đọc (audio_text).";
    else if (audioText.length > QUESTION_LIMITS.audioText) {
      errors.audioText = `Lời đọc tối đa ${QUESTION_LIMITS.audioText} ký tự.`;
    }
  }

  const fields = sanitizeFields(input.fields);
  const built = buildContent(type, fields, errors, { requireImages: status === "active" });

  if (Object.keys(errors).length > 0 || !built) return { values: null, errors };
  return {
    values: {
      question_type: type,
      skill: SKILL_OF_TYPE[type],
      level_id: levelId,
      topic_id: topicId,
      grammar_point_id: grammarPointId,
      content: built.content,
      answer: built.answer,
      explanation: explanation || null,
      audio_text: audioText,
      status,
    },
    errors: null,
  };
}
