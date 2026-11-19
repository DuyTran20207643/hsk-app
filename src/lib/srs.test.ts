import assert from "node:assert/strict";
import { test } from "node:test";
import { isMastered, RATING_QUALITY, scheduleReview, sm2 } from "./srs.ts";

const NEW_CARD = { ease_factor: 2.5, interval_days: 0, repetitions: 0 };

test("BR04: đổi mức đánh giá sang điểm q", () => {
  assert.deepEqual(RATING_QUALITY, { again: 1, hard: 3, good: 4, easy: 5 });
});

test("thẻ mới chọn Nhớ: ôn lại sau 1 ngày, hệ số dễ giữ nguyên", () => {
  const next = scheduleReview(NEW_CARD, "good", "2026-11-14");
  assert.deepEqual(next, { ease_factor: 2.5, interval_days: 1, repetitions: 1, due_date: "2026-11-15" });
});

test("lần đúng thứ hai: ôn lại sau 6 ngày", () => {
  const next = sm2({ ease_factor: 2.5, interval_days: 1, repetitions: 1 }, 4);
  assert.equal(next.interval_days, 6);
  assert.equal(next.repetitions, 2);
});

test("chọn Quên làm mất chuỗi: repetitions về 0, ôn lại sau 1 ngày, hệ số dễ giảm", () => {
  const next = scheduleReview({ ease_factor: 2.5, interval_days: 15, repetitions: 3 }, "again", "2026-11-14");
  assert.equal(next.repetitions, 0);
  assert.equal(next.interval_days, 1);
  assert.equal(next.due_date, "2026-11-15");
  // 2,5 + (0,1 − 4 × (0,08 + 4 × 0,02)) = 2,5 − 0,54 = 1,96
  assert.equal(next.ease_factor, 1.96);
});

test("lần thứ ba: khoảng cách cũ × hệ số dễ, làm tròn (khớp mockup 14 / 15 / 16 ngày)", () => {
  const card = { ease_factor: 2.5, interval_days: 6, repetitions: 2 };
  const hard = sm2(card, 3); // EF 2,36 → 6 × 2,36 = 14,16 → 14
  const good = sm2(card, 4); // EF 2,5 → 15
  const easy = sm2(card, 5); // EF 2,6 → 15,6 → 16
  assert.deepEqual([hard.interval_days, good.interval_days, easy.interval_days], [14, 15, 16]);
  assert.deepEqual([hard.ease_factor, good.ease_factor, easy.ease_factor], [2.36, 2.5, 2.6]);
  assert.equal(good.repetitions, 3);
});

test("BR05: hệ số dễ không xuống dưới 1,3", () => {
  let card = { ease_factor: 1.5, interval_days: 1, repetitions: 0 };
  for (let i = 0; i < 5; i++) card = sm2(card, 1);
  assert.equal(card.ease_factor, 1.3);
  assert.equal(sm2({ ease_factor: 1.3, interval_days: 6, repetitions: 2 }, 3).ease_factor, 1.3);
});

test("qua ranh giới tháng / năm khi tính ngày ôn", () => {
  const next = scheduleReview({ ease_factor: 2.5, interval_days: 6, repetitions: 2 }, "good", "2026-12-25");
  assert.equal(next.due_date, "2027-01-09");
});

test("BR06: từ đã nắm khi khoảng cách ôn từ 21 ngày trở lên", () => {
  assert.equal(isMastered({ interval_days: 20 }), false);
  assert.equal(isMastered({ interval_days: 21 }), true);
});
