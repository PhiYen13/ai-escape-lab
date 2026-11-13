-- ============================================================================
-- Migration 14: Cập nhật phòng mới từ MASTER vào bộ đề đã sao chép của giáo viên
-- File: supabase/migrations/20261102000014_import_rooms_from_master.sql
-- ============================================================================

-- 1. HÀM ĐỐI CHIẾU VÀ TRẢ VỀ DANH SÁCH PHÒNG CÒN THIẾU TỪ MASTER ĐÃ XUẤT BẢN
CREATE OR REPLACE FUNCTION public.get_master_missing_rooms(p_target_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
    v_master_pub RECORD;
    v_room_elem JSONB;
    v_grade INT;
    v_room_num INT;
    v_status TEXT;
    v_missing_rooms JSONB := '[]'::jsonb;
    v_total_master_rooms INT := 0;
    v_total_target_rooms INT := 0;
BEGIN
    -- 1. Bắt buộc đăng nhập và đã được phê duyệt
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập để kiểm tra cập nhật phòng!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản chưa được phê duyệt!';
    END IF;

    -- 2. Kiểm tra bộ đề đích
    SELECT * INTO v_target FROM public.campaigns WHERE id = p_target_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chiến dịch đích không tồn tại!';
    END IF;

    -- Nếu là bộ MASTER hoặc template thì không cần cập nhật từ chính nó
    IF v_target.is_template = TRUE OR v_target.share_code = 'MASTER' THEN
        RETURN jsonb_build_object(
            'target_campaign_id', p_target_campaign_id,
            'is_master', true,
            'missing_count', 0,
            'missing_rooms', '[]'::jsonb,
            'is_up_to_date', true
        );
    END IF;

    -- Kiểm tra quyền: chỉ chủ sở hữu hoặc admin
    IF v_target.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn chỉ có quyền kiểm tra bộ đề do chính mình sở hữu!';
    END IF;

    SELECT COUNT(*) INTO v_total_target_rooms
    FROM public.campaign_rooms
    WHERE campaign_id = p_target_campaign_id;

    -- 3. Lấy bản snapshot đã xuất bản mới nhất của MASTER
    SELECT * INTO v_master_pub 
    FROM public.published_campaigns 
    WHERE share_code = 'MASTER';

    IF NOT FOUND OR v_master_pub.published_payload IS NULL OR v_master_pub.published_payload->'rooms' IS NULL THEN
        RETURN jsonb_build_object(
            'target_campaign_id', p_target_campaign_id,
            'is_master', false,
            'missing_count', 0,
            'missing_rooms', '[]'::jsonb,
            'total_target_rooms', v_total_target_rooms,
            'total_master_rooms', 0,
            'is_up_to_date', true
        );
    END IF;

    -- 4. So sánh danh sách phòng chơi được trong MASTER với draft của target
    FOR v_room_elem IN SELECT * FROM jsonb_array_elements(v_master_pub.published_payload->'rooms')
    LOOP
        v_grade := (v_room_elem->>'grade')::int;
        v_room_num := (v_room_elem->>'room_number')::int;
        v_status := COALESCE(v_room_elem->>'development_status', 'ready');

        -- Chỉ xét các phòng thuộc khối 3, 4, 5 và có trạng thái ready hoặc completed
        IF v_grade IN (3, 4, 5) AND v_status IN ('ready', 'completed') THEN
            v_total_master_rooms := v_total_master_rooms + 1;

            -- Kiểm tra xem bộ đích đã có cặp (grade, room_number) này chưa
            IF NOT EXISTS (
                SELECT 1 FROM public.campaign_rooms 
                WHERE campaign_id = p_target_campaign_id 
                  AND grade = v_grade 
                  AND room_number = v_room_num
            ) THEN
                v_missing_rooms := v_missing_rooms || jsonb_build_array(
                    jsonb_build_object(
                        'grade', v_grade,
                        'room_number', v_room_num,
                        'topic', COALESCE(v_room_elem->>'topic', 'Phòng ' || v_room_num),
                        'development_status', v_status,
                        'item_count', jsonb_array_length(COALESCE(v_room_elem->'items', '[]'::jsonb))
                    )
                );
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'target_campaign_id', p_target_campaign_id,
        'is_master', false,
        'missing_count', jsonb_array_length(v_missing_rooms),
        'missing_rooms', v_missing_rooms,
        'total_target_rooms', v_total_target_rooms,
        'total_master_rooms', v_total_master_rooms,
        'is_up_to_date', (jsonb_array_length(v_missing_rooms) = 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_master_missing_rooms(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_master_missing_rooms(UUID) TO authenticated;


-- 2. HÀM NHẬP PHÒNG CÒN THIẾU TỪ MASTER VÀO BẢN NHÁP BỘ ĐỀ ĐÍCH
CREATE OR REPLACE FUNCTION public.import_rooms_from_master(
    p_target_campaign_id UUID,
    p_room_keys JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
    v_master_pub RECORD;
    v_pub_room JSONB;
    v_pub_item JSONB;
    v_grade INT;
    v_room_num INT;
    v_status TEXT;
    v_new_room_id UUID;
    v_added_count INT := 0;
    v_added_rooms JSONB := '[]'::jsonb;
    v_should_add BOOLEAN;
    v_key_item JSONB;
BEGIN
    -- 1. Bắt buộc đăng nhập và đã phê duyệt
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi cập nhật phòng!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt để thực hiện thao tác này!';
    END IF;

    -- 2. Kiểm tra bộ đề đích
    SELECT * INTO v_target FROM public.campaigns WHERE id = p_target_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chiến dịch đích không tồn tại!';
    END IF;

    -- Tuyệt đối không cho phép cập nhật vào bộ đề gốc MASTER
    IF v_target.is_template = TRUE OR v_target.share_code = 'MASTER' THEN
        RAISE EXCEPTION 'Không thể cập nhật phòng vào bộ đề gốc MASTER!';
    END IF;

    -- Kiểm tra quyền sở hữu: chỉ chủ sở hữu hoặc admin
    IF v_target.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn chỉ có quyền cập nhật bộ đề thuộc quyền sở hữu của chính mình!';
    END IF;

    -- 3. Lấy bản snapshot đã xuất bản của MASTER
    SELECT * INTO v_master_pub 
    FROM public.published_campaigns 
    WHERE share_code = 'MASTER';

    IF NOT FOUND OR v_master_pub.published_payload IS NULL OR v_master_pub.published_payload->'rooms' IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy phiên bản MASTER đã xuất bản để sao chép!';
    END IF;

    -- Bật cờ cho phép tạo phòng và vật phẩm cấu trúc chuẩn từ MASTER
    PERFORM set_config('app.in_clone_campaign', 'true', true);

    -- 4. Lặp qua các phòng trong MASTER đã xuất bản
    FOR v_pub_room IN SELECT * FROM jsonb_array_elements(v_master_pub.published_payload->'rooms')
    LOOP
        v_grade := (v_pub_room->>'grade')::int;
        v_room_num := (v_pub_room->>'room_number')::int;
        v_status := COALESCE(v_pub_room->>'development_status', 'ready');

        -- Chỉ xét các phòng hợp lệ (khối 3, 4, 5 và ready/completed)
        IF v_grade NOT IN (3, 4, 5) OR v_status NOT IN ('ready', 'completed') THEN
            CONTINUE;
        END IF;

        -- Kiểm tra xem phòng này có nằm trong danh sách giáo viên chọn hay không
        IF p_room_keys IS NOT NULL AND jsonb_array_length(p_room_keys) > 0 THEN
            v_should_add := FALSE;
            FOR v_key_item IN SELECT * FROM jsonb_array_elements(p_room_keys)
            LOOP
                -- Dạng object: {"grade": 3, "room_number": 2}
                IF (v_key_item ? 'grade') AND (v_key_item ? 'room_number') THEN
                    IF (v_key_item->>'grade')::int = v_grade AND (v_key_item->>'room_number')::int = v_room_num THEN
                        v_should_add := TRUE;
                        EXIT;
                    END IF;
                -- Dạng string: "3-2"
                ELSIF jsonb_typeof(v_key_item) = 'string' AND (v_key_item #>> '{}') = (v_grade || '-' || v_room_num) THEN
                    v_should_add := TRUE;
                    EXIT;
                END IF;
            END LOOP;

            IF NOT v_should_add THEN
                CONTINUE;
            END IF;
        END IF;

        -- KIỂM TRA LẠI: Bỏ qua mọi phòng mà bộ đích ĐÃ CÓ cặp (grade, room_number)
        IF EXISTS (
            SELECT 1 FROM public.campaign_rooms 
            WHERE campaign_id = p_target_campaign_id 
              AND grade = v_grade 
              AND room_number = v_room_num
        ) THEN
            CONTINUE;
        END IF;

        -- 5. Sao chép phòng mới vào campaign_rooms với cơ chế ON CONFLICT DO NOTHING chống trùng lặp
        INSERT INTO public.campaign_rooms (
            campaign_id,
            room_number,
            grade,
            topic,
            passcode,
            theme,
            accent_color,
            metadata,
            module_id,
            development_status,
            engine_config
        ) VALUES (
            p_target_campaign_id,
            v_room_num,
            v_grade,
            COALESCE(v_pub_room->>'topic', 'Phòng ' || v_room_num),
            COALESCE(v_pub_room->>'code', v_pub_room->>'passcode', '1234'),
            COALESCE(v_pub_room->>'theme', 'cyber'),
            COALESCE(v_pub_room->>'accent', v_pub_room->>'accent_color', '#00e5ff'),
            COALESCE(v_pub_room->'metadata', '{}'::jsonb),
            COALESCE(v_pub_room->>'module_id', 'escape_room_point_click_v1'),
            COALESCE(v_pub_room->>'development_status', 'ready'),
            COALESCE(v_pub_room->'engine_config', '{}'::jsonb)
        )
        ON CONFLICT (campaign_id, room_number, grade) DO NOTHING
        RETURNING id INTO v_new_room_id;

        -- Nếu xung đột đã xảy ra hoặc phòng vừa được thêm bởi tiến trình song song
        IF v_new_room_id IS NULL THEN
            CONTINUE;
        END IF;

        -- 6. Sao chép đầy đủ các vật phẩm / câu hỏi thuộc phòng này
        FOR v_pub_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pub_room->'items', '[]'::jsonb))
        LOOP
            INSERT INTO public.room_items (
                room_id,
                item_key,
                item_type,
                kind,
                title,
                intro,
                question,
                digit,
                hint,
                content_payload,
                sort_order
            ) VALUES (
                v_new_room_id,
                v_pub_item->>'item_key',
                COALESCE(v_pub_item->>'item_type', 'task'),
                COALESCE(v_pub_item->>'kind', 'single'),
                COALESCE(v_pub_item->>'title', 'Thử thách'),
                COALESCE(v_pub_item->>'intro', ''),
                COALESCE(v_pub_item->>'question', ''),
                v_pub_item->>'digit',
                COALESCE(v_pub_item->>'hint', ''),
                COALESCE(v_pub_item->'content_payload', '{}'::jsonb),
                COALESCE((v_pub_item->>'sort_order')::int, 0)
            );
        END LOOP;

        v_added_count := v_added_count + 1;
        v_added_rooms := v_added_rooms || jsonb_build_array(
            jsonb_build_object(
                'grade', v_grade,
                'room_number', v_room_num,
                'topic', v_pub_room->>'topic'
            )
        );
    END LOOP;

    -- Tắt cờ bảo vệ sau khi hoàn tất sao chép
    PERFORM set_config('app.in_clone_campaign', 'false', true);

    -- Cập nhật thời gian sửa đổi bản nháp của bộ đề đích nếu có thêm phòng
    IF v_added_count > 0 THEN
        UPDATE public.campaigns 
        SET updated_at = NOW() 
        WHERE id = p_target_campaign_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'target_campaign_id', p_target_campaign_id,
        'added_count', v_added_count,
        'added_rooms', v_added_rooms
    );
END;
$$;

REVOKE ALL ON FUNCTION public.import_rooms_from_master(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_rooms_from_master(UUID, JSONB) TO authenticated;
