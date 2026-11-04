// Bộ lọc của trang Quản trị từ vựng, lưu trên địa chỉ trang (?q=…&level=…&topic=…&ff=1&page=…)
// để tải lại trang hoặc gửi đường dẫn vẫn giữ nguyên kết quả.

export const PAGE_SIZE = 20;

export type WordFilters = {
  q: string;
  level: number | null;
  topic: number | null;
  falseFriendOnly: boolean;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const positiveInt = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function parseWordFilters(params: SearchParams): WordFilters {
  return {
    q: first(params.q).slice(0, 100),
    level: positiveInt(first(params.level)),
    topic: positiveInt(first(params.topic)),
    falseFriendOnly: first(params.ff) === "1",
    page: positiveInt(first(params.page)) ?? 1,
  };
}

export function filtersToQuery(filters: WordFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.level) params.set("level", String(filters.level));
  if (filters.topic) params.set("topic", String(filters.topic));
  if (filters.falseFriendOnly) params.set("ff", "1");
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
