import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { StatusChip } from "@/components/ios/chips";
import { PracticeSession } from "@/components/practice/practice-session";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { loadSession } from "../queries";
import { DevStartForm } from "./dev-start-form";

export const metadata: Metadata = { title: "Thử bộ máy làm bài · Hệ thống ôn thi HSK" };

// Trang THỬ bộ máy phiên làm bài (nhiệm vụ 9), chỉ quản trị viên vào được.
// Tạo phiên 5 câu ngẫu nhiên bằng đúng các hàm học viên sẽ dùng (start_attempt, submit_answer…).
// Phiên được lưu như phiên thật của chính tài khoản quản trị (nhãn "dev").
export default function PracticeDevPage({ searchParams }: PageProps<"/practice/dev">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-card/60" aria-busy="true" aria-label="Đang tải" />}>
      <DevLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function DevLoader({ searchParams }: Pick<PageProps<"/practice/dev">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/practice/dev");
  // Không phải quản trị viên: coi như trang không tồn tại
  if (user.role !== "admin") notFound();

  const params = await searchParams;
  const attemptId = typeof params.attempt === "string" ? params.attempt : null;

  if (attemptId) {
    const session = await loadSession(attemptId);
    if (!session) notFound();
    return <PracticeSession key={session.id} session={session} title="Thử bộ máy làm bài" backHref="/practice/dev" backLabel="Trang thử" />;
  }

  const supabase = await createClient();
  const [levels, recent] = await Promise.all([
    getLevelOptions(),
    supabase
      .from("attempts")
      .select("id, status, started_at, correct_count, question_ids")
      .eq("user_id", user.id)
      .eq("config->>tag", "dev")
      .order("started_at", { ascending: false })
      .limit(8),
  ]);
  if (recent.error) console.error("[practice/dev] Không tải được phiên gần đây:", recent.error);

  const time = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageTitle eyebrow="Chỉ dành cho quản trị viên" title="Thử bộ máy làm bài" />
      <section className="flex flex-col gap-3 rounded-[20px] bg-card p-4 sm:p-6">
        <p className="text-body">
          Tạo một phiên 5 câu ngẫu nhiên trong ngân hàng câu hỏi (chỉ câu Đang dùng; bỏ câu Nghe – chọn tranh chưa đủ 3 ảnh).
          Phiên dùng đúng bộ máy học viên sẽ dùng: máy chủ chấm từng câu, đáp án chỉ hiện sau khi nộp câu đó.
        </p>
        <DevStartForm levels={levels} />
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
        <h2 id="recent-heading" className="px-1 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          Phiên thử gần đây
        </h2>
        {(recent.data ?? []).length === 0 ? (
          <p className="rounded-[20px] bg-card px-4 py-6 text-center text-body text-muted-foreground">Chưa có phiên thử nào.</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-[20px] bg-card">
            {(recent.data ?? []).map((a) => (
              <li key={a.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/practice/dev?attempt=${a.id}`}
                  className="flex min-h-12 items-center gap-3 px-4 py-2 outline-none hover:bg-muted/60 focus-visible:bg-muted"
                >
                  <span className="flex-1 text-body tabular-nums">{time.format(new Date(a.started_at))}</span>
                  {a.status === "submitted" ? (
                    <StatusChip status="correct" label={`Xong · ${a.correct_count ?? 0}/${a.question_ids.length} đúng`} />
                  ) : (
                    <StatusChip status="unsure" label="Đang làm dở" />
                  )}
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
