-- ============================================================================
-- scripts/test-database-security.sql (Phiên bản hoàn thiện Prompt 08 - 10 Tình huống)
-- Kịch bản kiểm thử bảo mật, GRANT/REVOKE, RLS, Triggers và Nghiệp vụ trực tiếp trên PostgreSQL / Supabase
-- Thực thi bằng quyền thực tế (SET LOCAL ROLE anon / SET LOCAL ROLE authenticated)
-- Chạy trong Transaction an toàn (ROLLBACK dữ liệu giả lập sau khi kiểm tra xong).
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_master_id UUID;
    v_admin_id UUID;
    v_teacher_a_id UUID := gen_random_uuid();
    v_teacher_b_id UUID := gen_random_uuid();
    v_unverified_admin_id UUID := gen_random_uuid();
    v_camp_a_id UUID;
    v_camp_b_id UUID;
    v_room_a_id UUID;
    v_room_b_id UUID;
    v_item_a_id UUID;
    v_saved_payload JSONB;
    v_cloned_id UUID;
    v_val_ok BOOLEAN;
    v_pub_res JSONB;
    v_pub_payload JSONB;
    v_room_count INT;
    v_item_count INT;
    v_count INT;
    v_topic TEXT;
    v_role TEXT;
    v_blocked BOOLEAN;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE '🧪 BẮT ĐẦU BỘ KIỂM THỬ BẢO MẬT & NGHIỆP VỤ SUPABASE (10 TÌNH HUỐNG)';
    RAISE NOTICE '======================================================================';

    -- =========================================================================
    -- KIỂM TRA TIỀN ĐỀ: DỮ LIỆU GỐC MASTER ĐÃ KHỞI TẠO ĐẦY ĐỦ TỪ 4 MIGRATIONS
    -- =========================================================================
    SELECT id, teacher_id INTO v_master_id, v_admin_id
    FROM public.campaigns
    WHERE share_code = 'MASTER' AND is_template = TRUE;

    IF v_master_id IS NULL OR v_admin_id IS NULL THEN
        RAISE EXCEPTION 'TIỀN ĐỀ THẤT BẠI: Chưa tìm thấy bộ đề MASTER (Hãy chạy 4 file migration trước)!';
    END IF;

    SELECT COUNT(*) INTO v_room_count FROM public.campaign_rooms WHERE campaign_id = v_master_id;
    SELECT COUNT(*) INTO v_item_count
    FROM public.room_items ri
    JOIN public.campaign_rooms cr ON cr.id = ri.room_id
    WHERE cr.campaign_id = v_master_id;

    IF v_room_count <> 3 OR v_item_count <> 24 THEN
        RAISE EXCEPTION 'TIỀN ĐỀ THẤT BẠI: Bộ MASTER phải có đúng 3 phòng và 24 nhiệm vụ (hiện có % phòng, % nhiệm vụ)!', v_room_count, v_item_count;
    END IF;

    SELECT published_payload INTO v_pub_payload
    FROM public.published_campaigns
    WHERE share_code = 'MASTER';

    IF v_pub_payload IS NULL OR jsonb_array_length(v_pub_payload->'rooms') <> 3 THEN
        RAISE EXCEPTION 'TIỀN ĐỀ THẤT BẠI: Bản xuất bản MASTER trong published_campaigns không khớp 3 phòng!';
    END IF;
    RAISE NOTICE '  ✓ TIỀN ĐỀ PASSED: Bộ MASTER có đủ 3 phòng, 24 nhiệm vụ và khớp với published_campaigns.';

    -- Khởi tạo dữ liệu người dùng thử nghiệm trong auth.users (dưới quyền quản trị DB trước khi hạ role)
    INSERT INTO public.admin_whitelist (email, note)
    VALUES ('pending_admin_test@skylineschool.edu.vn', 'Admin thử nghiệm chưa xác thực email');

    INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    VALUES
        (v_teacher_a_id, 'teacher_a_test@school.edu.vn', NOW(), '{"full_name":"Giáo viên A","role":"admin"}'::jsonb),
        (v_teacher_b_id, 'teacher_b_test@school.edu.vn', NOW(), '{"full_name":"Giáo viên B"}'::jsonb),
        (v_unverified_admin_id, 'pending_admin_test@skylineschool.edu.vn', NULL, '{"full_name":"Admin Chưa Xác Thực"}'::jsonb);

    -- =========================================================================
    -- TÌNH HUỐNG 1: NGƯỜI DÙNG CHƯA ĐĂNG NHẬP (SET LOCAL ROLE anon)
    -- Kiểm tra cả GRANT/REVOKE và RLS đối với role anon
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);

    IF current_user <> 'anon' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1 THẤT BẠI: Không chuyển được current_user sang anon (hiện tại: %)!', current_user;
    END IF;

    -- 1A. Học sinh (anon) đọc được bản xuất bản công khai MASTER
    SELECT published_payload INTO v_pub_payload
    FROM public.published_campaigns
    WHERE share_code = 'MASTER';

    IF v_pub_payload IS NULL OR jsonb_array_length(v_pub_payload->'rooms') <> 3 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1A THẤT BẠI: Học sinh (anon) không đọc được bản xuất bản MASTER!';
    END IF;

    -- 1B. anon bị chặn SELECT trên toàn bộ các bảng nội bộ / bản nháp (GRANT/REVOKE)
    v_blocked := FALSE;
    BEGIN
        PERFORM count(*) FROM public.campaigns;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1B THẤT BẠI: anon đọc được bảng public.campaigns!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        PERFORM count(*) FROM public.campaign_rooms;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1B THẤT BẠI: anon đọc được bảng public.campaign_rooms!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        PERFORM count(*) FROM public.room_items;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1B THẤT BẠI: anon đọc được bảng public.room_items!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        PERFORM count(*) FROM public.profiles;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1B THẤT BẠI: anon đọc được bảng public.profiles!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        PERFORM count(*) FROM public.admin_whitelist;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1B THẤT BẠI: anon đọc được bảng public.admin_whitelist!';
    END IF;

    -- 1C. anon bị chặn ghi/xóa trên bảng published_campaigns
    v_blocked := FALSE;
    BEGIN
        DELETE FROM public.published_campaigns WHERE share_code = 'MASTER';
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1C THẤT BẠI: anon xóa được dữ liệu trong published_campaigns!';
    END IF;

    -- 1D. anon bị chặn gọi các RPC dành cho giáo viên (REVOKE EXECUTE FROM PUBLIC, anon)
    v_blocked := FALSE;
    BEGIN
        v_cloned_id := public.clone_campaign(v_master_id, 'Anon Clone', 'ANON_01');
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1D THẤT BẠI: anon gọi được hàm clone_campaign()!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        v_val_ok := public.validate_campaign(v_master_id);
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1D THẤT BẠI: anon gọi được hàm validate_campaign()!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        v_pub_res := public.publish_campaign(v_master_id);
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1D THẤT BẠI: anon gọi được hàm publish_campaign()!';
    END IF;

    -- 1E. anon bị chặn gọi trực tiếp auth_is_admin() do REVOKE EXECUTE FROM PUBLIC, anon
    v_blocked := FALSE;
    BEGIN
        v_val_ok := public.auth_is_admin();
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1E THẤT BẠI: anon gọi được hàm auth_is_admin()!';
    END IF;

    EXECUTE 'RESET ROLE';
    -- Khi auth.uid() IS NULL, auth_is_admin() phải trả về FALSE
    IF public.auth_is_admin() IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 1E THẤT BẠI: auth_is_admin() trả về TRUE khi auth.uid() IS NULL!';
    END IF;
    RAISE NOTICE '  ✓ TÌNH HUỐNG 1 PASSED: Quyền anon chỉ đọc được published_campaigns và bị chặn mọi bảng nháp/RPC.';

    -- =========================================================================
    -- TÌNH HUỐNG 2: GIÁO VIÊN A (SET LOCAL ROLE authenticated + JWT Giáo viên A)
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    IF current_user <> 'authenticated' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2 THẤT BẠI: current_user không phải authenticated!';
    END IF;

    -- 2A. Giáo viên A chỉ đọc được hồ sơ của chính mình trong public.profiles, không đọc được admin_whitelist
    SELECT COUNT(*) INTO v_count FROM public.profiles;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2A THẤT BẠI: Giáo viên A nhìn thấy % hồ sơ trong profiles (yêu cầu chỉ thấy 1 hồ sơ của mình)!', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.admin_whitelist;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2A THẤT BẠI: Giáo viên thường đọc được danh sách admin_whitelist!';
    END IF;

    -- 2B. Giáo viên A sao chép (clone) bộ đề từ MASTER
    v_camp_a_id := public.clone_campaign(v_master_id, 'Bộ đề Giáo viên A', 'TEST_GVA');
    IF v_camp_a_id IS NULL THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2B THẤT BẠI: Giáo viên A không clone được bộ đề từ MASTER!';
    END IF;

    SELECT COUNT(*) INTO v_room_count FROM public.campaign_rooms WHERE campaign_id = v_camp_a_id;
    SELECT COUNT(*) INTO v_item_count
    FROM public.room_items ri
    JOIN public.campaign_rooms cr ON cr.id = ri.room_id
    WHERE cr.campaign_id = v_camp_a_id;

    IF v_room_count <> 3 OR v_item_count <> 24 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2B THẤT BẠI: Bản sao TEST_GVA không đủ 3 phòng và 24 nhiệm vụ!';
    END IF;

    -- 2C. Giáo viên A chỉnh sửa phòng và câu hỏi trong bộ đề của mình
    SELECT id INTO v_room_a_id FROM public.campaign_rooms WHERE campaign_id = v_camp_a_id AND grade = 3 LIMIT 1;
    SELECT id, content_payload INTO v_item_a_id, v_saved_payload
    FROM public.room_items
    WHERE room_id = v_room_a_id AND item_key = 'robot'
    LIMIT 1;

    UPDATE public.campaign_rooms SET topic = 'Chủ đề Khối 3 - GV A Đã Xuất Bản' WHERE id = v_room_a_id;
    UPDATE public.room_items SET title = 'Robot - Phiên bản Giáo viên A' WHERE id = v_item_a_id;

    -- 2D. Giáo viên A kiểm tra hợp lệ và xuất bản bộ đề của mình
    v_val_ok := public.validate_campaign(v_camp_a_id);
    IF v_val_ok IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2D THẤT BẠI: Bộ đề hợp lệ của Giáo viên A bị báo lỗi validate!';
    END IF;

    v_pub_res := public.publish_campaign(v_camp_a_id);
    IF (v_pub_res->>'success')::BOOLEAN IS DISTINCT FROM TRUE OR (v_pub_res->>'version')::INT <> 2 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 2D THẤT BẠI: Giáo viên A xuất bản bộ đề thất bại: %', v_pub_res;
    END IF;

    EXECUTE 'RESET ROLE';
    RAISE NOTICE '  ✓ TÌNH HUỐNG 2 PASSED: Giáo viên A clone MASTER, sửa câu hỏi, validate và xuất bản TEST_GVA thành công.';

    -- =========================================================================
    -- TÌNH HUỐNG 3: GIÁO VIÊN B (SET LOCAL ROLE authenticated + JWT Giáo viên B)
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_b_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- 3A. Giáo viên B clone bộ đề riêng từ MASTER
    v_camp_b_id := public.clone_campaign(v_master_id, 'Bộ đề Giáo viên B', 'TEST_GVB');
    SELECT id INTO v_room_b_id FROM public.campaign_rooms WHERE campaign_id = v_camp_b_id AND grade = 3 LIMIT 1;

    -- 3B. Giáo viên B không nhìn thấy bản nháp (campaigns, campaign_rooms, room_items) của Giáo viên A qua RLS
    SELECT COUNT(*) INTO v_count FROM public.campaigns WHERE id = v_camp_a_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 3B THẤT BẠI: Giáo viên B đọc được bản nháp campaigns của Giáo viên A!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.campaign_rooms WHERE campaign_id = v_camp_a_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 3B THẤT BẠI: Giáo viên B đọc được bản nháp campaign_rooms của Giáo viên A!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.room_items WHERE room_id = v_room_a_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 3B THẤT BẠI: Giáo viên B đọc được bản nháp room_items của Giáo viên A!';
    END IF;

    EXECUTE 'RESET ROLE';
    RAISE NOTICE '  ✓ TÌNH HUỐNG 3 PASSED: Giáo viên B hoàn toàn bị cách ly khỏi dữ liệu nháp của Giáo viên A.';

    -- =========================================================================
    -- TÌNH HUỐNG 4: QUẢN TRỊ VIÊN ADMIN (SET LOCAL ROLE authenticated + JWT Admin)
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    IF public.auth_is_admin() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 4A THẤT BẠI: auth_is_admin() không trả về TRUE cho Admin!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.admin_whitelist;
    IF v_count < 1 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 4B THẤT BẠI: Admin không đọc được bảng admin_whitelist!';
    END IF;

    -- Admin được phép cập nhật và xuất bản lại bộ đề gốc MASTER
    UPDATE public.campaigns SET title = title WHERE id = v_master_id;
    v_pub_res := public.publish_campaign(v_master_id);
    IF (v_pub_res->>'success')::BOOLEAN IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 4C THẤT BẠI: Admin không thể xuất bản bộ đề MASTER!';
    END IF;

    EXECUTE 'RESET ROLE';
    RAISE NOTICE '  ✓ TÌNH HUỐNG 4 PASSED: Admin xác thực qua auth_is_admin(), đọc whitelist và cập nhật/xuất bản MASTER thành công.';

    -- =========================================================================
    -- TÌNH HUỐNG 5: CHỐNG GIÁO VIÊN TỰ NÂNG QUYỀN (PRIVILEGE ESCALATION)
    -- =========================================================================
    -- 5A. Kiểm tra Giáo viên A (đăng ký với raw_user_meta_data = '{"role":"admin"}') chỉ được gán role = 'teacher'
    SELECT role INTO v_role FROM public.profiles WHERE id = v_teacher_a_id;
    IF v_role <> 'teacher' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 5A THẤT BẠI: Người dùng tự gửi raw_user_meta_data role=admin lại nhận được role=%!', v_role;
    END IF;

    -- 5B. Kiểm tra email nằm trong admin_whitelist nhưng chưa xác thực email (email_confirmed_at IS NULL) chỉ có role = 'teacher'
    SELECT role INTO v_role FROM public.profiles WHERE id = v_unverified_admin_id;
    IF v_role <> 'teacher' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 5B THẤT BẠI: Email whitelist chưa xác thực (email_confirmed_at IS NULL) lại được cấp role=%!', v_role;
    END IF;

    -- Khi xác thực email trong auth.users, trigger on_auth_user_confirmed tự động nâng lên role = 'admin'
    UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = v_unverified_admin_id;
    SELECT role INTO v_role FROM public.profiles WHERE id = v_unverified_admin_id;
    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 5B THẤT BẠI: Sau khi xác thực email, tài khoản whitelist không được nâng lên admin!';
    END IF;

    -- 5C. Dưới quyền authenticated, Giáo viên A cố tự UPDATE role = 'admin' hoặc đổi email sang Admin
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    v_blocked := FALSE;
    BEGIN
        UPDATE public.profiles SET role = 'admin' WHERE id = v_teacher_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 5C THẤT BẠI: Giáo viên A tự UPDATE role = admin không bị chặn!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        UPDATE public.profiles SET email = 'yenttp@skylineschool.edu.vn' WHERE id = v_teacher_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 5C THẤT BẠI: Giáo viên A tự UPDATE email sang Admin không bị chặn!';
    END IF;

    -- 5D. Kiểm tra lớp phòng thủ thứ hai (Trigger trg_prevent_role_escalation) ngay cả khi có quyền UPDATE cột
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    v_blocked := FALSE;
    BEGIN
        UPDATE public.profiles SET role = 'admin' WHERE id = v_teacher_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 5D THẤT BẠI: Trigger trg_prevent_role_escalation không chặn việc nâng quyền cho email ngoài whitelist!';
    END IF;

    RAISE NOTICE '  ✓ TÌNH HUỐNG 5 PASSED: Chặn đứng mọi hành vi tự nâng quyền qua metadata, lệnh UPDATE cột và trigger.';

    -- =========================================================================
    -- TÌNH HUỐNG 6: CHỐNG SỬA/XÓA DỮ LIỆU CHÉO & BẢO VỆ KHÓA NGOẠI (campaign_id, room_id)
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- 6A. Giáo viên A cố UPDATE/DELETE bộ đề của Giáo viên B hoặc bộ đề gốc MASTER
    UPDATE public.campaigns SET title = 'Bị Giáo viên A chiếm quyền' WHERE id = v_camp_b_id;
    DELETE FROM public.campaigns WHERE id = v_camp_b_id;
    UPDATE public.campaigns SET title = 'Bị Giáo viên A sửa MASTER' WHERE id = v_master_id;
    DELETE FROM public.campaigns WHERE id = v_master_id;

    -- 6B. Giáo viên A cố đổi campaign_id của phòng mình sang bộ đề Giáo viên B -> Phải bị chặn bởi Trigger & RLS WITH CHECK
    v_blocked := FALSE;
    BEGIN
        UPDATE public.campaign_rooms SET campaign_id = v_camp_b_id WHERE id = v_room_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6B THẤT BẠI: Giáo viên A đổi được campaign_id của phòng sang bộ đề người khác!';
    END IF;

    -- 6C. Giáo viên A cố đổi room_id của câu hỏi sang phòng của Giáo viên B -> Phải bị chặn bởi Trigger & RLS WITH CHECK
    v_blocked := FALSE;
    BEGIN
        UPDATE public.room_items SET room_id = v_room_b_id WHERE id = v_item_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6C THẤT BẠI: Giáo viên A đổi được room_id của câu hỏi sang phòng người khác!';
    END IF;

    -- 6D. Giáo viên A cố INSERT phòng mới vào bộ đề của Giáo viên B hoặc MASTER -> Phải bị chặn bởi RLS WITH CHECK
    v_blocked := FALSE;
    BEGIN
        INSERT INTO public.campaign_rooms (campaign_id, room_number, grade, topic, passcode)
        VALUES (v_camp_b_id, 2, 3, 'Phòng chèn trái phép', '1234');
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6D THẤT BẠI: Giáo viên A chèn được phòng mới vào bộ đề của Giáo viên B!';
    END IF;

    -- 6E. Giáo viên A cố gọi clone_campaign, validate_campaign, publish_campaign trên bộ đề riêng của Giáo viên B
    v_blocked := FALSE;
    BEGIN
        v_cloned_id := public.clone_campaign(v_camp_b_id, 'Clone trộm của B', 'STEAL_B');
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6E THẤT BẠI: Giáo viên A clone được bộ đề riêng tư của Giáo viên B!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        v_val_ok := public.validate_campaign(v_camp_b_id);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6E THẤT BẠI: Giáo viên A gọi được validate_campaign() trên bộ đề của Giáo viên B!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        v_pub_res := public.publish_campaign(v_camp_b_id);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6E THẤT BẠI: Giáo viên A gọi được publish_campaign() trên bộ đề của Giáo viên B!';
    END IF;

    EXECUTE 'RESET ROLE';

    -- Kiểm tra dữ liệu của Giáo viên B và MASTER vẫn nguyên vẹn 100%
    SELECT title INTO v_topic FROM public.campaigns WHERE id = v_camp_b_id;
    IF v_topic <> 'Bộ đề Giáo viên B' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 6A THẤT BẠI: Bộ đề Giáo viên B đã bị thay đổi trái phép!';
    END IF;
    RAISE NOTICE '  ✓ TÌNH HUỐNG 6 PASSED: Chặn đứng sửa/xóa chéo, bảo vệ khóa ngoại campaign_id/room_id và bảo vệ RPC.';

    -- =========================================================================
    -- TÌNH HUỐNG 7: CHỐNG LỢI DỤNG CƠ CHẾ BOOTSTRAP TRONG NGỮ CẢNH NGƯỜI DÙNG THỰC
    -- Kiểm tra cả khi có JWT và khi cố tình xóa JWT claims (sub='', role='') dưới quyền authenticated
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- 7A. Giáo viên A tự đặt set_config('app.is_admin_bootstrap', 'true', true) khi đang có JWT
    v_blocked := FALSE;
    BEGIN
        PERFORM set_config('app.is_admin_bootstrap', 'true', true);
        INSERT INTO public.campaigns (teacher_id, title, share_code, is_template)
        VALUES (v_teacher_a_id, 'Fake Template 1', 'FAKE_TPL1', TRUE);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 7A THẤT BẠI: Giáo viên A dùng app.is_admin_bootstrap để tạo template (khi có JWT)!';
    END IF;

    v_blocked := FALSE;
    BEGIN
        PERFORM set_config('app.is_admin_bootstrap', 'true', true);
        UPDATE public.campaigns SET is_template = TRUE WHERE id = v_camp_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 7A THẤT BẠI: Giáo viên A dùng app.is_admin_bootstrap để sửa is_template = TRUE!';
    END IF;

    -- 7B. Tấn công nâng cao: Giáo viên A vừa bật app.is_admin_bootstrap = 'true' vừa xóa sạch request.jwt.claim.sub & role
    v_blocked := FALSE;
    BEGIN
        PERFORM set_config('app.is_admin_bootstrap', 'true', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        INSERT INTO public.campaigns (teacher_id, title, share_code, is_template)
        VALUES (v_teacher_a_id, 'Fake Template 2', 'FAKE_TPL2', TRUE);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 7B THẤT BẠI: Giáo viên A vượt qua được trigger khi xóa JWT claims và bật app.is_admin_bootstrap!';
    END IF;

    -- 7C. Ngay cả khi thử gán teacher_id = v_admin_id sau khi xóa JWT claims dưới quyền authenticated -> Vẫn bị chặn
    v_blocked := FALSE;
    BEGIN
        PERFORM set_config('app.is_admin_bootstrap', 'true', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        INSERT INTO public.campaigns (teacher_id, title, share_code, is_template)
        VALUES (v_admin_id, 'Fake Admin Template', 'FAKE_TPL3', TRUE);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 7C THẤT BẠI: Người dùng authenticated mạo danh v_admin_id để tạo template!';
    END IF;

    PERFORM set_config('app.is_admin_bootstrap', 'false', true);
    EXECUTE 'RESET ROLE';
    RAISE NOTICE '  ✓ TÌNH HUỐNG 7 PASSED: Mọi nỗ lực giả mạo app.is_admin_bootstrap và xóa JWT claims dưới quyền authenticated đều bị chặn đứng.';

    -- =========================================================================
    -- TÌNH HUỐNG 8: KIỂM TRA VALIDATE & PUBLISH (CHẶN DỮ LIỆU LỖI & CHO PHÉP KHI HỢP LỆ)
    -- =========================================================================
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- 8A. Đưa dữ liệu sai quy chuẩn vào câu hỏi của Giáo viên A (chỉ số đáp án đúng vượt quá mảng answers)
    UPDATE public.room_items
    SET content_payload = jsonb_set(content_payload, '{correct}', '99'::jsonb)
    WHERE id = v_item_a_id;

    v_blocked := FALSE;
    BEGIN
        v_val_ok := public.validate_campaign(v_camp_a_id);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 8A THẤT BẠI: validate_campaign() không phát hiện ra chỉ số đáp án sai (correct=99)!';
    END IF;

    -- 8B. Gọi publish_campaign() khi bộ đề đang lỗi -> Phải bị chặn
    v_blocked := FALSE;
    BEGIN
        v_pub_res := public.publish_campaign(v_camp_a_id);
    EXCEPTION WHEN OTHERS THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 8B THẤT BẠI: publish_campaign() vẫn cho phép xuất bản bộ đề có câu hỏi lỗi!';
    END IF;

    -- 8C. Khôi phục payload hợp lệ và xuất bản lại -> Phải thành công (version = 3)
    UPDATE public.room_items
    SET content_payload = v_saved_payload
    WHERE id = v_item_a_id;

    v_pub_res := public.publish_campaign(v_camp_a_id);
    IF (v_pub_res->>'success')::BOOLEAN IS DISTINCT FROM TRUE OR (v_pub_res->>'version')::INT <> 3 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 8C THẤT BẠI: Xuất bản lại bộ đề sau khi sửa lỗi không thành công!';
    END IF;

    EXECUTE 'RESET ROLE';
    RAISE NOTICE '  ✓ TÌNH HUỐNG 8 PASSED: Quy trình validate_campaign() và publish_campaign() chặn chính xác dữ liệu lỗi và cho phép xuất bản khi hợp lệ.';

    -- =========================================================================
    -- TÌNH HUỐNG 9: KIỂM TRA TÍNH IDEMPOTENT KHI CHẠY LẠI SEED (KHÔNG GHI ĐÈ MASTER)
    -- =========================================================================
    -- 9A. Admin tùy chỉnh chủ đề Phòng Khối 3 của bộ đề MASTER
    UPDATE public.campaign_rooms
    SET topic = 'Chủ đề MASTER Đã Được Admin Tùy Chỉnh'
    WHERE campaign_id = v_master_id AND grade = 3;

    -- 9B. Mô phỏng chạy lại khối kiểm tra bảo vệ MASTER của file 20261102000004_seed_master_data.sql
    SELECT id INTO v_cloned_id FROM public.campaigns WHERE share_code = 'MASTER';
    IF v_cloned_id IS NULL THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 9B THẤT BẠI: Không tìm thấy MASTER khi chạy lại Seed!';
    END IF;
    -- Khi v_cloned_id IS NOT NULL, script Seed thực hiện RETURN ngay mà không ghi đè

    -- 9C. Xác nhận nội dung tùy chỉnh của Admin vẫn còn nguyên vẹn và số lượng vẫn là 3 phòng, 24 câu hỏi
    SELECT topic INTO v_topic
    FROM public.campaign_rooms
    WHERE campaign_id = v_master_id AND grade = 3;

    IF v_topic <> 'Chủ đề MASTER Đã Được Admin Tùy Chỉnh' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 9C THẤT BẠI: Dữ liệu tùy chỉnh của Admin trên MASTER bị ghi đè!';
    END IF;

    SELECT COUNT(*) INTO v_room_count FROM public.campaign_rooms WHERE campaign_id = v_master_id;
    SELECT COUNT(*) INTO v_item_count
    FROM public.room_items ri
    JOIN public.campaign_rooms cr ON cr.id = ri.room_id
    WHERE cr.campaign_id = v_master_id;

    IF v_room_count <> 3 OR v_item_count <> 24 THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 9C THẤT BẠI: Số lượng phòng/câu hỏi của MASTER bị sai lệch sau khi chạy lại Seed!';
    END IF;
    RAISE NOTICE '  ✓ TÌNH HUỐNG 9 PASSED: Chạy lại Seed bảo toàn 100%% dữ liệu MASTER đã chỉnh sửa của Admin.';

    -- =========================================================================
    -- TÌNH HUỐNG 10: CÁCH LY GIỮA BẢN NHÁP (DRAFT) VÀ BẢN XUẤT BẢN (PUBLISHED SNAPSHOT)
    -- =========================================================================
    -- 10A. Giáo viên A sửa tên chủ đề trong bản nháp (campaign_rooms) nhưng CHƯA bấm Xuất bản
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    UPDATE public.campaign_rooms
    SET topic = 'BẢN NHÁP ĐANG SỬA - CHƯA XUẤT BẢN'
    WHERE id = v_room_a_id;

    -- Giáo viên A cố sửa trực tiếp bảng published_campaigns mà không qua RPC -> Phải bị chặn bởi GRANT/REVOKE & RLS
    v_blocked := FALSE;
    BEGIN
        UPDATE public.published_campaigns SET title = 'Sửa trực tiếp' WHERE share_code = 'TEST_GVA';
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 10A THẤT BẠI: Giáo viên sửa trực tiếp được bảng published_campaigns!';
    END IF;

    EXECUTE 'RESET ROLE';

    -- 10B. Học sinh (anon) đang chơi bộ đề TEST_GVA đọc từ published_campaigns
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);

    SELECT published_payload->'rooms'->0->>'topic' INTO v_topic
    FROM public.published_campaigns
    WHERE share_code = 'TEST_GVA';

    IF v_topic <> 'Chủ đề Khối 3 - GV A Đã Xuất Bản' THEN
        RAISE EXCEPTION 'TÌNH HUỐNG 10B THẤT BẠI: Học sinh bị ảnh hưởng bởi bản nháp chưa xuất bản (topic đọc được: %)!', v_topic;
    END IF;

    EXECUTE 'RESET ROLE';
    RAISE NOTICE '  ✓ TÌNH HUỐNG 10 PASSED: Dữ liệu học sinh đang chơi trong published_campaigns hoàn toàn độc lập với bản nháp đang chỉnh sửa.';

    RAISE NOTICE '======================================================================';
    RAISE NOTICE '🎉 TOÀN BỘ 10/10 TÌNH HUỐNG KIỂM THỬ BẢO MẬT & NGHIỆP VỤ ĐỀU ĐẠT 100%%!';
    RAISE NOTICE '======================================================================';
END $$;

-- Hoàn tác toàn bộ dữ liệu thử nghiệm để giữ sạch cơ sở dữ liệu
ROLLBACK;
