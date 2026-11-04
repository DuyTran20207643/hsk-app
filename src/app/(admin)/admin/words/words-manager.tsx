"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ChevronDown, CircleCheck, CircleX, Info, Plus, Search, Upload } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { FalseFriendChip } from "@/components/ios/chips";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WordRow } from "@/lib/words/word-input";
import { filtersToQuery, PAGE_SIZE, type WordFilters } from "./filters";
import { ImportSheet } from "./import-sheet";
import { WordSheet } from "./word-sheet";

export type Option = { id: number; name: string };
export type Notice = { tone: "success" | "info" | "error"; text: string };

type Props = {
  words: WordRow[];
  filteredCount: number;
  totalCount: number;
  levels: Option[];
  topics: Option[];
  filters: WordFilters;
  loadError: boolean;
};

export function WordsManager({ words, filteredCount, totalCount, levels, topics, filters, loadError }: Props) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // Bộ lọc hiển thị: đổi ngay khi bấm, không đợi máy chủ tải xong danh sách
  const [shown, setShown] = useOptimistic(filters);
  const [search, setSearch] = useState(filters.q);
  // Sheet thêm / sửa: null là đang đóng; { word: null } là thêm mới
  const [editing, setEditing] = useState<{ word: WordRow | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Đổi bộ lọc → đổi địa chỉ trang → máy chủ tải lại danh sách (luôn về trang 1)
  function applyFilters(change: Partial<WordFilters>) {
    const next = { ...shown, q: search, page: 1, ...change };
    startNavigation(() => {
      setShown(next);
      router.replace(`/admin/words${filtersToQuery(next)}`, { scroll: false });
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
  const firstShown = filteredCount === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(filters.page * PAGE_SIZE, filteredCount);
  const pageHref = (page: number) => `/admin/words${filtersToQuery({ ...filters, page })}`;
  const hasPrev = filters.page > 1;
  const hasNext = filters.page * PAGE_SIZE < filteredCount;
  const levelOptions = [{ value: "", label: "Tất cả" }, ...levels.map((l) => ({ value: String(l.id), label: l.name }))];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={`${totalCount} từ · HSK 1–3`}
        title={
          <>
            <span lang="zh-CN" className="font-hanzi">
              词汇
            </span>{" "}
            Từ vựng
          </>
        }
        actions={
          <>
            <Button variant="gray" onClick={() => setImportOpen(true)}>
              <Upload className="size-5" aria-hidden />
              Import Excel
            </Button>
            <Button onClick={() => setEditing({ word: null })}>
              <Plus className="size-5" aria-hidden />
              Thêm từ
            </Button>
          </>
        }
      />

      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 min-w-64 flex-[2_1_20rem] items-center gap-2 rounded-xl bg-muted px-3">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Tìm từ vựng</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm chữ Hán, pinyin, âm Hán Việt hoặc nghĩa"
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

        <label className="relative flex min-h-11 items-center gap-2 rounded-xl bg-muted pr-9 pl-3 focus-within:ring-3 focus-within:ring-ring/50">
          <span className="text-body">Chủ đề</span>
          <select
            value={shown.topic ?? ""}
            onChange={(e) => applyFilters({ topic: e.target.value ? Number(e.target.value) : null })}
            className="min-h-11 max-w-48 appearance-none bg-transparent text-body text-primary outline-none"
          >
            <option value="">Tất cả</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-4 text-primary" aria-hidden />
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-muted px-3">
          <input
            type="checkbox"
            checked={shown.falseFriendOnly}
            onChange={(e) => applyFilters({ falseFriendOnly: e.target.checked })}
            className="size-5 accent-primary"
          />
          <span className="text-body">Chỉ từ dễ nhầm</span>
        </label>
      </div>

      {/* Bảng: màn hẹp thì cuộn ngang trong khung riêng, trang không bị tràn */}
      <div
        className={cn("overflow-x-auto rounded-[20px] bg-card transition-opacity", isNavigating && "opacity-60")}
        aria-busy={isNavigating}
      >
        <table className="w-full min-w-[960px] border-collapse text-left">
          <caption className="sr-only">Danh sách từ vựng</caption>
          <thead>
            <tr className="border-b border-border text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="px-4 py-3">Chữ Hán</th>
              <th scope="col" className="px-4 py-3">Pinyin</th>
              <th scope="col" className="px-4 py-3">Âm Hán Việt</th>
              <th scope="col" className="px-4 py-3">Nghĩa</th>
              <th scope="col" className="px-4 py-3">Cấp</th>
              <th scope="col" className="px-4 py-3">Chủ đề</th>
              <th scope="col" className="px-4 py-3">Dễ nhầm</th>
              <th scope="col" className="px-4 py-3">Trạng thái</th>
              <th scope="col" className="px-2 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {words.map((word) => (
              <tr key={word.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <span lang="zh-CN" className="font-hanzi text-title2">
                    {word.hanzi}
                  </span>
                </td>
                <td className="px-4 py-3 text-body">{word.pinyin}</td>
                <td className="px-4 py-3 text-body font-semibold text-primary">{word.hanViet}</td>
                <td className="px-4 py-3 text-body">{word.meaningVi}</td>
                <td className="px-4 py-3 text-body whitespace-nowrap">{levelName.get(word.levelId) ?? "—"}</td>
                <td className="px-4 py-3 text-body text-muted-foreground">
                  {word.topicId ? topicName.get(word.topicId) : "—"}
                </td>
                <td className="px-4 py-3">
                  {word.isFalseFriend ? (
                    <FalseFriendChip />
                  ) : (
                    <span className="text-muted-foreground">
                      <span aria-hidden>—</span>
                      <span className="sr-only">Không</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusLabel status={word.status} />
                </td>
                <td className="px-2 py-1 text-right">
                  <Button
                    variant="plain"
                    className="font-normal"
                    onClick={() => setEditing({ word })}
                    aria-label={`Sửa từ ${word.hanzi}`}
                  >
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
            {words.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-body text-muted-foreground">
                  {loadError
                    ? "Không tải được danh sách từ vựng. Bạn vui lòng tải lại trang."
                    : totalCount === 0
                      ? "Chưa có từ vựng nào. Bạn bấm Thêm từ hoặc Import Excel để bắt đầu."
                      : "Không tìm thấy từ nào phù hợp với bộ lọc."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-subheadline text-muted-foreground" aria-live="polite">
          Hiển thị {firstShown}–{lastShown} trong {filteredCount} từ
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
        Từ đã dùng trong bài học hoặc lịch ôn không xóa được; hệ thống chuyển sang &quot;Ngừng dùng&quot; để giữ lịch sử học của học viên.
      </p>

      <WordSheet
        key={editing ? (editing.word?.id ?? "new") : "closed"}
        open={editing !== null}
        word={editing?.word ?? null}
        levels={levels}
        topics={topics}
        onClose={() => setEditing(null)}
        onOpenWord={(word) => setEditing({ word })}
        onDone={(n) => {
          setEditing(null);
          setNotice(n);
        }}
      />

      <ImportSheet
        open={importOpen}
        topics={topics}
        onClose={() => setImportOpen(false)}
        onDone={(n) => {
          setImportOpen(false);
          setNotice(n);
        }}
      />
    </div>
  );
}

function StatusLabel({ status }: { status: WordRow["status"] }) {
  const active = status === "active";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-body whitespace-nowrap", !active && "text-muted-foreground")}>
      <span className={cn("size-2 rounded-full", active ? "bg-green" : "bg-input")} aria-hidden />
      {active ? "Đang dùng" : "Ngừng dùng"}
    </span>
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
        // Chuyển trang trong transition để bảng mờ đi ngay khi bấm (biết là đang tải)
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
