import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Trang ai cũng vào được. Mọi trang khác đều phải đăng nhập.
function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/auth" || pathname.startsWith("/auth/");
}

// Nhớ tạm vai trò / trạng thái của mỗi người trong 60 giây để không phải hỏi
// database ở mọi lần bấm (máy chủ Supabase ở xa, mỗi lượt hỏi mất vài trăm ms).
// Đánh đổi: admin khóa tài khoản hoặc hạ quyền thì tối đa 60 giây sau mới có hiệu lực.
// Phân quyền dữ liệu vẫn do RLS kiểm tra ở mỗi truy vấn, không bị ảnh hưởng.
type CachedProfile = { role: string; status: string };
const PROFILE_TTL_MS = 60_000;
const PROFILE_CACHE_MAX = 1000;
const profileCache = new Map<string, CachedProfile & { expiresAt: number }>();

function readCachedProfile(userId: string): CachedProfile | null {
  const hit = profileCache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    profileCache.delete(userId);
    return null;
  }
  return hit;
}

function cacheProfile(userId: string, profile: CachedProfile) {
  // Giới hạn số người được nhớ: đầy thì bỏ người được nhớ lâu nhất
  if (profileCache.size >= PROFILE_CACHE_MAX) {
    const oldest = profileCache.keys().next().value;
    if (oldest) profileCache.delete(oldest);
  }
  profileCache.set(userId, { role: profile.role, status: profile.status, expiresAt: Date.now() + PROFILE_TTL_MS });
}

// Làm mới phiên đăng nhập Supabase và bảo vệ các trang trước khi hiển thị.
// Được gọi từ src/proxy.ts cho mọi request (trừ file tĩnh).
export async function updateSession(request: NextRequest) {
  // Chưa cấu hình .env.local thì bỏ qua, để trang chủ vẫn báo lỗi rõ ràng.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          cacheHeaders = { ...cacheHeaders, ...headers };
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Không chèn code giữa createServerClient và getClaims(),
  // nếu không người dùng có thể bị đăng xuất ngẫu nhiên.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  // Chuyển hướng nhưng vẫn giữ cookie phiên vừa được làm mới.
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  };

  const { pathname, search } = request.nextUrl;

  if (!userId) {
    // Chưa đăng nhập: chỉ được vào trang công khai.
    if (isPublicPath(pathname)) return supabaseResponse;
    const next = encodeURIComponent(pathname + search);
    return redirectTo(`/auth?next=${next}`);
  }

  // Đã đăng nhập mà vào trang giới thiệu / đăng nhập thì về trang chủ học tập.
  if (pathname === "/" || pathname === "/auth") return redirectTo("/home");
  if (isPublicPath(pathname)) return supabaseResponse;

  // Trang cần đăng nhập: kiểm tra khóa tài khoản và quyền quản trị ở máy chủ.
  let profile = readCachedProfile(userId);
  if (!profile) {
    const { data } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", userId)
      .maybeSingle();
    profile = data ?? null;
    if (profile) cacheProfile(userId, profile);
  }

  if (profile?.status === "locked") {
    profileCache.delete(userId);
    await supabase.auth.signOut();
    return redirectTo("/auth?error=locked");
  }

  if (
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    profile?.role !== "admin"
  ) {
    return redirectTo("/home");
  }

  return supabaseResponse;
}
