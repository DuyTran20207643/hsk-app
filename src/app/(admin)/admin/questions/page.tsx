import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getLevelOptions, getTopicOptions } from "@/lib/lookups";
import { ADMIN_QUESTION_COLUMNS, toAdminQuestion, type AdminQuestion } from "@/lib/questions/admin-row";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, parseQuestionFilters } from "./filters";
import { QuestionsManager, type GrammarOption } from "./questions-manager";

export const metadata: Metadata = { title: "Quản trị câu hỏi · Hệ thống ôn thi HSK" };

// Use case UC13 — Quản trị ngân hàng câu hỏi. Cùng kiểu với /admin/words (16a, 16b).
export default function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  return (
    <Suspense fallback={<QuestionsSkeleton />}>
      <QuestionsLoader searchParams={searchParams} />
    </Suspense>
  );
}

// Bỏ các ký tự có nghĩa đặc biệt trong cú pháp lọc của Supabase (dấu phẩy, ngoặc, %, _…)
function sanitizeSearch(value: string) {
  return value.replace(/[,()%_*\\"'.:]/g, " ").replace(/\s+/g, " ").trim();
}

async function QuestionsLoader({ searchParams }: Pick<PageProps<"/admin/questions">, "searchParams">) {
  // Dữ liệu theo người đăng nhập: chỉ dựng khi có request thật
  await connection();
  const filters = parseQuestionFilters(await searchParams);
  const supabase = await createClient();

  // Cột answer / explanation bị ẩn với mọi tài khoản (0002_rls.sql, mục 7); quản trị viên đọc đầy đủ
  // qua hàm admin_get_questions(). Supabase cho nối thêm bộ lọc, tìm kiếm, phân trang sau lời gọi hàm.
  let list = supabase
    .rpc("admin_get_questions", { p_level_id: filters.level, p_question_type: filters.type }, { count: "exact" })
    .select(ADMIN_QUESTION_COLUMNS);
  if (filters.topic) list = list.eq("topic_id", filters.topic);
  if (filters.grammar) list = list.eq("grammar_point_id", filters.grammar);
  if (filters.status) list = list.eq("status", filters.status);

  const q = sanitizeSearch(filters.q);
  if (q) {
    // Tìm trong đề bài, pinyin, câu hỏi, câu nhận định, đoạn văn, lời đọc và giải thích
    const fields = [
      "content->>stem",
      "content->>pinyin",
      "content->>question",
      "content->>statement",
      "content->>passage",
      "audio_text",
      "explanation",
    ];
    list = list.or(fields.map((f) => `${f}.ilike.%${q}%`).join(","));
  }

  const from = (filters.page - 1) * PAGE_SIZE;
  const [listResult, totalResult, grammarResult, levels, topics] = await Promise.all([
    list.order("level_id").order("question_type").order("id").range(from, from + PAGE_SIZE - 1),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    supabase.from("grammar_points").select("id, title, level_id").order("level_id").order("sort_order", { nullsFirst: false }),
    getLevelOptions(),
    getTopicOptions(),
  ]);

  if (listResult.error) console.error("[admin/questions] Không tải được danh sách:", listResult.error);
  const questions = ((listResult.data ?? []) as Parameters<typeof toAdminQuestion>[0][])
    .map(toAdminQuestion)
    .filter((x): x is AdminQuestion => x !== null);
  const grammarPoints: GrammarOption[] = (grammarResult.data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    levelId: g.level_id,
  }));

  return (
    <QuestionsManager
      questions={questions}
      filteredCount={listResult.count ?? 0}
      totalCount={totalResult.count ?? 0}
      levels={levels}
      topics={topics}
      grammarPoints={grammarPoints}
      filters={filters}
      loadError={Boolean(listResult.error)}
    />
  );
}

function QuestionsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải danh sách câu hỏi">
      <div className="h-20 w-64 animate-pulse rounded-xl bg-card/60" />
      <div className="h-11 animate-pulse rounded-xl bg-card/60" />
      <div className="h-[32rem] animate-pulse rounded-[20px] bg-card/60" />
    </div>
  );
}
