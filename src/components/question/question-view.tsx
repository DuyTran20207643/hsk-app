"use client";

import { CircleCheck, CircleX, ImageOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BLANK,
  optionLetter,
  type QuestionAnswer,
  type QuestionForView,
  type QuestionType,
  type UserResponse,
} from "@/lib/questions/types";
import { TTS_UNAVAILABLE_MESSAGE, useChineseSpeech } from "@/lib/tts";
import { cn } from "@/lib/utils";

// Thành phần hiển thị câu hỏi DÙNG CHUNG cho cả 11 dạng: trang quản trị (xem trước),
// luyện tập, ôn tổng hợp, thi thử. Chỉ hiển thị và thu câu trả lời của học viên (response);
// KHÔNG chấm điểm. Bên gọi tự chấm (src/lib/questions/grade.ts, ở máy chủ khi thi thật)
// rồi truyền kết quả qua `feedback` nếu muốn hiện đúng / sai.

export const QUESTION_INSTRUCTION: Record<QuestionType, string> = {
  vocab_meaning: "Chọn nghĩa đúng của từ",
  grammar_fill: "Chọn từ thích hợp điền vào chỗ trống",
  listening_picture: "Nghe rồi chọn tranh phù hợp",
  listening_true_false: "Nghe rồi cho biết câu dưới đây đúng hay sai",
  listening_short_dialogue: "Nghe đoạn hội thoại rồi trả lời câu hỏi",
  listening_long_dialogue: "Nghe đoạn hội thoại rồi trả lời câu hỏi",
  reading_match: "Chọn câu phù hợp với câu đã cho",
  reading_fill_blank: "Chọn từ thích hợp điền vào chỗ trống",
  reading_comprehension: "Đọc đoạn văn rồi trả lời câu hỏi",
  writing_order: "Bấm các cụm theo đúng thứ tự để ghép thành câu",
  writing_hanzi: "Viết chữ Hán còn thiếu",
};

export type QuestionFeedback = { correct: boolean; answer: QuestionAnswer };

type Props = {
  question: QuestionForView;
  response: UserResponse | null;
  onResponseChange?: (response: UserResponse | null) => void;
  /** Khóa thao tác (đã nộp bài, đang chấm…) */
  disabled?: boolean;
  /** Kết quả do bên gọi chấm; có thì tô đáp án đúng / sai */
  feedback?: QuestionFeedback | null;
  className?: string;
};

export function QuestionView({ question, response, onResponseChange, disabled, feedback, className }: Props) {
  const locked = disabled || Boolean(feedback) || !onResponseChange;
  const set = (next: UserResponse | null) => {
    if (!locked) onResponseChange?.(next);
  };
  const selectedIndex = response && "index" in response ? response.index : null;
  const correctIndex = feedback && "index" in feedback.answer ? feedback.answer.index : null;

  const options = (items: string[], chinese: boolean) => (
    <ChoiceList
      options={items}
      chinese={chinese}
      selected={selectedIndex}
      correct={correctIndex}
      locked={locked}
      onSelect={(index) => set({ index })}
    />
  );

  let body: React.ReactNode;
  switch (question.type) {
    case "vocab_meaning":
      body = (
        <>
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="font-hanzi text-body text-muted-foreground">{question.content.pinyin}</span>
            <span lang="zh-CN" className="font-hanzi text-[3rem] leading-tight font-semibold">
              {question.content.stem}
            </span>
          </div>
          {options(question.content.options, false)}
        </>
      );
      break;

    case "grammar_fill":
    case "reading_fill_blank": {
      const filled = selectedIndex !== null ? question.content.options[selectedIndex] : null;
      body = (
        <>
          <div className="flex flex-col gap-1">
            <BlankSentence stem={question.content.stem} filled={filled} />
            {"pinyin" in question.content && question.content.pinyin && (
              <p className="font-hanzi text-subheadline text-muted-foreground">{question.content.pinyin}</p>
            )}
          </div>
          {options(question.content.options, true)}
        </>
      );
      break;
    }

    case "listening_picture":
      body = (
        <>
          <AudioButton text={question.audioText} />
          <div role="radiogroup" aria-label="Chọn tranh" className="grid grid-cols-3 gap-2">
            {question.content.images.map((src, i) => {
              const state = choiceState(i, selectedIndex, correctIndex);
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selectedIndex === i}
                  aria-label={`Tranh ${optionLetter(i)}${stateLabel(state)}`}
                  onClick={() => set({ index: i })}
                  className={cn(
                    "relative flex aspect-square flex-col overflow-hidden rounded-xl bg-muted outline-none ring-2 ring-transparent transition focus-visible:ring-ring/60",
                    CHOICE_RING[state],
                    locked && "cursor-default",
                  )}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh trong Supabase Storage
                    <img src={src} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-1 text-footnote text-muted-foreground">
                      <ImageOff className="size-6" aria-hidden />
                      Chưa có ảnh
                    </span>
                  )}
                  <span className="absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-card text-subheadline font-semibold shadow">
                    {optionLetter(i)}
                  </span>
                  <StateIcon state={state} className="absolute top-1.5 right-1.5" />
                </button>
              );
            })}
          </div>
        </>
      );
      break;

    case "listening_true_false": {
      const value = response && "value" in response ? response.value : null;
      const correctValue = feedback && "value" in feedback.answer ? feedback.answer.value : null;
      body = (
        <>
          <AudioButton text={question.audioText} />
          <p lang="zh-CN" className="font-hanzi text-title3">
            {question.content.statement}
          </p>
          <div role="radiogroup" aria-label="Đúng hay sai" className="grid grid-cols-2 gap-2">
            {([true, false] as const).map((option) => {
              const state =
                correctValue === null
                  ? value === option
                    ? "selected"
                    : "idle"
                  : option === correctValue
                    ? "correct"
                    : value === option
                      ? "wrong"
                      : "idle";
              const Icon = option ? CircleCheck : CircleX;
              return (
                <button
                  key={String(option)}
                  type="button"
                  role="radio"
                  aria-checked={value === option}
                  onClick={() => set({ value: option })}
                  className={cn(
                    "flex min-h-14 items-center justify-center gap-2 rounded-xl bg-muted text-headline outline-none ring-2 ring-transparent transition focus-visible:ring-ring/60",
                    CHOICE_RING[state],
                    locked && "cursor-default",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {option ? "Đúng" : "Sai"}
                  <span className="sr-only">{stateLabel(state)}</span>
                </button>
              );
            })}
          </div>
        </>
      );
      break;
    }

    case "listening_short_dialogue":
    case "listening_long_dialogue":
      body = (
        <>
          <AudioButton text={question.audioText} />
          <p lang="zh-CN" className="font-hanzi text-title3">
            {question.content.question}
          </p>
          {options(question.content.options, true)}
        </>
      );
      break;

    case "reading_match":
      body = (
        <>
          <p lang="zh-CN" className="font-hanzi text-title3">
            {question.content.stem}
          </p>
          {options(question.content.options, true)}
        </>
      );
      break;

    case "reading_comprehension":
      body = (
        <>
          <p lang="zh-CN" className="rounded-xl bg-muted px-4 py-3 font-hanzi text-body leading-relaxed whitespace-pre-line">
            {question.content.passage}
          </p>
          <p lang="zh-CN" className="font-hanzi text-title3">
            {question.content.question}
          </p>
          {options(question.content.options, true)}
        </>
      );
      break;

    case "writing_order": {
      const order = response && "order" in response ? response.order : [];
      const tokens = question.content.tokens;
      body = (
        <>
          <div
            aria-label="Câu bạn đã ghép"
            className={cn(
              "flex min-h-16 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed p-3",
              feedback ? (feedback.correct ? "border-green bg-green-fill" : "border-destructive bg-red-fill") : "border-border",
            )}
          >
            {order.length === 0 && <span className="text-subheadline text-muted-foreground">Bấm các cụm bên dưới…</span>}
            {order.map((tokenIndex, position) => (
              <button
                key={`${tokenIndex}-${position}`}
                type="button"
                lang="zh-CN"
                onClick={() => set({ order: order.filter((_, p) => p !== position) })}
                aria-label={`Bỏ cụm ${tokens[tokenIndex]}`}
                className="min-h-11 rounded-lg bg-primary px-3 font-hanzi text-title3 text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {tokens[tokenIndex]}
              </button>
            ))}
          </div>
          <div aria-label="Các cụm" className="flex flex-wrap gap-2">
            {tokens.map((token, i) => {
              const used = order.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  lang="zh-CN"
                  disabled={used || locked}
                  onClick={() => set({ order: [...order, i] })}
                  className={cn(
                    "min-h-11 rounded-lg bg-muted px-3 font-hanzi text-title3 outline-none transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50",
                    used && "opacity-30",
                  )}
                >
                  {token}
                </button>
              );
            })}
          </div>
          {feedback && "sentence" in feedback.answer && !feedback.correct && (
            <p className="text-subheadline">
              Đáp án:{" "}
              <span lang="zh-CN" className="font-hanzi font-semibold">
                {feedback.answer.sentence}
              </span>
            </p>
          )}
        </>
      );
      break;
    }

    case "writing_hanzi": {
      const text = response && "text" in response ? response.text : "";
      body = (
        <>
          <p lang="zh-CN" className="font-hanzi text-title2">
            {question.content.stem}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-subheadline text-muted-foreground">Chữ Hán của bạn</span>
            <input
              lang="zh-CN"
              value={text}
              readOnly={locked}
              onChange={(e) => set(e.target.value ? { text: e.target.value } : null)}
              autoComplete="off"
              className={cn(
                "min-h-12 rounded-xl bg-muted px-4 font-hanzi text-title3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                feedback && (feedback.correct ? "bg-green-fill" : "bg-red-fill"),
              )}
            />
          </label>
          {feedback && "text" in feedback.answer && !feedback.correct && (
            <p className="text-subheadline">
              Đáp án:{" "}
              <span lang="zh-CN" className="font-hanzi font-semibold">
                {feedback.answer.text}
              </span>
            </p>
          )}
        </>
      );
      break;
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
        {QUESTION_INSTRUCTION[question.type]}
      </p>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------

type ChoiceState = "idle" | "selected" | "correct" | "wrong";

const CHOICE_RING: Record<ChoiceState, string> = {
  idle: "",
  selected: "bg-secondary ring-primary",
  correct: "bg-green-fill ring-green",
  wrong: "bg-red-fill ring-destructive",
};

function choiceState(index: number, selected: number | null, correct: number | null): ChoiceState {
  if (correct !== null) {
    if (index === correct) return "correct";
    if (index === selected) return "wrong";
    return "idle";
  }
  return index === selected ? "selected" : "idle";
}

const stateLabel = (state: ChoiceState) =>
  state === "correct" ? " (đáp án đúng)" : state === "wrong" ? " (bạn chọn, sai)" : "";

function StateIcon({ state, className }: { state: ChoiceState; className?: string }) {
  if (state === "correct") return <CircleCheck className={cn("size-6 text-green", className)} aria-hidden />;
  if (state === "wrong") return <CircleX className={cn("size-6 text-destructive", className)} aria-hidden />;
  return null;
}

function ChoiceList({
  options,
  chinese,
  selected,
  correct,
  locked,
  onSelect,
}: {
  options: string[];
  chinese: boolean;
  selected: number | null;
  correct: number | null;
  locked: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Các lựa chọn" className="flex flex-col gap-2">
      {options.map((option, i) => {
        const state = choiceState(i, selected, correct);
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={selected === i}
            onClick={() => onSelect(i)}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl bg-muted px-3 py-2 text-left outline-none ring-2 ring-transparent transition focus-visible:ring-ring/60",
              CHOICE_RING[state],
              locked && "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-subheadline font-semibold",
                state === "idle" ? "bg-card" : "bg-card/80",
              )}
            >
              {optionLetter(i)}
            </span>
            <span lang={chinese ? "zh-CN" : undefined} className={cn("flex-1", chinese ? "font-hanzi text-title3" : "text-body")}>
              {option}
            </span>
            <StateIcon state={state} />
            <span className="sr-only">{stateLabel(state)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Câu có chỗ trống ＿: hiện ô trống, chọn đáp án thì điền chữ vào ô
function BlankSentence({ stem, filled }: { stem: string; filled: string | null }) {
  const parts = stem.split(BLANK);
  return (
    <p lang="zh-CN" className="font-hanzi text-title3 leading-loose">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span
              className={cn(
                "mx-1 inline-block min-w-16 border-b-2 px-2 text-center",
                filled ? "border-primary text-primary" : "border-muted-foreground",
              )}
            >
              {filled ?? <span className="sr-only">chỗ trống</span>}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

// Nút phát lời đọc của câu nghe (máy đọc to audio_text bằng giọng tiếng Trung)
function AudioButton({ text }: { text: string | null }) {
  const tts = useChineseSpeech();
  const ready = tts.available && Boolean(text?.trim());
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="tinted" disabled={!ready} onClick={() => text && tts.speak(text)}>
          <Volume2 aria-hidden />
          Nghe
        </Button>
        <Button
          type="button"
          variant="gray"
          disabled={!ready}
          onClick={() => text && tts.speak(text, { rate: 0.7 })}
        >
          Nghe chậm
        </Button>
      </div>
      {!tts.available && <p className="text-footnote text-muted-foreground">{TTS_UNAVAILABLE_MESSAGE}</p>}
    </div>
  );
}
