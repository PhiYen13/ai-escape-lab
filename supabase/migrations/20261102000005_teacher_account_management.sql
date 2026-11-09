-- ============================================================================
-- 20261102000005_teacher_account_management.sql
-- Dự án: AI Escape Lab - Quản lý Tài khoản Giáo viên & Phê duyệt Tập trung
-- ============================================================================
-- Mục tiêu:
-- 1. Mở rộng bảng public.profiles để quản lý trạng thái tài khoản:
--    - status: 'pending' | 'approved' | 'rejected' | 'suspended'
--    - creation_method: 'admin_created' | 'self_registered' | 'system_seed'
--    - must_change_password: BOOLEAN (yêu cầu đổi mật khẩu lần đầu cho tài khoản do Admin tạo)
--    - approved_by, approved_at, status_note
-- 2. Bảo toàn tài khoản Admin hiện tại (status = 'approved', creation_method = 'system_seed').
-- 3. Tài khoản tự đăng ký mới mặc định có status = 'pending', creation_method = 'self_registered'.
--    Xác nhận email KHÔNG tự động chuyển status sang 'approved' đối với giáo viên.
-- 4. Bổ sung hàm public.auth_is_approved_user() và siết chặt toàn bộ RLS Policies
--    trên campaigns, campaign_rooms, room_items cùng các RPC (clone_campaign,
--    validate_campaign, publish_campaign) để chặn hoàn toàn tài khoản pending /
--    rejected / suspended truy cập dữ liệu Teacher Studio (kể cả qua phiên cũ).
-- 5. Cung cấp các RPC quản trị an toàn cho Admin:
--    - public.admin_set_teacher_status(p_target_user_id, p_new_status, p_note)
--    - public.complete_first_password_change()
-- ============================================================================

-- 1. BỔ SUNG CÁC CỘT QUẢN LÝ TRẠNG THÁI VÀO BẢNG PUBLIC.PROFILES
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    ADD COLUMN IF NOT EXISTS creation_method TEXT NOT NULL DEFAULT 'self_registered'
        CHECK (creation_method IN ('admin_created', 'self_registered', 'system_seed')),
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_note TEXT NOT NULL DEFAULT '';

-- Đảm bảo tài khoản Admin hiện tại luôn ở trạng thái 'approved' và 'system_seed'
UPDATE public.profiles
SET status = 'approved',
    creation_method = 'system_seed',
    must_change_password = FALSE,
    approved_at = COALESCE(approved_at, NOW()),
    updated_at = NOW()
WHERE role = 'admin';

-- Ràng buộc bất biến: Tài khoản mang vai trò 'admin' không bao giờ bị chuyển sang trạng thái khác 'approved'
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS chk_admin_must_be_approved;
ALTER TABLE public.profiles
    ADD CONSTRAINT chk_admin_must_be_approved
    CHECK (role <> 'admin' OR status = 'approved');

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

-- 2. CẬP NHẬT HÀM KIỂM TRA QUYỀN ADMIN & HÀM KIỂM TRA NGƯỜI DÙNG ĐÃ PHÊ DUYỆT
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    );
END;
$$;

-- Hàm kiểm tra người dùng hiện tại đã được Admin phê duyệt và đang hoạt động hợp lệ
CREATE OR REPLACE FUNCTION public.auth_is_approved_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND status = 'approved'
          AND role IN ('admin', 'teacher')
    );
END;
$$;

-- 3. CẬP NHẬT TRIGGER TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ MỚI (HANDLE_NEW_USER)
-- Tuyệt đối không tin tưởng raw_user_meta_data cho role, status hay creation_method.
-- Mọi tài khoản tự đăng ký mới đều mặc định là role = 'teacher', status = 'pending'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT := 'teacher';
    v_status TEXT := 'pending';
    v_method TEXT := 'self_registered';
    v_is_verified BOOLEAN;
BEGIN
    v_is_verified := (NEW.email_confirmed_at IS NOT NULL) OR (NEW.confirmed_at IS NOT NULL);

    -- Chỉ cấp role = 'admin' và status = 'approved' nếu email nằm trong admin_whitelist VÀ đã xác minh
    IF v_is_verified AND EXISTS (SELECT 1 FROM public.admin_whitelist w WHERE LOWER(w.email) = LOWER(NEW.email)) THEN
        v_role := 'admin';
        v_status := 'approved';
        v_method := 'system_seed';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        school_name,
        status,
        creation_method,
        must_change_password,
        approved_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), ''),
        v_role,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'school_name'), ''), ''),
        v_status,
        v_method,
        FALSE,
        CASE WHEN v_status = 'approved' THEN NOW() ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = CASE WHEN v_role = 'admin' THEN 'admin' ELSE public.profiles.role END,
        status = CASE WHEN v_role = 'admin' THEN 'approved' ELSE public.profiles.status END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Cập nhật trigger xác nhận email:
-- Việc giáo viên xác nhận email KHÔNG tự động phê duyệt tài khoản (status vẫn giữ nguyên là 'pending').
-- Chỉ nâng cấp nếu email thuộc admin_whitelist.
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
       OR (NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL) THEN
        IF EXISTS (SELECT 1 FROM public.admin_whitelist w WHERE LOWER(w.email) = LOWER(NEW.email)) THEN
            UPDATE public.profiles
               SET role = 'admin',
                   status = 'approved',
                   creation_method = 'system_seed',
                   approved_at = COALESCE(approved_at, NOW()),
                   updated_at = NOW()
             WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. CẬP NHẬT TRIGGER CHỐNG TỰ NÂNG QUYỀN & TỰ PHÊ DUYỆT (PREVENT_ROLE_ESCALATION)
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_verified_whitelisted_admin BOOLEAN := FALSE;
    v_is_service_or_postgres BOOLEAN := FALSE;
BEGIN
    IF OLD.id <> NEW.id THEN
        RAISE EXCEPTION 'Không được phép thay đổi định danh (id) của hồ sơ!';
    END IF;

    -- Nhận diện phiên quản trị hệ thống (postgres / service_role từ Edge Function hoặc Migration)
    v_is_service_or_postgres := (
        current_user IN ('postgres', 'supabase_admin', 'service_role')
        OR COALESCE(auth.role(), '') = 'service_role'
    );

    -- Kiểm tra xem hồ sơ đích có thực sự nằm trong admin_whitelist và đã xác thực email hay không
    v_is_verified_whitelisted_admin := EXISTS (
        SELECT 1
        FROM auth.users u
        JOIN public.admin_whitelist w ON LOWER(w.email) = LOWER(u.email)
        WHERE u.id = NEW.id
          AND LOWER(u.email) = LOWER(NEW.email)
          AND (u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL)
    );

    -- Chặn đổi email trừ khi là Admin hoặc đồng bộ email khớp với auth.users
    IF OLD.email <> NEW.email THEN
        IF NOT (
            public.auth_is_admin()
            OR v_is_service_or_postgres
            OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.id AND LOWER(u.email) = LOWER(NEW.email))
        ) THEN
            RAISE EXCEPTION 'Bạn không có quyền thay đổi email của hồ sơ!';
        END IF;
    END IF;

    -- Kiểm soát thay đổi cột role
    IF OLD.role <> NEW.role THEN
        IF NEW.role = 'admin' THEN
            IF NOT v_is_verified_whitelisted_admin THEN
                RAISE EXCEPTION 'Không thể cấp quyền Admin cho tài khoản không thuộc admin_whitelist!';
            END IF;
        ELSE
            IF NOT (public.auth_is_admin() OR v_is_service_or_postgres) THEN
                RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò (role)!';
            END IF;
        END IF;
    END IF;

    -- Ràng buộc bất biến cho Admin:
    IF NEW.role = 'admin' AND NOT v_is_verified_whitelisted_admin THEN
        RAISE EXCEPTION 'Không thể cấp quyền Admin cho email không nằm trong danh sách quản trị (admin_whitelist) hoặc chưa xác thực email!';
    END IF;

    -- Bảo vệ tài khoản Admin: Không cho phép khóa hoặc hạ trạng thái của tài khoản Admin
    IF OLD.role = 'admin' AND (NEW.role <> 'admin' OR NEW.status <> 'approved') THEN
        RAISE EXCEPTION 'Không được phép khóa, từ chối hoặc hạ quyền tài khoản Quản trị viên (Admin)!';
    END IF;

    -- Chặn tuyệt đối người dùng thường tự thay đổi trạng thái phê duyệt (status) hoặc nguồn tạo (creation_method)
    IF (
        OLD.status IS DISTINCT FROM NEW.status
        OR OLD.creation_method IS DISTINCT FROM NEW.creation_method
        OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
        OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
        OR OLD.status_note IS DISTINCT FROM NEW.status_note
    ) THEN
        IF NOT (public.auth_is_admin() OR v_is_service_or_postgres) THEN
            RAISE EXCEPTION 'Bạn không có quyền tự thay đổi trạng thái phê duyệt của tài khoản!';
        END IF;
    END IF;

    -- Cột must_change_password: chỉ Admin, service_role hoặc chính chủ (khi đổi từ TRUE -> FALSE) được cập nhật
    IF OLD.must_change_password IS DISTINCT FROM NEW.must_change_password THEN
        IF NOT (
            public.auth_is_admin()
            OR v_is_service_or_postgres
            OR (auth.uid() = NEW.id AND OLD.must_change_password = TRUE AND NEW.must_change_password = FALSE)
        ) THEN
            RAISE EXCEPTION 'Bạn không có quyền thay đổi cờ yêu cầu đổi mật khẩu!';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- 5. CẬP NHẬT CHÍNH SÁCH RLS (ROW LEVEL SECURITY) ĐỂ CHẶN TÀI KHOẢN CHƯA PHÊ DUYỆT / BỊ KHÓA
-- A. Bảng profiles: Cho phép Admin cập nhật hồ sơ giáo viên (qua RPC hoặc Admin client)
DROP POLICY IF EXISTS "Admin update teacher profiles" ON public.profiles;
CREATE POLICY "Admin update teacher profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- B. Bảng campaigns: Bắt buộc public.auth_is_approved_user() = TRUE mới được đọc/ghi (kể cả đọc MASTER!)
DROP POLICY IF EXISTS "Teachers read own campaigns or templates" ON public.campaigns;
CREATE POLICY "Teachers read own campaigns or templates"
ON public.campaigns FOR SELECT TO authenticated
USING (
    public.auth_is_approved_user()
    AND (
        teacher_id = auth.uid()
        OR is_template = TRUE
        OR public.auth_is_admin()
    )
);

DROP POLICY IF EXISTS "Teachers insert own campaign" ON public.campaigns;
CREATE POLICY "Teachers insert own campaign"
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (
    public.auth_is_approved_user()
    AND teacher_id = auth.uid()
    AND (is_template = FALSE OR public.auth_is_admin())
);

DROP POLICY IF EXISTS "Teachers update own non-template campaigns" ON public.campaigns;
CREATE POLICY "Teachers update own non-template campaigns"
ON public.campaigns FOR UPDATE TO authenticated
USING (
    public.auth_is_approved_user()
    AND (
        (teacher_id = auth.uid() AND is_template = FALSE)
        OR public.auth_is_admin()
    )
)
WITH CHECK (
    public.auth_is_approved_user()
    AND (
        (teacher_id = auth.uid() AND is_template = FALSE)
        OR public.auth_is_admin()
    )
);

DROP POLICY IF EXISTS "Teachers delete own non-template campaigns" ON public.campaigns;
CREATE POLICY "Teachers delete own non-template campaigns"
ON public.campaigns FOR DELETE TO authenticated
USING (
    public.auth_is_approved_user()
    AND (
        (teacher_id = auth.uid() AND is_template = FALSE)
        OR (public.auth_is_admin() AND is_template = FALSE)
    )
);

-- C. Bảng campaign_rooms: Bắt buộc public.auth_is_approved_user() = TRUE
DROP POLICY IF EXISTS "Teachers read rooms of own campaign or template" ON public.campaign_rooms;
CREATE POLICY "Teachers read rooms of own campaign or template"
ON public.campaign_rooms FOR SELECT TO authenticated
USING (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND (c.teacher_id = auth.uid() OR c.is_template = TRUE OR public.auth_is_admin())
    )
);

DROP POLICY IF EXISTS "Teachers insert rooms to own non-template campaign" ON public.campaign_rooms;
CREATE POLICY "Teachers insert rooms to own non-template campaign"
ON public.campaign_rooms FOR INSERT TO authenticated
WITH CHECK (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

DROP POLICY IF EXISTS "Teachers update rooms of own non-template campaign" ON public.campaign_rooms;
CREATE POLICY "Teachers update rooms of own non-template campaign"
ON public.campaign_rooms FOR UPDATE TO authenticated
USING (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
)
WITH CHECK (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

DROP POLICY IF EXISTS "Teachers delete rooms of own non-template campaign" ON public.campaign_rooms;
CREATE POLICY "Teachers delete rooms of own non-template campaign"
ON public.campaign_rooms FOR DELETE TO authenticated
USING (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

-- D. Bảng room_items: Bắt buộc public.auth_is_approved_user() = TRUE
DROP POLICY IF EXISTS "Teachers read items of own campaign or template" ON public.room_items;
CREATE POLICY "Teachers read items of own campaign or template"
ON public.room_items FOR SELECT TO authenticated
USING (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND (c.teacher_id = auth.uid() OR c.is_template = TRUE OR public.auth_is_admin())
    )
);

DROP POLICY IF EXISTS "Teachers insert items to own non-template campaign" ON public.room_items;
CREATE POLICY "Teachers insert items to own non-template campaign"
ON public.room_items FOR INSERT TO authenticated
WITH CHECK (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

DROP POLICY IF EXISTS "Teachers update items of own non-template campaign" ON public.room_items;
CREATE POLICY "Teachers update items of own non-template campaign"
ON public.room_items FOR UPDATE TO authenticated
USING (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
)
WITH CHECK (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

DROP POLICY IF EXISTS "Teachers delete items of own non-template campaign" ON public.room_items;
CREATE POLICY "Teachers delete items of own non-template campaign"
ON public.room_items FOR DELETE TO authenticated
USING (
    public.auth_is_approved_user()
    AND EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

-- 6. CẬP NHẬT CÁC RPC CỦA TEACHER STUDIO ĐỂ CHẶN NGƯỜI CHƯA ĐƯỢC PHÊ DUYỆT
-- 6.1. Cập nhật validate_campaign: Bắt buộc đăng nhập & đã được phê duyệt
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
    v_room1_count INT := 0;
    v_grades INT[];
    v_task_count INT;
    v_secret_count INT;
    v_task_keys TEXT[];
    v_secret_keys TEXT[];
    v_digits_sorted TEXT;
    v_passcode_sorted TEXT;
    v_p JSONB;
    v_sub JSONB;
    v_elem JSONB;
    v_ans_len INT;
    v_it_len INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập để kiểm tra bộ đề!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt hoặc đã bị tạm khóa. Bạn không có quyền thực hiện thao tác này!';
    END IF;

    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy chiến dịch (campaign_id: %)!', p_campaign_id;
    END IF;

    IF v_camp.teacher_id <> auth.uid() AND v_camp.is_template = FALSE AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn không có quyền kiểm tra bộ đề riêng của giáo viên khác!';
    END IF;

    IF TRIM(COALESCE(v_camp.title, '')) = '' THEN
        RAISE EXCEPTION 'Tiêu đề bộ đề không được để trống!';
    END IF;

    IF v_camp.share_code IS NULL OR NOT (v_camp.share_code ~ '^[A-Za-z0-9_-]{3,20}$') THEN
        RAISE EXCEPTION 'Mã chia sẻ (share_code) không hợp lệ!';
    END IF;

    SELECT COUNT(*), ARRAY_AGG(grade ORDER BY grade)
    INTO v_room1_count, v_grades
    FROM public.campaign_rooms
    WHERE campaign_id = p_campaign_id AND room_number = 1;

    IF v_room1_count <> 3 OR v_grades <> ARRAY[3, 4, 5] THEN
        RAISE EXCEPTION 'Bộ đề phải có đủ 3 phòng (Room 01) cho cả 3 khối Lớp 3, Lớp 4 và Lớp 5!';
    END IF;

    FOR v_room IN
        SELECT * FROM public.campaign_rooms
        WHERE campaign_id = p_campaign_id AND room_number = 1
        ORDER BY grade
    LOOP
        IF TRIM(COALESCE(v_room.topic, '')) = '' THEN
            RAISE EXCEPTION 'Phòng Lớp % chưa có chủ đề bài học (topic)!', v_room.grade;
        END IF;

        IF v_room.passcode IS NULL OR NOT (v_room.passcode ~ '^[0-9]{4}$') THEN
            RAISE EXCEPTION 'Mật mã mở cửa (passcode) của Lớp % phải gồm đúng 4 chữ số!', v_room.grade;
        END IF;

        SELECT COUNT(*), ARRAY_AGG(item_key ORDER BY item_key)
        INTO v_task_count, v_task_keys
        FROM public.room_items
        WHERE room_id = v_room.id AND item_type = 'task';

        IF v_task_count <> 4 OR v_task_keys <> ARRAY['computer', 'library', 'map', 'station'] THEN
            RAISE EXCEPTION 'Phòng Lớp % phải có đủ 4 nhiệm vụ chính: map, computer, library, station!', v_room.grade;
        END IF;

        SELECT COUNT(*), ARRAY_AGG(item_key ORDER BY item_key)
        INTO v_secret_count, v_secret_keys
        FROM public.room_items
        WHERE room_id = v_room.id AND item_type = 'secret';

        IF v_secret_count <> 4 OR v_secret_keys <> ARRAY['book', 'chest', 'plant', 'robot'] THEN
            RAISE EXCEPTION 'Phòng Lớp % phải có đủ 4 vật phẩm bí mật: robot, plant, book, chest!', v_room.grade;
        END IF;

        SELECT STRING_AGG(digit, '' ORDER BY digit)
        INTO v_digits_sorted
        FROM public.room_items
        WHERE room_id = v_room.id AND item_type = 'task';

        SELECT STRING_AGG(ch, '' ORDER BY ch)
        INTO v_passcode_sorted
        FROM regexp_split_to_table(v_room.passcode, '') AS ch
        WHERE ch <> '';

        IF COALESCE(v_digits_sorted, '') <> COALESCE(v_passcode_sorted, '') THEN
            RAISE EXCEPTION 'Lớp %: 4 chữ số của 4 nhiệm vụ chính (%) không khớp với mật mã phòng (%)!',
                v_room.grade, COALESCE(v_digits_sorted, 'NULL'), v_room.passcode;
        END IF;

        FOR v_item IN
            SELECT * FROM public.room_items WHERE room_id = v_room.id ORDER BY sort_order
        LOOP
            IF TRIM(COALESCE(v_item.title, '')) = '' THEN
                RAISE EXCEPTION 'Lớp % - Vật phẩm "%": Tiêu đề không được để trống!', v_room.grade, v_item.item_key;
            END IF;

            IF v_item.item_type = 'task' AND (v_item.digit IS NULL OR NOT (v_item.digit ~ '^[0-9]$')) THEN
                RAISE EXCEPTION 'Lớp % - Nhiệm vụ "%": Phải có chữ số mật mã (digit) từ 0-9!', v_room.grade, v_item.item_key;
            END IF;

            IF v_item.item_type = 'secret' AND LENGTH(TRIM(COALESCE(v_item.hint, ''))) < 5 THEN
                RAISE EXCEPTION 'Lớp % - Vật phẩm bí mật "%": Gợi ý (hint) phải có ít nhất 5 ký tự!', v_room.grade, v_item.item_key;
            END IF;

            v_p := v_item.content_payload;
            IF v_p IS NULL OR jsonb_typeof(v_p) <> 'object' THEN
                RAISE EXCEPTION 'Lớp % - Vật phẩm "%": content_payload không hợp lệ!', v_room.grade, v_item.item_key;
            END IF;

            IF v_item.kind = 'single' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng single phải có mảng answers từ 2 lựa chọn trở lên!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF jsonb_typeof(v_p->'correct') <> 'number'
                   OR (v_p->>'correct')::INT < 0
                   OR (v_p->>'correct')::INT >= v_ans_len THEN
                    RAISE EXCEPTION 'Thử thách "%": Đáp án đúng (correct) của dạng single nằm ngoài phạm vi!', v_item.item_key;
                END IF;
            ELSIF v_item.kind = 'multi' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có mảng answers từ 2 lựa chọn trở lên!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng multi phải có ít nhất 1 đáp án đúng trong mảng correct!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Chỉ số đáp án đúng trong mảng correct của dạng multi không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;
            ELSIF v_item.kind = 'sequence' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 1 THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng sequence phải có danh sách câu hỏi con (items)!', v_item.item_key;
                END IF;
                FOR v_sub IN SELECT jsonb_array_elements(v_p->'items') LOOP
                    IF jsonb_typeof(v_sub) <> 'object'
                       OR TRIM(COALESCE(v_sub->>'question', '')) = ''
                       OR jsonb_typeof(v_sub->'answers') <> 'array'
                       OR jsonb_array_length(v_sub->'answers') < 2
                       OR jsonb_typeof(v_sub->'correct') <> 'number'
                       OR (v_sub->>'correct')::INT < 0
                       OR (v_sub->>'correct')::INT >= jsonb_array_length(v_sub->'answers') THEN
                        RAISE EXCEPTION 'Thử thách "%": Một câu hỏi con trong chuỗi sequence có cấu trúc không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;
            ELSIF v_item.kind = 'match' THEN
                IF jsonb_typeof(v_p->'left') <> 'array' OR jsonb_typeof(v_p->'right') <> 'array' OR jsonb_typeof(v_p->'correct') <> 'array' THEN
                    RAISE EXCEPTION 'Thử thách "%": Dạng match phải có đủ các mảng left, right và correct!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'left');
                IF v_it_len < 2 OR v_it_len <> jsonb_array_length(v_p->'right') OR v_it_len <> jsonb_array_length(v_p->'correct') THEN
                    RAISE EXCEPTION 'Thử thách "%": Độ dài các mảng left, right, correct của dạng match phải bằng nhau và >= 2!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_it_len THEN
                        RAISE EXCEPTION 'Thử thách "%": Chỉ số ghép nối trong correct của dạng match không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;
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

-- 6.2. Cập nhật publish_campaign: Bắt buộc public.auth_is_approved_user() = TRUE
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi xuất bản bộ đề!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt hoặc đã bị tạm khóa. Bạn không có quyền xuất bản bộ đề!';
    END IF;

    SELECT * INTO v_camp FROM public.campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chiến dịch không tồn tại!';
    END IF;

    IF v_camp.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn không có quyền xuất bản bộ đề này!';
    END IF;

    PERFORM public.validate_campaign(p_campaign_id);

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

    UPDATE public.campaigns
    SET is_published = TRUE,
        version = v_new_version,
        updated_at = NOW()
    WHERE id = p_campaign_id;

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

-- 6.3. Cập nhật clone_campaign: Bắt buộc public.auth_is_approved_user() = TRUE
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi sao chép bộ đề!';
    END IF;

    IF NOT public.auth_is_approved_user() THEN
        RAISE EXCEPTION 'Tài khoản của bạn chưa được phê duyệt hoặc đã bị tạm khóa. Bạn không có quyền sao chép bộ đề!';
    END IF;

    SELECT * INTO v_source FROM public.campaigns WHERE id = p_source_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy bộ đề nguồn!';
    END IF;

    IF v_source.is_template = FALSE AND v_source.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Bạn chỉ có quyền sao chép bộ câu hỏi gốc (template) hoặc bộ đề do chính bạn sở hữu!';
    END IF;

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
        FALSE,
        FALSE,
        1,
        jsonb_build_object('cloned_from', p_source_campaign_id, 'cloned_at', NOW())
    )
    RETURNING id INTO v_new_camp_id;

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

-- 7. CÁC RPC QUẢN LÝ TÀI KHOẢN GIÁO VIÊN DÀNH CHO ADMIN
-- 7.1. RPC phê duyệt, từ chối, khóa hoặc mở khóa tài khoản giáo viên
CREATE OR REPLACE FUNCTION public.admin_set_teacher_status(
    p_target_user_id UUID,
    p_new_status TEXT,
    p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
BEGIN
    IF auth.uid() IS NULL OR NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Từ chối truy cập: Chỉ Quản trị viên (Admin) mới có quyền phê duyệt hoặc thay đổi trạng thái tài khoản giáo viên!';
    END IF;

    IF p_new_status IS NULL OR p_new_status NOT IN ('pending', 'approved', 'rejected', 'suspended') THEN
        RAISE EXCEPTION 'Trạng thái tài khoản không hợp lệ (%)!', COALESCE(p_new_status, 'NULL');
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_target_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ giáo viên cần cập nhật!';
    END IF;

    IF v_target.id = auth.uid() OR v_target.role = 'admin' THEN
        RAISE EXCEPTION 'Không được phép khóa, từ chối hoặc thay đổi trạng thái của tài khoản Quản trị viên (Admin)!';
    END IF;

    UPDATE public.profiles
    SET status = p_new_status,
        role = 'teacher',
        approved_by = CASE WHEN p_new_status = 'approved' THEN auth.uid() ELSE approved_by END,
        approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
        status_note = COALESCE(TRIM(p_note), ''),
        updated_at = NOW()
    WHERE id = p_target_user_id
    RETURNING * INTO v_target;

    RETURN jsonb_build_object(
        'success', TRUE,
        'id', v_target.id,
        'email', v_target.email,
        'full_name', v_target.full_name,
        'role', v_target.role,
        'status', v_target.status,
        'creation_method', v_target.creation_method,
        'approved_at', v_target.approved_at,
        'updated_at', v_target.updated_at
    );
END;
$$;

-- 7.2. RPC xác nhận giáo viên đã hoàn thành đổi mật khẩu lần đầu
CREATE OR REPLACE FUNCTION public.complete_first_password_change()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu đăng nhập!';
    END IF;

    UPDATE public.profiles
       SET must_change_password = FALSE,
           updated_at = NOW()
     WHERE id = auth.uid();

    RETURN TRUE;
END;
$$;

-- 8. PHÂN QUYỀN THỰC THI CHO CÁC HÀM MỚI
REVOKE ALL ON FUNCTION public.auth_is_approved_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_teacher_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_first_password_change() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.auth_is_approved_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_first_password_change() TO authenticated;

