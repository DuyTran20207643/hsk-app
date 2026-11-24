import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronRight, CirclePlay } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions } from "@/lib/lookups";
import { todayISO } from "@/lib/plan";
import { MODE_LABEL } from "@/lib/practice/session";
import { QUESTION_TYPE_LABEL, type QuestionType } from "@/lib/questions/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { analyzeWeaknesses, correctRateByType, loadAnswerRecords, percent, recentAnswers, groupStats } from "@/lib/weakness";
import { MixedReviewCard, TypePracticeList, type TypeRow } from "./review-forms";

export const metadata: Metadata = { title: "Ôn tập · Hệ thống ôn thi HSK" };

// Trang Ôn tập (mockup docs/mockups/06-on-tap.png): Ôn tổng hợp, 4 lối tắt, Luyện theo dạng câu.
// Mọi số liệu tính ở máy chủ; việc chọn câu hỏi nằm trong database (start_attempt, migration 0010).
export default function ReviewPage({ searchParams }: PageProps<"/review">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Đọc phiên đăng nhập (cookie) nên phải nằm trong Suspense */}
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Thứ tự nhóm và dạng câu trên trang (NGHE / ĐỌC / VIẾT / TỪ VỰNG / NGỮ PHÁP) */
const TYPE_SECTIONS: { title: string; types: QuestionType[] }[] = [
  { title: "Nghe", types: ["listening_picture", "listening_true_false", "listening_short_dialogue", "listening_long_dialogue"] },
  { title: "Đọc", types: ["reading_match", "reading_fill_blank", "reading_comprehension"] },
  { title: "Viết", types: ["writing_order", "writing_hanzi"] },
  { title: "Từ vựng", types: ["vocab_meaning"] },
  { title: "Ngữ pháp", types: ["grammar_fill"] },
];

async function ReviewLoader({ searchParams }: Pick<PageProps<"/review">, "searchParams">) {
  // getCurrentUser đã gọi connection(): chỉ chạy khi có người truy cập thật
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/review");

  const supabase = await createClient();
  const now = new Date();
  const today = todayISO(now);
  // Đầu ngày hôm nay theo giờ Việt Nam (UTC+7, không đổi giờ theo mùa)
  const startOfToday = `${today}T00:00:00+07:00`;

  // Lọc user_id rõ ràng ở mọi bảng: quản trị viên được RLS cho đọc dữ liệu của mọi người
  const [levels, goalResult, params, records, dueResult, reviewedResult, wordResult, inProgressResult] = await Promise.all([
    getLevelOptions(),
    supabase.from("study_goals").select("level_id").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    searchParams,
    loadAnswerRecords(supabase, user.id, now),
    supabase
      .from("srs_cards")
      .select("word_id, words!inner(status)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("due_date", today)
      .eq("words.status", "active"),
    supabase
      .from("srs_cards")
      .select("word_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("last_reviewed_at", startOfToday),
    supabase.from("words").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("attempts")
      .select("id, attempt_type, config, question_ids")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .in("attempt_type", ["practice", "mixed", "weakness"])
      .is("config->>tag", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const [name, result] of [
    ["mục tiêu", goalResult],
    ["thẻ đến hạn", dueResult],
    ["thẻ đã ôn hôm nay", reviewedResult],
    ["số từ", wordResult],
    ["phiên đang làm", inProgressResult],
  ] as const) {
    if (result.error) console.error(`[review] Không tải được ${name}:`, result.error);
  }

  const levelIds = new Set(levels.map((l) => l.id));
  const goalLevel = levelIds.has(goalResult.data?.level_id ?? -1) ? (goalResult.data?.level_id as number) : null;
  const requested = Number(Array.isArray(params.level) ? params.level[0] : params.level);
  const level = levelIds.has(requested) ? requested : (goalLevel ?? levels[0]?.id ?? 1);
  const levelName = (id: number | null) => levels.find((l) => l.id === id)?.name ?? "";

  const [questionResult, grammarResult, inProgressAnswered] = await Promise.all([
    supabase.from("questions").select("question_type").eq("status", "active").eq("level_id", level).limit(10000),
    goalLevel
      ? supabase
          .from("grammar_points")
          .select("id", { count: "exact", head: true })
          .eq("level_id", goalLevel)
          .eq("is_published", true)
      : Promise.resolve({ count: null, error: null }),
    inProgressResult.data
      ? supabase.from("answers").select("id", { count: "exact", head: true }).eq("attempt_id", inProgressResult.data.id)
      : Promise.resolve({ count: null, error: null }),
  ]);
  if (questionResult.error) console.error("[review] Không tải được câu hỏi:", questionResult.error);
  if (grammarResult.error) console.error("[review] Không tải được ngữ pháp:", grammarResult.error);

  // Số câu đang dùng của từng dạng ở cấp đang xem
  const available = new Map<string, number>();
  for (const q of questionResult.data ?? []) available.set(q.question_type, (available.get(q.question_type) ?? 0) + 1);

  // Tỷ lệ đúng 30 ngày qua theo dạng câu (cấp đang xem). Nhãn ĐIỂM YẾU chỉ hiện khi đủ dữ liệu (BR11).
  const levelReport = records ? analyzeWeaknesses(records, level, now) : null;
  const byType = correctRateByType(records ? groupStats(recentAnswers(records, level, now)) : []);
  const sections = TYPE_SECTIONS.map((section) => ({
    title: section.title,
    rows: section.types.map((type): TypeRow => {
      const stats = byType[type];
      return {
        type,
        label: QUESTION_TYPE_LABEL[type],
        correctPercent: stats ? percent(1 - stats.wrongRate) : null,
        answered: stats?.answered ?? 0,
        weak: levelReport?.status === "ok" && stats?.isWeak === true,
        available: (available.get(type) ?? 0) > 0,
      };
    }),
  }));

  // Điểm yếu tính trên cấp mục tiêu
  const goalReport = records && goalLevel ? analyzeWeaknesses(records, goalLevel, now) : null;

  const due = dueResult.count ?? 0;
  const reviewed = reviewedResult.count ?? 0;
  const inProgress = inProgressResult.data;

  return (
    <>
      <PageTitle
        eyebrow={`Hôm nay đã ôn ${reviewed} / ${reviewed + due} thẻ từ`}
        title={
          <>
            <span lang="zh-CN" className="font-hanzi">
              复习
            </span>{" "}
            Ôn tập
          </>
        }
      />

      {inProgress && (
        <section
          aria-labelledby="resume-heading"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-secondary p-4 sm:p-5"
        >
          <div className="flex flex-col">
            <h2 id="resume-heading" className="text-headline">
              Tiếp tục phiên đang làm
            </h2>
            <p className="text-subheadline text-muted-foreground">
              {resumeLabel(inProgress.attempt_type, inProgress.config)}
              {typeof (inProgress.config as { level_id?: unknown })?.level_id === "number" &&
                ` · ${levelName((inProgress.config as { level_id: number }).level_id)}`}
              {` · đã làm ${inProgressAnswered.count ?? 0} / ${inProgress.question_ids.length} câu`}
            </p>
          </div>
          <Link href={`/practice/${inProgress.id}`} className={buttonVariants({ variant: "filled" })}>
            <CirclePlay aria-hidden />
            Tiếp tục
          </Link>
        </section>
      )}

      <MixedReviewCard levels={levels} level={level} />

      <nav aria-label="Lối tắt ôn tập" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <ShortcutCard
          href="/flashcards"
          hanzi="词卡"
          label="Thẻ từ"
          value={dueResult.error ? "—" : `${due} thẻ`}
          note="đến hạn ôn hôm nay"
        />
        <ShortcutCard
          href="/review/weakness"
          hanzi="弱点"
          label="Điểm yếu"
          value={goalReport?.status === "ok" ? `${goalReport.weaknesses.length} mục` : "—"}
          note={
            !goalReport
              ? "chưa có dữ liệu"
              : goalReport.status === "ok"
                ? "sai từ 30% trong 30 ngày qua"
                : "chưa đủ dữ liệu để phân tích"
          }
        />
        <ShortcutCard
          href="/grammar"
          hanzi="语法"
          label="Ngữ pháp"
          value={grammarResult.count === null ? "—" : `${grammarResult.count} mục`}
          note={goalLevel ? `ngữ pháp ${levelName(goalLevel)}` : "theo cấp mục tiêu"}
        />
        <ShortcutCard
          href="/vocab"
          hanzi="词典"
          label="Sổ từ"
          value={wordResult.error ? "—" : `${wordResult.count ?? 0} từ`}
          note="HSK 1–3, kèm âm Hán Việt"
        />
      </nav>

      <section aria-labelledby="types-heading" className="flex flex-col gap-4">
        <div className="px-1">
          <h2 id="types-heading" className="text-title2">
            Luyện theo dạng câu
          </h2>
          <p className="text-subheadline text-muted-foreground">
            10 câu {levelName(level)} mỗi lượt, ưu tiên câu bạn chưa làm. Tỷ lệ đúng tính trong 30 ngày qua.
          </p>
        </div>
        {!records && (
          <p role="alert" className="rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
            Không tải được kết quả luyện tập, nên chưa hiện được tỷ lệ đúng. Bạn vẫn luyện tập được bình thường.
          </p>
        )}
        <TypePracticeList level={level} sections={sections} />
      </section>
    </>
  );
}

/** Tên phiên đang dở: luyện một dạng câu thì ghi tên dạng câu, còn lại ghi chế độ */
function resumeLabel(mode: string, config: unknown): string {
  const types = (config as { question_types?: unknown } | null)?.question_types;
  if (mode === "practice" && Array.isArray(types) && types.length === 1 && types[0] in QUESTION_TYPE_LABEL) {
    return QUESTION_TYPE_LABEL[types[0] as QuestionType];
  }
  return MODE_LABEL[mode] ?? "Luyện tập";
}

function ShortcutCard({
  href,
  hanzi,
  label,
  value,
  note,
}: {
  href: string;
  hanzi: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-36 flex-col justify-between gap-4 rounded-[20px] bg-card p-4 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
    >
      <span className="flex items-center gap-1 text-subheadline">
        <span lang="zh-CN" className="font-hanzi font-semibold">
          {hanzi}
        </span>
        <span className="flex-1 text-muted-foreground"> · {label}</span>
        <ChevronRight className="size-5 shrink-0 text-input" aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="text-title1 font-bold tabular-nums">{value}</span>
        <span className="text-footnote text-muted-foreground">{note}</span>
      </span>
    </Link>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải trang Ôn tập">
      <div className="h-16 w-64 animate-pulse rounded-xl bg-card/60" />
      <div className="h-40 animate-pulse rounded-[20px] bg-card/60" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-36 animate-pulse rounded-[20px] bg-card/60")} />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-card/60" />
    </div>
  );
}
