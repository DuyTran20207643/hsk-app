// Danh sách tình huống chấm điểm DÙNG CHUNG cho hai bản logic chấm:
//   - grade.ts (TypeScript, nút "Thử trả lời" ở trang quản trị)
//   - hàm SQL public.grade_answer() (migration 0009, chấm thật cho học viên)
// grading.test.ts chạy từng tình huống qua cả hai bản và so với `expected`.
// Thêm tình huống mới ở đây là cả hai bản cùng được kiểm tra.
import type { QuestionWithAnswer } from "./types.ts";

export type GradingCase = {
  name: string;
  question: QuestionWithAnswer;
  /** Câu trả lời học viên gửi lên (chưa tin được: có thể sai dạng) */
  response: unknown;
  expected: boolean;
};

const vocab: QuestionWithAnswer = {
  type: "vocab_meaning",
  content: { stem: "机场", pinyin: "jīchǎng", options: ["sân bay", "nhà ga", "bến xe", "khách sạn"] },
  answer: { index: 0 },
};
const grammar: QuestionWithAnswer = {
  type: "grammar_fill",
  content: { stem: "我＿作业做完了。", options: ["把", "被", "给"] },
  answer: { index: 0 },
};
const picture: QuestionWithAnswer = {
  type: "listening_picture",
  content: { images: ["https://example.test/a.png", "https://example.test/b.png", "https://example.test/c.png"] },
  answer: { index: 2 },
};
const trueFalse: QuestionWithAnswer = {
  type: "listening_true_false",
  content: { statement: "他明天去北京。" },
  answer: { value: false },
};
const shortDialogue: QuestionWithAnswer = {
  type: "listening_short_dialogue",
  content: { question: "男的去哪儿？", options: ["机场", "学校", "医院"] },
  answer: { index: 0 },
};
const longDialogue: QuestionWithAnswer = {
  type: "listening_long_dialogue",
  content: { question: "他们几点见面？", options: ["八点", "九点", "十点"] },
  answer: { index: 1 },
};
const match: QuestionWithAnswer = {
  type: "reading_match",
  content: { stem: "你今天怎么没来上课？", options: ["我生病了。", "我很喜欢。", "在图书馆。"] },
  answer: { index: 0 },
};
const fillBlank: QuestionWithAnswer = {
  type: "reading_fill_blank",
  content: { stem: "这件衣服太＿了。", options: ["贵", "高", "远", "快"] },
  answer: { index: 0 },
};
const comprehension: QuestionWithAnswer = {
  type: "reading_comprehension",
  content: { passage: "小王每天早上六点起床，然后去跑步。", question: "小王早上做什么？", options: ["跑步", "游泳", "看书"] },
  answer: { index: 0 },
};
const order: QuestionWithAnswer = {
  type: "writing_order",
  content: { tokens: ["我", "把作业", "做完了"] },
  answer: { sentence: "我把作业做完了。" },
};
const hanzi: QuestionWithAnswer = {
  type: "writing_hanzi",
  content: { stem: "fēi（飞）机" },
  answer: { text: "飞" },
};

export const GRADING_CASES: GradingCase[] = [
  // --- Chọn nghĩa của từ
  { name: "vocab_meaning: chọn đúng", question: vocab, response: { index: 0 }, expected: true },
  { name: "vocab_meaning: chọn sai", question: vocab, response: { index: 2 }, expected: false },
  { name: "vocab_meaning: index là chuỗi \"0\" thì sai", question: vocab, response: { index: "0" }, expected: false },
  { name: "vocab_meaning: index số lẻ 0.5 thì sai", question: vocab, response: { index: 0.5 }, expected: false },

  // --- Điền ngữ pháp
  { name: "grammar_fill: chọn đúng", question: grammar, response: { index: 0 }, expected: true },
  { name: "grammar_fill: chọn sai", question: grammar, response: { index: 1 }, expected: false },

  // --- Nghe – chọn tranh
  { name: "listening_picture: chọn đúng tranh C", question: picture, response: { index: 2 }, expected: true },
  { name: "listening_picture: chọn sai tranh A", question: picture, response: { index: 0 }, expected: false },

  // --- Nghe – đúng / sai
  { name: "listening_true_false: trả lời Sai là đúng", question: trueFalse, response: { value: false }, expected: true },
  { name: "listening_true_false: trả lời Đúng là sai", question: trueFalse, response: { value: true }, expected: false },
  { name: "listening_true_false: chuỗi \"false\" thì sai", question: trueFalse, response: { value: "false" }, expected: false },
  { name: "listening_true_false: gửi index thay vì value thì sai", question: trueFalse, response: { index: 1 }, expected: false },

  // --- Nghe – hội thoại ngắn / dài
  { name: "listening_short_dialogue: chọn đúng", question: shortDialogue, response: { index: 0 }, expected: true },
  { name: "listening_short_dialogue: chọn sai", question: shortDialogue, response: { index: 1 }, expected: false },
  { name: "listening_long_dialogue: chọn đúng", question: longDialogue, response: { index: 1 }, expected: true },
  { name: "listening_long_dialogue: chọn sai", question: longDialogue, response: { index: 2 }, expected: false },

  // --- Đọc
  { name: "reading_match: chọn đúng", question: match, response: { index: 0 }, expected: true },
  { name: "reading_match: chọn sai", question: match, response: { index: 2 }, expected: false },
  { name: "reading_fill_blank: chọn đúng", question: fillBlank, response: { index: 0 }, expected: true },
  { name: "reading_fill_blank: chọn sai", question: fillBlank, response: { index: 3 }, expected: false },
  { name: "reading_comprehension: chọn đúng", question: comprehension, response: { index: 0 }, expected: true },
  { name: "reading_comprehension: chọn sai", question: comprehension, response: { index: 1 }, expected: false },

  // --- Viết – sắp xếp câu
  { name: "writing_order: ghép đúng thứ tự", question: order, response: { order: [0, 1, 2] }, expected: true },
  { name: "writing_order: ghép sai thứ tự", question: order, response: { order: [1, 0, 2] }, expected: false },
  { name: "writing_order: dùng một cụm hai lần thì sai", question: order, response: { order: [0, 0, 2] }, expected: false },
  { name: "writing_order: thiếu cụm thì sai", question: order, response: { order: [0, 1] }, expected: false },
  { name: "writing_order: số thứ tự vượt quá số cụm thì sai", question: order, response: { order: [0, 1, 3] }, expected: false },
  { name: "writing_order: số thứ tự âm thì sai", question: order, response: { order: [0, -1, 2] }, expected: false },
  { name: "writing_order: số thứ tự là chuỗi thì sai", question: order, response: { order: ["0", "1", "2"] }, expected: false },
  { name: "writing_order: order không phải mảng thì sai", question: order, response: { order: "012" }, expected: false },

  // --- Viết – điền chữ Hán
  { name: "writing_hanzi: viết đúng", question: hanzi, response: { text: "飞" }, expected: true },
  { name: "writing_hanzi: viết sai", question: hanzi, response: { text: "非" }, expected: false },
  { name: "writing_hanzi: thừa khoảng trắng toàn khổ và dấu câu vẫn đúng", question: hanzi, response: { text: "　飞。" }, expected: true },
  { name: "writing_hanzi: chỉ có dấu câu và khoảng trắng thì sai", question: hanzi, response: { text: " ，。 " }, expected: false },
  { name: "writing_hanzi: để trống thì sai", question: hanzi, response: { text: "" }, expected: false },
  { name: "writing_hanzi: text là số thì sai", question: hanzi, response: { text: 1 }, expected: false },

  // --- Câu trả lời sai dạng (mọi dạng câu)
  { name: "câu trả lời null thì sai", question: vocab, response: null, expected: false },
  { name: "câu trả lời là mảng thì sai", question: vocab, response: [0], expected: false },
  { name: "câu trả lời là số thì sai", question: vocab, response: 0, expected: false },
  { name: "câu trả lời là object rỗng thì sai", question: hanzi, response: {}, expected: false },
];

/** Các cặp (chuỗi gốc, kết quả sau chuẩn hóa) kiểm tra hàm bỏ dấu câu của cả hai bản */
export const NORMALIZE_CASES: [string, string][] = [
  ["我，把 作业！做完了？", "我把作业做完了"],
  ["「你好」《汉语》", "你好汉语"],
  ["　飞 机\t", "飞机"],
  ["ABC xyz", "abcxyz"],
  ["Ｈello", "Ｈello"], // chữ Latin toàn khổ giữ nguyên (không đổi chữ thường)
  ["一二三123", "一二三123"],
  ["é", "é"], // dạng tách dấu được gộp lại (NFC)
  ["", ""],
];
