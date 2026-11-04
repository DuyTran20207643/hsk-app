// Kiểu dữ liệu và quy tắc kiểm tra một từ vựng.
// Dùng chung cho sheet Thêm / Sửa từ và Import Excel; máy chủ luôn kiểm tra lại bằng các hàm này.
// Đường dẫn tương đối kèm .ts để bài test (node --test) chạy được trực tiếp
import { normalizePinyin } from "../pinyin.ts";

export type WordStatus = "active" | "inactive";

// Một từ vựng như hiển thị ở trang quản trị
export type WordRow = {
  id: string;
  hanzi: string;
  pinyin: string;
  hanViet: string;
  meaningVi: string;
  exampleZh: string | null;
  exampleVi: string | null;
  levelId: number;
  topicId: number | null;
  isFalseFriend: boolean;
  falseFriendNote: string | null;
  imageUrl: string | null;
  status: WordStatus;
};

// Cột cần lấy từ bảng words để dựng WordRow
export const WORD_COLUMNS =
  "id, hanzi, pinyin, han_viet, meaning_vi, example_zh, example_vi, level_id, topic_id, is_false_friend, false_friend_note, image_url, status";

type WordDbRow = {
  id: string;
  hanzi: string;
  pinyin: string;
  han_viet: string;
  meaning_vi: string;
  example_zh: string | null;
  example_vi: string | null;
  level_id: number;
  topic_id: number | null;
  is_false_friend: boolean;
  false_friend_note: string | null;
  image_url: string | null;
  status: string;
};

export function toWordRow(row: WordDbRow): WordRow {
  return {
    id: row.id,
    hanzi: row.hanzi,
    pinyin: row.pinyin,
    hanViet: row.han_viet,
    meaningVi: row.meaning_vi,
    exampleZh: row.example_zh,
    exampleVi: row.example_vi,
    levelId: row.level_id,
    topicId: row.topic_id,
    isFalseFriend: row.is_false_friend,
    falseFriendNote: row.false_friend_note,
    imageUrl: row.image_url,
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

// Dữ liệu một từ sau khi đã kiểm tra và chuẩn hóa, sẵn sàng ghi vào bảng words
export type WordValues = {
  hanzi: string;
  pinyin: string;
  han_viet: string;
  meaning_vi: string;
  example_zh: string | null;
  example_vi: string | null;
  level_id: number;
  topic_id: number | null;
  is_false_friend: boolean;
  false_friend_note: string | null;
  status: WordStatus;
};

export type WordField =
  | "hanzi"
  | "pinyin"
  | "hanViet"
  | "meaningVi"
  | "levelId"
  | "topicId"
  | "exampleZh"
  | "exampleVi"
  | "falseFriendNote";

export type FieldErrors = Partial<Record<WordField, string>>;

// Dữ liệu thô (chữ) từ form hoặc từ một dòng Excel
export type RawWordInput = {
  hanzi: string;
  pinyin: string;
  hanViet: string;
  meaningVi: string;
  levelId: number | null; // null: không đọc được cấp
  topicId: number | null;
  exampleZh: string;
  exampleVi: string;
  isFalseFriend: boolean;
  falseFriendNote: string;
  status: WordStatus;
};

export type Lookups = { levelIds: Set<number>; topicIds: Set<number> };

const HAN_CHARACTER = /\p{Script=Han}/u;
const PINYIN_ALLOWED = /^[\p{L}\s'·0-5:-]+$/u;

const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const optional = (value: string) => (clean(value) === "" ? null : clean(value));

// Kiểm tra một từ. Trả về dữ liệu đã chuẩn hóa, hoặc lỗi theo từng ô.
export function validateWord(
  input: RawWordInput,
  lookups: Lookups,
): { values: WordValues; errors?: undefined } | { values?: undefined; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const hanzi = clean(input.hanzi).replace(/\s/g, "");
  const pinyinRaw = clean(input.pinyin);
  const hanViet = clean(input.hanViet);
  const meaningVi = clean(input.meaningVi);
  const note = clean(input.falseFriendNote);

  if (!hanzi) errors.hanzi = "Bạn hãy nhập chữ Hán.";
  else if (!HAN_CHARACTER.test(hanzi)) errors.hanzi = "Chữ Hán phải có ít nhất một chữ Hán.";
  else if (hanzi.length > 20) errors.hanzi = "Chữ Hán tối đa 20 ký tự.";

  if (!pinyinRaw) errors.pinyin = "Bạn hãy nhập pinyin.";
  else if (!PINYIN_ALLOWED.test(pinyinRaw) || HAN_CHARACTER.test(pinyinRaw))
    errors.pinyin = "Pinyin chỉ gồm chữ cái Latin (có dấu hoặc số thanh 1–5).";
  else if (pinyinRaw.length > 60) errors.pinyin = "Pinyin tối đa 60 ký tự.";

  if (!hanViet) errors.hanViet = "Bạn hãy nhập âm Hán Việt.";
  else if (hanViet.length > 60) errors.hanViet = "Âm Hán Việt tối đa 60 ký tự.";

  if (!meaningVi) errors.meaningVi = "Bạn hãy nhập nghĩa tiếng Việt.";
  else if (meaningVi.length > 200) errors.meaningVi = "Nghĩa tối đa 200 ký tự.";

  if (input.levelId === null || !lookups.levelIds.has(input.levelId))
    errors.levelId = "Bạn hãy chọn cấp HSK.";

  if (input.topicId !== null && !lookups.topicIds.has(input.topicId))
    errors.topicId = "Chủ đề không tồn tại.";

  if (clean(input.exampleZh).length > 200) errors.exampleZh = "Câu ví dụ tối đa 200 ký tự.";
  if (clean(input.exampleVi).length > 300) errors.exampleVi = "Nghĩa câu ví dụ tối đa 300 ký tự.";

  // BR12: từ Hán Việt dễ nhầm thì bắt buộc có ghi chú phân biệt
  if (input.isFalseFriend && !note)
    errors.falseFriendNote = "Từ dễ nhầm cần có ghi chú phân biệt nghĩa.";
  else if (note.length > 500) errors.falseFriendNote = "Ghi chú tối đa 500 ký tự.";

  if (Object.keys(errors).length > 0) return { errors };

  return {
    values: {
      hanzi,
      pinyin: normalizePinyin(pinyinRaw), // ni3 hao3 → nǐ hǎo
      han_viet: hanViet,
      meaning_vi: meaningVi,
      example_zh: optional(input.exampleZh),
      example_vi: optional(input.exampleVi),
      level_id: input.levelId as number,
      topic_id: input.topicId,
      is_false_friend: input.isFalseFriend,
      false_friend_note: input.isFalseFriend ? note : null,
      status: input.status,
    },
  };
}

// Khóa so trùng (BR13): cùng chữ Hán và cùng pinyin, không phân biệt dấu cách / chữ hoa.
// "jīchǎng" và "jī chǎng" được coi là trùng.
export function duplicateKey(hanzi: string, pinyin: string): string {
  return `${hanzi.replace(/\s/g, "")}|${plainPinyinWithTones(pinyin)}`;
}

// So trùng giữ dấu thanh (mā khác mà), chỉ bỏ khoảng trắng / chữ hoa / dấu '
function plainPinyinWithTones(pinyin: string): string {
  return normalizePinyin(pinyin).toLowerCase().replace(/[\s']/g, "");
}

// Ảnh minh họa: chỉ jpg / png / webp, tối đa 1 MB (khớp với cài đặt bucket ở migration 0004)
export const IMAGE_MAX_BYTES = 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function imageError(file: { type: string; size: number }): string | null {
  if (!(file.type in IMAGE_TYPES)) return "Ảnh phải là file jpg, png hoặc webp.";
  if (file.size > IMAGE_MAX_BYTES) return "Ảnh tối đa 1 MB.";
  return null;
}
