import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageTitle } from "@/components/app-shell/page-title";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO, validateExamDate, type DailyMinutes } from "@/lib/plan";
import { GoalForm, type LevelOption } from "./goal-form";

export const metadata: Metadata = { title: "Đặt mục tiêu ôn thi · Hệ thống ôn thi HSK" };

// Mockup: docs/mockups/03-dat-muc-tieu.png
export default function OnboardingPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageTitle eyebrow="Chào mừng bạn" title="Đặt mục tiêu ôn thi" />
      <p className="mt-2 text-body text-muted-foreground">
        Cho biết bạn thi cấp nào và vào ngày nào. Hệ thống sẽ chia bài học thành từng ngày cho bạn.
      </p>
      {/* Đọc dữ liệu của người học và ngày hôm nay nên tải sau phần tiêu đề */}
      <Suspense fallback={<div className="mt-8 h-[36rem] animate-pulse rounded-[20px] bg-card/60" />}>
        <GoalFormLoader />
      </Suspense>
    </div>
  );
}

const DEFAULT_DAYS_BEFORE_EXAM = 60;

async function GoalFormLoader() {
  await connection(); // "hôm nay" phải tính lúc có người truy cập, không tính lúc build
  const supabase = await createClient();
  const today = todayISO();

  const [levelsResult, goalResult] = await Promise.all([
    supabase
      .from("hsk_levels")
      .select("id, name, word_count, max_score, pass_score")
      .order("sort_order"),
    supabase
      .from("study_goals")
      .select("level_id, exam_date, daily_minutes")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const levels: LevelOption[] = (levelsResult.data ?? []).map((level) => ({
    id: level.id,
    name: level.name,
    wordCount: level.word_count ?? 0,
    maxScore: level.max_score ?? 0,
    passScore: level.pass_score ?? 0,
  }));
  if (levels.length === 0) {
    return (
      <p className="mt-8 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
        Không tải được danh sách cấp HSK. Bạn vui lòng tải lại trang.
      </p>
    );
  }

  // Đã có mục tiêu thì điền sẵn, chưa có thì gợi ý HSK 1, thi sau 60 ngày, 30 phút mỗi ngày
  const goal = goalResult.data;
  const goalDateValid = goal && !validateExamDate(goal.exam_date, today);
  const initial = {
    levelId: goal?.level_id ?? levels[0].id,
    examDate: goalDateValid ? goal.exam_date : addDaysISO(today, DEFAULT_DAYS_BEFORE_EXAM),
    dailyMinutes: (goal?.daily_minutes ?? 30) as DailyMinutes,
  };

  return <GoalForm levels={levels} today={today} initial={initial} />;
}
