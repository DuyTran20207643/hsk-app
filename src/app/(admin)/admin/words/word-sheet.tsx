"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ChevronDown, CircleX, ImagePlus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ios/confirm-dialog";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";
import { FormGroup, FormRow, Sheet, sheetInputClass } from "@/components/ios/sheet";
import { Switch } from "@/components/ios/switch";
import { Button } from "@/components/ui/button";
import { normalizePinyin } from "@/lib/pinyin";
import { cn } from "@/lib/utils";
import { imageError, type FieldErrors, type WordRow, type WordStatus } from "@/lib/words/word-input";
import { deleteWord, saveWord } from "./actions";
import type { Notice, Option } from "./words-manager";

type Props = {
  open: boolean;
  word: WordRow | null; // null: thêm từ mới
  levels: Option[];
  topics: Option[];
  onClose: () => void;
  onOpenWord: (word: WordRow) => void; // mở từ đã có (khi báo trùng)
  onDone: (notice: Notice) => void;
};

// Sheet Thêm / Sửa từ (mockup 16b-them-tu-vung.png)
export function WordSheet({ open, word, levels, topics, onClose, onOpenWord, onDone }: Props) {
  const id = useId();
  const [form, setForm] = useState({
    hanzi: word?.hanzi ?? "",
    pinyin: word?.pinyin ?? "",
    hanViet: word?.hanViet ?? "",
    meaningVi: word?.meaningVi ?? "",
    levelId: String(word?.levelId ?? levels[0]?.id ?? ""),
    topicId: word?.topicId ? String(word.topicId) : "",
    exampleZh: word?.exampleZh ?? "",
    exampleVi: word?.exampleVi ?? "",
    isFalseFriend: word?.isFalseFriend ?? false,
    falseFriendNote: word?.falseFriendNote ?? "",
    status: (word?.status ?? "active") as WordStatus,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<WordRow | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Ảnh: file mới chọn (chưa tải lên) hoặc ảnh đang có
  const [newImage, setNewImage] = useState<{ file: File; url: string } | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageProblem, setImageProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageFile = newImage?.file ?? null;

  // Đường dẫn xem trước của file trên máy: giải phóng khi đổi ảnh hoặc đóng sheet
  useEffect(() => {
    const url = newImage?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [newImage]);

  const previewUrl = newImage ? newImage.url : removeImage ? null : (word?.imageUrl ?? null);
  const busy = saving || deleting;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    const problem = imageError(file);
    setImageProblem(problem);
    if (problem) {
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setNewImage({ file, url: URL.createObjectURL(file) });
    setRemoveImage(false);
  }

  function clearImage() {
    setNewImage(null);
    setImageProblem(null);
    setRemoveImage(true);
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const data = new FormData();
    if (word) data.set("id", word.id);
    for (const [key, value] of Object.entries(form)) {
      data.set(key, typeof value === "boolean" ? (value ? "1" : "0") : value);
    }
    if (imageFile) data.set("image", imageFile);
    if (removeImage) data.set("removeImage", "1");

    startSaving(async () => {
      const result = await saveWord(data);
      if (result.ok) {
        onDone({ tone: "success", text: result.message });
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? (result.fieldErrors ? "Bạn kiểm tra lại các ô báo lỗi." : null));
      setImageProblem(result.imageError ?? null);
      setDuplicate(result.duplicate ?? null);
    });
  }

  function remove() {
    if (!word) return;
    startDeleting(async () => {
      const result = await deleteWord(word.id);
      setConfirmDelete(false);
      if (result.ok) onDone({ tone: result.deactivated ? "info" : "success", text: result.message });
      else setFormError(result.message);
    });
  }

  const pinyinPreview = /\d/.test(form.pinyin) ? normalizePinyin(form.pinyin) : null;
  const errorProps = (field: keyof FieldErrors) =>
    fieldErrors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-${field}-error` }
      : {};

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      title={word ? "Sửa từ" : "Thêm từ"}
      description="Chữ Hán, pinyin, âm Hán Việt, nghĩa và cấp là bắt buộc."
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
          <div role="alert" className="flex flex-col gap-2 rounded-xl bg-red-fill px-4 py-3 text-destructive">
            <p className="flex gap-2 text-subheadline">
              <CircleX className="mt-px size-5 shrink-0" aria-hidden />
              {formError}
            </p>
            {duplicate && (
              <Button
                type="button"
                variant="tinted"
                size="sm"
                className="self-start"
                onClick={() => onOpenWord(duplicate)}
              >
                Mở từ {duplicate.hanzi} đã có
              </Button>
            )}
          </div>
        )}

        <FormGroup>
          <FormRow label="Chữ Hán" htmlFor={`${id}-hanzi`} error={fieldErrors.hanzi} errorId={`${id}-hanzi-error`}>
            <input
              id={`${id}-hanzi`}
              lang="zh-CN"
              value={form.hanzi}
              onChange={(e) => update("hanzi", e.target.value)}
              placeholder="例如：机场"
              autoComplete="off"
              className={cn(sheetInputClass, "font-hanzi")}
              {...errorProps("hanzi")}
            />
          </FormRow>
          <FormRow
            label="Pinyin"
            htmlFor={`${id}-pinyin`}
            error={fieldErrors.pinyin}
            errorId={`${id}-pinyin-error`}
          >
            <input
              id={`${id}-pinyin`}
              value={form.pinyin}
              onChange={(e) => update("pinyin", e.target.value)}
              placeholder="jīchǎng hoặc ji1 chang3"
              autoComplete="off"
              spellCheck={false}
              className={sheetInputClass}
              aria-describedby={pinyinPreview ? `${id}-pinyin-preview` : undefined}
              {...errorProps("pinyin")}
            />
            {pinyinPreview && (
              <p id={`${id}-pinyin-preview`} className="pb-2 text-footnote text-muted-foreground">
                Sẽ lưu là: <span className="text-foreground">{pinyinPreview}</span>
              </p>
            )}
          </FormRow>
          <FormRow
            label="Âm Hán Việt"
            htmlFor={`${id}-hanViet`}
            error={fieldErrors.hanViet}
            errorId={`${id}-hanViet-error`}
          >
            <input
              id={`${id}-hanViet`}
              value={form.hanViet}
              onChange={(e) => update("hanViet", e.target.value)}
              placeholder="cơ trường"
              autoComplete="off"
              className={sheetInputClass}
              {...errorProps("hanViet")}
            />
          </FormRow>
          <FormRow
            label="Nghĩa"
            htmlFor={`${id}-meaningVi`}
            error={fieldErrors.meaningVi}
            errorId={`${id}-meaningVi-error`}
          >
            <input
              id={`${id}-meaningVi`}
              value={form.meaningVi}
              onChange={(e) => update("meaningVi", e.target.value)}
              placeholder="sân bay"
              autoComplete="off"
              className={sheetInputClass}
              {...errorProps("meaningVi")}
            />
          </FormRow>
        </FormGroup>

        <FormGroup>
          <FormRow label="Cấp" htmlFor={`${id}-level`} error={fieldErrors.levelId} errorId={`${id}-levelId-error`}>
            <SelectInput
              id={`${id}-level`}
              value={form.levelId}
              onChange={(v) => update("levelId", v)}
              {...errorProps("levelId")}
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectInput>
          </FormRow>
          <FormRow label="Chủ đề" htmlFor={`${id}-topic`} error={fieldErrors.topicId} errorId={`${id}-topicId-error`}>
            <SelectInput id={`${id}-topic`} value={form.topicId} onChange={(v) => update("topicId", v)}>
              <option value="">Không có chủ đề</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </FormRow>
          <FormRow
            label="Ảnh minh họa"
            htmlFor={`${id}-image`}
            error={imageProblem ?? undefined}
            errorId={`${id}-image-error`}
          >
            <div className="flex flex-wrap items-center gap-3 py-1.5">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước (file trên máy hoặc Supabase Storage)
                <img
                  src={previewUrl}
                  alt={`Ảnh minh họa cho ${form.hanzi || "từ này"}`}
                  className="size-16 rounded-lg bg-muted object-cover"
                />
              )}
              <input
                ref={fileInput}
                id={`${id}-image`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => chooseImage(e.target.files?.[0])}
                className="sr-only"
                aria-describedby={imageProblem ? `${id}-image-error` : `${id}-image-hint`}
              />
              <Button
                type="button"
                variant="tinted"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus className="size-4" aria-hidden />
                {previewUrl ? "Đổi ảnh" : "Chọn ảnh"}
              </Button>
              {previewUrl && (
                <Button type="button" variant="plain" size="sm" className="text-destructive" onClick={clearImage}>
                  Xóa ảnh
                </Button>
              )}
              <span id={`${id}-image-hint`} className="text-footnote text-muted-foreground">
                {imageFile ? imageFile.name : "jpg, png, webp · tối đa 1 MB"}
              </span>
            </div>
          </FormRow>
        </FormGroup>

        <FormGroup>
          <div className="flex min-h-11 items-center justify-between gap-3 pr-2 pl-4">
            <label htmlFor={`${id}-ff`} className="text-body">
              Từ Hán Việt dễ nhầm
            </label>
            <Switch
              id={`${id}-ff`}
              checked={form.isFalseFriend}
              onCheckedChange={(checked) => update("isFalseFriend", checked)}
            />
          </div>
          {form.isFalseFriend && (
            <div className="border-t border-border px-4 py-2">
              <label htmlFor={`${id}-note`} className="text-subheadline text-muted-foreground">
                Ghi chú phân biệt (bắt buộc)
              </label>
              <textarea
                id={`${id}-note`}
                value={form.falseFriendNote}
                onChange={(e) => update("falseFriendNote", e.target.value)}
                rows={3}
                placeholder="Ví dụ: 东西 không phải hướng đông và tây, mà nghĩa là đồ vật."
                className={cn(sheetInputClass, "resize-y py-2")}
                {...errorProps("falseFriendNote")}
              />
              {fieldErrors.falseFriendNote && (
                <p id={`${id}-falseFriendNote-error`} className="pb-1 text-footnote text-destructive">
                  {fieldErrors.falseFriendNote}
                </p>
              )}
            </div>
          )}
        </FormGroup>

        <FormGroup footer="Câu ví dụ không bắt buộc.">
          <FormRow
            label="Câu ví dụ"
            htmlFor={`${id}-exampleZh`}
            error={fieldErrors.exampleZh}
            errorId={`${id}-exampleZh-error`}
          >
            <input
              id={`${id}-exampleZh`}
              lang="zh-CN"
              value={form.exampleZh}
              onChange={(e) => update("exampleZh", e.target.value)}
              placeholder="我去机场接朋友。"
              autoComplete="off"
              className={cn(sheetInputClass, "font-hanzi")}
              {...errorProps("exampleZh")}
            />
          </FormRow>
          <FormRow
            label="Nghĩa câu"
            htmlFor={`${id}-exampleVi`}
            error={fieldErrors.exampleVi}
            errorId={`${id}-exampleVi-error`}
          >
            <input
              id={`${id}-exampleVi`}
              value={form.exampleVi}
              onChange={(e) => update("exampleVi", e.target.value)}
              placeholder="Tôi ra sân bay đón bạn."
              autoComplete="off"
              className={sheetInputClass}
              {...errorProps("exampleVi")}
            />
          </FormRow>
        </FormGroup>

        {word && (
          <FormGroup footer="Từ Ngừng dùng không hiện với học viên.">
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
                    aria-checked={form.status === value}
                    onClick={() => update("status", value)}
                    className={cn(segmentItemClass(form.status === value), "px-4")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </FormGroup>
        )}

        <p className="px-4 text-footnote text-muted-foreground">
          Chữ Hán, pinyin, âm Hán Việt, nghĩa và cấp là bắt buộc. Pinyin dạng số được tự đổi sang dấu thanh.
          Chỉ thêm ảnh cho danh từ cụ thể.
        </p>

        {word && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-5" aria-hidden />
            Xóa từ
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(next) => !deleting && setConfirmDelete(next)}
        title={`Xóa từ ${word?.hanzi ?? ""}?`}
        description="Nếu từ đã dùng trong bài học hoặc lịch ôn của học viên, hệ thống sẽ chuyển sang Ngừng dùng thay vì xóa hẳn."
        confirmLabel="Xóa"
        destructive
        pending={deleting}
        onConfirm={remove}
      />
    </Sheet>
  );
}

function SelectInput({
  id,
  value,
  onChange,
  children,
  ...props
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full appearance-none bg-transparent pr-7 text-body text-primary outline-none"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-primary"
        aria-hidden
      />
    </div>
  );
}
