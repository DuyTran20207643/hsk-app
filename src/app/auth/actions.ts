"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage, LOCKED_MESSAGE } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getPostLoginPath, signOutIfLocked } from "@/lib/auth/session";

export type AuthFormState = {
  error?: string;
  success?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Bạn hãy nhập email và mật khẩu." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };

  if (await signOutIfLocked(supabase, data.user.id)) {
    return { error: LOCKED_MESSAGE };
  }

  redirect(await getPostLoginPath(supabase, next));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!fullName) return { error: "Bạn hãy nhập họ tên." };
  if (!EMAIL_PATTERN.test(email)) return { error: "Địa chỉ email không hợp lệ." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }

  const callbackUrl = new URL("/auth/callback", await getOrigin());
  if (next) callbackUrl.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Trigger handle_new_user() đọc display_name để ghi vào profiles
      data: { display_name: fullName },
      emailRedirectTo: callbackUrl.toString(),
    },
  });
  if (error) return { error: authErrorMessage(error) };

  // Supabase không báo lỗi khi email đã tồn tại (để giấu danh sách email),
  // mà trả về user không có identities nào.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Email này đã được đăng ký. Bạn hãy chuyển sang Đăng nhập." };
  }

  // Nếu Supabase tắt bước xác nhận email thì đăng nhập luôn.
  if (data.session) redirect("/onboarding");

  return {
    success: `Đã gửi email xác nhận tới ${email}. Bạn hãy mở hộp thư và bấm vào liên kết để kích hoạt tài khoản.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}

// Địa chỉ gốc của web (localhost khi chạy thử, on-thi-hsk.vercel.app khi chạy thật)
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
