// Kiểm tra bộ máy phiên làm bài trong database (migration 0009) bằng PostgreSQL thật chạy trong PGlite:
// tạo phiên, nộp câu, khóa câu, kết thúc phiên, và các chốt chặn bảo mật.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUser } from "../test-db.ts";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LOCKED = "33333333-3333-4333-8333-333333333333";

const Q = {
  vocab: "aaaaaaaa-0000-4000-8000-000000000001",
  hanzi: "aaaaaaaa-0000-4000-8000-000000000002",
  order: "aaaaaaaa-0000-4000-8000-000000000003",
  pictureOk: "aaaaaaaa-0000-4000-8000-000000000004",
  pictureMissing: "aaaaaaaa-0000-4000-8000-000000000005",
  inactive: "aaaaaaaa-0000-4000-8000-000000000006",
  level2: "aaaaaaaa-0000-4000-8000-000000000007",
};

let db: PGlite;

before(async () => {
  db = await createTestDb();
  await createUser(db, LEARNER);
  await createUser(db, OTHER);
  await createUser(db, LOCKED);
  await db.query("update public.profiles set status = 'locked' where id = $1", [LOCKED]);

  const insert = (id: string, level: number, type: string, skill: string, content: object, answer: object, status = "active") =>
    db.query(
      `insert into public.questions (id, level_id, question_type, skill, content, answer, explanation, status)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
      [id, level, type, skill, JSON.stringify(content), JSON.stringify(answer), `Giải thích ${id.slice(-1)}`, status],
    );
  await insert(Q.vocab, 1, "vocab_meaning", "vocabulary", { stem: "机场", pinyin: "jīchǎng", options: ["sân bay", "nhà ga", "bến xe"] }, { index: 0 });
  await insert(Q.hanzi, 1, "writing_hanzi", "writing", { stem: "fēi（飞）机" }, { text: "飞" });
  await insert(Q.order, 1, "writing_order", "writing", { tokens: ["我", "把作业", "做完了"] }, { sentence: "我把作业做完了。" });
  await insert(Q.pictureOk, 1, "listening_picture", "listening", { images: ["https://x.test/a.png", "https://x.test/b.png", "https://x.test/c.png"] }, { index: 1 });
  await insert(Q.pictureMissing, 1, "listening_picture", "listening", { images: ["https://x.test/a.png", null, "https://x.test/c.png"] }, { index: 1 });
  await insert(Q.inactive, 1, "vocab_meaning", "vocabulary", { stem: "飞机", pinyin: "fēijī", options: ["máy bay", "tàu", "xe"] }, { index: 0 }, "inactive");
  await insert(Q.level2, 2, "vocab_meaning", "vocabulary", { stem: "告诉", pinyin: "gàosu", options: ["nói cho biết", "hỏi", "nghe"] }, { index: 0 });
});

after(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("delete from public.attempts");
});

type Json = Record<string, unknown>;

const start = (user: string | null, mode: string, config: object = {}) =>
  asUser(db, user, async () => {
    const { rows } = await db.query<{ id: string }>("select public.start_attempt($1, $2::jsonb) as id", [mode, JSON.stringify(config)]);
    return rows[0].id;
  });

const submit = (user: string, attemptId: string, questionId: string, response: unknown, flagged = false) =>
  asUser(db, user, async () => {
    const { rows } = await db.query<{ r: Json }>("select public.submit_answer($1, $2, $3::jsonb, $4) as r", [
      attemptId,
      questionId,
      JSON.stringify(response),
      flagged,
    ]);
    return rows[0].r;
  });

const finish = (user: string, attemptId: string) =>
  asUser(db, user, async () => (await db.query<{ r: Json }>("select public.finish_attempt($1) as r", [attemptId])).rows[0].r);

const load = (user: string, attemptId: string) =>
  asUser(db, user, async () => (await db.query<{ r: Json }>("select public.get_attempt($1) as r", [attemptId])).rows[0].r);

const questionIds = async (attemptId: string) =>
  (await db.query<{ ids: string[] }>("select question_ids as ids from public.attempts where id = $1", [attemptId])).rows[0].ids;

describe("start_attempt: tạo phiên", () => {
  test("chỉ chọn câu đang dùng, đúng cấp, bỏ câu chọn tranh chưa đủ 3 ảnh", async () => {
    const id = await start(LEARNER, "practice", { level_id: 1, count: 50 });
    const ids = await questionIds(id);
    assert.deepEqual(new Set(ids), new Set([Q.vocab, Q.hanzi, Q.order, Q.pictureOk]));
  });

  test("lọc theo dạng câu và giới hạn số câu", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["writing_hanzi", "writing_order", "khong_co"], count: 1 });
    const ids = await questionIds(id);
    assert.equal(ids.length, 1);
    assert.ok([Q.hanzi, Q.order].includes(ids[0]));
  });

  test("luyện tập: các câu cùng kỹ năng đứng liền nhau (từ vựng trước, viết sau)", async () => {
    const id = await start(LEARNER, "practice", { level_id: 1, count: 50 });
    const ids = await questionIds(id);
    assert.equal(ids[0], Q.vocab);
    assert.deepEqual(new Set(ids.slice(2)), new Set([Q.hanzi, Q.order]));
  });

  test("lưu đúng người, chế độ, trạng thái và tham số", async () => {
    const id = await start(LEARNER, "practice", { level_id: 2, tag: "dev" });
    const { rows } = await db.query<Json>("select user_id, attempt_type, status, config from public.attempts where id = $1", [id]);
    assert.equal(rows[0].user_id, LEARNER);
    assert.equal(rows[0].attempt_type, "practice");
    assert.equal(rows[0].status, "in_progress");
    assert.deepEqual(rows[0].config, { mode: "practice", feedback: "immediate", level_id: 2, count: 10, tag: "dev" });
  });

  test("từ chối chế độ chưa hỗ trợ, tham số sai, khách và tài khoản bị khóa", async () => {
    await assert.rejects(start(LEARNER, "exam"), /chưa được hỗ trợ/);
    await assert.rejects(start(LEARNER, "practice", { level_id: 9 }), /Cấp HSK/);
    await assert.rejects(start(LEARNER, "practice", { count: 0 }), /từ 1 đến 50/);
    await assert.rejects(start(LEARNER, "practice", { count: 2.5 }), /từ 1 đến 50/);
    await assert.rejects(start(LEARNER, "practice", { question_types: ["khong_co"] }), /Dạng câu/);
    await assert.rejects(start(LEARNER, "practice", { tag: "Có dấu" }), /Nhãn/);
    await assert.rejects(start(LOCKED, "practice"), /đăng nhập/);
    await assert.rejects(start(null, "practice"), /permission denied/);
  });

  test("không có câu phù hợp thì báo lỗi", async () => {
    await assert.rejects(start(LEARNER, "practice", { level_id: 3 }), /Chưa có câu hỏi phù hợp/);
  });
});

describe("submit_answer: nộp từng câu", () => {
  test("chấm đúng, trả về đáp án và giải thích của riêng câu đó", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    const r = await submit(LEARNER, id, Q.vocab, { index: 0 }, true);
    assert.deepEqual(r, {
      question_id: Q.vocab,
      user_answer: { index: 0 },
      is_correct: true,
      is_flagged: true,
      answer: { index: 0 },
      explanation: "Giải thích 1",
      locked: false,
    });
  });

  test("câu viết chấm theo cùng quy tắc với grade.ts (bỏ dấu câu, khoảng trắng)", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["writing_order", "writing_hanzi"], count: 2 });
    assert.equal((await submit(LEARNER, id, Q.order, { order: [0, 1, 2] })).is_correct, true);
    assert.equal((await submit(LEARNER, id, Q.hanzi, { text: "　非。" })).is_correct, false);
  });

  test("khóa câu: nộp lại chỉ nhận lại kết quả cũ, không ghi đè", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    await submit(LEARNER, id, Q.vocab, { index: 2 });
    const again = await submit(LEARNER, id, Q.vocab, { index: 0 }, true);
    assert.equal(again.is_correct, false);
    assert.deepEqual(again.user_answer, { index: 2 });
    assert.equal(again.is_flagged, false);
    assert.equal(again.locked, true);
    const { rows } = await db.query("select count(*)::int as n from public.answers");
    assert.equal(rows[0] && (rows[0] as { n: number }).n, 1);
  });

  test("từ chối câu không thuộc phiên, phiên của người khác, câu trả lời sai dạng", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    await assert.rejects(submit(LEARNER, id, Q.level2, { index: 0 }), /không thuộc phiên/);
    await assert.rejects(submit(OTHER, id, Q.vocab, { index: 0 }), /Không tìm thấy phiên/);
    await assert.rejects(submit(LEARNER, id, Q.vocab, [0]), /không hợp lệ/);
    await assert.rejects(submit(LEARNER, id, Q.vocab, { text: "长".repeat(3000) }), /không hợp lệ/);
  });

  test("phiên deferred (thi thử sau này): cho nộp lại, ghi đè và không trả đáp án", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    await db.query(`update public.attempts set config = config || '{"feedback": "deferred"}' where id = $1`, [id]);
    const first = await submit(LEARNER, id, Q.vocab, { index: 2 });
    assert.equal(first.answer, undefined);
    assert.equal(first.is_correct, undefined);
    await submit(LEARNER, id, Q.vocab, { index: 0 });
    const { rows } = await db.query<Json>("select user_answer, is_correct from public.answers");
    assert.deepEqual(rows, [{ user_answer: { index: 0 }, is_correct: true }]);

    const view = await load(LEARNER, id);
    const question = (view.questions as Json[])[0];
    assert.deepEqual(question.result, { user_answer: { index: 0 }, is_flagged: false, is_correct: null, answer: null, explanation: null });
  });
});

describe("finish_attempt và get_attempt", () => {
  test("kết thúc sớm: đếm câu đúng, không nộp thêm được, gọi lại vẫn cùng kết quả", async () => {
    const id = await start(LEARNER, "practice", { level_id: 1, count: 50 });
    await submit(LEARNER, id, Q.vocab, { index: 0 });
    await submit(LEARNER, id, Q.hanzi, { text: "非" });
    const r = await finish(LEARNER, id);
    assert.equal(r.status, "submitted");
    assert.equal(r.correct_count, 1);
    assert.equal(r.answered_count, 2);
    assert.equal(r.total, 4);
    assert.ok(r.submitted_at);
    await assert.rejects(submit(LEARNER, id, Q.order, { order: [0, 1, 2] }), /đã kết thúc/);
    assert.deepEqual(await finish(LEARNER, id), r);
    await assert.rejects(finish(OTHER, id), /Không tìm thấy phiên/);
  });

  test("mở lại phiên: đúng thứ tự, đáp án chỉ kèm câu đã nộp", async () => {
    const id = await start(LEARNER, "practice", { level_id: 1, count: 50 });
    const ids = await questionIds(id);
    await submit(LEARNER, id, Q.vocab, { index: 1 }, true);
    const view = await load(LEARNER, id);
    const questions = view.questions as Json[];
    assert.deepEqual(questions.map((q) => q.id), ids);
    for (const q of questions) {
      assert.equal("answer" in q, false, "đề bài không được kèm đáp án");
      if (q.id === Q.vocab) {
        assert.deepEqual(q.result, {
          user_answer: { index: 1 },
          is_flagged: true,
          is_correct: false,
          answer: { index: 0 },
          explanation: "Giải thích 1",
        });
      } else {
        assert.equal(q.result, null);
      }
    }
    await assert.rejects(load(OTHER, id), /Không tìm thấy phiên/);
  });

  test("câu bị chuyển sang Ngừng dùng sau khi tạo phiên vẫn mở lại được", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    await db.query("update public.questions set status = 'inactive' where id = $1", [Q.vocab]);
    try {
      const view = await load(LEARNER, id);
      assert.equal((view.questions as Json[]).length, 1);
    } finally {
      await db.query("update public.questions set status = 'active' where id = $1", [Q.vocab]);
    }
  });
});

describe("chốt chặn quyền của học viên", () => {
  const sql = (user: string, text: string, params: unknown[] = []) => asUser(db, user, () => db.query(text, params));

  test("không đọc được đáp án và giải thích trong bảng questions", async () => {
    await assert.rejects(sql(LEARNER, "select answer from public.questions"), /permission denied/);
    await assert.rejects(sql(LEARNER, "select explanation from public.questions"), /permission denied/);
  });

  test("không tự ghi, sửa, xóa câu trả lời và không tự tạo phiên", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    await submit(LEARNER, id, Q.vocab, { index: 2 });
    await assert.rejects(
      sql(LEARNER, "insert into public.answers (attempt_id, question_id, user_answer) values ($1, $2, '{}')", [id, Q.hanzi]),
      /permission denied/,
    );
    await assert.rejects(sql(LEARNER, "update public.answers set user_answer = '{\"index\":0}'"), /permission denied/);
    await assert.rejects(sql(LEARNER, "delete from public.answers"), /permission denied/);
    await assert.rejects(sql(LEARNER, "update public.attempts set correct_count = 99"), /permission denied/);
    await assert.rejects(
      sql(LEARNER, "insert into public.attempts (user_id, attempt_type) values ($1, 'practice')", [LEARNER]),
      /permission denied/,
    );
  });

  test("không gọi thẳng được hàm chấm nội bộ", async () => {
    await assert.rejects(sql(LEARNER, "select public.grade_answer('vocab_meaning', '{}', '{}', '{}')"), /permission denied/);
    await assert.rejects(sql(LEARNER, "select public.normalize_answer_text('a')"), /permission denied/);
  });

  test("vẫn đọc được phiên và câu trả lời của chính mình, không đọc được của người khác", async () => {
    const id = await start(LEARNER, "practice", { question_types: ["vocab_meaning"], level_id: 1 });
    await submit(LEARNER, id, Q.vocab, { index: 0 });
    assert.equal((await sql(LEARNER, "select * from public.answers")).rows.length, 1);
    assert.equal((await sql(OTHER, "select * from public.answers")).rows.length, 0);
    assert.equal((await sql(OTHER, "select * from public.attempts")).rows.length, 0);
  });
});
