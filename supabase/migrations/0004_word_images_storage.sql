-- =====================================================================
-- 0004_word_images_storage.sql
-- Kho ảnh minh họa cho từ vựng (Supabase Storage, bucket "word-images").
--
-- * Bucket công khai: ai cũng xem được ảnh qua đường dẫn (kể cả Khách).
-- * Chỉ nhận ảnh jpg / png / webp, tối đa 1 MB mỗi ảnh
--   (giới hạn đặt ngay ở bucket, nên dù gửi thẳng lên Storage cũng bị chặn).
-- * Chỉ Quản trị viên (hàm is_admin() ở 0002_rls.sql) được tải lên, thay và xóa ảnh.
-- * Đường dẫn ảnh lưu ở cột words.image_url.
-- =====================================================================

begin;

-- 1. Tạo bucket (chạy lại nhiều lần cũng không lỗi)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'word-images',
  'word-images',
  true,
  1048576, -- 1 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2. Quyền trên các file trong bucket (bảng storage.objects đã bật RLS sẵn)
drop policy if exists "word_images_select_all" on storage.objects;
drop policy if exists "word_images_insert_admin" on storage.objects;
drop policy if exists "word_images_update_admin" on storage.objects;
drop policy if exists "word_images_delete_admin" on storage.objects;

-- Ai cũng xem được
create policy "word_images_select_all" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'word-images');

-- Chỉ Quản trị viên tải lên
create policy "word_images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'word-images' and public.is_admin());

-- Chỉ Quản trị viên ghi đè
create policy "word_images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'word-images' and public.is_admin())
  with check (bucket_id = 'word-images' and public.is_admin());

-- Chỉ Quản trị viên xóa
create policy "word_images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'word-images' and public.is_admin());

commit;
