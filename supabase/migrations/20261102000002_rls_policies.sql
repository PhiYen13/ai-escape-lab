-- ============================================================================
-- 20261102000002_rls_policies.sql (Phiên bản hoàn thiện phân quyền & bảo vệ UPDATE)
-- Dự án: AI Escape Lab - Phân quyền và Bảo mật dữ liệu (Row Level Security)
-- ============================================================================

-- BẬT RLS TRÊN TẤT CẢ CÁC BẢNG
ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_campaigns ENABLE ROW LEVEL SECURITY;

-- 1. HÀM KIỂM TRA QUYỀN ADMIN DỰA DUY NHẤT VÀO auth.uid() TRONG BẢNG PROFILES
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
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

-- 2. TRIGGER TỰ ĐỘNG TẠO PROFILE VÀ XÁC THỰC EMAIL CHO ADMIN
-- Tuyệt đối không dựa vào raw_user_meta_data->>'role' do người dùng tự gửi.
-- Không âm thầm bỏ qua lỗi khởi tạo profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT := 'teacher';
    v_is_verified BOOLEAN;
BEGIN
    -- Kiểm tra xem email đã được xác minh từ Supabase Auth chưa
    v_is_verified := (NEW.email_confirmed_at IS NOT NULL) OR (NEW.confirmed_at IS NOT NULL);

    -- Chỉ cấp role = 'admin' nếu email nằm trong whitelist VÀ đã được xác minh danh tính qua Auth
    IF v_is_verified AND EXISTS (SELECT 1 FROM public.admin_whitelist w WHERE LOWER(w.email) = LOWER(NEW.email)) THEN
        v_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, school_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        v_role,
        COALESCE(NEW.raw_user_meta_data->>'school_name', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = CASE WHEN v_role = 'admin' THEN 'admin' ELSE public.profiles.role END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger tự động nâng cấp quyền Admin khi user xác nhận email sau khi đăng ký
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
            UPDATE public.profiles SET role = 'admin', updated_at = NOW() WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

-- 3. TRIGGER CHỐNG TỰ NÂNG QUYỀN VÀ ĐỔI EMAIL
-- Không dựa vào bất kỳ custom GUC (app.is_admin_bootstrap) nào do người dùng có thể gọi set_config().
-- Xác minh trực tiếp đối chiếu bảng hệ thống auth.users và public.admin_whitelist.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_verified_whitelisted_admin BOOLEAN := FALSE;
BEGIN
    IF OLD.id <> NEW.id THEN
        RAISE EXCEPTION 'Không được phép thay đổi định danh (id) của hồ sơ!';
    END IF;

    -- Kiểm tra xem hồ sơ đích có thực sự là tài khoản nằm trong admin_whitelist và đã xác thực email trong auth.users hay không
    v_is_verified_whitelisted_admin := EXISTS (
        SELECT 1
        FROM auth.users u
        JOIN public.admin_whitelist w ON LOWER(w.email) = LOWER(u.email)
        WHERE u.id = NEW.id
          AND LOWER(u.email) = LOWER(NEW.email)
          AND (u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL)
    );

    -- Chặn đổi email trừ khi là Admin hoặc đồng bộ email khớp với auth.users của chính user đó
    IF OLD.email <> NEW.email THEN
        IF NOT (
            public.auth_is_admin()
            OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.id AND LOWER(u.email) = LOWER(NEW.email))
        ) THEN
            RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò (role) hoặc email!';
        END IF;
    END IF;

    -- Kiểm soát thay đổi cột role
    IF OLD.role <> NEW.role THEN
        IF NEW.role = 'admin' THEN
            IF NOT v_is_verified_whitelisted_admin THEN
                RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò (role) hoặc email!';
            END IF;
        ELSE
            IF NOT public.auth_is_admin() THEN
                RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò (role) hoặc email!';
            END IF;
        END IF;
    END IF;

    -- Ràng buộc bất biến: mọi hồ sơ mang role = 'admin' bắt buộc phải nằm trong admin_whitelist và đã xác thực email
    IF NEW.role = 'admin' AND NOT v_is_verified_whitelisted_admin THEN
        RAISE EXCEPTION 'Không thể cấp quyền Admin cho email không nằm trong danh sách quản trị (admin_whitelist) hoặc chưa xác thực email!';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 4. TRIGGER BẢO VỆ TOÀN VẸN BỘ ĐỀ VÀ HỖ TRỢ MIGRATION SEED AN TOÀN
-- Sử dụng SECURITY INVOKER để bảo toàn current_user thực tế của phiên gọi (ngăn chặn việc mượn quyền owner postgres).
-- Không sử dụng custom GUC (app.is_admin_bootstrap) có thể bị giả mạo qua set_config().
CREATE OR REPLACE FUNCTION public.prevent_campaign_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_db_migration BOOLEAN := FALSE;
BEGIN
    -- Nhận diện phiên chạy Migration/Seed trực tiếp từ quản trị viên DB (postgres / supabase_admin):
    -- Vì hàm chạy ở chế độ SECURITY INVOKER, nếu người dùng gọi từ PostgREST hoặc phiên authenticated/anon,
    -- current_user sẽ là 'authenticated' hoặc 'anon' (không thể giả mạo qua set_config) và pg_has_role(..., 'postgres', 'MEMBER') luôn là FALSE.
    v_is_db_migration := (
        current_user NOT IN ('anon', 'authenticated', 'authenticator')
        AND session_user NOT IN ('anon', 'authenticated', 'authenticator')
        AND pg_has_role(current_user, 'postgres', 'MEMBER')
        AND auth.uid() IS NULL
        AND COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated')
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = NEW.teacher_id AND p.role = 'admin'
        )
    );

    IF TG_OP = 'UPDATE' THEN
        -- Chặn đổi chủ sở hữu trừ khi là Admin hoặc trong phiên DB migration hợp lệ
        IF OLD.teacher_id <> NEW.teacher_id AND NOT (public.auth_is_admin() OR v_is_db_migration) THEN
            RAISE EXCEPTION 'Không được phép thay đổi người sở hữu bộ đề!';
        END IF;

        -- Chặn giáo viên thường sửa bộ mẫu
        IF OLD.is_template = TRUE AND NOT (public.auth_is_admin() OR v_is_db_migration) THEN
            RAISE EXCEPTION 'Chỉ Admin mới có quyền chỉnh sửa bộ câu hỏi gốc!';
        END IF;
    END IF;

    -- Chặn giáo viên tự đánh dấu is_template = TRUE
    IF NEW.is_template = TRUE AND NOT (public.auth_is_admin() OR v_is_db_migration) THEN
        RAISE EXCEPTION 'Chỉ Admin mới có quyền tạo bộ câu hỏi gốc (template)!';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_campaign_tampering ON public.campaigns;
CREATE TRIGGER trg_prevent_campaign_tampering
    BEFORE INSERT OR UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.prevent_campaign_tampering();

-- 5. TRIGGER BẢO VỆ KHÓA NGOẠI: CHẶN CHUYỂN PHÒNG HOẶC CÂU HỎI SANG BỘ ĐỀ KHÁC
CREATE OR REPLACE FUNCTION public.prevent_room_foreign_key_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.campaign_id <> NEW.campaign_id THEN
        RAISE EXCEPTION 'Không được phép thay đổi campaign_id của phòng chơi!';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_room_fk_tampering ON public.campaign_rooms;
CREATE TRIGGER trg_prevent_room_fk_tampering
    BEFORE UPDATE ON public.campaign_rooms
    FOR EACH ROW EXECUTE FUNCTION public.prevent_room_foreign_key_tampering();

CREATE OR REPLACE FUNCTION public.prevent_item_foreign_key_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.room_id <> NEW.room_id THEN
        RAISE EXCEPTION 'Không được phép thay đổi room_id của thử thách!';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_item_fk_tampering ON public.room_items;
CREATE TRIGGER trg_prevent_item_fk_tampering
    BEFORE UPDATE ON public.room_items
    FOR EACH ROW EXECUTE FUNCTION public.prevent_item_foreign_key_tampering();

-- ============================================================================
-- PHÂN QUYỀN TRUY CẬP CẤP ĐỘ BẢNG VÀ CỘT (TABLE & COLUMN PERMISSIONS)
-- ============================================================================
REVOKE ALL ON public.admin_whitelist FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.campaign_rooms FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.room_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.published_campaigns FROM PUBLIC, anon, authenticated;

-- Cấp quyền bảng profiles: Giáo viên CHỈ ĐƯỢC UPDATE full_name và school_name
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, school_name, updated_at) ON public.profiles TO authenticated;

-- Cấp quyền các bảng bộ đề nháp cho authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_items TO authenticated;

-- Cấp quyền bảng xuất bản cho học sinh (anon) và giáo viên (authenticated) chỉ đọc
GRANT SELECT ON public.published_campaigns TO anon, authenticated;
GRANT SELECT ON public.admin_whitelist TO authenticated;

-- ============================================================================
-- CHÍNH SÁCH ROW LEVEL SECURITY (RLS) - BẢO VỆ CHẶT CẢ USING VÀ WITH CHECK
-- ============================================================================

-- A. BẢNG ADMIN_WHITELIST
CREATE POLICY "Admin only read whitelist"
ON public.admin_whitelist FOR SELECT TO authenticated
USING (public.auth_is_admin());

-- B. BẢNG PROFILES
CREATE POLICY "Users read own profile or admin read all"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.auth_is_admin());

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- C. BẢNG CAMPAIGNS (BẢN NHÁP)
CREATE POLICY "Teachers read own campaigns or templates"
ON public.campaigns FOR SELECT TO authenticated
USING (
    teacher_id = auth.uid() 
    OR is_template = TRUE 
    OR public.auth_is_admin()
);

CREATE POLICY "Teachers insert own campaign"
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (
    teacher_id = auth.uid() 
    AND (is_template = FALSE OR public.auth_is_admin())
);

CREATE POLICY "Teachers update own non-template campaigns"
ON public.campaigns FOR UPDATE TO authenticated
USING (
    (teacher_id = auth.uid() AND is_template = FALSE)
    OR public.auth_is_admin()
)
WITH CHECK (
    (teacher_id = auth.uid() AND is_template = FALSE)
    OR public.auth_is_admin()
);

CREATE POLICY "Teachers delete own non-template campaigns"
ON public.campaigns FOR DELETE TO authenticated
USING (
    (teacher_id = auth.uid() AND is_template = FALSE)
    OR (public.auth_is_admin() AND is_template = FALSE)
);

-- D. BẢNG CAMPAIGN_ROOMS (BẢN NHÁP)
CREATE POLICY "Teachers read rooms of own campaign or template"
ON public.campaign_rooms FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND (c.teacher_id = auth.uid() OR c.is_template = TRUE OR public.auth_is_admin())
    )
);

CREATE POLICY "Teachers insert rooms to own non-template campaign"
ON public.campaign_rooms FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

CREATE POLICY "Teachers update rooms of own non-template campaign"
ON public.campaign_rooms FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

CREATE POLICY "Teachers delete rooms of own non-template campaign"
ON public.campaign_rooms FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_rooms.campaign_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

-- E. BẢNG ROOM_ITEMS (BẢN NHÁP)
CREATE POLICY "Teachers read items of own campaign or template"
ON public.room_items FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND (c.teacher_id = auth.uid() OR c.is_template = TRUE OR public.auth_is_admin())
    )
);

CREATE POLICY "Teachers insert items to own non-template campaign"
ON public.room_items FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

CREATE POLICY "Teachers update items of own non-template campaign"
ON public.room_items FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

CREATE POLICY "Teachers delete items of own non-template campaign"
ON public.room_items FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campaign_rooms r
        JOIN public.campaigns c ON c.id = r.campaign_id
        WHERE r.id = room_items.room_id
        AND ((c.teacher_id = auth.uid() AND c.is_template = FALSE) OR public.auth_is_admin())
    )
);

-- F. BẢNG PUBLISHED_CAMPAIGNS (BẢN XUẤT BẢN CÔNG KHAI)
CREATE POLICY "Public read published campaigns"
ON public.published_campaigns FOR SELECT TO anon, authenticated
USING (TRUE);

CREATE POLICY "Disallow direct insert to published"
ON public.published_campaigns FOR INSERT TO authenticated
WITH CHECK (FALSE);

CREATE POLICY "Disallow direct update to published"
ON public.published_campaigns FOR UPDATE TO authenticated
USING (FALSE);

CREATE POLICY "Disallow direct delete to published"
ON public.published_campaigns FOR DELETE TO authenticated
USING (FALSE);
