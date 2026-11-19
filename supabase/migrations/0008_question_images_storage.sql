-- =====================================================================
-- 0008_question_images_storage.sql
-- Kho ảnh cho câu hỏi "Nghe – chọn tranh" (Supabase Storage, bucket "question-images").
-- Làm giống 0004_word_images_storage.sql:
--
-- * Bucket công khai: ai cũng xem được ảnh qua đường dẫn.
-- * Chỉ nhận ảnh jpg / png / webp, tối đa 1 MB mỗi ảnh
--   (giới hạn đặt ngay ở bucket, nên dù gửi thẳng lên Storage cũng bị chặn).
-- * Chỉ Quản trị viên (hàm is_admin() ở 0002_rls.sql) được tải lên, thay và xóa ảnh.
-- * Đường dẫn ảnh lưu trong questions.content.images (mảng 3 phần tử).
--
-- Không tạo bảng mới nên không cần GRANT thêm (storage.objects do Supabase quản lý quyền).
-- Chạy lại nhiều lần cũng không lỗi.
-- =====================================================================

begin;

-- 1. Tạo bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  true,
  1048576, -- 1 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2. Quyền trên các file trong bucket (bảng storage.objects đã bật RLS sẵn)
drop policy if exists "question_images_select_all" on storage.objects;
drop policy if exists "question_images_insert_admin" on storage.objects;
drop policy if exists "question_images_update_admin" on storage.objects;
drop policy if exists "question_images_delete_admin" on storage.objects;

-- Ai cũng xem được
create policy "question_images_select_all" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'question-images');

-- Chỉ Quản trị viên tải lên
create policy "question_images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());

-- Chỉ Quản trị viên ghi đè
create policy "question_images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin())
  with check (bucket_id = 'question-images' and public.is_admin());

-- Chỉ Quản trị viên xóa
create policy "question_images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

commit;
