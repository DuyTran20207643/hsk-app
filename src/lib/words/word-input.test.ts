// Bài test cho quy tắc kiểm tra từ vựng (BR12, BR13). Chạy bằng lệnh: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateKey, imageError, validateWord, type RawWordInput } from "./word-input.ts";
import { parseFalseFriend, parseLevel } from "./import.ts";

const lookups = { levelIds: new Set([1, 2, 3]), topicIds: new Set([12]) };
const word: RawWordInput = {
  hanzi: "机场",
  pinyin: "ji1 chang3",
  hanViet: "cơ trường",
  meaningVi: "sân bay",
  levelId: 2,
  topicId: 12,
  exampleZh: "",
  exampleVi: "",
  isFalseFriend: false,
  falseFriendNote: "",
  status: "active",
};

test("từ hợp lệ: pinyin số được đổi sang dấu thanh trước khi lưu", () => {
  const result = validateWord(word, lookups);
  assert.equal(result.values?.pinyin, "jī chǎng");
  assert.equal(result.values?.example_zh, null);
});

test("thiếu ô bắt buộc thì báo lỗi đúng ô", () => {
  const result = validateWord({ ...word, hanzi: "", meaningVi: " ", levelId: null }, lookups);
  assert.deepEqual(Object.keys(result.errors ?? {}).sort(), ["hanzi", "levelId", "meaningVi"]);
});

test("BR12: bật dễ nhầm thì ghi chú phân biệt là bắt buộc", () => {
  assert.ok(validateWord({ ...word, isFalseFriend: true }, lookups).errors?.falseFriendNote);
  const ok = validateWord({ ...word, isFalseFriend: true, falseFriendNote: "Không phải trường học." }, lookups);
  assert.equal(ok.values?.false_friend_note, "Không phải trường học.");
});

test("BR13: cùng chữ Hán và pinyin là trùng, kể cả khác dấu cách / dạng số", () => {
  assert.equal(duplicateKey("机场", "jīchǎng"), duplicateKey("机场", "ji1 chang3"));
  assert.notEqual(duplicateKey("妈", "mā"), duplicateKey("妈", "mà"));
});

test("ảnh: chỉ jpg/png/webp, tối đa 1 MB", () => {
  assert.equal(imageError({ type: "image/png", size: 500_000 }), null);
  assert.ok(imageError({ type: "image/gif", size: 1000 }));
  assert.ok(imageError({ type: "image/jpeg", size: 2_000_000 }));
});

test("import: đọc cột level và is_false_friend", () => {
  assert.equal(parseLevel("HSK 2"), 2);
  assert.equal(parseLevel("3"), 3);
  assert.equal(parseLevel("cấp 2"), null);
  assert.equal(parseFalseFriend("Có"), true);
  assert.equal(parseFalseFriend("không"), false);
  assert.equal(parseFalseFriend("yes"), null);
});
