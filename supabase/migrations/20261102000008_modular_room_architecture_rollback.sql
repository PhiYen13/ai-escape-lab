-- ============================================================================
-- 20261102000008_modular_room_architecture_rollback.sql
-- File khôi phục (Rollback) an toàn cho Migration 08 nếu cần thiết
-- ============================================================================

-- 1. XÓA CÁC TRIGGERS VÀ HÀM BẢO VỆ CẤU TRÚC
DROP TRIGGER IF EXISTS trg_protect_item_structure ON public.room_items;
DROP FUNCTION IF EXISTS public.prevent_teacher_modifying_item_structure();

DROP TRIGGER IF EXISTS trg_protect_room_structure ON public.campaign_rooms;
DROP FUNCTION IF EXISTS public.prevent_teacher_modifying_room_structure();

-- 2. XÓA CHỈ MỤC
DROP INDEX IF EXISTS public.idx_campaign_rooms_dev_status;
DROP INDEX IF EXISTS public.idx_campaign_rooms_module;

-- 3. XÓA CÁC CỘT MỚI BỔ SUNG TRONG CAMPAIGN_ROOMS
ALTER TABLE public.campaign_rooms
    DROP COLUMN IF EXISTS engine_config,
    DROP COLUMN IF EXISTS development_status,
    DROP COLUMN IF EXISTS module_id;

