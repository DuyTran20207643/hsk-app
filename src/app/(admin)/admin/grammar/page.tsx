import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { GRAMMAR_COLUMNS, toGrammarPoint } from "@/lib/grammar/grammar-input";
import { getLevelOptions } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { GrammarManager } from "./grammar-manager";

export const metadata: Metadata = { title: "Quản trị ngữ pháp · Hệ thống ôn thi HSK" };

// Use case UC19 — Quản trị ngữ pháp. Cùng kiểu với /admin/words (16a, 16b);
// khung xem trước dùng chung giao diện với trang học viên /grammar (10-ngu-phap.png).
export default function AdminGrammarPage({ searchParams }: PageProps<"/admin/grammar">) {
  return (
    <Suspense fallback={<GrammarSkeleton />}>
      <GrammarLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function GrammarLoader({ searchParams }: Pick<PageProps<"/admin/grammar">, "searchParams">) {
  // Dữ liệu theo người đăng nhập: chỉ dựng khi có request thật
  await connection();
  const levels = await getLevelOptions();
  const params = await searchParams;
  const requested = Number(Array.isArray(params.level) ? params.level[0] : params.level);
  const levelId = levels.some((l) => l.id === requested) ? requested : (levels[0]?.id ?? 1);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grammar_points")
    .select(GRAMMAR_COLUMNS)
    .eq("level_id", levelId)
    .order("sort_order", { nullsFirst: false })
    .order("id");
  if (error) console.error("[admin/grammar] Không tải được danh sách:", error);
  const points = (data ?? []).map(toGrammarPoint);

  // Số câu hỏi đang gắn từng điểm (mỗi cấp chỉ vài chục điểm, đếm song song)
  const counts = await Promise.all(
    points.map(async (p) => {
      const { count } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("grammar_point_id", p.id);
      return [p.id, count ?? 0] as const;
    }),
  );

  return (
    <GrammarManager
      levels={levels}
      levelId={levelId}
      points={points}
      questionCounts={Object.fromEntries(counts)}
      loadError={Boolean(error)}
    />
  );
}

function GrammarSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải danh sách ngữ pháp">
      <div className="h-20 w-64 animate-pulse rounded-xl bg-card/60" />
      <div className="h-11 w-80 animate-pulse rounded-xl bg-card/60" />
      <div className="h-[28rem] animate-pulse rounded-[20px] bg-card/60" />
    </div>
  );
}
