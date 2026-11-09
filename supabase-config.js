/**
 * supabase-config.js
 * Cấu hình kết nối công khai tới Supabase Project: aiescapelab (sbbduxcjznoxrwhhchju)
 *
 * NGUYÊN TẮC BẢO MẬT:
 * - Chỉ sử dụng URL dự án và khóa công khai (anon / publishable key).
 * - Tuyệt đối KHÔNG sử dụng service_role key hoặc bất kỳ secret key nào trong mã frontend.
 * - Mọi quyền truy cập dữ liệu và thao tác nghiệp vụ đều được kiểm soát nghiêm ngặt bởi
 *   Row Level Security (RLS), Triggers và các hàm RPC trên PostgreSQL.
 */
(function (global) {
  'use strict';

  var SUPABASE_PROJECT_ID = 'sbbduxcjznoxrwhhchju';
  var SUPABASE_URL = 'https://sbbduxcjznoxrwhhchju.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmR1eGNqem5veHJ3aGhjaGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1OTg2NjgsImV4cCI6MjEwOTE3NDY2OH0.XjnUWPuuTQ_jGoahCaXdlwD_rILELhA12VfzheWOmFs';

  var clientInstance = null;

  function getClient() {
    if (clientInstance) {
      return clientInstance;
    }
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('Thư viện kết nối Supabase (@supabase/supabase-js) chưa được tải. Vui lòng kiểm tra kết nối mạng.');
    }
    clientInstance = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ai-escape-lab-studio-auth'
      }
    });
    return clientInstance;
  }

  global.AI_ESCAPE_SUPABASE = {
    projectId: SUPABASE_PROJECT_ID,
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    getClient: getClient
  };
})(window);

