// Chỉ chấp nhận đường dẫn nội bộ (bắt đầu bằng một dấu "/") cho tham số ?next=,
// để kẻ xấu không lợi dụng trang đăng nhập chuyển người dùng sang web khác.
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  // Không quay lại chính trang đăng nhập (tránh vòng lặp).
  if (value === "/auth" || value.startsWith("/auth?") || value.startsWith("/auth/")) {
    return null;
  }
  return value;
}
