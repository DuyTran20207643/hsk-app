"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GrammarDetail } from "@/components/grammar/grammar-detail";
import { WeakPointChip } from "@/components/ios/chips";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import type { GrammarPoint } from "@/lib/grammar/grammar-input";
import { statsLabel, type GrammarStats } from "@/lib/grammar/stats";
import type { LookupOption } from "@/lib/lookups";
import { cn } from "@/lib/utils";

type Props = {
  levels: LookupOption[];
  levelId: number;
  points: GrammarPoint[];
  stats: Record<number, GrammarStats | null>;
  loadError: boolean;
};

// Màn Ngữ pháp: danh sách bên trái, chi tiết bên phải (màn rộng).
// Trên điện thoại hai phần xếp chồng: bấm một điểm thì mở chi tiết, có nút quay lại danh sách.
// Điểm đang xem lưu trên địa chỉ trang (?point=…) để nút Quay lại của trình duyệt hoạt động đúng.
export function GrammarBrowser({ levels, levelId, points, stats, loadError }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();
  const [shownLevel, setShownLevel] = useOptimistic(levelId);

  const pointParam = Number(searchParams.get("point"));
  // selected: điểm người dùng đã bấm (null = đang ở danh sách trên điện thoại)
  const selected = points.find((p) => p.id === pointParam) ?? null;
  // Màn rộng luôn hiện một điểm: điểm đã bấm, hoặc điểm đầu tiên
  const shown = selected ?? points[0] ?? null;
  const levelName = new Map(levels.map((l) => [l.id, l.name]));

  function chooseLevel(id: number) {
    startNavigation(() => {
      setShownLevel(id);
      router.replace(`/grammar?level=${id}`, { scroll: false });
    });
  }

  // Đổi điểm đang xem mà không tải lại dữ liệu từ máy chủ (dữ liệu của cả cấp đã có sẵn)
  function choosePoint(id: number) {
    window.history.pushState(null, "", `/grammar?level=${levelId}&point=${id}`);
    if (!window.matchMedia("(min-width: 64rem)").matches) window.scrollTo({ top: 0 });
  }

  function backToList() {
    window.history.replaceState(null, "", `/grammar?level=${levelId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-large-title">
          <span lang="zh-CN" className="font-hanzi">
            语法
          </span>{" "}
          Ngữ pháp
        </h1>
        <div role="radiogroup" aria-label="Chọn cấp" className={segmentTrackClass}>
          {levels.map((level) => (
            <button
              key={level.id}
              type="button"
              role="radio"
              aria-checked={shownLevel === level.id}
              onClick={() => chooseLevel(level.id)}
              className={cn(segmentItemClass(shownLevel === level.id), "px-5")}
            >
              {level.name}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="rounded-[20px] bg-card px-4 py-12 text-center text-body text-muted-foreground">
          {loadError
            ? "Không tải được ngữ pháp. Bạn vui lòng tải lại trang."
            : `${levelName.get(levelId) ?? "Cấp này"} chưa có ngữ pháp nào. Bạn quay lại sau nhé.`}
        </p>
      ) : (
        <div
          className={cn(
            "grid items-start gap-4 transition-opacity lg:grid-cols-[minmax(0,22rem)_1fr]",
            isNavigating && "opacity-60",
          )}
          aria-busy={isNavigating}
        >
          {/* Danh sách */}
          <nav aria-label={`Ngữ pháp ${levelName.get(levelId) ?? ""}`} className={cn(selected && "hidden lg:block")}>
            <ul className="overflow-hidden rounded-[20px] bg-card">
              {points.map((point) => {
                const pointStats = stats[point.id] ?? null;
                const active = shown?.id === point.id;
                return (
                  <li key={point.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => choosePoint(point.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                        active && "lg:bg-secondary lg:hover:bg-secondary",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-headline break-words">{point.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span
                            className={cn(
                              "text-subheadline",
                              pointStats?.isWeak ? "text-orange" : "text-muted-foreground",
                            )}
                          >
                            {statsLabel(pointStats)}
                          </span>
                          {pointStats?.isWeak && <WeakPointChip />}
                        </span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Chi tiết */}
          {shown && (
            <div className={cn("flex flex-col gap-2", !selected && "hidden lg:flex")}>
              <button
                type="button"
                onClick={backToList}
                className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-body text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
              >
                <ChevronLeft className="size-5" aria-hidden />
                Danh sách
              </button>
              <div className="rounded-[20px] bg-card p-5 sm:p-8">
                <GrammarDetail
                  key={shown.id}
                  point={{
                    levelName: levelName.get(shown.levelId) ?? "",
                    title: shown.title,
                    structure: shown.structure,
                    explanation: shown.explanation,
                    examples: shown.examples,
                  }}
                  stats={stats[shown.id] ?? null}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
