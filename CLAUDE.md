@AGENTS.md

# Hệ thống quản trị ôn thi HSK

Đồ án tốt nghiệp: website giúp người Việt tự ôn thi HSK cấp 1–3.

## Người làm đồ án

Sinh viên, chưa vững về lập trình. Khi làm việc:

- Giải thích mỗi bước bằng tiếng Việt đơn giản, tránh thuật ngữ khó (nếu bắt buộc dùng thì giải thích ngắn).
- Hỏi trước khi làm việc quan trọng: xóa file, đổi cấu trúc database, cài thêm thư viện lớn, push lên GitHub, thay đổi cấu hình bảo mật.

## Đối tượng người dùng

- **Học viên**: người Việt tự học, luyện từ vựng, ngữ pháp, làm đề thi thử HSK 1–3, xem kết quả và tiến độ.
- **Quản trị viên**: quản lý ngân hàng câu hỏi, đề thi, từ vựng, tài khoản học viên và thống kê.

## Stack công nghệ

- Next.js (App Router) + TypeScript, mã nguồn trong `src/`
- Tailwind CSS v4 + shadcn/ui (component trong `src/components/ui/`)
- Supabase (database PostgreSQL, đăng nhập, lưu trữ file) qua `@supabase/supabase-js` và `@supabase/ssr`
- Font qua `next/font`: Be Vietnam Pro (giao diện tiếng Việt), Noto Sans SC (chữ Hán, dùng class `font-hanzi`)

## Cấu trúc chính

- `src/app/` — các trang (mỗi thư mục là một đường dẫn URL)
- `src/components/ui/` — component shadcn/ui, thêm bằng `npx shadcn@latest add <tên>`
- `src/lib/supabase/client.ts` — Supabase client cho Client Component (trình duyệt)
- `src/lib/supabase/server.ts` — Supabase client cho Server Component / Server Action / Route Handler
- `src/lib/supabase/proxy.ts` + `src/proxy.ts` — làm mới phiên đăng nhập ở mỗi request (Next.js 16 gọi middleware là proxy)

## Quy tắc

- Giao diện, thông báo lỗi, nội dung hiển thị: **tiếng Việt**. Chữ Hán đặt trong phần tử có `lang="zh-CN"` và class `font-hanzi`.
- **Không bao giờ commit khóa bí mật.** Khóa thật chỉ nằm trong `.env.local` (đã bị `.gitignore` chặn). `.env.example` chỉ chứa tên biến, để trống giá trị. Trước khi commit, kiểm tra `git status` không có file `.env` nào ngoài `.env.example`.
- **Không dùng `service_role` key ở phía trình duyệt.** Khóa này bỏ qua mọi quyền (RLS). Nếu thật sự cần, chỉ dùng trong code chạy trên máy chủ, đặt tên biến KHÔNG có tiền tố `NEXT_PUBLIC_` (ví dụ `SUPABASE_SERVICE_ROLE_KEY`), và không import vào file có `"use client"`.
- Mọi bảng trong Supabase phải bật Row Level Security (RLS) và có policy phân quyền Học viên / Quản trị viên.
- Kiểm tra trước khi báo xong: `npm run lint` và `npm run build` phải chạy thành công.
