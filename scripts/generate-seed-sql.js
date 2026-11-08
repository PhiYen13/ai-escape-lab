'use strict';

/**
 * scripts/generate-seed-sql.js (Phiên bản hoàn thiện quy trình bootstrap & validation toàn diện)
 * 
 * Tự động chuyển đổi dữ liệu data/room01_master.json thành tệp SQL Migration an toàn:
 * supabase/migrations/20261102000004_seed_master_data.sql.
 * 
 * Các nguyên tắc an toàn:
 * 1. Không sử dụng custom GUC (app.is_admin_bootstrap) có thể bị người dùng gọi qua set_config().
 *    Trigger prevent_campaign_tampering (SECURITY INVOKER) xác minh trực tiếp role hệ thống PostgreSQL
 *    (current_user / session_user / pg_has_role(..., 'postgres', 'MEMBER')) và đối chiếu chủ sở hữu Admin.
 * 2. Xác minh danh tính Admin từ auth.users: Yêu cầu email đã xác thực (email_confirmed_at IS NOT NULL).
 * 3. Tách bạch hoàn toàn: Tự validate tương đương 100% với validate_campaign() và đóng gói xuất bản
 *    nội bộ bằng quyền quản trị, không phụ thuộc hàm publish_campaign() của giáo viên và không giả lập JWT.
 * 4. Chống ghi đè: Nếu bộ Master đã tồn tại, giữ nguyên toàn bộ các chỉnh sửa của Admin.
 * 5. Kiểm tra nghiêm ngặt 3 phòng, 24 câu hỏi, mật mã 4 số, chữ số thưởng, manh mối, cấu trúc JSONB
 *    của cả 7 dạng câu hỏi (single, multi, sequence, match, sort, order, pair) và đối chiếu bản xuất bản.
 */

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'data', 'room01_master.json');
const SQL_PATH = path.join(__dirname, '..', 'supabase', 'migrations', '20261102000004_seed_master_data.sql');

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function generateSql() {
  console.log('🔄 Đang đọc tệp data/room01_master.json...');
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  let sql = `-- ============================================================================
-- 20261102000004_seed_master_data.sql (Phiên bản hoàn thiện bootstrap & validation toàn diện)
-- Dự án: AI Escape Lab - Nạp bộ câu hỏi gốc Master Template (Room 01: Lớp 3, 4, 5)
-- ============================================================================

DO $$
DECLARE
    v_admin_id UUID;
    v_admin_verified BOOLEAN := FALSE;
    v_camp_id UUID;
    v_room_id UUID;
    v_room_count INT;
    v_item_count INT;
    v_task_count INT;
    v_secret_count INT;
    v_rooms_json JSONB := '[]'::jsonb;
    v_room_json JSONB;
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_item RECORD;
    v_room RECORD;
    v_item_data JSONB;
    v_published_payload JSONB;
    v_verified_payload JSONB;
    v_pub_room JSONB;
    v_task_digits TEXT[];
    v_sorted_digits TEXT;
    v_sorted_passcode TEXT;
    v_p JSONB;
    v_ans_len INT;
    v_it_len INT;
    v_elem JSONB;
BEGIN
    -- 1. XÁC MINH DANH TÍNH ADMIN TỪ SUPABASE AUTH & ĐỒNG BỘ PROFILES
    -- Không sử dụng custom GUC (app.is_admin_bootstrap); trigger xác minh trực tiếp qua auth.users & admin_whitelist
    SELECT u.id,
           ((u.email_confirmed_at IS NOT NULL) OR (u.confirmed_at IS NOT NULL))
    INTO v_admin_id, v_admin_verified
    FROM auth.users u
    JOIN public.admin_whitelist w ON LOWER(w.email) = LOWER(u.email)
    WHERE LOWER(u.email) = 'yenttp@skylineschool.edu.vn'
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION '⚠️ Chưa tìm thấy tài khoản Admin (yenttp@skylineschool.edu.vn) trong auth.users! Vui lòng vào Authentication > Users trên Supabase Dashboard để tạo tài khoản trước khi chạy file Seed này.';
    END IF;

    IF NOT v_admin_verified THEN
        RAISE EXCEPTION '⚠️ Tài khoản Admin (yenttp@skylineschool.edu.vn) trong auth.users chưa được xác minh email (email_confirmed_at IS NULL)! Vui lòng xác nhận email trên Supabase Auth Dashboard trước khi chạy Seed.';
    END IF;

    -- Đảm bảo hồ sơ Admin trong public.profiles được đồng bộ chính xác với role = 'admin'
    INSERT INTO public.profiles (id, email, full_name, role, school_name)
    VALUES (v_admin_id, 'yenttp@skylineschool.edu.vn', 'Quản trị viên (Admin)', 'admin', 'Sky-Line School')
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        email = EXCLUDED.email,
        updated_at = NOW();

    -- 2. BẢO VỆ DỮ LIỆU ĐÃ SỬA CỦA ADMIN:
    -- Nếu bộ Master đã tồn tại trong hệ thống, giữ nguyên nội dung hiện tại, không tự ý ghi đè.
    SELECT id INTO v_camp_id FROM public.campaigns WHERE share_code = 'MASTER';

    IF v_camp_id IS NOT NULL THEN
        RAISE NOTICE 'ℹ️ Bộ câu hỏi gốc (MASTER) đã tồn tại trong hệ thống. Để bảo vệ các chỉnh sửa trước đó của Admin, toàn bộ câu hỏi và phòng chơi sẽ được giữ nguyên (KHÔNG ghi đè).';
        RETURN;
    END IF;

    -- 4. TẠO MASTER CAMPAIGN MỚI (Khởi tạo lần đầu)
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
        v_admin_id,
        ${escapeSql(data.campaign.title)},
        'MASTER',
        TRUE,
        TRUE,
        1,
        ${escapeSql(JSON.stringify(data.campaign.metadata))}::jsonb
    )
    RETURNING id INTO v_camp_id;

    -- 5. NẠP DỮ LIỆU CÁC PHÒNG VÀ THỬ THÁCH (KHỐI 3, 4, 5)
`;

  data.rooms.forEach(room => {
    sql += `
    -- ========================================================================
    -- PHÒNG ${room.room_number} - KHỐI LỚP ${room.grade}: ${room.topic}
    -- ========================================================================
    INSERT INTO public.campaign_rooms (
        campaign_id,
        room_number,
        grade,
        topic,
        passcode,
        theme,
        accent_color
    )
    VALUES (
        v_camp_id,
        ${room.room_number},
        ${room.grade},
        ${escapeSql(room.topic)},
        ${escapeSql(room.passcode)},
        ${escapeSql(room.theme)},
        ${escapeSql(room.accent_color)}
    )
    RETURNING id INTO v_room_id;
`;

    room.items.forEach(item => {
      sql += `
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
        v_room_id,
        ${escapeSql(item.item_key)},
        ${escapeSql(item.item_type)},
        ${escapeSql(item.kind)},
        ${escapeSql(item.title)},
        ${escapeSql(item.intro)},
        ${escapeSql(item.question)},
        ${escapeSql(item.digit)},
        ${escapeSql(item.hint)},
        ${escapeSql(JSON.stringify(item.content_payload))}::jsonb,
        ${item.sort_order}
    );
`;
    });
  });

  sql += `
    -- 6. QUY TRÌNH VALIDATION TƯƠNG ĐƯƠNG 100% VỚI validate_campaign()
    -- Kiểm tra tổng số phòng (3 phòng: Khối 3, 4, 5) và tổng số nhiệm vụ (24 nhiệm vụ)
    SELECT COUNT(*) INTO v_room_count FROM public.campaign_rooms WHERE campaign_id = v_camp_id;
    SELECT COUNT(*) INTO v_item_count 
    FROM public.room_items r 
    JOIN public.campaign_rooms c ON c.id = r.room_id 
    WHERE c.campaign_id = v_camp_id;

    IF v_room_count <> 3 OR v_item_count <> 24 THEN
        RAISE EXCEPTION 'Dữ liệu MASTER nạp chưa đầy đủ (hiện có % phòng, % nhiệm vụ; yêu cầu đúng 3 phòng, 24 nhiệm vụ). Hủy bỏ xuất bản!', v_room_count, v_item_count;
    END IF;

    -- Kiểm tra chi tiết từng phòng và từng nhiệm vụ (mật mã, chữ số thưởng, manh mối, cấu trúc JSONB & đáp án đúng)
    FOR v_room IN SELECT * FROM public.campaign_rooms WHERE campaign_id = v_camp_id ORDER BY grade, room_number LOOP
        IF v_room.topic IS NULL OR TRIM(v_room.topic) = '' THEN
            RAISE EXCEPTION 'Phòng % (Khối %): Tên chủ đề không được để trống!', v_room.room_number, v_room.grade;
        END IF;

        IF v_room.room_number = 1 THEN
            IF v_room.passcode IS NULL OR NOT (v_room.passcode ~ '^[0-9]{4}$') THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Mật mã không đúng 4 chữ số!', v_room.grade;
            END IF;

            SELECT 
                COUNT(*) FILTER (WHERE item_type = 'task'),
                COUNT(*) FILTER (WHERE item_type = 'secret')
            INTO v_task_count, v_secret_count
            FROM public.room_items
            WHERE room_id = v_room.id;

            IF v_task_count <> 4 OR v_secret_count <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Phải có đúng 4 task và 4 secret (hiện có % task, % secret)!', v_room.grade, v_task_count, v_secret_count;
            END IF;

            v_task_digits := ARRAY(
                SELECT digit FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'task' AND digit IS NOT NULL AND digit ~ '^[0-9]$'
            );

            IF array_length(v_task_digits, 1) <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Thiếu chữ số phần thưởng của 4 nhiệm vụ chính!', v_room.grade;
            END IF;

            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_digits FROM unnest(v_task_digits) AS ch;
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_passcode FROM regexp_split_to_table(v_room.passcode, '') AS ch;

            IF v_sorted_digits <> v_sorted_passcode THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): 4 chữ số [%] không khớp mật mã [%]!', v_room.grade, array_to_string(v_task_digits, ','), v_room.passcode;
            END IF;

            IF EXISTS (
                SELECT 1 FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'secret' AND (hint IS NULL OR LENGTH(TRIM(hint)) < 5)
            ) THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Tất cả 4 manh mối bí mật phải có nội dung gợi ý giải mã (>= 5 ký tự)!', v_room.grade;
            END IF;
        END IF;

        -- Kiểm tra cấu trúc JSONB và đáp án đúng của từng nhiệm vụ trong phòng
        FOR v_item IN SELECT * FROM public.room_items WHERE room_id = v_room.id LOOP
            IF v_item.title IS NULL OR TRIM(v_item.title) = '' THEN
                RAISE EXCEPTION 'Phòng % (Khối %): Nhiệm vụ "%" chưa có tiêu đề!', v_room.room_number, v_room.grade, v_item.item_key;
            END IF;

            v_p := v_item.content_payload;

            IF v_item.kind = 'single' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng single phải có >= 2 phương án trả lời!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF v_p->>'correct' IS NULL OR NOT (v_p->>'correct' ~ '^[0-9]+$') OR (v_p->>'correct')::INT < 0 OR (v_p->>'correct')::INT >= v_ans_len THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Đáp án đúng của dạng single không hợp lệ!', v_item.item_key;
                END IF;

            ELSIF v_item.kind = 'multi' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng multi phải có >= 2 lựa chọn!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng multi phải có >= 1 đáp án đúng!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số đáp án multi không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'sequence' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng sequence phải có >= 2 câu hỏi con!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'items') LOOP
                    IF v_elem->>'question' IS NULL OR TRIM(v_elem->>'question') = ''
                       OR jsonb_typeof(v_elem->'answers') <> 'array' OR jsonb_array_length(v_elem->'answers') < 2 THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Câu hỏi con trong sequence không hợp lệ!', v_item.item_key;
                    END IF;
                    v_ans_len := jsonb_array_length(v_elem->'answers');
                    IF v_elem->>'correct' IS NULL OR NOT (v_elem->>'correct' ~ '^[0-9]+$') OR (v_elem->>'correct')::INT < 0 OR (v_elem->>'correct')::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Đáp án đúng của câu hỏi con trong sequence không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'match' THEN
                IF jsonb_typeof(v_p->'left') <> 'array' OR jsonb_typeof(v_p->'right') <> 'array'
                   OR jsonb_array_length(v_p->'left') <> jsonb_array_length(v_p->'right') OR jsonb_array_length(v_p->'left') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng match phải có 2 cột bằng nhau (>= 2)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'right');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> jsonb_array_length(v_p->'left') THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng match không khớp độ dài!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số đáp án match không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'sort' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_typeof(v_p->'groups') <> 'array'
                   OR jsonb_array_length(v_p->'items') < 2 OR jsonb_array_length(v_p->'groups') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng sort phải có items và groups (>= 2)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'groups');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> jsonb_array_length(v_p->'items') THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng sort không khớp số lượng items!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số nhóm sort không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'order' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng order phải có >= 2 bước!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'items');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> v_it_len THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng order không khớp số bước!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_it_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số thứ tự order không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'pair' THEN
                IF jsonb_typeof(v_p->'jobs') <> 'array' OR jsonb_typeof(v_p->'hardware') <> 'array' OR jsonb_typeof(v_p->'software') <> 'array'
                   OR jsonb_array_length(v_p->'jobs') < 2 OR jsonb_array_length(v_p->'hardware') < 2 OR jsonb_array_length(v_p->'software') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng pair thiếu mảng jobs, hardware hoặc software!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'jobs');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> v_it_len THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng pair không khớp số lượng jobs!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'array' OR jsonb_array_length(v_elem) <> 2
                       OR jsonb_typeof(v_elem->0) <> 'number' OR jsonb_typeof(v_elem->1) <> 'number'
                       OR ((v_elem->0)::TEXT)::INT < 0 OR ((v_elem->0)::TEXT)::INT >= jsonb_array_length(v_p->'hardware')
                       OR ((v_elem->1)::TEXT)::INT < 0 OR ((v_elem->1)::TEXT)::INT >= jsonb_array_length(v_p->'software') THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Cặp chỉ số [hardware, software] trong correct của dạng pair không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    -- 7. ĐÓNG GÓI VÀ XUẤT BẢN TRỰC TIẾP TỪ QUY TRÌNH QUẢN TRỊ SEED
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms 
        WHERE campaign_id = v_camp_id 
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

    v_published_payload := jsonb_build_object(
        'campaign', jsonb_build_object(
            'id', v_camp_id,
            'title', ${escapeSql(data.campaign.title)},
            'share_code', 'MASTER',
            'version', 1,
            'published_at', NOW()
        ),
        'rooms', v_rooms_json
    );

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
        v_admin_id,
        ${escapeSql(data.campaign.title)},
        1,
        v_published_payload,
        NOW()
    )
    ON CONFLICT (share_code) DO NOTHING;

    -- 8. ĐỐI CHIẾU DỮ LIỆU ĐÃ XUẤT BẢN KHỚP VỚI DỮ LIỆU ĐÃ KIỂM TRA
    SELECT published_payload INTO v_verified_payload
    FROM public.published_campaigns
    WHERE share_code = 'MASTER' AND campaign_id = v_camp_id;

    IF v_verified_payload IS NULL OR jsonb_typeof(v_verified_payload->'rooms') <> 'array'
       OR jsonb_array_length(v_verified_payload->'rooms') <> 3 THEN
        RAISE EXCEPTION 'Lỗi xuất bản MASTER: Dữ liệu trong published_campaigns không khớp 3 phòng đã kiểm tra!';
    END IF;

    FOR v_pub_room IN SELECT jsonb_array_elements(v_verified_payload->'rooms') LOOP
        IF (SELECT COUNT(*) FROM jsonb_object_keys(v_pub_room->'tasks')) <> 4
           OR (SELECT COUNT(*) FROM jsonb_object_keys(v_pub_room->'secrets')) <> 4 THEN
            RAISE EXCEPTION 'Lỗi xuất bản MASTER: Phòng khối % trong published_campaigns không đủ 4 tasks và 4 secrets!', v_pub_room->>'grade';
        END IF;
    END LOOP;

    RAISE NOTICE '✓ ĐÃ KHỞI TẠO, XÁC THỰC VÀ XUẤT BẢN THÀNH CÔNG BỘ CÂU HỎI GỐC (MASTER) ĐẦY ĐỦ 3 PHÒNG VÀ 24 THỬ THÁCH!';
END $$;
`;

  fs.writeFileSync(SQL_PATH, sql, 'utf8');
  console.log(`✓ Đã tạo thành công tệp SQL Seed tại: ${SQL_PATH}`);
}

try {
  generateSql();
} catch (err) {
  console.error('❌ Lỗi sinh SQL Seed:', err.message);
  process.exit(1);
}
