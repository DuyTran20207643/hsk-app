-- =====================================================================
-- 0007_explicit_grants.sql — Cấp quyền truy cập bảng một cách tường minh
--
-- Vì sao cần: từ 30/05/2026, project Supabase MỚI không còn tự cấp quyền
-- select / insert / update / delete trên bảng trong schema public cho các vai trò
-- anon và authenticated. Project cũ (tạo trước ngày đó) có sẵn quyền này nên
-- 0001–0006 chạy được; project mới thì web sẽ bị lỗi 42501 (permission denied).
--
-- Nguyên tắc:
--   * GRANT chỉ quyết định được "chạm vào bảng / cột nào"; RLS (0002) vẫn quyết
--     định "được thấy / sửa dòng nào". Cấp quyền ở đây KHÔNG nới lỏng RLS.
--   * Chỉ cấp đúng những gì web cần. Không mở lại các cột mà 0002 cố ý khóa:
--       - questions.answer, questions.explanation (đáp án)        → không cấp select cả bảng
--       - attempts / answers: điểm số, is_correct                 → giữ quyền theo cột của 0002
--       - profiles.role, profiles.status                          → giữ quyền theo cột của 0002
--   * Chạy được trên database trống (sau 0001–0006) và chạy lại nhiều lần không lỗi.
--     Chạy trên project cũ cũng không hại gì (các quyền này ở đó đã có sẵn).
--
-- LƯU Ý cho migration sau này: tạo bảng / sequence mới trong public thì phải tự
-- GRANT cho anon / authenticated ngay trong migration đó.
-- =====================================================================

begin;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Khách (anon): chỉ đọc 3 bảng có policy cho anon ở 0002
-- ---------------------------------------------------------------------

grant select on public.hsk_levels, public.topics, public.words to anon;

-- ---------------------------------------------------------------------
-- 2. Người đã đăng nhập (authenticated)
-- ---------------------------------------------------------------------

-- profiles: đọc (RLS: dòng của mình, admin đọc tất cả).
-- Sửa chỉ cột display_name (đã cấp ở 0002, cấp lại cho chắc). Không cấp insert / delete:
-- dòng profiles do trigger handle_new_user() tạo, role / status đổi qua hàm admin.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Bảng nội dung: học viên đọc; quản trị viên đọc và ghi (RLS *_admin_all chặn người khác).
grant select, insert, update, delete on
  public.hsk_levels,
  public.topics,
  public.grammar_points,
  public.words,
  public.lessons,
  public.lesson_items,
  public.exams,
  public.exam_questions
to authenticated;

-- questions: KHÔNG cấp select cả bảng (để ẩn answer, explanation).
-- Quyền đọc theo cột đã cấp ở 0002; admin xem đáp án qua hàm admin_get_questions().
-- Ghi: chỉ quản trị viên (RLS questions_admin_all).
grant insert, update, delete on public.questions to authenticated;

-- Dữ liệu học tập của chính học viên (RLS: user_id = auth.uid())
grant select, insert, update, delete on
  public.study_goals,
  public.srs_cards,
  public.lesson_progress
to authenticated;

-- attempts / answers: đọc và xóa; thêm / sửa chỉ các cột đã cấp ở 0002
-- (học viên không tự ghi được điểm và is_correct).
grant select, delete on public.attempts, public.answers to authenticated;

-- Sequence của cột id kiểu serial (quản trị viên thêm chủ đề / điểm ngữ pháp)
grant usage, select on sequence public.topics_id_seq, public.grammar_points_id_seq to authenticated;

commit;
