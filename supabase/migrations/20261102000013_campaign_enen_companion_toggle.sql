-- Migration 13: Bổ sung công tắc Én Én đồng hành (enen_enabled) cho từng bản trò chơi cá nhân
-- 1. Bổ sung cột enen_enabled vào public.campaigns (mặc định FALSE)
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS enen_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Hàm RPC chuyên biệt cập nhật trạng thái enen_enabled với kiểm tra quyền sở hữu nghiêm ngặt
CREATE OR REPLACE FUNCTION public.set_campaign_enen_enabled(p_campaign_id UUID, p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_camp RECORD;
    v_val BOOLEAN := COALESCE(p_enabled, FALSE);
BEGIN
    -- 1. Bắt buộc đăng nhập
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập để cập nhật cài đặt!';
    END IF;

    -- 2. Lấy thông tin campaign
    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chiến dịch không tồn tại!';
    END IF;

    -- 3. Kiểm tra MASTER: Chỉ Quản trị viên (Admin) mới có quyền bật/tắt trên bộ đề gốc MASTER
    IF (v_camp.is_template = TRUE OR v_camp.share_code = 'MASTER') AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Không thể sửa MASTER! Chỉ Quản trị viên (Admin) mới có quyền bật/tắt Én Én trên bộ đề gốc MASTER.';
    END IF;

    -- 4. Kiểm tra quyền sở hữu: teacher_id = auth.uid() (hoặc Admin hệ thống)
    IF v_camp.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn không có quyền chỉnh sửa bộ đề của giáo viên khác!';
    END IF;

    -- 5. Cập nhật enen_enabled
    UPDATE public.campaigns
    SET enen_enabled = v_val,
        updated_at = NOW()
    WHERE id = p_campaign_id;

    RETURN v_val;
END;
$$;

REVOKE ALL ON FUNCTION public.set_campaign_enen_enabled(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_campaign_enen_enabled(UUID, BOOLEAN) TO authenticated;

-- 3. Cập nhật hàm publish_campaign để lưu snapshot enen_enabled vào published_payload
CREATE OR REPLACE FUNCTION public.publish_campaign(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_camp RECORD;
    v_room RECORD;
    v_item RECORD;
    v_rooms_json JSONB := '[]'::jsonb;
    v_room_json JSONB;
    v_items_arr JSONB;
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_item_data JSONB;
    v_published_payload JSONB;
    v_new_version INT;
    v_enen_enabled BOOLEAN := FALSE;
BEGIN
    -- 1. Bắt buộc đăng nhập và tài khoản đã được duyệt
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi xuất bản bộ đề!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt để xuất bản trò chơi!';
    END IF;

    -- 2. Lấy thông tin campaign và kiểm tra quyền sở hữu
    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chiến dịch không tồn tại!';
    END IF;

    -- Chỉ chủ sở hữu bộ đề (teacher_id = auth.uid()) hoặc Admin mới có quyền xuất bản
    IF v_camp.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn không có quyền xuất bản bộ đề này!';
    END IF;

    -- Lấy giá trị enen_enabled (mặc định FALSE nếu chưa có)
    v_enen_enabled := COALESCE(v_camp.enen_enabled, FALSE);

    -- 3. Kiểm tra tính hợp lệ toàn diện trước khi xuất bản
    PERFORM public.validate_campaign(p_campaign_id);

    -- 4. Đóng gói dữ liệu các phòng ready thành JSON chuẩn
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id 
          AND COALESCE(development_status, 'ready') IN ('ready', 'completed')
        ORDER BY grade ASC, room_number ASC
    LOOP
        v_items_arr := '[]'::jsonb;
        v_tasks_obj := '{}'::jsonb;
        v_secrets_obj := '{}'::jsonb;

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
                'digit', v_item.digit,
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

    -- 5. Tăng số phiên bản xuất bản
    v_new_version := COALESCE(v_camp.version, 1) + 1;

    -- 6. Đóng gói payload xuất bản hoàn chỉnh (bao gồm snapshot enen_enabled)
    v_published_payload := jsonb_build_object(
        'campaign', jsonb_build_object(
            'id', v_camp.id,
            'title', v_camp.title,
            'share_code', v_camp.share_code,
            'version', v_new_version,
            'enen_enabled', v_enen_enabled,
            'published_at', NOW()
        ),
        'enen_enabled', v_enen_enabled,
        'rooms', v_rooms_json
    );

    -- 7. Lưu snapshot vào bảng published_campaigns
    INSERT INTO public.published_campaigns (
        campaign_id,
        share_code,
        teacher_id,
        title,
        version,
        published_payload,
        published_at
    ) VALUES (
        v_camp.id,
        v_camp.share_code,
        v_camp.teacher_id,
        v_camp.title,
        v_new_version,
        v_published_payload,
        NOW()
    )
    ON CONFLICT (share_code) DO UPDATE
    SET title = EXCLUDED.title,
        version = EXCLUDED.version,
        published_payload = EXCLUDED.published_payload,
        published_at = EXCLUDED.published_at;

    -- 8. Cập nhật trạng thái bản nháp trong bảng campaigns
    UPDATE public.campaigns
    SET is_published = TRUE,
        version = v_new_version,
        updated_at = NOW()
    WHERE id = p_campaign_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'share_code', v_camp.share_code,
        'version', v_new_version,
        'enen_enabled', v_enen_enabled,
        'published_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_campaign(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_campaign(UUID) TO authenticated;

