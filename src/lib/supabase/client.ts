import { createBrowserClient } from "@supabase/ssr";

// Supabase client dùng trong Client Component (chạy trên trình duyệt).
// Chỉ dùng anon key — tuyệt đối không dùng service_role key ở đây.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
