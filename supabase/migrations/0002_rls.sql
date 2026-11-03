-- =====================================================================
-- 0002_rls.sql — Phân quyền (Row Level Security) cho 15 bảng
--
-- Ba vai trò:
--   * anon          : Khách chưa đăng nhập
--   * authenticated : người đã đăng nhập (Học viên hoặc Quản trị viên)
--   * Quản trị viên : authenticated + profiles.role = 'admin' (hàm is_admin())
--
-- Hai lớp bảo vệ:
--   1. Policy (RLS): quyết định được thấy / sửa DÒNG nào.
--   2. GRANT theo cột: quyết định được thấy / sửa CỘT nào
--      (RLS không chặn được theo cột).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Bật RLS cho cả 15 bảng (bật rồi mà chưa có policy = không ai truy cập được)
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.hsk_levels      enable row level security;
alter table public.topics          enable row level security;
alter table public.grammar_points  enable row level security;
alter table public.words           enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_items    enable row level security;
alter table public.questions       enable row level security;
alter table public.exams           enable row level security;
alter table public.exam_questions  enable row level security;
alter table public.study_goals     enable row level security;
alter table public.attempts        enable row level security;
alter table public.answers         enable row level security;
alter table public.srs_cards       enable row level security;
alter table public.lesson_progress enable row level security;

-- ---------------------------------------------------------------------
-- 2. Hàm is_admin(): người đang đăng nhập có phải Quản trị viên không
--    security definer: chạy với quyền chủ sở hữu để đọc được profiles mà
--    không bị chính RLS của profiles chặn (tránh vòng lặp).
--    Tài khoản quản trị bị khóa (status = 'locked') không còn quyền quản trị.
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Tự tạo profiles khi có tài khoản mới trong auth.users
--    Luôn là 'learner'; không đọc role từ metadata để không ai tự đăng ký
--    làm quản trị viên.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    nullif(btrim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )), ''),
    'learner'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Tạo profiles cho các tài khoản đã đăng ký trước khi có trigger (nếu có)
insert into public.profiles (id, display_name)
select u.id, nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. profiles
--    Học viên: đọc dòng của mình, chỉ được sửa display_name.
--    Quản trị viên: đọc tất cả; đổi status qua hàm admin_set_user_status().
-- ---------------------------------------------------------------------

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Phân quyền theo cột: thu hồi quyền sửa cả bảng, chỉ cấp lại cột display_name.
-- => Không ai tự sửa được role hay status của mình qua API.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Quản trị viên khóa / mở khóa tài khoản.
create or replace function public.admin_set_user_status(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên mới được đổi trạng thái tài khoản'
      using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Bạn không thể tự đổi trạng thái tài khoản của mình'
      using errcode = '42501';
  end if;

  update public.profiles
  set status = new_status
  where id = target_user_id;

  if not found then
    raise exception 'Không tìm thấy tài khoản' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bảng nội dung
--    Khách (anon): chỉ đọc hsk_levels, topics, words đang hoạt động.
--    Người đã đăng nhập: chỉ đọc dòng đang hoạt động / đã công khai.
--    Quản trị viên: đọc và ghi toàn bộ.
-- ---------------------------------------------------------------------

-- hsk_levels
create policy "hsk_levels_select_anon" on public.hsk_levels
  for select to anon
  using (true);
create policy "hsk_levels_select_authenticated" on public.hsk_levels
  for select to authenticated
  using (true);
create policy "hsk_levels_admin_all" on public.hsk_levels
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- topics
create policy "topics_select_anon" on public.topics
  for select to anon
  using (true);
create policy "topics_select_authenticated" on public.topics
  for select to authenticated
  using (true);
create policy "topics_admin_all" on public.topics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- words
create policy "words_select_anon_active" on public.words
  for select to anon
  using (status = 'active');
create policy "words_select_active" on public.words
  for select to authenticated
  using (status = 'active');
create policy "words_admin_all" on public.words
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- grammar_points
create policy "grammar_points_select_published" on public.grammar_points
  for select to authenticated
  using (is_published);
create policy "grammar_points_admin_all" on public.grammar_points
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- lessons
create policy "lessons_select_published" on public.lessons
  for select to authenticated
  using (is_published);
create policy "lessons_admin_all" on public.lessons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- lesson_items: thấy khi bài học chứa nó đã công khai
create policy "lesson_items_select_published" on public.lesson_items
  for select to authenticated
  using (exists (
    select 1 from public.lessons l
    where l.id = lesson_items.lesson_id
      and l.is_published
  ));
create policy "lesson_items_admin_all" on public.lesson_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- questions (cột answer, explanation còn bị ẩn thêm ở mục 7)
create policy "questions_select_active" on public.questions
  for select to authenticated
  using (status = 'active');
create policy "questions_admin_all" on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- exams
create policy "exams_select_published" on public.exams
  for select to authenticated
  using (is_published);
create policy "exams_admin_all" on public.exams
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- exam_questions: thấy khi đề thi chứa nó đã công khai
create policy "exam_questions_select_published" on public.exam_questions
  for select to authenticated
  using (exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.is_published
  ));
create policy "exam_questions_admin_all" on public.exam_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Bảng học tập
--    Học viên: đọc và ghi dữ liệu của chính mình.
--    Quản trị viên: chỉ đọc.
--    Điểm số (attempts.total_score, section_scores, status, submitted_at và
--    answers.is_correct) chỉ hàm chấm điểm phía máy chủ được ghi, học viên
--    không tự ghi được (xem phân quyền theo cột cuối mục này).
-- ---------------------------------------------------------------------

-- study_goals
create policy "study_goals_own" on public.study_goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "study_goals_select_admin" on public.study_goals
  for select to authenticated
  using (public.is_admin());

-- attempts: học viên tạo, xem, xóa lượt làm bài của mình; không tự sửa điểm
create policy "attempts_select_own" on public.attempts
  for select to authenticated
  using (user_id = auth.uid());
create policy "attempts_insert_own" on public.attempts
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "attempts_delete_own" on public.attempts
  for delete to authenticated
  using (user_id = auth.uid());
create policy "attempts_select_admin" on public.attempts
  for select to authenticated
  using (public.is_admin());

-- answers: kiểm tra chủ sở hữu qua attempts.user_id;
-- chỉ được ghi / sửa / xóa câu trả lời khi lượt làm bài chưa nộp
create policy "answers_select_own" on public.answers
  for select to authenticated
  using (exists (
    select 1 from public.attempts a
    where a.id = answers.attempt_id
      and a.user_id = auth.uid()
  ));
create policy "answers_insert_own" on public.answers
  for insert to authenticated
  with check (exists (
    select 1 from public.attempts a
    where a.id = answers.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'in_progress'
  ));
create policy "answers_update_own" on public.answers
  for update to authenticated
  using (exists (
    select 1 from public.attempts a
    where a.id = answers.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'in_progress'
  ))
  with check (exists (
    select 1 from public.attempts a
    where a.id = answers.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'in_progress'
  ));
create policy "answers_delete_own" on public.answers
  for delete to authenticated
  using (exists (
    select 1 from public.attempts a
    where a.id = answers.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'in_progress'
  ));
create policy "answers_select_admin" on public.answers
  for select to authenticated
  using (public.is_admin());

-- srs_cards
create policy "srs_cards_own" on public.srs_cards
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "srs_cards_select_admin" on public.srs_cards
  for select to authenticated
  using (public.is_admin());

-- lesson_progress
create policy "lesson_progress_own" on public.lesson_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "lesson_progress_select_admin" on public.lesson_progress
  for select to authenticated
  using (public.is_admin());

-- Phân quyền theo cột cho attempts và answers: học viên không ghi được điểm.
revoke insert, update on public.attempts from anon, authenticated;
grant insert (user_id, attempt_type, exam_id, lesson_id) on public.attempts to authenticated;

revoke insert, update on public.answers from anon, authenticated;
grant insert (attempt_id, question_id, user_answer, is_flagged) on public.answers to authenticated;
grant update (user_answer, is_flagged, answered_at) on public.answers to authenticated;

-- ---------------------------------------------------------------------
-- 7. Ẩn đáp án câu hỏi
--    Postgres không cho thu hồi riêng một cột khi đã cấp quyền đọc cả bảng,
--    nên: thu hồi quyền đọc cả bảng, rồi cấp lại từng cột trừ answer và
--    explanation. Khách (anon) không đọc được câu hỏi.
--    LƯU Ý: thêm cột mới vào questions thì phải grant select cột đó ở
--    migration mới, nếu không học viên sẽ không đọc được cột ấy.
-- ---------------------------------------------------------------------

revoke select on public.questions from anon, authenticated;
grant select (
  id,
  level_id,
  topic_id,
  grammar_point_id,
  question_type,
  skill,
  content,
  audio_text,
  status
) on public.questions to authenticated;

-- Quản trị viên lấy đầy đủ câu hỏi (kể cả đáp án, giải thích).
-- Có thể lọc theo cấp độ và dạng câu hỏi; để trống = lấy tất cả.
create or replace function public.admin_get_questions(
  p_level_id smallint default null,
  p_question_type text default null
)
returns setof public.questions
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên mới được xem đáp án câu hỏi'
      using errcode = '42501';
  end if;

  return query
    select q.*
    from public.questions q
    where (p_level_id is null or q.level_id = p_level_id)
      and (p_question_type is null or q.question_type = p_question_type)
    order by q.level_id, q.question_type, q.id;
end;
$$;

revoke execute on function public.admin_get_questions(smallint, text) from public, anon;
grant execute on function public.admin_get_questions(smallint, text) to authenticated;

commit;
