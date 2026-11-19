// Bộ lọc của trang Quản trị câu hỏi, lưu trên địa chỉ trang
// (?q=…&level=…&type=…&topic=…&grammar=…&status=…&page=…) để tải lại hoặc gửi đường dẫn vẫn giữ kết quả.
import { isQuestionType, type QuestionType } from "@/lib/questions/types";

export const PAGE_SIZE = 20;

export type QuestionFilters = {
  q: string;
  level: number | null;
  type: QuestionType | null;
  topic: number | null;
  grammar: number | null;
  status: "active" | "inactive" | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const positiveInt = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function parseQuestionFilters(params: SearchParams): QuestionFilters {
  const type = first(params.type);
  const status = first(params.status);
  return {
    q: first(params.q).slice(0, 100),
    level: positiveInt(first(params.level)),
    type: isQuestionType(type) ? type : null,
    topic: positiveInt(first(params.topic)),
    grammar: positiveInt(first(params.grammar)),
    status: status === "active" || status === "inactive" ? status : null,
    page: positiveInt(first(params.page)) ?? 1,
  };
}

export function questionFiltersToQuery(filters: QuestionFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.level) params.set("level", String(filters.level));
  if (filters.type) params.set("type", filters.type);
  if (filters.topic) params.set("topic", String(filters.topic));
  if (filters.grammar) params.set("grammar", String(filters.grammar));
  if (filters.status) params.set("status", filters.status);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
