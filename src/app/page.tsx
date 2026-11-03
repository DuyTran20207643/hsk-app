import { Suspense } from "react";
import { connection } from "next/server";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { checkSupabaseConnection } from "@/lib/supabase/check-connection";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="font-hanzi text-5xl text-muted-foreground" lang="zh-CN">
        汉语水平考试
      </p>
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">
        Hệ thống ôn thi HSK
      </h1>

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
