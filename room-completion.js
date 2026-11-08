/* Shared dynamic room numbering; each room supplies its own narrative. */
(function(){
 'use strict';
 const pad=n=>String(n).padStart(2,'0');
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.escapeRoomCompletion=function(roomNumber,options={}){
  const n=Math.max(1,Math.min(16,Number(roomNumber)||1));
  const next=n<16?n+1:null;
  const title=`CHÚC MỪNG! EM ĐÃ HOÀN THÀNH ROOM ${pad(n)}`;
  const unlock=next?`🔓 Room ${pad(next)} đã mở khóa.`:'🏆 Em đã hoàn thành toàn bộ 16 phòng!';
  const story=options.story?`<p>${esc(options.story)}</p>`:'';
  const progress=options.progress?`<p>${esc(options.progress)} · ${unlock}</p>`:`<p>${unlock}</p>`;
  return {room:n,next,title,unlock,html:`<h2>${title}</h2>${story}${progress}`};
 };
})();
