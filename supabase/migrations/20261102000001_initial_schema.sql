-- ============================================================================
-- 20261102000001_initial_schema.sql (Bản sửa đổi xử lý đồng bộ Admin an toàn)
-- Dự án: AI Escape Lab - Quản lý nội dung giáo dục
-- ============================================================================

-- Bật extension pgcrypto để sinh UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BẢNG ADMIN WHITELIST (Danh sách email được định danh Admin chính thức)
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
    email TEXT PRIMARY KEY,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Thêm tài khoản Admin chính thức của dự án
INSERT INTO public.admin_whitelist (email, note)
VALUES ('yenttp@skylineschool.edu.vn', 'Quản trị viên trưởng hệ thống AI Escape Lab')
ON CONFLICT (email) DO UPDATE SET note = EXCLUDED.note;

-- 2. BẢNG HỒ SƠ NGƯỜI DÙNG (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
    school_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ĐỒNG BỘ TÀI KHOẢN ADMIN ĐÃ TỒN TẠI TỪ TRƯỚC
-- Chỉ cấp quyền admin nếu email nằm trong whitelist VÀ tài khoản đã được xác thực (email_confirmed_at IS NOT NULL)
-- Tuyệt đối không âm thầm nuốt lỗi bằng 'WHEN OTHERS THEN NULL'
DO $$
DECLARE
    v_admin_record RECORD;
BEGIN
    FOR v_admin_record IN 
        SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), 'Quản trị viên') AS full_name
        FROM auth.users u
        JOIN public.admin_whitelist w ON LOWER(w.email) = LOWER(u.email)
        WHERE u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL
    LOOP
        INSERT INTO public.profiles (id, email, full_name, role, school_name)
        VALUES (v_admin_record.id, v_admin_record.email, v_admin_record.full_name, 'admin', 'Sky-Line School')
        ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email, updated_at = NOW();

        RAISE NOTICE '✓ Đã đồng bộ quyền Admin cho tài khoản đã xác minh: % (UUID: %)', v_admin_record.email, v_admin_record.id;
    END LOOP;
END $$;

-- 3. BẢNG BỘ ĐỀ / CHIẾN DỊCH (CAMPAIGNS) - BẢN NHÁP LÀM VIỆC CỦA GIÁO VIÊN
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (TRIM(title) <> ''),
    share_code VARCHAR(20) UNIQUE NOT NULL CHECK (share_code ~ '^[A-Za-z0-9_-]{3,20}$'),
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BẢNG PHÒNG TRONG BỘ ĐỀ (CAMPAIGN_ROOMS) - HỖ TRỢ PHÒNG 01 ĐẾN 16
CREATE TABLE IF NOT EXISTS public.campaign_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    room_number INTEGER NOT NULL CHECK (room_number BETWEEN 1 AND 16),
    grade INTEGER NOT NULL CHECK (grade IN (3, 4, 5)),
    topic TEXT NOT NULL CHECK (TRIM(topic) <> ''),
    passcode VARCHAR(20) NOT NULL CHECK (TRIM(passcode) <> ''),
    theme TEXT DEFAULT 'Phòng thí nghiệm',
    accent_color VARCHAR(20) DEFAULT '#77e6a0',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campaign_room_grade UNIQUE (campaign_id, room_number, grade),
    -- Ràng buộc riêng cho Room 01: Mật mã bắt buộc phải gồm đúng 4 chữ số
    CONSTRAINT chk_room1_passcode_4digits CHECK (room_number <> 1 OR passcode ~ '^[0-9]{4}$')
);

-- 5. BẢNG THỬ THÁCH VÀ CÂU HỎI (ROOM_ITEMS) - MỞ RỘNG CHO ROOM 01, 02 VÀ 03
CREATE TABLE IF NOT EXISTS public.room_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.campaign_rooms(id) ON DELETE CASCADE,
    item_key VARCHAR(50) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('task', 'secret', 'station', 'checkpoint', 'hazard')),
    kind VARCHAR(50) NOT NULL CHECK (
        kind IN (
            -- Dạng câu hỏi chuẩn của Room 01
            'single', 'multi', 'sequence', 'match', 'sort', 'order', 'pair',
            -- Dạng mini-game & trạm tương tác mở rộng cho Room 02
            'typing', 'fingers', 'rescue_search', 'rescue_usb', 'web_nav', 'share_files',
            -- Dạng hoạt động mê cung & an toàn mở rộng cho Room 03
            'assemble', 'touchpad_gate', 'tablet_gate', 'phone_gate', 'conveyor', 'hazard_safety'
        )
    ),
    title TEXT NOT NULL CHECK (TRIM(title) <> ''),
    intro TEXT,
    question TEXT NOT NULL DEFAULT '',
    digit CHAR(1) CHECK (digit IS NULL OR digit ~ '^[0-9]$'),
    hint TEXT,
    content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_item_key UNIQUE (room_id, item_key),
    CONSTRAINT chk_payload_is_object CHECK (jsonb_typeof(content_payload) = 'object')
);

-- 6. BẢNG BỘ ĐỀ ĐÃ XUẤT BẢN (PUBLISHED_CAMPAIGNS) - TÁCH BIỆT HOÀN TOÀN VỚI BẢN NHÁP
CREATE TABLE IF NOT EXISTS public.published_campaigns (
    share_code VARCHAR(20) PRIMARY KEY CHECK (share_code ~ '^[A-Za-z0-9_-]{3,20}$'),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    published_payload JSONB NOT NULL CHECK (jsonb_typeof(published_payload) = 'object'),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHỈ MỤC (INDEXES) TỐI ƯU HÓA TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_campaigns_teacher ON public.campaigns(teacher_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_share_code ON public.campaigns(share_code);
CREATE INDEX IF NOT EXISTS idx_campaign_rooms_campaign ON public.campaign_rooms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_room_items_room ON public.room_items(room_id);
CREATE INDEX IF NOT EXISTS idx_published_campaigns_lookup ON public.published_campaigns(share_code);
