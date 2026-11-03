import type { AuthError } from "@supabase/supabase-js";

export const LOCKED_MESSAGE = "Tài khoản của bạn đã bị khóa";

// Thông báo cho các lỗi truyền qua ?error= trên trang /auth.
export const URL_ERROR_MESSAGES: Record<string, string> = {
  locked: LOCKED_MESSAGE,
  link: "Liên kết xác nhận không hợp lệ hoặc đã hết hạn. Bạn hãy đăng nhập lại, hoặc đăng ký để nhận liên kết mới.",
};

// Đổi lỗi của Supabase Auth sang câu tiếng Việt dễ hiểu.
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Bạn chưa xác nhận email. Hãy mở hộp thư và bấm vào liên kết xác nhận.";
    case "user_already_exists":
    case "email_exists":
      return "Email này đã được đăng ký. Bạn hãy chuyển sang Đăng nhập.";
    case "weak_password":
      return "Mật khẩu quá yếu. Bạn hãy dùng ít nhất 8 ký tự, nên có cả chữ và số.";
    case "email_address_invalid":
      return "Địa chỉ email không hợp lệ.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Hệ thống đang tạm ngừng đăng ký và đăng nhập bằng email. Vui lòng liên hệ quản trị viên.";
    case "user_banned":
      return LOCKED_MESSAGE;
  }
  if (error.status === 0 || error.name === "AuthRetryableFetchError") {
    return "Không kết nối được máy chủ. Bạn hãy kiểm tra mạng rồi thử lại.";
  }
  // Lỗi chưa có câu tiếng Việt riêng: ghi chi tiết vào log máy chủ để tìm nguyên nhân
  console.error("[auth] Lỗi chưa xử lý:", {
    code: error.code,
    status: error.status,
    name: error.name,
    message: error.message,
  });
  return "Đã có lỗi xảy ra. Bạn vui lòng thử lại.";
}
