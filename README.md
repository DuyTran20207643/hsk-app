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
| Font | Be Vietnam Pro (tiếng Việt), Noto Sans SC (chữ Hán) qua `next/font` |

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

Mở [http://localhost:3000](http://localhost:3000). Trang chủ sẽ hiển thị trạng thái kết nối Supabase (thành công hoặc lỗi kèm lý do).

### Các lệnh khác

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy chế độ phát triển, tự cập nhật khi sửa code |
| `npm run build` | Đóng gói bản chạy thật (production) |
| `npm run start` | Chạy bản đã đóng gói |
| `npm run lint` | Kiểm tra lỗi cú pháp, quy tắc viết code |

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
