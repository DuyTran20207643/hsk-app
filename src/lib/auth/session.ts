import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "learner" | "admin";
  status: "active" | "locked";
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Người đang đăng nhập (kèm vai trò từ bảng profiles), hoặc null nếu chưa đăng nhập.
// cache(): trong cùng một lần tải trang, gọi nhiều lần chỉ hỏi database một lần.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Supabase dùng giờ hiện tại (Date.now) để kiểm tra phiên còn hạn, nên phần này
  // chỉ được chạy khi có người truy cập thật, không chạy lúc Next.js dựng trước trang.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, status")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    displayName: profile?.display_name ?? null,
    role: profile?.role === "admin" ? "admin" : "learner",
    status: profile?.status === "locked" ? "locked" : "active",
  };
});

// Trang cần đến ngay sau khi đăng nhập: chưa có mục tiêu ôn thi đang hoạt động
// thì đi đặt mục tiêu, có rồi thì về trang đang định vào (hoặc /home).
export async function getPostLoginPath(
  supabase: ServerClient,
  next: string | null,
): Promise<string> {
  const { count, error } = await supabase
    .from("study_goals")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (!error && count === 0) return "/onboarding";
  return next ?? "/home";
}

// Kiểm tra trạng thái khóa ngay sau khi đăng nhập; bị khóa thì đăng xuất luôn.
export async function signOutIfLocked(
  supabase: ServerClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.status !== "locked") return false;
  await supabase.auth.signOut();
  return true;
}
