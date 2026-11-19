// Thuật toán lặp lại ngắt quãng SM-2 cho thẻ từ (UC05, quy tắc BR04–BR06).
//
// Nguồn tham khảo: Piotr Woźniak, thuật toán SuperMemo SM-2 (1987),
// mô tả gốc tại https://super-memory.com/english/ol/sm2.htm
//
// Đây là hàm thuần: không đọc database, không đọc giờ hệ thống (ngày hôm nay truyền vào),
// nên dùng chung được ở trình duyệt (hiện trước ngày ôn dưới mỗi nút) và ở máy chủ
// (tính lại khi lưu, không tin số liệu trình duyệt gửi lên). Không import "@/…" để bài test chạy trực tiếp.
import { addDaysISO } from "./plan.ts";

/** Trạng thái SM-2 của một thẻ (đúng tên cột trong bảng srs_cards) */
export type SrsState = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
};

/** Bốn mức tự đánh giá trên màn ôn thẻ */
export type Rating = "again" | "hard" | "good" | "easy";
export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"];

/** BR04: Quên = 1, Khó = 3, Nhớ = 4, Dễ = 5 (thang điểm chất lượng q từ 0 đến 5 của SM-2) */
export const RATING_QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export const RATING_LABEL: Record<Rating, string> = { again: "Quên", hard: "Khó", good: "Nhớ", easy: "Dễ" };

/** BR05: hệ số dễ không nhỏ hơn 1,3 */
export const MIN_EASE_FACTOR = 1.3;
export const DEFAULT_EASE_FACTOR = 2.5;

/** BR06: thẻ có khoảng cách ôn từ 21 ngày trở lên coi là từ "đã nắm" */
export const MASTERED_INTERVAL_DAYS = 21;

export function isRating(value: unknown): value is Rating {
  return typeof value === "string" && (RATINGS as readonly string[]).includes(value);
}

export function isMastered(card: Pick<SrsState, "interval_days">): boolean {
  return card.interval_days >= MASTERED_INTERVAL_DAYS;
}

// Làm tròn 2 chữ số thập phân để hệ số dễ không bị sai số kiểu 2.3600000000000003
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Một bước SM-2 với điểm chất lượng q (0–5).
 * - Hệ số dễ (BR05): EF' = EF + (0,1 − (5 − q) × (0,08 + (5 − q) × 0,02)), tối thiểu 1,3.
 *   Công thức gốc áp dụng sau mỗi lần ôn, kể cả khi trả lời sai.
 * - q < 3 (quên): bắt đầu lại từ đầu, repetitions = 0, ôn lại sau 1 ngày.
 * - q ≥ 3: lần đúng thứ nhất → 1 ngày, lần thứ hai → 6 ngày,
 *   các lần sau → khoảng cách cũ × hệ số dễ (đã cập nhật), làm tròn.
 *   Dùng hệ số dễ mới nên Khó / Nhớ / Dễ cho ra số ngày khác nhau (khớp mockup 08b: 14 / 15 / 16 ngày).
 */
export function sm2(card: SrsState, quality: number): SrsState {
  const q = Math.min(5, Math.max(0, Math.round(quality)));
  const ef = Number.isFinite(card.ease_factor) ? card.ease_factor : DEFAULT_EASE_FACTOR;
  const easeFactor = Math.max(MIN_EASE_FACTOR, round2(ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));

  if (q < 3) {
    return { ease_factor: easeFactor, interval_days: 1, repetitions: 0 };
  }

  const repetitions = Math.max(0, card.repetitions) + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round(Math.max(1, card.interval_days) * easeFactor));

  return { ease_factor: easeFactor, interval_days: intervalDays, repetitions };
}

export type ScheduledCard = SrsState & { due_date: string };

/** Kết quả sau khi học viên chọn một mức đánh giá: trạng thái mới + ngày ôn tiếp theo ("YYYY-MM-DD") */
export function scheduleReview(card: SrsState, rating: Rating, today: string): ScheduledCard {
  const next = sm2(card, RATING_QUALITY[rating]);
  return { ...next, due_date: addDaysISO(today, next.interval_days) };
}
