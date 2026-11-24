import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronLeft, CircleCheck, Info } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeWeaknesses,
  loadAnswerRecords,
  MAX_WEAKNESS_CHOICES,
  MIN_ANSWERS_FOR_ANALYSIS,
  percent,
  WEAK_MIN_ANSWERS,
  WEAKNESS_WINDOW_DAYS,
} from "@/lib/weakness";
import { MixedStartButton, WeaknessChoices } from "./weakness-forms";
import { loadWeaknessLabels } from "../weakness-labels";

export const metadata: Metadata = { title: "Ôn điểm yếu · Hệ thống ôn thi HSK" };

// Màn chọn điểm yếu để ôn (UC09, BR10, BR11). Điểm yếu tính ở máy chủ bằng src/lib/weakness.ts,
// trên các câu trả lời 30 ngày gần nhất thuộc cấp mục tiêu.
export default function WeaknessPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/review"
        className="-ml-2 -mb-4 flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-body text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Ôn tập
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-card/60" aria-busy="true" aria-label="Đang tải" />}>
        <WeaknessLoader />
      </Suspense>
    </div>
  );
}

async function WeaknessLoader() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/review/weakness");

  const supabase = await createClient();
  const now = new Date();
  const [levels, goalResult, records] = await Promise.all([
    getLevelOptions(),
    supabase.from("study_goals").select("level_id").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    loadAnswerRecords(supabase, user.id, now),
  ]);
  if (goalResult.error) console.error("[review] Không tải được mục tiêu:", goalResult.error);

  const title = (
    <PageTitle
      eyebrow={`${WEAKNESS_WINDOW_DAYS} ngày qua`}
      title={
        <>
          <span lang="zh-CN" className="font-hanzi">
            弱点
          </span>{" "}
          Ôn điểm yếu
        </>
      }
    />
  );

  const goalLevel = goalResult.data?.level_id ?? null;
  if (!goalLevel) {
    return (
      <>
        {title}
        <Message
          heading="Bạn chưa đặt mục tiêu ôn thi"
          body="Điểm yếu được tính theo cấp HSK bạn đang ôn. Bạn đặt mục tiêu trước nhé."
          action={
            <Link href="/onboarding" className={buttonVariants({ variant: "filled" })}>
              Đặt mục tiêu
            </Link>
          }
        />
      </>
    );
  }
  const levelName = levels.find((l) => l.id === goalLevel)?.name ?? `HSK ${goalLevel}`;

  if (!records) {
    return (
      <>
        {title}
        <p role="alert" className="rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
          Không tải được kết quả luyện tập. Bạn vui lòng tải lại trang.
        </p>
      </>
    );
  }

  const report = analyzeWeaknesses(records, goalLevel, now);

  if (report.status === "not_enough_data") {
    return (
      <>
        {title}
        <Message
          icon={<Info className="size-12 text-primary" aria-hidden />}
          heading="Chưa đủ dữ liệu để tìm điểm yếu"
          body={`Trong ${WEAKNESS_WINDOW_DAYS} ngày qua bạn mới trả lời ${report.answered} câu ${levelName}. Cần ít nhất ${MIN_ANSWERS_FOR_ANALYSIS} câu để phân tích. Bạn làm thêm một lượt Ôn tổng hợp nhé.`}
          action={<MixedStartButton level={goalLevel} label={`Ôn tổng hợp ${levelName} · 30 câu`} />}
        />
      </>
    );
  }

  if (report.weaknesses.length === 0) {
    return (
      <>
        {title}
        <Message
          icon={<CircleCheck className="size-12 text-green" aria-hidden />}
          heading="Chúc mừng, bạn chưa có điểm yếu nào"
          body={`Mọi dạng câu, chủ đề và ngữ pháp ${levelName} bạn đã làm trong ${WEAKNESS_WINDOW_DAYS} ngày qua đều sai dưới 30%. Bạn thử Ôn tổng hợp hoặc luyện một dạng câu khác nhé.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <MixedStartButton level={goalLevel} label={`Ôn tổng hợp ${levelName}`} />
              <Link href="/review" className={buttonVariants({ variant: "gray" })}>
                Luyện theo dạng câu
              </Link>
            </div>
          }
        />
      </>
    );
  }

  const labels = await loadWeaknessLabels(
    supabase,
    report.weaknesses.map((w) => w.target),
  );
  const top = report.weaknesses.slice(0, MAX_WEAKNESS_CHOICES).map((w) => ({
    key: w.key,
    kind: labels.get(w.key)?.kind ?? "",
    name: labels.get(w.key)?.name ?? w.key,
    wrongPercent: percent(w.wrongRate),
    answered: w.answered,
  }));

  return (
    <>
      {title}
      <p className="text-body text-muted-foreground">
        Tính trên {report.answered} câu {levelName} bạn đã trả lời. Điểm yếu là nhóm có từ {WEAK_MIN_ANSWERS} câu trở lên và
        sai từ 30% trở lên; câu đúng nhưng bạn chưa chắc chắn cũng tính là sai.
        {report.weaknesses.length > MAX_WEAKNESS_CHOICES &&
          ` Bạn có ${report.weaknesses.length} điểm yếu, dưới đây là ${MAX_WEAKNESS_CHOICES} điểm nặng nhất.`}
      </p>
      <WeaknessChoices choices={top} total={report.weaknesses.length} />
    </>
  );
}

function Message({
  icon,
  heading,
  body,
  action,
}: {
  icon?: React.ReactNode;
  heading: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <section role="status" className="flex flex-col items-center gap-3 rounded-[20px] bg-card p-6 text-center">
      {icon}
      <h2 className="text-title2">{heading}</h2>
      <p className="max-w-lg text-body text-muted-foreground">{body}</p>
      {action}
    </section>
  );
}
