import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLevelOptions, getTopicOptions } from "@/lib/lookups";
import { plainPinyin } from "@/lib/pinyin";
import { toWordRow, WORD_COLUMNS } from "@/lib/words/word-input";
import { PAGE_SIZE, parseWordFilters } from "./filters";
import { WordsManager } from "./words-manager";

export const metadata: Metadata = { title: "Quản trị từ vựng · Hệ thống ôn thi HSK" };

// Mockup: docs/mockups/16a-quan-tri-tu-vung.png (danh sách), 16b-them-tu-vung.png (sheet thêm từ)
// Use case UC12, quy tắc BR12–BR14.
export default function AdminWordsPage({ searchParams }: PageProps<"/admin/words">) {
  return (
    <Suspense fallback={<WordsSkeleton />}>
      <WordsLoader searchParams={searchParams} />
    </Suspense>
  );
}

// Bỏ các ký tự có nghĩa đặc biệt trong cú pháp lọc của Supabase (dấu phẩy, ngoặc, %, _…)
function sanitizeSearch(value: string) {
  return value.replace(/[,()%_*\\"'.:]/g, " ").replace(/\s+/g, " ").trim();
}

async function WordsLoader({ searchParams }: Pick<PageProps<"/admin/words">, "searchParams">) {
  // Dữ liệu theo người đăng nhập: chỉ dựng khi có request thật (tránh lỗi Date.now lúc dựng trước)
  await connection();
  const filters = parseWordFilters(await searchParams);
  const supabase = await createClient();

  let list = supabase
    .from("words")
    .select(WORD_COLUMNS, { count: "exact" })
    .order("level_id")
    .order("created_at")
    .order("id");
  if (filters.level) list = list.eq("level_id", filters.level);
  if (filters.topic) list = list.eq("topic_id", filters.topic);
  if (filters.falseFriendOnly) list = list.eq("is_false_friend", true);

  const q = sanitizeSearch(filters.q);
  if (q) {
    // Tìm theo chữ Hán, âm Hán Việt, nghĩa; pinyin tìm không cần dấu (cột pinyin_plain, migration 0005)
    const conditions = [`hanzi.ilike.%${q}%`, `han_viet.ilike.%${q}%`, `meaning_vi.ilike.%${q}%`];
    const pinyin = plainPinyin(q);
    if (pinyin) conditions.push(`pinyin_plain.ilike.%${pinyin}%`);
    list = list.or(conditions.join(","));
  }

  const from = (filters.page - 1) * PAGE_SIZE;
  // Cấp và chủ đề lấy từ bộ nhớ sẵn (src/lib/lookups.ts), chỉ 2 truy vấn thật chạy song song
  const [listResult, totalResult, levels, topics] = await Promise.all([
    list.range(from, from + PAGE_SIZE - 1),
    supabase.from("words").select("id", { count: "exact", head: true }),
    getLevelOptions(),
    getTopicOptions(),
  ]);

  if (listResult.error) console.error("[admin/words] Không tải được danh sách:", listResult.error);

  return (
    <WordsManager
      words={(listResult.data ?? []).map(toWordRow)}
      filteredCount={listResult.count ?? 0}
      totalCount={totalResult.count ?? 0}
      levels={levels}
      topics={topics}
      filters={filters}
      loadError={Boolean(listResult.error)}
    />
  );
}

function WordsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải danh sách từ vựng">
      <div className="h-20 w-64 animate-pulse rounded-xl bg-card/60" />
      <div className="h-11 animate-pulse rounded-xl bg-card/60" />
      <div className="h-[32rem] animate-pulse rounded-[20px] bg-card/60" />
    </div>
  );
}
