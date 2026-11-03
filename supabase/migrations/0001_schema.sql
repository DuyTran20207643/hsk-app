-- =====================================================================
-- 0001_schema.sql — Tạo 15 bảng của Hệ thống ôn thi HSK (schema public)
--
-- Chạy một lần trong Supabase SQL Editor, theo thứ tự 0001 → 0002 → 0003.
-- Không sửa file này sau khi đã chạy; cần thay đổi thì tạo migration mới.
--
-- Quy ước xóa dữ liệu:
--   * Dữ liệu của học viên (mục tiêu, lượt làm bài, lịch ôn…) bị xóa theo
--     tài khoản (on delete cascade).
--   * Nội dung (cấp độ, chủ đề, từ vựng, câu hỏi, bài học, đề thi) đang được
--     nơi khác tham chiếu thì không cho xóa (on delete restrict). Muốn ẩn thì
--     đổi status / is_published thay vì xóa.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tài khoản
-- ---------------------------------------------------------------------

-- Mỗi tài khoản đăng nhập (auth.users) có đúng một dòng profiles.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'learner' check (role in ('learner', 'admin')),
  status       text not null default 'active' check (status in ('active', 'locked')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Danh mục nội dung
-- ---------------------------------------------------------------------

create table public.hsk_levels (
  id         smallint primary key,
  code       text not null unique,
  name       text not null,
  max_score  int,
  pass_score int,
  word_count int,
  sort_order int
);

create table public.topics (
  id          serial primary key,
  name        text not null unique,
  description text,
  sort_order  int
);

create table public.grammar_points (
  id           serial primary key,
  level_id     smallint not null references public.hsk_levels (id) on delete restrict,
  title        text not null,
  structure    text,
  explanation  text,
  -- Mảng câu ví dụ: [{"zh": "...", "pinyin": "...", "vi": "..."}]
  examples     jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array'),
  sort_order   int,
  is_published boolean not null default false
);

create table public.words (
  id                uuid primary key default gen_random_uuid(),
  hanzi             text not null,
  pinyin            text not null,
  han_viet          text not null,
  meaning_vi        text not null,
  example_zh        text,
  example_vi        text,
  level_id          smallint not null references public.hsk_levels (id) on delete restrict,
  topic_id          int references public.topics (id) on delete restrict,
  -- Từ Hán Việt dễ nhầm nghĩa (điểm khác biệt A)
  is_false_friend   boolean not null default false,
  false_friend_note text,
  image_url         text,
  status            text not null default 'active' check (status in ('active', 'inactive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (hanzi, pinyin),
  -- Đã đánh dấu dễ nhầm thì bắt buộc có ghi chú giải thích
  constraint words_false_friend_note_required check (
    is_false_friend = false
    or length(btrim(coalesce(false_friend_note, ''))) > 0
  )
);

create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  level_id          smallint not null references public.hsk_levels (id) on delete restrict,
  topic_id          int references public.topics (id) on delete restrict,
  title             text not null,
  sort_order        int,
  estimated_minutes int not null default 10,
  is_published      boolean not null default false
);

-- ---------------------------------------------------------------------
-- 3. Ngân hàng câu hỏi và đề thi
-- ---------------------------------------------------------------------

create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  level_id         smallint not null references public.hsk_levels (id) on delete restrict,
  topic_id         int references public.topics (id) on delete restrict,
  grammar_point_id int references public.grammar_points (id) on delete restrict,
  question_type    text not null check (question_type in (
    'vocab_meaning',
    'grammar_fill',
    'listening_picture',
    'listening_true_false',
    'listening_short_dialogue',
    'listening_long_dialogue',
    'reading_match',
    'reading_fill_blank',
    'reading_comprehension',
    'writing_order',
    'writing_hanzi'
  )),
  skill            text not null check (skill in ('vocabulary', 'grammar', 'listening', 'reading', 'writing')),
  -- Đề bài, lựa chọn… (học viên được xem)
  content          jsonb not null,
  -- Đáp án và giải thích: bị ẩn với học viên (xem 0002_rls.sql)
  answer           jsonb not null,
  explanation      text,
  audio_text       text,
  status           text not null default 'active' check (status in ('active', 'inactive'))
);

-- Một bài học gồm nhiều mục: mỗi mục là một từ vựng HOẶC một câu hỏi.
create table public.lesson_items (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  item_type   text not null check (item_type in ('word', 'question')),
  word_id     uuid references public.words (id) on delete restrict,
  question_id uuid references public.questions (id) on delete restrict,
  sort_order  int,
  -- Đúng một trong hai cột khác null, và khớp với item_type
  constraint lesson_items_one_target check (
    (item_type = 'word' and word_id is not null and question_id is null)
    or (item_type = 'question' and question_id is not null and word_id is null)
  )
);

create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  level_id         smallint not null references public.hsk_levels (id) on delete restrict,
  title            text not null,
  duration_minutes int,
  is_published     boolean not null default false
);

create table public.exam_questions (
  exam_id     uuid not null references public.exams (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  section     text not null check (section in ('listening', 'reading', 'writing')),
  sort_order  int,
  primary key (exam_id, question_id)
);

-- ---------------------------------------------------------------------
-- 4. Dữ liệu học tập của học viên
-- ---------------------------------------------------------------------

-- Mục tiêu ôn thi: cấp độ, ngày thi, số phút mỗi ngày (điểm khác biệt C)
create table public.study_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  level_id      smallint not null references public.hsk_levels (id) on delete restrict,
  exam_date     date not null,
  daily_minutes int not null check (daily_minutes in (15, 30, 45, 60)),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Mỗi học viên chỉ có một mục tiêu đang hoạt động
create unique index study_goals_one_active_per_user
  on public.study_goals (user_id)
  where is_active;

-- Một lượt làm bài: bài học, luyện tập, ôn tổng hợp, thi thử, ôn điểm yếu
create table public.attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  attempt_type   text not null check (attempt_type in ('lesson', 'practice', 'mixed', 'exam', 'weakness')),
  exam_id        uuid references public.exams (id) on delete restrict,
  lesson_id      uuid references public.lessons (id) on delete restrict,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  status         text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  total_score    numeric,
  -- Điểm theo phần, ví dụ {"listening": 80, "reading": 90} (điểm khác biệt D)
  section_scores jsonb
);

create table public.answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  user_answer jsonb,
  is_correct  boolean,
  is_flagged  boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- Thẻ ôn từ vựng theo phương pháp lặp lại ngắt quãng (SRS)
create table public.srs_cards (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  word_id          uuid not null references public.words (id) on delete restrict,
  ease_factor      numeric not null default 2.5,
  interval_days    int not null default 0,
  repetitions      int not null default 0,
  due_date         date not null default current_date,
  last_reviewed_at timestamptz,
  primary key (user_id, word_id)
);

create table public.lesson_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete restrict,
  status       text not null check (status in ('in_progress', 'completed')),
  best_score   numeric,
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- 5. Index cho các cột hay dùng để lọc
-- ---------------------------------------------------------------------

create index words_level_id_idx           on public.words (level_id);
create index words_topic_id_idx           on public.words (topic_id);
create index questions_level_type_idx     on public.questions (level_id, question_type);
create index attempts_user_started_idx    on public.attempts (user_id, started_at);
create index answers_question_id_idx      on public.answers (question_id);
create index srs_cards_user_due_idx       on public.srs_cards (user_id, due_date);

-- ---------------------------------------------------------------------
-- 6. Tự cập nhật words.updated_at mỗi khi sửa từ vựng
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger words_set_updated_at
  before update on public.words
  for each row
  execute function public.set_updated_at();

commit;
