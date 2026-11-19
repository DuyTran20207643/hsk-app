"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { BookmarkCheck, ChevronDown, Search } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { FalseFriendChip } from "@/components/ios/chips";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { Switch } from "@/components/ios/switch";
import { Button } from "@/components/ui/button";
import type { LookupOption } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import type { WordRow } from "@/lib/words/word-input";
import { loadMoreVocab } from "./actions";
import { vocabFiltersToQuery, type VocabFilters } from "./filters";
import type { VocabBatch } from "./queries";
import { WordDetailSheet } from "./word-detail-sheet";

type Props = {
  initialBatch: VocabBatch;
  totalCount: number;
  levels: LookupOption[];
  topics: LookupOption[];
  filters: VocabFilters;
  today: string;
};

export function VocabBrowser({ initialBatch, totalCount, levels, topics, filters, today }: Props) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // Bộ lọc hiển thị: đổi ngay khi bấm, không đợi máy chủ tải xong danh sách
  const [shown, setShown] = useOptimistic(filters);
  const [search, setSearch] = useState(filters.q);

  // Đổi bộ lọc → đổi địa chỉ trang → máy chủ tải lại 60 từ đầu tiên
  function applyFilters(change: Partial<VocabFilters>) {
    const next = { ...shown, q: search, ...change };
    startNavigation(() => {
      setShown(next);
      router.replace(`/vocab${vocabFiltersToQuery(next)}`, { scroll: false });
    });
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

  const levelOptions = [{ id: null, name: "Tất cả" }, ...levels];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={`${totalCount} từ · HSK 1–3`}
        title={
          <>
            <span lang="zh-CN" className="font-hanzi">
              词典
            </span>{" "}
            Sổ từ
          </>
        }
      />

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 min-w-64 flex-[2_1_20rem] items-center gap-2 rounded-xl bg-muted px-3">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Tìm từ</span>
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
            const active = (shown.level ?? null) === option.id;
            return (
              <button
                key={option.id ?? "all"}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => applyFilters({ level: option.id })}
                className={cn(segmentItemClass(active), "px-4 whitespace-nowrap")}
              >
                {option.name}
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

        <div className="flex min-h-11 items-center gap-1 rounded-xl bg-muted pl-3">
          <span id="vocab-ff-label" className="text-body">
            Chỉ từ dễ nhầm
          </span>
          <Switch
            aria-labelledby="vocab-ff-label"
            checked={shown.falseFriendOnly}
            onCheckedChange={(checked) => applyFilters({ falseFriendOnly: checked })}
          />
        </div>
      </div>

      {/* Đổi bộ lọc thì dựng lại danh sách từ đầu (bỏ các từ đã "Xem thêm" của bộ lọc cũ) */}
      <VocabResults
        key={vocabFiltersToQuery(filters)}
        initialBatch={initialBatch}
        filters={filters}
        totalCount={totalCount}
        levelName={new Map(levels.map((l) => [l.id, l.name]))}
        today={today}
        dimmed={isNavigating}
      />
    </div>
  );
}

function VocabResults({
  initialBatch,
  filters,
  totalCount,
  levelName,
  today,
  dimmed,
}: {
  initialBatch: VocabBatch;
  filters: VocabFilters;
  totalCount: number;
  levelName: Map<number, string>;
  today: string;
  dimmed: boolean;
}) {
  const [words, setWords] = useState(initialBatch.words);
  const [matchCount, setMatchCount] = useState(initialBatch.matchCount);
  const [reviewDates, setReviewDates] = useState(initialBatch.reviewDates);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [isLoadingMore, startLoadMore] = useTransition();
  // Sheet chi tiết: giữ từ đang xem cả lúc sheet đang đóng dần (hiệu ứng), nên tách riêng "open"
  const [selected, setSelected] = useState<WordRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function loadMore() {
    setLoadMoreError(false);
    startLoadMore(async () => {
      const batch = await loadMoreVocab(filters, words.length);
      if (batch.error) {
        setLoadMoreError(true);
        return;
      }
      setWords((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        return [...prev, ...batch.words.filter((w) => !seen.has(w.id))];
      });
      setMatchCount(batch.matchCount);
      setReviewDates((prev) => ({ ...prev, ...batch.reviewDates }));
    });
  }

  const hasMore = words.length < matchCount;

  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-subheadline text-muted-foreground" aria-live="polite">
        {initialBatch.error
          ? "Không tải được sổ từ. Bạn vui lòng tải lại trang."
          : words.length === 0
            ? totalCount === 0
              ? "Sổ từ chưa có từ nào."
              : "Không tìm thấy từ nào phù hợp. Bạn thử bỏ bớt bộ lọc hoặc gõ từ khác."
            : `Đang hiện ${words.length} / ${matchCount} từ. Bấm một từ để xem chi tiết.`}
      </p>

      {words.length > 0 && (
        <ul
          className={cn(
            "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-4",
            dimmed && "opacity-60",
          )}
          aria-busy={dimmed}
        >
          {words.map((word) => (
            <li key={word.id}>
              <WordCard
                word={word}
                levelName={levelName.get(word.levelId)}
                inReview={word.id in reviewDates}
                onOpen={() => {
                  setSelected(word);
                  setSheetOpen(true);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {(hasMore || loadMoreError) && (
        <div className="flex flex-col items-center gap-2">
          {loadMoreError && (
            <p role="alert" className="text-subheadline text-destructive">
              Không tải thêm được. Bạn vui lòng thử lại.
            </p>
          )}
          <Button variant="gray" onClick={loadMore} disabled={isLoadingMore} className="min-w-40">
            {isLoadingMore ? "Đang tải…" : "Xem thêm"}
          </Button>
        </div>
      )}

      <WordDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        word={selected}
        levelName={selected ? levelName.get(selected.levelId) : undefined}
        dueDate={selected ? (reviewDates[selected.id] ?? null) : null}
        today={today}
        onAdded={(wordId, dueDate) => setReviewDates((prev) => ({ ...prev, [wordId]: dueDate }))}
      />
    </div>
  );
}

function WordCard({
  word,
  levelName,
  inReview,
  onOpen,
}: {
  word: WordRow;
  levelName: string | undefined;
  inReview: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="relative flex h-full w-full flex-col items-center gap-0.5 rounded-[20px] bg-card px-3 pt-5 pb-4 text-center outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-70"
    >
      {inReview && (
        <span className="absolute top-2.5 right-2.5 text-primary">
          <BookmarkCheck className="size-5" aria-hidden />
          <span className="sr-only">Đã có trong bộ ôn tập.</span>
        </span>
      )}
      <span lang="zh-CN" className="font-hanzi text-large-title font-semibold">
        {word.hanzi}
      </span>
      <span className="font-hanzi text-subheadline text-muted-foreground">{word.pinyin}</span>
      {word.hanViet?.trim() && <span className="text-headline text-primary">{word.hanViet}</span>}
      <span className="text-subheadline">{word.meaningVi}</span>
      <span className="mt-auto flex flex-wrap justify-center gap-1.5 pt-2">
        {levelName && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-caption font-bold whitespace-nowrap text-muted-foreground">
            {levelName}
          </span>
        )}
        {word.isFalseFriend && <FalseFriendChip />}
      </span>
    </button>
  );
}
