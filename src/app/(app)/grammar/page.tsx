import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { GRAMMAR_COLUMNS, toGrammarPoint } from "@/lib/grammar/grammar-input";
import { computeGrammarStats, type AnswerOutcome, type GrammarStats } from "@/lib/grammar/stats";
import { getLevelOptions } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { GrammarBrowser } from "./grammar-browser";

export const metadata: Metadata = { title: "Ngữ pháp · Hệ thống ôn thi HSK" };

// Mockup: docs/mockups/10-ngu-phap.png — Use case UC18, quy tắc điểm yếu BR10.
export default function GrammarPage({ searchParams }: PageProps<"/grammar">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/review"
        className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-body text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Ôn tập
      </Link>
      {/* Đọc phiên đăng nhập (cookie) nên phải nằm trong Suspense */}
      <Suspense fallback={<GrammarSkeleton />}>
        <GrammarLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type AnswerRow = AnswerOutcome & { questions: { grammar_point_id: number | null } | null };

async function GrammarLoader({ searchParams }: Pick<PageProps<"/grammar">, "searchParams">) {
  // getCurrentUser đã gọi connection(): chỉ chạy khi có người truy cập thật
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/grammar");

  const supabase = await createClient();
  const [levels, goalResult, params] = await Promise.all([
    getLevelOptions(),
    // Lọc user_id rõ ràng: quản trị viên được RLS cho đọc mục tiêu của mọi người
    supabase.from("study_goals").select("level_id").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    searchParams,
  ]);

  // Cấp hiển thị: theo địa chỉ trang (?level=), mặc định là cấp mục tiêu của học viên
  const requested = Number(Array.isArray(params.level) ? params.level[0] : params.level);
  const levelIds = new Set(levels.map((l) => l.id));
  const levelId = levelIds.has(requested)
    ? requested
    : levelIds.has(goalResult.data?.level_id ?? -1)
      ? (goalResult.data?.level_id as number)
      : (levels[0]?.id ?? 1);

  // Học viên đọc thẳng bảng grammar_points: RLS chỉ cho thấy dòng đã công khai.
  // Vẫn lọc is_published vì quản trị viên được RLS cho thấy cả dòng đang ẩn.
  const { data, error } = await supabase
    .from("grammar_points")
    .select(GRAMMAR_COLUMNS)
    .eq("level_id", levelId)
    .eq("is_published", true)
    .order("sort_order", { nullsFirst: false })
    .order("id");
  if (error) console.error("[grammar] Không tải được điểm ngữ pháp:", error);
  const points = (data ?? []).map(toGrammarPoint);

  // Tỷ lệ đúng: câu trả lời đã chấm của chính học viên, với câu hỏi gắn các điểm trên
  const stats: Record<number, GrammarStats | null> = {};
  if (points.length > 0) {
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("is_correct, is_flagged, attempts!inner(user_id), questions!inner(grammar_point_id)")
      .eq("attempts.user_id", user.id)
      .in(
        "questions.grammar_point_id",
        points.map((p) => p.id),
      )
      .not("is_correct", "is", null)
      .returns<AnswerRow[]>();
    if (answersError) console.error("[grammar] Không tải được kết quả luyện tập:", answersError);

    const byPoint = new Map<number, AnswerOutcome[]>();
    for (const answer of answers ?? []) {
      const pointId = answer.questions?.grammar_point_id;
      if (pointId == null) continue;
      byPoint.set(pointId, [...(byPoint.get(pointId) ?? []), answer]);
    }
    for (const point of points) stats[point.id] = computeGrammarStats(byPoint.get(point.id) ?? []);
  }

  return (
    <GrammarBrowser
      levels={levels}
      levelId={levelId}
      points={points}
      stats={stats}
      loadError={Boolean(error)}
    />
  );
}

function GrammarSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải ngữ pháp">
      <div className="h-12 w-72 animate-pulse rounded-xl bg-card/60" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="h-96 animate-pulse rounded-[20px] bg-card/60" />
        <div className="hidden h-[32rem] animate-pulse rounded-[20px] bg-card/60 lg:block" />
      </div>
    </div>
  );
}
