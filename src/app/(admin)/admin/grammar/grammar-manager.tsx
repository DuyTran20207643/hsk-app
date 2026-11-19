"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, CircleCheck, CircleX, Plus } from "lucide-react";
import { PageTitle } from "@/components/app-shell/page-title";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { Button } from "@/components/ui/button";
import type { GrammarPoint } from "@/lib/grammar/grammar-input";
import type { LookupOption } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import { moveGrammarPoint } from "./actions";
import { GrammarSheet } from "./grammar-sheet";

export type Notice = { tone: "success" | "error"; text: string };

type Props = {
  levels: LookupOption[];
  levelId: number;
  points: GrammarPoint[];
  questionCounts: Record<number, number>;
  loadError: boolean;
};

export function GrammarManager({ levels, levelId, points, questionCounts, loadError }: Props) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [isMoving, startMoving] = useTransition();
  // Cấp đang chọn và thứ tự: đổi ngay khi bấm, không đợi máy chủ
  const [shownLevel, setShownLevel] = useOptimistic(levelId);
  const [shownPoints, movePoint] = useOptimistic(points, (list, { id, direction }: { id: number; direction: "up" | "down" }) => {
    const next = [...list];
    const from = next.findIndex((p) => p.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= next.length) return list;
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
  // Sheet: null là đang đóng; { point: null } là thêm mới
  const [editing, setEditing] = useState<{ point: GrammarPoint | null } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  function chooseLevel(id: number) {
    startNavigation(() => {
      setShownLevel(id);
      router.replace(`/admin/grammar?level=${id}`, { scroll: false });
    });
  }

  function move(id: number, direction: "up" | "down") {
    startMoving(async () => {
      movePoint({ id, direction });
      const result = await moveGrammarPoint(id, direction);
      if (!result.ok) setNotice({ tone: "error", text: result.message ?? "Chưa sắp xếp được. Bạn thử lại nhé." });
    });
  }

  const levelName = new Map(levels.map((l) => [l.id, l.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={`${points.length} ngữ pháp · ${levelName.get(levelId) ?? ""}`}
        title={
          <>
            <span lang="zh-CN" className="font-hanzi">
              语法
            </span>{" "}
            Ngữ pháp
          </>
        }
        actions={
          <Button onClick={() => setEditing({ point: null })}>
            <Plus className="size-5" aria-hidden />
            Thêm ngữ pháp
          </Button>
        }
      />

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl py-1 pr-1 pl-4",
            notice.tone === "success" ? "bg-green-fill text-green" : "bg-red-fill text-destructive",
          )}
        >
          {notice.tone === "success" ? (
            <CircleCheck className="size-5 shrink-0" aria-hidden />
          ) : (
            <CircleX className="size-5 shrink-0" aria-hidden />
          )}
          <p className="flex-1 text-subheadline font-semibold">{notice.text}</p>
          <Button variant="plain" size="sm" onClick={() => setNotice(null)} className="text-current">
            Đóng
          </Button>
        </div>
      )}

      <div role="radiogroup" aria-label="Chọn cấp" className={cn(segmentTrackClass, "w-fit")}>
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

      <div
        className={cn("relative overflow-x-auto rounded-[20px] bg-card transition-opacity", isNavigating && "opacity-60")}
        aria-busy={isNavigating}
      >
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">Danh sách ngữ pháp {levelName.get(levelId)}</caption>
          <thead>
            <tr className="border-b border-border text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="w-28 px-4 py-3">Thứ tự</th>
              <th scope="col" className="px-4 py-3">Tên ngữ pháp</th>
              <th scope="col" className="px-4 py-3">Cấu trúc</th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">Câu hỏi</th>
              <th scope="col" className="px-4 py-3">Trạng thái</th>
              <th scope="col" className="px-2 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shownPoints.map((point, index) => (
              <tr key={point.id} className="border-b border-border last:border-b-0">
                <td className="px-2 py-1">
                  <div className="flex">
                    <Button
                      variant="plain"
                      size="icon"
                      disabled={index === 0 || isMoving}
                      onClick={() => move(point.id, "up")}
                      aria-label={`Đưa "${point.title}" lên trên`}
                    >
                      <ChevronUp aria-hidden />
                    </Button>
                    <Button
                      variant="plain"
                      size="icon"
                      disabled={index === shownPoints.length - 1 || isMoving}
                      onClick={() => move(point.id, "down")}
                      aria-label={`Đưa "${point.title}" xuống dưới`}
                    >
                      <ChevronDown aria-hidden />
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3 text-body font-semibold">{point.title}</td>
                <td className="px-4 py-3 text-body text-muted-foreground">{point.structure}</td>
                <td className="px-4 py-3 text-body tabular-nums">{questionCounts[point.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-body whitespace-nowrap",
                      !point.isPublished && "text-muted-foreground",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", point.isPublished ? "bg-green" : "bg-input")} aria-hidden />
                    {point.isPublished ? "Công khai" : "Ẩn"}
                  </span>
                </td>
                <td className="px-2 py-1 text-right">
                  <Button
                    variant="plain"
                    className="font-normal"
                    onClick={() => setEditing({ point })}
                    aria-label={`Sửa "${point.title}"`}
                  >
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
            {shownPoints.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-body text-muted-foreground">
                  {loadError
                    ? "Không tải được danh sách ngữ pháp. Bạn vui lòng tải lại trang."
                    : `${levelName.get(levelId) ?? "Cấp này"} chưa có ngữ pháp nào. Bạn bấm Thêm ngữ pháp để bắt đầu.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-footnote text-muted-foreground">
        Học viên chỉ thấy ngữ pháp ở trạng thái Công khai, theo đúng thứ tự trên. Ngữ pháp đã có câu hỏi gắn vào thì không xóa được, chỉ ẩn được.
      </p>

      <GrammarSheet
        key={editing ? (editing.point?.id ?? "new") : "closed"}
        open={editing !== null}
        point={editing?.point ?? null}
        questionCount={editing?.point ? (questionCounts[editing.point.id] ?? 0) : 0}
        levels={levels}
        defaultLevelId={levelId}
        onClose={() => setEditing(null)}
        onDone={(n, savedLevelId) => {
          setEditing(null);
          setNotice(n);
          // Lưu vào cấp khác cấp đang xem thì chuyển danh sách sang cấp đó để thấy ngay
          if (savedLevelId && savedLevelId !== levelId) chooseLevel(savedLevelId);
        }}
      />
    </div>
  );
}
