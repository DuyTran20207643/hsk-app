"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, CircleX, ImagePlus, Plus, RotateCcw, Trash2, Volume2, X } from "lucide-react";
import { QuestionView, type QuestionFeedback } from "@/components/question/question-view";
import { StatusChip } from "@/components/ios/chips";
import { ConfirmDialog } from "@/components/ios/confirm-dialog";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { FormGroup, FormRow, Sheet, sheetInputClass } from "@/components/ios/sheet";
import { Button } from "@/components/ui/button";
import type { LookupOption } from "@/lib/lookups";
import type { AdminQuestion } from "@/lib/questions/admin-row";
import { gradeQuestion, hasResponse } from "@/lib/questions/grade";
import {
  answersByIndex,
  isListening,
  OPTION_RANGE,
  optionLetter,
  PICTURE_COUNT,
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  TOKEN_RANGE,
  type QuestionForView,
  type QuestionType,
  type QuestionWithAnswer,
  type UserResponse,
} from "@/lib/questions/types";
import {
  buildContent,
  EMPTY_FIELDS,
  fieldsFromQuestion,
  QUESTION_LIMITS,
  type QuestionErrors,
  type QuestionFields,
  type QuestionStatus,
} from "@/lib/questions/validate";
import { TTS_UNAVAILABLE_MESSAGE, useChineseSpeech } from "@/lib/tts";
import { cn } from "@/lib/utils";
import { imageError } from "@/lib/words/word-input";
import { deleteQuestion, saveQuestion } from "./actions";
import type { GrammarOption, Notice } from "./questions-manager";

type Props = {
  open: boolean;
  question: AdminQuestion | null; // null: thêm mới
  levels: LookupOption[];
  topics: LookupOption[];
  grammarPoints: GrammarOption[];
  defaultLevelId: number;
  defaultType: QuestionType;
  onClose: () => void;
  onDone: (notice: Notice) => void;
};

// Đủ số ô lựa chọn tối thiểu của dạng câu (thêm ô trống ở cuối nếu thiếu)
function padOptions(options: string[], type: QuestionType): string[] {
  const min = OPTION_RANGE[type]?.[0] ?? 0;
  return options.length >= min ? options : [...options, ...Array(min - options.length).fill("")];
}

// Sheet Thêm / Sửa câu hỏi (UC13): ô nhập đổi theo dạng câu; bên cạnh là khung xem trước dùng QuestionView
export function QuestionSheet(props: Props) {
  const { open, question, levels, topics, grammarPoints, defaultLevelId, defaultType, onClose, onDone } = props;
  const id = useId();
  const [meta, setMeta] = useState({
    type: question?.type ?? defaultType,
    levelId: question?.levelId ?? defaultLevelId,
    topicId: question?.topicId ? String(question.topicId) : "",
    grammarPointId: question?.grammarPointId ? String(question.grammarPointId) : "",
    status: (question?.status ?? "active") as QuestionStatus,
    explanation: question?.explanation ?? "",
    audioText: question?.audioText ?? "",
  });
  const [fields, setFields] = useState<QuestionFields>(() => {
    const base = question ? fieldsFromQuestion(question.type, question.content, question.answer) : EMPTY_FIELDS;
    return { ...base, options: padOptions(base.options, question?.type ?? defaultType) };
  });
  // Ảnh mới chọn cho tranh A, B, C (chưa tải lên), kèm đường dẫn xem trước
  const [newImages, setNewImages] = useState<({ file: File; url: string } | null)[]>([null, null, null]);
  const [errors, setErrors] = useState<QuestionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [response, setResponse] = useState<UserResponse | null>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = saving || deleting;
  const tts = useChineseSpeech();
  const type = meta.type;

  // Giải phóng đường dẫn xem trước của ảnh: ảnh bị thay / bỏ thì giải phóng ngay (replaceImage),
  // còn lại giải phóng khi đóng sheet
  const imagesRef = useRef(newImages);
  useEffect(() => {
    imagesRef.current = newImages;
  }, [newImages]);
  useEffect(() => () => imagesRef.current.forEach((img) => img && URL.revokeObjectURL(img.url)), []);

  function replaceImage(index: number, next: { file: File; url: string } | null) {
    setNewImages((prev) =>
      prev.map((img, i) => {
        if (i !== index) return img;
        if (img) URL.revokeObjectURL(img.url);
        return next;
      }),
    );
  }

  // Sửa nội dung thì bỏ kết quả "Thử trả lời" cũ
  function updateFields(change: Partial<QuestionFields>) {
    setFields((prev) => ({ ...prev, ...change }));
    setFeedback(null);
  }
  function updateMeta<K extends keyof typeof meta>(key: K, value: (typeof meta)[K]) {
    setMeta((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
  }
  function changeType(next: QuestionType) {
    updateMeta("type", next);
    setFields((prev) => ({ ...prev, options: padOptions(prev.options, next), answerIndex: null }));
    setResponse(null);
    setErrors({});
  }

  // Xem trước: dựng nội dung từ các ô đang nhập (không báo lỗi, chỉ để hiển thị)
  const preview = useMemo(() => {
    const draft = {
      ...fields,
      images: fields.images.map((url, i) => newImages[i]?.url ?? url),
    };
    const built = buildContent(type, draft, {}, { requireImages: false });
    if (!built) return null;
    const view = { type, content: built.content, audioText: isListening(type) ? meta.audioText : null } as QuestionForView;
    const withAnswer = { type, content: built.content, answer: built.answer } as QuestionWithAnswer;
    return { view, withAnswer };
  }, [fields, newImages, type, meta.audioText]);

  function tryAnswer() {
    if (!preview) return;
    setFeedback({ correct: gradeQuestion(preview.withAnswer, response), answer: preview.withAnswer.answer });
  }

  function chooseImage(index: number, file: File | undefined) {
    if (!file) return;
    const problem = imageError(file);
    if (problem) {
      setErrors((prev) => ({ ...prev, [`images.${index}`]: problem }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`images.${index}`];
      delete next.images;
      return next;
    });
    replaceImage(index, { file, url: URL.createObjectURL(file) });
    setFeedback(null);
  }

  function clearImage(index: number) {
    replaceImage(index, null);
    updateFields({ images: fields.images.map((url, i) => (i === index ? null : url)) });
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const data = new FormData();
    data.set(
      "payload",
      JSON.stringify({
        id: question?.id ?? null,
        type,
        levelId: meta.levelId,
        topicId: meta.topicId || null,
        grammarPointId: meta.grammarPointId || null,
        status: meta.status,
        explanation: meta.explanation,
        audioText: meta.audioText,
        fields,
      }),
    );
    newImages.forEach((img, i) => img && data.set(`image_${i}`, img.file));

    startSaving(async () => {
      const result = await saveQuestion(data);
      if (result.ok) {
        onDone({ tone: "success", text: result.message });
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? (result.fieldErrors ? "Bạn kiểm tra lại các ô báo lỗi." : null));
    });
  }

  function remove() {
    if (!question) return;
    startDeleting(async () => {
      const result = await deleteQuestion(question.id);
      setConfirmDelete(false);
      if (result.ok) onDone({ tone: result.deactivated ? "info" : "success", text: result.message });
      else setFormError(result.message);
    });
  }

  const errorId = (key: string) => `${id}-${key.replace(/\./g, "-")}-error`;
  const invalid = (key: string) =>
    errors[key] ? { "aria-invalid": true as const, "aria-describedby": errorId(key) } : {};
  const grammarChoices = grammarPoints.filter((g) => g.levelId === meta.levelId);
  const optionRange = OPTION_RANGE[type];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      title={question ? "Sửa câu hỏi" : "Thêm câu hỏi"}
      description="Chọn cấp và dạng câu, nhập nội dung, đáp án; xem trước ở khung bên cạnh."
      className="max-w-6xl"
      action={
        <button
          type="submit"
          form={`${id}-form`}
          disabled={busy}
          className="min-h-11 rounded-lg px-2 text-headline text-primary outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <form id={`${id}-form`} onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-5">
          {formError && (
            <p role="alert" className="flex gap-2 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
              <CircleX className="mt-px size-5 shrink-0" aria-hidden />
              {formError}
            </p>
          )}

          {/* Thông tin chung */}
          <FormGroup>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-1.5">
              <span className="text-body" id={`${id}-level`}>
                Cấp
              </span>
              <div role="radiogroup" aria-labelledby={`${id}-level`} className={segmentTrackClass}>
                {levels.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    role="radio"
                    aria-checked={meta.levelId === level.id}
                    onClick={() => {
                      updateMeta("levelId", level.id);
                      // Ngữ pháp thuộc cấp khác thì bỏ chọn
                      const g = grammarPoints.find((p) => String(p.id) === meta.grammarPointId);
                      if (g && g.levelId !== level.id) updateMeta("grammarPointId", "");
                    }}
                    className={cn(segmentItemClass(meta.levelId === level.id), "px-4")}
                  >
                    {level.name}
                  </button>
                ))}
              </div>
            </div>
            <FormRow label="Dạng câu" htmlFor={`${id}-type`} error={errors.type} errorId={errorId("type")}>
              <SelectInput id={`${id}-type`} value={type} onChange={(v) => changeType(v as QuestionType)}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABEL[t]}
                  </option>
                ))}
              </SelectInput>
            </FormRow>
            <FormRow label="Chủ đề" htmlFor={`${id}-topic`} error={errors.topicId} errorId={errorId("topicId")}>
              <SelectInput id={`${id}-topic`} value={meta.topicId} onChange={(v) => updateMeta("topicId", v)}>
                <option value="">Không chọn</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectInput>
            </FormRow>
            <FormRow
              label="Ngữ pháp"
              htmlFor={`${id}-grammar`}
              error={errors.grammarPointId}
              errorId={errorId("grammarPointId")}
            >
              <SelectInput id={`${id}-grammar`} value={meta.grammarPointId} onChange={(v) => updateMeta("grammarPointId", v)}>
                <option value="">Không chọn</option>
                {grammarChoices.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </SelectInput>
            </FormRow>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-1.5">
              <span className="text-body" id={`${id}-status`}>
                Trạng thái
              </span>
              <div role="radiogroup" aria-labelledby={`${id}-status`} className={segmentTrackClass}>
                {(
                  [
                    ["active", "Đang dùng"],
                    ["inactive", "Ngừng dùng"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={meta.status === value}
                    onClick={() => updateMeta("status", value)}
                    className={cn(segmentItemClass(meta.status === value), "px-4")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </FormGroup>

          {/* Lời đọc cho câu nghe */}
          {isListening(type) && (
            <FormGroup
              footer={
                tts.available
                  ? "Máy đọc to đoạn này bằng giọng tiếng Trung. Học viên không thấy chữ, chỉ nghe."
                  : TTS_UNAVAILABLE_MESSAGE
              }
            >
              <FormRow label="Lời đọc" htmlFor={`${id}-audio`} error={errors.audioText} errorId={errorId("audioText")}>
                <div className="flex items-start gap-1">
                  <textarea
                    id={`${id}-audio`}
                    lang="zh-CN"
                    value={meta.audioText}
                    onChange={(e) => updateMeta("audioText", e.target.value)}
                    placeholder="女：你去哪儿？男：我去机场接朋友。"
                    rows={3}
                    maxLength={QUESTION_LIMITS.audioText}
                    className={cn(sheetInputClass, "resize-y py-2.5 font-hanzi")}
                    {...invalid("audioText")}
                  />
                  <Button
                    type="button"
                    variant="tinted"
                    size="icon"
                    disabled={!tts.available || !meta.audioText.trim()}
                    onClick={() => tts.speak(meta.audioText)}
                    aria-label="Nghe thử lời đọc"
                  >
                    <Volume2 aria-hidden />
                  </Button>
                </div>
              </FormRow>
            </FormGroup>
          )}

          {/* Nội dung theo dạng câu */}
          <FormGroup>
            {(type === "vocab_meaning" || type === "grammar_fill" || type === "reading_match" ||
              type === "reading_fill_blank" || type === "listening_true_false" || type === "writing_hanzi") && (
              <FormRow label={STEM_LABEL[type]} htmlFor={`${id}-stem`} error={errors.stem} errorId={errorId("stem")}>
                <input
                  id={`${id}-stem`}
                  lang="zh-CN"
                  value={fields.stem}
                  onChange={(e) => updateFields({ stem: e.target.value })}
                  placeholder={STEM_PLACEHOLDER[type]}
                  maxLength={QUESTION_LIMITS.stem}
                  autoComplete="off"
                  className={cn(sheetInputClass, "font-hanzi")}
                  {...invalid("stem")}
                />
              </FormRow>
            )}
            {(type === "vocab_meaning" || type === "grammar_fill") && (
              <FormRow
                label={type === "vocab_meaning" ? "Pinyin" : "Pinyin (tùy chọn)"}
                htmlFor={`${id}-pinyin`}
                error={errors.pinyin}
                errorId={errorId("pinyin")}
              >
                <input
                  id={`${id}-pinyin`}
                  value={fields.pinyin}
                  onChange={(e) => updateFields({ pinyin: e.target.value })}
                  placeholder="jīchǎng hoặc ji1 chang3"
                  maxLength={QUESTION_LIMITS.pinyin}
                  autoComplete="off"
                  spellCheck={false}
                  className={sheetInputClass}
                  {...invalid("pinyin")}
                />
              </FormRow>
            )}
            {type === "reading_comprehension" && (
              <FormRow label="Đoạn văn" htmlFor={`${id}-passage`} error={errors.passage} errorId={errorId("passage")}>
                <textarea
                  id={`${id}-passage`}
                  lang="zh-CN"
                  value={fields.passage}
                  onChange={(e) => updateFields({ passage: e.target.value })}
                  rows={5}
                  maxLength={QUESTION_LIMITS.passage}
                  className={cn(sheetInputClass, "resize-y py-2.5 font-hanzi")}
                  {...invalid("passage")}
                />
              </FormRow>
            )}
            {(type === "listening_short_dialogue" || type === "listening_long_dialogue" || type === "reading_comprehension") && (
              <FormRow label="Câu hỏi" htmlFor={`${id}-question`} error={errors.question} errorId={errorId("question")}>
                <input
                  id={`${id}-question`}
                  lang="zh-CN"
                  value={fields.question}
                  onChange={(e) => updateFields({ question: e.target.value })}
                  placeholder="男的去哪儿？"
                  maxLength={QUESTION_LIMITS.question}
                  autoComplete="off"
                  className={cn(sheetInputClass, "font-hanzi")}
                  {...invalid("question")}
                />
              </FormRow>
            )}
            {type === "writing_order" && (
              <TokenEditor
                id={id}
                tokens={fields.tokens}
                error={errors.tokens}
                errorId={errorId("tokens")}
                onChange={(tokens) => updateFields({ tokens })}
              />
            )}
            {(type === "writing_order" || type === "writing_hanzi") && (
              <FormRow
                label={type === "writing_order" ? "Câu đúng" : "Chữ Hán đúng"}
                htmlFor={`${id}-answer-text`}
                error={errors.answer}
                errorId={errorId("answer")}
              >
                <input
                  id={`${id}-answer-text`}
                  lang="zh-CN"
                  value={fields.answerText}
                  onChange={(e) => updateFields({ answerText: e.target.value })}
                  placeholder={type === "writing_order" ? "我把作业做完了。" : "飞"}
                  maxLength={QUESTION_LIMITS.answerText}
                  autoComplete="off"
                  className={cn(sheetInputClass, "font-hanzi")}
                  {...invalid("answer")}
                />
              </FormRow>
            )}
            {type === "listening_true_false" && (
              <div className="flex flex-col px-4 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-body" id={`${id}-tf`}>
                    Đáp án
                  </span>
                  <div role="radiogroup" aria-labelledby={`${id}-tf`} className={segmentTrackClass}>
                    {([true, false] as const).map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        role="radio"
                        aria-checked={fields.answerValue === value}
                        onClick={() => updateFields({ answerValue: value })}
                        className={cn(segmentItemClass(fields.answerValue === value), "px-5")}
                      >
                        {value ? "Đúng" : "Sai"}
                      </button>
                    ))}
                  </div>
                </div>
                {errors.answer && <p className="pb-1 text-footnote text-destructive">{errors.answer}</p>}
              </div>
            )}
          </FormGroup>

          {/* Lựa chọn + chọn đáp án đúng */}
          {optionRange && (
            <OptionsEditor
              id={id}
              options={fields.options}
              answerIndex={fields.answerIndex}
              range={optionRange}
              chinese={type !== "vocab_meaning"}
              errors={errors}
              onChange={(options, answerIndex) => updateFields({ options, answerIndex })}
            />
          )}

          {type === "listening_picture" && (
            <section aria-labelledby={`${id}-pictures`} className="flex flex-col gap-2">
              <h3 id={`${id}-pictures`} className="px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
                3 tranh · bấm chọn tranh đúng
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: PICTURE_COUNT }, (_, i) => {
                  const src = newImages[i]?.url ?? fields.images[i];
                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div
                        className={cn(
                          "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-card ring-2",
                          fields.answerIndex === i ? "ring-green" : "ring-transparent",
                        )}
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước (file trên máy hoặc Supabase Storage)
                          <img src={src} alt={`Tranh ${optionLetter(i)}`} className="size-full object-cover" />
                        ) : (
                          <label className="flex size-full cursor-pointer flex-col items-center justify-center gap-1 text-footnote text-primary">
                            <ImagePlus className="size-6" aria-hidden />
                            Chọn ảnh {optionLetter(i)}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(e) => chooseImage(i, e.target.files?.[0])}
                            />
                          </label>
                        )}
                        {src && (
                          <Button
                            type="button"
                            variant="gray"
                            size="icon"
                            className="absolute top-1 right-1 bg-card/90"
                            onClick={() => clearImage(i)}
                            aria-label={`Bỏ ảnh ${optionLetter(i)}`}
                          >
                            <X aria-hidden />
                          </Button>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant={fields.answerIndex === i ? "filled" : "gray"}
                        size="sm"
                        aria-pressed={fields.answerIndex === i}
                        onClick={() => updateFields({ answerIndex: i })}
                      >
                        {fields.answerIndex === i ? `${optionLetter(i)} · đáp án` : `Chọn ${optionLetter(i)} là đúng`}
                      </Button>
                      {errors[`images.${i}`] && <p className="text-footnote text-destructive">{errors[`images.${i}`]}</p>}
                    </div>
                  );
                })}
              </div>
              {(errors.images || errors.answer) && (
                <p className="px-4 text-footnote text-destructive">{errors.images ?? errors.answer}</p>
              )}
              <p className="px-4 text-footnote text-muted-foreground">Ảnh jpg, png hoặc webp, tối đa 1 MB mỗi ảnh.</p>
            </section>
          )}

          <FormGroup>
            <FormRow
              label="Giải thích"
              htmlFor={`${id}-explanation`}
              error={errors.explanation}
              errorId={errorId("explanation")}
            >
              <textarea
                id={`${id}-explanation`}
                value={meta.explanation}
                onChange={(e) => updateMeta("explanation", e.target.value)}
                placeholder="Vì sao đáp án này đúng (học viên xem sau khi nộp bài)"
                rows={3}
                maxLength={QUESTION_LIMITS.explanation}
                className={cn(sheetInputClass, "resize-y py-2.5")}
                {...invalid("explanation")}
              />
            </FormRow>
          </FormGroup>

          {question && (
            <Button type="button" variant="destructive" size="lg" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-5" aria-hidden />
              Xóa câu hỏi
            </Button>
          )}
        </form>

        {/* Xem trước bằng chính QuestionView của học viên */}
        <aside aria-labelledby={`${id}-preview`} className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
          <h3 id={`${id}-preview`} className="px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
            Xem trước như học viên thấy
          </h3>
          <div className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
            {preview && (
              <QuestionView
                key={type}
                question={preview.view}
                response={response}
                onResponseChange={setResponse}
                feedback={feedback}
              />
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {feedback ? (
                <>
                  <StatusChip status={feedback.correct ? "correct" : "wrong"} />
                  <Button
                    type="button"
                    variant="gray"
                    size="sm"
                    onClick={() => {
                      setFeedback(null);
                      setResponse(null);
                    }}
                  >
                    <RotateCcw aria-hidden />
                    Làm lại
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="tinted"
                  size="sm"
                  disabled={!preview || !hasResponse(preview.withAnswer, response)}
                  onClick={tryAnswer}
                >
                  Thử trả lời
                </Button>
              )}
              <span className="text-footnote text-muted-foreground">
                {answersByIndex(type) || type === "listening_true_false"
                  ? "Chọn một đáp án rồi bấm Thử trả lời."
                  : "Trả lời rồi bấm Thử trả lời để kiểm tra đáp án."}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(next) => !deleting && setConfirmDelete(next)}
        title="Xóa câu hỏi này?"
        description="Nếu câu đã nằm trong đề thi hoặc đã có học viên trả lời, hệ thống sẽ chuyển sang Ngừng dùng thay vì xóa hẳn."
        confirmLabel="Xóa"
        destructive
        pending={deleting}
        onConfirm={remove}
      />
    </Sheet>
  );
}

const STEM_LABEL: Partial<Record<QuestionType, string>> = {
  vocab_meaning: "Từ cần hỏi",
  grammar_fill: "Câu có chỗ trống",
  reading_match: "Câu đề bài",
  reading_fill_blank: "Câu có chỗ trống",
  listening_true_false: "Câu nhận định",
  writing_hanzi: "Đề bài",
};

const STEM_PLACEHOLDER: Partial<Record<QuestionType, string>> = {
  vocab_meaning: "机场",
  grammar_fill: "我＿作业做完了。 (gõ _ cho chỗ trống)",
  reading_match: "你喝茶还是喝咖啡？",
  reading_fill_blank: "我想＿一杯茶。 (gõ _ cho chỗ trống)",
  listening_true_false: "他今天不上班。",
  writing_hanzi: "fēi（ ）机",
};

function OptionsEditor({
  id,
  options,
  answerIndex,
  range,
  chinese,
  errors,
  onChange,
}: {
  id: string;
  options: string[];
  answerIndex: number | null;
  range: readonly [number, number];
  chinese: boolean;
  errors: QuestionErrors;
  onChange: (options: string[], answerIndex: number | null) => void;
}) {
  const [min, max] = range;
  return (
    <section aria-labelledby={`${id}-options`} className="flex flex-col gap-2">
      <h3 id={`${id}-options`} className="px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
        Lựa chọn ({min === max ? `đúng ${min}` : `${min}–${max}`}) · bấm chữ cái để chọn đáp án đúng
      </h3>
      <div role="radiogroup" aria-labelledby={`${id}-options`} className="overflow-hidden rounded-xl bg-card">
        {options.map((option, i) => (
          <div key={i} className="group/row pl-2">
            <div className="flex flex-col border-b border-border pr-2 group-last/row:border-b-0">
              <div className="flex min-h-11 items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={answerIndex === i}
                  aria-label={`Chọn ${optionLetter(i)} là đáp án đúng`}
                  onClick={() => onChange(options, i)}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-subheadline font-semibold",
                      answerIndex === i ? "bg-green text-white" : "bg-muted",
                    )}
                  >
                    {optionLetter(i)}
                  </span>
                </button>
                <input
                  aria-label={`Lựa chọn ${optionLetter(i)}`}
                  lang={chinese ? "zh-CN" : undefined}
                  value={option}
                  onChange={(e) => onChange(options.map((o, j) => (j === i ? e.target.value : o)), answerIndex)}
                  maxLength={QUESTION_LIMITS.option}
                  autoComplete="off"
                  className={cn(sheetInputClass, chinese && "font-hanzi")}
                  aria-invalid={errors[`options.${i}`] ? true : undefined}
                />
                <Button
                  type="button"
                  variant="plain"
                  size="icon"
                  className="text-destructive"
                  disabled={options.length <= min}
                  onClick={() => {
                    const next = options.filter((_, j) => j !== i);
                    const nextAnswer = answerIndex === null ? null : answerIndex === i ? null : answerIndex > i ? answerIndex - 1 : answerIndex;
                    onChange(next, nextAnswer);
                  }}
                  aria-label={`Xóa lựa chọn ${optionLetter(i)}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {errors[`options.${i}`] && <p className="pb-2 pl-12 text-footnote text-destructive">{errors[`options.${i}`]}</p>}
            </div>
          </div>
        ))}
      </div>
      {(errors.options || errors.answer) && (
        <p className="px-4 text-footnote text-destructive">{errors.options ?? errors.answer}</p>
      )}
      {options.length < max && (
        <Button type="button" variant="tinted" size="sm" className="self-start" onClick={() => onChange([...options, ""], answerIndex)}>
          <Plus aria-hidden />
          Thêm lựa chọn
        </Button>
      )}
    </section>
  );
}

function TokenEditor({
  id,
  tokens,
  error,
  errorId,
  onChange,
}: {
  id: string;
  tokens: string[];
  error?: string;
  errorId: string;
  onChange: (tokens: string[]) => void;
}) {
  const [min, max] = TOKEN_RANGE;
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <span className="text-body" id={`${id}-tokens`}>
        Các cụm ({min}–{max}), nhập theo thứ tự xáo trộn
      </span>
      <div aria-labelledby={`${id}-tokens`} className="flex flex-wrap gap-2">
        {tokens.map((token, i) => (
          <div key={i} className="flex items-center rounded-lg bg-muted pl-2">
            <input
              aria-label={`Cụm ${i + 1}`}
              lang="zh-CN"
              value={token}
              onChange={(e) => onChange(tokens.map((t, j) => (j === i ? e.target.value : t)))}
              maxLength={QUESTION_LIMITS.token}
              autoComplete="off"
              className="min-h-11 w-24 bg-transparent font-hanzi text-body outline-none"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <Button
              type="button"
              variant="plain"
              size="icon"
              disabled={tokens.length <= min}
              onClick={() => onChange(tokens.filter((_, j) => j !== i))}
              aria-label={`Xóa cụm ${i + 1}`}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        {tokens.length < max && (
          <Button type="button" variant="tinted" size="sm" onClick={() => onChange([...tokens, ""])}>
            <Plus aria-hidden />
            Thêm cụm
          </Button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-footnote text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectInput({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full appearance-none bg-transparent pr-7 text-body text-primary outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-primary" aria-hidden />
    </div>
  );
}
