// Bài test cho kiểm tra dữ liệu ngữ pháp và tỷ lệ đúng (UC18, UC19, BR10). Chạy bằng lệnh: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseExamples, validateGrammarPoint } from "./grammar-input.ts";
import { computeGrammarStats, statsLabel } from "./stats.ts";

const LEVELS = new Set([1, 2, 3]);
const VALID = {
  levelId: 3,
  title: "  Mẫu câu với 把   (câu chữ 把) ",
  structure: "A + 把 + B + V + thành phần khác",
  explanation: "Nhấn mạnh tác động của hành động lên đối tượng B.",
  examples: [{ zh: "请把门关上。", pinyin: "Qing3 ba3 men2 guan1shang.", vi: "Hãy đóng cửa lại." }],
  isPublished: true,
};

test("dữ liệu hợp lệ: bỏ khoảng trắng thừa, pinyin số đổi sang dấu thanh", () => {
  const result = validateGrammarPoint(VALID, LEVELS);
  assert.equal(result.errors, null);
  assert.equal(result.values?.title, "Mẫu câu với 把 (câu chữ 把)");
  assert.equal(result.values?.examples[0].pinyin, "Qǐng bǎ mén guānshang.");
  assert.equal(result.values?.is_published, true);
});

test("thiếu tên, cấu trúc, giải thích hoặc cấp thì báo lỗi đúng ô", () => {
  const result = validateGrammarPoint({ ...VALID, levelId: 9, title: "", structure: " ", explanation: "" }, LEVELS);
  assert.deepEqual(Object.keys(result.errors ?? {}).sort(), ["explanation", "levelId", "structure", "title"]);
});

test("cần tối thiểu 1 câu ví dụ, mỗi câu đủ chữ Hán, pinyin, nghĩa", () => {
  assert.ok(validateGrammarPoint({ ...VALID, examples: [] }, LEVELS).errors?.examples);
  const result = validateGrammarPoint({ ...VALID, examples: [{ zh: "我把作业做完了。", pinyin: "", vi: "" }] }, LEVELS);
  assert.deepEqual(Object.keys(result.errors ?? {}).sort(), ["examples.0.pinyin", "examples.0.vi"]);
});

test("isPublished chỉ nhận đúng giá trị true", () => {
  assert.equal(validateGrammarPoint({ ...VALID, isPublished: "true" }, LEVELS).values?.is_published, false);
});

test("đọc câu ví dụ từ jsonb: bỏ phần tử sai dạng", () => {
  assert.deepEqual(parseExamples([{ zh: "你好", pinyin: "nǐ hǎo", vi: "xin chào" }, null, "x", { pinyin: "a" }]), [
    { zh: "你好", pinyin: "nǐ hǎo", vi: "xin chào" },
  ]);
  assert.deepEqual(parseExamples(null), []);
});

const ok = { is_correct: true, is_flagged: false };
const unsure = { is_correct: true, is_flagged: true };
const wrong = { is_correct: false, is_flagged: false };

test("chưa có câu trả lời đã chấm thì là Chưa luyện", () => {
  assert.equal(computeGrammarStats([]), null);
  assert.equal(computeGrammarStats([{ is_correct: null, is_flagged: false }]), null);
  assert.equal(statsLabel(null), "Chưa luyện");
});

test("đúng nhưng đánh dấu chưa chắc thì tính là sai", () => {
  const stats = computeGrammarStats([ok, ok, unsure]);
  assert.equal(stats?.correct, 2);
  assert.equal(statsLabel(stats), "Đúng 2 / 3 câu");
});

test("BR10: sai từ 30% và có từ 5 câu trở lên là điểm yếu", () => {
  // 5 câu, sai 2 (40%) → điểm yếu
  assert.equal(computeGrammarStats([ok, ok, ok, wrong, unsure])?.isWeak, true);
  // 10 câu, sai 3 (đúng 30%) → điểm yếu
  assert.equal(computeGrammarStats([...Array(7).fill(ok), wrong, wrong, wrong])?.isWeak, true);
  // 5 câu, sai 1 (20%) → chưa phải điểm yếu
  assert.equal(computeGrammarStats([ok, ok, ok, ok, wrong])?.isWeak, false);
  // 4 câu sai hết nhưng chưa đủ 5 câu → chưa kết luận
  assert.equal(computeGrammarStats([wrong, wrong, wrong, wrong])?.isWeak, false);
});
