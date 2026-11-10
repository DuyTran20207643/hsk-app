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
- Font: giao diện dùng font hệ thống Apple (-apple-system, SF Pro Text) nếu có, nếu không thì Inter (tải qua `next/font`); KHÔNG nhúng tệp SF Pro (giấy phép chỉ cho thiết bị Apple). Chữ Hán và pinyin dùng PingFang SC / Noto Sans SC (class `font-hanzi`)

## Cấu trúc chính

- `src/app/` — các trang (mỗi thư mục là một đường dẫn URL)
- `src/components/ui/` — component shadcn/ui, thêm bằng `npx shadcn@latest add <tên>`
- `src/lib/supabase/client.ts` — Supabase client cho Client Component (trình duyệt)
- `src/lib/supabase/server.ts` — Supabase client cho Server Component / Server Action / Route Handler
- `src/lib/supabase/proxy.ts` + `src/proxy.ts` — làm mới phiên đăng nhập và bảo vệ trang ở mỗi request (Next.js 16 gọi middleware là proxy): chưa đăng nhập thì về `/auth?next=…`; tài khoản bị khóa thì đăng xuất; `/admin/*` chỉ cho quản trị viên
- `src/app/auth/` — trang đăng nhập / đăng ký, Server Actions (`actions.ts`), `callback/route.ts` nhận liên kết xác nhận email
- `src/lib/auth/session.ts` — `getCurrentUser()` (người đang đăng nhập + vai trò), `getPostLoginPath()` (chưa có mục tiêu thì về `/onboarding`)
- `src/app/(app)/` — các trang học viên (cần đăng nhập), dùng chung `AppHeader`
- `src/app/(admin)/admin/` — các trang quản trị, dùng chung `AdminHeader`; `src/app/(admin)/layout.tsx` kiểm tra vai trò ở máy chủ cho mọi trang trong đó
- `src/components/app-shell/` — `AppHeader`, `AdminHeader`, `PageTitle`, menu ảnh đại diện
- `src/components/ios/` — thành phần iOS dùng chung: `WidgetCard`, `ListGroup` / `ListRow`, `SegmentedControl`, chip `HanVietChip` / `FalseFriendChip` / `StatusChip`
- `src/components/ui/button.tsx` — nút iOS: `variant` filled / tinted / gray / plain / destructive, `size` lg / default / sm / icon; dùng cho `<Link>` qua `buttonVariants()`
- `src/components/ios/sheet.tsx` (`Sheet`, `FormGroup`, `FormRow`), `switch.tsx`, `confirm-dialog.tsx` — sheet bật lên, công tắc, hộp xác nhận kiểu iOS (dựng trên Base UI)
- `src/lib/pinyin.ts` — đổi pinyin số → dấu thanh (`normalizePinyin`), pinyin trơn để tìm / so trùng (`plainPinyin`, khớp cột `words.pinyin_plain`)
- `src/lib/words/` — `word-input.ts` (kiểm tra một từ: BR12, khóa trùng BR13, giới hạn ảnh), `import.ts` (cột file Excel, đọc level / is_false_friend)
- `src/app/(admin)/admin/words/` — Quản trị từ vựng (UC12): `actions.ts` chứa mọi thao tác ghi (lưu, xóa BR14, xem trước / nhập Excel), chạy ở máy chủ bằng phiên của admin, dựa vào RLS
- Bài test: file `*.test.ts` cạnh file được test, chạy `npm test` (Node test runner, không cần thư viện). File được test phải import bằng đường dẫn tương đối kèm `.ts`, không dùng `@/`
- Thư viện `xlsx` cài từ `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (KHÔNG dùng bản `xlsx` trên npm, đã cũ và có lỗi bảo mật); chỉ tải động (`import("xlsx")`) ở trình duyệt
- `src/lib/lookups.ts` — danh sách cấp HSK / chủ đề nhớ sẵn ở máy chủ (`"use cache"`, tag `lookups`); trang sửa chủ đề / cấp sau này phải gọi `updateTag("lookups")` sau khi ghi
- Proxy nhớ tạm vai trò / trạng thái tài khoản 60 giây (`src/lib/supabase/proxy.ts`) để không hỏi database mỗi lần bấm: khóa tài khoản hoặc hạ quyền có hiệu lực trong tối đa 60 giây
- `src/lib/plan.ts` — quy tắc lộ trình (BR01 ngày thi 7–365 ngày, BR02 số từ mới / thời gian mỗi ngày); dùng chung cho `/onboarding` và `/roadmap`
- Cache Components đang bật: code đọc cookie / phiên đăng nhập phải nằm trong `<Suspense>`
- `supabase/migrations/` — các file migration SQL của database
- `docs/mockups/` — ảnh mockup 16 màn hình đã duyệt

## Quy tắc

### Giao diện

- Phong cách **iOS 16**: bám theo mockup trong `docs/mockups/`. Ưu tiên dùng thành phần có sẵn trong `src/components/ios/` và `src/components/app-shell/` trước khi tự viết mới.
- Màu: chỉ dùng biến trong `globals.css` (`bg-background`, `bg-card`, `bg-muted`, `text-primary`, `bg-secondary`, `text-muted-foreground`, `text-green` / `bg-green-fill`, `bg-red-fill`, `text-orange` / `bg-orange-fill`, `bg-bar`…), không ghi mã màu trực tiếp. Chế độ tối bật bằng `<html data-theme="dark">` (biến thể `dark:`). Mặc định giao diện theo cài đặt của máy; người dùng đổi bằng nút `ThemeToggle` cạnh ảnh đại diện, lựa chọn lưu trong localStorage (`src/lib/theme.ts`).
- Chữ: dùng thang chữ iOS `text-large-title`, `text-title1/2/3`, `text-headline`, `text-body`, `text-subheadline`, `text-footnote`, `text-caption` thay cho `text-sm`, `text-xl`… Thêm cỡ chữ mới thì phải khai báo cả trong `src/lib/utils.ts`, nếu không `cn()` sẽ xóa nhầm class màu chữ.
- Biểu tượng: lucide-react (nét 1.75 đã đặt sẵn). Mọi vùng bấm tối thiểu **44×44px**. Đúng / sai luôn kèm **biểu tượng và chữ**, không chỉ dùng màu (dùng `StatusChip`).
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
- **Tạo bảng / sequence mới thì phải tự GRANT** cho `anon` / `authenticated` ngay trong migration đó (xem `0007_explicit_grants.sql`): project Supabase tạo từ 30/05/2026 không còn tự cấp quyền trên bảng public. Chỉ cấp đúng quyền cần; cột nhạy cảm (đáp án, điểm, role) dùng GRANT theo cột như 0002.
- Mọi thứ của database phải nằm trong migration (bucket, policy, hàm…), không tạo tay trên giao diện Supabase, để dựng lại project mới chỉ cần chạy lần lượt các file.
- Vùng: Supabase và Vercel cùng ở Singapore (`vercel.json` → `sin1`).

### Quy trình sau mỗi nhiệm vụ

1. Chạy `npm run lint`, `npm test` và `npm run build`, sửa hết lỗi rồi mới báo xong.
2. Tóm tắt bằng tiếng Việt: đã làm gì, file nào thay đổi, người làm đồ án cần kiểm tra gì.
