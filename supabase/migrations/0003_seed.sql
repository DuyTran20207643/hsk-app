-- =====================================================================
-- 0003_seed.sql — Dữ liệu khởi tạo: 3 cấp HSK, 18 chủ đề, 5 từ mẫu
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Cấp độ HSK 1–3
--    (id, code, name, max_score, pass_score, word_count, sort_order)
-- ---------------------------------------------------------------------

insert into public.hsk_levels (id, code, name, max_score, pass_score, word_count, sort_order) values
  (1, 'HSK1', 'HSK 1', 200, 120, 150, 1),
  (2, 'HSK2', 'HSK 2', 200, 120, 300, 2),
  (3, 'HSK3', 'HSK 3', 300, 180, 600, 3);

-- ---------------------------------------------------------------------
-- 2. Chủ đề (sort_order theo đúng thứ tự)
-- ---------------------------------------------------------------------

insert into public.topics (name, sort_order) values
  ('Chào hỏi và phép lịch sự', 1),
  ('Thông tin cá nhân', 2),
  ('Gia đình và các mối quan hệ', 3),
  ('Công việc và học tập', 4),
  ('Sở thích, thể thao và giải trí', 5),
  ('Thời gian', 6),
  ('Ăn uống', 7),
  ('Mua sắm, quần áo và đồ dùng', 8),
  ('Nơi chốn, nhà ở và vị trí', 9),
  ('Thời tiết và sức khỏe', 10),
  ('Sinh hoạt hằng ngày', 11),
  ('Giao thông và đi lại', 12),
  ('Du lịch', 13),
  ('Lễ tết và dịp đặc biệt', 14),
  ('Kế hoạch và hẹn gặp', 15),
  ('Ngoại hình và tính cách', 16),
  ('Cảm xúc và quan điểm', 17),
  ('Thiên nhiên và môi trường', 18);

-- ---------------------------------------------------------------------
-- 3. Năm từ mẫu để thử (3 từ Hán Việt dễ nhầm nghĩa)
--    Chủ đề gắn theo tên; 告诉 chưa gắn chủ đề vì không thuộc riêng chủ đề nào.
-- ---------------------------------------------------------------------

insert into public.words
  (hanzi, pinyin, han_viet, meaning_vi, level_id, topic_id, is_false_friend, false_friend_note)
values
  ('学生', 'xuésheng', 'học sinh', 'học sinh', 1,
    (select id from public.topics where name = 'Công việc và học tập'),
    false, null),
  ('东西', 'dōngxi', 'đông tây', 'đồ, đồ vật', 1,
    (select id from public.topics where name = 'Mua sắm, quần áo và đồ dùng'),
    true, 'Đọc dōngxi là đồ vật; chỉ khi đọc dōngxī mới là phía đông và phía tây'),
  ('机场', 'jīchǎng', 'cơ trường', 'sân bay', 2,
    (select id from public.topics where name = 'Giao thông và đi lại'),
    false, null),
  ('告诉', 'gàosu', 'cáo tố', 'nói cho biết', 2,
    null,
    true, 'Không phải tố cáo; 告诉 nghĩa là nói cho ai biết'),
  ('环境', 'huánjìng', 'hoàn cảnh', 'môi trường', 3,
    (select id from public.topics where name = 'Thiên nhiên và môi trường'),
    true, 'Nghĩa là môi trường, không phải hoàn cảnh sống');

commit;
