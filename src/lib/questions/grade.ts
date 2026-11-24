// Chấm điểm một câu trả lời cho cả 11 dạng câu. Hàm thuần: không đọc database.
// Luôn gọi ở máy chủ khi chấm thật (đáp án không được gửi xuống trình duyệt trước khi nộp bài);
// trang quản trị dùng thêm ở trình duyệt cho nút "Thử trả lời" (quản trị viên vốn được xem đáp án).
//
// BẢN SONG SINH: hàm SQL public.grade_answer() (migration 0009) chấm thật cho học viên.
// Hai bản phải cho cùng kết quả; grading.test.ts chạy CÙNG một danh sách tình huống
// (grading-cases.ts) qua cả hai. Sửa cách chấm ở đây thì sửa cả hàm SQL bằng migration mới.
import type { QuestionForView, QuestionWithAnswer } from "./types.ts";
import { normalizeForCompare } from "./validate.ts";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Câu hỏi đã có câu trả lời hợp lệ để chấm chưa (dùng để bật / tắt nút Kiểm tra) */
export function hasResponse(question: QuestionForView | QuestionWithAnswer, response: unknown): boolean {
  if (!isObject(response)) return false;
  switch (question.type) {
    case "listening_true_false":
      return typeof response.value === "boolean";
    case "writing_order":
      return Array.isArray(response.order) && response.order.length === question.content.tokens.length;
    case "writing_hanzi":
      return typeof response.text === "string" && normalizeForCompare(response.text) !== "";
    default:
      return Number.isInteger(response.index);
  }
}

/** true nếu đúng. Câu trả lời sai dạng / thiếu thì tính là sai. */
export function gradeQuestion(question: QuestionWithAnswer, response: unknown): boolean {
  if (!isObject(response)) return false;
  switch (question.type) {
    case "listening_true_false":
      return typeof response.value === "boolean" && response.value === question.answer.value;

    case "writing_order": {
      // Ghép các cụm theo thứ tự học viên đã bấm; mỗi cụm dùng đúng một lần
      const { tokens } = question.content;
      const order = response.order;
      if (!Array.isArray(order) || order.length !== tokens.length) return false;
      if (new Set(order).size !== order.length || order.some((i) => !Number.isInteger(i) || i < 0 || i >= tokens.length)) {
        return false;
      }
      const sentence = order.map((i: number) => tokens[i]).join("");
      return normalizeForCompare(sentence) === normalizeForCompare(question.answer.sentence);
    }

    case "writing_hanzi":
      return (
        typeof response.text === "string" &&
        normalizeForCompare(response.text) !== "" &&
        normalizeForCompare(response.text) === normalizeForCompare(question.answer.text)
      );

    default:
      return Number.isInteger(response.index) && response.index === question.answer.index;
  }
}
