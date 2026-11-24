"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarClock, ChevronLeft, CircleCheck, CircleHelp, CircleMinus, CircleX, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { finishPracticeSession, submitPracticeAnswer } from "@/app/(app)/practice/actions";
import { ConfirmDialog } from "@/components/ios/confirm-dialog";
import { StatusChip } from "@/components/ios/chips";
import { QuestionView } from "@/components/question/question-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { addDaysISO, formatDateVN, todayISO } from "@/lib/plan";
import {
  firstUnanswered,
  GROUP_LABEL,
  summarize,
  type AnswerResult,
  type SessionQuestion,
  type SessionView,
  type SrsReschedule,
} from "@/lib/practice/session";
import { hasResponse } from "@/lib/questions/grade";
import { QUESTION_TYPE_LABEL, SKILL_LABEL, type UserResponse } from "@/lib/questions/types";
import { cn } from "@/lib/utils";

// Thành phần làm bài DÙNG CHUNG (luyện tập, ôn tổng hợp, ôn điểm yếu…). Mockup: docs/mockups/07-on-tong-hop.png
// Mỗi câu: chọn / viết câu trả lời → (tùy chọn) đánh dấu "Chưa chắc chắn" → Kiểm tra.
// Máy chủ chấm (hàm SQL submit_answer) rồi mới trả đáp án đúng và giải thích của riêng câu đó.
// Câu đã nộp bị khóa, không sửa được.

type Props = {
  session: SessionView;
  title: string;
  backHref: string;
  backLabel: string;
  /** Ghi chú dưới thanh tiến độ, ví dụ "Hiện có 7 câu…" */
  notice?: string;
  /** Ôn điểm yếu: so tỷ lệ đúng của bài với tỷ lệ đúng trước đó (0–100) */
  comparison?: { baseline: number; subject: string } | null;
};

export function PracticeSession({ session, title, backHref, backLabel, notice, comparison }: Props) {
  const questions = session.questions;
  const total = questions.length;

  // Kết quả từng câu: lấy từ máy chủ lúc mở phiên, cập nhật khi nộp
  const [results, setResults] = useState<Record<string, AnswerResult>>(() =>
    Object.fromEntries(questions.flatMap((q) => (q.result ? [[q.id, q.result]] : []))),
  );
  const [index, setIndex] = useState(() => firstUnanswered(questions));
  const [responses, setResponses] = useState<Record<string, UserResponse | null>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(session.status === "submitted");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cardRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  // Sang câu mới thì đưa con trỏ bàn phím về đầu câu (người dùng trình đọc màn hình biết đã đổi câu)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    cardRef.current?.focus({ preventScroll: false });
  }, [index]);

  const current = index < total ? questions[index] : null;
  const currentResult = current ? (results[current.id] ?? null) : null;
  const answeredCount = Object.keys(results).length;

  function submit() {
    if (!current || currentResult || isPending) return;
    const response = responses[current.id] ?? null;
    if (!hasResponse(current.question, response)) return;
    setError(null);
    startTransition(async () => {
      const outcome = await submitPracticeAnswer(session.id, current.id, response, flagged[current.id] === true);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setResults((prev) => ({ ...prev, [current.id]: outcome.result }));
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const outcome = await finishPracticeSession(session.id);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setConfirmEnd(false);
      setFinished(true);
    });
  }

  function next() {
    setError(null);
    if (index + 1 >= total) finish();
    else setIndex(index + 1);
  }

  const summaryQuestions = questions.map((q) => ({ ...q, result: results[q.id] ?? null }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Thanh trên: quay lại | tiêu đề | Kết thúc sớm */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Link
          href={backHref}
          className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-body text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {backLabel}
        </Link>
        <h1 className="text-center text-headline">{title}</h1>
        {!finished && total > 0 && (
          <Button variant="plain" className="justify-self-end font-normal" onClick={() => setConfirmEnd(true)} disabled={isPending}>
            Kết thúc sớm
          </Button>
        )}
      </div>

      {!finished && total > 0 && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Tiến độ phiên làm bài"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answeredCount}
            aria-valuetext={`Đã làm ${answeredCount} trên ${total} câu`}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(answeredCount / total) * 100}%` }}
            />
          </div>
          <p className="text-subheadline text-muted-foreground tabular-nums">
            Câu {Math.min(index + 1, total)} / {total}
          </p>
        </div>
      )}

      {notice && !finished && (
        <p className="flex items-start gap-2 rounded-xl bg-card px-4 py-3 text-subheadline text-muted-foreground">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
          <CircleX className="size-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {total === 0 ? (
        <div role="status" className="rounded-[20px] bg-card p-6 text-center text-body text-muted-foreground">
          Phiên này không còn câu hỏi nào.
        </div>
      ) : finished ? (
        <Summary questions={summaryQuestions} backHref={backHref} backLabel={backLabel} comparison={comparison ?? null} />
      ) : !current ? (
        // Đã trả lời hết nhưng chưa bấm xem kết quả (ví dụ đóng trang giữa chừng)
        <div role="status" className="flex flex-col items-center gap-3 rounded-[20px] bg-card p-6 text-center">
          <CircleCheck className="size-12 text-green" aria-hidden />
          <h2 className="text-title2">Bạn đã trả lời hết {total} câu</h2>
          <Button onClick={finish} disabled={isPending}>
            {isPending ? "Đang tổng kết…" : "Xem kết quả"}
          </Button>
        </div>
      ) : (
        <>
          <div
            ref={cardRef}
            tabIndex={-1}
            aria-label={`Câu ${index + 1} trên ${total}`}
            className="flex flex-col gap-4 rounded-[20px] bg-card p-4 outline-none sm:p-6"
          >
            <span className="self-center rounded-md bg-muted px-2 py-0.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              {SKILL_LABEL[current.skill]}
              {session.groups[current.id] && ` · ${GROUP_LABEL[session.groups[current.id]]}`}
            </span>
            <QuestionView
              key={current.id}
              question={current.question}
              response={currentResult ? currentResult.userAnswer : (responses[current.id] ?? null)}
              onResponseChange={(response) => setResponses((prev) => ({ ...prev, [current.id]: response }))}
              disabled={isPending}
              feedback={
                currentResult && currentResult.answer && currentResult.isCorrect !== null
                  ? { correct: currentResult.isCorrect, answer: currentResult.answer }
                  : null
              }
            />
          </div>

          {currentResult ? (
            <ResultPanel result={currentResult} isLast={index + 1 >= total} pending={isPending} onNext={next} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant={flagged[current.id] ? "tinted" : "gray"}
                aria-pressed={flagged[current.id] === true}
                onClick={() => setFlagged((prev) => ({ ...prev, [current.id]: !prev[current.id] }))}
                disabled={isPending}
              >
                <CircleHelp aria-hidden />
                Chưa chắc chắn
              </Button>
              <Button
                onClick={submit}
                disabled={isPending || !hasResponse(current.question, responses[current.id] ?? null)}
              >
                {isPending ? "Đang chấm…" : "Kiểm tra"}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="Kết thúc phiên này?"
        description={`Bạn đã làm ${answeredCount} / ${total} câu. Các câu chưa làm sẽ không được tính.`}
        confirmLabel="Kết thúc"
        pending={isPending}
        onConfirm={finish}
      />
    </div>
  );
}

function ResultPanel({
  result,
  isLast,
  pending,
  onNext,
}: {
  result: AnswerResult;
  isLast: boolean;
  pending: boolean;
  onNext: () => void;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  // Vừa chấm xong: đưa con trỏ tới nút Câu tiếp theo để bấm Enter là đi tiếp
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);

  const correct = result.isCorrect === true;
  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        className={cn(
          "flex flex-col gap-2 rounded-[20px] p-4",
          result.isCorrect === null ? "bg-card" : correct ? "bg-green-fill" : "bg-red-fill",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {result.isCorrect === null ? (
            <p className="text-headline">Đã lưu câu trả lời</p>
          ) : (
            <p className={cn("flex items-center gap-2 text-headline", correct ? "text-green" : "text-destructive")}>
              {correct ? <CircleCheck className="size-6" aria-hidden /> : <CircleX className="size-6" aria-hidden />}
              {correct ? "Chính xác" : "Chưa đúng"}
            </p>
          )}
          {result.isFlagged && <StatusChip status="unsure" label="Bạn chưa chắc chắn" />}
        </div>
        {result.isFlagged && correct && (
          <p className="text-footnote text-muted-foreground">Câu đúng nhưng chưa chắc chắn vẫn được tính là cần ôn lại.</p>
        )}
        {result.explanation && (
          <p className="text-body">
            <span className="font-semibold">Giải thích: </span>
            {result.explanation}
          </p>
        )}
        {result.srs && <SrsNote srs={result.srs} />}
      </div>
      <Button ref={nextRef} onClick={onNext} disabled={pending} className="self-end">
        {isLast ? (pending ? "Đang tổng kết…" : "Xem kết quả") : "Câu tiếp theo"}
      </Button>
    </div>
  );
}

/** Ôn tổng hợp: sai câu chọn nghĩa → thẻ từ đó được hẹn ôn lại */
function SrsNote({ srs }: { srs: SrsReschedule }) {
  const today = todayISO();
  const when =
    srs.dueDate <= today
      ? "đã có trong lượt ôn thẻ từ hôm nay"
      : srs.dueDate === addDaysISO(today, 1)
        ? `sẽ được ôn lại vào ngày mai (${formatDateVN(srs.dueDate)})`
        : `sẽ được ôn lại vào ngày ${formatDateVN(srs.dueDate)}`;
  return (
    <p className="flex items-start gap-2 text-subheadline">
      <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        Thẻ từ{" "}
        <span lang="zh-CN" className="font-hanzi font-semibold">
          {srs.hanzi}
        </span>{" "}
        {when}.
      </span>
    </p>
  );
}

/** Ôn điểm yếu: tỷ lệ đúng của bài này so với trước đó (câu chưa chắc tính là sai, giống cách tìm điểm yếu) */
function Comparison({ questions, baseline, subject }: { questions: SessionQuestion[]; baseline: number; subject: string }) {
  const answered = questions.filter((q) => q.result !== null);
  if (answered.length === 0) return null;
  const sure = answered.filter((q) => q.result?.isCorrect === true && !q.result.isFlagged).length;
  const now = Math.round((sure / answered.length) * 100);
  const diff = now - baseline;
  const Trend = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-3 rounded-[20px] bg-card p-4 sm:p-6">
      <h3 id="compare-heading" className="text-headline">
        So với trước đó · {subject}
      </h3>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-footnote text-muted-foreground">Trước đó (30 ngày qua)</dt>
          <dd className="text-title1 tabular-nums">đúng {baseline}%</dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-footnote text-muted-foreground">Bài ôn này</dt>
          <dd className="text-title1 tabular-nums">đúng {now}%</dd>
        </div>
      </dl>
      <p className={cn("flex items-center gap-2 text-subheadline font-semibold", diff > 0 ? "text-green" : diff < 0 ? "text-destructive" : "text-muted-foreground")}>
        <Trend className="size-5" aria-hidden />
        {diff > 0 ? `Tăng ${diff} điểm phần trăm` : diff < 0 ? `Giảm ${-diff} điểm phần trăm` : "Không đổi"}
      </p>
      <p className="text-footnote text-muted-foreground">Câu đúng nhưng bạn chưa chắc chắn được tính là sai, giống cách tìm điểm yếu.</p>
    </section>
  );
}

function Summary({
  questions,
  backHref,
  backLabel,
  comparison,
}: {
  questions: SessionQuestion[];
  backHref: string;
  backLabel: string;
  comparison: { baseline: number; subject: string } | null;
}) {
  const s = summarize(questions);
  const rate = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="flex flex-col items-center gap-4 rounded-[20px] bg-card p-6 text-center">
        <CircleCheck className="size-12 text-green" aria-hidden />
        <h2 className="text-title2">Bạn đã hoàn thành phiên này</h2>
        <dl className="grid w-full max-w-md grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-footnote text-muted-foreground">Câu đúng</dt>
            <dd className="text-title1 tabular-nums">
              {s.correct}/{s.total}
            </dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-footnote text-muted-foreground">Tỷ lệ đúng</dt>
            <dd className="text-title1 tabular-nums">{rate}%</dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-footnote text-muted-foreground">Chưa chắc</dt>
            <dd className="text-title1 tabular-nums">{s.flagged}</dd>
          </div>
        </dl>
        <p className="max-w-md text-footnote text-muted-foreground">
          Tỷ lệ đúng tính trên {s.answered} câu đã làm
          {s.total > s.answered ? `; ${s.total - s.answered} câu chưa làm không được tính` : ""}.
        </p>
      </div>

      {comparison && <Comparison questions={questions} baseline={comparison.baseline} subject={comparison.subject} />}

      <ol aria-label="Kết quả từng câu" className="flex flex-col overflow-hidden rounded-[20px] bg-card">
        {questions.map((q, i) => (
          <li key={q.id} className="flex min-h-12 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
            <span className="w-8 text-subheadline text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="flex-1 text-body">{QUESTION_TYPE_LABEL[q.question.type]}</span>
            {q.result?.isFlagged && <StatusChip status="unsure" />}
            {q.result === null ? (
              <span className="inline-flex items-center gap-1 text-footnote font-semibold text-muted-foreground">
                <CircleMinus className="size-4" aria-hidden />
                Chưa làm
              </span>
            ) : q.result.isCorrect === null ? null : (
              <StatusChip status={q.result.isCorrect ? "correct" : "wrong"} />
            )}
          </li>
        ))}
      </ol>

      <Link href={backHref} className={cn(buttonVariants({ variant: "filled" }), "self-center")}>
        {backLabel}
      </Link>
    </div>
  );
}
