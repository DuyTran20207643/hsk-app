-- =====================================================================
-- 0005_words_pinyin_search.sql
-- Tìm từ vựng theo pinyin KHÔNG cần gõ dấu thanh.
--
-- Thêm cột words.pinyin_plain do database tự tính từ cột pinyin:
-- bỏ dấu thanh, chữ thường, bỏ khoảng trắng và dấu ', ü viết thành u.
--   "dōngxi"    → "dongxi"
--   "gōnggòng qìchē" → "gonggongqiche"
-- Cột này tự cập nhật mỗi khi sửa pinyin, không cần ghi vào.
-- Hàm plainPinyin() trong src/lib/pinyin.ts làm đúng phép đổi này cho chữ người dùng gõ tìm.
-- =====================================================================

begin;

alter table public.words
  add column pinyin_plain text generated always as (
    replace(
      replace(
        translate(
          lower(pinyin),
          'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü',
          'aaaaeeeeiiiioooouuuuuuuuu'
        ),
        ' ', ''
      ),
      '''', ''
    )
  ) stored;

commit;
