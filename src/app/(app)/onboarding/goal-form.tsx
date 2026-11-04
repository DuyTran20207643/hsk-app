"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CircleX, TriangleAlert } from "lucide-react";
import { ListGroup, ListRow } from "@/components/ios/list-group";
import { SegmentedControl } from "@/components/ios/segmented-control";
import { WidgetCard } from "@/components/ios/widget-card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  addDaysISO,
  computeStudyPlan,
  daysBetween,
  DAILY_MINUTE_OPTIONS,
  FINAL_REVIEW_DAYS,
  MAX_DAYS_BEFORE_EXAM,
  MIN_DAYS_BEFORE_EXAM,
  validateExamDate,
  type DailyMinutes,
} from "@/lib/plan";
import { createStudyGoal, type GoalFormState } from "./actions";

export type LevelOption = {
  id: number;
  name: string;
  wordCount: number;
  maxScore: number;
  passScore: number;
};

const MINUTE_OPTIONS = DAILY_MINUTE_OPTIONS.map((m) => ({ value: String(m), label: `${m} phút` }));

type Props = {
  levels: LevelOption[];
  today: string; // "YYYY-MM-DD" theo giờ Việt Nam, do máy chủ tính
  initial: { levelId: number; examDate: string; dailyMinutes: DailyMinutes };
};

export function GoalForm({ levels, today, initial }: Props) {
  const [levelId, setLevelId] = useState(initial.levelId);
  const [examDate, setExamDate] = useState(initial.examDate);
  const [dailyMinutes, setDailyMinutes] = useState<DailyMinutes>(initial.dailyMinutes);
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(createStudyGoal, {});

  const level = levels.find((l) => l.id === levelId) ?? levels[0];
  // BR01 và BR02 tính ngay trên trình duyệt; máy chủ kiểm tra lại khi lưu
  const dateError = validateExamDate(examDate, today);
  const plan = dateError
    ? null
    : computeStudyPlan({
        wordCount: level.wordCount,
        daysLeft: daysBetween(today, examDate),
        dailyMinutes,
      });

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-8">
      <input type="hidden" name="levelId" value={levelId} />

      <ListGroup header="Cấp HSK mục tiêu" role="radiogroup" aria-label="Cấp HSK mục tiêu">
        {levels.map((l) => (
          <ListRow
            key={l.id}
            title={<span className="text-headline">{l.name}</span>}
            subtitle={`${l.wordCount} từ · đạt từ ${l.passScore} / ${l.maxScore} điểm`}
            selected={l.id === levelId}
            onClick={() => setLevelId(l.id)}
          />
        ))}
      </ListGroup>

      <ListGroup
        header="Ngày thi"
        footer={
          dateError ? (
            <span className="flex items-center gap-1.5 text-destructive" role="alert">
              <CircleX className="size-4 shrink-0" aria-hidden />
              {dateError}
            </span>
          ) : (
            `Còn ${plan?.daysLeft} ngày. Ngày thi cần cách hôm nay ít nhất ${MIN_DAYS_BEFORE_EXAM} ngày.`
          )
        }
      >
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 py-2">
          <label htmlFor="exam-date" className="text-headline">
            Ngày thi dự kiến
          </label>
          <input
            id="exam-date"
            name="examDate"
            type="date"
            required
            min={addDaysISO(today, MIN_DAYS_BEFORE_EXAM)}
            max={addDaysISO(today, MAX_DAYS_BEFORE_EXAM)}
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            aria-invalid={Boolean(dateError)}
            className="min-h-11 rounded-lg bg-muted px-3 text-body text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:text-destructive"
          />
        </div>
      </ListGroup>

      <section className="flex flex-col">
        <h2 className="mb-1.5 px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          Thời gian học mỗi ngày
        </h2>
        <SegmentedControl
          label="Thời gian học mỗi ngày"
          name="dailyMinutes"
          options={MINUTE_OPTIONS}
          value={String(dailyMinutes)}
          onChange={(v) => setDailyMinutes(Number(v) as DailyMinutes)}
        />
      </section>

      <WidgetCard className="p-6" aria-live="polite">
        <h2 className="flex items-baseline gap-2 text-title3 font-bold">
          <span lang="zh-CN" className="font-hanzi text-body font-normal">
            计划
          </span>
          Lộ trình đề xuất
        </h2>

        {plan ? (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <PlanStat label="Mỗi ngày" value={`${plan.newWordsPerDay} từ mới`} note="và 1 bài học" />
              <PlanStat
                label="Thời gian cần"
                value={`~ ${plan.minutesNeeded} phút`}
                note={`bạn chọn ${plan.dailyMinutes} phút`}
                warning={plan.tooDense}
              />
              <PlanStat label={`${FINAL_REVIEW_DAYS} ngày cuối`} value="Thi thử" note="và ôn điểm yếu" />
            </div>

            {plan.tooDense && (
              <div className="mt-4 flex gap-2 rounded-xl bg-orange-fill px-4 py-3 text-orange" role="status">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p className="text-subheadline">
                  <strong className="font-semibold">Thiếu thời gian ôn tập.</strong> Mỗi ngày cần khoảng{" "}
                  {plan.minutesNeeded} phút, nhiều hơn {plan.dailyMinutes} phút bạn chọn. Bạn hãy tăng
                  thời gian học mỗi ngày hoặc chọn ngày thi muộn hơn.
                </p>
              </div>
            )}

            <p className="mt-4 text-body text-muted-foreground">
              {level.wordCount} từ chia cho {plan.studyDays} ngày học. Nếu bạn bỏ lỡ một ngày, phần còn
              lại tự chia đều vào các ngày sau.
            </p>
          </>
        ) : (
          <p className="mt-3 text-body text-muted-foreground">
            Chọn ngày thi hợp lệ để xem lộ trình đề xuất.
          </p>
        )}
      </WidgetCard>

      <div className="flex flex-col gap-2">
        {state.error && (
          <p className="flex gap-2 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive" role="alert">
            <CircleX className="mt-px size-5 shrink-0" aria-hidden />
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending || Boolean(dateError)} className="w-full">
          {pending ? "Đang tạo lộ trình…" : "Tạo lộ trình"}
        </Button>
        <Link href="/home" className={buttonVariants({ variant: "plain", className: "font-normal" })}>
          Để sau
        </Link>
      </div>
    </form>
  );
}

function PlanStat({
  label,
  value,
  note,
  warning,
}: {
  label: string;
  value: string;
  note: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl bg-background px-4 py-3">
      <p className="text-subheadline text-muted-foreground">{label}</p>
      <p className={warning ? "text-title2 font-bold text-orange" : "text-title2 font-bold"}>{value}</p>
      <p className="text-subheadline text-muted-foreground">{note}</p>
    </div>
  );
}
