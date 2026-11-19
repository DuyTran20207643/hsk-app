"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleX, Download, FileSpreadsheet } from "lucide-react";
import { Sheet } from "@/components/ios/sheet";
import { Button } from "@/components/ui/button";
import type { LookupOption } from "@/lib/lookups";
import {
  QUESTION_IMPORT_COLUMNS,
  QUESTION_IMPORT_MAX_ROWS,
  QUESTION_IMPORT_TEMPLATE,
  type QuestionImportPreview,
  type QuestionImportRow,
} from "@/lib/questions/import";
import { QUESTION_TYPE_LABEL, QUESTION_TYPES } from "@/lib/questions/types";
import { cn } from "@/lib/utils";
import { commitQuestionImport, previewQuestionImport } from "./actions";
import type { GrammarOption, Notice } from "./questions-manager";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TEMPLATE_NAME = "mau-import-cau-hoi.xlsx";

// Thư viện xlsx khá lớn nên chỉ tải khi cần (bấm Tải file mẫu hoặc chọn file)
const loadXlsx = () => import("xlsx");

// Cách ghi cột answer cho từng dạng (trang "huong_dan" trong file mẫu)
const ANSWER_GUIDE: Record<(typeof QUESTION_TYPES)[number], string> = {
  vocab_meaning: "Chữ cái A–D. Cần stem (từ), pinyin, 3–4 lựa chọn.",
  grammar_fill: "Chữ cái A–D. stem có chỗ trống ＿ (hoặc _), 2–4 lựa chọn, pinyin tùy chọn.",
  listening_picture: "Chữ cái A–C. Cần audio_text. Không nhập được ảnh: câu lưu ở trạng thái Ngừng dùng, vào Sửa để gắn 3 ảnh.",
  listening_true_false: '"Đúng" hoặc "Sai". stem là câu nhận định, cần audio_text.',
  listening_short_dialogue: "Chữ cái A–C. Cần question, audio_text, đúng 3 lựa chọn.",
  listening_long_dialogue: "Chữ cái A–C. Cần question, audio_text, đúng 3 lựa chọn.",
  reading_match: "Chữ cái A–F. Cần stem, 3–6 lựa chọn.",
  reading_fill_blank: "Chữ cái A–F. stem có chỗ trống ＿ (hoặc _), 3–6 lựa chọn.",
  reading_comprehension: "Chữ cái A–C. Cần passage, question, đúng 3 lựa chọn.",
  writing_order: "Câu hoàn chỉnh. stem ghi 3–8 cụm cách nhau bởi dấu |, ví dụ: 我 | 把作业 | 做完了",
  writing_hanzi: "Chữ Hán đúng. stem là đề bài, ví dụ: fēi（ ）机",
};

type Props = {
  open: boolean;
  levels: LookupOption[];
  topics: LookupOption[];
  grammarPoints: GrammarOption[];
  onClose: () => void;
  onDone: (notice: Notice) => void;
};

// Import câu hỏi từ file Excel: trình duyệt đọc file → máy chủ kiểm tra (xem trước) → lưu.
export function QuestionImportSheet({ open, levels, topics, grammarPoints, onClose, onDone }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<QuestionImportRow[] | null>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();
  const [importing, startImporting] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = checking || importing;

  function reset() {
    setFileName(null);
    setRows(null);
    setPreview(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function downloadTemplate() {
    const XLSX = await loadXlsx();
    const book = XLSX.utils.book_new();
    const questions = XLSX.utils.json_to_sheet(QUESTION_IMPORT_TEMPLATE, { header: [...QUESTION_IMPORT_COLUMNS] });
    questions["!cols"] = QUESTION_IMPORT_COLUMNS.map((c) =>
      c === "passage" || c === "audio_text" || c === "explanation" ? { wch: 40 } : c === "type" || c === "grammar_point" ? { wch: 26 } : { wch: 16 },
    );
    XLSX.utils.book_append_sheet(book, questions, "cau_hoi");
    // Hướng dẫn: mã dạng câu và cách ghi cột answer
    const guide = XLSX.utils.aoa_to_sheet([
      ["type (chép đúng mã)", "Tên dạng câu", "Cột answer và các cột cần có"],
      ...QUESTION_TYPES.map((t) => [t, QUESTION_TYPE_LABEL[t], ANSWER_GUIDE[t]]),
    ]);
    guide["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(book, guide, "huong_dan");
    const topicSheet = XLSX.utils.aoa_to_sheet([["topic (chép đúng tên)"], ...topics.map((t) => [t.name])]);
    topicSheet["!cols"] = [{ wch: 36 }];
    XLSX.utils.book_append_sheet(book, topicSheet, "chu_de");
    const levelName = new Map(levels.map((l) => [l.id, l.name]));
    const grammarSheet = XLSX.utils.aoa_to_sheet([
      ["level", "grammar_point (chép đúng tên, cùng cấp với câu hỏi)"],
      ...grammarPoints.map((g) => [levelName.get(g.levelId) ?? g.levelId, g.title]),
    ]);
    grammarSheet["!cols"] = [{ wch: 10 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(book, grammarSheet, "ngu_phap");
    XLSX.writeFile(book, TEMPLATE_NAME);
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(null);
    setRows(null);
    setFileName(file.name);
    if (!/\.(xlsx|xls)$/i.test(file.name)) return setError("Bạn hãy chọn file Excel (.xlsx hoặc .xls).");
    if (file.size > MAX_FILE_BYTES) return setError("File quá lớn (tối đa 5 MB).");

    let parsed: QuestionImportRow[];
    try {
      parsed = await readRows(file);
    } catch (e) {
      if (!(e instanceof ReadError)) console.error("[import] Không đọc được file:", e);
      return setError(e instanceof ReadError ? e.message : "Không đọc được file. Bạn kiểm tra lại file Excel nhé.");
    }
    if (parsed.length === 0) return setError("File không có dòng dữ liệu nào.");
    if (parsed.length > QUESTION_IMPORT_MAX_ROWS) {
      return setError(
        `File có ${parsed.length} dòng, vượt quá giới hạn ${QUESTION_IMPORT_MAX_ROWS.toLocaleString("vi-VN")} dòng.`,
      );
    }

    setRows(parsed);
    startChecking(async () => {
      const result = await previewQuestionImport(parsed);
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    });
  }

  function runImport() {
    if (!rows) return;
    startImporting(async () => {
      const result = await commitQuestionImport(rows);
      if (result.ok) {
        reset();
        onDone({ tone: "success", text: result.message });
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Import Excel"
      description="Nhập nhiều câu hỏi cùng lúc từ file Excel."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4">
          <p className="text-subheadline text-muted-foreground">
            File cần đúng các cột của file mẫu. Trang <code className="font-mono">huong_dan</code> trong file mẫu ghi mã dạng
            câu và cách ghi cột <code className="font-mono">answer</code> cho từng dạng. Câu nghe chọn tranh không nhập được
            ảnh: câu được lưu ở trạng thái Ngừng dùng, bạn vào Sửa để gắn 3 ảnh. Tối đa{" "}
            {QUESTION_IMPORT_MAX_ROWS.toLocaleString("vi-VN")} dòng.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="gray" onClick={downloadTemplate} disabled={busy}>
              <Download className="size-5" aria-hidden />
              Tải file mẫu
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
            <Button type="button" variant="tinted" onClick={() => fileInput.current?.click()} disabled={busy}>
              <FileSpreadsheet className="size-5" aria-hidden />
              {fileName ? "Chọn file khác" : "Chọn file Excel"}
            </Button>
          </div>
          {fileName && (
            <p className="text-footnote text-muted-foreground">
              File: <span className="text-foreground">{fileName}</span>
              {checking && " · đang kiểm tra…"}
            </p>
          )}
        </section>

        {error && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
            <CircleX className="mt-px size-5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {preview && (
          <section aria-label="Kết quả kiểm tra file" className="flex flex-col gap-4" aria-live="polite">
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={CircleCheck} tone="text-green" label="Hợp lệ" value={preview.valid.length} />
              <Stat icon={CircleX} tone="text-destructive" label="Lỗi" value={preview.errors.length} />
            </div>

            {preview.valid.length > 0 && (
              <IssueList
                title={`Dòng hợp lệ (${preview.valid.length})`}
                items={preview.valid.map((v) => ({
                  row: v.row,
                  text: (
                    <>
                      <span className="text-muted-foreground">{QUESTION_TYPE_LABEL[v.type]}:</span>{" "}
                      <span lang="zh-CN" className="font-hanzi">
                        {v.summary}
                      </span>
                      {v.note && <span className="block text-footnote text-orange">{v.note}</span>}
                    </>
                  ),
                }))}
                className="text-green"
              />
            )}
            {preview.errors.length > 0 && (
              <IssueList
                title={`Dòng lỗi (${preview.errors.length}), sẽ bỏ qua`}
                items={preview.errors.map((e) => ({ row: e.row, text: e.messages.join(" ") }))}
                className="text-destructive"
              />
            )}

            <p className="flex gap-2 text-footnote text-muted-foreground">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              Chỉ các dòng hợp lệ được lưu. Dòng lỗi bị bỏ qua; bạn sửa file rồi import lại sau.
            </p>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" onClick={runImport} disabled={!preview || preview.valid.length === 0 || busy}>
            {importing ? "Đang nhập…" : `Nhập các dòng hợp lệ${preview ? ` (${preview.valid.length})` : ""}`}
          </Button>
          <Button type="button" variant="plain" className="font-normal" onClick={close} disabled={busy}>
            Hủy
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col rounded-xl bg-card px-4 py-3">
      <span className={cn("flex items-center gap-1.5 text-subheadline font-semibold", tone)}>
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className="text-title2 font-bold">{value}</span>
      <span className="text-footnote text-muted-foreground">dòng</span>
    </div>
  );
}

function IssueList({
  title,
  items,
  className,
}: {
  title: string;
  items: { row: number; text: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className="flex flex-col">
      <h3 className="mb-1.5 px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="max-h-56 overflow-y-auto rounded-xl bg-card">
        {items.map((item) => (
          <li key={item.row} className="flex gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
            <span className={cn("shrink-0 text-subheadline font-semibold", className)}>Dòng {item.row}</span>
            <span className="min-w-0 text-subheadline">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

class ReadError extends Error {}

// Đọc trang tính đầu tiên: dòng 1 là tên cột, các dòng sau là dữ liệu (bỏ dòng trống)
async function readRows(file: File): Promise<QuestionImportRow[]> {
  const XLSX = await loadXlsx();
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new ReadError("File không có trang tính nào.");

  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: true });
  const header = (table[0] ?? []).map((cell) => String(cell).trim().toLowerCase());
  const missing = QUESTION_IMPORT_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new ReadError(`File thiếu cột: ${missing.join(", ")}. Bạn dùng đúng file mẫu nhé.`);

  const rows: QuestionImportRow[] = [];
  table.slice(1).forEach((cells, index) => {
    const values = cells.map((cell) => String(cell ?? "").normalize("NFC").trim());
    if (values.every((v) => v === "")) return;
    const row = { row: index + 2 } as QuestionImportRow; // +2: dòng tiêu đề là dòng 1 trong Excel
    for (const column of QUESTION_IMPORT_COLUMNS) row[column] = values[header.indexOf(column)] ?? "";
    rows.push(row);
  });
  return rows;
}
