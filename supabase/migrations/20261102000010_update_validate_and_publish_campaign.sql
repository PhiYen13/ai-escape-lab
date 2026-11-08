-- ============================================================================
-- 20261102000010_update_validate_and_publish_campaign.sql
-- Dự án: AI Escape Lab
-- Mục tiêu:
--   1. Cập nhật hàm public.validate_campaign(p_campaign_id UUID):
--      - Cho phép xuất bản linh hoạt số phòng (không cố định 3 hay 7 phòng).
--      - Kiểm tra độ phủ đủ 3 khối lớp bắt buộc: Khối 3, Khối 4 và Khối 5 (mỗi khối >= 1 phòng ready).
--      - Chỉ kiểm tra các phòng có trạng thái ready / completed (bỏ qua unbuilt / maintenance).
--      - Kiểm tra chống trùng lặp (grade, room_number).
--      - Áp dụng kiểm tra theo module tương ứng:
--        * Point & Click (Phòng 1): kiểm tra mật mã 4 số, 4 tasks, 4 secrets, 4 digit thưởng khớp mã.
--        * Khám phá phục hồi (Phòng 2): kiểm tra 4 trạm lý thuyết và 4 nhiệm vụ khôi phục, không ép mật mã 4 số.
--        * Mê cung máy tính (Phòng 3): kiểm tra đủ 9 thử thách, không ép mật mã 4 số.
--      - Hỗ trợ đầy đủ các dạng câu hỏi mở rộng (station lý thuyết, typing, fingers, website,
--        search, usb_rescue, share, smartphone, laptop/tablet).
--   2. Cập nhật hàm public.publish_campaign(p_campaign_id UUID):
--      - Chỉ đóng gói các phòng ready / completed.
--      - Đóng gói đầy đủ mảng "items" song song với "tasks" và "secrets" để tương thích 100% với
--        tất cả phiên bản game client (game.js, room2.js, room3.js).
--      - Bảo toàn snapshot và phiên bản công khai cho cả MASTER và bộ đề của Giáo viên.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HÀM KIỂM TRA ĐIỀU KIỆN XUẤT BẢN TOÀN DIỆN (VALIDATE_CAMPAIGN)
-- ----------------------------------------------------------------------------
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
    v_grades_covered INT[];
    v_module_id TEXT;
BEGIN
    -- Yêu cầu đăng nhập: auth.uid() bắt buộc phải tồn tại
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi kiểm tra dữ liệu!';
    END IF;

    -- Kiểm tra tài khoản được duyệt
    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt để thực hiện thao tác này!';
    END IF;

    -- Kiểm tra quyền truy cập: Chỉ chủ sở hữu bộ đề, hoặc Admin, hoặc template công khai
    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bộ đề không tồn tại!';
    END IF;

    IF v_camp.teacher_id <> auth.uid() AND v_camp.is_template = FALSE AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Không tìm thấy bộ đề hoặc bạn không có quyền truy cập!';
    END IF;

    -- Kiểm tra phủ đủ 3 khối bắt buộc (Khối 3, 4, 5) có phòng ready
    SELECT array_agg(DISTINCT grade) INTO v_grades_covered
    FROM public.campaign_rooms
    WHERE campaign_id = p_campaign_id 
      AND COALESCE(development_status, 'ready') IN ('ready', 'completed');

    IF v_grades_covered IS NULL OR NOT (3 = ANY(v_grades_covered) AND 4 = ANY(v_grades_covered) AND 5 = ANY(v_grades_covered)) THEN
        RAISE EXCEPTION 'Bộ đề phải có ít nhất một phòng sẵn sàng (ready) cho từng khối lớp bắt buộc (Khối 3, Khối 4 và Khối 5)!';
    END IF;

    -- Kiểm tra chống trùng lặp (grade, room_number)
    IF EXISTS (
        SELECT grade, room_number, COUNT(*)
        FROM public.campaign_rooms
        WHERE campaign_id = p_campaign_id
          AND COALESCE(development_status, 'ready') IN ('ready', 'completed')
        GROUP BY grade, room_number
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Phát hiện phòng trùng lặp trong cùng một khối lớp!';
    END IF;

    -- Kiểm tra từng phòng ready trong campaign
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms 
        WHERE campaign_id = p_campaign_id 
          AND COALESCE(development_status, 'ready') IN ('ready', 'completed')
        ORDER BY grade, room_number
    LOOP
        -- Kiểm tra tiêu đề phòng
        IF v_room.topic IS NULL OR TRIM(v_room.topic) = '' THEN
            RAISE EXCEPTION 'Phòng 0% (Khối %): Tên chủ đề bài học không được để trống!', v_room.room_number, v_room.grade;
        END IF;

        v_module_id := COALESCE(v_room.module_id, 'escape_room_point_click_v1');

        -- QUY TẮC CHO MODULE POINT & CLICK (HOẶC PHÒNG 1)
        IF v_module_id = 'escape_room_point_click_v1' THEN
            -- Kiểm tra mật mã phòng có đúng 4 chữ số không
            IF v_room.passcode IS NULL OR NOT (v_room.passcode ~ '^[0-9]{4}$') THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Mật mã mở cửa phải gồm đúng 4 chữ số (0-9)!', v_room.room_number, v_room.grade;
            END IF;

            -- Đếm số task và secret
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

            -- Thu thập các chữ số của task
            v_task_digits := ARRAY(
                SELECT digit FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'task' AND digit IS NOT NULL AND digit ~ '^[0-9]$'
            );

            IF array_length(v_task_digits, 1) <> 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Cả 4 nhiệm vụ chính đều phải có 1 chữ số phần thưởng hợp lệ (0-9)!', v_room.room_number, v_room.grade;
            END IF;

            -- Kiểm tra tính nhất quán: 4 chữ số của task khi xếp lại phải khớp với 4 chữ số của passcode
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_digits FROM unnest(v_task_digits) AS ch;
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_passcode FROM regexp_split_to_table(v_room.passcode, '') AS ch;

            IF v_sorted_digits <> v_sorted_passcode THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Bốn chữ số của các nhiệm vụ [%] không thể ghép thành mật mã mở cửa [%]!', 
                    v_room.room_number, v_room.grade, array_to_string(v_task_digits, ', '), v_room.passcode;
            END IF;

            -- Kiểm tra secret có gợi ý manh mối không
            IF EXISTS (
                SELECT 1 FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'secret' AND (hint IS NULL OR LENGTH(TRIM(hint)) < 5)
            ) THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Tất cả các manh mối bí mật phải có nội dung hướng dẫn giải mã cụ thể!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- QUY TẮC CHO MODULE LAB EXPLORATION REPAIR
        IF v_module_id = 'lab_exploration_repair_v1' THEN
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id AND item_type = 'station') < 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Khám phá phục hồi yêu cầu đủ 4 trạm kiến thức!', v_room.room_number, v_room.grade;
            END IF;
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id AND item_type = 'task') < 4 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Khám phá phục hồi yêu cầu đủ 4 nhiệm vụ khôi phục!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- QUY TẮC CHO MODULE COMPUTER MAZE ADVENTURE
        IF v_module_id = 'computer_maze_adventure_v1' THEN
            IF (SELECT COUNT(*) FROM public.room_items WHERE room_id = v_room.id) < 9 THEN
                RAISE EXCEPTION 'Phòng 0% (Khối %): Module Mê cung máy tính yêu cầu đủ 9 thử thách!', v_room.room_number, v_room.grade;
            END IF;
        END IF;

        -- KIỂM TRA CẤU TRÚC DỮ LIỆU CỦA TỪNG THỬ THÁCH (ITEM) TRONG PHÒNG
        FOR v_item IN 
            SELECT * FROM public.room_items WHERE room_id = v_room.id
        LOOP
            IF v_item.title IS NULL OR TRIM(v_item.title) = '' THEN
                RAISE EXCEPTION 'Phòng % (Khối %): Thử thách "%" chưa có tiêu đề!', v_room.room_number, v_room.grade, v_item.item_key;
            END IF;

            v_p := COALESCE(v_item.content_payload, '{}'::jsonb);

            -- Nếu là station lý thuyết trong Lab Exploration Repair: kiểm tra theory và example
            IF v_item.item_type = 'station' THEN
                IF COALESCE(v_item.intro, v_p->>'theory', '') = '' THEN
                    RAISE EXCEPTION 'Trạm "%" (Khối %): Nội dung lý thuyết không được để trống!', v_item.item_key, v_room.grade;
                END IF;
                IF COALESCE(v_item.question, v_p->>'example', '') = '' THEN
                    RAISE EXCEPTION 'Trạm "%" (Khối %): Ví dụ minh họa không được để trống!', v_item.item_key, v_room.grade;
                END IF;

            -- 1. Dạng Trắc nghiệm 1 đáp án (single)
            ELSIF v_item.kind = 'single' THEN
                -- Nếu là thiết bị thao tác trong Mê cung (laptop, tablet): hợp lệ
                IF v_p->>'device_type' IN ('laptop', 'tablet') THEN
                    NULL;
                -- Nếu là bàn phím ảo smartphone
                ELSIF v_p->>'device_type' = 'smartphone' OR v_item.item_key = 'station_auth' THEN
                    IF v_p->>'target_code' IS NULL OR TRIM(v_p->>'target_code') = '' THEN
                        RAISE EXCEPTION 'Thử thách "%": Mật mã bàn phím ảo (target_code) không được để trống!', v_item.item_key;
                    END IF;
                -- Nếu là chế độ gõ phím
                ELSIF v_p->>'task_mode' = 'typing' THEN
                    IF jsonb_typeof(v_p->'lines') <> 'array' OR jsonb_array_length(v_p->'lines') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ luyện gõ cần ít nhất 1 dòng văn bản!', v_item.item_key;
                    END IF;
                -- Nếu là chế độ ngón tay
                ELSIF v_p->>'task_mode' = 'fingers' THEN
                    IF jsonb_typeof(v_p->'digits') <> 'array' OR jsonb_array_length(v_p->'digits') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ hàng phím số cần danh sách phím số!', v_item.item_key;
                    END IF;
                -- Nếu là chế độ website
                ELSIF v_p->>'task_mode' = 'website' THEN
                    IF jsonb_typeof(v_p->'entries') <> 'array' OR jsonb_array_length(v_p->'entries') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Danh sách nút giao diện website không được để trống!', v_item.item_key;
                    END IF;
                -- Nếu là chế độ tìm kiếm
                ELSIF v_p->>'task_mode' = 'search' THEN
                    IF v_p->>'article_title' IS NULL OR TRIM(v_p->>'article_title') = '' THEN
                        RAISE EXCEPTION 'Thử thách "%": Tiêu đề bài viết tìm kiếm không được để trống!', v_item.item_key;
                    END IF;
                    IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ tìm kiếm cần ít nhất 2 lựa chọn an toàn!', v_item.item_key;
                    END IF;
                -- Nếu là cứu hộ USB
                ELSIF v_p->>'task_mode' = 'usb_rescue' THEN
                    IF jsonb_typeof(v_p->'files') <> 'array' OR jsonb_array_length(v_p->'files') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Cần ít nhất 2 tệp trong mô phỏng USB!', v_item.item_key;
                    END IF;
                -- Trắc nghiệm đơn chuẩn
                ELSE
                    IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Dạng single phải có mảng answers với ít nhất 2 phương án lựa chọn!', v_item.item_key;
                    END IF;
                    v_ans_len := jsonb_array_length(v_p->'answers');
                    IF v_p->>'correct' IS NULL OR NOT (v_p->>'correct' ~ '^[0-9]+$') OR (v_p->>'correct')::INT < 0 OR (v_p->>'correct')::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Đáp án đúng (correct) phải là số nguyên từ 0 đến %!', v_item.item_key, v_ans_len - 1;
                    END IF;
                END IF;

            -- 2. Dạng Chọn nhiều đáp án (multi)
            ELSIF v_item.kind = 'multi' THEN
                IF v_p->>'task_mode' = 'share' THEN
                    IF jsonb_typeof(v_p->'files') <> 'array' OR jsonb_array_length(v_p->'files') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ chia sẻ cần ít nhất 2 tệp trong danh sách!', v_item.item_key;
                    END IF;
                    IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Chế độ chia sẻ phải có ít nhất 1 đáp án đúng!', v_item.item_key;
                    END IF;
                ELSE
                    IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                        RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có mảng answers với ít nhất 2 lựa chọn!', v_item.item_key;
                    END IF;
                    v_ans_len := jsonb_array_length(v_p->'answers');
                    IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                        RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có mảng correct với ít nhất 1 đáp án đúng!', v_item.item_key;
                    END IF;
                    FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                        IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                            RAISE EXCEPTION 'Thử thách "%": Chỉ số đáp án % trong mảng multi correct không hợp lệ!', v_item.item_key, v_elem;
                        END IF;
                    END LOOP;
                END IF;

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


-- ----------------------------------------------------------------------------
-- 2. HÀM ĐÓNG GÓI XUẤT BẢN BỘ ĐỀ (PUBLISH_CAMPAIGN)
-- ----------------------------------------------------------------------------
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

    -- 6. Đóng gói payload xuất bản hoàn chỉnh
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
        published_at = NOW();

    -- 8. Cập nhật trạng thái chiến dịch gốc
    UPDATE public.campaigns
    SET is_published = TRUE,
        version = v_new_version,
        updated_at = NOW()
    WHERE id = p_campaign_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'share_code', v_camp.share_code,
        'version', v_new_version,
        'room_count', jsonb_array_length(v_rooms_json),
        'message', 'Xuất bản thành công!'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. PHÂN QUYỀN THỰC THI (SECURITY GRANTS)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.validate_campaign(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_campaign(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_campaign(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_campaign(UUID) TO authenticated;

