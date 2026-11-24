import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PracticeSession } from "@/components/practice/practice-session";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions } from "@/lib/lookups";
import type { SessionView } from "@/lib/practice/session";
import { QUESTION_TYPE_LABEL, isQuestionType } from "@/lib/questions/types";
import { createClient } from "@/lib/supabase/server";
import { parseWeaknessKey, type WeaknessTarget } from "@/lib/weakness";
import { loadWeaknessLabels } from "../../review/weakness-labels";
import { loadSession } from "../queries";

export const metadata: Metadata = { title: "Làm bài · Hệ thống ôn thi HSK" };

// Trang làm bài của 3 chế độ trên trang Ôn tập: Ôn tổng hợp (mockup 07-on-tong-hop.png),
// Luyện theo dạng câu, Ôn điểm yếu. Mở lại được phiên đang làm dở (địa chỉ có mã phiên).
export default function PracticeSessionPage({ params }: PageProps<"/practice/[attemptId]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 w-full max-w-3xl animate-pulse rounded-[20px] bg-card/60" aria-busy="true" aria-label="Đang tải" />}>
      <SessionLoader params={params} />
    </Suspense>
  );
}

async function SessionLoader({ params }: Pick<PageProps<"/practice/[attemptId]">, "params">) {
  const { attemptId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?next=/practice/${attemptId}`);

  const session = await loadSession(attemptId);
  if (!session) notFound();
  // Phiên thử của quản trị viên mở ở trang thử
  if (session.tag === "dev") redirect(`/practice/dev?attempt=${session.id}`);

  const levels = await getLevelOptions();
  const levelName = levels.find((l) => l.id === session.levelId)?.name ?? null;
  const { title, comparison } = await describe(session, levelName);

  const shown = session.questions.length;
  const notice =
    session.mode === "mixed" && session.requestedCount !== null && shown < session.requestedCount
      ? `Hiện có ${shown} câu${levelName ? ` ${levelName}` : ""} trong ngân hàng câu hỏi, nên phiên này có ${shown} câu thay vì ${session.requestedCount}.`
      : undefined;

  return (
    <PracticeSession
      key={session.id}
      session={session}
      title={title}
      backHref={session.mode === "weakness" ? "/review/weakness" : "/review"}
      backLabel={session.mode === "weakness" ? "Điểm yếu" : "Ôn tập"}
      notice={notice}
      comparison={comparison}
    />
  );
}

async function describe(
  session: SessionView,
  levelName: string | null,
): Promise<{ title: string; comparison: { baseline: number; subject: string } | null }> {
  const suffix = levelName ? ` · ${levelName}` : "";

  if (session.mode === "mixed") return { title: `Ôn tổng hợp${suffix}`, comparison: null };

  if (session.mode === "weakness") {
    const targets = session.targets.map(parseWeaknessKey).filter((t): t is WeaknessTarget => t !== null);
    const labels = await loadWeaknessLabels(await createClient(), targets);
    const subject =
      targets.length === 1 ? (labels.get(session.targets[0])?.name ?? "Điểm yếu") : `${targets.length} điểm yếu`;
    return {
      title: `Ôn điểm yếu · ${subject}`,
      comparison: session.baseline !== null ? { baseline: session.baseline, subject } : null,
    };
  }

  // Luyện theo dạng câu: tên dạng câu lấy từ câu hỏi (mọi câu cùng một dạng)
  const types = new Set(session.questions.map((q) => q.question.type));
  const [only] = types;
  const name = types.size === 1 && isQuestionType(only) ? QUESTION_TYPE_LABEL[only] : "Luyện tập";
  return { title: `${name}${suffix}`, comparison: null };
}
