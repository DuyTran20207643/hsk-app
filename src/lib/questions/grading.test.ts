// Chạy CÙNG một danh sách tình huống (grading-cases.ts) qua hai bản logic chấm:
// grade.ts (TypeScript) và hàm SQL public.grade_answer() (migration 0009, chạy trong PGlite).
// Hai bản lệch nhau là bài test này báo lỗi.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../test-db.ts";
import { gradeQuestion } from "./grade.ts";
import { GRADING_CASES, NORMALIZE_CASES } from "./grading-cases.ts";
import { IGNORED_ANSWER_CHARS, normalizeForCompare } from "./validate.ts";

let db: PGlite;
before(async () => {
  db = await createTestDb();
});
after(async () => {
  await db.close();
});

async function sqlGrade(c: (typeof GRADING_CASES)[number]): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    "select public.grade_answer($1, $2::jsonb, $3::jsonb, $4::jsonb) as ok",
    [c.question.type, JSON.stringify(c.question.content), JSON.stringify(c.question.answer), JSON.stringify(c.response)],
  );
  return rows[0].ok;
}

async function sqlNormalize(value: string): Promise<string> {
  const { rows } = await db.query<{ v: string }>("select public.normalize_answer_text($1) as v", [value]);
  return rows[0].v;
}

test("mỗi dạng câu có ít nhất một tình huống đúng và một tình huống sai", () => {
  const types = new Set(GRADING_CASES.map((c) => c.question.type));
  assert.equal(types.size, 11);
  for (const type of types) {
    const cases = GRADING_CASES.filter((c) => c.question.type === type);
    assert.ok(cases.some((c) => c.expected), `${type} thiếu tình huống đúng`);
    assert.ok(cases.some((c) => !c.expected), `${type} thiếu tình huống sai`);
  }
});

describe("grade.ts (TypeScript)", () => {
  for (const c of GRADING_CASES) {
    test(c.name, () => {
      assert.equal(gradeQuestion(c.question, c.response), c.expected);
    });
  }
});

describe("grade_answer() (SQL)", () => {
  for (const c of GRADING_CASES) {
    test(c.name, async () => {
      assert.equal(await sqlGrade(c), c.expected);
    });
  }
});

describe("chuẩn hóa chữ: hai bản bỏ đúng cùng một danh sách ký tự", () => {
  for (const [input, expected] of NORMALIZE_CASES) {
    test(JSON.stringify(input), async () => {
      assert.equal(normalizeForCompare(input), expected);
      assert.equal(await sqlNormalize(input), expected);
    });
  }

  test("SQL bỏ hết từng ký tự trong IGNORED_ANSWER_CHARS", async () => {
    for (const ch of IGNORED_ANSWER_CHARS) {
      assert.equal(await sqlNormalize(`中${ch}文`), "中文", `SQL chưa bỏ ký tự U+${ch.codePointAt(0)?.toString(16)}`);
    }
  });

  test("SQL không bỏ thêm ký tự nào ngoài danh sách", async () => {
    // Quét các khối ký tự hay gặp: ASCII, Latin-1, dấu câu chung, dấu câu CJK, toàn khổ
    const ranges: [number, number][] = [
      [0x20, 0x7e],
      [0xa0, 0xff],
      [0x2000, 0x206f],
      [0x3000, 0x303f],
      [0xff00, 0xff65],
    ];
    const chars = ranges.flatMap(([from, to]) =>
      Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)),
    );
    const sample = chars.join("");
    assert.equal(await sqlNormalize(sample), normalizeForCompare(sample));
  });
});
