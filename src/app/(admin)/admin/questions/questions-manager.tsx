"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ChevronDown, CircleCheck, CircleX, Info, Plus, Search, Upload } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import type { LookupOption } from "@/lib/lookups";
import type { AdminQuestion } from "@/lib/questions/admin-row";
import { optionsSummary, questionSummary } from "@/lib/questions/summary";
import { QUESTION_TYPE_LABEL, QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, questionFiltersToQuery, type QuestionFilters } from "./filters";
import { QuestionImportSheet } from "./import-sheet";
import { QuestionSheet } from "./question-sheet";

export type GrammarOption = { id: number; title: string; levelId: number };
export type Notice = { tone: "success" | "info" | "error"; text: string };

type Props = {
  questions: AdminQuestion[];
  filteredCount: number;
  totalCount: number;
  levels: LookupOption[];
  topics: LookupOption[];
  grammarPoints: GrammarOption[];
  filters: QuestionFilters;
  loadError: boolean;
};

export function QuestionsManager(props: Props) {
  const { questions, filteredCount, totalCount, levels, topics, grammarPoints, filters, loadError } = props;
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // Bộ lọc hiển thị: đổi ngay khi bấm, không đợi máy chủ tải xong danh sách
  const [shown, setShown] = useOptimistic(filters);
  const [search, setSearch] = useState(filters.q);
  // Sheet thêm / sửa: null là đang đóng; { question: null } là thêm mới
  const [editing, setEditing] = useState<{ question: AdminQuestion | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Đổi bộ lọc → đổi địa chỉ trang → máy chủ tải lại danh sách (luôn về trang 1)
  function applyFilters(change: Partial<QuestionFilters>) {
    const next = { ...shown, q: search, page: 1, ...change };
    // Đổi cấp thì bỏ lọc ngữ pháp của cấp khác
    if (change.level !== undefined && next.grammar) {
      const g = grammarPoints.find((p) => p.id === next.grammar);
      if (g && next.level && g.levelId !== next.level) next.grammar = null;
    }
    startNavigation(() => {
      setShown(next);
      router.replace(`/admin/questions${questionFiltersToQuery(next)}`, { scroll: false });
    });
  }

  function goTo(href: string) {
    startNavigation(() => router.push(href, { scroll: false }));
  }

  // Ô tìm kiếm: đợi bạn ngừng gõ 300ms rồi mới tìm
  const applyRef = useRef(applyFilters);
  useEffect(() => {
    applyRef.current = applyFilters;
  });
  useEffect(() => {
    if (search.trim() === filters.q.trim()) return;
    const timer = setTimeout(() => applyRef.current({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search, filters.q]);

  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const grammarName = new Map(grammarPoints.map((g) => [g.id, g.title]));
  const firstShown = filteredCount === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(filters.page * PAGE_SIZE, filteredCount);
  const pageHref = (page: number) => `/admin/questions${questionFiltersToQuery({ ...filters, page })}`;
  const hasPrev = filters.page > 1;
  const hasNext = filters.page * PAGE_SIZE < filteredCount;
  const levelOptions = [{ value: "", label: "Tất cả" }, ...levels.map((l) => ({ value: String(l.id), label: l.name }))];
  const grammarChoices = grammarPoints.filter((g) => !shown.level || g.levelId === shown.level);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={`${totalCount} câu · HSK 1–3`}
        title={
          <>
            <span lang="zh-CN" className="font-hanzi">
              题库
            </span>{" "}
            Câu hỏi
          </>
        }
        actions={
          <>
            <Button variant="gray" onClick={() => setImportOpen(true)}>
              <Upload className="size-5" aria-hidden />
              Import Excel
            </Button>
            <Button onClick={() => setEditing({ question: null })}>
              <Plus className="size-5" aria-hidden />
              Thêm câu hỏi
            </Button>
          </>
        }
      />

      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}

      {/* Bộ lọc */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 min-w-64 flex-[2_1_20rem] items-center gap-2 rounded-xl bg-muted px-3">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Tìm câu hỏi</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm trong đề bài, câu hỏi, đoạn văn, lời đọc…"
              className="min-h-11 w-full bg-transparent text-body outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div role="radiogroup" aria-label="Lọc theo cấp" className={cn(segmentTrackClass, "flex-none")}>
            {levelOptions.map((option) => {
              const active = String(shown.level ?? "") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => applyFilters({ level: option.value ? Number(option.value) : null })}
                  className={cn(segmentItemClass(active), "px-4 whitespace-nowrap")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Dạng câu"
            value={shown.type ?? ""}
            onChange={(v) => applyFilters({ type: (v || null) as QuestionType | null })}
            options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABEL[t] }))}
          />
          <FilterSelect
            label="Chủ đề"
            value={shown.topic ? String(shown.topic) : ""}
            onChange={(v) => applyFilters({ topic: v ? Number(v) : null })}
            options={topics.map((t) => ({ value: String(t.id), label: t.name }))}
          />
          <FilterSelect
            label="Ngữ pháp"
            value={shown.grammar ? String(shown.grammar) : ""}
            onChange={(v) => applyFilters({ grammar: v ? Number(v) : null })}
            options={grammarChoices.map((g) => ({
              value: String(g.id),
              label: shown.level ? g.title : `${levelName.get(g.levelId) ?? ""} · ${g.title}`,
            }))}
          />
          <FilterSelect
            label="Trạng thái"
            value={shown.status ?? ""}
            onChange={(v) => applyFilters({ status: v === "active" || v === "inactive" ? v : null })}
            options={[
              { value: "active", label: "Đang dùng" },
              { value: "inactive", label: "Ngừng dùng" },
            ]}
          />
        </div>
      </div>

      {/* Bảng: màn hẹp thì cuộn ngang trong khung riêng, trang không bị tràn */}
      <div
        className={cn("relative overflow-x-auto rounded-[20px] bg-card transition-opacity", isNavigating && "opacity-60")}
        aria-busy={isNavigating}
      >
        <table className="w-full min-w-[960px] border-collapse text-left">
          <caption className="sr-only">Danh sách câu hỏi</caption>
          <thead>
            <tr className="border-b border-border text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="px-4 py-3">Cấp</th>
              <th scope="col" className="px-4 py-3">Dạng câu</th>
              <th scope="col" className="w-[40%] px-4 py-3">Nội dung</th>
              <th scope="col" className="px-4 py-3">Chủ đề / Ngữ pháp</th>
              <th scope="col" className="px-4 py-3">Trạng thái</th>
              <th scope="col" className="px-2 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-4 py-3 text-body whitespace-nowrap">{levelName.get(q.levelId) ?? "—"}</td>
                <td className="px-4 py-3 text-subheadline whitespace-nowrap">{QUESTION_TYPE_LABEL[q.type]}</td>
                <td className="px-4 py-3">
                  <p lang="zh-CN" className="font-hanzi text-body">
                    {questionSummary(q.type, q.content, q.audioText)}
                  </p>
                  {optionsSummary(q.content) && (
                    <p className="text-footnote text-muted-foreground">{optionsSummary(q.content)}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-subheadline text-muted-foreground">
                  {[q.topicId ? topicName.get(q.topicId) : null, q.grammarPointId ? grammarName.get(q.grammarPointId) : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-body whitespace-nowrap",
                      q.status === "inactive" && "text-muted-foreground",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", q.status === "active" ? "bg-green" : "bg-input")} aria-hidden />
                    {q.status === "active" ? "Đang dùng" : "Ngừng dùng"}
                  </span>
                </td>
                <td className="px-2 py-1 text-right">
                  <Button variant="plain" className="font-normal" onClick={() => setEditing({ question: q })}>
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-body text-muted-foreground">
                  {loadError
                    ? "Không tải được danh sách câu hỏi. Bạn vui lòng tải lại trang."
                    : totalCount === 0
                      ? "Chưa có câu hỏi nào. Bạn bấm Thêm câu hỏi hoặc Import Excel để bắt đầu."
                      : "Không tìm thấy câu nào phù hợp với bộ lọc."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-subheadline text-muted-foreground" aria-live="polite">
          Hiển thị {firstShown}–{lastShown} trong {filteredCount} câu
        </p>
        <div className="flex gap-2">
          <PageLink href={pageHref(filters.page - 1)} enabled={hasPrev} onNavigate={goTo}>
            Trang trước
          </PageLink>
          <PageLink href={pageHref(filters.page + 1)} enabled={hasNext} onNavigate={goTo}>
            Trang sau
          </PageLink>
        </div>
      </nav>

      <p className="text-footnote text-muted-foreground">
        Câu đã nằm trong đề thi hoặc đã có học viên trả lời thì không xóa được; hệ thống chuyển sang &quot;Ngừng dùng&quot; để giữ
        lịch sử làm bài.
      </p>

      <QuestionSheet
        key={editing ? (editing.question?.id ?? "new") : "closed"}
        open={editing !== null}
        question={editing?.question ?? null}
        levels={levels}
        topics={topics}
        grammarPoints={grammarPoints}
        defaultLevelId={filters.level ?? levels[0]?.id ?? 1}
        defaultType={filters.type ?? "vocab_meaning"}
        onClose={() => setEditing(null)}
        onDone={(n) => {
          setEditing(null);
          setNotice(n);
        }}
      />

      <QuestionImportSheet
        open={importOpen}
        topics={topics}
        grammarPoints={grammarPoints}
        levels={levels}
        onClose={() => setImportOpen(false)}
        onDone={(n) => {
          setImportOpen(false);
          setNotice(n);
        }}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative flex min-h-11 items-center gap-2 rounded-xl bg-muted pr-9 pl-3 focus-within:ring-3 focus-within:ring-ring/50">
      <span className="text-body">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 max-w-56 appearance-none bg-transparent text-body text-primary outline-none"
      >
        <option value="">Tất cả</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-primary" aria-hidden />
    </label>
  );
}

function PageLink({
  href,
  enabled,
  onNavigate,
  children,
}: {
  href: string;
  enabled: boolean;
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}) {
  const className = buttonVariants({ variant: "gray", className: "font-normal" });
  if (!enabled) {
    return (
      <span className={cn(className, "pointer-events-none opacity-40")} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      className={className}
      onNavigate={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </Link>
  );
}

const NOTICE_STYLE = {
  success: { icon: CircleCheck, className: "bg-green-fill text-green" },
  info: { icon: Info, className: "bg-orange-fill text-orange" },
  error: { icon: CircleX, className: "bg-red-fill text-destructive" },
} as const;

function NoticeBanner({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const { icon: Icon, className } = NOTICE_STYLE[notice.tone];
  return (
    <div role="status" className={cn("flex items-center gap-2 rounded-xl py-1 pr-1 pl-4", className)}>
      <Icon className="size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-subheadline font-semibold">{notice.text}</p>
      <Button variant="plain" size="sm" onClick={onClose} className="text-current">
        Đóng
      </Button>
    </div>
  );
}
