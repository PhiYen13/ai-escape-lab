/**
 * scripts/generate-migration11.js
 * Sinh migration an toàn, idempotent thực sự và đồng bộ Room 03 Lớp 4 (web_exploration_lab_v1)
 * vào chiến dịch MASTER trong Supabase.
 */

const fs = require('fs');
const path = require('path');

function sqlEscape(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function sqlJson(obj) {
  if (obj === null || obj === undefined) return "'{}'::jsonb";
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

const dataFile = path.join(__dirname, '..', 'data', 'room03_grade4_master.json');
const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const r = d.room;

let sql = `-- ============================================================================
-- 20261102000011_sync_room03_grade4_master.sql
-- Dự án: AI Escape Lab
-- Mục tiêu:
--   1. Đồng bộ an toàn Khối 4 - Phòng 03 (Thông tin trên trang web - web_exploration_lab_v1)
--      vào chiến dịch MASTER với nguyên tắc Idempotent thực sự.
--   2. Bảo toàn tuyệt đối mọi thay đổi nếu Admin đã tinh chỉnh.
--   3. Đồng bộ 18 nhiệm vụ học tập (4 trạm và 4 mảnh ghép chìa khóa).
--   4. Tự động cập nhật published_payload của MASTER để Game Client nhận ngay cấu hình phòng 3 lớp 4.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHẦN 1. CẬP NHẬT RÀNG BUỘC KIND CHO ROOM_ITEMS ĐỂ HỖ TRỢ DẠNG 'fill_select'
-- ----------------------------------------------------------------------------
ALTER TABLE public.room_items DROP CONSTRAINT IF EXISTS room_items_kind_check;
ALTER TABLE public.room_items ADD CONSTRAINT room_items_kind_check CHECK (kind IN (
  'single', 'multi', 'sequence', 'match', 'sort', 'order', 'pair', 'typing', 'fingers',
  'rescue_search', 'rescue_usb', 'web_nav', 'share_files', 'assemble',
  'touchpad_gate', 'tablet_gate', 'phone_gate', 'conveyor', 'hazard_safety',
  'fill_select'
));

-- ----------------------------------------------------------------------------
-- PHẦN 2. ĐỒNG BỘ PHÒNG 03 LỚP 4 VÀO KHO MASTER
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_camp_id UUID;
    v_room_id UUID;
    v_room_count INT;
    v_item_count INT;
    v_rooms_inserted INT := 0;
    v_items_inserted INT := 0;
    v_rooms_json JSONB := '[]'::jsonb;
    v_room_json JSONB;
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_items_arr JSONB;
    v_item RECORD;
    v_room RECORD;
    v_item_data JSONB;
    v_published_payload JSONB;
    v_new_version INT;
BEGIN
    -- 1. Tìm chiến dịch MASTER
    SELECT id, COALESCE(version, 1) + 1
    INTO v_camp_id, v_new_version
    FROM public.campaigns
    WHERE is_template = true OR share_code = 'MASTER'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_camp_id IS NULL THEN
        RAISE EXCEPTION '⚠️ Không tìm thấy chiến dịch MASTER trong database!';
    END IF;

    RAISE NOTICE '🚀 Bắt đầu đồng bộ Room 03 Lớp 4 vào MASTER (ID: %)...', v_camp_id;

    -- 2. Kiểm tra hoặc thêm mới Phòng 03 Khối 4
    SELECT id INTO v_room_id
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id AND grade = ${r.grade} AND room_number = ${r.room_number};

    IF v_room_id IS NULL THEN
        INSERT INTO public.campaign_rooms (
            campaign_id,
            grade,
            room_number,
            topic,
            theme,
            passcode,
            module_id,
            development_status,
            engine_config
        ) VALUES (
            v_camp_id,
            ${r.grade},
            ${r.room_number},
            ${sqlEscape(r.topic)},
            ${sqlEscape(r.theme)},
            ${sqlEscape(r.passcode)},
            ${sqlEscape(r.module_id)},
            'ready',
            ${sqlJson(r.engine_config)}
        ) RETURNING id INTO v_room_id;
        v_rooms_inserted := v_rooms_inserted + 1;
        RAISE NOTICE '  ✅ Đã thêm mới Khối % Phòng 0% (ID: %)', ${r.grade}, ${r.room_number}, v_room_id;
    ELSE
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, ${sqlEscape(r.module_id)}),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN ${sqlJson(r.engine_config)} ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (Cập nhật ready)', ${r.grade}, ${r.room_number};
    END IF;
`;

d.items.forEach(it => {
  sql += `
    -- Item: ${it.item_key}
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = ${sqlEscape(it.item_key)}) THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            ${sqlEscape(it.item_key)},
            ${sqlEscape(it.item_type)},
            ${sqlEscape(it.kind)},
            ${sqlEscape(it.title)},
            ${sqlEscape(it.intro)},
            ${sqlEscape(it.question)},
            ${sqlEscape(it.hint || '')},
            ${it.sort_order || 1},
            ${sqlEscape(it.digit || it.reward_code_char || null)},
            ${sqlJson(it.content_payload)}
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;
`;
});

sql += `
    -- ------------------------------------------------------------------------
    -- KIỂM TRA TÍNH TOÀN VẸN CỦA PHÒNG 3 KHỐI 4
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_item_count
    FROM public.room_items
    WHERE room_id = v_room_id;

    RAISE NOTICE '🎉 TỔNG KẾT: Phòng 03 Khối 4 hiện có % vật phẩm (Yêu cầu: 18). Thêm mới: % item.', v_item_count, v_items_inserted;

    IF v_item_count <> 18 THEN
        RAISE EXCEPTION '⚠️ Phòng 03 Khối 4 chưa có đủ 18 vật phẩm (Hiện có: %)! Hủy giao dịch.', v_item_count;
    END IF;

    -- ------------------------------------------------------------------------
    -- CẬP NHẬT published_payload CỦA MASTER
    -- ------------------------------------------------------------------------
    FOR v_room IN
        SELECT * FROM public.campaign_rooms
        WHERE campaign_id = v_camp_id
        ORDER BY grade ASC, room_number ASC
    LOOP
        v_tasks_obj := '{}'::jsonb;
        v_secrets_obj := '{}'::jsonb;
        v_items_arr := '[]'::jsonb;

        FOR v_item IN
            SELECT * FROM public.room_items
            WHERE room_id = v_room.id
            ORDER BY sort_order ASC
        LOOP
            v_item_data := jsonb_build_object(
                'id', v_item.id,
                'item_key', v_item.item_key,
                'item_type', v_item.item_type,
                'kind', v_item.kind,
                'title', v_item.title,
                'intro', v_item.intro,
                'question', v_item.question,
                'hint', v_item.hint,
                'sort_order', v_item.sort_order,
                'content_payload', v_item.content_payload
            );

            v_items_arr := v_items_arr || jsonb_build_array(v_item_data);

            IF v_item.item_type = 'task' THEN
                v_tasks_obj := jsonb_set(v_tasks_obj, ARRAY[v_item.item_key], v_item_data);
            ELSE
                v_secrets_obj := jsonb_set(v_secrets_obj, ARRAY[v_item.item_key], v_item_data);
            END IF;
        END LOOP;

        v_room_json := jsonb_build_object(
            'room_number', v_room.room_number,
            'grade', v_room.grade,
            'topic', v_room.topic,
            'code', v_room.passcode,
            'theme', v_room.theme,
            'accent', v_room.accent_color,
            'module_id', COALESCE(v_room.module_id, 'escape_room_point_click_v1'),
            'development_status', COALESCE(v_room.development_status, 'ready'),
            'engine_config', COALESCE(v_room.engine_config, '{}'::jsonb),
            'items', v_items_arr,
            'tasks', v_tasks_obj,
            'secrets', v_secrets_obj
        );

        v_rooms_json := v_rooms_json || jsonb_build_array(v_room_json);
    END LOOP;

    v_published_payload := jsonb_build_object(
        'campaign', jsonb_build_object(
            'id', v_camp_id,
            'title', 'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
            'share_code', 'MASTER',
            'version', v_new_version,
            'published_at', NOW()
        ),
        'rooms', v_rooms_json
    );

    UPDATE public.campaigns
    SET is_published = TRUE,
        version = v_new_version,
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{published_payload}', v_published_payload),
        updated_at = NOW()
    WHERE id = v_camp_id;

    RAISE NOTICE '✅ Đồng bộ hoàn tất! Chiến dịch MASTER đã nâng lên phiên bản v% với đầy đủ 8 phòng.', v_new_version;
END;
$$;
`;

const outPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261102000011_sync_room03_grade4_master.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('✅ Đã tạo file migration: ' + outPath);
