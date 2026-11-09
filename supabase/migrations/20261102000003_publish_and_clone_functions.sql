-- ============================================================================
-- 20261102000003_publish_and_clone_functions.sql (Phiên bản hoàn thiện validation & RPC)
-- Dự án: AI Escape Lab - Các hàm nghiệp vụ (Clone, Validate, Publish)
-- ============================================================================

-- 1. HÀM KIỂM TRA TÍNH HỢP LỆ CỦA BẢN NHÁP TRƯỚC KHI XUẤT BẢN
CREATE OR REPLACE FUNCTION public.validate_campaign(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_camp RECORD;
    v_room RECORD;
    v_item RECORD;
    v_task_digits TEXT[];
    v_sorted_digits TEXT;
    v_sorted_passcode TEXT;
    v_task_count INT;
    v_secret_count INT;
    v_p JSONB;
    v_ans_len INT;
    v_it_len INT;
    v_elem JSONB;
    v_val INT;
    v_sub RECORD;
BEGIN
    -- Yêu cầu đăng nhập: auth.uid() bắt buộc phải tồn tại
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi kiểm tra dữ liệu!';
    END IF;

    -- Kiểm tra quyền truy cập: Chỉ chủ sở hữu bộ đề, hoặc Admin, hoặc bộ đề là template công khai
    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bộ đề không tồn tại!';
    END IF;

    IF v_camp.teacher_id <> auth.uid() AND v_camp.is_template = FALSE AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Không tìm thấy bộ đề hoặc bạn không có quyền truy cập!';
    END IF;

    -- Kiểm tra bộ đề có phòng nào không (Chống xuất bản bộ đề trống)
    IF NOT EXISTS (SELECT 1 FROM public.campaign_rooms WHERE campaign_id = p_campaign_id) THEN
        RAISE EXCEPTION 'Không thể xuất bản bộ đề trống! Vui lòng tạo ít nhất một phòng chơi.';
    END IF;

    -- Kiểm tra từng phòng trong campaign
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms WHERE campaign_id = p_campaign_id ORDER BY grade, room_number
    LOOP
        -- Kiểm tra tiêu đề phòng
        IF v_room.topic IS NULL OR TRIM(v_room.topic) = '' THEN
            RAISE EXCEPTION 'Phòng % (Khối %): Tên chủ đề bài học không được để trống!', v_room.room_number, v_room.grade;
        END IF;

        -- QUY TẮC DÀNH RIÊNG CHO ROOM 01
        IF v_room.room_number = 1 THEN
            -- Kiểm tra mật mã phòng có đúng 4 chữ số không
            IF v_room.passcode IS NULL OR NOT (v_room.passcode ~ '^[0-9]{4}$') THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Mật mã mở cửa phải gồm đúng 4 chữ số (0-9)!', v_room.grade;
            END IF;

            -- Đếm số task và secret
            SELECT 
                COUNT(*) FILTER (WHERE item_type = 'task'),
                COUNT(*) FILTER (WHERE item_type = 'secret')
            INTO v_task_count, v_secret_count
            FROM public.room_items
            WHERE room_id = v_room.id;

            IF v_task_count <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Phải có đủ 4 nhiệm vụ chính (hiện có %)!', v_room.grade, v_task_count;
            END IF;

            IF v_secret_count <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Phải có đủ 4 manh mối bí mật (hiện có %)!', v_room.grade, v_secret_count;
            END IF;

            -- Thu thập các chữ số của task
            v_task_digits := ARRAY(
                SELECT digit FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'task' AND digit IS NOT NULL AND digit ~ '^[0-9]$'
            );

            IF array_length(v_task_digits, 1) <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Cả 4 nhiệm vụ chính đều phải có 1 chữ số phần thưởng hợp lệ (0-9)!', v_room.grade;
            END IF;

            -- Kiểm tra tính nhất quán: 4 chữ số của task khi xếp lại phải khớp với 4 chữ số của passcode
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_digits FROM unnest(v_task_digits) AS ch;
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_passcode FROM regexp_split_to_table(v_room.passcode, '') AS ch;

            IF v_sorted_digits <> v_sorted_passcode THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Bốn chữ số của các nhiệm vụ [%] không thể ghép thành mật mã mở cửa [%]!', 
                    v_room.grade, array_to_string(v_task_digits, ', '), v_room.passcode;
            END IF;

            -- Kiểm tra secret có gợi ý manh mối không
            IF EXISTS (
                SELECT 1 FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'secret' AND (hint IS NULL OR LENGTH(TRIM(hint)) < 5)
            ) THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Tất cả các manh mối bí mật phải có nội dung hướng dẫn giải mã cụ thể!', v_room.grade;
            END IF;
        END IF;

        -- KIỂM TRA CẤU TRÚC DỮ LIỆU CỦA TỪNG THỬ THÁCH (ITEM) TRONG PHÒNG
        FOR v_item IN 
            SELECT * FROM public.room_items WHERE room_id = v_room.id
        LOOP
            IF v_item.title IS NULL OR TRIM(v_item.title) = '' THEN
                RAISE EXCEPTION 'Phòng % (Khối %): Thử thách "%" chưa có tiêu đề!', v_room.room_number, v_room.grade, v_item.item_key;
            END IF;

            v_p := v_item.content_payload;

            -- 1. Dạng Trắc nghiệm 1 đáp án (single)
            IF v_item.kind = 'single' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng single phải có mảng answers với ít nhất 2 phương án lựa chọn!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF v_p->>'correct' IS NULL OR NOT (v_p->>'correct' ~ '^[0-9]+$') OR (v_p->>'correct')::INT < 0 OR (v_p->>'correct')::INT >= v_ans_len THEN
                    RAISE EXCEPTION 'Thử thách "%": Đáp án đúng (correct) phải là số nguyên từ 0 đến %!', v_item.item_key, v_ans_len - 1;
                END IF;

            -- 2. Dạng Chọn nhiều đáp án (multi)
            ELSIF v_item.kind = 'multi' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có mảng answers với ít nhất 2 lựa chọn!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có mảng correct với ít nhất 1 đáp án đúng!', v_item.item_key;
                END IF;
                -- Kiểm tra từng chỉ số trong correct
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Chỉ số đáp án % trong mảng multi correct không hợp lệ!', v_item.item_key, v_elem;
                    END IF;
                END LOOP;

            -- 3. Dạng Chuỗi câu hỏi liên hoàn (sequence)
            ELSIF v_item.kind = 'sequence' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng sequence phải có mảng items gồm ít nhất 2 câu hỏi con!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'items') LOOP
                    IF v_elem->>'question' IS NULL OR TRIM(v_elem->>'question') = '' THEN
                        RAISE EXCEPTION 'Thử thách "%": Câu hỏi con trong sequence không được để trống nội dung!', v_item.item_key;
                    END IF;
                    IF jsonb_typeof(v_elem->'answers') <> 'array' OR jsonb_array_length(v_elem->'answers') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Câu hỏi con trong sequence phải có ít nhất 2 phương án trả lời!', v_item.item_key;
                    END IF;
                    v_ans_len := jsonb_array_length(v_elem->'answers');
                    IF v_elem->>'correct' IS NULL OR NOT (v_elem->>'correct' ~ '^[0-9]+$') OR (v_elem->>'correct')::INT < 0 OR (v_elem->>'correct')::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Đáp án đúng (correct) của câu hỏi con trong sequence không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            -- 4. Dạng Ghép đôi 2 cột (match)
            ELSIF v_item.kind = 'match' THEN
                IF jsonb_typeof(v_p->'left') <> 'array' OR jsonb_typeof(v_p->'right') <> 'array' OR jsonb_array_length(v_p->'left') <> jsonb_array_length(v_p->'right') OR jsonb_array_length(v_p->'left') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng match phải có 2 cột ghép (left, right) có cùng số lượng thẻ (>= 2)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'right');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> jsonb_array_length(v_p->'left') THEN
                    RAISE EXCEPTION 'Thử thách "%": Mảng correct của dạng match phải có độ dài bằng cột left!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Chỉ số liên kết trong correct của dạng match không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            -- 5. Dạng Phân loại nhóm (sort)
            ELSIF v_item.kind = 'sort' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_typeof(v_p->'groups') <> 'array' OR jsonb_array_length(v_p->'items') < 2 OR jsonb_array_length(v_p->'groups') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng sort phải có danh sách thẻ (items) và nhóm (groups) từ 2 trở lên!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'groups');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> jsonb_array_length(v_p->'items') THEN
                    RAISE EXCEPTION 'Thử thách "%": Mảng correct của dạng sort phải có độ dài bằng số lượng thẻ!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Chỉ số nhóm trong correct của dạng sort không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            -- 6. Dạng Sắp xếp thứ tự (order)
            ELSIF v_item.kind = 'order' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng order phải có danh sách ít nhất 2 bước thực hiện!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'items');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> v_it_len THEN
                    RAISE EXCEPTION 'Thử thách "%": Mảng thứ tự đúng (correct) phải có cùng số lượng phần tử với items!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_it_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Chỉ số thứ tự trong correct của dạng order không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            -- 7. Dạng Ghép bộ ba (pair)
            ELSIF v_item.kind = 'pair' THEN
                IF jsonb_typeof(v_p->'jobs') <> 'array' OR jsonb_typeof(v_p->'hardware') <> 'array' OR jsonb_typeof(v_p->'software') <> 'array'
                   OR jsonb_array_length(v_p->'jobs') < 2 OR jsonb_array_length(v_p->'hardware') < 2 OR jsonb_array_length(v_p->'software') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng pair phải có đủ các mảng jobs, hardware, software (mỗi mảng >= 2 phần tử)!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'jobs');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> v_it_len THEN
                    RAISE EXCEPTION 'Thử thách "%": Mảng correct của dạng pair phải có độ dài bằng số lượng jobs!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'array' OR jsonb_array_length(v_elem) <> 2
                       OR jsonb_typeof(v_elem->0) <> 'number' OR jsonb_typeof(v_elem->1) <> 'number'
                       OR ((v_elem->0)::TEXT)::INT < 0 OR ((v_elem->0)::TEXT)::INT >= jsonb_array_length(v_p->'hardware')
                       OR ((v_elem->1)::TEXT)::INT < 0 OR ((v_elem->1)::TEXT)::INT >= jsonb_array_length(v_p->'software') THEN
                        RAISE EXCEPTION 'Thử thách "%": Cặp chỉ số [hardware, software] trong correct của dạng pair không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    RETURN TRUE;
END;
$$;


-- 2. HÀM XUẤT BẢN BỘ ĐỀ DÀNH CHO GIÁO VIÊN & ADMIN (PUBLISH CAMPAIGN)
-- Bắt buộc đăng nhập thật, chỉ chủ sở hữu bộ đề hoặc Admin mới có quyền xuất bản.
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
    -- Bắt buộc đăng nhập
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi xuất bản bộ đề!';
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

    -- Ghi đè vào bảng xuất bản công khai theo share_code (học sinh đọc qua ?set=ABC123)
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


-- 3. HÀM SAO CHÉP BỘ ĐỀ (CLONE CAMPAIGN)
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
    -- Yêu cầu đăng nhập
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi sao chép bộ đề!';
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

    -- Sao chép từng phòng
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms WHERE campaign_id = p_source_campaign_id
    LOOP
        INSERT INTO public.campaign_rooms (
            campaign_id,
            room_number,
            grade,
            topic,
            passcode,
            theme,
            accent_color,
            metadata
        )
        VALUES (
            v_new_camp_id,
            v_room.room_number,
            v_room.grade,
            v_room.topic,
            v_room.passcode,
            v_room.theme,
            v_room.accent_color,
            v_room.metadata
        )
        RETURNING id INTO v_new_room_id;

        -- Sao chép từng item trong phòng
        FOR v_item IN 
            SELECT * FROM public.room_items WHERE room_id = v_room.id
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

-- ============================================================================
-- THU HỒI VÀ CẤP PHÁT QUYỀN THỰC THI (FUNCTION PERMISSIONS)
-- ============================================================================
REVOKE ALL ON FUNCTION public.auth_is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_campaign(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_campaign(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clone_campaign(UUID, TEXT, TEXT) FROM PUBLIC, anon;

-- Chỉ cấp quyền thực thi cho người dùng đã đăng nhập (authenticated)
GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_campaign(UUID, TEXT, TEXT) TO authenticated;
