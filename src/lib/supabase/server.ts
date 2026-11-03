import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client dùng trong Server Component, Server Action và Route Handler.
// Mỗi request phải tạo một client mới, không dùng chung giữa các request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component không được phép ghi cookie.
            // Có thể bỏ qua vì proxy.ts đã làm mới phiên đăng nhập.
          }
        },
      },
    },
  );
}
