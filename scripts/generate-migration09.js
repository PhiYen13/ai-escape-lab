/**
 * scripts/generate-migration09.js
 * Tạo file migration an toàn, chuẩn xác, idempotent thực sự và bảo mật đa tầng:
 * supabase/migrations/20261102000009_sync_all_7_master_rooms.sql
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

const files = [
  'data/room02_grade3_master.json',
  'data/room02_grade4_master.json',
  'data/room02_grade5_master.json',
  'data/room03_grade3_master.json'
];

let sql = `-- ============================================================================
-- 20261102000009_sync_all_7_master_rooms.sql
-- Dự án: AI Escape Lab
-- Mục tiêu:
--   1. Bảo mật đa tầng: Khóa chặt quyền INSERT / UPDATE / DELETE trên cấu trúc phòng và vật phẩm.
--   2. Bảo vệ các khóa gameplay cố định (task_mode, stage_index, zone_index, hazard_index, device_type).
--   3. Đồng bộ an toàn 4 phòng mới vào kho MASTER với nguyên tắc Idempotent thực sự:
--      - KHÔNG ghi đè câu hỏi, đáp án, lý thuyết, gợi ý hoặc cài đặt phòng mà Admin đã sửa.
--      - KHÔNG tạo bản ghi trùng khi chạy lại (ON CONFLICT DO NOTHING).
--      - KHÔNG ghi đè published_payload của MASTER nếu không có phòng mới được thêm vào.
--      - KHÔNG can thiệp vào 3 phòng số 1 hiện có hay bất kỳ bộ đề nào của giáo viên.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHẦN 1. NÂNG CẤP TRIGGER BẢO VỆ CẤU TRÚC PHÒNG (INSERT, UPDATE, DELETE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_teacher_modifying_room_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Cho phép toàn quyền đối với Quản trị viên (Admin) hoặc Service Role / Postgres
    IF public.auth_is_admin() OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- 1. Chặn Giáo viên tự ý tạo thêm phòng mới trái phép
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không có quyền tự ý tạo thêm phòng chơi! Hãy sử dụng chức năng sao chép bộ đề từ MASTER.';
    END IF;

    -- 2. Chặn Giáo viên tự ý xóa từng phòng chơi riêng lẻ
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM public.campaigns WHERE id = OLD.campaign_id) THEN
            RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không được tự ý xóa phòng chơi khỏi bộ đề!';
        END IF;
        RETURN OLD;
    END IF;

    -- 3. Đối với UPDATE: Chặn thay đổi các thuộc tính kiến trúc của phòng
    IF OLD.room_number <> NEW.room_number THEN
        RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không được thay đổi số thứ tự phòng (room_number)!';
    END IF;

    IF OLD.grade <> NEW.grade THEN
        RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không được thay đổi khối lớp (grade) của phòng!';
    END IF;

    IF OLD.campaign_id <> NEW.campaign_id THEN
        RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không được thay đổi chiến dịch sở hữu phòng!';
    END IF;

    IF OLD.module_id IS DISTINCT FROM NEW.module_id THEN
        RAISE EXCEPTION 'Bảo vệ cơ chế: Giáo viên không có quyền thay đổi mã module trò chơi (module_id)!';
    END IF;

    IF OLD.development_status IS DISTINCT FROM NEW.development_status THEN
        RAISE EXCEPTION 'Bảo vệ cơ chế: Giáo viên không có quyền thay đổi trạng thái phát triển (development_status)!';
    END IF;

    IF OLD.engine_config IS DISTINCT FROM NEW.engine_config THEN
        RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không có quyền thay đổi cấu hình cơ chế game cố định (engine_config)!';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_room_structure ON public.campaign_rooms;
CREATE TRIGGER trg_protect_room_structure
    BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_teacher_modifying_room_structure();


-- ----------------------------------------------------------------------------
-- PHẦN 2. NÂNG CẤP TRIGGER BẢO VỆ VẬT PHẨM & KHÓA GAMEPLAY NỘI TẠI
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_teacher_modifying_item_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Cho phép toàn quyền đối với Quản trị viên (Admin) hoặc Service Role / Postgres
    IF public.auth_is_admin() OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- 1. Chặn Giáo viên tự ý tạo thêm vật phẩm cấu trúc
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không có quyền tự ý thêm vật phẩm cấu trúc mới!';
    END IF;

    -- 2. Chặn Giáo viên tự ý xóa vật phẩm cấu trúc
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM public.campaign_rooms WHERE id = OLD.room_id) THEN
            RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không được tự ý xóa vật phẩm cấu trúc của trò chơi!';
        END IF;
        RETURN OLD;
    END IF;

    -- 3. Đối với UPDATE: Chặn đổi các khóa cấu trúc
    IF OLD.room_id <> NEW.room_id THEN
        RAISE EXCEPTION 'Bảo vệ cấu trúc: Giáo viên không được di chuyển vật phẩm sang phòng khác!';
    END IF;

    IF OLD.item_key <> NEW.item_key THEN
        RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi mã khóa vật phẩm (item_key)!';
    END IF;

    IF OLD.item_type <> NEW.item_type THEN
        RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi phân loại nhiệm vụ (item_type)!';
    END IF;

    IF OLD.kind <> NEW.kind THEN
        RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi dạng tương tác (kind) của module!';
    END IF;

    -- 4. BẢO VỆ CÁC KHÓA GAMEPLAY NỘI TẠI TRONG content_payload:
    -- Giáo viên ĐƯỢC PHÉP sửa: question, answers, correct, feedback, lines, article_title, keywords, files, theory, example, tips, target_code
    -- Giáo viên TUYỆT ĐỐI KHÔNG ĐƯỢC sửa: task_mode, stage_index, station_index, zone_index, hazard_index, device_type
    IF OLD.content_payload IS NOT NULL AND NEW.content_payload IS NOT NULL THEN
        IF (OLD.content_payload->>'task_mode') IS DISTINCT FROM (NEW.content_payload->>'task_mode') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi task_mode trong nội dung!';
        END IF;
        IF (OLD.content_payload->>'stage_index') IS DISTINCT FROM (NEW.content_payload->>'stage_index') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi stage_index!';
        END IF;
        IF (OLD.content_payload->>'station_index') IS DISTINCT FROM (NEW.content_payload->>'station_index') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi station_index!';
        END IF;
        IF (OLD.content_payload->>'zone_index') IS DISTINCT FROM (NEW.content_payload->>'zone_index') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi zone_index!';
        END IF;
        IF (OLD.content_payload->>'hazard_index') IS DISTINCT FROM (NEW.content_payload->>'hazard_index') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi hazard_index!';
        END IF;
        IF (OLD.content_payload->>'device_type') IS DISTINCT FROM (NEW.content_payload->>'device_type') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi device_type!';
        END IF;
        IF (OLD.content_payload->'needed_indices') IS DISTINCT FROM (NEW.content_payload->'needed_indices') THEN
            RAISE EXCEPTION 'Bảo vệ gameplay: Giáo viên không được thay đổi needed_indices!';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_item_structure ON public.room_items;
CREATE TRIGGER trg_protect_item_structure
    BEFORE INSERT OR UPDATE OR DELETE ON public.room_items
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_teacher_modifying_item_structure();


-- ----------------------------------------------------------------------------
-- PHẦN 3. ĐỒNG BỘ 4 PHÒNG MỚI VÀO KHO MASTER (IDEMPOTENT THỰC SỰ)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_camp_id UUID;
    v_teacher_id UUID;
    v_room_id UUID;
    v_room_count INT;
    v_item_count INT;
    v_rooms_inserted INT := 0;
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
    SELECT id, teacher_id, COALESCE(version, 1) + 1
    INTO v_camp_id, v_teacher_id, v_new_version
    FROM public.campaigns
    WHERE is_template = true OR share_code = 'MASTER'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_camp_id IS NULL THEN
        RAISE EXCEPTION '⚠️ Không tìm thấy chiến dịch MASTER trong database!';
    END IF;

    RAISE NOTICE '🚀 Bắt đầu đồng bộ an toàn 4 phòng mới vào MASTER (ID: %)...', v_camp_id;
`;

files.forEach(f => {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const r = d.room;

  sql += `
    -- ------------------------------------------------------------------------
    -- KHỐI ${r.grade} - PHÒNG 0${r.room_number}: ${r.topic}
    -- ------------------------------------------------------------------------
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
        -- Phòng đã tồn tại: Tuyệt đối KHÔNG ghi đè topic, theme, passcode Admin đã chỉnh sửa!
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, ${sqlEscape(r.module_id)}),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN ${sqlJson(r.engine_config)} ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (KHÔNG ghi đè)', ${r.grade}, ${r.room_number};
    END IF;
`;

  d.items.forEach(it => {
    sql += `
    -- Item: ${it.item_key}
    -- Quy tắc: ON CONFLICT DO NOTHING để bảo toàn 100% câu hỏi/đáp án Admin đã chỉnh sửa!
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
        ${sqlEscape(it.hint)},
        ${it.sort_order || 1},
        ${sqlEscape(it.digit || it.reward_code_char || null)},
        ${sqlJson(it.content_payload)}
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;
`;
  });
});

sql += `
    -- ------------------------------------------------------------------------
    -- KIỂM TRA TÍNH TOÀN VẸN VÀ TỔNG SỐ PHÒNG / VẬT PHẨM TRONG MASTER
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_room_count
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id;

    SELECT COUNT(*) INTO v_item_count
    FROM public.room_items ri
    JOIN public.campaign_rooms cr ON ri.room_id = cr.id
    WHERE cr.campaign_id = v_camp_id;

    RAISE NOTICE '🎉 TỔNG KẾT: MASTER có % phòng (Yêu cầu: 7). Tổng số vật phẩm: % (Yêu cầu: 57). Số phòng thêm mới: %.', v_room_count, v_item_count, v_rooms_inserted;

    IF v_room_count <> 7 OR v_item_count <> 57 THEN
        RAISE EXCEPTION '⚠️ Dữ liệu chưa khớp chuẩn 7 phòng và 57 vật phẩm (Hiện có % phòng, % vật phẩm)! Hủy bỏ giao dịch.', v_room_count, v_item_count;
    END IF;

    -- ------------------------------------------------------------------------
    -- CẬP NHẬT published_payload: CHỈ KHI CÓ PHÒNG MỚI ĐƯỢC THÊM
    -- Nếu chạy lại mà không có phòng mới (v_rooms_inserted = 0), tuyệt đối
    -- KHÔNG ghi đè published_payload hiện tại của Admin.
    -- ------------------------------------------------------------------------
    IF v_rooms_inserted > 0 THEN
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
            updated_at = NOW()
        WHERE id = v_camp_id;

        INSERT INTO public.published_campaigns (
            share_code,
            campaign_id,
            teacher_id,
            title,
            version,
            published_payload,
            published_at
        )
        VALUES (
            'MASTER',
            v_camp_id,
            v_teacher_id,
            'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
            v_new_version,
            v_published_payload,
            NOW()
        )
        ON CONFLICT (share_code) DO UPDATE SET
            version = EXCLUDED.version,
            published_payload = EXCLUDED.published_payload,
            published_at = NOW();

        RAISE NOTICE '🚀 Đã xuất bản và làm mới published_payload của MASTER thành công!';
    ELSE
        RAISE NOTICE 'ℹ️ Không có phòng mới nào được thêm vào -> Bảo toàn nguyên vẹn published_payload và version của Admin.';
    END IF;

END $$;
`;

const outPath = path.resolve('supabase/migrations/20261102000009_sync_all_7_master_rooms.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Đã tạo file migration hoàn chỉnh: ${outPath} (${sql.length} bytes)`);
