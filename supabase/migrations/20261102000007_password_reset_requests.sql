-- ============================================================================
-- 20261102000007_password_reset_requests.sql
-- Dự án: AI Escape Lab - Bảng và RPC hỗ trợ yêu cầu khôi phục mật khẩu không dùng email
-- ============================================================================

-- 1. TẠO BẢNG public.password_reset_requests
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_note TEXT
);

-- Chỉ mục hỗ trợ truy vấn nhanh danh sách yêu cầu chờ xử lý và chống spam
CREATE INDEX IF NOT EXISTS idx_pw_reset_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_pw_reset_email ON public.password_reset_requests(email);
CREATE INDEX IF NOT EXISTS idx_pw_reset_created_at ON public.password_reset_requests(created_at DESC);

-- 2. KÍCH HOẠT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Người dùng nặc danh (anon) hoặc đã đăng nhập (authenticated) KHÔNG được SELECT trực tiếp bảng này
-- để bảo vệ danh sách email giáo viên và thông tin tài khoản.
DROP POLICY IF EXISTS "Admin full access password_reset_requests" ON public.password_reset_requests;
CREATE POLICY "Admin full access password_reset_requests"
    ON public.password_reset_requests
    FOR ALL
    TO authenticated
    USING (public.auth_is_admin())
    WITH CHECK (public.auth_is_admin());

-- 3. HÀM RPC ĐĂNG KÝ YÊU CẦU ĐẶT LẠI MẬT KHẨU (AN TOÀN CHO PUBLIC / ANON)
-- Không tiết lộ email có tồn tại hay không.
-- Giới hạn số yêu cầu: Nếu đã có yêu cầu pending trong vòng 2 giờ cho email này -> không tạo trùng, vẫn trả về thành công giả định (chống spam).
CREATE OR REPLACE FUNCTION public.request_password_reset_support(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_email TEXT;
    v_user_id UUID;
    v_pending_count INT;
    v_recent_req_count INT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email không hợp lệ.');
    END IF;

    -- Kiểm tra chống spam: Không cho gửi quá 3 yêu cầu trong 10 phút từ cùng email
    SELECT COUNT(*) INTO v_recent_req_count
      FROM public.password_reset_requests
     WHERE email = v_clean_email
       AND created_at > (NOW() - INTERVAL '10 minutes');

    IF v_recent_req_count >= 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
        );
    END IF;

    -- Kiểm tra xem email có tồn tại trong hệ thống (profiles) không
    SELECT id INTO v_user_id
      FROM public.profiles
     WHERE LOWER(email) = v_clean_email
     LIMIT 1;

    -- Nếu email có trong hệ thống, kiểm tra xem đã có yêu cầu pending nào chưa
    IF v_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_pending_count
          FROM public.password_reset_requests
         WHERE email = v_clean_email
           AND status = 'pending';

        -- Nếu chưa có yêu cầu pending nào, ghi nhận yêu cầu mới
        IF v_pending_count = 0 THEN
            INSERT INTO public.password_reset_requests (user_id, email, status)
            VALUES (v_user_id, v_clean_email, 'pending');
        ELSE
            -- Cập nhật nhẹ thời gian để Admin thấy yêu cầu vẫn đang được nhắc nhở
            UPDATE public.password_reset_requests
               SET created_at = NOW()
             WHERE email = v_clean_email
               AND status = 'pending';
        END IF;
    END IF;

    -- Luôn trả về thông báo thành công chung để không tiết lộ danh tính email
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Yêu cầu hỗ trợ mật khẩu đã được ghi nhận. Vui lòng liên hệ quản trị viên để được cấp lại mật khẩu.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_password_reset_support(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_password_reset_support(TEXT) TO anon, authenticated;

-- 4. HÀM RPC ĐÁNH DẤU HOÀN THÀNH HOẶC BỎ QUA YÊU CẦU (CHỈ DÀNH CHO ADMIN)
CREATE OR REPLACE FUNCTION public.admin_handle_password_reset_request(
    p_request_id UUID,
    p_action TEXT, -- 'completed' | 'dismissed'
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
BEGIN
    IF NOT public.auth_is_admin() THEN
        RAISE EXCEPTION 'Từ chối truy cập: Chỉ Quản trị viên (Admin) mới có quyền xử lý yêu cầu đặt lại mật khẩu!';
    END IF;

    IF p_action NOT IN ('completed', 'dismissed') THEN
        RAISE EXCEPTION 'Hành động không hợp lệ. Chỉ chấp nhận completed hoặc dismissed.';
    END IF;

    SELECT * INTO v_req
      FROM public.password_reset_requests
     WHERE id = p_request_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy yêu cầu đặt lại mật khẩu.';
    END IF;

    UPDATE public.password_reset_requests
       SET status = p_action,
           completed_at = NOW(),
           handled_by = auth.uid(),
           admin_note = COALESCE(p_note, admin_note)
     WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', p_request_id,
        'status', p_action
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_handle_password_reset_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_handle_password_reset_request(UUID, TEXT, TEXT) TO authenticated;

