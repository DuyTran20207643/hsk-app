// Dựng một PostgreSQL thật chạy ngay trong bài test (thư viện PGlite, không cần mạng,
// không đụng database Supabase thật), rồi chạy lần lượt các migration của dự án.
// Chỉ dùng trong bài test (*.test.ts).
//
// Mô phỏng phần Supabase tự có: vai trò anon / authenticated, bảng auth.users và hàm auth.uid()
// (đọc mã người dùng từ cài đặt request.jwt.claim.sub, giống Supabase).
// Bỏ qua các migration về Storage (0004, 0008) vì PGlite không có schema storage.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "supabase", "migrations");
const SKIPPED = new Set(["0004_word_images_storage.sql", "0008_question_images_storage.sql"]);
const MIGRATIONS = [
  "0001_schema.sql",
  "0002_rls.sql",
  "0003_seed.sql",
  "0004_word_images_storage.sql",
  "0005_words_pinyin_search.sql",
  "0006_words_han_viet_optional.sql",
  "0007_explicit_grants.sql",
  "0008_question_images_storage.sql",
  "0009_practice_sessions.sql",
  "0010_review_modes.sql",
];

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of MIGRATIONS) {
    if (SKIPPED.has(file)) continue;
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} chạy lỗi: ${(error as Error).message}`);
    }
  }
  return db;
}

/** Tạo một tài khoản (profiles tự sinh qua trigger); role = 'admin' thì nâng quyền */
export async function createUser(db: PGlite, id: string, role: "learner" | "admin" = "learner") {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@example.test`]);
  if (role === "admin") await db.query("update public.profiles set role = 'admin' where id = $1", [id]);
}

/**
 * Chạy `fn` trong vai một người đã đăng nhập (vai trò authenticated, auth.uid() = userId),
 * giống khi học viên gọi database qua Supabase. Xong thì trả về quyền quản trị database.
 */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
