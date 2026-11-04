// Đổi pinyin dạng số (ni3 hao3) sang pinyin có dấu thanh (nǐ hǎo).
// Chạy được cả ở máy chủ, trình duyệt và trong bài test (node --test), nên không import gì thêm.

const TONE_MARKS: Record<string, readonly [string, string, string, string]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  A: ["Ā", "Á", "Ǎ", "À"],
  E: ["Ē", "É", "Ě", "È"],
  I: ["Ī", "Í", "Ǐ", "Ì"],
  O: ["Ō", "Ó", "Ǒ", "Ò"],
  U: ["Ū", "Ú", "Ǔ", "Ù"],
  Ü: ["Ǖ", "Ǘ", "Ǚ", "Ǜ"],
};

// Một âm tiết viết kèm số thanh 0–5 ở cuối, ví dụ "hao3", "lv4", "nu:3"
const NUMBERED_SYLLABLE = /([a-zü:]+)([0-5])/giu;

// Đặt dấu thanh cho một âm tiết theo quy tắc pinyin:
// 1. có a hoặc e thì dấu nằm trên a / e;
// 2. có "ou" thì dấu nằm trên o;
// 3. còn lại dấu nằm trên nguyên âm cuối cùng (ví dụ "gui" → guì, "liu" → liú).
function markSyllable(letters: string, tone: number): string {
  // v và u: là cách gõ thay cho ü
  const syllable = letters.replace(/u:|v/g, "ü").replace(/U:|V/g, "Ü");
  if (tone === 0 || tone === 5) return syllable; // thanh nhẹ: không có dấu

  const lower = syllable.toLowerCase();
  let index = lower.search(/[ae]/);
  if (index < 0) index = lower.indexOf("ou");
  if (index < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ("iouü".includes(lower[i])) {
        index = i;
        break;
      }
    }
  }
  // Không có nguyên âm (ví dụ "m2", "ng4"): giữ nguyên như người dùng nhập
  if (index < 0) return letters + tone;

  const marked = TONE_MARKS[syllable[index]][tone - 1];
  return syllable.slice(0, index) + marked + syllable.slice(index + 1);
}

// Đổi mọi âm tiết có số trong chuỗi; phần đã có dấu thì giữ nguyên.
// Ví dụ: "ni3 hao3" → "nǐ hǎo", "ji1chang3" → "jīchǎng", "dōngxi" → "dōngxi".
export function numberedToToneMarks(input: string): string {
  return input.replace(NUMBERED_SYLLABLE, (_, letters: string, tone: string) =>
    markSyllable(letters, Number(tone)),
  );
}

// Pinyin "trơn" để tìm kiếm và so trùng: bỏ dấu thanh, chữ thường, bỏ khoảng trắng / dấu ' / số,
// ü và v viết thành u. Giống cột words.pinyin_plain (migration 0005).
// Ví dụ: "dōngxi", "dong1 xi5", "Dong Xi" → "dongxi".
export function plainPinyin(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu thanh (và dấu hai chấm của ü)
    .toLowerCase()
    .replace(/u:|v/g, "u")
    .replace(/[\s'0-5]/g, "");
}

// Chuẩn hóa pinyin trước khi lưu: bỏ khoảng trắng thừa, đổi dạng số sang dấu thanh.
export function normalizePinyin(input: string): string {
  return numberedToToneMarks(input.trim().replace(/\s+/g, " "));
}
