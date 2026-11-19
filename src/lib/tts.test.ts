import assert from "node:assert/strict";
import { test } from "node:test";
import { pickChineseVoice } from "./tts.ts";

const voice = (lang: string, voiceURI = lang, localService = false) => ({ lang, voiceURI, localService });

test("chọn giọng zh-CN khi có", () => {
  const picked = pickChineseVoice([voice("vi-VN"), voice("zh-TW"), voice("zh-CN"), voice("en-US")]);
  assert.equal(picked?.lang, "zh-CN");
});

test("nhận cả cách viết zh_CN và cmn-Hans-CN", () => {
  assert.equal(pickChineseVoice([voice("zh_CN")])?.lang, "zh_CN");
  assert.equal(pickChineseVoice([voice("cmn-Hans-CN")])?.lang, "cmn-Hans-CN");
});

test("không dùng giọng Quảng Đông hay Đài Loan", () => {
  assert.equal(pickChineseVoice([voice("zh-HK"), voice("yue-HK"), voice("zh-TW")]), null);
});

test("không có giọng nào thì trả về null", () => {
  assert.equal(pickChineseVoice([]), null);
  assert.equal(pickChineseVoice([voice("vi-VN"), voice("en-US")]), null);
});

test("cùng là zh-CN thì ưu tiên giọng cài sẵn trên máy", () => {
  const picked = pickChineseVoice([voice("zh-CN", "online"), voice("zh-CN", "local", true)]);
  assert.equal(picked?.voiceURI, "local");
});
