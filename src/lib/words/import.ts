// Quy ước file Excel để import từ vựng. Dùng chung cho trình duyệt (đọc file, tạo file mẫu)
// và máy chủ (kiểm tra, lưu).

export const IMPORT_MAX_ROWS = 1000;

// Đúng thứ tự cột trong file mẫu
export const IMPORT_COLUMNS = [
  "hanzi",
  "pinyin",
  "han_viet",
  "meaning_vi",
  "level",
  "topic",
  "example_zh",
  "example_vi",
  "is_false_friend",
  "false_friend_note",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

// Một dòng trong file (mọi ô đã đổi thành chữ). row: số thứ tự dòng trong Excel (dòng tiêu đề là 1).
export type ImportRow = { row: number } & Record<ImportColumn, string>;

export const IMPORT_TEMPLATE_ROWS: Record<ImportColumn, string | number>[] = [
  {
    hanzi: "机场",
    pinyin: "ji1chang3",
    han_viet: "cơ trường",
    meaning_vi: "sân bay",
    level: 2,
    topic: "Giao thông và đi lại",
    example_zh: "我去机场接朋友。",
    example_vi: "Tôi ra sân bay đón bạn.",
    is_false_friend: "Không",
    false_friend_note: "",
  },
  {
    hanzi: "东西",
    pinyin: "dōngxi",
    han_viet: "đông tây",
    meaning_vi: "đồ, đồ vật",
    level: 1,
    topic: "Mua sắm, quần áo và đồ dùng",
    example_zh: "你买什么东西？",
    example_vi: "Bạn mua đồ gì?",
    is_false_friend: "Có",
    false_friend_note: "Không phải hướng đông và tây; 东西 (dōngxi, thanh nhẹ) nghĩa là đồ vật.",
  },
];

// "1", "HSK 1", "hsk1" → 1. Không đọc được thì null.
export function parseLevel(value: string): number | null {
  const match = value.trim().match(/^(?:hsk\s*)?(\d+)$/i);
  return match ? Number(match[1]) : null;
}

// "Có" → true, "Không" hoặc để trống → false, chữ khác → null (lỗi)
export function parseFalseFriend(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "có") return true;
  if (normalized === "không" || normalized === "") return false;
  return null;
}

export type ImportPreview = {
  total: number;
  valid: { row: number; hanzi: string; pinyin: string }[];
  errors: { row: number; messages: string[] }[];
  duplicates: { row: number; hanzi: string; pinyin: string; reason: string }[];
};

// Máy chủ không tin dữ liệu gửi từ trình duyệt: chỉ giữ đúng các cột đã biết,
// đổi mọi ô thành chữ (chuẩn Unicode NFC, tối đa 1.000 ký tự mỗi ô).
export function sanitizeImportRows(input: unknown): ImportRow[] | null {
  if (!Array.isArray(input)) return null;
  return input.map((item, index) => {
    const source = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    const row = { row: Number.isInteger(source.row) ? (source.row as number) : index + 2 } as ImportRow;
    for (const column of IMPORT_COLUMNS) {
      const value = source[column];
      row[column] =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value).normalize("NFC").slice(0, 1000)
          : "";
    }
    return row;
  });
}
