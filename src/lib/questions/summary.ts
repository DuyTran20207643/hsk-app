// Bản rút gọn một câu hỏi để hiện trong danh sách quản trị (một dòng chữ).
import type { QuestionContent, QuestionType } from "./types.ts";

const shorten = (text: string, max = 90) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function questionSummary(type: QuestionType, content: QuestionContent, audioText: string | null): string {
  const c = content as Record<string, unknown>;
  const s = (key: string) => (typeof c[key] === "string" ? (c[key] as string) : "");
  switch (type) {
    case "listening_picture": {
      const images = Array.isArray(c.images) ? c.images.filter(Boolean).length : 0;
      return shorten(`${audioText ?? ""} · ${images}/3 ảnh`);
    }
    case "listening_true_false":
      return shorten(s("statement"));
    case "listening_short_dialogue":
    case "listening_long_dialogue":
      return shorten(s("question"));
    case "reading_comprehension":
      return shorten(`${s("question")} — ${s("passage")}`);
    case "writing_order":
      return shorten(Array.isArray(c.tokens) ? c.tokens.join(" / ") : "");
    default:
      return shorten(s("stem"));
  }
}

/** Các lựa chọn rút gọn: "A. sân bay · B. nhà ga · C. bến xe" */
export function optionsSummary(content: QuestionContent): string {
  const options = (content as { options?: unknown }).options;
  if (!Array.isArray(options)) return "";
  return shorten(options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(" · "), 120);
}
