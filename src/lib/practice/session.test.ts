import assert from "node:assert/strict";
import { test } from "node:test";
import { firstUnanswered, summarize, toAnswerResult, toSessionView, toUserResponse } from "./session.ts";

const raw = {
  id: "attempt-1",
  attempt_type: "mixed",
  status: "in_progress",
  config: { mode: "mixed", feedback: "immediate", level_id: 3, tag: "dev" },
  started_at: "2026-11-19T01:00:00Z",
  submitted_at: null,
  correct_count: null,
  questions: [
    {
      id: "q1",
      type: "vocab_meaning",
      skill: "vocabulary",
      level_id: 3,
      content: { stem: "机场", pinyin: "jīchǎng", options: ["sân bay", "nhà ga", "bến xe"] },
      audio_text: null,
      result: { user_answer: { index: 1 }, is_flagged: true, is_correct: false, answer: { index: 0 }, explanation: "Giải thích" },
    },
    {
      id: "q2",
      type: "writing_hanzi",
      skill: "writing",
      level_id: 3,
      content: { stem: "fēi（飞）机" },
      audio_text: null,
      result: null,
    },
    { id: "q3", type: "khong_co", skill: "writing", content: {}, result: null },
  ],
};

test("toSessionView đọc kết quả get_attempt, bỏ câu sai dạng", () => {
  const view = toSessionView(raw);
  assert.ok(view);
  assert.equal(view.mode, "mixed");
  assert.equal(view.levelId, 3);
  assert.equal(view.tag, "dev");
  assert.equal(view.questions.length, 2);
  assert.deepEqual(view.questions[0].result, {
    userAnswer: { index: 1 },
    isFlagged: true,
    isCorrect: false,
    answer: { index: 0 },
    explanation: "Giải thích",
  });
  assert.equal(view.questions[1].result, null);
  assert.equal(view.questions[1].question.type, "writing_hanzi");
  assert.equal(toSessionView(null), null);
  assert.equal(toSessionView({ id: 1 }), null);
});

test("toUserResponse chỉ nhận đúng 4 dạng câu trả lời", () => {
  assert.deepEqual(toUserResponse({ index: 2 }), { index: 2 });
  assert.deepEqual(toUserResponse({ value: false }), { value: false });
  assert.deepEqual(toUserResponse({ order: [2, 0, 1] }), { order: [2, 0, 1] });
  assert.deepEqual(toUserResponse({ text: "飞" }), { text: "飞" });
  assert.equal(toUserResponse({ index: "2" }), null);
  assert.equal(toUserResponse({ order: ["a"] }), null);
  assert.equal(toUserResponse([1]), null);
});

test("toAnswerResult: phiên chưa hiện đáp án thì isCorrect / answer là null", () => {
  assert.deepEqual(toAnswerResult({ user_answer: { index: 0 }, is_flagged: false, saved: true }), {
    userAnswer: { index: 0 },
    isFlagged: false,
    isCorrect: null,
    answer: null,
    explanation: null,
  });
});

test("firstUnanswered và summarize", () => {
  const ok = { userAnswer: null, isFlagged: false, isCorrect: true, answer: null, explanation: null };
  const unsure = { ...ok, isCorrect: true, isFlagged: true };
  const wrong = { ...ok, isCorrect: false };
  assert.equal(firstUnanswered([{ result: ok }, { result: null }, { result: null }]), 1);
  assert.equal(firstUnanswered([{ result: ok }, { result: wrong }]), 2);
  assert.equal(firstUnanswered([]), 0);
  assert.deepEqual(summarize([{ result: ok }, { result: unsure }, { result: wrong }, { result: null }]), {
    total: 4,
    answered: 3,
    correct: 2,
    wrong: 1,
    flagged: 1,
  });
});
