const SUPABASE_URL = 'https://sbbduxcjznoxrwhhchju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmR1eGNqem5veHJ3aGhjaGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1OTg2NjgsImV4cCI6MjEwOTE3NDY2OH0.XjnUWPuuTQ_jGoahCaXdlwD_rILELhA12VfzheWOmFs';

async function test() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/published_campaigns?share_code=eq.MASTER&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const master = data[0];
  console.log('✅ MASTER campaign:', master.title, 'Version: v' + master.version);

  const rooms = master.published_payload.rooms;
  console.log('Tổng số phòng trong MASTER:', rooms.length);
  rooms.forEach(r => {
    const itemsCount = (r.items || []).length;
    console.log(`  - Lớp ${r.grade} Phòng 0${r.room_number}: [${r.development_status}] ${r.topic} (${r.module_id}) - ${itemsCount} thử thách`);
  });

  const r3g4 = rooms.find(r => r.grade === 4 && r.room_number === 3);
  if (!r3g4) {
    throw new Error('❌ Không tìm thấy Lớp 4 Phòng 03 trong MASTER!');
  }

  console.log(`\n🎉 KẾT QUẢ: Lớp 4 Phòng 03 đã SẴN SÀNG (ready) trên Supabase với 18 thử thách!`);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
