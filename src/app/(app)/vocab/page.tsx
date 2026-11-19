import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getLevelOptions, getTopicOptions } from "@/lib/lookups";
import { todayISO } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { parseVocabFilters } from "./filters";
import { loadVocabBatch } from "./queries";
import { VocabBrowser } from "./vocab-browser";

export const metadata: Metadata = { title: "Sổ từ · Hệ thống ôn thi HSK" };

// Mockup: docs/mockups/09-so-tu.png (lưới từ), 08b-the-tu-mat-sau.png (bố cục sheet chi tiết)
// Use case UC04 — Tra cứu sổ từ.
export default function VocabPage({ searchParams }: PageProps<"/vocab">) {
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
      <Suspense fallback={<VocabSkeleton />}>
        <VocabLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function VocabLoader({ searchParams }: Pick<PageProps<"/vocab">, "searchParams">) {
  // getCurrentUser đã gọi connection(): chỉ chạy khi có người truy cập thật
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/vocab");

  const filters = parseVocabFilters(await searchParams);
  const supabase = await createClient();

  const [batch, totalResult, levels, topics] = await Promise.all([
    loadVocabBatch(user.id, filters, 0),
    supabase.from("words").select("id", { count: "exact", head: true }).eq("status", "active"),
    getLevelOptions(),
    getTopicOptions(),
  ]);

  return (
    <VocabBrowser
      initialBatch={batch}
      totalCount={totalResult.count ?? 0}
      levels={levels}
      topics={topics}
      filters={filters}
      today={todayISO()}
    />
  );
}

function VocabSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải sổ từ">
      <div className="h-20 w-64 animate-pulse rounded-xl bg-card/60" />
      <div className="h-11 animate-pulse rounded-xl bg-card/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-[20px] bg-card/60" />
        ))}
      </div>
    </div>
  );
}
