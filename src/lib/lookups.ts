import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// Danh sách cấp HSK và chủ đề: gần như không đổi, ai cũng được đọc (RLS cho phép anon),
// nên nhớ sẵn ở máy chủ thay vì hỏi Supabase ở mỗi lần tải trang.
// Khi có trang sửa chủ đề / cấp: gọi updateTag(LOOKUPS_TAG) sau khi ghi để làm mới.
export const LOOKUPS_TAG = "lookups";

export type LookupOption = { id: number; name: string };

// Client không đọc cookie (dữ liệu công khai), dùng được bên trong "use cache"
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getLevelOptions(): Promise<LookupOption[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(LOOKUPS_TAG);
  const { data, error } = await publicClient().from("hsk_levels").select("id, name").order("sort_order");
  if (error) throw new Error(`Không tải được danh sách cấp HSK: ${error.message}`);
  return data ?? [];
}

export async function getTopicOptions(): Promise<LookupOption[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(LOOKUPS_TAG);
  const { data, error } = await publicClient().from("topics").select("id, name").order("sort_order");
  if (error) throw new Error(`Không tải được danh sách chủ đề: ${error.message}`);
  return data ?? [];
}
