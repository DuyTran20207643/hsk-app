"use client";

import { TriangleAlert, Volume2 } from "lucide-react";
import { FalseFriendChip, HanVietChip } from "@/components/ios/chips";
import { Button } from "@/components/ui/button";
import { TTS_UNAVAILABLE_MESSAGE, useChineseSpeech } from "@/lib/tts";
import type { WordRow } from "@/lib/words/word-input";

// Nội dung chi tiết một từ, bố cục theo mặt sau thẻ từ (docs/mockups/08b-the-tu-mat-sau.png):
// ảnh minh họa, pinyin, chữ Hán cỡ lớn, chip âm Hán Việt + nút nghe, nghĩa, nhãn, câu ví dụ.
// Dùng chung cho sheet chi tiết ở Sổ từ (/vocab) và mặt sau thẻ ở Ôn thẻ từ (/flashcards).
export function WordDetails({ word, levelName }: { word: WordRow; levelName?: string }) {
  const tts = useChineseSpeech();
  const noteId = `tts-note-${word.id}`;

  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      {word.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh trong Supabase Storage, kích thước tùy ý
        <img
          src={word.imageUrl}
          alt={`Ảnh minh họa cho từ ${word.meaningVi}`}
          className="max-h-48 w-full rounded-xl bg-secondary object-contain"
        />
      )}

      <div className="flex flex-col items-center gap-1">
        <span className="font-hanzi text-body text-muted-foreground">{word.pinyin}</span>
        <span lang="zh-CN" className="font-hanzi text-[4rem] leading-tight font-semibold">
          {word.hanzi}
        </span>
        <div className="flex items-center gap-2">
          {word.hanViet?.trim() && <HanVietChip>{word.hanViet}</HanVietChip>}
          <Button
            variant="tinted"
            size="icon"
            onClick={(e) => {
              e.stopPropagation(); // không kích hoạt thao tác của khung bên ngoài (ví dụ lật thẻ)
              tts.speak(word.hanzi);
            }}
            disabled={!tts.available}
            aria-label={`Nghe phát âm từ ${word.hanzi}`}
            aria-describedby={tts.available ? undefined : noteId}
          >
            <Volume2 aria-hidden />
          </Button>
        </div>
        {!tts.available && (
          <p id={noteId} className="max-w-sm text-footnote text-muted-foreground">
            {TTS_UNAVAILABLE_MESSAGE}
          </p>
        )}
        <p className="mt-1 text-title3">{word.meaningVi}</p>
        {(levelName || word.isFalseFriend) && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {levelName && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-caption font-bold text-muted-foreground">
                {levelName}
              </span>
            )}
            {word.isFalseFriend && <FalseFriendChip />}
          </div>
        )}
      </div>

      {word.exampleZh?.trim() && (
        <div className="flex w-full flex-col items-center gap-1 border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <p lang="zh-CN" className="font-hanzi text-title3">
              {word.exampleZh}
            </p>
            {tts.available && (
              <Button
                variant="plain"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  tts.speak(word.exampleZh ?? "");
                }}
                aria-label="Nghe câu ví dụ"
              >
                <Volume2 aria-hidden />
              </Button>
            )}
          </div>
          {word.exampleVi?.trim() && <p className="text-body text-muted-foreground">{word.exampleVi}</p>}
        </div>
      )}
    </div>
  );
}

// Khối ghi chú phân biệt màu cam cho từ Hán Việt dễ nhầm (điểm khác biệt A)
export function FalseFriendNote({ word }: { word: WordRow }) {
  if (!word.isFalseFriend || !word.falseFriendNote?.trim()) return null;
  return (
    <div className="flex gap-3 rounded-[14px] bg-orange-fill p-4 text-left">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-orange" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-headline text-orange">Từ Hán Việt dễ nhầm</p>
        <p className="text-body">{word.falseFriendNote}</p>
      </div>
    </div>
  );
}
