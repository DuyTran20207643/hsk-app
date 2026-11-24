// Kiểm tra cách chọn câu của 3 chế độ ôn tập (migration 0010) bằng PostgreSQL thật chạy trong PGlite:
// Luyện theo dạng câu, Ôn tổng hợp (tỷ lệ 60/25/15, xen kẽ dạng câu, đưa thẻ từ về ngày mai),
// Ôn điểm yếu (70/30, câu sai gần nhất trước).
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUser } from "../test-db.ts";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

type Json = Record<string, unknown>;
type Group = "new" | "wrong" | "correct";

let db: PGlite;
let seq = 0;
let topicId = 0;

/** Tạo câu hỏi; trả về id */
async function question(level: number, type: "vocab_meaning" | "grammar_fill", extra: { stem?: string; pinyin?: string; topic?: number } = {}) {
  seq += 1;
  const id = `bbbbbbbb-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  const content =
    type === "vocab_meaning"
      ? { stem: extra.stem ?? `词${seq}`, pinyin: extra.pinyin ?? "cí", options: ["a", "b", "c"] }
      : { stem: `我＿${seq}`, options: ["a", "b"] };
  await db.query(
    `insert into public.questions (id, level_id, topic_id, question_type, skill, content, answer)
     values ($1, $2, $3, $4, $5, $6::jsonb, '{"index":0}'::jsonb)`,
    [id, level, extra.topic ?? null, type, type === "vocab_meaning" ? "vocabulary" : "grammar", JSON.stringify(content)],
  );
  return id;
}

async function questions(n: number, level: number, type: "vocab_meaning" | "grammar_fill" = "vocab_meaning", extra = {}) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(await question(level, type, extra));
  return ids;
}

/** Ghi lịch sử: học viên đã trả lời câu này (đúng / sai / chưa chắc) cách đây `minutesAgo` phút */
async function history(user: string, questionId: string, correct: boolean, flagged = false, minutesAgo = 60) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.attempts (user_id, attempt_type, status, question_ids, config)
     values ($1, 'practice', 'submitted', array[$2::uuid], '{"feedback":"immediate"}') returning id`,
    [user, questionId],
  );
  await db.query(
    `insert into public.answers (attempt_id, question_id, user_answer, is_correct, is_flagged, answered_at)
     values ($1, $2, '{"index":0}', $3, $4, now() - make_interval(mins => $5))`,
    [rows[0].id, questionId, correct, flagged, minutesAgo],
  );
}

const start = (mode: string, config: object = {}, user = LEARNER) =>
  asUser(db, user, async () => {
    const { rows } = await db.query<{ id: string }>("select public.start_attempt($1, $2::jsonb) as id", [mode, JSON.stringify(config)]);
    return rows[0].id;
  });

const submit = (attemptId: string, questionId: string, index: number) =>
  asUser(db, LEARNER, async () => {
    const { rows } = await db.query<{ r: Json }>("select public.submit_answer($1, $2, $3::jsonb, false) as r", [
      attemptId,
      questionId,
      JSON.stringify({ index }),
    ]);
    return rows[0].r;
  });

async function attempt(id: string) {
  const { rows } = await db.query<{ ids: string[]; config: Json }>("select question_ids as ids, config from public.attempts where id = $1", [id]);
  return rows[0];
}

const countGroups = (groups: Record<string, Group>) => {
  const out = { new: 0, wrong: 0, correct: 0 };
  for (const g of Object.values(groups)) out[g] += 1;
  return out;
};

before(async () => {
  db = await createTestDb();
  await createUser(db, LEARNER);
  await createUser(db, OTHER);
  const { rows } = await db.query<{ id: number }>("insert into public.topics (name) values ('Đi lại') returning id");
  topicId = rows[0].id;
});

after(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("delete from public.attempts; delete from public.srs_cards; delete from public.questions; delete from public.words;");
});

describe("Luyện theo dạng câu", () => {
  test("ưu tiên câu chưa làm, rồi câu từng sai (kể cả đúng nhưng chưa chắc), cuối cùng câu đã đúng", async () => {
    const [fresh, wrong, unsure, right] = await questions(4, 1, "grammar_fill");
    await history(LEARNER, wrong, false);
    await history(LEARNER, unsure, true, true);
    await history(LEARNER, right, true);

    const one = await attempt(await start("practice", { question_types: ["grammar_fill"], count: 1 }));
    assert.deepEqual(one.ids, [fresh]);

    const three = await attempt(await start("practice", { question_types: ["grammar_fill"], count: 3 }));
    assert.deepEqual(new Set(three.ids), new Set([fresh, wrong, unsure]));
  });

  test("xét câu trả lời GẦN NHẤT: sai trước đây nhưng nay đã đúng thì là câu đã đúng", async () => {
    const [a, b] = await questions(2, 1, "grammar_fill");
    await history(LEARNER, a, false, false, 120);
    await history(LEARNER, a, true, false, 10);
    await history(LEARNER, b, false);
    const s = await attempt(await start("practice", { question_types: ["grammar_fill"], count: 1 }));
    assert.deepEqual(s.ids, [b]);
  });

  test("lịch sử của người khác không tính", async () => {
    const [a, b] = await questions(2, 1, "grammar_fill");
    await history(OTHER, a, true);
    await history(LEARNER, b, true);
    const s = await attempt(await start("practice", { question_types: ["grammar_fill"], count: 1 }));
    assert.deepEqual(s.ids, [a]);
  });

  test("mặc định 10 câu", async () => {
    await questions(12, 1, "grammar_fill");
    const s = await attempt(await start("practice", { question_types: ["grammar_fill"] }));
    assert.equal(s.ids.length, 10);
  });
});

describe("Ôn tổng hợp", () => {
  test("đủ câu: 60% từng đúng, 25% từng sai, 15% câu mới; lưu nhóm của từng câu", async () => {
    const right = await questions(20, 3);
    const wrong = await questions(10, 3);
    const fresh = await questions(10, 3);
    for (const id of right) await history(LEARNER, id, true);
    for (const id of wrong) await history(LEARNER, id, false);

    const s = await attempt(await start("mixed", { level_id: 3, count: 20 }));
    const groups = s.config.groups as Record<string, Group>;
    assert.equal(s.ids.length, 20);
    assert.deepEqual(countGroups(groups), { correct: 12, wrong: 5, new: 3 });
    for (const id of s.ids) {
      const expected = right.includes(id) ? "correct" : wrong.includes(id) ? "wrong" : fresh.includes(id) ? "new" : "?";
      assert.equal(groups[id], expected);
    }
  });

  test("mặc định 30 câu: 18 / 7 / 5", async () => {
    for (const id of await questions(25, 3)) await history(LEARNER, id, true);
    for (const id of await questions(10, 3)) await history(LEARNER, id, false);
    await questions(10, 3);
    const s = await attempt(await start("mixed", { level_id: 3 }));
    assert.equal(s.config.count, 30);
    assert.deepEqual(countGroups(s.config.groups as Record<string, Group>), { correct: 18, wrong: 7, new: 5 });
  });

  test("nhóm thiếu thì bù bằng câu mới", async () => {
    for (const id of await questions(3, 3)) await history(LEARNER, id, true);
    for (const id of await questions(1, 3)) await history(LEARNER, id, false);
    await questions(30, 3);
    const s = await attempt(await start("mixed", { level_id: 3, count: 20 }));
    assert.deepEqual(countGroups(s.config.groups as Record<string, Group>), { correct: 3, wrong: 1, new: 16 });
  });

  test("ngân hàng không đủ thì lấy hết", async () => {
    await questions(7, 3);
    const s = await attempt(await start("mixed", { level_id: 3 }));
    assert.equal(s.ids.length, 7);
    assert.equal(s.config.count, 30);
  });

  test("các dạng câu xen kẽ nhau", async () => {
    await questions(6, 3, "vocab_meaning");
    await questions(6, 3, "grammar_fill");
    const { rows } = await db.query<{ id: string; question_type: string }>("select id, question_type from public.questions");
    const typeOf = new Map(rows.map((r) => [r.id, r.question_type]));
    for (let round = 0; round < 5; round++) {
      const s = await attempt(await start("mixed", { level_id: 3, count: 12 }));
      for (let i = 1; i < s.ids.length; i += 2) {
        // Mỗi cặp (câu 1–2, 3–4…) có đủ cả 2 dạng
        assert.notEqual(typeOf.get(s.ids[i]), typeOf.get(s.ids[i - 1]));
      }
    }
  });
});

describe("Ôn tổng hợp: đưa thẻ từ về ngày mai khi sai câu chọn nghĩa", () => {
  const tomorrow = async () =>
    (await db.query<{ d: string }>("select ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)::text as d")).rows[0].d;
  const card = async (wordId: string) =>
    (await db.query<{ due: string }>("select due_date::text as due from public.srs_cards where user_id = $1 and word_id = $2", [LEARNER, wordId]))
      .rows[0]?.due ?? null;
  const word = async (hanzi: string, pinyin: string, level = 3) =>
    (
      await db.query<{ id: string }>(
        "insert into public.words (hanzi, pinyin, han_viet, meaning_vi, level_id) values ($1, $2, 'cơ trường', 'sân bay', $3) returning id",
        [hanzi, pinyin, level],
      )
    ).rows[0].id;

  test("trả lời sai: tạo thẻ mới, ngày ôn là ngày mai; trả về từ đã đưa vào thẻ", async () => {
    const w = await word("机场", "jīchǎng");
    const q = await question(3, "vocab_meaning", { stem: "机场", pinyin: "jīchǎng" });
    const id = await start("mixed", { level_id: 3 });
    const r = await submit(id, q, 2);
    assert.equal(r.is_correct, false);
    assert.equal(await card(w), await tomorrow());
    assert.deepEqual(r.srs, { word_id: w, hanzi: "机场", due_date: await tomorrow() });
  });

  test("thẻ đang hẹn xa hơn thì kéo về ngày mai; thẻ đã đến hạn hôm nay thì giữ nguyên", async () => {
    const far = await word("机场", "jīchǎng");
    const due = await word("飞机", "fēijī");
    await db.query("insert into public.srs_cards (user_id, word_id, due_date, interval_days) values ($1, $2, current_date + 20, 20)", [LEARNER, far]);
    await db.query("insert into public.srs_cards (user_id, word_id, due_date) values ($1, $2, current_date - 3)", [LEARNER, due]);
    const q1 = await question(3, "vocab_meaning", { stem: "机场" });
    const q2 = await question(3, "vocab_meaning", { stem: "飞机" });
    const id = await start("mixed", { level_id: 3 });
    await submit(id, q1, 1);
    await submit(id, q2, 1);
    assert.equal(await card(far), await tomorrow());
    const { rows } = await db.query<{ d: string; i: number }>(
      "select (current_date - 3)::text as d, interval_days as i from public.srs_cards where word_id = $1",
      [far],
    );
    assert.equal(await card(due), rows[0].d);
    // Chỉ đổi ngày ôn, không đổi các thông số SM-2 khác
    assert.equal(rows[0].i, 20);
  });

  test("trùng chữ Hán nhiều từ thì chọn từ cùng pinyin", async () => {
    await word("会", "huì");
    const kuai = await word("会", "kuài", 1);
    const q = await question(3, "vocab_meaning", { stem: "会", pinyin: "kuài" });
    const id = await start("mixed", { level_id: 3 });
    const r = await submit(id, q, 1);
    assert.equal((r.srs as Json).word_id, kuai);
  });

  test("không đổi lịch ôn khi: trả lời đúng, phiên luyện tập, hoặc không có từ trùng", async () => {
    const w = await word("机场", "jīchǎng");
    const q = await question(3, "vocab_meaning", { stem: "机场" });
    const other = await question(3, "vocab_meaning", { stem: "没有这个词" });

    const mixed = await start("mixed", { level_id: 3 });
    const ok = await submit(mixed, q, 0);
    assert.equal(ok.is_correct, true);
    assert.equal(ok.srs, undefined);
    const none = await submit(mixed, other, 1);
    assert.equal(none.srs, undefined);
    assert.equal(await card(w), null);

    const practice = await start("practice", { level_id: 3 });
    await submit(practice, q, 1);
    assert.equal(await card(w), null);
  });
});

describe("Ôn điểm yếu", () => {
  test("70% câu chưa làm, 30% câu từng sai (sai gần nhất trước); chỉ câu thuộc điểm yếu", async () => {
    const fresh = await questions(10, 3, "grammar_fill");
    const wrong = await questions(5, 3, "grammar_fill");
    await questions(5, 3, "vocab_meaning"); // không thuộc điểm yếu
    for (let i = 0; i < wrong.length; i++) await history(LEARNER, wrong[i], false, false, (i + 1) * 10);

    const s = await attempt(await start("weakness", { level_id: 3, targets: ["type:grammar_fill"], baseline: 54.6 }));
    assert.equal(s.ids.length, 10);
    assert.deepEqual(countGroups(s.config.groups as Record<string, Group>), { new: 7, wrong: 3, correct: 0 });
    // 3 câu sai gần nhất
    assert.deepEqual(new Set(s.ids.filter((id) => wrong.includes(id))), new Set(wrong.slice(0, 3)));
    assert.ok(s.ids.every((id) => fresh.includes(id) || wrong.includes(id)));
    assert.deepEqual(s.config.targets, ["type:grammar_fill"]);
    assert.equal(s.config.baseline, 55);
  });

  test("thiếu câu mới thì lấy thêm câu từng sai", async () => {
    const fresh = await questions(2, 3, "grammar_fill");
    const wrong = await questions(10, 3, "grammar_fill");
    for (const id of wrong) await history(LEARNER, id, false);
    const s = await attempt(await start("weakness", { level_id: 3, targets: ["type:grammar_fill"] }));
    assert.deepEqual(countGroups(s.config.groups as Record<string, Group>), { new: 2, wrong: 8, correct: 0 });
    assert.ok(fresh.every((id) => s.ids.includes(id)));
  });

  test("gộp nhiều điểm yếu: câu thuộc ít nhất một nhóm", async () => {
    const byTopic = await questions(3, 3, "vocab_meaning", { topic: topicId });
    const byType = await questions(3, 3, "grammar_fill");
    await questions(3, 3, "vocab_meaning");
    const s = await attempt(await start("weakness", { level_id: 3, targets: [`topic:${topicId}`, "type:grammar_fill"] }));
    assert.deepEqual(new Set(s.ids), new Set([...byTopic, ...byType]));
  });

  test("từ chối khi thiếu điểm yếu hoặc điểm yếu sai dạng", async () => {
    await questions(3, 3, "grammar_fill");
    await assert.rejects(start("weakness", { level_id: 3 }), /chọn điểm yếu/);
    await assert.rejects(start("weakness", { level_id: 3, targets: [] }), /chọn điểm yếu/);
    for (const bad of ["type:khong_co", "topic:999999", "grammar:0", "level:1", 5, "topic:1 or 1=1"]) {
      await assert.rejects(start("weakness", { level_id: 3, targets: [bad] }), /Điểm yếu không hợp lệ/, String(bad));
    }
    await assert.rejects(start("weakness", { level_id: 3, targets: ["type:grammar_fill"], baseline: 120 }), /không hợp lệ/);
  });
});
