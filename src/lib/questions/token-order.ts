// Thứ tự HIỂN THỊ các cụm của câu "Viết – sắp xếp câu".
// Quản trị viên thường nhập các cụm theo đúng thứ tự của câu đáp án, nên phải xáo trước khi cho
// học viên xem. Câu trả lời vẫn ghi theo số thứ tự gốc của cụm (content.tokens), nên việc xáo
// không ảnh hưởng tới chấm điểm.
//
// Xáo "cố định": cùng các cụm thì luôn ra cùng một thứ tự (tải lại trang không đổi, máy chủ và
// trình duyệt dựng giống nhau). Không bao giờ giữ nguyên thứ tự đã nhập khi có từ 2 cụm khác nhau.

/** Băm chuỗi thành số 32 bit (FNV-1a) */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống thì cùng dãy số */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Danh sách số thứ tự gốc của các cụm, theo thứ tự sẽ hiện cho học viên */
export function tokenDisplayOrder(tokens: string[]): number[] {
  const order = tokens.map((_, i) => i);
  const random = seededRandom(hash(tokens.join("\u0000")));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Xáo xong mà chữ hiện ra vẫn y như thứ tự đã nhập thì xoay vòng một bước
  const same = order.every((tokenIndex, position) => tokens[tokenIndex] === tokens[position]);
  if (same && new Set(tokens).size > 1) {
    order.push(order.shift() as number);
  }
  return order;
}
