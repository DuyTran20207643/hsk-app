// Tỷ lệ đúng của học viên với các câu hỏi gắn một điểm ngữ pháp (UC18).
// Hàm thuần, không đọc database, để dễ viết bài test.
// Ngưỡng điểm yếu (BR10) lấy chung từ src/lib/weakness.ts.
import { WEAK_MIN_ANSWERS, WEAK_WRONG_RATE } from "../weakness.ts";

export { WEAK_MIN_ANSWERS, WEAK_WRONG_RATE };

export type AnswerOutcome = { is_correct: boolean | null; is_flagged: boolean };

export type GrammarStats = {
  /** Số câu trả lời đã chấm */
  answered: number;
  /** Số câu đúng (không tính câu đúng nhưng đánh dấu "chưa chắc") */
  correct: number;
  /** Tỷ lệ sai, từ 0 đến 1 */
  wrongRate: number;
  isWeak: boolean;
};

/**
 * Tính thống kê từ danh sách câu trả lời của một điểm ngữ pháp.
 * - Câu chưa chấm (is_correct = null, ví dụ bài chưa nộp) không tính.
 * - Câu đúng nhưng học viên đánh dấu "chưa chắc" (is_flagged) tính là sai: đoán trúng chưa phải là nắm chắc.
 * Trả về null nếu chưa có câu nào ("Chưa luyện").
 */
export function computeGrammarStats(answers: readonly AnswerOutcome[]): GrammarStats | null {
  const graded = answers.filter((a) => a.is_correct !== null);
  if (graded.length === 0) return null;
  const correct = graded.filter((a) => a.is_correct === true && !a.is_flagged).length;
  const wrongRate = (graded.length - correct) / graded.length;
  return {
    answered: graded.length,
    correct,
    wrongRate,
    isWeak: graded.length >= WEAK_MIN_ANSWERS && wrongRate >= WEAK_WRONG_RATE,
  };
}

/** Dòng chữ ngắn dưới tên điểm ngữ pháp: "Đúng 3 / 5 câu" hoặc "Chưa luyện" */
export function statsLabel(stats: GrammarStats | null): string {
  return stats ? `Đúng ${stats.correct} / ${stats.answered} câu` : "Chưa luyện";
}
