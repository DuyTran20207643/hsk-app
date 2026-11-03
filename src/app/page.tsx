import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { checkSupabaseConnection } from "@/lib/supabase/check-connection";

// Trang giới thiệu (công khai). Trang tạm; khi làm thật bám theo
// docs/mockups/01-gioi-thieu.png
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="font-hanzi text-5xl text-muted-foreground" lang="zh-CN">
        汉语水平考试
      </p>
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">
        Hệ thống ôn thi HSK
      </h1>
      <p className="max-w-md text-muted-foreground">
        Tự ôn thi HSK 1–3 theo lộ trình đếm ngược tới ngày thi của bạn.
      </p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/auth?mode=signup"
          className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground hover:opacity-90"
        >
          Bắt đầu ôn thi
        </Link>
        <Link
          href="/auth"
          className="flex h-12 items-center justify-center rounded-xl bg-card font-semibold text-primary hover:bg-muted"
        >
          Đăng nhập
        </Link>
      </div>

      {/* Tiêu đề hiện ngay, dòng trạng thái hiện sau khi kiểm tra xong. */}
      <Suspense
        fallback={
          <p className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Đang kiểm tra kết nối Supabase…
          </p>
        }
      >
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}

async function SupabaseStatus() {
  // Kiểm tra lại mỗi lần tải trang, không dùng kết quả cũ lúc build.
  await connection();
  const status = await checkSupabaseConnection();

  if (status.ok) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-50 px-4 py-2 text-green-700 dark:bg-green-950 dark:text-green-300">
        <CircleCheck className="size-4 shrink-0" aria-hidden />
        Kết nối Supabase thành công
      </p>
    );
  }

  return (
    <p className="flex max-w-xl items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-left text-destructive">
      <CircleX className="mt-1 size-4 shrink-0" aria-hidden />
      <span>Kết nối Supabase thất bại: {status.reason}</span>
    </p>
  );
}
