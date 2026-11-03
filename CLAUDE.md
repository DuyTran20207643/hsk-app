@AGENTS.md

# Hệ thống quản trị ôn thi HSK

Đồ án tốt nghiệp: website tự ôn thi HSK cấp 1–3 dành cho người Việt.

- Link chính thức (production): https://on-thi-hsk.vercel.app — deploy trên Vercel, tự build khi push lên `main`. Link cũ `hsk-app-sigma-five.vercel.app` tự chuyển hướng về đây; luôn dùng link chính thức khi cấu hình (ví dụ Supabase Auth → URL Configuration).

## Người làm đồ án

Sinh viên, chưa vững về lập trình. Khi làm việc:

- Giải thích mỗi bước bằng tiếng Việt đơn giản, tránh thuật ngữ khó (nếu bắt buộc dùng thì giải thích ngắn).
- Hỏi trước khi làm việc quan trọng: xóa file, đổi cấu trúc database, cài thêm thư viện lớn, push lên GitHub, thay đổi cấu hình bảo mật.

## Tác nhân (người dùng)

- **Khách**: chưa đăng nhập; xem trang giới thiệu, đăng ký / đăng nhập.
- **Học viên**: người Việt tự học; đặt mục tiêu và ngày thi, ôn từ vựng, ngữ pháp, làm đề thi thử HSK 1–3, xem kết quả và tiến độ.
- **Quản trị viên**: quản lý ngân hàng câu hỏi, đề thi, từ vựng, tài khoản học viên và thống kê.

## Ba điểm khác biệt của sản phẩm

Mọi tính năng nên phục vụ ít nhất một trong ba điểm này:

- **(A) Học từ vựng qua âm Hán Việt**: mỗi từ có âm Hán Việt để người Việt dễ nhớ; cảnh báo những từ Hán Việt dễ nhầm nghĩa (nghĩa tiếng Trung khác nghĩa quen dùng trong tiếng Việt).
- **(C) Lộ trình đếm ngược theo ngày thi và Chỉ số sẵn sàng**: lộ trình ôn tập chia theo số ngày còn lại tới ngày thi; Chỉ số sẵn sàng cho biết học viên đã sẵn sàng thi đến đâu.
- **(D) Thi thử đúng cấu trúc đề và phân tích điểm yếu**: đề thi thử theo đúng cấu trúc đề HSK thật của từng cấp; sau khi nộp bài, phân tích kỹ năng / dạng câu còn yếu.

## Mockup giao diện (đã duyệt)

`docs/mockups/` chứa ảnh 16 màn hình đã được duyệt. **Trước khi dựng hoặc sửa một màn hình, luôn mở ảnh tương ứng để bám sát** bố cục, nội dung chữ và thứ tự các thành phần.

| Màn hình | Ảnh |
| --- | --- |
| 1. Giới thiệu | `01-gioi-thieu.png` |
| 2. Đăng nhập | `02-dang-nhap.png` |
| 3. Đặt mục tiêu | `03-dat-muc-tieu.png` |
| 4. Trang chủ | `04-trang-chu.png` |
| 5. Lộ trình / Đổi mục tiêu | `05a-lo-trinh.png`, `05b-doi-muc-tieu.png` |
| 6. Ôn tập | `06-on-tap.png` |
| 7. Ôn tổng hợp | `07-on-tong-hop.png` |
| 8. Thẻ từ (mặt trước / mặt sau) | `08a-the-tu-mat-truoc.png`, `08b-the-tu-mat-sau.png` |
| 9. Sổ từ | `09-so-tu.png` |
| 10. Ngữ pháp | `10-ngu-phap.png` |
| 11. Tiến độ | `11-tien-do.png` |
| 12. Danh sách đề | `12-danh-sach-de.png` |
| 13. Làm bài / Bấm nộp bài | `13a-lam-bai.png`, `13b-bam-nop-bai.png` |
| 14. Kết quả | `14-ket-qua.png` |
| 15. Xem lại | `15-xem-lai.png` |
| 16. Quản trị từ vựng / Thêm từ vựng | `16a-quan-tri-tu-vung.png`, `16b-them-tu-vung.png` |

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
- `src/lib/supabase/proxy.ts` + `src/proxy.ts` — làm mới phiên đăng nhập và bảo vệ trang ở mỗi request (Next.js 16 gọi middleware là proxy): chưa đăng nhập thì về `/auth?next=…`; tài khoản bị khóa thì đăng xuất; `/admin/*` chỉ cho quản trị viên
- `src/app/auth/` — trang đăng nhập / đăng ký, Server Actions (`actions.ts`), `callback/route.ts` nhận liên kết xác nhận email
- `src/lib/auth/session.ts` — `getCurrentUser()` (người đang đăng nhập + vai trò), `getPostLoginPath()` (chưa có mục tiêu thì về `/onboarding`)
- `src/app/(app)/` — các trang cần đăng nhập, dùng chung thanh điều hướng (`src/components/app-shell/`). Trang quản trị đặt trong `src/app/(app)/admin/`: layout ở đó kiểm tra vai trò ở máy chủ
- Cache Components đang bật: code đọc cookie / phiên đăng nhập phải nằm trong `<Suspense>`
- `supabase/migrations/` — các file migration SQL của database
- `docs/mockups/` — ảnh mockup 16 màn hình đã duyệt

## Quy tắc

### Giao diện

- Phong cách **iOS 16**: bám theo mockup trong `docs/mockups/`.
- Giao diện, thông báo lỗi, nội dung hiển thị: **toàn bộ tiếng Việt**, xưng **"bạn"** với người dùng. Chữ Hán đặt trong phần tử có `lang="zh-CN"` và class `font-hanzi`.
- **Không dùng emoji** trong giao diện (dùng icon, ví dụ lucide, nếu cần).
- **Không có** XP, streak hay huy hiệu (không làm các cơ chế game hóa này).

### Bảo mật

- **Không bao giờ commit khóa bí mật.** Khóa thật chỉ nằm trong `.env.local` (đã bị `.gitignore` chặn). `.env.example` chỉ chứa tên biến, để trống giá trị. Trước khi commit, kiểm tra `git status` không có file `.env` nào ngoài `.env.example`.
- **Không bao giờ dùng `service_role` key trong code chạy ở trình duyệt.** Khóa này bỏ qua mọi quyền (RLS). Nếu thật sự cần, chỉ dùng trong code chạy trên máy chủ, đặt tên biến KHÔNG có tiền tố `NEXT_PUBLIC_` (ví dụ `SUPABASE_SERVICE_ROLE_KEY`), và không import vào file có `"use client"`.
- **Chấm điểm bài làm và chọn câu hỏi luôn làm ở phía máy chủ** (Server Action, Route Handler hoặc hàm trong database). Không gửi đáp án đúng xuống trình duyệt trước khi học viên nộp bài.

### Database Supabase

- Mọi bảng phải bật Row Level Security (RLS) và có policy phân quyền Khách / Học viên / Quản trị viên.
- Migration lưu trong `supabase/migrations/`, đánh số tăng dần: `0001_<mo_ta>.sql`, `0002_<mo_ta>.sql`…
- **Không sửa migration đã chạy.** Cần thay đổi thì tạo migration mới với số tiếp theo.

### Quy trình sau mỗi nhiệm vụ

1. Chạy `npm run lint` và `npm run build`, sửa hết lỗi rồi mới báo xong.
2. Tóm tắt bằng tiếng Việt: đã làm gì, file nào thay đổi, người làm đồ án cần kiểm tra gì.
