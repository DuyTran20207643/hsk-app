"use client";

import { Volume2 } from "lucide-react";
import { WeakPointChip } from "@/components/ios/chips";
import { Button } from "@/components/ui/button";
import type { GrammarExample } from "@/lib/grammar/grammar-input";
import { statsLabel, type GrammarStats } from "@/lib/grammar/stats";
import { TTS_UNAVAILABLE_MESSAGE, useChineseSpeech } from "@/lib/tts";
import { cn } from "@/lib/utils";

export type GrammarDetailData = {
  levelName: string;
  title: string;
  structure: string;
  explanation: string;
  examples: GrammarExample[];
};

// Chi tiết một điểm ngữ pháp, bố cục theo mockup docs/mockups/10-ngu-phap.png (khung bên phải).
// Dùng chung cho trang học viên /grammar và khung xem trước ở /admin/grammar, để hai nơi giống hệt nhau.
export function GrammarDetail({
  point,
  stats,
  headingLevel = 2,
}: {
  point: GrammarDetailData;
  stats: GrammarStats | null;
  headingLevel?: 2 | 3;
}) {
  const tts = useChineseSpeech();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          {point.levelName} · Ngữ pháp
        </p>
        <Heading className="text-title1 font-bold break-words">{point.title || "Tên ngữ pháp"}</Heading>
      </div>

      <div className="rounded-[14px] bg-secondary px-4 py-3">
        <p className="text-caption font-semibold tracking-wide text-primary uppercase">Cấu trúc</p>
        <p className="text-title3 font-semibold break-words">{point.structure || "—"}</p>
      </div>

      {point.explanation && <p className="text-body whitespace-pre-line">{point.explanation}</p>}

      {point.examples.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-footnote font-semibold tracking-wide text-muted-foreground uppercase">Ví dụ</p>
          {!tts.available && <p className="text-footnote text-muted-foreground">{TTS_UNAVAILABLE_MESSAGE}</p>}
          {point.examples.map((example, i) => (
            <div key={i} className="flex items-start gap-2 rounded-[14px] bg-muted px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p lang="zh-CN" className="font-hanzi text-title2 break-words">
                  {example.zh}
                </p>
                <p className="font-hanzi text-subheadline text-muted-foreground">{example.pinyin}</p>
                <p className="text-body">{example.vi}</p>
              </div>
              <Button
                variant="plain"
                size="icon"
                className="-mr-2"
                onClick={() => tts.speak(example.zh)}
                disabled={!tts.available || !example.zh.trim()}
                aria-label={`Nghe câu ${example.zh}`}
              >
                <Volume2 aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Luyện tập: sprint sau nối vào trang luyện tập, tạm thời để mờ */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled aria-describedby="grammar-practice-note">
            Luyện 5 câu
          </Button>
          <span className={cn("text-subheadline", stats?.isWeak ? "text-orange" : "text-muted-foreground")}>
            {statsLabel(stats)}
          </span>
          {stats?.isWeak && <WeakPointChip />}
        </div>
        <p id="grammar-practice-note" className="text-footnote text-muted-foreground">
          Sẽ có khi ngân hàng câu hỏi đủ câu cho ngữ pháp này.
        </p>
      </div>
    </article>
  );
}
