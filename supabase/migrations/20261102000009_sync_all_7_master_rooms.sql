-- ============================================================================
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

    -- ------------------------------------------------------------------------
    -- KHỐI 3 - PHÒNG 02: Trung tâm xử lí thông tin
    -- ------------------------------------------------------------------------
    SELECT id INTO v_room_id
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id AND grade = 3 AND room_number = 2;

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
            3,
            2,
            'Trung tâm xử lí thông tin',
            'Phòng thí nghiệm xử lí thông tin',
            'SYSTEM_RESTORE',
            'lab_exploration_repair_v1',
            'ready',
            '{"background":"assets/room2_grade3.png","station_count":5,"stage_count":4,"stations_coords":[{"x":28,"y":40},{"x":72,"y":40},{"x":22,"y":69},{"x":78,"y":69},{"x":50,"y":56}],"spawn_point":{"x":50,"y":84},"interaction_radius":17,"restore_percentage_per_stage":25,"unlock_target_room":3}'::jsonb
        ) RETURNING id INTO v_room_id;
        v_rooms_inserted := v_rooms_inserted + 1;
        RAISE NOTICE '  ✅ Đã thêm mới Khối % Phòng 0% (ID: %)', 3, 2, v_room_id;
    ELSE
        -- Phòng đã tồn tại: Tuyệt đối KHÔNG ghi đè topic, theme, passcode Admin đã chỉnh sửa!
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, 'lab_exploration_repair_v1'),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN '{"background":"assets/room2_grade3.png","station_count":5,"stage_count":4,"stations_coords":[{"x":28,"y":40},{"x":72,"y":40},{"x":22,"y":69},{"x":78,"y":69},{"x":50,"y":56}],"spawn_point":{"x":50,"y":84},"interaction_radius":17,"restore_percentage_per_stage":25,"unlock_target_room":3}'::jsonb ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (KHÔNG ghi đè)', 3, 2;
    END IF;

    -- Item: station_0
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
        'station_0',
        'station',
        'single',
        'THU NHẬN THÔNG TIN',
        'Con người thu nhận thông tin từ môi trường xung quanh bằng các giác quan như mắt, tai, mũi, lưỡi và da.',
        'Nhìn thấy đèn đỏ, nghe tiếng chuông vào lớp là những ví dụ về thu nhận thông tin.',
        'Con người thu nhận thông tin bằng 5 giác quan.',
        1,
        NULL,
        '{"icon":"👁️","station_index":0,"theory":"Con người thu nhận thông tin từ môi trường xung quanh bằng các giác quan như mắt, tai, mũi, lưỡi và da.","example":"Nhìn thấy đèn đỏ, nghe tiếng chuông vào lớp là những ví dụ về thu nhận thông tin."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_1
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
        'station_1',
        'station',
        'single',
        'BỘ NÃO XỬ LÍ THÔNG TIN',
        'Bộ não là nơi xử lí thông tin, tạo ra quyết định, điều khiển các suy nghĩ và hành động của con người.',
        'Tai nghe chuông vào lớp → Bộ não xử lí → Em quyết định đi vào lớp.',
        'Bộ não là trung tâm điều khiển và ra quyết định.',
        2,
        NULL,
        '{"icon":"🧠","station_index":1,"theory":"Bộ não là nơi xử lí thông tin, tạo ra quyết định, điều khiển các suy nghĩ và hành động của con người.","example":"Tai nghe chuông vào lớp → Bộ não xử lí → Em quyết định đi vào lớp."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_2
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
        'station_2',
        'station',
        'single',
        'TỪ THÔNG TIN ĐẾN QUYẾT ĐỊNH',
        'Con người: THU NHẬN THÔNG TIN → XỬ LÍ THÔNG TIN → QUYẾT ĐỊNH.',
        'Nhìn thấy trời mưa → Hiểu rằng có thể bị ướt → Quyết định mang áo mưa.',
        'Trình tự: Thu nhận → Xử lí → Quyết định.',
        3,
        NULL,
        '{"icon":"🚦","station_index":2,"theory":"Con người: THU NHẬN THÔNG TIN → XỬ LÍ THÔNG TIN → QUYẾT ĐỊNH.","example":"Nhìn thấy trời mưa → Hiểu rằng có thể bị ướt → Quyết định mang áo mưa."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_3
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
        'station_3',
        'station',
        'single',
        'THIẾT BỊ THÔNG MINH',
        'Có nhiều thiết bị tiếp nhận thông tin để quyết định hành động.',
        'Đèn tự động nhận biết trời tối và bật sáng; cửa tự động phát hiện người đến gần và mở cửa.',
        'Thiết bị thông minh tiếp nhận thông tin để tự động hành động.',
        4,
        NULL,
        '{"icon":"🤖","station_index":3,"theory":"Có nhiều thiết bị tiếp nhận thông tin để quyết định hành động.","example":"Đèn tự động nhận biết trời tối và bật sáng; cửa tự động phát hiện người đến gần và mở cửa."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_0
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
        'stage_0',
        'task',
        'order',
        'THU NHẬN VÀ XỬ LÍ',
        'Bộ xử lí bị lỗi! Hãy sắp xếp đúng trình tự từ thu nhận thông tin đến quyết định.',
        'Sắp xếp: Con người nhìn thấy đèn giao thông màu đỏ.',
        'Thu nhận → Xử lí → Quyết định.',
        5,
        NULL,
        '{"stage_index":0,"items":["Quyết định dừng lại","Nhìn thấy đèn đỏ","Nhận biết đèn đỏ phải dừng"],"correct":[1,2,0],"feedback":"Thu nhận → Xử lí → Quyết định."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_1
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
        'stage_1',
        'task',
        'multi',
        'KÍCH HOẠT BỘ NÃO',
        'Kích hoạt bộ não xử lí thông tin bằng cách xác định các chức năng chính.',
        'Chọn các nhận định đúng về bộ não:',
        'Bộ não có nhiều chức năng, không chỉ nghe âm thanh.',
        6,
        NULL,
        '{"stage_index":1,"answers":["Bộ não là nơi xử lí thông tin","Bộ não tạo ra quyết định","Bộ não điều khiển suy nghĩ và hành động","Bộ não chỉ tiếp nhận âm thanh"],"correct":[0,1,2],"feedback":"Bộ não có nhiều chức năng, không chỉ nghe âm thanh."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_2
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
        'stage_2',
        'task',
        'match',
        'QUYẾT ĐỊNH PHÙ HỢP',
        'Ghép nối các thông tin tiếp nhận được với quyết định hành động tương ứng.',
        'Nối thông tin với quyết định phù hợp',
        'Hãy suy nghĩ em nên làm gì trong tình huống này.',
        7,
        NULL,
        '{"stage_index":2,"left":["🌧️ Trời bắt đầu mưa","⏰ Chuông báo thức reo","💧 Em cảm thấy khát nước"],"right":["🥤 Uống nước","🧥 Mang áo mưa","🌅 Thức dậy"],"correct":[1,2,0],"feedback":"Hãy suy nghĩ em nên làm gì trong tình huống này."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_3
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
        'stage_3',
        'task',
        'match',
        'THIẾT BỊ THÔNG MINH',
        'Hoàn thành chặng cuối để khôi phục 100% hệ thống.',
        'Nối thiết bị với hành động phù hợp',
        'Hãy quan sát thông tin mà từng thiết bị tiếp nhận.',
        8,
        NULL,
        '{"stage_index":3,"left":["💡 Đèn tự động nhận biết trời tối","🚪 Cửa tự động phát hiện người đến gần","🤖 Robot hút bụi phát hiện vật cản"],"right":["↪️ Đổi hướng di chuyển","✨ Bật sáng","🚪 Mở cửa"],"correct":[1,2,0],"feedback":"Hãy quan sát thông tin mà từng thiết bị tiếp nhận."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- KHỐI 4 - PHÒNG 02: Khôi phục hệ thống nhập liệu
    -- ------------------------------------------------------------------------
    SELECT id INTO v_room_id
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id AND grade = 4 AND room_number = 2;

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
            4,
            2,
            'Khôi phục hệ thống nhập liệu',
            'Phòng thí nghiệm nhập liệu',
            'SYSTEM_RESTORE',
            'lab_exploration_repair_v1',
            'ready',
            '{"background":"assets/room2_grade4.png","station_count":5,"stage_count":4,"stations_coords":[{"x":28,"y":40},{"x":72,"y":40},{"x":22,"y":69},{"x":78,"y":69},{"x":50,"y":56}],"spawn_point":{"x":50,"y":84},"interaction_radius":17,"restore_percentage_per_stage":25,"unlock_target_room":3}'::jsonb
        ) RETURNING id INTO v_room_id;
        v_rooms_inserted := v_rooms_inserted + 1;
        RAISE NOTICE '  ✅ Đã thêm mới Khối % Phòng 0% (ID: %)', 4, 2, v_room_id;
    ELSE
        -- Phòng đã tồn tại: Tuyệt đối KHÔNG ghi đè topic, theme, passcode Admin đã chỉnh sửa!
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, 'lab_exploration_repair_v1'),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN '{"background":"assets/room2_grade4.png","station_count":5,"stage_count":4,"stations_coords":[{"x":28,"y":40},{"x":72,"y":40},{"x":22,"y":69},{"x":78,"y":69},{"x":50,"y":56}],"spawn_point":{"x":50,"y":84},"interaction_radius":17,"restore_percentage_per_stage":25,"unlock_target_room":3}'::jsonb ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (KHÔNG ghi đè)', 4, 2;
    END IF;

    -- Item: station_0
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
        'station_0',
        'station',
        'single',
        'LỢI ÍCH GÕ ĐÚNG CÁCH',
        'Gõ bàn phím đúng cách giúp gõ nhanh, chính xác, tiết kiệm thời gian, công sức và góp phần bảo vệ sức khỏe.',
        'Hãy ngồi đúng tư thế, đặt tay đúng vị trí và ưu tiên độ chính xác.',
        'Gõ phím đúng cách bảo vệ sức khỏe và nâng cao tốc độ.',
        1,
        NULL,
        '{"icon":"🌟","station_index":0,"theory":"Gõ bàn phím đúng cách giúp gõ nhanh, chính xác, tiết kiệm thời gian, công sức và góp phần bảo vệ sức khỏe.","example":"Hãy ngồi đúng tư thế, đặt tay đúng vị trí và ưu tiên độ chính xác."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_1
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
        'station_1',
        'station',
        'single',
        'KHÁM PHÁ HÀNG PHÍM SỐ',
        'Ngón út trái: 1; áp út trái: 2; giữa trái: 3; trỏ trái: 4, 5. Ngón trỏ phải: 6, 7; giữa phải: 8; áp út phải: 9; út phải: 0.',
        'Nhấn các phím số bên dưới để xem ngón tay phụ trách.',
        'Ghi nhớ ngón tay phụ trách từng phím số trên hàng phím số.',
        2,
        NULL,
        '{"icon":"⌨️","station_index":1,"theory":"Ngón út trái: 1; áp út trái: 2; giữa trái: 3; trỏ trái: 4, 5. Ngón trỏ phải: 6, 7; giữa phải: 8; áp út phải: 9; út phải: 0.","example":"Nhấn các phím số bên dưới để xem ngón tay phụ trách."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_2
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
        'station_2',
        'station',
        'single',
        'NGÓN TAY TRỞ VỀ ĐÂU?',
        'Khi gõ một phím ở hàng phím số, ngón tay di chuyển từ hàng phím cơ sở lên phím số, sau đó trở về vị trí xuất phát.',
        'Hai ngón trỏ đặt tại F và J; sau khi gõ phím số 3, ngón giữa trái trở về phím D.',
        'Luôn đưa ngón tay trở về hàng phím cơ sở sau khi gõ.',
        3,
        NULL,
        '{"icon":"🖐️","station_index":2,"theory":"Khi gõ một phím ở hàng phím số, ngón tay di chuyển từ hàng phím cơ sở lên phím số, sau đó trở về vị trí xuất phát.","example":"Hai ngón trỏ đặt tại F và J; sau khi gõ phím số 3, ngón giữa trái trở về phím D."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_3
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
        'station_3',
        'station',
        'single',
        'LUYỆN GÕ VĂN BẢN',
        'Gõ đúng chữ, số, dấu cách; sử dụng Caps Lock hoặc Shift khi cần viết chữ hoa.',
        'Em có thể thực hành không dấu; gõ chính xác quan trọng hơn gõ nhanh.',
        'Ưu tiên độ chính xác trước khi rèn luyện tốc độ.',
        4,
        NULL,
        '{"icon":"📝","station_index":3,"theory":"Gõ đúng chữ, số, dấu cách; sử dụng Caps Lock hoặc Shift khi cần viết chữ hoa.","example":"Em có thể thực hành không dấu; gõ chính xác quan trọng hơn gõ nhanh."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_0
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
        'stage_0',
        'task',
        'single',
        'BỘ ĐIỀU KHIỂN NGÓN TAY',
        'Quan sát hai bàn tay và nhấn trực tiếp vào ngón tay phụ trách phím số tương ứng.',
        'Chọn ngón tay gõ các phím số: 4, 8, 1, 0, 6',
        'Nhớ vị trí ngón tay phụ trách phím số trên hàng phím cơ sở.',
        5,
        NULL,
        '{"stage_index":0,"task_mode":"fingers","digits":[4,8,1,0,6],"correct":["Trỏ trái","Giữa phải","Út trái","Út phải","Trỏ phải"],"feedback":"Chính xác! Em đã thành thạo phân công ngón tay gõ phím số."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_1
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
        'stage_1',
        'task',
        'single',
        'SỬA HÀNG PHÍM SỐ',
        'Luyện gõ các dãy số để phục hồi hệ thống mạch phím số.',
        'Gõ chính xác các dãy số theo mẫu',
        'Hãy kiểm tra thứ tự từng phím số.',
        6,
        NULL,
        '{"stage_index":1,"task_mode":"typing","lines":["13579","24680","1234567890"],"tip":"Hãy kiểm tra thứ tự từng phím số.","feedback":"Xuất sắc! Hàng phím số đã được khôi phục."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_2
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
        'stage_2',
        'task',
        'single',
        'NHẬP VĂN BẢN',
        'Luyện gõ các dòng thơ không dấu để phục hồi bộ đệm nhập liệu.',
        'Gõ đoạn thơ theo mẫu (không dấu)',
        'Đối chiếu từng chữ, dấu cách và dấu chấm.',
        7,
        NULL,
        '{"stage_index":2,"task_mode":"typing","lines":["Lam anh that kho","Nhung ma that vui","Ai yeu em be","Thi lam duoc thoi."],"tip":"Đối chiếu từng chữ, dấu cách và dấu chấm.","feedback":"Tuyệt vời! Đoạn văn bản đã được nhập chính xác."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_3
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
        'stage_3',
        'task',
        'single',
        'KÍCH HOẠT NHẬP LIỆU',
        'Nhập các số điện thoại khẩn cấp quan trọng để kích hoạt 100% hệ thống.',
        'Nhập các số điện thoại khẩn cấp',
        'Kiểm tra số, chữ, dấu phẩy và khoảng trắng.',
        8,
        NULL,
        '{"stage_index":3,"task_mode":"typing","lines":["111 - Bao ve tre em","112 - Tim kiem, cuu nan","113 - Cong an","114 - Cuu hoa","115 - Cap cuu"],"tip":"Kiểm tra số, chữ, dấu phẩy và khoảng trắng.","feedback":"Hoàn thành xuất sắc! Hệ thống nhập liệu đã khôi phục 100%."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- KHỐI 5 - PHÒNG 02: Khôi phục kho tri thức số
    -- ------------------------------------------------------------------------
    SELECT id INTO v_room_id
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id AND grade = 5 AND room_number = 2;

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
            5,
            2,
            'Khôi phục kho tri thức số',
            'Kho tri thức số',
            'SYSTEM_RESTORE',
            'lab_exploration_repair_v1',
            'ready',
            '{"background":"assets/room2_grade5.png","station_count":5,"stage_count":4,"stations_coords":[{"x":28,"y":40},{"x":72,"y":40},{"x":22,"y":69},{"x":78,"y":69},{"x":50,"y":56}],"spawn_point":{"x":50,"y":84},"interaction_radius":17,"restore_percentage_per_stage":25,"unlock_target_room":3}'::jsonb
        ) RETURNING id INTO v_room_id;
        v_rooms_inserted := v_rooms_inserted + 1;
        RAISE NOTICE '  ✅ Đã thêm mới Khối % Phòng 0% (ID: %)', 5, 2, v_room_id;
    ELSE
        -- Phòng đã tồn tại: Tuyệt đối KHÔNG ghi đè topic, theme, passcode Admin đã chỉnh sửa!
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, 'lab_exploration_repair_v1'),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN '{"background":"assets/room2_grade5.png","station_count":5,"stage_count":4,"stations_coords":[{"x":28,"y":40},{"x":72,"y":40},{"x":22,"y":69},{"x":78,"y":69},{"x":50,"y":56}],"spawn_point":{"x":50,"y":84},"interaction_radius":17,"restore_percentage_per_stage":25,"unlock_target_room":3}'::jsonb ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (KHÔNG ghi đè)', 5, 2;
    END IF;

    -- Item: station_0
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
        'station_0',
        'station',
        'single',
        'GIẢI MÃ GIAO DIỆN WEBSITE',
        'Trang chủ là trang xuất hiện đầu tiên khi truy cập website. Các chủ đề giúp duyệt nội dung; nút kính lúp mở chức năng tìm kiếm.',
        'Nhấn vào các nút trong website mô phỏng để khám phá.',
        'Trang chủ, Chủ đề và Tìm kiếm là các thành phần cơ bản của website.',
        1,
        NULL,
        '{"icon":"🌐","station_index":0,"theory":"Trang chủ là trang xuất hiện đầu tiên khi truy cập website. Các chủ đề giúp duyệt nội dung; nút kính lúp mở chức năng tìm kiếm.","example":"Nhấn vào các nút trong website mô phỏng để khám phá."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_1
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
        'station_1',
        'station',
        'single',
        'THÁM TỬ TÌM KIẾM',
        'Có hai cách tìm thông tin trong website: duyệt theo các chủ đề hoặc sử dụng công cụ tìm kiếm của chính website.',
        'Nhập từ khóa rõ ràng và đọc tiêu đề kết quả để chọn bài viết phù hợp.',
        'Chọn từ khóa ngắn gọn, chính xác liên quan đến nội dung cần tìm.',
        2,
        NULL,
        '{"icon":"🔎","station_index":1,"theory":"Có hai cách tìm thông tin trong website: duyệt theo các chủ đề hoặc sử dụng công cụ tìm kiếm của chính website.","example":"Nhập từ khóa rõ ràng và đọc tiêu đề kết quả để chọn bài viết phù hợp."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_2
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
        'station_2',
        'station',
        'single',
        'TRUNG TÂM CHIA SẺ TRI THỨC',
        'Các thành viên cần hợp tác, chia sẻ thông tin để hoàn thành công việc chung. Có thể chia sẻ tệp qua thư điện tử, mạng xã hội hoặc thiết bị lưu trữ.',
        'Tìm kiếm → Đọc và chọn lọc → Lưu trữ → Chia sẻ.',
        'Hợp tác và chia sẻ thông tin giúp giải quyết nhiệm vụ chung hiệu quả.',
        3,
        NULL,
        '{"icon":"📁","station_index":2,"theory":"Các thành viên cần hợp tác, chia sẻ thông tin để hoàn thành công việc chung. Có thể chia sẻ tệp qua thư điện tử, mạng xã hội hoặc thiết bị lưu trữ.","example":"Tìm kiếm → Đọc và chọn lọc → Lưu trữ → Chia sẻ."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_3
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
        'station_3',
        'station',
        'single',
        'TRẠM TRUYỀN DỮ LIỆU USB',
        'USB có thể dùng để sao chép và chuyển tệp giữa các máy tính. Sau khi sao chép xong, cần ngắt kết nối an toàn trước khi rút USB.',
        'Kết nối → Sao chép → Dán → Eject (ngắt kết nối an toàn) → Rút USB.',
        'Luôn chọn Eject để ngắt kết nối USB an toàn trước khi rút ra khỏi máy.',
        4,
        NULL,
        '{"icon":"💾","station_index":3,"theory":"USB có thể dùng để sao chép và chuyển tệp giữa các máy tính. Sau khi sao chép xong, cần ngắt kết nối an toàn trước khi rút USB.","example":"Kết nối → Sao chép → Dán → Eject (ngắt kết nối an toàn) → Rút USB."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_0
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
        'stage_0',
        'task',
        'single',
        'CẤU TRÚC WEBSITE',
        'Hệ thống đã mất các nút điều hướng. Chọn chức năng ở bên dưới rồi nhấn vào vị trí thích hợp trên thanh website.',
        'Gắn lại ba nút bị mất trên thanh điều hướng website',
        'Trang chủ ở đầu, Chủ đề ở giữa, Tìm kiếm ở cuối.',
        5,
        NULL,
        '{"stage_index":0,"task_mode":"website","entries":[["🏠","TRANG CHỦ","home"],["📚","CHỦ ĐỀ","topics"],["🔍","TÌM KIẾM","search"]],"feedback":"Chính xác! Giao diện website đã được gắn đủ các nút điều hướng."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_1
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
        'stage_1',
        'task',
        'single',
        'TRUY TÌM TÀI LIỆU',
        'Máy chủ cần khôi phục bài viết “Cách phòng tránh đuối nước” trong website Tri thức học đường.',
        'Tìm kiếm bài viết và chọn thông tin đúng để lưu vào kho tri thức',
        'Dùng từ khóa liên quan đến đuối nước hoặc vào chuyên mục Kĩ năng sống.',
        6,
        NULL,
        '{"stage_index":1,"task_mode":"search","article_title":"Cách phòng tránh đuối nước","category":"KĨ NĂNG SỐNG","keywords":["duoi nuoc","phong tranh"],"question":"Chọn thông tin đúng để lưu vào kho tri thức:","answers":["Gọi người lớn và lực lượng cứu hộ khi có người gặp nạn","Tự nhảy xuống nước để cứu người"],"correct":0,"feedback":"Xuất sắc! Em đã tìm đúng bài viết và lựa chọn hành động an toàn."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_2
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
        'stage_2',
        'task',
        'multi',
        'KHO DỮ LIỆU CHUNG',
        'Nhóm cần chuẩn bị bài giới thiệu Ngày hội Trạng Nguyên nhỏ tuổi. Hãy chọn 3 tệp phù hợp để đưa vào thư mục chung.',
        'Chọn 3 tệp liên quan đến dự án Ngày hội Trạng Nguyên nhỏ tuổi:',
        'Chỉ chọn các tệp phục vụ cho nội dung ngày hội, bỏ qua tin quảng cáo và kết quả bóng đá.',
        7,
        NULL,
        '{"stage_index":2,"task_mode":"share","files":["📄 Tin quảng cáo đồ chơi","📄 Kết quả bóng đá","📄 Thời gian tổ chức ngày hội","🖼️ Hình ảnh hoạt động ngày hội","📄 Nội dung các hoạt động ngày hội"],"answers":["Tin quảng cáo đồ chơi","Kết quả bóng đá","Thời gian tổ chức ngày hội","Hình ảnh hoạt động ngày hội","Nội dung các hoạt động ngày hội"],"correct":[2,3,4],"feedback":"Tuyệt vời! Thư mục dự án chung đã lưu đúng 3 tệp cần thiết."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: stage_3
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
        'stage_3',
        'task',
        'single',
        'CHIA SẺ QUA USB',
        'Máy chủ sắp ngừng hoạt động! Thực hiện quy trình cứu dữ liệu dự án Bảo vệ môi trường xanh sang máy tính dự phòng bằng USB an toàn.',
        'Thực hiện đúng quy trình cứu dữ liệu qua USB: Chọn tệp -> Sao chép -> Eject an toàn -> Chuyển sang máy dự phòng',
        'Nhớ chọn Eject ngắt kết nối an toàn trước khi rút USB.',
        8,
        NULL,
        '{"stage_index":3,"task_mode":"usb_rescue","files":[["BaoVeMoiTruong.docx","📄",true],["BongDa.docx","⚽",false],["HinhAnhMoiTruong.png","🖼️",true],["TroChoi.exe","🎮",false],["GhiChuCaNhan.txt","📝",false],["NhacNen.mp3","🎵",false]],"needed_indices":[0,2],"feedback":"Hoàn thành xuất sắc! Em đã cứu dữ liệu thành công và thực hành ngắt USB an toàn."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- KHỐI 3 - PHÒNG 03: Học sinh và mê cung máy tính
    -- ------------------------------------------------------------------------
    SELECT id INTO v_room_id
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id AND grade = 3 AND room_number = 3;

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
            3,
            3,
            'Học sinh và mê cung máy tính',
            'Phòng thí nghiệm mê cung máy tính',
            'MAZE_SOLVED',
            'computer_maze_adventure_v1',
            'ready',
            '{"background":"assets/room3_maze.png","stage_count":4,"devices_coords":[{"name":"Màn hình","x":31,"y":42,"file":"01_man_hinh.png","working":true},{"name":"Thân máy","x":58,"y":42,"file":"02_than_may.png","working":true},{"name":"Bàn phím","x":5.4,"y":37,"file":"03_ban_phim.png","working":true},{"name":"Chuột","x":65,"y":45,"file":"04_chuot.png","working":true},{"name":"Loa","x":94,"y":34,"file":"05_loa.png","working":true},{"name":"Máy in","x":68.2,"y":43,"file":"06_may_in.png","working":true},{"name":"Tai nghe","x":96.1,"y":43,"file":"07_tai_nghe.png","working":true},{"name":"Webcam","x":38,"y":44.5,"file":"08_webcam.png","working":true}],"interact_radius":8,"unlock_target_room":4}'::jsonb
        ) RETURNING id INTO v_room_id;
        v_rooms_inserted := v_rooms_inserted + 1;
        RAISE NOTICE '  ✅ Đã thêm mới Khối % Phòng 0% (ID: %)', 3, 3, v_room_id;
    ELSE
        -- Phòng đã tồn tại: Tuyệt đối KHÔNG ghi đè topic, theme, passcode Admin đã chỉnh sửa!
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, 'computer_maze_adventure_v1'),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN '{"background":"assets/room3_maze.png","stage_count":4,"devices_coords":[{"name":"Màn hình","x":31,"y":42,"file":"01_man_hinh.png","working":true},{"name":"Thân máy","x":58,"y":42,"file":"02_than_may.png","working":true},{"name":"Bàn phím","x":5.4,"y":37,"file":"03_ban_phim.png","working":true},{"name":"Chuột","x":65,"y":45,"file":"04_chuot.png","working":true},{"name":"Loa","x":94,"y":34,"file":"05_loa.png","working":true},{"name":"Máy in","x":68.2,"y":43,"file":"06_may_in.png","working":true},{"name":"Tai nghe","x":96.1,"y":43,"file":"07_tai_nghe.png","working":true},{"name":"Webcam","x":38,"y":44.5,"file":"08_webcam.png","working":true}],"interact_radius":8,"unlock_target_room":4}'::jsonb ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (KHÔNG ghi đè)', 3, 3;
    END IF;

    -- Item: area_assembly
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
        'area_assembly',
        'task',
        'sequence',
        'BÀN LẮP RÁP MÁY TÍNH',
        'Chọn đúng bộ phận theo chức năng để lắp thành bộ máy tính hoàn chỉnh.',
        'Xác định chức năng 4 bộ phận cơ bản của máy tính để bàn:',
        'Màn hình hiển thị; Thân máy xử lí; Bàn phím nhập chữ; Chuột điều khiển con trỏ.',
        1,
        NULL,
        '{"zone_index":0,"items":[{"question":"Thiết bị hiển thị kết quả làm việc?","answers":["Màn hình","Thân máy","Bàn phím","Chuột"],"correct":0},{"question":"Bộ phận chứa bộ xử lí điều khiển máy tính?","answers":["Màn hình","Thân máy","Bàn phím","Chuột"],"correct":1},{"question":"Thiết bị nhập chữ vào máy tính?","answers":["Màn hình","Thân máy","Bàn phím","Chuột"],"correct":2},{"question":"Thiết bị giúp điều khiển máy tính thuận tiện?","answers":["Màn hình","Thân máy","Bàn phím","Chuột"],"correct":3}],"feedback":"Chúc mừng! Em đã lắp ráp thành công bộ máy tính hoàn chỉnh."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_touchpad
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
        'station_touchpad',
        'task',
        'single',
        'HỆ THỐNG AN NINH (TOUCHPAD)',
        'Hệ thống an ninh đang bị khóa! Laptop không có chuột rời. Em hãy sử dụng vùng cảm ứng chuột để điều khiển con trỏ đến ổ khóa.',
        'Kéo con trỏ chuột trên Touchpad vào ổ khóa trên màn hình',
        'Vùng cảm ứng chuột (touchpad) giúp điều khiển con trỏ trên laptop mà không cần chuột rời.',
        2,
        NULL,
        '{"zone_index":1,"device_type":"laptop","feedback":"Vùng cảm ứng chuột (touchpad) giúp điều khiển con trỏ trên laptop mà không cần chuột rời."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_light
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
        'station_light',
        'task',
        'single',
        'HỆ THỐNG CHIẾU SÁNG (MÀN CẢM ỨNG)',
        'Hành lang đang thiếu ánh sáng! Em hãy chạm vào biểu tượng bóng đèn trên màn hình cảm ứng của máy tính bảng.',
        'Chạm vào biểu tượng bóng đèn trên màn hình cảm ứng máy tính bảng',
        'Máy tính bảng có màn hình cảm ứng: em chạm trực tiếp vào biểu tượng để thực hiện lệnh.',
        3,
        NULL,
        '{"zone_index":1,"device_type":"tablet","feedback":"Máy tính bảng có màn hình cảm ứng: em chạm trực tiếp vào biểu tượng để thực hiện lệnh."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: station_auth
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
        'station_auth',
        'task',
        'single',
        'HỆ THỐNG XÁC THỰC (BÀN PHÍM ẢO)',
        'Hệ thống cần xác nhận quyền truy cập. Em hãy dùng bàn phím ảo của điện thoại thông minh để nhập mật mã BYTE.',
        'Nhập đúng mã B-Y-T-E trên bàn phím ảo điện thoại thông minh',
        'Điện thoại thông minh có bàn phím ảo giúp nhập chữ bằng cách chạm vào màn hình.',
        4,
        NULL,
        '{"zone_index":1,"device_type":"smartphone","target_code":"BYTE","feedback":"Điện thoại thông minh có bàn phím ảo giúp nhập chữ bằng cách chạm vào màn hình."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: area_conveyor
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
        'area_conveyor',
        'task',
        'match',
        'BĂNG CHUYỀN PHÂN LOẠI THIẾT BỊ',
        'Hãy kéo thiết bị đang chạy trên băng chuyền vào khu vực đúng với chức năng của nó.',
        'Nối thiết bị với chức năng tương ứng trên băng chuyền:',
        'Bàn phím nhập; Màn hình hiển thị; Loa phát âm thanh; Chuột điều khiển con trỏ; Máy in in ra giấy.',
        5,
        NULL,
        '{"zone_index":2,"left":["⌨️ Bàn phím","🖥️ Màn hình","🔊 Loa","🖱️ Chuột","🖨️ Máy in"],"right":["Nhập thông tin","Hiển thị thông tin","Phát âm thanh","Điều khiển con trỏ","In ra giấy"],"correct":[0,1,2,3,4],"tips":["Bàn phím dùng để nhập chữ, số và kí hiệu.","Màn hình hiển thị hình ảnh, chữ và kết quả làm việc.","Loa giúp nghe âm thanh từ máy tính.","Chuột giúp di chuyển con trỏ và lựa chọn đối tượng.","Máy in đưa thông tin từ máy tính ra giấy."],"feedback":"Em đã phân loại đúng 5 thiết bị theo chức năng trên băng chuyền!"}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: hazard_socket
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
        'hazard_socket',
        'task',
        'single',
        'Ổ CẮM ĐIỆN BỊ LỎNG',
        'Phát hiện nguy cơ mất an toàn tại ổ cắm điện trong phòng máy.',
        'Khi thấy ổ cắm điện bị lỏng, em nên làm gì?',
        'Không tự ý xử lí các sự cố về điện; luôn báo người lớn.',
        6,
        NULL,
        '{"zone_index":3,"hazard_index":0,"answers":["Báo thầy cô hoặc người lớn","Tự cắm lại dây điện"],"correct":0,"feedback":"Đúng! Khi có nguy cơ về điện, tuyệt đối không tự ý xử lí mà phải báo thầy cô."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: hazard_water
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
        'hazard_water',
        'task',
        'single',
        'CỐC NƯỚC CẠNH MÁY TÍNH',
        'Phát hiện cốc nước đặt cạnh bàn phím máy tính.',
        'Khi thấy cốc nước cạnh máy tính, hành động an toàn là gì?',
        'Nước đổ vào máy tính có thể gây chập điện và hỏng thiết bị.',
        7,
        NULL,
        '{"zone_index":3,"hazard_index":1,"answers":["Giữ đồ uống cách xa máy tính","Tiếp tục để cốc nước bên cạnh"],"correct":0,"feedback":"Chính xác! Luôn để đồ uống và thức ăn cách xa máy tính để phòng ngừa đổ nước."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: hazard_dust
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
        'hazard_dust',
        'task',
        'single',
        'BÀN PHÍM BÁM BỤI',
        'Phát hiện bàn phím máy tính bám nhiều bụi bẩn sau thời gian dài sử dụng.',
        'Khi thấy bàn phím bám bụi bẩn, em nên vệ sinh thế nào?',
        'Dùng chổi phủi bụi chuyên dụng hoặc khăn mềm khô, tuyệt đối không dùng khăn ướt.',
        8,
        NULL,
        '{"zone_index":3,"hazard_index":2,"answers":["Dùng chổi phủi bụi hoặc khăn mềm phù hợp","Dùng khăn ướt lau bàn phím"],"correct":0,"feedback":"Chính xác! Dùng chổi phủi bụi hoặc khăn mềm khô để tránh nước lọt vào bàn phím."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

    -- Item: hazard_cable
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
        'hazard_cable',
        'task',
        'single',
        'DÂY ĐIỆN KHÔNG AN TOÀN',
        'Phát hiện dây điện cắm không an toàn hoặc bị hở trong phòng máy.',
        'Khi phát hiện dây điện không an toàn, em xử lí thế nào?',
        'Không chạm vào dây điện; báo ngay cho giáo viên quản lý phòng máy.',
        9,
        NULL,
        '{"zone_index":3,"hazard_index":3,"answers":["Không tự ý chạm vào dây điện; báo giáo viên","Tự kéo dây điện để sửa"],"correct":0,"feedback":"Rất tốt! Luôn ghi nhớ quy tắc an toàn điện trong phòng máy tính."}'::jsonb
    )
    ON CONFLICT (room_id, item_key) DO NOTHING;

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
