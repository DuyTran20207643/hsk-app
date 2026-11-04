"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleX, Copy, Download, FileSpreadsheet } from "lucide-react";
import { Sheet } from "@/components/ios/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE_ROWS,
  type ImportPreview,
  type ImportRow,
} from "@/lib/words/import";
import { commitImport, previewImport } from "./actions";
import type { Notice, Option } from "./words-manager";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TEMPLATE_NAME = "mau-import-tu-vung.xlsx";

// Thư viện xlsx khá lớn nên chỉ tải khi cần (bấm Tải file mẫu hoặc chọn file)
const loadXlsx = () => import("xlsx");

type Props = {
  open: boolean;
  topics: Option[];
  onClose: () => void;
  onDone: (notice: Notice) => void;
};

// Import từ vựng từ file Excel: trình duyệt đọc file → máy chủ kiểm tra (xem trước) → lưu.
export function ImportSheet({ open, topics, onClose, onDone }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
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
    const words = XLSX.utils.json_to_sheet(IMPORT_TEMPLATE_ROWS, { header: [...IMPORT_COLUMNS] });
    words["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: c === "false_friend_note" ? 50 : c === "topic" ? 28 : 16 }));
    XLSX.utils.book_append_sheet(book, words, "tu_vung");
    // Trang thứ hai: danh sách chủ đề hợp lệ để chép vào cột topic
    const topicSheet = XLSX.utils.aoa_to_sheet([["topic (chép đúng tên)"], ...topics.map((t) => [t.name])]);
    topicSheet["!cols"] = [{ wch: 36 }];
    XLSX.utils.book_append_sheet(book, topicSheet, "chu_de");
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

    let parsed: ImportRow[];
    try {
      parsed = await readRows(file);
    } catch (e) {
      if (!(e instanceof ReadError)) console.error("[import] Không đọc được file:", e);
      return setError(e instanceof ReadError ? e.message : "Không đọc được file. Bạn kiểm tra lại file Excel nhé.");
    }
    if (parsed.length === 0) return setError("File không có dòng dữ liệu nào.");
    if (parsed.length > IMPORT_MAX_ROWS) {
      return setError(`File có ${parsed.length} dòng, vượt quá giới hạn ${IMPORT_MAX_ROWS.toLocaleString("vi-VN")} dòng.`);
    }

    setRows(parsed);
    startChecking(async () => {
      const result = await previewImport(parsed);
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    });
  }

  function runImport() {
    if (!rows) return;
    startImporting(async () => {
      const result = await commitImport(rows);
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
      description="Nhập nhiều từ vựng cùng lúc từ file Excel."
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4">
          <p className="text-subheadline text-muted-foreground">
            File cần đúng các cột của file mẫu. Cột <code className="font-mono">topic</code> phải trùng tên một chủ
            đề (xem trang <code className="font-mono">chu_de</code> trong file mẫu), cột{" "}
            <code className="font-mono">is_false_friend</code> ghi &quot;Có&quot; hoặc &quot;Không&quot;. Tối đa{" "}
            {IMPORT_MAX_ROWS.toLocaleString("vi-VN")} dòng.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="gray" onClick={downloadTemplate} disabled={busy}>
              <Download className="size-5" aria-hidden />
              Tải file mẫu
            </Button>
            <input
              ref={fileInput}
              id="import-file"
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
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={CircleCheck} tone="text-green" label="Hợp lệ" value={preview.valid.length} />
              <Stat icon={CircleX} tone="text-destructive" label="Lỗi" value={preview.errors.length} />
              <Stat icon={Copy} tone="text-orange" label="Trùng" value={preview.duplicates.length} />
            </div>

            {preview.errors.length > 0 && (
              <IssueList
                title={`Dòng lỗi (${preview.errors.length})`}
                items={preview.errors.map((e) => ({ row: e.row, text: e.messages.join(" ") }))}
                className="text-destructive"
              />
            )}
            {preview.duplicates.length > 0 && (
              <IssueList
                title={`Dòng trùng (${preview.duplicates.length}), sẽ bỏ qua`}
                items={preview.duplicates.map((d) => ({
                  row: d.row,
                  text: (
                    <>
                      <span lang="zh-CN" className="font-hanzi">
                        {d.hanzi}
                      </span>{" "}
                      ({d.pinyin}): {d.reason}
                    </>
                  ),
                }))}
                className="text-orange"
              />
            )}

            <p className="flex gap-2 text-footnote text-muted-foreground">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              Chỉ các dòng hợp lệ được lưu. Dòng lỗi và dòng trùng bị bỏ qua; bạn sửa file rồi import lại sau.
            </p>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            onClick={runImport}
            disabled={!preview || preview.valid.length === 0 || busy}
          >
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
      <h3 className="mb-1.5 px-4 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="max-h-56 overflow-y-auto rounded-xl bg-card">
        {items.map((item) => (
          <li key={item.row} className="flex gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
            <span className={cn("shrink-0 text-subheadline font-semibold", className)}>Dòng {item.row}</span>
            <span className="text-subheadline">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

class ReadError extends Error {}

// Đọc trang tính đầu tiên: dòng 1 là tên cột, các dòng sau là dữ liệu (bỏ dòng trống)
async function readRows(file: File): Promise<ImportRow[]> {
  const XLSX = await loadXlsx();
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new ReadError("File không có trang tính nào.");

  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: true });
  const header = (table[0] ?? []).map((cell) => String(cell).trim().toLowerCase());
  const missing = IMPORT_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new ReadError(`File thiếu cột: ${missing.join(", ")}. Bạn dùng đúng file mẫu nhé.`);

  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, index) => {
    const values = cells.map((cell) => String(cell ?? "").normalize("NFC").trim());
    if (values.every((v) => v === "")) return;
    const row = { row: index + 2 } as ImportRow; // +2: dòng tiêu đề là dòng 1 trong Excel
    for (const column of IMPORT_COLUMNS) row[column] = values[header.indexOf(column)] ?? "";
    rows.push(row);
  });
  return rows;
}
