// Bài test cho hàm đổi pinyin. Chạy bằng lệnh: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePinyin, numberedToToneMarks, plainPinyin } from "./pinyin.ts";

test("đổi từng âm tiết có số sang dấu thanh", () => {
  assert.equal(numberedToToneMarks("ni3 hao3"), "nǐ hǎo");
  assert.equal(numberedToToneMarks("ma1 ma2 ma3 ma4"), "mā má mǎ mà");
});

test("âm tiết viết liền nhau", () => {
  assert.equal(numberedToToneMarks("ji1chang3"), "jīchǎng");
  assert.equal(numberedToToneMarks("gong1gong4 qi4che1"), "gōnggòng qìchē");
});

test("dấu đặt đúng vị trí: a/e trước, rồi ou, rồi nguyên âm cuối", () => {
  assert.equal(numberedToToneMarks("xue2"), "xué");
  assert.equal(numberedToToneMarks("dou1"), "dōu");
  assert.equal(numberedToToneMarks("gui4"), "guì");
  assert.equal(numberedToToneMarks("liu2"), "liú");
  assert.equal(numberedToToneMarks("huai4"), "huài");
});

test("thanh nhẹ (5 hoặc 0) không có dấu", () => {
  assert.equal(numberedToToneMarks("dong1xi5"), "dōngxi");
  assert.equal(numberedToToneMarks("xie4xie0"), "xièxie");
});

test("v và u: được hiểu là ü", () => {
  assert.equal(numberedToToneMarks("lv4"), "lǜ");
  assert.equal(numberedToToneMarks("nu:3"), "nǚ");
  assert.equal(numberedToToneMarks("lüe4"), "lüè");
});

test("giữ chữ hoa và phần đã có dấu", () => {
  assert.equal(numberedToToneMarks("Bei3jing1"), "Běijīng");
  assert.equal(numberedToToneMarks("dōngxi"), "dōngxi");
});

test("normalizePinyin bỏ khoảng trắng thừa", () => {
  assert.equal(normalizePinyin("  ni3   hao3 "), "nǐ hǎo");
});

test("plainPinyin bỏ dấu để tìm kiếm và so trùng", () => {
  assert.equal(plainPinyin("dōngxi"), "dongxi");
  assert.equal(plainPinyin("Dong1 xi5"), "dongxi");
  assert.equal(plainPinyin("gōnggòng qìchē"), "gonggongqiche");
  assert.equal(plainPinyin("lǜ"), "lu");
  assert.equal(plainPinyin("lv4"), "lu");
});
