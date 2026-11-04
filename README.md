# Hệ thống quản trị ôn thi HSK

Đồ án tốt nghiệp: website giúp người Việt tự ôn thi **HSK cấp 1–3** (kỳ thi năng lực tiếng Trung Quốc).

🌐 **Bản chạy thật:** https://on-thi-hsk.vercel.app

## Giới thiệu đề tài

Người Việt tự học tiếng Trung thường thiếu một nơi luyện thi HSK có giao diện tiếng Việt, có đề thi thử và theo dõi được tiến độ. Hệ thống gồm hai nhóm người dùng:

- **Học viên**: ôn từ vựng, ngữ pháp theo từng cấp HSK 1–3, làm đề thi thử, xem kết quả và tiến độ học tập.
- **Quản trị viên**: quản lý ngân hàng câu hỏi, đề thi, từ vựng, tài khoản học viên và xem thống kê.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript |
| Giao diện | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Backend, database, đăng nhập | [Supabase](https://supabase.com) (PostgreSQL) |
| Font | Font hệ thống Apple nếu có, nếu không thì Inter; chữ Hán dùng PingFang SC / Noto Sans SC |
| Đọc / ghi Excel | [SheetJS (xlsx)](https://sheetjs.com) 0.20.3, cài từ cdn.sheetjs.com (bản trên npm cũ và có lỗi bảo mật) |

## Cài đặt và chạy project

### 1. Chuẩn bị

- [Node.js](https://nodejs.org) bản 20.9 trở lên (kiểm tra bằng `node -v`)
- [Git](https://git-scm.com)
- Một project Supabase (tạo miễn phí tại [supabase.com](https://supabase.com))

### 2. Tải mã nguồn và cài thư viện

```bash
git clone https://github.com/DuyTran20207643/hsk-app.git
cd hsk-app
npm install
```

### 3. Cấu hình biến môi trường

Sao chép file mẫu thành `.env.local`:

```bash
cp .env.example .env.local
```

Mở `.env.local` và điền 2 giá trị lấy từ **Supabase Dashboard → Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=khóa-anon-public
```

> ⚠️ `.env.local` chứa khóa thật, **không được đưa lên GitHub** (đã được `.gitignore` chặn). Không bao giờ dùng `service_role` key ở phía trình duyệt.

### 4. Tạo database

Mở **Supabase Dashboard → SQL Editor**, lần lượt dán và chạy từng file trong `supabase/migrations/` theo thứ tự:

1. `0001_schema.sql`: tạo 15 bảng
2. `0002_rls.sql`: bật phân quyền (Row Level Security)
3. `0003_seed.sql`: dữ liệu khởi tạo (3 cấp HSK, 18 chủ đề, 5 từ mẫu)
4. `0004_word_images_storage.sql`: kho ảnh minh họa từ vựng (bucket `word-images` trong Storage: ai cũng xem được, chỉ quản trị viên tải lên / xóa; chỉ nhận jpg, png, webp tối đa 1 MB)
5. `0005_words_pinyin_search.sql`: cột `pinyin_plain` để tìm pinyin không cần gõ dấu (gõ `dongxi` vẫn ra 东西)
6. `0006_words_han_viet_optional.sql`: âm Hán Việt không bắt buộc (không phải từ nào cũng có); riêng từ Hán Việt dễ nhầm vẫn phải có

Mỗi file chỉ chạy **một lần**. Muốn thay đổi database thì tạo file mới với số tiếp theo (`0004_...`), không sửa file đã chạy.

### 5. Cấu hình đăng nhập trên Supabase

Vào **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `https://on-thi-hsk.vercel.app`
- **Redirect URLs**: thêm 2 dòng `http://localhost:3000/**` và `https://on-thi-hsk.vercel.app/**`

Nhờ vậy, liên kết xác nhận trong email đăng ký sẽ đưa người dùng về đúng web (trang `/auth/callback`).

### 6. Chạy trên máy

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem trang giới thiệu.

### Các lệnh khác

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy chế độ phát triển, tự cập nhật khi sửa code |
| `npm run build` | Đóng gói bản chạy thật (production) |
| `npm run start` | Chạy bản đã đóng gói |
| `npm run lint` | Kiểm tra lỗi cú pháp, quy tắc viết code |
| `npm test` | Chạy các bài test (file `*.test.ts`, ví dụ đổi pinyin `ni3 hao3` → `nǐ hǎo`) |

## Quản trị từ vựng (`/admin/words`)

- Bảng từ vựng có tìm kiếm (chữ Hán, pinyin không cần dấu, âm Hán Việt, nghĩa), lọc theo cấp, chủ đề, "chỉ từ dễ nhầm", 20 từ mỗi trang.
- **Thêm / Sửa từ**: pinyin gõ dạng số (`ji1 chang3`) được tự đổi sang dấu thanh. Bật "Từ Hán Việt dễ nhầm" thì phải có ghi chú phân biệt (BR12). Trùng chữ Hán + pinyin với từ đã có thì báo trùng và gợi ý mở từ cũ (BR13).
- **Xóa từ**: từ đã dùng trong bài học hoặc lịch ôn thì chỉ chuyển sang "Ngừng dùng", chưa dùng thì xóa hẳn (BR14).
- **Import Excel**: bấm "Tải file mẫu" để lấy file đúng cột (trang `chu_de` trong file mẫu liệt kê tên chủ đề hợp lệ), điền tối đa 1.000 dòng, chọn file để xem trước số dòng hợp lệ / lỗi / trùng, rồi bấm "Nhập các dòng hợp lệ".

## Tài khoản và phân quyền

- Người dùng tự **đăng ký** tại `/auth` (họ tên, email, mật khẩu ít nhất 8 ký tự). Tài khoản mới luôn là **Học viên**.
- Chưa đăng nhập mà vào trang học tập sẽ được chuyển về `/auth`; đăng nhập xong quay lại đúng trang đó.
- Trang `/admin/*` chỉ dành cho **Quản trị viên**, được kiểm tra ở phía máy chủ.

### Nâng một tài khoản thành Quản trị viên

Không có nút nào trên web làm việc này (để học viên không tự nâng quyền được). Bạn làm trong **Supabase Dashboard → SQL Editor**:

1. Người cần nâng quyền **đăng ký tài khoản trên web trước**.
2. Chạy câu lệnh sau, thay email cho đúng:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'email-cua-ban@example.com');
```

3. Kết quả báo **"Success. 1 row affected"** là xong. Nếu báo **0 rows** thì email chưa đúng hoặc tài khoản chưa đăng ký.
4. Người đó tải lại trang web: menu ảnh đại diện (góc phải) sẽ có thêm mục **"Trang quản trị"**.

Muốn hạ về Học viên thì chạy lại câu lệnh với `role = 'learner'`.

Xem danh sách quản trị viên hiện có:

```sql
select u.email, p.display_name, p.status
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
```

## Triển khai (deploy)

Website được deploy trên [Vercel](https://vercel.com), link chính thức: **https://on-thi-hsk.vercel.app**

- Mỗi lần `git push` lên nhánh `main`, Vercel tự build và cập nhật website.
- Biến môi trường (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) được khai báo trong Vercel → Settings → Environment Variables. Sửa biến xong phải **Redeploy** mới có hiệu lực.

## Cấu trúc thư mục

```
src/
├── app/                 # Các trang của website (mỗi thư mục là một đường dẫn)
│   ├── layout.tsx       # Khung chung cho mọi trang, cấu hình font
│   ├── page.tsx         # Trang chủ
│   └── globals.css      # CSS chung, màu sắc giao diện
├── components/ui/       # Component giao diện từ shadcn/ui (nút, thẻ, form…)
├── lib/
│   ├── utils.ts         # Hàm tiện ích dùng chung
│   └── supabase/        # Kết nối Supabase (trình duyệt, máy chủ, kiểm tra kết nối)
└── proxy.ts             # Chạy trước mỗi request để làm mới phiên đăng nhập
supabase/migrations/     # File SQL tạo database, chạy theo thứ tự 0001, 0002…
docs/mockups/            # Ảnh mockup các màn hình đã duyệt
public/                  # Ảnh, icon tĩnh
```
