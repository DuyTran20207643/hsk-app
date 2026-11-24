-- =====================================================================
-- 0009_practice_sessions.sql
-- Bộ máy "phiên làm bài" dùng chung: tạo phiên, nộp từng câu, kết thúc phiên.
--
-- Học viên KHÔNG đọc được questions.answer / explanation (0002_rls.sql, mục 7),
-- nên việc chấm điểm chạy trong database bằng các hàm security definer
-- (chạy với quyền người tạo hàm, đọc được đáp án). Học viên chỉ gọi được 4 hàm:
--   start_attempt   tự chọn câu hỏi, tạo phiên (học viên không tự gửi danh sách câu)
--   submit_answer   kiểm tra câu thuộc phiên của chính mình, chấm, lưu, trả kết quả CỦA RIÊNG CÂU ĐÓ
--   finish_attempt  kết thúc phiên, đếm số câu đúng
--   get_attempt     mở lại phiên đang làm (đề bài + câu đã trả lời)
--
-- Logic chấm có BẢN SONG SINH bằng TypeScript: src/lib/questions/grade.ts.
-- src/lib/questions/grading.test.ts chạy cùng một danh sách tình huống qua cả hai bản.
-- Sửa cách chấm thì sửa cả hai (ở đây bằng migration mới).
--
-- Khóa câu: phiên hiện đáp án ngay (config.feedback = 'immediate': luyện tập, ôn tổng hợp…)
-- chỉ nhận lần nộp đầu của mỗi câu. Phiên 'deferred' (thi thử, làm sau) cho nộp lại, ghi đè,
-- và không trả đáp án cho tới khi nộp bài.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Cột mới cho attempts
-- ---------------------------------------------------------------------

alter table public.attempts
  -- Thứ tự câu hỏi trong phiên
  add column question_ids  uuid[] not null default '{}',
  -- Tham số của phiên: chế độ, cấp, dạng câu, số câu, kiểu hiện đáp án…
  add column config        jsonb not null default '{}'::jsonb,
  -- Số câu đúng, ghi khi kết thúc phiên
  add column correct_count int;

-- Học viên đã có quyền SELECT cả bảng attempts (0007), nên đọc được 3 cột mới.

-- ---------------------------------------------------------------------
-- 2. Chỉ ghi attempts / answers qua các hàm ở dưới
--    (trước đây học viên tự ghi được câu trả lời mà không qua chấm điểm,
--    và tự xóa được câu đã nộp để nộp lại → phá cơ chế khóa câu)
-- ---------------------------------------------------------------------

revoke insert on public.attempts from anon, authenticated;
revoke insert, update, delete on public.answers from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Chuẩn hóa chữ để so sánh câu trả lời viết
--    PHẢI khớp IGNORED_ANSWER_CHARS + normalizeForCompare() trong src/lib/questions/validate.ts.
--    Dùng translate() với danh sách ký tự liệt kê rõ, không dùng [[:punct:]]
--    (kết quả của [[:punct:]] với dấu câu tiếng Trung phụ thuộc cài đặt ngôn ngữ của database).
-- ---------------------------------------------------------------------

create or replace function public.normalize_answer_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    translate(
      normalize(coalesce(p_value, ''), NFC),
      -- khoảng trắng: tab, xuống dòng, tab dọc, ngắt trang, về đầu dòng, cách, cách không ngắt, cách toàn khổ
      chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || ' ' || chr(160) || chr(12288)
      -- dấu câu ASCII
      || '!"#$%&''()*+,-./:;<=>?@[\]^_`{|}~'
      -- dấu câu tiếng Trung / toàn khổ
      || '，。！？、；：“”‘’（）《》〈〉【】「」『』…—～·．・＿＂＇［］｛｝－＋＝／＼｜＠＃＄％＾＆＊＜＞',
      ''
    ),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz'
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Chấm một câu (hàm thuần, không đọc bảng) — song sinh với gradeQuestion() trong grade.ts
-- ---------------------------------------------------------------------

create or replace function public.grade_answer(
  p_type     text,
  p_content  jsonb,
  p_answer   jsonb,
  p_response jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_tokens   jsonb;
  v_order    jsonb;
  v_count    int;
  v_elem     jsonb;
  v_pos      numeric;
  v_seen     int[] := '{}';
  v_sentence text := '';
  v_text     text;
begin
  -- Câu trả lời sai dạng / thiếu thì tính là sai
  if p_response is null or jsonb_typeof(p_response) <> 'object' then
    return false;
  end if;

  case p_type
    when 'listening_true_false' then
      -- coalesce: thiếu trường thì so sánh ra null, phải đổi thành false
      return coalesce(
        jsonb_typeof(p_response -> 'value') = 'boolean' and (p_response -> 'value') = (p_answer -> 'value'),
        false
      );

    when 'writing_order' then
      -- Ghép các cụm theo thứ tự học viên đã bấm; mỗi cụm dùng đúng một lần
      v_tokens := p_content -> 'tokens';
      v_order  := p_response -> 'order';
      if jsonb_typeof(v_tokens) is distinct from 'array' or jsonb_typeof(v_order) is distinct from 'array' then
        return false;
      end if;
      v_count := jsonb_array_length(v_tokens);
      if jsonb_array_length(v_order) <> v_count then
        return false;
      end if;
      for v_elem in select e.value from jsonb_array_elements(v_order) as e loop
        if jsonb_typeof(v_elem) <> 'number' then
          return false;
        end if;
        v_pos := v_elem::numeric;
        if v_pos <> trunc(v_pos) or v_pos < 0 or v_pos >= v_count then
          return false;
        end if;
        if v_pos::int = any (v_seen) then
          return false;
        end if;
        v_seen := v_seen || v_pos::int;
        v_sentence := v_sentence || coalesce(v_tokens ->> v_pos::int, '');
      end loop;
      return public.normalize_answer_text(v_sentence) = public.normalize_answer_text(p_answer ->> 'sentence');

    when 'writing_hanzi' then
      if jsonb_typeof(p_response -> 'text') is distinct from 'string' then
        return false;
      end if;
      v_text := public.normalize_answer_text(p_response ->> 'text');
      return coalesce(v_text <> '' and v_text = public.normalize_answer_text(p_answer ->> 'text'), false);

    else
      -- Các dạng chọn một lựa chọn (A, B, C… hoặc tranh)
      if jsonb_typeof(p_response -> 'index') is distinct from 'number' then
        return false;
      end if;
      v_pos := (p_response -> 'index')::numeric;
      return coalesce(v_pos = trunc(v_pos) and (p_response -> 'index') = (p_answer -> 'index'), false);
  end case;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Tạo phiên
--    p_mode: 'practice' (luyện tập) hoặc 'mixed' (ôn tổng hợp); các chế độ khác làm sau.
--    p_config (đều không bắt buộc):
--      level_id          cấp HSK
--      question_types    mảng dạng câu
--      grammar_point_id  chỉ lấy câu gắn ngữ pháp này
--      count             số câu, 1–50 (mặc định 10)
--      tag               nhãn ngắn để tìm lại phiên (chữ thường, số, gạch nối; tối đa 20 ký tự)
--    Chỉ lấy câu đang dùng; bỏ câu "Nghe – chọn tranh" chưa đủ 3 ảnh.
-- ---------------------------------------------------------------------

create or replace function public.start_attempt(p_mode text, p_config jsonb default '{}'::jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_config  jsonb := coalesce(p_config, '{}'::jsonb);
  v_level   smallint;
  v_types   text[];
  v_grammar int;
  v_count   int := 10;
  v_tag     text;
  v_ids     uuid[];
  v_id      uuid;
  v_all_types constant text[] := array[
    'vocab_meaning', 'grammar_fill', 'listening_picture', 'listening_true_false',
    'listening_short_dialogue', 'listening_long_dialogue', 'reading_match',
    'reading_fill_blank', 'reading_comprehension', 'writing_order', 'writing_hanzi'
  ];
begin
  if v_user is null or not exists (
    select 1 from public.profiles p where p.id = v_user and p.status = 'active'
  ) then
    raise exception 'Bạn cần đăng nhập để làm bài.' using errcode = '42501';
  end if;

  if p_mode is null or p_mode not in ('practice', 'mixed') then
    raise exception 'Chế độ làm bài này chưa được hỗ trợ.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_config) <> 'object' then
    raise exception 'Tham số của phiên không hợp lệ.' using errcode = '22023';
  end if;

  -- Cấp HSK
  if jsonb_typeof(v_config -> 'level_id') = 'number' then
    select l.id into v_level
    from public.hsk_levels l
    where l.id::numeric = (v_config -> 'level_id')::numeric;
    if v_level is null then
      raise exception 'Cấp HSK không hợp lệ.' using errcode = '22023';
    end if;
  elsif coalesce(jsonb_typeof(v_config -> 'level_id'), 'null') <> 'null' then
    raise exception 'Cấp HSK không hợp lệ.' using errcode = '22023';
  end if;

  -- Dạng câu
  if jsonb_typeof(v_config -> 'question_types') = 'array' then
    select array_agg(distinct t.raw #>> '{}') into v_types
    from jsonb_array_elements(v_config -> 'question_types') as t(raw)
    where jsonb_typeof(t.raw) = 'string' and (t.raw #>> '{}') = any (v_all_types);
    if v_types is null then
      raise exception 'Dạng câu không hợp lệ.' using errcode = '22023';
    end if;
  elsif coalesce(jsonb_typeof(v_config -> 'question_types'), 'null') <> 'null' then
    raise exception 'Dạng câu không hợp lệ.' using errcode = '22023';
  end if;

  -- Ngữ pháp
  if jsonb_typeof(v_config -> 'grammar_point_id') = 'number' then
    select g.id into v_grammar
    from public.grammar_points g
    where g.id::numeric = (v_config -> 'grammar_point_id')::numeric;
    if v_grammar is null then
      raise exception 'Ngữ pháp không hợp lệ.' using errcode = '22023';
    end if;
  elsif coalesce(jsonb_typeof(v_config -> 'grammar_point_id'), 'null') <> 'null' then
    raise exception 'Ngữ pháp không hợp lệ.' using errcode = '22023';
  end if;

  -- Số câu
  if jsonb_typeof(v_config -> 'count') = 'number' then
    if (v_config ->> 'count')::numeric not between 1 and 50
       or (v_config ->> 'count')::numeric <> trunc((v_config ->> 'count')::numeric) then
      raise exception 'Số câu phải từ 1 đến 50.' using errcode = '22023';
    end if;
    v_count := (v_config ->> 'count')::int;
  elsif coalesce(jsonb_typeof(v_config -> 'count'), 'null') <> 'null' then
    raise exception 'Số câu phải từ 1 đến 50.' using errcode = '22023';
  end if;

  -- Nhãn
  if jsonb_typeof(v_config -> 'tag') = 'string' then
    v_tag := v_config ->> 'tag';
    if v_tag !~ '^[a-z0-9-]{1,20}$' then
      raise exception 'Nhãn của phiên không hợp lệ.' using errcode = '22023';
    end if;
  end if;

  -- Chọn ngẫu nhiên, rồi xếp theo kỹ năng để các câu cùng nhóm đứng liền nhau
  select coalesce(array_agg(s.id order by array_position(
           array['vocabulary', 'grammar', 'listening', 'reading', 'writing'], s.skill), s.r), '{}')
  into v_ids
  from (
    select q.id, q.skill, random() as r
    from public.questions q
    where q.status = 'active'
      and (v_level is null or q.level_id = v_level)
      and (v_types is null or q.question_type = any (v_types))
      and (v_grammar is null or q.grammar_point_id = v_grammar)
      and (
        q.question_type <> 'listening_picture'
        or (
          jsonb_typeof(q.content -> 'images') = 'array'
          and jsonb_array_length(q.content -> 'images') = 3
          and not exists (
            select 1 from jsonb_array_elements(q.content -> 'images') as img
            where jsonb_typeof(img.value) <> 'string' or img.value #>> '{}' = ''
          )
        )
      )
    order by random()
    limit v_count
  ) as s;

  if cardinality(v_ids) = 0 then
    raise exception 'Chưa có câu hỏi phù hợp để tạo phiên.' using errcode = 'P0002';
  end if;

  insert into public.attempts (user_id, attempt_type, question_ids, config)
  values (
    v_user,
    p_mode,
    v_ids,
    jsonb_strip_nulls(jsonb_build_object(
      'mode', p_mode,
      'feedback', 'immediate',
      'level_id', v_level,
      'question_types', to_jsonb(v_types),
      'grammar_point_id', v_grammar,
      'count', v_count,
      'tag', v_tag
    ))
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Nộp một câu
--    Trả về kết quả của RIÊNG câu vừa nộp. Phiên 'immediate': khóa sau lần nộp đầu
--    (nộp lại chỉ nhận lại kết quả cũ, locked = true).
-- ---------------------------------------------------------------------

create or replace function public.submit_answer(
  p_attempt_id  uuid,
  p_question_id uuid,
  p_response    jsonb,
  p_is_flagged  boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_attempt  public.attempts;
  v_question public.questions;
  v_row      public.answers;
  v_correct  boolean;
  v_locked   boolean := false;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập để làm bài.' using errcode = '42501';
  end if;

  -- Khóa dòng phiên: các lần nộp / kết thúc của cùng một phiên chạy lần lượt
  select * into v_attempt
  from public.attempts a
  where a.id = p_attempt_id and a.user_id = v_user
  for update;
  if not found then
    raise exception 'Không tìm thấy phiên làm bài.' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'Phiên làm bài đã kết thúc.' using errcode = '55000';
  end if;
  if p_question_id is null or not (p_question_id = any (v_attempt.question_ids)) then
    raise exception 'Câu hỏi không thuộc phiên làm bài này.' using errcode = '22023';
  end if;
  if p_response is null or jsonb_typeof(p_response) <> 'object' or octet_length(p_response::text) > 2000 then
    raise exception 'Câu trả lời không hợp lệ.' using errcode = '22023';
  end if;

  select * into v_question from public.questions q where q.id = p_question_id;
  if not found then
    raise exception 'Không tìm thấy câu hỏi.' using errcode = 'P0002';
  end if;

  v_correct := public.grade_answer(v_question.question_type, v_question.content, v_question.answer, p_response);

  if coalesce(v_attempt.config ->> 'feedback', 'immediate') = 'immediate' then
    insert into public.answers (attempt_id, question_id, user_answer, is_correct, is_flagged)
    values (p_attempt_id, p_question_id, p_response, v_correct, coalesce(p_is_flagged, false))
    on conflict (attempt_id, question_id) do nothing
    returning * into v_row;

    if not found then
      -- Câu đã nộp trước đó: giữ nguyên câu trả lời cũ
      select * into v_row
      from public.answers an
      where an.attempt_id = p_attempt_id and an.question_id = p_question_id;
      v_locked := true;
    end if;

    return jsonb_build_object(
      'question_id', p_question_id,
      'user_answer', v_row.user_answer,
      'is_correct',  v_row.is_correct,
      'is_flagged',  v_row.is_flagged,
      'answer',      v_question.answer,
      'explanation', v_question.explanation,
      'locked',      v_locked
    );
  end if;

  -- Phiên 'deferred': ghi đè, không trả đáp án
  insert into public.answers (attempt_id, question_id, user_answer, is_correct, is_flagged)
  values (p_attempt_id, p_question_id, p_response, v_correct, coalesce(p_is_flagged, false))
  on conflict (attempt_id, question_id) do update
    set user_answer = excluded.user_answer,
        is_correct  = excluded.is_correct,
        is_flagged  = excluded.is_flagged,
        answered_at = now();

  return jsonb_build_object(
    'question_id', p_question_id,
    'user_answer', p_response,
    'is_flagged',  coalesce(p_is_flagged, false),
    'saved',       true
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Kết thúc phiên (làm hết hoặc "Kết thúc sớm"). Gọi lại nhiều lần vẫn ra cùng kết quả.
-- ---------------------------------------------------------------------

create or replace function public.finish_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_attempt public.attempts;
  v_answered int;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập để làm bài.' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.attempts a
  where a.id = p_attempt_id and a.user_id = v_user
  for update;
  if not found then
    raise exception 'Không tìm thấy phiên làm bài.' using errcode = 'P0002';
  end if;

  if v_attempt.status = 'in_progress' then
    update public.attempts a
    set status        = 'submitted',
        submitted_at  = now(),
        correct_count = (
          select count(*) from public.answers an
          where an.attempt_id = a.id and an.is_correct
        )
    where a.id = p_attempt_id
    returning * into v_attempt;
  end if;

  select count(*) into v_answered from public.answers an where an.attempt_id = p_attempt_id;

  return jsonb_build_object(
    'status',         v_attempt.status,
    'submitted_at',   v_attempt.submitted_at,
    'correct_count',  v_attempt.correct_count,
    'answered_count', v_answered,
    'total',          cardinality(v_attempt.question_ids)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Mở lại phiên: đề bài theo đúng thứ tự (không có đáp án) + các câu đã trả lời.
--    Đáp án và giải thích chỉ kèm theo câu ĐÃ nộp, và chỉ khi phiên hiện đáp án ngay
--    hoặc đã nộp bài. Đọc được cả câu đã chuyển sang Ngừng dùng sau khi tạo phiên.
-- ---------------------------------------------------------------------

create or replace function public.get_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_attempt public.attempts;
  v_reveal  boolean;
  v_questions jsonb;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập để làm bài.' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.attempts a
  where a.id = p_attempt_id and a.user_id = v_user;
  if not found then
    raise exception 'Không tìm thấy phiên làm bài.' using errcode = 'P0002';
  end if;

  v_reveal := coalesce(v_attempt.config ->> 'feedback', 'immediate') = 'immediate'
              or v_attempt.status = 'submitted';

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',          q.id,
             'type',        q.question_type,
             'skill',       q.skill,
             'level_id',    q.level_id,
             'content',     q.content,
             'audio_text',  q.audio_text,
             'result',      case when an.id is null then null else jsonb_build_object(
                              'user_answer', an.user_answer,
                              'is_flagged',  an.is_flagged,
                              'is_correct',  case when v_reveal then an.is_correct end,
                              'answer',      case when v_reveal then q.answer end,
                              'explanation', case when v_reveal then q.explanation end
                            ) end
           ) order by ids.ord), '[]'::jsonb)
  into v_questions
  from unnest(v_attempt.question_ids) with ordinality as ids(id, ord)
  join public.questions q on q.id = ids.id
  left join public.answers an on an.attempt_id = v_attempt.id and an.question_id = q.id;

  return jsonb_build_object(
    'id',            v_attempt.id,
    'attempt_type',  v_attempt.attempt_type,
    'status',        v_attempt.status,
    'config',        v_attempt.config,
    'started_at',    v_attempt.started_at,
    'submitted_at',  v_attempt.submitted_at,
    'correct_count', v_attempt.correct_count,
    'questions',     v_questions
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Quyền gọi hàm
-- ---------------------------------------------------------------------

-- Hai hàm nội bộ: chỉ các hàm ở trên gọi
revoke execute on function public.normalize_answer_text(text) from public, anon, authenticated;
revoke execute on function public.grade_answer(text, jsonb, jsonb, jsonb) from public, anon, authenticated;

revoke execute on function public.start_attempt(text, jsonb) from public, anon;
revoke execute on function public.submit_answer(uuid, uuid, jsonb, boolean) from public, anon;
revoke execute on function public.finish_attempt(uuid) from public, anon;
revoke execute on function public.get_attempt(uuid) from public, anon;
grant execute on function public.start_attempt(text, jsonb) to authenticated;
grant execute on function public.submit_answer(uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.finish_attempt(uuid) to authenticated;
grant execute on function public.get_attempt(uuid) to authenticated;

commit;
