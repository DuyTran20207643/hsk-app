export type ConnectionStatus =
  | { ok: true }
  | { ok: false; reason: string };

// Kiểm tra máy chủ có kết nối được tới Supabase hay không.
// Gọi endpoint /auth/v1/health: không cần tạo bảng nào trong database,
// nhưng vẫn kiểm tra được cả URL lẫn anon key.
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      reason:
        "Chưa điền NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong file .env.local.",
    };
  }

  let healthUrl: URL;
  try {
    healthUrl = new URL("/auth/v1/health", url);
  } catch {
    return {
      ok: false,
      reason: `NEXT_PUBLIC_SUPABASE_URL không phải địa chỉ hợp lệ: "${url}".`,
    };
  }

  try {
    const res = await fetch(healthUrl, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: `Supabase từ chối khóa (HTTP ${res.status}). Hãy kiểm tra lại NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
      };
    }
    return {
      ok: false,
      reason: `Supabase trả về lỗi HTTP ${res.status} ${res.statusText}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `Không gọi được tới ${healthUrl.origin} (${message}). Hãy kiểm tra URL và kết nối mạng.`,
    };
  }
}
