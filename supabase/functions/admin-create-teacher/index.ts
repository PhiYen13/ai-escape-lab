import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}

/**
 * Sinh mật khẩu tạm thời ngẫu nhiên, đủ mạnh và riêng biệt cho từng giáo viên
 * bằng bộ sinh số ngẫu nhiên mật mã (Web Crypto API - crypto.getRandomValues).
 * Tuyệt đối không dùng mật khẩu mặc định cố định và không ghi log mật khẩu.
 */
function generateCryptographicTempPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const specials = "@#$!%*?&";
  const all = upper + lower + digits + specials;

  const randomBytes = new Uint32Array(length);
  crypto.getRandomValues(randomBytes);

  const chars: string[] = [
    upper[randomBytes[0] % upper.length],
    lower[randomBytes[1] % lower.length],
    digits[randomBytes[2] % digits.length],
    specials[randomBytes[3] % specials.length]
  ];

  for (let i = 4; i < length; i++) {
    chars.push(all[randomBytes[i] % all.length]);
  }

  // Trộn ngẫu nhiên mảng ký tự (Fisher-Yates shuffle với CSPRNG)
  const shuffleBytes = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Phương thức không được hỗ trợ. Vui lòng sử dụng POST." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Thiếu biến môi trường máy chủ Supabase." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Yêu cầu xác thực phiên đăng nhập Quản trị viên (Admin)." }, 401);
    }

    // 1. Xác minh danh tính người gọi bằng JWT của phiên đăng nhập hiện tại
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." }, 401);
    }

    const callerId = authData.user.id;

    // 2. Xác minh quyền Admin trực tiếp trong bảng public.profiles ở phía máy chủ
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, email, role, status, school_name")
      .eq("id", callerId)
      .single();

    if (profileErr || !callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "approved") {
      return jsonResponse(
        { error: "Từ chối truy cập: Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này." },
        403
      );
    }

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "create").trim().toLowerCase();

    // ========================================================================
    // NHÁNH A: ADMIN RESET MẬT KHẨU CỦA TÀI KHOẢN GIÁO VIÊN (action = 'reset_password')
    // ========================================================================
    if (action === "reset_password") {
      const targetUserId = String(payload.target_user_id ?? "").trim();
      if (!targetUserId) {
        return jsonResponse({ error: "Thiếu mã định danh tài khoản giáo viên (target_user_id)." }, 400);
      }

      const { data: targetProfile, error: targetErr } = await adminClient
        .from("profiles")
        .select("id, email, full_name, role, status, school_name")
        .eq("id", targetUserId)
        .maybeSingle();

      if (targetErr || !targetProfile) {
        return jsonResponse({ error: "Không tìm thấy hồ sơ giáo viên cần reset mật khẩu." }, 404);
      }

      // Chặn tuyệt đối việc reset mật khẩu của tài khoản Admin qua chức năng dành cho Teacher
      if (targetProfile.id === callerId || targetProfile.role === "admin") {
        return jsonResponse(
          {
            error:
              "Từ chối thao tác: Không được phép reset mật khẩu của tài khoản Quản trị viên (Admin) qua chức năng dành cho Giáo viên."
          },
          403
        );
      }

      const tempPassword = generateCryptographicTempPassword(12);
      const nowIso = new Date().toISOString();

      // Cập nhật mật khẩu mới qua Supabase Auth Admin API ở phía máy chủ
      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: tempPassword,
        email_confirm: true
      });

      if (updateAuthErr) {
        return jsonResponse(
          { error: "Không thể cập nhật mật khẩu trên Supabase Auth: " + updateAuthErr.message },
          400
        );
      }

      // Đánh dấu tài khoản bắt buộc đổi mật khẩu ở lần đăng nhập tiếp theo
      // (Đồng thời chặn ngay quyền truy cập RLS/RPC của mọi phiên cũ thông qua auth_is_approved_user)
      const { data: updatedTeacher, error: updateProfileErr } = await adminClient
        .from("profiles")
        .update({
          must_change_password: true,
          updated_at: nowIso
        })
        .eq("id", targetUserId)
        .select("id, email, full_name, school_name, role, status, creation_method, must_change_password, created_at, updated_at")
        .single();

      if (updateProfileErr) {
        return jsonResponse(
          { error: "Đã đổi mật khẩu Auth nhưng gặp lỗi cập nhật cờ must_change_password: " + updateProfileErr.message },
          500
        );
      }

      return jsonResponse(
        {
          success: true,
          action: "reset_password",
          message: `Đã reset mật khẩu thành công cho giáo viên ${targetProfile.full_name || targetProfile.email}.`,
          teacher: updatedTeacher,
          credentials: {
            full_name: targetProfile.full_name || "",
            email: targetProfile.email,
            temporary_password: tempPassword
          }
        },
        200
      );
    }

    // ========================================================================
    // NHÁNH B: ADMIN TẠO TÀI KHOẢN GIÁO VIÊN TRỰC TIẾP (action = 'create')
    // Chỉ cần Họ và tên + Email; hệ thống tự sinh mật khẩu tạm thời đủ mạnh
    // ========================================================================
    const fullName = String(payload.full_name ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const schoolName = String(payload.school_name ?? callerProfile.school_name ?? "").trim();

    if (fullName.length < 2) {
      return jsonResponse({ error: "Họ và tên giáo viên phải có ít nhất 2 ký tự." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Địa chỉ email đăng nhập không hợp lệ." }, 400);
    }

    // Kiểm tra trùng email trong bảng public.profiles
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse(
        { error: `Địa chỉ email "${email}" đã tồn tại trên hệ thống. Vui lòng kiểm tra trong danh sách giáo viên.` },
        409
      );
    }

    // Hệ thống tự sinh mật khẩu tạm thời đủ mạnh, riêng biệt cho từng giáo viên
    const tempPassword = generateCryptographicTempPassword(12);

    // Tạo tài khoản trong Supabase Authentication (không lưu mật khẩu dạng văn bản trong DB hoặc log)
    const { data: createdAuth, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        school_name: schoolName
      }
    });

    if (createError || !createdAuth?.user) {
      const rawMsg = createError?.message ?? "Không thể tạo tài khoản.";
      if (rawMsg.toLowerCase().includes("already") || rawMsg.toLowerCase().includes("exists")) {
        return jsonResponse({ error: `Địa chỉ email "${email}" đã được đăng ký trên hệ thống.` }, 409);
      }
      return jsonResponse({ error: rawMsg }, 400);
    }

    const newUserId = createdAuth.user.id;
    const nowIso = new Date().toISOString();

    // Đồng bộ và đánh dấu role='teacher', status='approved', creation_method='admin_created', must_change_password=true
    const { data: updatedProfile, error: upsertErr } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email,
          full_name: fullName,
          school_name: schoolName,
          role: "teacher",
          status: "approved",
          creation_method: "admin_created",
          must_change_password: true,
          approved_by: callerId,
          approved_at: nowIso,
          status_note: "Được tạo và phê duyệt trực tiếp bởi Admin",
          updated_at: nowIso
        },
        { onConflict: "id" }
      )
      .select("id, email, full_name, school_name, role, status, creation_method, must_change_password, created_at, approved_at")
      .single();

    if (upsertErr) {
      return jsonResponse({ error: "Đã tạo Auth user nhưng gặp lỗi đồng bộ hồ sơ: " + upsertErr.message }, 500);
    }

    return jsonResponse(
      {
        success: true,
        action: "create",
        message: `Đã tạo và kích hoạt thành công tài khoản Giáo viên cho ${fullName} (${email}).`,
        teacher: updatedProfile,
        credentials: {
          full_name: fullName,
          email,
          temporary_password: tempPassword
        }
      },
      201
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi máy chủ không xác định.";
    return jsonResponse({ error: msg }, 500);
  }
});
