// Bài test cho kiểm tra hợp lệ và chấm điểm 11 dạng câu hỏi (UC13). Chạy bằng lệnh: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeQuestion, hasResponse } from "./grade.ts";
import { importRowToFields, parseImportAnswer, parseQuestionType, QUESTION_IMPORT_COLUMNS, type QuestionImportRow } from "./import.ts";
import { QUESTION_TYPES, SKILL_OF_TYPE, type QuestionType, type QuestionWithAnswer } from "./types.ts";
import { tokenDisplayOrder } from "./token-order.ts";
import { EMPTY_FIELDS, fieldsFromQuestion, normalizeForCompare, validateQuestion, type QuestionFields } from "./validate.ts";

const LOOKUPS = { levelIds: new Set([1, 2, 3]), topicIds: new Set([5]), grammarPointIds: new Set([7]) };

function check(type: QuestionType, fields: Partial<QuestionFields>, extra: Record<string, unknown> = {}) {
  return validateQuestion(
    {
      type,
      levelId: 2,
      topicId: null,
      grammarPointId: null,
      status: "active",
      explanation: "",
      audioText: "",
      fields: { ...EMPTY_FIELDS, ...fields },
      ...extra,
    },
    LOOKUPS,
  );
}

const errorKeys = (result: ReturnType<typeof check>) => Object.keys(result.errors ?? {}).sort();

// Một câu hợp lệ cho mỗi dạng
const VALID: Record<QuestionType, [Partial<QuestionFields>, Record<string, unknown>?]> = {
  vocab_meaning: [{ stem: "机场", pinyin: "ji1chang3", options: ["sân bay", "nhà ga", "bến xe"], answerIndex: 0 }],
  grammar_fill: [{ stem: "我___作业做完了。", options: ["把", "被"], answerIndex: 0 }],
  listening_picture: [
    { images: ["https://x/a.png", "https://x/b.png", "https://x/c.png"], answerIndex: 2 },
    { audioText: "我在机场。" },
  ],
  listening_true_false: [{ stem: "他今天不上班。", answerValue: true }, { audioText: "我今天休息。" }],
  listening_short_dialogue: [
    { question: "男的去哪儿？", options: ["机场", "学校", "医院"], answerIndex: 0 },
    { audioText: "女：你去哪儿？男：我去机场。" },
  ],
  listening_long_dialogue: [
    { question: "他们几点见面？", options: ["八点", "九点", "十点"], answerIndex: 1 },
    { audioText: "……" },
  ],
  reading_match: [{ stem: "你好！", options: ["你好！", "谢谢！", "再见！"], answerIndex: 0 }],
  reading_fill_blank: [{ stem: "我想＿一杯茶。", options: ["喝", "吃", "看"], answerIndex: 0 }],
  reading_comprehension: [
    { passage: "小王每天坐地铁上班。", question: "小王怎么上班？", options: ["坐地铁", "开车", "走路"], answerIndex: 0 },
  ],
  writing_order: [{ tokens: ["我", "把作业", "做完了"], answerText: "我把作业做完了。" }],
  writing_hanzi: [{ stem: "fēi（ ）机", answerText: "飞" }],
};

test("mỗi dạng có một câu mẫu hợp lệ, cột skill suy ra đúng", () => {
  for (const type of QUESTION_TYPES) {
    const [fields, extra] = VALID[type];
    const result = check(type, fields, extra);
    assert.equal(result.errors, null, `${type}: ${JSON.stringify(result.errors)}`);
    assert.equal(result.values?.skill, SKILL_OF_TYPE[type]);
  }
});

test("vocab_meaning: pinyin số đổi sang dấu thanh, số lựa chọn 3–4", () => {
  const result = check("vocab_meaning", VALID.vocab_meaning[0]);
  assert.deepEqual(result.values?.content, { stem: "机场", pinyin: "jīchǎng", options: ["sân bay", "nhà ga", "bến xe"] });
  assert.deepEqual(errorKeys(check("vocab_meaning", { ...VALID.vocab_meaning[0], options: ["a", "b"] })), ["options"]);
});

test("ô lựa chọn trống ở cuối bị bỏ qua, ô trống ở giữa thì báo lỗi", () => {
  const ok = check("reading_match", { stem: "你好", options: ["a", "b", "c", "", ""], answerIndex: 1 });
  assert.equal(ok.errors, null);
  assert.deepEqual(errorKeys(check("reading_match", { stem: "你好", options: ["a", "", "c"], answerIndex: 0 })), ["options.1"]);
});

test("đáp án phải nằm trong số lựa chọn; lựa chọn không được trùng", () => {
  assert.deepEqual(errorKeys(check("reading_match", { stem: "x", options: ["a", "b", "c"], answerIndex: 3 })), ["answer"]);
  assert.deepEqual(errorKeys(check("reading_match", { stem: "x", options: ["a", "b", "A"], answerIndex: 0 })), ["options"]);
});

test("câu điền chỗ trống: dấu _ được đổi thành ＿, thiếu chỗ trống thì báo lỗi", () => {
  const result = check("grammar_fill", VALID.grammar_fill[0]);
  assert.equal((result.values?.content as { stem: string }).stem, "我＿作业做完了。");
  assert.deepEqual(errorKeys(check("reading_fill_blank", { stem: "我想喝茶。", options: ["a", "b", "c"], answerIndex: 0 })), ["stem"]);
});

test("câu nghe bắt buộc có audio_text; dạng khác thì audio_text luôn là null", () => {
  assert.deepEqual(errorKeys(check("listening_true_false", { stem: "x", answerValue: false })), ["audioText"]);
  assert.equal(check("reading_match", VALID.reading_match[0], { audioText: "abc" }).values?.audio_text, null);
});

test("nghe chọn tranh: thiếu ảnh chỉ lưu được ở trạng thái Ngừng dùng", () => {
  const fields = { images: ["https://x/a.png", null, null], answerIndex: 0 };
  assert.deepEqual(errorKeys(check("listening_picture", fields, { audioText: "x" })), ["images"]);
  assert.equal(check("listening_picture", fields, { audioText: "x", status: "inactive" }).errors, null);
});

test("sắp xếp câu: 3–8 cụm, câu đáp án phải ghép đúng từ các cụm", () => {
  assert.deepEqual(errorKeys(check("writing_order", { tokens: ["我", "好"], answerText: "我好" })), ["tokens"]);
  assert.deepEqual(errorKeys(check("writing_order", { tokens: ["我", "把作业", "做完了"], answerText: "我做完作业了。" })), [
    "answer",
  ]);
});

test("cấp, chủ đề, ngữ pháp phải có trong danh sách", () => {
  const result = check("writing_hanzi", VALID.writing_hanzi[0], { levelId: 9, topicId: 99, grammarPointId: 7 });
  assert.deepEqual(errorKeys(result), ["levelId", "topicId"]);
});

test("dạng câu lạ thì báo lỗi", () => {
  assert.deepEqual(errorKeys(check("abc" as QuestionType, {})), ["type"]);
});

test("mở lại câu đã lưu trong biểu mẫu rồi lưu lại vẫn ra đúng dữ liệu cũ", () => {
  for (const type of QUESTION_TYPES) {
    const [fields, extra] = VALID[type];
    const first = check(type, fields, extra).values!;
    const again = check(type, fieldsFromQuestion(type, first.content, first.answer), extra).values!;
    assert.deepEqual(again.content, first.content, type);
    assert.deepEqual(again.answer, first.answer, type);
  }
});

// ---------------------------------------------------------------------
// Chấm điểm
// ---------------------------------------------------------------------

const choice: QuestionWithAnswer = {
  type: "reading_match",
  content: { stem: "x", options: ["a", "b", "c"] },
  answer: { index: 1 },
};
const trueFalse: QuestionWithAnswer = { type: "listening_true_false", content: { statement: "x" }, answer: { value: false } };
const order: QuestionWithAnswer = {
  type: "writing_order",
  content: { tokens: ["做完了", "我", "把作业"] },
  answer: { sentence: "我把作业做完了。" },
};
const hanzi: QuestionWithAnswer = { type: "writing_hanzi", content: { stem: "fēi（ ）机" }, answer: { text: "飞" } };

test("chọn đáp án: đúng khi chọn đúng chỉ số", () => {
  assert.equal(gradeQuestion(choice, { index: 1 }), true);
  assert.equal(gradeQuestion(choice, { index: 0 }), false);
  assert.equal(gradeQuestion(choice, { index: "1" }), false);
  assert.equal(gradeQuestion(choice, null), false);
});

test("đúng / sai", () => {
  assert.equal(gradeQuestion(trueFalse, { value: false }), true);
  assert.equal(gradeQuestion(trueFalse, { value: true }), false);
  assert.equal(gradeQuestion(trueFalse, { index: 0 }), false);
});

test("sắp xếp câu: so sánh sau khi bỏ khoảng trắng và dấu câu", () => {
  assert.equal(gradeQuestion(order, { order: [1, 2, 0] }), true); // 我 把作业 做完了 (đáp án có dấu 。)
  assert.equal(gradeQuestion(order, { order: [2, 1, 0] }), false);
  assert.equal(gradeQuestion(order, { order: [1, 1, 0] }), false); // dùng một cụm hai lần
  assert.equal(gradeQuestion(order, { order: [1, 2] }), false); // chưa ghép hết
});

test("điền chữ Hán: bỏ khoảng trắng và dấu câu, để trống là sai", () => {
  assert.equal(gradeQuestion(hanzi, { text: " 飞。" }), true);
  assert.equal(gradeQuestion(hanzi, { text: "非" }), false);
  assert.equal(gradeQuestion({ ...hanzi, answer: { text: "。" } }, { text: "" }), false);
});

test("hasResponse: biết khi nào học viên đã trả lời xong", () => {
  assert.equal(hasResponse(order, { order: [1, 2] }), false);
  assert.equal(hasResponse(order, { order: [1, 2, 0] }), true);
  assert.equal(hasResponse(hanzi, { text: "  " }), false);
  assert.equal(hasResponse(choice, { index: 0 }), true);
});

test("normalizeForCompare bỏ dấu câu toàn khổ của tiếng Trung", () => {
  assert.equal(normalizeForCompare("我，把 作业！做完了？"), "我把作业做完了");
});

// ---------------------------------------------------------------------
// Import Excel
// ---------------------------------------------------------------------


function importRow(values: Partial<Record<(typeof QUESTION_IMPORT_COLUMNS)[number], string>>): QuestionImportRow {
  const row = { row: 2 } as QuestionImportRow;
  for (const c of QUESTION_IMPORT_COLUMNS) row[c] = values[c] ?? "";
  return row;
}

test("import: cột type nhận mã dạng câu hoặc tên tiếng Việt", () => {
  assert.equal(parseQuestionType(" Vocab_Meaning "), "vocab_meaning");
  assert.equal(parseQuestionType("đọc hiểu"), "reading_comprehension");
  assert.equal(parseQuestionType("abc"), null);
});

test("import: cột answer đọc theo dạng câu", () => {
  assert.deepEqual(parseImportAnswer("reading_match", "c"), { fields: { answerIndex: 2, answerValue: null, answerText: "" } });
  assert.ok("error" in parseImportAnswer("reading_match", "G"));
  assert.deepEqual(parseImportAnswer("listening_true_false", "Sai"), {
    fields: { answerIndex: null, answerValue: false, answerText: "" },
  });
  assert.ok("error" in parseImportAnswer("listening_true_false", "Có"));
  assert.deepEqual(parseImportAnswer("writing_hanzi", " 飞 "), { fields: { answerIndex: null, answerValue: null, answerText: "飞" } });
});

test("import: sắp xếp câu lấy các cụm từ cột stem, cách nhau bởi |", () => {
  const row = importRow({ stem: "我 | 把作业 | 做完了", answer: "我把作业做完了。" });
  const answer = parseImportAnswer("writing_order", row.answer);
  assert.ok("fields" in answer);
  const result = check("writing_order", { ...importRowToFields("writing_order", row), ...answer.fields });
  assert.deepEqual(result.values?.content, { tokens: ["我", "把作业", "做完了"] });
});

test("import: lựa chọn lấy từ option_a … option_f, bỏ cột trống ở cuối", () => {
  const fields = importRowToFields("reading_match", importRow({ stem: "x", option_a: "a", option_b: "b", option_c: "c" }));
  assert.deepEqual(fields.options, ["a", "b", "c"]);
});

test("tokenDisplayOrder: xáo cố định, đủ các cụm, không giữ nguyên thứ tự đã nhập", () => {
  const samples = [
    ["我", "把作业", "做完了"],
    ["他", "昨天", "去", "北京", "了"],
    ["a", "b"],
    ["的", "的", "书"],
    ["一", "二", "三", "四", "五", "六", "七", "八"],
  ];
  for (const tokens of samples) {
    const order = tokenDisplayOrder(tokens);
    assert.deepEqual([...order].sort((x, y) => x - y), tokens.map((_, i) => i), "phải đủ mỗi cụm một lần");
    assert.notDeepEqual(order.map((i) => tokens[i]), tokens, `không được giữ nguyên thứ tự: ${tokens.join(" ")}`);
    assert.deepEqual(tokenDisplayOrder([...tokens]), order, "cùng các cụm thì cùng thứ tự");
  }
  // Mọi cụm giống nhau thì không xáo được, giữ nguyên
  assert.deepEqual(tokenDisplayOrder(["好", "好", "好"]).map((i) => ["好", "好", "好"][i]), ["好", "好", "好"]);
});
