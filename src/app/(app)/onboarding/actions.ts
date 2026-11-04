"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DAILY_MINUTE_OPTIONS, todayISO, validateExamDate } from "@/lib/plan";

export type GoalFormState = { error?: string };

const SAVE_ERROR = "Chưa lưu được mục tiêu. Bạn vui lòng thử lại.";

// Lưu mục tiêu ôn thi mới. Mọi dữ liệu từ form đều được kiểm tra lại ở máy chủ.
export async function createStudyGoal(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const levelId = Number(formData.get("levelId"));
  const dailyMinutes = Number(formData.get("dailyMinutes"));
  const examDate = String(formData.get("examDate") ?? "");

  if (!(DAILY_MINUTE_OPTIONS as readonly number[]).includes(dailyMinutes)) {
    return { error: "Bạn hãy chọn thời gian học mỗi ngày." };
  }
  // BR01, tính theo ngày hôm nay ở máy chủ (giờ Việt Nam)
  const dateError = validateExamDate(examDate, todayISO());
  if (dateError) return { error: dateError };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/auth?next=/onboarding");

  const { data: level } = await supabase
    .from("hsk_levels")
    .select("id")
    .eq("id", levelId)
    .maybeSingle();
  if (!level) return { error: "Bạn hãy chọn cấp HSK mục tiêu." };

  // 1. Tắt mục tiêu đang hoạt động cũ (mỗi người chỉ có một mục tiêu đang hoạt động)
  const { data: oldGoals, error: deactivateError } = await supabase
    .from("study_goals")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true)
    .select("id");
  if (deactivateError) {
    console.error("[onboarding] Không tắt được mục tiêu cũ:", deactivateError);
    return { error: SAVE_ERROR };
  }

  // 2. Lưu mục tiêu mới
  const { error: insertError } = await supabase.from("study_goals").insert({
    user_id: userId,
    level_id: levelId,
    exam_date: examDate,
    daily_minutes: dailyMinutes,
  });
  if (insertError) {
    console.error("[onboarding] Không lưu được mục tiêu mới:", insertError);
    // Lưu thất bại thì bật lại mục tiêu cũ, để người học không bị mất mục tiêu
    if (oldGoals?.length) {
      await supabase
        .from("study_goals")
        .update({ is_active: true })
        .in("id", oldGoals.map((goal) => goal.id));
    }
    return { error: SAVE_ERROR };
  }

  redirect("/home");
}
