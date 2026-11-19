"use client";

import { useId, useState, useTransition } from "react";
import { CircleX, Plus, Trash2 } from "lucide-react";
import { GrammarDetail } from "@/components/grammar/grammar-detail";
import { ConfirmDialog } from "@/components/ios/confirm-dialog";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { FormGroup, FormRow, Sheet, sheetInputClass } from "@/components/ios/sheet";
import { Switch } from "@/components/ios/switch";
import { Button } from "@/components/ui/button";
import { GRAMMAR_LIMITS, type GrammarExample, type GrammarFieldErrors, type GrammarPoint } from "@/lib/grammar/grammar-input";
import type { LookupOption } from "@/lib/lookups";
import { normalizePinyin } from "@/lib/pinyin";
import { cn } from "@/lib/utils";
import { deleteGrammarPoint, saveGrammarPoint } from "./actions";
import type { Notice } from "./grammar-manager";

type Props = {
  open: boolean;
  point: GrammarPoint | null; // null: thêm mới
  questionCount: number;
  levels: LookupOption[];
  defaultLevelId: number;
  onClose: () => void;
  /** savedLevelId: cấp của ngữ pháp vừa lưu, để danh sách chuyển sang đúng cấp đó */
  onDone: (notice: Notice, savedLevelId?: number) => void;
};

const EMPTY_EXAMPLE: GrammarExample = { zh: "", pinyin: "", vi: "" };

// Sheet Thêm / Sửa điểm ngữ pháp (UC19), có khung xem trước giống hệt trang học viên
export function GrammarSheet({ open, point, questionCount, levels, defaultLevelId, onClose, onDone }: Props) {
  const id = useId();
  const [form, setForm] = useState({
    levelId: point?.levelId ?? defaultLevelId,
    title: point?.title ?? "",
    structure: point?.structure ?? "",
    explanation: point?.explanation ?? "",
    isPublished: point?.isPublished ?? false,
  });
  const [examples, setExamples] = useState<GrammarExample[]>(
    point && point.examples.length > 0 ? point.examples : [EMPTY_EXAMPLE],
  );
  const [fieldErrors, setFieldErrors] = useState<GrammarFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = saving || deleting;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateExample(index: number, key: keyof GrammarExample, value: string) {
    setExamples((prev) => prev.map((ex, i) => (i === index ? { ...ex, [key]: value } : ex)));
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy) return;
    startSaving(async () => {
      const result = await saveGrammarPoint(point?.id ?? null, { ...form, examples });
      if (result.ok) {
        onDone({ tone: "success", text: result.message }, result.point.levelId);
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? (result.fieldErrors ? "Bạn kiểm tra lại các ô báo lỗi." : null));
    });
  }

  function remove() {
    if (!point) return;
    startDeleting(async () => {
      const result = await deleteGrammarPoint(point.id);
      setConfirmDelete(false);
      if (result.ok) onDone({ tone: "success", text: result.message });
      else setFormError(result.message);
    });
  }

  const errorProps = (field: string) =>
    fieldErrors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-${field.replace(/\./g, "-")}-error` }
      : {};
  const errorId = (field: string) => `${id}-${field.replace(/\./g, "-")}-error`;
  const levelName = levels.find((l) => l.id === form.levelId)?.name ?? "";

  // Xem trước: pinyin dạng số hiện luôn dạng có dấu, giống lúc đã lưu
  const previewExamples = examples
    .filter((ex) => ex.zh.trim() || ex.pinyin.trim() || ex.vi.trim())
    .map((ex) => ({ ...ex, pinyin: normalizePinyin(ex.pinyin) }));

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      title={point ? "Sửa ngữ pháp" : "Thêm ngữ pháp"}
      description="Cấp, tên, cấu trúc, giải thích và ít nhất 1 câu ví dụ là bắt buộc."
      className="max-w-3xl"
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
      <form id={`${id}-form`} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {formError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
            <CircleX className="mt-px size-5 shrink-0" aria-hidden />
            {formError}
          </p>
        )}

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
                  aria-checked={form.levelId === level.id}
                  onClick={() => update("levelId", level.id)}
                  className={cn(segmentItemClass(form.levelId === level.id), "px-4")}
                >
                  {level.name}
                </button>
              ))}
            </div>
          </div>
          {fieldErrors.levelId && <p className="px-4 pb-2 text-footnote text-destructive">{fieldErrors.levelId}</p>}
        </FormGroup>

        <FormGroup>
          <FormRow label="Tên" htmlFor={`${id}-title`} error={fieldErrors.title} errorId={errorId("title")}>
            <input
              id={`${id}-title`}
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ví dụ: Mẫu câu với 把 (câu chữ 把)"
              maxLength={GRAMMAR_LIMITS.title}
              autoComplete="off"
              className={sheetInputClass}
              {...errorProps("title")}
            />
          </FormRow>
          <FormRow
            label="Cấu trúc"
            htmlFor={`${id}-structure`}
            error={fieldErrors.structure}
            errorId={errorId("structure")}
          >
            <input
              id={`${id}-structure`}
              value={form.structure}
              onChange={(e) => update("structure", e.target.value)}
              placeholder="A + 把 + B + V + thành phần khác"
              maxLength={GRAMMAR_LIMITS.structure}
              autoComplete="off"
              className={sheetInputClass}
              {...errorProps("structure")}
            />
          </FormRow>
          <FormRow
            label="Giải thích"
            htmlFor={`${id}-explanation`}
            error={fieldErrors.explanation}
            errorId={errorId("explanation")}
          >
            <textarea
              id={`${id}-explanation`}
              value={form.explanation}
              onChange={(e) => update("explanation", e.target.value)}
              placeholder="Khi nào dùng, lưu ý gì…"
              maxLength={GRAMMAR_LIMITS.explanation}
              rows={4}
              className={cn(sheetInputClass, "resize-y py-2.5")}
              {...errorProps("explanation")}
            />
          </FormRow>
        </FormGroup>

        {/* Câu ví dụ */}
        <section aria-labelledby={`${id}-examples`} className="flex flex-col gap-3">
          <h3 id={`${id}-examples`} className="px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
            Câu ví dụ ({examples.length})
          </h3>
          {examples.map((example, i) => (
            <FormGroup key={i}>
              <FormRow
                label={`Câu ${i + 1}`}
                htmlFor={`${id}-ex-${i}-zh`}
                error={fieldErrors[`examples.${i}.zh`]}
                errorId={errorId(`examples.${i}.zh`)}
              >
                <div className="flex items-center gap-1">
                  <input
                    id={`${id}-ex-${i}-zh`}
                    lang="zh-CN"
                    value={example.zh}
                    onChange={(e) => updateExample(i, "zh", e.target.value)}
                    placeholder="请把门关上。"
                    maxLength={GRAMMAR_LIMITS.exampleZh}
                    autoComplete="off"
                    className={cn(sheetInputClass, "font-hanzi")}
                    {...errorProps(`examples.${i}.zh`)}
                  />
                  <Button
                    type="button"
                    variant="plain"
                    size="icon"
                    className="text-destructive"
                    disabled={examples.length <= GRAMMAR_LIMITS.minExamples}
                    onClick={() => {
                      setExamples((prev) => prev.filter((_, j) => j !== i));
                      setFieldErrors({});
                    }}
                    aria-label={`Xóa câu ví dụ ${i + 1}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </FormRow>
              <FormRow
                label="Pinyin"
                htmlFor={`${id}-ex-${i}-pinyin`}
                error={fieldErrors[`examples.${i}.pinyin`]}
                errorId={errorId(`examples.${i}.pinyin`)}
              >
                <input
                  id={`${id}-ex-${i}-pinyin`}
                  value={example.pinyin}
                  onChange={(e) => updateExample(i, "pinyin", e.target.value)}
                  placeholder="Qǐng bǎ mén guānshang. hoặc Qing3 ba3…"
                  maxLength={GRAMMAR_LIMITS.examplePinyin}
                  autoComplete="off"
                  spellCheck={false}
                  className={sheetInputClass}
                  {...errorProps(`examples.${i}.pinyin`)}
                />
              </FormRow>
              <FormRow
                label="Nghĩa"
                htmlFor={`${id}-ex-${i}-vi`}
                error={fieldErrors[`examples.${i}.vi`]}
                errorId={errorId(`examples.${i}.vi`)}
              >
                <input
                  id={`${id}-ex-${i}-vi`}
                  value={example.vi}
                  onChange={(e) => updateExample(i, "vi", e.target.value)}
                  placeholder="Hãy đóng cửa lại."
                  maxLength={GRAMMAR_LIMITS.exampleVi}
                  autoComplete="off"
                  className={sheetInputClass}
                  {...errorProps(`examples.${i}.vi`)}
                />
              </FormRow>
            </FormGroup>
          ))}
          {fieldErrors.examples && <p className="px-4 text-footnote text-destructive">{fieldErrors.examples}</p>}
          <Button
            type="button"
            variant="tinted"
            className="self-start"
            disabled={examples.length >= GRAMMAR_LIMITS.maxExamples}
            onClick={() => setExamples((prev) => [...prev, EMPTY_EXAMPLE])}
          >
            <Plus aria-hidden />
            Thêm câu ví dụ
          </Button>
        </section>

        <FormGroup footer="Tắt Công khai thì học viên không thấy ngữ pháp này.">
          <div className="flex min-h-11 items-center justify-between gap-3 pl-4 pr-2">
            <label htmlFor={`${id}-published`} className="text-body">
              Công khai
            </label>
            <Switch
              id={`${id}-published`}
              checked={form.isPublished}
              onCheckedChange={(checked) => update("isPublished", checked)}
            />
          </div>
        </FormGroup>

        {/* Xem trước: dùng đúng thành phần của trang học viên */}
        <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-2">
          <h3 id={`${id}-preview`} className="px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
            Xem trước trên trang học viên
          </h3>
          <div className="rounded-[20px] bg-card p-5">
            <GrammarDetail
              point={{ levelName, title: form.title, structure: form.structure, explanation: form.explanation, examples: previewExamples }}
              stats={null}
              headingLevel={3}
            />
          </div>
        </section>

        {point &&
          (questionCount > 0 ? (
            <p className="rounded-xl bg-muted px-4 py-3 text-footnote text-muted-foreground">
              Đã có {questionCount} câu hỏi gắn vào ngữ pháp này nên không xóa được. Bạn có thể tắt Công khai để ẩn.
            </p>
          ) : (
            <Button type="button" variant="destructive" size="lg" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-5" aria-hidden />
              Xóa ngữ pháp
            </Button>
          ))}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(next) => !deleting && setConfirmDelete(next)}
        title={`Xóa "${point?.title ?? ""}"?`}
        description="Ngữ pháp này sẽ bị xóa hẳn, không khôi phục được."
        confirmLabel="Xóa"
        destructive
        pending={deleting}
        onConfirm={remove}
      />
    </Sheet>
  );
}
