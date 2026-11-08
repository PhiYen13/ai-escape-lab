-- ============================================================================
-- 20261102000008_modular_room_architecture.sql
-- Dự án: AI Escape Lab - Bước 1: Kiến trúc Module phòng chơi & Bảo vệ cấu trúc Gameplay
-- ============================================================================

-- 1. BỔ SUNG CÁC CỘT ĐỊNH DANH MODULE VÀ CẤU HÌNH CƠ CHẾ CHƠI VÀO CAMPAIGN_ROOMS
-- KHÔNG tạo trước 45 phòng trống trong database. Dữ liệu phòng mới chỉ được tạo khi Admin tích hợp.
ALTER TABLE public.campaign_rooms
    ADD COLUMN IF NOT EXISTS module_id VARCHAR(50) DEFAULT 'escape_room_point_click_v1',
    ADD COLUMN IF NOT EXISTS development_status VARCHAR(20) DEFAULT 'ready'
        CHECK (development_status IN ('ready', 'coming_soon', 'maintenance')),
    ADD COLUMN IF NOT EXISTS engine_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. ĐỒNG BỘ DỮ LIỆU HIỆN CÓ CỦA ROOM 01 (KHỐI 3, 4, 5) VÀ CÁC BẢN SAO GIÁO VIÊN
-- Gán module mặc định cho Room 01 đang hoạt động ổn định:
UPDATE public.campaign_rooms
   SET module_id = 'escape_room_point_click_v1',
       development_status = 'ready',
       engine_config = COALESCE(engine_config, '{}'::jsonb)
 WHERE module_id IS NULL OR development_status IS NULL;

-- 3. CHỈ MỤC (INDEXES) HỖ TRỢ TRUY VẤN THEO MODULE VÀ TRẠNG THÁI
CREATE INDEX IF NOT EXISTS idx_campaign_rooms_module ON public.campaign_rooms(module_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rooms_dev_status ON public.campaign_rooms(development_status);

-- 4. TRIGGER BẢO VỆ CẤU TRÚC PHÒNG CHƠI (CHẶN GIÁO VIÊN SỬA CƠ CHẾ CỐ ĐỊNH)
-- Giáo viên CHỈ được sửa: topic, passcode, theme, accent_color, metadata.
-- Giáo viên KHÔNG ĐƯỢC sửa: module_id, development_status, engine_config, room_number, grade, campaign_id.
CREATE OR REPLACE FUNCTION public.prevent_teacher_modifying_room_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Nếu là Quản trị viên (Admin) hoặc Service Role / Postgres thì cho phép toàn quyền
    IF public.auth_is_admin() OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    -- Đối với Giáo viên: Chặn thay đổi các thuộc tính kiến trúc của phòng
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
    BEFORE UPDATE ON public.campaign_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_teacher_modifying_room_structure();


-- 5. TRIGGER BẢO VỆ CẤU TRÚC THỬ THÁCH (ROOM_ITEMS)
-- Giáo viên CHỈ được sửa nội dung học tập: title, intro, question, digit, hint, content_payload, sort_order.
-- Giáo viên KHÔNG ĐƯỢC sửa: room_id, item_key, item_type, kind (để không làm hỏng logic của game engine).
CREATE OR REPLACE FUNCTION public.prevent_teacher_modifying_item_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Nếu là Quản trị viên (Admin) hoặc Service Role / Postgres thì cho phép toàn quyền
    IF public.auth_is_admin() OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_item_structure ON public.room_items;
CREATE TRIGGER trg_protect_item_structure
    BEFORE UPDATE ON public.room_items
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_teacher_modifying_item_structure();


-- 6. CẬP NHẬT HÀM SAO CHÉP BỘ ĐỀ (CLONE_CAMPAIGN) ĐỒNG BỘ MODULE & CẤU HÌNH
CREATE OR REPLACE FUNCTION public.clone_campaign(
    p_source_campaign_id UUID,
    p_new_title TEXT,
    p_new_share_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_code VARCHAR(20);
    v_source RECORD;
    v_new_camp_id UUID;
    v_room RECORD;
    v_new_room_id UUID;
    v_item RECORD;
BEGIN
    -- Yêu cầu đăng nhập và tài khoản đã được phê duyệt
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi sao chép bộ đề!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt để sao chép bộ đề!';
    END IF;

    -- Kiểm tra bộ đề nguồn
    SELECT * INTO v_source FROM public.campaigns WHERE id = p_source_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy bộ đề nguồn!';
    END IF;

    -- BẢO VỆ TÍNH RIÊNG TƯ: Chặn sao chép bộ đề riêng tư của giáo viên khác
    IF v_source.is_template = FALSE AND v_source.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn chỉ có quyền sao chép bộ câu hỏi gốc (template) hoặc bộ đề do chính bạn sở hữu!';
    END IF;

    -- Làm sạch và kiểm tra mã chia sẻ
    v_clean_code := UPPER(TRIM(p_new_share_code));

    IF v_clean_code IS NULL OR NOT (v_clean_code ~ '^[A-Za-z0-9_-]{3,20}$') THEN
        RAISE EXCEPTION 'Mã chia sẻ (share_code) chỉ gồm 3-20 ký tự chữ, số, gạch ngang hoặc gạch dưới!';
    END IF;

    IF v_clean_code = 'MASTER' THEN
        RAISE EXCEPTION 'Không được đặt mã chia sẻ trùng với từ khóa hệ thống MASTER!';
    END IF;

    IF EXISTS (SELECT 1 FROM public.campaigns WHERE share_code = v_clean_code) THEN
        RAISE EXCEPTION 'Mã chia sẻ "%" đã được sử dụng. Vui lòng chọn mã khác!', v_clean_code;
    END IF;

    IF p_new_title IS NULL OR TRIM(p_new_title) = '' THEN
        RAISE EXCEPTION 'Tiêu đề bộ đề mới không được để trống!';
    END IF;

    -- Tạo Campaign mới thuộc quyền sở hữu của user đang gọi hàm
    INSERT INTO public.campaigns (
        teacher_id,
        title,
        share_code,
        is_template,
        is_published,
        version,
        metadata
    )
    VALUES (
        auth.uid(),
        TRIM(p_new_title),
        v_clean_code,
        FALSE, -- Bản sao không bao giờ là template
        FALSE, -- Khởi tạo ở trạng thái nháp
        1,
        jsonb_build_object('cloned_from', p_source_campaign_id, 'cloned_at', NOW())
    )
    RETURNING id INTO v_new_camp_id;

    -- Sao chép từng phòng hiện có của bộ đề nguồn (chỉ sao chép những phòng thực sự tồn tại)
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms 
        WHERE campaign_id = p_source_campaign_id
        ORDER BY grade ASC, room_number ASC
    LOOP
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
        )
        VALUES (
            v_new_camp_id,
            v_room.room_number,
            v_room.grade,
            v_room.topic,
            v_room.passcode,
            v_room.theme,
            v_room.accent_color,
            v_room.metadata,
            COALESCE(v_room.module_id, 'escape_room_point_click_v1'),
            COALESCE(v_room.development_status, 'ready'),
            COALESCE(v_room.engine_config, '{}'::jsonb)
        )
        RETURNING id INTO v_new_room_id;

        -- Sao chép từng item trong phòng
        FOR v_item IN 
            SELECT * FROM public.room_items 
            WHERE room_id = v_room.id
            ORDER BY sort_order ASC
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
            )
            VALUES (
                v_new_room_id,
                v_item.item_key,
                v_item.item_type,
                v_item.kind,
                v_item.title,
                v_item.intro,
                v_item.question,
                v_item.digit,
                v_item.hint,
                v_item.content_payload,
                v_item.sort_order
            );
        END LOOP;
    END LOOP;

    RETURN v_new_camp_id;
END;
$$;


-- 7. CẬP NHẬT HÀM XUẤT BẢN BỘ ĐỀ (PUBLISH_CAMPAIGN) ĐÓNG GÓI MODULE & CONFIG SANG JSON
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
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_item_data JSONB;
    v_published_payload JSONB;
    v_new_version INT;
BEGIN
    -- Bắt buộc đăng nhập và tài khoản đã được duyệt
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi xuất bản bộ đề!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt để xuất bản trò chơi!';
    END IF;

    -- Lấy thông tin campaign và kiểm tra quyền sở hữu
    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chiến dịch không tồn tại!';
    END IF;

    -- Chỉ chủ sở hữu bộ đề (teacher_id = auth.uid()) hoặc Admin mới có quyền xuất bản
    IF v_camp.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn không có quyền xuất bản bộ đề này!';
    END IF;

    -- Kiểm tra tính hợp lệ toàn diện trước khi xuất bản
    PERFORM public.validate_campaign(p_campaign_id);

    -- Đóng gói dữ liệu phòng và thử thách thành JSON chuẩn
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id 
        ORDER BY grade ASC, room_number ASC
    LOOP
        v_tasks_obj := '{}'::jsonb;
        v_secrets_obj := '{}'::jsonb;

        FOR v_item IN 
            SELECT * FROM public.room_items 
            WHERE room_id = v_room.id 
            ORDER BY sort_order ASC
        LOOP
            v_item_data := jsonb_build_object(
                'title', v_item.title,
                'kind', v_item.kind
            );

            IF v_item.intro IS NOT NULL AND v_item.intro <> '' THEN
                v_item_data := v_item_data || jsonb_build_object('intro', v_item.intro);
            END IF;

            IF v_item.item_type = 'task' THEN
                v_item_data := v_item_data || jsonb_build_object('digit', v_item.digit);
            ELSE
                v_item_data := v_item_data || jsonb_build_object('hint', v_item.hint);
            END IF;

            -- Ghép toàn bộ nội dung trong content_payload vào
            v_item_data := v_item_data || v_item.content_payload;

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
            'tasks', v_tasks_obj,
            'secrets', v_secrets_obj
        );

        v_rooms_json := v_rooms_json || jsonb_build_array(v_room_json);
    END LOOP;

    -- Tăng số phiên bản xuất bản
    v_new_version := v_camp.version + 1;

    v_published_payload := jsonb_build_object(
        'campaign', jsonb_build_object(
            'id', v_camp.id,
            'title', v_camp.title,
            'share_code', v_camp.share_code,
            'version', v_new_version,
            'published_at', NOW()
        ),
        'rooms', v_rooms_json
    );

    -- Cập nhật trạng thái bản nháp
    UPDATE public.campaigns
       SET is_published = TRUE,
           version = v_new_version,
           updated_at = NOW()
     WHERE id = p_campaign_id;

    -- Ghi đè vào bảng xuất bản công khai theo share_code (học sinh đọc qua ?set=ABC123 hoặc ?set=MASTER)
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
        v_camp.share_code,
        v_camp.id,
        v_camp.teacher_id,
        v_camp.title,
        v_new_version,
        v_published_payload,
        NOW()
    )
    ON CONFLICT (share_code) DO UPDATE SET
        title = EXCLUDED.title,
        version = EXCLUDED.version,
        published_payload = EXCLUDED.published_payload,
        published_at = NOW();

    RETURN jsonb_build_object(
        'success', TRUE,
        'share_code', v_camp.share_code,
        'version', v_new_version,
        'message', 'Xuất bản thành công!'
    );
END;
$$;

