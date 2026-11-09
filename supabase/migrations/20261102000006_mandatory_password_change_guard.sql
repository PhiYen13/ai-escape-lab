-- ============================================================================
-- 20261102000006_mandatory_password_change_guard.sql
-- Dự án: AI Escape Lab - Kiểm soát bắt buộc đổi mật khẩu lần đầu ở phía máy chủ
-- ============================================================================
-- Mục tiêu:
-- 1. Cập nhật hàm public.auth_is_approved_user() để kiểm tra thêm điều kiện
--    must_change_password = FALSE đối với tài khoản vai trò 'teacher'.
-- 2. Nhờ đó, khi giáo viên đăng nhập bằng mật khẩu tạm thời (lần đầu hoặc sau
--    khi được Admin reset mật khẩu), hoặc cố tình truy cập trực tiếp URL của
--    Dashboard / gọi API trực tiếp mà chưa đổi mật khẩu:
--    - Mọi truy vấn đọc/ghi bảng campaigns (kể cả MASTER), campaign_rooms, room_items
--      đều bị chặn bởi RLS ở phía máy chủ PostgreSQL.
--    - Mọi lệnh gọi RPC clone_campaign, validate_campaign, publish_campaign
--      đều bị từ chối ở phía máy chủ PostgreSQL.
-- 3. Tài khoản Admin hiện tại (role = 'admin') hoàn toàn không bị ảnh hưởng.
-- ============================================================================

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
          AND (
              role = 'admin'
              OR (role = 'teacher' AND must_change_password = FALSE)
          )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.auth_is_approved_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_approved_user() TO authenticated;

