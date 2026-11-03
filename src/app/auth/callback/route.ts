import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getPostLoginPath, signOutIfLocked } from "@/lib/auth/session";

// Người dùng bấm liên kết xác nhận trong email sẽ được đưa về đây.
// Đổi mã trong liên kết thành phiên đăng nhập, rồi chuyển tới trang phù hợp.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNextPath(params.get("next"));

  const supabase = await createClient();
  let failed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  }

  if (failed) {
    return NextResponse.redirect(new URL("/auth?error=link", request.url));
  }

  const { data } = await supabase.auth.getClaims();
  if (data?.claims && (await signOutIfLocked(supabase, data.claims.sub))) {
    return NextResponse.redirect(new URL("/auth?error=locked", request.url));
  }

  const destination = await getPostLoginPath(supabase, next);
  return NextResponse.redirect(new URL(destination, request.url));
}
