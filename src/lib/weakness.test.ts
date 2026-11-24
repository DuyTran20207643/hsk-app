import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  analyzeWeaknesses,
  combinedCorrectRate,
  countsAsWrong,
  groupStats,
  parseWeaknessKey,
  recentAnswers,
  toAnswerRecords,
  weaknessKey,
  type AnswerRecord,
} from "./weakness.ts";

const NOW = new Date("2026-11-24T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function record(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    answeredAt: daysAgo(1),
    isCorrect: true,
    isFlagged: false,
    levelId: 3,
    questionType: "vocab_meaning",
    topicId: null,
    grammarPointId: null,
    ...overrides,
  };
}

/** n câu trả lời giống nhau */
const many = (n: number, overrides: Partial<AnswerRecord> = {}) => Array.from({ length: n }, () => record(overrides));

/** Đủ 20 câu để được phân tích: đệm thêm câu đúng của một dạng khác */
const padding = (n: number) => many(n, { questionType: "reading_comprehension" });

const typeGroup = (records: AnswerRecord[], type: string) =>
  groupStats(records).find((g) => g.key === `type:${type}`);

describe("weakness: câu tính là sai", () => {
  test("sai thì tính là sai, đúng thì không", () => {
    assert.equal(countsAsWrong({ isCorrect: false, isFlagged: false }), true);
    assert.equal(countsAsWrong({ isCorrect: true, isFlagged: false }), false);
  });

  test("đúng nhưng đánh dấu Chưa chắc chắn tính là sai", () => {
    assert.equal(countsAsWrong({ isCorrect: true, isFlagged: true }), true);
    // 5 câu đúng hết, nhưng 2 câu chưa chắc → sai 40% → điểm yếu
    const records = [...many(3), ...many(2, { isFlagged: true })];
    const g = typeGroup(records, "vocab_meaning");
    assert.equal(g?.wrong, 2);
    assert.equal(g?.wrongRate, 0.4);
    assert.equal(g?.isWeak, true);
  });
});

describe("weakness: ngưỡng 5 câu", () => {
  test("4 câu sai cả 4 vẫn chưa phải điểm yếu", () => {
    const g = typeGroup(many(4, { isCorrect: false }), "vocab_meaning");
    assert.equal(g?.wrongRate, 1);
    assert.equal(g?.isWeak, false);
  });

  test("đủ 5 câu và sai từ 30% trở lên thì là điểm yếu", () => {
    const records = [...many(3), ...many(2, { isCorrect: false })];
    assert.equal(typeGroup(records, "vocab_meaning")?.isWeak, true);
  });
});

describe("weakness: ngưỡng 30%", () => {
  test("sai đúng 30% là điểm yếu", () => {
    const records = [...many(7), ...many(3, { isCorrect: false })];
    const g = typeGroup(records, "vocab_meaning");
    assert.equal(g?.wrongRate, 0.3);
    assert.equal(g?.isWeak, true);
  });

  test("sai dưới 30% không phải điểm yếu", () => {
    // 2 / 7 ≈ 28,6%
    const records = [...many(5), ...many(2, { isCorrect: false })];
    assert.equal(typeGroup(records, "vocab_meaning")?.isWeak, false);
  });
});

describe("weakness: chỉ lấy 30 ngày gần nhất", () => {
  test("câu cũ hơn 30 ngày bị bỏ, câu trong 30 ngày được giữ", () => {
    const records = [
      record({ answeredAt: daysAgo(29.9) }),
      record({ answeredAt: daysAgo(30) }),
      record({ answeredAt: daysAgo(30.1) }),
      record({ answeredAt: daysAgo(90) }),
    ];
    assert.equal(recentAnswers(records, 3, NOW).length, 2);
  });

  test("câu sai cũ không làm thành điểm yếu", () => {
    const old = many(10, { isCorrect: false, answeredAt: daysAgo(40) });
    const recent = [...many(5), ...padding(15)];
    const report = analyzeWeaknesses([...old, ...recent], 3, NOW);
    assert.equal(report.status, "ok");
    assert.equal(report.status === "ok" && report.weaknesses.length, 0);
  });

  test("chỉ lấy cấp đang xét và câu đã chấm", () => {
    const records = [record(), record({ levelId: 2 }), record({ isCorrect: null })];
    assert.equal(recentAnswers(records, 3, NOW).length, 1);
  });
});

describe("weakness: phân tích", () => {
  test("dưới 20 câu trả lời thì chưa đủ dữ liệu", () => {
    const report = analyzeWeaknesses(many(19, { isCorrect: false }), 3, NOW);
    assert.equal(report.status, "not_enough_data");
    assert.equal(report.answered, 19);
  });

  test("gom theo dạng câu, chủ đề và ngữ pháp; nặng nhất lên trước", () => {
    const records = [
      // writing_order: sai 4/5 = 80%
      ...many(1, { questionType: "writing_order" }),
      ...many(4, { questionType: "writing_order", isCorrect: false }),
      // chủ đề 7 (câu vocab_meaning): sai 3/6 = 50%, nên dạng vocab_meaning cũng sai 50%
      ...many(3, { topicId: 7 }),
      ...many(3, { topicId: 7, isCorrect: false }),
      // ngữ pháp 2: sai 2/5 = 40%
      ...many(3, { grammarPointId: 2, questionType: "grammar_fill" }),
      ...many(2, { grammarPointId: 2, questionType: "grammar_fill", isCorrect: false }),
      ...padding(5),
    ];
    const report = analyzeWeaknesses(records, 3, NOW);
    assert.equal(report.status, "ok");
    if (report.status !== "ok") return;
    assert.deepEqual(
      report.weaknesses.map((w) => w.key),
      ["type:writing_order", "type:vocab_meaning", "topic:7", "type:grammar_fill", "grammar:2"],
    );
  });

  test("tỷ lệ đúng gộp nhiều nhóm: mỗi câu trả lời tính một lần", () => {
    const records = [
      record({ topicId: 7, grammarPointId: 2 }),
      record({ topicId: 7, isCorrect: false }),
      record({ grammarPointId: 2, isFlagged: true }),
      record({ topicId: 1 }),
    ];
    const rate = combinedCorrectRate(records, [
      { kind: "topic", value: 7 },
      { kind: "grammar", value: 2 },
    ]);
    assert.equal(rate, 1 / 3);
    assert.equal(combinedCorrectRate(records, [{ kind: "topic", value: 99 }]), null);
  });
});

describe("weakness: khóa nhóm", () => {
  test("đổi qua lại giữa nhóm và chuỗi", () => {
    assert.equal(weaknessKey({ kind: "type", value: "writing_order" }), "type:writing_order");
    assert.deepEqual(parseWeaknessKey("topic:12"), { kind: "topic", value: 12 });
    assert.deepEqual(parseWeaknessKey("grammar:3"), { kind: "grammar", value: 3 });
    assert.deepEqual(parseWeaknessKey("type:writing_order"), { kind: "type", value: "writing_order" });
  });

  test("chuỗi sai dạng thì null", () => {
    for (const bad of ["", "type:abc", "topic:0", "topic:-1", "topic:1.5", "grammar:x", "level:1", "topic:1:2", null, 3]) {
      assert.equal(parseWeaknessKey(bad), null, String(bad));
    }
  });
});

describe("weakness: đọc dữ liệu từ database", () => {
  test("bỏ câu của bài thi chưa nộp và dòng thiếu câu hỏi", () => {
    const question = { level_id: 3, question_type: "writing_hanzi", topic_id: 4, grammar_point_id: null };
    const rows = [
      { is_correct: true, is_flagged: false, answered_at: daysAgo(1), attempts: { status: "in_progress", config: { feedback: "immediate" } }, questions: question },
      { is_correct: true, is_flagged: false, answered_at: daysAgo(1), attempts: { status: "in_progress", config: { feedback: "deferred" } }, questions: question },
      { is_correct: false, is_flagged: false, answered_at: daysAgo(1), attempts: { status: "submitted", config: { feedback: "deferred" } }, questions: question },
      { is_correct: true, is_flagged: false, answered_at: daysAgo(1), attempts: { status: "submitted", config: {} }, questions: null },
    ];
    const records = toAnswerRecords(rows);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], {
      answeredAt: daysAgo(1),
      isCorrect: true,
      isFlagged: false,
      levelId: 3,
      questionType: "writing_hanzi",
      topicId: 4,
      grammarPointId: null,
    });
  });
});
