-- =====================================================================
-- 0010_review_modes.sql
-- Ba chế độ luyện tập của trang Ôn tập (nhiệm vụ 10). Chỉ thay 2 hàm của 0009,
-- KHÔNG đổi bảng nào.
--
--   start_attempt  chọn câu theo lịch sử làm bài của chính học viên:
--     'practice'  Luyện theo dạng câu (UC06): ưu tiên câu chưa làm, rồi câu từng làm sai,
--                 còn lại ngẫu nhiên. Mặc định 10 câu.
--     'mixed'     Ôn tổng hợp (BR17, BR18): khoảng 60% câu từng làm đúng, 25% câu từng làm sai,
--                 15% câu mới; nhóm nào thiếu thì bù bằng câu mới (rồi câu sai, câu đúng).
--                 Thứ tự trộn để các dạng câu xen kẽ. Mặc định 30 câu.
--     'weakness'  Ôn điểm yếu (UC09): câu thuộc các nhóm điểm yếu (config.targets),
--                 khoảng 70% câu chưa làm, 30% câu từng làm sai (sai gần nhất trước);
--                 thiếu câu mới thì lấy thêm câu từng sai. Mặc định 10 câu.
--     Nhóm của từng câu (new / wrong / correct) lưu ở config.groups để hiện nhãn khi làm bài.
--
--   submit_answer  thêm: phiên Ôn tổng hợp, câu "Chọn nghĩa của từ" trả lời SAI thì
--                  đưa thẻ từ có chữ Hán trùng đề bài về ngày ôn là ngày mai
--                  (chưa có thẻ thì tạo mới). Trả lời đúng: không đổi lịch ôn.
--
-- "Từng làm đúng / sai" xét câu trả lời GẦN NHẤT của học viên với câu đó (mọi phiên,
-- trừ bài thi chưa nộp). Câu đúng nhưng đánh dấu "Chưa chắc chắn" xếp vào nhóm từng làm sai,
-- giống cách tính điểm yếu (src/lib/weakness.ts).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tạo phiên
--    p_config (đều không bắt buộc, trừ targets của 'weakness'):
--      level_id          cấp HSK
--      question_types    mảng dạng câu
--      grammar_point_id  chỉ lấy câu gắn ngữ pháp này
--      count             số câu, 1–50 (mặc định: practice / weakness 10, mixed 30)
--      tag               nhãn ngắn để tìm lại phiên (chữ thường, số, gạch nối; tối đa 20 ký tự)
--      targets           (weakness) 1–10 nhóm dạng "type:<dạng câu>", "topic:<id>", "grammar:<id>"
--      baseline          (weakness) tỷ lệ đúng trước đó của các nhóm, 0–100, để so khi xem kết quả
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
  v_user     uuid := auth.uid();
  v_config   jsonb := coalesce(p_config, '{}'::jsonb);
  v_level    smallint;
  v_types    text[];
  v_grammar  int;
  v_count    int;
  v_tag      text;
  v_targets  text[];
  v_baseline numeric;
  v_target   text;
  v_q_new     int := 0;
  v_q_wrong   int := 0;
  v_q_correct int := 0;
  v_ids      uuid[];
  v_groups   jsonb;
  v_id       uuid;
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

  if p_mode is null or p_mode not in ('practice', 'mixed', 'weakness') then
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
  v_count := case p_mode when 'mixed' then 30 else 10 end;
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

  -- Nhóm điểm yếu (chỉ chế độ weakness, bắt buộc)
  if p_mode = 'weakness' then
    if jsonb_typeof(v_config -> 'targets') is distinct from 'array'
       or jsonb_array_length(v_config -> 'targets') not between 1 and 10 then
      raise exception 'Bạn cần chọn điểm yếu để ôn.' using errcode = '22023';
    end if;
    v_targets := '{}';
    for v_target in
      select case when jsonb_typeof(t.raw) = 'string' then t.raw #>> '{}' end
      from jsonb_array_elements(v_config -> 'targets') as t(raw)
    loop
      if v_target is null
         or not (
           (v_target ~ '^type:[a-z_]+$' and split_part(v_target, ':', 2) = any (v_all_types))
           or (v_target ~ '^topic:[1-9][0-9]{0,8}$'
               and exists (select 1 from public.topics tp where tp.id = split_part(v_target, ':', 2)::int))
           or (v_target ~ '^grammar:[1-9][0-9]{0,8}$'
               and exists (select 1 from public.grammar_points g where g.id = split_part(v_target, ':', 2)::int))
         ) then
        raise exception 'Điểm yếu không hợp lệ.' using errcode = '22023';
      end if;
      if not (v_target = any (v_targets)) then
        v_targets := v_targets || v_target;
      end if;
    end loop;

    if jsonb_typeof(v_config -> 'baseline') = 'number' then
      v_baseline := (v_config ->> 'baseline')::numeric;
      if v_baseline not between 0 and 100 then
        raise exception 'Tham số của phiên không hợp lệ.' using errcode = '22023';
      end if;
      v_baseline := round(v_baseline);
    end if;
  end if;

  -- Số câu cần lấy của từng nhóm; phần còn thiếu bù theo thứ tự ưu tiên ở dưới
  if p_mode = 'mixed' then
    v_q_correct := round(v_count * 0.60);
    v_q_wrong   := floor(v_count * 0.25);
    v_q_new     := v_count - v_q_correct - v_q_wrong;
  elsif p_mode = 'weakness' then
    v_q_new   := round(v_count * 0.70);
    v_q_wrong := v_count - v_q_new;
  end if;
  -- 'practice': không chia nhóm, lấy theo thứ tự ưu tiên câu mới → câu sai → câu đúng

  with
  -- Câu trả lời gần nhất của học viên với từng câu hỏi (bỏ bài thi chưa nộp: còn sửa được)
  hist as (
    select distinct on (an.question_id)
           an.question_id, an.is_correct, an.is_flagged, an.answered_at
    from public.answers an
    join public.attempts a on a.id = an.attempt_id
    where a.user_id = v_user
      and an.is_correct is not null
      and (coalesce(a.config ->> 'feedback', 'immediate') = 'immediate' or a.status = 'submitted')
    order by an.question_id, an.answered_at desc
  ),
  pool as (
    select q.id, q.skill, q.question_type,
           case
             when h.question_id is null then 'new'
             when h.is_correct and not h.is_flagged then 'correct'
             else 'wrong'
           end as grp,
           h.answered_at,
           random() as r
    from public.questions q
    left join hist h on h.question_id = q.id
    where q.status = 'active'
      and (v_level is null or q.level_id = v_level)
      and (v_types is null or q.question_type = any (v_types))
      and (v_grammar is null or q.grammar_point_id = v_grammar)
      and (
        v_targets is null
        or exists (
          select 1 from unnest(v_targets) as t(key)
          where case split_part(t.key, ':', 1)
                  when 'type'    then q.question_type = split_part(t.key, ':', 2)
                  when 'topic'   then q.topic_id::text = split_part(t.key, ':', 2)
                  when 'grammar' then q.grammar_point_id::text = split_part(t.key, ':', 2)
                  else false
                end
        )
      )
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
  ),
  ranked as (
    select p.*,
           -- Trong mỗi nhóm: ngẫu nhiên; riêng ôn điểm yếu lấy câu sai GẦN NHẤT trước
           row_number() over (
             partition by p.grp
             order by case when p_mode = 'weakness' and p.grp = 'wrong' then p.answered_at end desc nulls last, p.r
           ) as rn,
           case p.grp when 'new' then v_q_new when 'wrong' then v_q_wrong else v_q_correct end as quota,
           -- Thứ tự bù chỗ thiếu
           case
             when p_mode = 'weakness' then case p.grp when 'wrong' then 0 when 'new' then 1 else 2 end
             else case p.grp when 'new' then 0 when 'wrong' then 1 else 2 end
           end as fill_rank
    from pool p
  ),
  first_pick as (
    select * from ranked where rn <= quota
  ),
  extra as (
    select * from ranked
    where rn > quota
    order by fill_rank, rn
    limit greatest(v_count - (select count(*) from first_pick), 0)
  ),
  picked as (
    select * from first_pick
    union all
    select * from extra
  ),
  ordered as (
    select pk.*,
           -- Thứ tự xen kẽ: câu thứ nhất của mỗi dạng, rồi câu thứ hai của mỗi dạng…
           row_number() over (partition by pk.question_type order by random()) as turn,
           random() as r2
    from picked pk
  )
  select
    coalesce(array_agg(o.id order by
      case when p_mode = 'practice'
           then array_position(array['vocabulary', 'grammar', 'listening', 'reading', 'writing'], o.skill)
           else o.turn end,
      o.r2), '{}'),
    coalesce(jsonb_object_agg(o.id::text, o.grp), '{}'::jsonb)
  into v_ids, v_groups
  from ordered o;

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
      'tag', v_tag,
      'targets', to_jsonb(v_targets),
      'baseline', v_baseline,
      'groups', case when p_mode in ('mixed', 'weakness') then v_groups end
    ))
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Nộp một câu (giống 0009, thêm bước đưa thẻ từ về ngày mai ở Ôn tổng hợp)
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
  v_word_id  uuid;
  v_hanzi    text;
  v_due      date;
  v_srs      jsonb;
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

    -- Ôn tổng hợp: sai câu "Chọn nghĩa của từ" → thẻ của từ đó ôn lại vào ngày mai
    if not v_locked and not v_correct
       and v_attempt.attempt_type = 'mixed'
       and v_question.question_type = 'vocab_meaning' then
      -- Từ có chữ Hán trùng đề bài; trùng chữ Hán nhiều từ thì ưu tiên từ cùng pinyin, rồi cấp thấp hơn
      select w.id, w.hanzi into v_word_id, v_hanzi
      from public.words w
      where w.status = 'active'
        and w.hanzi = btrim(v_question.content ->> 'stem')
      order by
        (lower(replace(w.pinyin, ' ', '')) = lower(replace(coalesce(v_question.content ->> 'pinyin', ''), ' ', ''))) desc,
        w.level_id,
        w.id
      limit 1;

      if v_word_id is not null then
        -- "Ngày mai" theo giờ Việt Nam. Thẻ đã đến hạn sớm hơn (hôm nay, quá hạn) thì giữ ngày cũ.
        insert into public.srs_cards (user_id, word_id, due_date)
        values (v_user, v_word_id, (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)
        on conflict (user_id, word_id) do update
          set due_date = least(public.srs_cards.due_date, excluded.due_date)
        returning due_date into v_due;

        v_srs := jsonb_build_object('word_id', v_word_id, 'hanzi', v_hanzi, 'due_date', v_due);
      end if;
    end if;

    return jsonb_build_object(
      'question_id', p_question_id,
      'user_answer', v_row.user_answer,
      'is_correct',  v_row.is_correct,
      'is_flagged',  v_row.is_flagged,
      'answer',      v_question.answer,
      'explanation', v_question.explanation,
      'locked',      v_locked
    ) || case when v_srs is null then '{}'::jsonb else jsonb_build_object('srs', v_srs) end;
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
-- 3. Quyền gọi hàm (giữ như 0009)
-- ---------------------------------------------------------------------

revoke execute on function public.start_attempt(text, jsonb) from public, anon;
revoke execute on function public.submit_answer(uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.start_attempt(text, jsonb) to authenticated;
grant execute on function public.submit_answer(uuid, uuid, jsonb, boolean) to authenticated;

commit;
