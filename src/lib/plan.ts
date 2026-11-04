// Quy tắc tính lộ trình ôn thi (điểm khác biệt C).
// Dùng chung cho màn Đặt mục tiêu (/onboarding) và màn Lộ trình (/roadmap),
// cả ở trình duyệt lẫn máy chủ, nên không đọc database hay cookie ở đây.

/** BR01: ngày thi phải cách hôm nay từ 7 đến 365 ngày */
export const MIN_DAYS_BEFORE_EXAM = 7;
export const MAX_DAYS_BEFORE_EXAM = 365;

/** BR02: 5 ngày cuối dành cho thi thử và ôn điểm yếu, không học từ mới */
export const FINAL_REVIEW_DAYS = 5;
/** BR02: mỗi ngày có 1 bài học khoảng 10 phút, mỗi từ mới khoảng 1 phút */
export const LESSON_MINUTES = 10;
export const MINUTES_PER_NEW_WORD = 1;

export const DAILY_MINUTE_OPTIONS = [15, 30, 45, 60] as const;
export type DailyMinutes = (typeof DAILY_MINUTE_OPTIONS)[number];

/** Ngày được tính theo giờ Việt Nam */
export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hôm nay dạng "YYYY-MM-DD" theo giờ Việt Nam */
export function todayISO(now: Date = new Date()): string {
  // Định dạng en-CA cho ra đúng dạng YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Chuỗi có phải ngày hợp lệ dạng "YYYY-MM-DD" không (loại cả 2026-02-30) */
export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUTC(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Số ngày từ `fromISO` đến `toISO` (ví dụ hôm nay → ngày thi) */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / DAY_MS);
}

/** Cộng thêm số ngày vào một ngày "YYYY-MM-DD" */
export function addDaysISO(dateISO: string, days: number): string {
  return new Date(toUTC(dateISO) + days * DAY_MS).toISOString().slice(0, 10);
}

/** BR01: kiểm tra ngày thi. Trả về câu báo lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export function validateExamDate(examDate: string, today: string): string | null {
  if (!examDate) return "Bạn hãy chọn ngày thi.";
  if (!isValidISODate(examDate)) return "Ngày thi không hợp lệ.";
  const days = daysBetween(today, examDate);
  if (days < MIN_DAYS_BEFORE_EXAM) {
    return `Ngày thi cần cách hôm nay ít nhất ${MIN_DAYS_BEFORE_EXAM} ngày.`;
  }
  if (days > MAX_DAYS_BEFORE_EXAM) {
    return `Ngày thi không được xa hơn ${MAX_DAYS_BEFORE_EXAM} ngày (1 năm) kể từ hôm nay.`;
  }
  return null;
}

export type StudyPlan = {
  /** Số ngày còn lại đến ngày thi */
  daysLeft: number;
  /** Số ngày học từ mới = số ngày còn lại − 5 ngày cuối */
  studyDays: number;
  /** Số từ mới mỗi ngày = làm tròn lên(số từ của cấp ÷ số ngày học) */
  newWordsPerDay: number;
  /** Thời gian cần mỗi ngày ≈ số từ mới + 10 phút bài học */
  minutesNeeded: number;
  /** Thời gian người học đã chọn */
  dailyMinutes: number;
  /** true khi thời gian cần vượt thời gian đã chọn: "Thiếu thời gian ôn tập" */
  tooDense: boolean;
};

/** BR02: tính lộ trình đề xuất */
export function computeStudyPlan(input: {
  wordCount: number;
  daysLeft: number;
  dailyMinutes: number;
}): StudyPlan {
  const { wordCount, daysLeft, dailyMinutes } = input;
  const studyDays = Math.max(daysLeft - FINAL_REVIEW_DAYS, 1);
  const newWordsPerDay = Math.ceil(wordCount / studyDays);
  const minutesNeeded = newWordsPerDay * MINUTES_PER_NEW_WORD + LESSON_MINUTES;

  return {
    daysLeft,
    studyDays,
    newWordsPerDay,
    minutesNeeded,
    dailyMinutes,
    tooDense: minutesNeeded > dailyMinutes,
  };
}
