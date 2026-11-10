-- ============================================================================
-- Migration: 20261102000012_fix_room03_grade4_content_payload.sql
-- Mục đích:
--   1. Cập nhật hàm validate_campaign:
--      - Hỗ trợ cả 2 định dạng 'answers' (danh sách lựa chọn) và 'options' cho single/multi.
--      - Hỗ trợ 'correct' (chỉ số đáp án đúng) hoặc 'answers' (nếu là số/mảng số cũ).
--      - Bổ sung quy tắc kiểm tra cho dạng 'fill_select' (phân loại từ khóa vào ví dụ).
--      - Hỗ trợ mảng đáp án nối đúng trong dạng 'match' (correct hoặc answers).
--   2. Chuẩn hóa dữ liệu content_payload trong room_items cho Phòng 03 Khối 4
--      (web_exploration_lab_v1) của cả bộ MASTER và tất cả các bản sao clone hiện có.
--   3. Cập nhật published_payload của bộ MASTER để Game Client nhận dữ liệu đồng bộ.
-- ============================================================================

-- 1. CẬP NHẬT HÀM validate_campaign
CREATE OR REPLACE FUNCTION public.validate_campaign(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_camp RECORD;
    v_current_user_id UUID;
    v_is_admin BOOLEAN := FALSE;
    v_room RECORD;
    v_item RECORD;
    v_p JSONB;
    v_task_count INT;
    v_secret_count INT;
    v_task_digits TEXT[];
    v_sorted_digits TEXT;
    v_sorted_passcode TEXT;
    v_module_id TEXT;
    v_ans_len INT;
    v_it_len INT;
    v_elem JSONB;
BEGIN
    -- 0. Kiểm tra quyền thực thi (giữ nguyên quy tắc bảo mật RLS)
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::UUID INTO v_current_user_id;
    END IF;

    IF v_current_user_id IS NOT NULL THEN
        SELECT (role = 'admin') INTO v_is_admin
        FROM public.profiles
        WHERE id = v_current_user_id;
    END IF;

    SELECT * INTO v_camp
    FROM public.campaigns
    WHERE id = p_campaign_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy bộ đề với ID %!', p_campaign_id;
    END IF;

    IF (v_camp.is_template OR v_camp.share_code = 'MASTER') AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Từ chối: Chỉ Quản trị viên (Admin) mới có quyền kiểm tra/xuất bản bộ đề gốc MASTER!';
    END IF;

    IF NOT v_camp.is_template AND v_camp.share_code <> 'MASTER' AND NOT v_is_admin THEN
        IF v_camp.teacher_id <> v_current_user_id THEN
            RAISE EXCEPTION 'Từ chối: Bạn chỉ có quyền thao tác trên bộ đề do chính mình tạo ra!';
        END IF;
    END IF;

    IF v_camp.title IS NULL OR LENGTH(TRIM(v_camp.title)) < 3 THEN
        RAISE EXCEPTION 'Tên bộ đề phải có ít nhất 3 ký tự!';
    END IF;

    -- Kiểm tra phòng học
    IF NOT EXISTS (
        SELECT 1 FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id 
          AND LOWER(COALESCE(development_status, 'ready')) IN ('ready', 'completed')
    ) THEN
        RAISE EXCEPTION 'Bộ đề chưa có phòng học nào ở trạng thái sẵn sàng (ready) để xuất bản!';
    END IF;

    -- Phủ đủ 3 khối lớp bắt buộc: 3, 4, 5
    IF NOT EXISTS (
        SELECT 1 FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id AND grade = 3
          AND LOWER(COALESCE(development_status, 'ready')) IN ('ready', 'completed')
    ) THEN
        RAISE EXCEPTION 'Bộ đề phải có ít nhất một phòng sẵn sàng cho Khối 3!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id AND grade = 4
          AND LOWER(COALESCE(development_status, 'ready')) IN ('ready', 'completed')
    ) THEN
        RAISE EXCEPTION 'Bộ đề phải có ít nhất một phòng sẵn sàng cho Khối 4!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id AND grade = 5
          AND LOWER(COALESCE(development_status, 'ready')) IN ('ready', 'completed')
    ) THEN
        RAISE EXCEPTION 'Bộ đề phải có ít nhất một phòng sẵn sàng cho Khối 5!';
    END IF;

    -- Kiểm tra chi tiết từng phòng ready
    FOR v_room IN
        SELECT * FROM public.campaign_rooms
        WHERE campaign_id = p_campaign_id
          AND LOWER(COALESCE(development_status, 'ready')) IN ('ready', 'completed')
        ORDER BY grade ASC, room_number ASC
    LOOP
        v_module_id := COALESCE(v_room.module_id, 'escape_room_point_click_v1');

        IF v_room.topic IS NULL OR TRIM(v_room.topic) = '' THEN
            RAISE EXCEPTION 'Phòng 0% (Khối %): Chủ đề bài học không được để trống!', v_room.room_number, v_room.grade;
        END IF;

        -- Point & Click module checks
        IF v_module_id = 'escape_room_point_click_v1' THEN
            IF v_room.passcode IS NULL OR NOT (v_room.passcode ~ '^[0-9]{4}$') THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Mật mã mở cửa phòng bắt buộc phải gồm đúng 4 chữ số (0-9)!', v_room.room_number, v_room.grade;
            END IF;

            SELECT 
                COUNT(*) FILTER (WHERE item_type = 'task'),
                COUNT(*) FILTER (WHERE item_type = 'secret')
            INTO v_task_count, v_secret_count
            FROM public.room_items
            WHERE room_id = v_room.id;

            IF v_task_count <> 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Phải có đủ 4 nhiệm vụ chính (hiện có %)!', v_room.room_number, v_room.grade, v_task_count;
            END IF;

            IF v_secret_count <> 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Phải có đủ 4 manh mối bí mật (hiện có %)!', v_room.room_number, v_room.grade, v_secret_count;
            END IF;

            v_task_digits := ARRAY(
                SELECT digit FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'task' AND digit IS NOT NULL AND digit ~ '^[0-9]$'
            );

            IF array_length(v_task_digits, 1) <> 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Cả 4 nhiệm vụ chính đều phải có 1 chữ số phần thưởng hợp lệ (0-9)!', v_room.room_number, v_room.grade;
            END IF;

            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_digits FROM unnest(v_task_digits) AS ch;
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_passcode FROM regexp_split_to_table(v_room.passcode, '') AS ch;

            IF v_sorted_digits <> v_sorted_passcode THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Bốn chữ số của các nhiệm vụ [%] không thể ghép thành mật mã mở cửa [%]!', 
                    v_room.room_number, v_room.grade, array_to_string(v_task_digits, ', '), v_room.passcode;
            END IF;

            IF EXISTS (
                SELECT 1 FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'secret' AND (hint IS NULL OR LENGTH(TRIM(hint)) < 5)
            ) THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Tất cả các manh mối bí mật phải có nội dung hướng dẫn giải mã cụ thể!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- Lab exploration repair module checks
        IF v_module_id = 'lab_exploration_repair_v1' THEN
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id AND item_type = 'station') < 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Khám phá phục hồi yêu cầu đủ 4 trạm kiến thức!', v_room.room_number, v_room.grade;
            END IF;
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id AND item_type = 'task') < 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Khám phá phục hồi yêu cầu đủ 4 nhiệm vụ khôi phục!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- Computer maze adventure module checks
        IF v_module_id = 'computer_maze_adventure_v1' THEN
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id) < 9 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Mê cung máy tính yêu cầu đủ 9 thử thách!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- Web exploration lab module checks
        IF v_module_id = 'web_exploration_lab_v1' THEN
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id) < 18 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Kho tri thức Web yêu cầu đủ 18 thử thách!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- Kiểm tra chi tiết từng item
        FOR v_item IN 
            SELECT * FROM public.room_items WHERE room_id = v_room.id
        LOOP
            IF v_item.title IS NULL OR TRIM(v_item.title) = '' THEN
                RAISE EXCEPTION 'Phòng % (Khối %): Thử thách "%" chưa có tiêu đề!', v_room.room_number, v_room.grade, v_item.item_key;
            END IF;

            v_p := COALESCE(v_item.content_payload, '{}'::jsonb);

            -- Station lý thuyết
            IF v_item.item_type = 'station' THEN
                IF COALESCE(v_item.intro, v_p->>'theory', '') = '' THEN
                    RAISE EXCEPTION 'Trạm "%" (Khối %): Nội dung lý thuyết không được để trống!', v_item.item_key, v_room.grade;
                END IF;
                IF COALESCE(v_item.question, v_p->>'example', '') = '' THEN
                    RAISE EXCEPTION 'Trạm "%" (Khối %): Ví dụ minh họa không được để trống!', v_item.item_key, v_room.grade;
                END IF;

            -- 1. SINGLE: TRẮC NGHIỆM ĐƠN
            ELSIF v_item.kind = 'single' THEN
                IF v_p->>'device_type' IN ('laptop', 'tablet') THEN
                    NULL;
                ELSIF v_p->>'device_type' = 'smartphone' OR v_item.item_key = 'station_auth' THEN
                    IF v_p->>'target_code' IS NULL OR TRIM(v_p->>'target_code') = '' THEN
                        RAISE EXCEPTION 'Thử thách "%": Mật mã bàn phím ảo (target_code) không được để trống!', v_item.item_key;
                    END IF;
                ELSIF v_p->>'task_mode' = 'typing' THEN
                    IF jsonb_typeof(v_p->'lines') <> 'array' OR jsonb_array_length(v_p->'lines') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ luyện gõ cần ít nhất 1 dòng văn bản!', v_item.item_key;
                    END IF;
                ELSIF v_p->>'task_mode' = 'fingers' THEN
                    IF jsonb_typeof(v_p->'digits') <> 'array' OR jsonb_array_length(v_p->'digits') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ hàng phím số cần danh sách phím số!', v_item.item_key;
                    END IF;
                ELSIF v_p->>'task_mode' = 'website' THEN
                    IF jsonb_typeof(v_p->'entries') <> 'array' OR jsonb_array_length(v_p->'entries') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Danh sách nút giao diện website không được để trống!', v_item.item_key;
                    END IF;
                ELSIF v_p->>'task_mode' = 'search' THEN
                    IF v_p->>'article_title' IS NULL OR TRIM(v_p->>'article_title') = '' THEN
                        RAISE EXCEPTION 'Thử thách "%": Tiêu đề bài viết tìm kiếm không được để trống!', v_item.item_key;
                    END IF;
                    IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ tìm kiếm cần ít nhất 2 lựa chọn an toàn!', v_item.item_key;
                    END IF;
                ELSIF v_p->>'task_mode' = 'usb_rescue' THEN
                    IF jsonb_typeof(v_p->'files') <> 'array' OR jsonb_array_length(v_p->'files') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Cần ít nhất 2 tệp trong mô phỏng USB!', v_item.item_key;
                    END IF;
                ELSE
                    -- Chấp nhận choices trong answers (nếu là mảng) HOẶC trong options
                    IF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') >= 2 AND jsonb_typeof(v_p->'answers'->0) = 'string' THEN
                        v_ans_len := jsonb_array_length(v_p->'answers');
                    ELSIF jsonb_typeof(v_p->'options') = 'array' AND jsonb_array_length(v_p->'options') >= 2 THEN
                        v_ans_len := jsonb_array_length(v_p->'options');
                    ELSIF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') >= 2 THEN
                        v_ans_len := jsonb_array_length(v_p->'answers');
                    ELSE
                        RAISE EXCEPTION 'Thử thách "%": Dạng single phải có ít nhất 2 phương án lựa chọn (answers/options)!', v_item.item_key;
                    END IF;

                    -- Chấp nhận correct index trong correct HOẶC answers (nếu answers là số)
                    IF v_p->>'correct' IS NOT NULL AND (v_p->>'correct' ~ '^[0-9]+$') AND (v_p->>'correct')::INT >= 0 AND (v_p->>'correct')::INT < v_ans_len THEN
                        NULL;
                    ELSIF jsonb_typeof(v_p->'answers') = 'number' AND (v_p->>'answers')::INT >= 0 AND (v_p->>'answers')::INT < v_ans_len THEN
                        NULL;
                    ELSE
                        RAISE EXCEPTION 'Thử thách "%": Đáp án đúng (correct) phải là số nguyên từ 0 đến %!', v_item.item_key, v_ans_len - 1;
                    END IF;
                END IF;

            -- 2. MULTI: CHỌN NHIỀU ĐÁP ÁN
            ELSIF v_item.kind = 'multi' THEN
                IF v_p->>'task_mode' = 'share' THEN
                    IF jsonb_typeof(v_p->'files') <> 'array' OR jsonb_array_length(v_p->'files') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ chia sẻ cần ít nhất 2 tệp trong danh sách!', v_item.item_key;
                    END IF;
                    IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ chia sẻ phải có ít nhất 1 đáp án đúng!', v_item.item_key;
                    END IF;
                ELSE
                    -- Chấp nhận choices trong answers HOẶC options
                    IF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') >= 2 AND jsonb_typeof(v_p->'answers'->0) = 'string' THEN
                        v_ans_len := jsonb_array_length(v_p->'answers');
                    ELSIF jsonb_typeof(v_p->'options') = 'array' AND jsonb_array_length(v_p->'options') >= 2 THEN
                        v_ans_len := jsonb_array_length(v_p->'options');
                    ELSIF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') >= 2 THEN
                        v_ans_len := jsonb_array_length(v_p->'answers');
                    ELSE
                        RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có ít nhất 2 phát biểu lựa chọn (answers/options)!', v_item.item_key;
                    END IF;

                    -- Mảng đáp án đúng trong correct HOẶC answers (nếu answers là mảng số)
                    IF jsonb_typeof(v_p->'correct') = 'array' AND jsonb_array_length(v_p->'correct') >= 1 THEN
                        FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                            IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                                RAISE EXCEPTION 'Thử thách "%": Chỉ số đáp án % trong mảng multi correct không hợp lệ!', v_item.item_key, v_elem;
                            END IF;
                        END LOOP;
                    ELSIF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') >= 1 AND jsonb_typeof(v_p->'answers'->0) = 'number' THEN
                        FOR v_elem IN SELECT jsonb_array_elements(v_p->'answers') LOOP
                            IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                                RAISE EXCEPTION 'Thử thách "%": Chỉ số đáp án % trong mảng multi answers không hợp lệ!', v_item.item_key, v_elem;
                            END IF;
                        END LOOP;
                    ELSE
                        RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có mảng correct với ít nhất 1 đáp án đúng!', v_item.item_key;
                    END IF;
                END IF;

            -- 3. SEQUENCE
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

            -- 4. MATCH
            ELSIF v_item.kind = 'match' THEN
                IF jsonb_typeof(v_p->'left') <> 'array' OR jsonb_typeof(v_p->'right') <> 'array' OR jsonb_array_length(v_p->'left') <> jsonb_array_length(v_p->'right') OR jsonb_array_length(v_p->'left') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng match phải có 2 cột ghép (left, right) có cùng số lượng thẻ (>= 2)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'right');
                
                IF jsonb_typeof(v_p->'correct') = 'array' AND jsonb_array_length(v_p->'correct') = jsonb_array_length(v_p->'left') THEN
                    FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                        IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                            RAISE EXCEPTION 'Thử thách "%": Chỉ số liên kết trong correct của dạng match không hợp lệ!', v_item.item_key;
                        END IF;
                    END LOOP;
                ELSIF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') = jsonb_array_length(v_p->'left') THEN
                    FOR v_elem IN SELECT jsonb_array_elements(v_p->'answers') LOOP
                        IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                            RAISE EXCEPTION 'Thử thách "%": Chỉ số liên kết trong answers của dạng match không hợp lệ!', v_item.item_key;
                        END IF;
                    END LOOP;
                ELSE
                    RAISE EXCEPTION 'Thử thách "%": Dạng match phải có mảng correct/answers có độ dài bằng cột left!', v_item.item_key;
                END IF;

            -- 5. FILL_SELECT (Phân loại từ khóa vào ví dụ)
            ELSIF v_item.kind = 'fill_select' THEN
                IF jsonb_typeof(v_p->'words') <> 'array' OR jsonb_array_length(v_p->'words') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng fill_select phải có danh sách thẻ từ (words) ít nhất 2 từ!', v_item.item_key;
                END IF;
                IF jsonb_typeof(v_p->'examples') <> 'array' OR jsonb_array_length(v_p->'examples') < 1 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng fill_select phải có ít nhất 1 câu ví dụ minh họa (examples)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'words');
                v_it_len := jsonb_array_length(v_p->'examples');

                IF jsonb_typeof(v_p->'correct') = 'array' AND jsonb_array_length(v_p->'correct') = v_it_len THEN
                    FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                        IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                            RAISE EXCEPTION 'Thử thách "%": Chỉ số từ trong correct của fill_select không hợp lệ!', v_item.item_key;
                        END IF;
                    END LOOP;
                ELSIF jsonb_typeof(v_p->'answers') = 'array' AND jsonb_array_length(v_p->'answers') = v_it_len THEN
                    FOR v_elem IN SELECT jsonb_array_elements(v_p->'answers') LOOP
                        IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                            RAISE EXCEPTION 'Thử thách "%": Chỉ số từ trong answers của fill_select không hợp lệ!', v_item.item_key;
                        END IF;
                    END LOOP;
                ELSE
                    RAISE EXCEPTION 'Thử thách "%": Dạng fill_select phải có mảng correct/answers có độ dài bằng số lượng ví dụ!', v_item.item_key;
                END IF;

            -- 6. SORT
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

            -- 7. ORDER
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

            -- 8. PAIR
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

REVOKE ALL ON FUNCTION public.validate_campaign(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_campaign(UUID) TO authenticated;

-- ============================================================================
-- 2. CHUẨN HÓA DỮ LIỆU CONTENT_PAYLOAD TRONG BẢNG room_items
--    Áp dụng cho Phòng 03 Khối 4 (module_id = 'web_exploration_lab_v1')
--    trên toàn bộ database (cả MASTER và các bản sao clone hiện có).
-- ============================================================================

-- A. Dạng single: Chuẩn hóa options -> answers, và answers cũ (số) -> correct
UPDATE public.room_items
SET content_payload = jsonb_set(
    jsonb_set(
        jsonb_set(
            content_payload,
            '{correct}',
            CASE 
                WHEN content_payload ? 'correct' AND jsonb_typeof(content_payload->'correct') = 'number' THEN content_payload->'correct'
                WHEN jsonb_typeof(content_payload->'answers') = 'number' THEN content_payload->'answers'
                ELSE '0'::jsonb
            END
        ),
        '{answers}',
        CASE 
            WHEN jsonb_typeof(content_payload->'options') = 'array' THEN content_payload->'options'
            ELSE content_payload->'answers'
        END
    ),
    '{options}',
    CASE 
        WHEN jsonb_typeof(content_payload->'options') = 'array' THEN content_payload->'options'
        ELSE content_payload->'answers'
    END
)
WHERE kind = 'single'
  AND room_id IN (
    SELECT id FROM public.campaign_rooms
    WHERE module_id = 'web_exploration_lab_v1' OR (grade = 4 AND room_number = 3)
  );

-- B. Dạng multi: Chuẩn hóa options -> answers, và answers cũ (mảng số) -> correct
UPDATE public.room_items
SET content_payload = jsonb_set(
    jsonb_set(
        jsonb_set(
            content_payload,
            '{correct}',
            CASE 
                WHEN content_payload ? 'correct' AND jsonb_typeof(content_payload->'correct') = 'array' THEN content_payload->'correct'
                WHEN jsonb_typeof(content_payload->'answers') = 'array' AND jsonb_typeof(content_payload->'answers'->0) = 'number' THEN content_payload->'answers'
                ELSE '[0]'::jsonb
            END
        ),
        '{answers}',
        CASE 
            WHEN jsonb_typeof(content_payload->'options') = 'array' THEN content_payload->'options'
            ELSE content_payload->'answers'
        END
    ),
    '{options}',
    CASE 
        WHEN jsonb_typeof(content_payload->'options') = 'array' THEN content_payload->'options'
        ELSE content_payload->'answers'
    END
)
WHERE kind = 'multi'
  AND room_id IN (
    SELECT id FROM public.campaign_rooms
    WHERE module_id = 'web_exploration_lab_v1' OR (grade = 4 AND room_number = 3)
  );

-- C. Dạng match: Đồng bộ hai chiều correct và answers
UPDATE public.room_items
SET content_payload = jsonb_set(
    content_payload,
    '{correct}',
    COALESCE(content_payload->'correct', content_payload->'answers')
)
WHERE kind = 'match'
  AND (NOT content_payload ? 'correct')
  AND content_payload ? 'answers'
  AND room_id IN (
    SELECT id FROM public.campaign_rooms
    WHERE module_id = 'web_exploration_lab_v1' OR (grade = 4 AND room_number = 3)
  );

-- D. Dạng fill_select: Đồng bộ hai chiều correct và answers
UPDATE public.room_items
SET content_payload = jsonb_set(
    content_payload,
    '{correct}',
    COALESCE(content_payload->'correct', content_payload->'answers')
)
WHERE kind = 'fill_select'
  AND (NOT content_payload ? 'correct')
  AND content_payload ? 'answers'
  AND room_id IN (
    SELECT id FROM public.campaign_rooms
    WHERE module_id = 'web_exploration_lab_v1' OR (grade = 4 AND room_number = 3)
  );

-- ============================================================================
-- 3. CẬP NHẬT published_payload CỦA BỘ GỐC MASTER NẾU CẦN
-- ============================================================================
DO $$
DECLARE
    v_master_id UUID;
    v_rooms_json JSONB := '[]'::jsonb;
    v_room RECORD;
    v_item RECORD;
    v_item_data JSONB;
    v_items_arr JSONB;
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_room_json JSONB;
    v_published_payload JSONB;
    v_master_camp RECORD;
BEGIN
    SELECT id INTO v_master_id FROM public.campaigns WHERE share_code = 'MASTER';
    IF v_master_id IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO v_master_camp FROM public.campaigns WHERE id = v_master_id;

    FOR v_room IN
        SELECT * FROM public.campaign_rooms
        WHERE campaign_id = v_master_id
          AND LOWER(COALESCE(development_status, 'ready')) IN ('ready', 'completed')
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

    v_published_payload := jsonb_build_object(
        'campaign', jsonb_build_object(
            'id', v_master_camp.id,
            'title', v_master_camp.title,
            'share_code', 'MASTER',
            'version', COALESCE(v_master_camp.version, 1),
            'published_at', NOW()
        ),
        'rooms', v_rooms_json
    );

    UPDATE public.published_campaigns
    SET 
        title = v_master_camp.title,
        published_payload = v_published_payload,
        updated_at = NOW()
    WHERE share_code = 'MASTER';

    UPDATE public.campaigns
    SET 
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{published_payload}', v_published_payload),
        updated_at = NOW()
    WHERE id = v_master_id;

    RAISE NOTICE '✅ Đã chuẩn hóa toàn bộ content_payload và làm mới published_payload của MASTER!';
END;
$$;

