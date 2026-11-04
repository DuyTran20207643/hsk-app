-- =====================================================================
-- 0006: Âm Hán Việt không bắt buộc
-- Không phải từ nào cũng có âm Hán Việt (ví dụ từ thuần âm, từ mượn),
-- nên cột words.han_viet được phép để trống (null).
-- Riêng từ được đánh dấu "Từ Hán Việt dễ nhầm" thì ứng dụng vẫn bắt buộc có âm Hán Việt.
-- Chạy lại nhiều lần không lỗi.
-- =====================================================================

alter table public.words alter column han_viet drop not null;

-- Chuỗi rỗng / chỉ có dấu cách coi như không có âm Hán Việt
update public.words set han_viet = null where btrim(han_viet) = '';
