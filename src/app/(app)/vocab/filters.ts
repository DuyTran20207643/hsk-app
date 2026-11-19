// Bộ lọc của trang Sổ từ, lưu trên địa chỉ trang (?q=…&level=…&topic=…&ff=1)
// để tải lại trang hoặc gửi đường dẫn cho người khác vẫn ra đúng kết quả.

/** Mỗi lần tải (lần đầu và mỗi lần bấm "Xem thêm") lấy 60 từ */
export const VOCAB_BATCH_SIZE = 60;

export type VocabFilters = {
  q: string;
  level: number | null;
  topic: number | null;
  falseFriendOnly: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const positiveInt = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function parseVocabFilters(params: SearchParams): VocabFilters {
  return {
    q: first(params.q).slice(0, 100),
    level: positiveInt(first(params.level)),
    topic: positiveInt(first(params.topic)),
    falseFriendOnly: first(params.ff) === "1",
  };
}

// Kiểm tra lại bộ lọc trình duyệt gửi lên Server Action (không tin dữ liệu từ trình duyệt)
export function sanitizeVocabFilters(value: unknown): VocabFilters {
  const raw = (value ?? {}) as Partial<Record<keyof VocabFilters, unknown>>;
  return {
    q: typeof raw.q === "string" ? raw.q.slice(0, 100) : "",
    level: positiveInt(raw.level),
    topic: positiveInt(raw.topic),
    falseFriendOnly: raw.falseFriendOnly === true,
  };
}

export function vocabFiltersToQuery(filters: VocabFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.level) params.set("level", String(filters.level));
  if (filters.topic) params.set("topic", String(filters.topic));
  if (filters.falseFriendOnly) params.set("ff", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}
