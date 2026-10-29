/* Room 03 – Lớp 3: Học sinh giải cứu mê cung máy tính. */
(()=>{'use strict';
const $=id=>document.getElementById(id),screen=$('room3'),world=$('r3-world'),dialog=$('r3-dialog');
const KEY='ai-escape-lab-room3-grade-3';
const fresh=()=>({stage:0,found:[],placed:[],assemblyDone:false,gates:0,gateDone:[],conveyor:0,conveyorOrder:[],safe:[],mistakes:0,done:false});
let data=fresh(),x=50,y=58,keys=new Set(),busy=false,near=null,last=0,laserUntil=0,conveyorStarted=0, facing='down',stepFrame=0;
// Tọa độ theo phần trăm của ảnh nền Khu A: thiết bị được đặt trên mặt bàn / kệ.
// Hai nhóm: thiết bị hoạt động và thiết bị hư (gây nhiễu).
// Vị trí dựa trên chính mặt bàn trong ảnh nền 1648×928 (tọa độ %).
// Mỗi thiết bị nằm trong mặt bàn hoặc ngăn kệ, không nằm trên lối đi.
// Room 03 – tọa độ theo % của nền 1648×928.
// v48: Webcam + thân máy hư chuyển lên bàn giữa trái cùng màn hình.
// Chuột tốt chuyển sang bàn giữa phải cùng thân máy tốt + máy in.
// Màn hình hư chuyển xuống sàn ở giữa phía trên (không chặn đường).
// Các thiết bị còn lại giữ nguyên vị trí v47.
const devices=[
 ['monitor','Màn hình',31.0,42.0,'01_man_hinh.png',true],
 ['tower','Thân máy',58.0,42.0,'02_than_may.png',true],
 ['keyboard','Bàn phím',5.4,37.0,'03_ban_phim.png',true],
 ['mouse','Chuột',65.0,45.0,'04_chuot.png',true],
 ['speaker','Loa',94.0,34.0,'05_loa.png',true],
 ['printer','Máy in',68.2,43.0,'06_may_in.png',true],
 ['headphones','Tai nghe',96.1,43.0,'07_tai_nghe.png',true],
 ['webcam','Webcam',38.0,44.5,'08_webcam.png',true],
 ['broken-monitor','Màn hình hư',51.0,32.0,'09_man_hinh_hu.png',false],
 ['broken-tower','Thân máy hư',39.0,40.0,'10_than_may_hu.png',false],
 ['broken-keyboard','Bàn phím hư',10.5,12.0,'11_ban_phim_hu.png',false],
 ['broken-mouse','Chuột hư',6.0,21.0,'12_chuot_hu.png',false],
 ['broken-speaker','Loa hư',69.8,11.0,'13_loa_hu.png',false],
 ['broken-printer','Máy in hư',66.0,21.0,'14_may_in_hu.png',false],
 ['broken-headphones','Tai nghe hư',73.0,26.3,'15_tai_nghe_hu.png',false],
 ['broken-webcam','Webcam hư',72.8,18.0,'16_webcam_hu.png',false]
];
const zoneNames=['Kho thiết bị','Khôi phục hệ thống điều khiển','Băng chuyền thiết bị','Kiểm tra an toàn điện'];
let introSeen=false;
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function load(){try{const d={...fresh(),...JSON.parse(localStorage.getItem(KEY)||'{}')};if(!Array.isArray(d.gateDone))d.gateDone=[];if(!d.gateDone.length&&d.gates>0)d.gateDone=[0,1,2].slice(0,Math.min(3,d.gates));d.gates=d.gateDone.length;return d}catch{return fresh()}}
function completeGate(i){
 if(!data.gateDone.includes(i))data.gateDone.push(i);
 data.gates=data.gateDone.length;save();close();render();
 const notes=[
 'Vùng cảm ứng chuột (touchpad) giúp điều khiển con trỏ trên laptop mà không cần chuột rời.',
 'Máy tính bảng có màn hình cảm ứng: em chạm trực tiếp vào biểu tượng để thực hiện lệnh.',
 'Điện thoại thông minh có bàn phím ảo giúp nhập chữ bằng cách chạm vào màn hình.'
 ];
 byteChat('🎉 HỆ THỐNG ĐÃ KHÔI PHỤC',notes[i],()=>{
  if(data.gateDone.length===3)byteChat('🌟 HOÀN THÀNH BA TRẠM','Laptop, máy tính bảng và điện thoại thông minh đều tiếp nhận thông tin, nhưng có cách điều khiển khác nhau. Lối sang băng chuyền đã mở!',()=>msg('Đã khôi phục 3/3 hệ thống. Đi đến cửa bên phải để tiếp tục.'));
 });
}
function msg(t){$('r3-msg').textContent=t}
function modal(html){busy=true;keys.clear();dialog.classList.remove('hidden');dialog.innerHTML=`<div class="r3-card">${html}</div>`}
function close(){busy=false;keys.clear();dialog.classList.add('hidden');dialog.innerHTML='';if(!screen.classList.contains('hidden'))world.focus({preventScroll:true})}
function byteChat(title,body,onDone,label='TIẾP TỤC'){
 modal(`<div class="r3-byte-dialog"><div class="r3-byte-avatar"><div class="r3-byte-robot">🤖</div><strong>ROBOT BYTE</strong></div><div class="r3-byte-speech"><div class="r3-byte-tag">${title}</div><p>${body}</p><button class="r3-btn" id="r3-byte-next">${label} ➜</button></div></div>`);
 $('r3-byte-next').onclick=()=>{close();if(onDone)onDone()};
}
function gateStory(i){
 const titles=['🔐 HỆ THỐNG AN NINH','💡 HỆ THỐNG CHIẾU SÁNG','📡 HỆ THỐNG XÁC THỰC'];
 const stories=[
 'Hệ thống an ninh đang bị khóa! Laptop không có chuột rời. Em hãy sử dụng vùng cảm ứng chuột để điều khiển con trỏ đến ổ khóa.',
 'Hành lang đang thiếu ánh sáng! Em hãy chạm vào biểu tượng bóng đèn trên màn hình cảm ứng của máy tính bảng.',
 'Hệ thống cần xác nhận quyền truy cập. Em hãy dùng bàn phím ảo của điện thoại để nhập mật mã BYTE.'
 ];
 byteChat(titles[i],stories[i],()=>gate(i),'BẮT ĐẦU NHIỆM VỤ');
}
function corridorIntro(){
 if(introSeen)return;introSeen=true;
 byteChat('⚠️ TÍN HIỆU KHẨN CẤP','Ba hệ thống của phòng thí nghiệm đang mất kết nối: an ninh, chiếu sáng và xác thực.',()=>byteChat('🧩 NHIỆM VỤ CỦA EM','Hãy dùng laptop, máy tính bảng và điện thoại thông minh để khôi phục ba hệ thống. Em có thể chọn trạm nào trước cũng được!',null,'KHÁM PHÁ HÀNH LANG'));
}
function btn(label,fn){const b=document.createElement('button');b.className='r3-btn';b.textContent=label;b.onclick=fn;return b}
function choice(title,body,options){modal(`<h2>${title}</h2><p>${body}</p><div id="r3-choices" class="r3-choices"></div>`);options.forEach(([label,ok,feedback,callback])=>$('r3-choices').append(btn(label,()=>{if(ok){if(callback)callback();else close()}else{data.mistakes++;save();$('r3-response').textContent=feedback||'Hãy thử lại nhé!'}})));const p=document.createElement('p');p.id='r3-response';p.className='r3-response';$('r3-choices').after(p)}
function positionPlayer(){const el=$('r3-byte');if(!el)return;el.style.left=x+'%';el.style.top=y+'%';const moving=keys.size>0;const frame=moving?Math.floor(stepFrame*7)%3:0;el.style.backgroundImage=`url("assets/${(localStorage.getItem('ai-escape-lab-avatar')==='girl'?'girl_':'')+facing+frame}.png")`;}
function addObject(icon,name,px,py,cb,extra='',filename=''){
 const b=document.createElement('button');b.className='r3-object '+extra+(filename?' r3-device-sprite':'');
 b.style.left=px+'%';b.style.top=py+'%';if(filename)b.classList.add('r3-asset-'+filename.split('_')[0]);b.setAttribute('aria-label',name);
 if(filename){const im=document.createElement('img');im.src='assets/room3_devices/'+filename;im.alt=name;im.draggable=false;b.append(im)}
 else b.innerHTML=`<span class="r3-icon ${/^[a-z]+$/.test(icon)?'r3-icon-'+icon:''}">${/^[a-z]+$/.test(icon)?'':icon}</span><small>${name}</small>`;
 b.onclick=()=>{if(Math.hypot((px-x)*1.65,(py-y)*1.2)<24)cb();else msg('Hãy đưa học sinh đến gần '+name+' rồi nhấn E.')};
 world.append(b);return {x:px,y:py,cb,name,el:b};
}
function render(){if(screen.classList.contains('hidden'))return;world.innerHTML=`<div class="r3-grid"></div><div class="r3-byte" id="r3-byte" role="img" aria-label="Nhân vật học sinh"></div>`;world.className='r3-world stage-'+data.stage;const objs=[];
$('r3-stage').textContent=data.done?'ĐÃ KHÔI PHỤC':`CHẶNG ${Math.min(data.stage+1,4)}/4 · ${zoneNames[data.stage]}`;
$('r3-steps').innerHTML=[0,1,2,3].map((i)=>`<span class="${i<data.stage?'done':i===data.stage?'active':''}">${i<data.stage?'✓':i+1}</span>`).join('');
if(data.done){msg('Room 03 đã khôi phục thành công! Về bản đồ để tiếp tục.');addObject('⭐','Xem kết quả',50,48,finish);positionPlayer();return}
if(data.stage===0){
 msg(data.assemblyDone?'✓ Đã lắp ráp thành công! Hãy tự điều khiển nhân vật đến CỬA RA ở phía trên bên phải và nhấn E để sang hoạt động 2.':data.found.length===4?'✓ Đã đủ 4 bộ phận! Hãy đến BÀN LẮP RÁP ở phía dưới và nhấn E để lắp ráp máy tính.':`Tìm 4 bộ phận còn hoạt động (${data.found.length}/4). Thu thập xong, đến BÀN LẮP RÁP phía dưới để lắp thành bộ máy tính hoàn chỉnh.`);
 devices.forEach(([icon,name,px,py,file,working],i)=>{
  if(data.found.includes(i))return;
  const take=()=>{
   if(i<4){data.found.push(i);save();render();msg(data.found.length===4?'🎉 Đã đủ 4 bộ phận! Hãy đến BÀN LẮP RÁP phía dưới, nhấn E để lắp thành bộ máy tính hoàn chỉnh.':'✓ Đã thu thập '+name+'! ('+data.found.length+'/4)')}
   else{modal(`<h2>${name}</h2><p>${working?'Đây là thiết bị máy tính còn hoạt động, nhưng không thuộc bốn bộ phận cần thu thập.':'Thiết bị này đã hư hỏng. Không sử dụng để lắp ráp máy tính. Hãy tìm thiết bị còn hoạt động nhé!'}</p><button class="r3-btn" id="r3-ok">Tiếp tục</button>`);$('r3-ok').onclick=close}
  };
  objs.push(addObject(icon,name,px,py,take,working?'r3-good-device':'r3-broken-device',file));
 });
 // Bàn lắp ráp đã có sẵn trong nền: chỉ thêm vùng tương tác trong suốt.
 objs.push(addObject('workbench','Bàn lắp ráp',50,79,assemble,'r3-assembly-hotspot'));
 objs.push(addObject(data.assemblyDone?'open-door':'locked-door',data.assemblyDone?'CỬA SANG HOẠT ĐỘNG 2':'Cửa đang khóa',88,22,()=>{if(!data.assemblyDone){msg('🔒 Cửa đang khóa. Hãy thu thập đủ bốn bộ phận và hoàn thành bàn lắp ráp!');return}data.stage=1;save();x=50;y=81;render();corridorIntro()},'r3-exit '+(data.assemblyDone?'r3-exit-ready':'')));
 $('r3-stage').textContent='CHẶNG 1/4 · KHO THIẾT BỊ MÁY TÍNH';
}
if(data.stage===1){
 msg(`Khôi phục ba hệ thống theo thứ tự em thích (${data.gateDone.length}/3). Đến gần trạm và nhấn E.`);
 const stations=[
  ['💻','HỆ THỐNG AN NINH',43,58,'r3-station-security'],
  ['💡','HỆ THỐNG CHIẾU SÁNG',18,57,'r3-station-light'],
  ['📱','HỆ THỐNG XÁC THỰC',88,57,'r3-station-auth']
 ];
 stations.forEach(([ic,n,px,py,cls],i)=>{
  const complete=data.gateDone.includes(i);
  objs.push(addObject(complete?'✓':ic,n+(complete?' · Đã khôi phục':''),px,py,complete?()=>msg('✓ '+n+' đã hoạt động!'):()=>gateStory(i),cls+' '+(complete?'r3-gate-complete':'r3-highlight')));
 });
 const wall=document.createElement('div');wall.className='r3-laser '+(data.gateDone.length===3?'r3-laser-off':'');wall.setAttribute('aria-label',data.gateDone.length===3?'Cửa đã mở':'Cửa đang khóa');world.append(wall);
 const status=document.createElement('div');status.className='r3-system-status';status.setAttribute('aria-label','Tiến độ khôi phục');status.innerHTML=['AN NINH','CHIẾU SÁNG','XÁC THỰC'].map((n,i)=>`<span class="r3-progress-dot r3-progress-${i} ${data.gateDone.includes(i)?'ready':''}" title="${n}: ${data.gateDone.includes(i)?'Đã khôi phục':'Chưa khôi phục'}" aria-label="${n}: ${data.gateDone.includes(i)?'Đã khôi phục':'Chưa khôi phục'}">${data.gateDone.includes(i)?'✓':''}</span>`).join('');world.append(status);
 if(data.gateDone.length===3)objs.push(addObject('open-door','CỬA SANG XƯỞNG PHÂN PHỐI',63,57,()=>{data.stage=2;x=50;y=58;save();render()},'r3-next-door r3-highlight'));
}

if(data.stage===2){
 $('r3-stage').textContent=`CHẶNG 3/4 · PHÂN LOẠI ${data.conveyor}/5`;
 msg(`Đến bảng điều khiển bên phải và nhấn E để phân loại thiết bị (${data.conveyor}/5). Hoàn thành sẽ sang nhiệm vụ cuối.`);
 objs.push(addObject('▶','VẬN HÀNH BĂNG CHUYỀN',94.2,48,conveyor,'r3-highlight r3-conveyor-start'));
}
if(data.stage===3){
 $('r3-stage').textContent=`CHẶNG 4/4 · ĐÃ XỬ LÍ ${data.safe.length}/4 NGUY CƠ`;
 msg(`Hãy quan sát phòng máy, tìm và xử lí bốn nguy cơ (${data.safe.length}/4). Đến gần vị trí bất thường rồi nhấn E.`);
 const hazards=[['🔌','Ổ cắm điện bị lỏng',6,51],['🥤','Cốc nước cạnh bàn phím',61,68],['🧹','Bàn phím bám bụi',45,68],['⚡','Dây điện không an toàn',92,61]];
 hazards.forEach(([ic,n,px,py],i)=>{
   if(!data.safe.includes(i))objs.push(addObject(ic,n,px,py,()=>safety(i),'r3-hazard-v62'));
   else {const check=document.createElement('span');check.className='r3-hazard-checked';check.style.left=px+'%';check.style.top=py+'%';check.textContent='✓';check.title=n+' · Đã xử lí';world.append(check)}
 });
 if(data.safe.length===4)objs.push(addObject('⭐','HOÀN THÀNH ROOM 03',50,55,finish,'r3-finish-v62 r3-highlight'));
}
near=objs;positionPlayer();updateNearby()}
function updateNearby(){
 if(data.stage!==0||!near)return;
 near.forEach(o=>{if(!o.el)return;const distance=Math.hypot((o.x-x)*1.65,(o.y-y)*1.2);o.el.classList.toggle('r3-in-range',distance<24)});
}
function showAssembledComputer(){
 modal(`<div class="r3-assembled-result"><div class="r3-assembly-star">⭐ LẮP RÁP THÀNH CÔNG ⭐</div><h2>🖥️ BỘ MÁY TÍNH HOÀN CHỈNH</h2><p>Em hãy quan sát <b>vị trí đúng</b> của bốn bộ phận trên bàn máy tính.</p><div class="r3-computer-layout" role="img" aria-label="Màn hình đặt phía sau bàn phím; thân máy bên phải màn hình; chuột bên phải bàn phím"><div class="r3-computer-desktop"></div><div class="r3-part r3-part-monitor"><img src="assets/room3_devices/01_man_hinh.png" alt="Màn hình"><span>① MÀN HÌNH</span></div><div class="r3-part r3-part-tower"><img src="assets/room3_devices/02_than_may.png" alt="Thân máy"><span>② THÂN MÁY</span></div><div class="r3-part r3-part-keyboard"><img src="assets/room3_devices/03_ban_phim.png" alt="Bàn phím"><span>③ BÀN PHÍM</span></div><div class="r3-part r3-part-mouse"><img src="assets/room3_devices/04_chuot.png" alt="Chuột"><span>④ CHUỘT</span></div></div><p class="r3-assembly-note">💡 Màn hình ở phía trước người dùng; bàn phím đặt trước màn hình; chuột ở cạnh bàn phím. Thân máy đặt bên cạnh hoặc dưới bàn.</p><button class="r3-btn" id="r3-assembly-next">✓ ĐÃ HIỂU · TRỞ LẠI PHÒNG ➜</button></div>`);
 $('r3-assembly-next').onclick=()=>{data.assemblyDone=true;save();close();render();byteChat('🚪 CỬA ĐÃ MỞ KHÓA','Em đã lắp ráp thành công! Bây giờ hãy tự di chuyển nhân vật đến cửa ở phía trên bên phải Kho thiết bị, rồi nhấn E để sang Hoạt động 2.',null,'ĐÃ HIỂU')};
}
function assemble(){
 if(data.assemblyDone){msg('✓ Đã lắp ráp thành công! Hãy đến cửa ở phía trên bên phải để tiếp tục.');return}
 if(data.found.length<4){msg('Hãy tìm đủ màn hình, thân máy, bàn phím và chuột trước khi đến bàn lắp ráp.');return}
 const names=['Màn hình','Thân máy','Bàn phím','Chuột'];
 modal('<h2>🛠️ LẮP RÁP MÁY TÍNH</h2><p>Chọn đúng bộ phận theo chức năng. Sau khi hoàn thành, em sẽ thấy hình ảnh một bộ máy tính được sắp xếp đúng vị trí.</p><div id="r3-assemble"></div>');
 let index=0;const prompts=['Thiết bị hiển thị kết quả làm việc?','Bộ phận chứa bộ xử lí điều khiển máy tính?','Thiết bị nhập chữ vào máy tính?','Thiết bị giúp điều khiển máy tính thuận tiện?'];
 function step(){
  if(index===4){showAssembledComputer();return}
  const area=$('r3-assemble');area.innerHTML=`<h3>Câu ${index+1}/4 · ${prompts[index]}</h3>`;
  [2,0,3,1].forEach(i=>area.append(btn(names[i],()=>{if(i===index){index++;step()}else{data.mistakes++;save();msg('Hãy xem lại chức năng của thiết bị.');const p=document.createElement('p');p.textContent='Chưa đúng, em thử lại nhé!';p.className='r3-response';area.append(p)}})))
 }step()
}
function gate(i){
 if(i===0){
  modal(`<h2>💻 TRẠM ĐIỀU KHIỂN CON TRỎ</h2><p>Nhấn giữ và kéo ngón tay trên <b>vùng cảm ứng dưới bàn phím</b> để đưa con trỏ đến ổ khóa trên màn hình.</p><div class="r3-laptop-device"><div class="r3-laptop-display"><div class="r3-laptop-wallpaper"><span class="r3-laptop-hint">DI CHUYỂN CON TRỎ ĐẾN Ổ KHÓA</span><div class="r3-laptop-lock" id="r3-laptop-lock">🔒</div><div class="r3-laptop-cursor" id="r3-laptop-cursor"></div></div></div><div class="r3-laptop-base"><div class="r3-laptop-keys">${['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map(row=>`<div>${[...row].map(c=>`<span>${c}</span>`).join('')}</div>`).join('')}</div><div class="r3-laptop-touchpad" id="r3-touchpad" role="application" aria-label="Vùng cảm ứng chuột; kéo để di chuyển con trỏ"><span>TOUCHPAD · KÉO Ở ĐÂY</span><i></i></div></div></div><p id="r3-response" class="r3-response">Đặt ngón tay hoặc con trỏ chuột vào vùng touchpad và kéo.</p>`);
  const pad=$('r3-touchpad'),cursor=$('r3-laptop-cursor'),lock=$('r3-laptop-lock');let dragging=false,cx=12,cy=75,lastX=0,lastY=0;const paint=()=>{cursor.style.left=cx+'%';cursor.style.top=cy+'%'};paint();
  pad.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;pad.setPointerCapture(e.pointerId);pad.classList.add('active');e.preventDefault()});
  pad.addEventListener('pointermove',e=>{if(!dragging)return;const r=pad.getBoundingClientRect();cx=Math.max(2,Math.min(98,cx+(e.clientX-lastX)/r.width*100));cy=Math.max(3,Math.min(97,cy+(e.clientY-lastY)/r.height*100));lastX=e.clientX;lastY=e.clientY;paint();if(cx>69&&cx<94&&cy<42){dragging=false;lock.textContent='🔓';$('r3-response').textContent='✓ Em đã điều khiển con trỏ bằng vùng cảm ứng!';setTimeout(()=>{completeGate(0)},550)}});
  pad.addEventListener('pointerup',()=>{dragging=false;pad.classList.remove('active')});pad.addEventListener('pointercancel',()=>{dragging=false;pad.classList.remove('active')});return;
 }
 if(i===1){
  modal('<h2>💡 KHÔI PHỤC HỆ THỐNG CHIẾU SÁNG</h2><p>Chạm vào <b>biểu tượng bóng đèn</b> trên màn hình máy tính bảng để bật đèn hành lang.</p><div class="r3-tablet-device"><div class="r3-tablet-camera"></div><div class="r3-tablet-screen"><div class="r3-tablet-heading">BẢNG ĐIỀU KHIỂN THÔNG MINH</div><div class="r3-tablet-apps"><button id="r3-tablet-light">💡<small>CHIẾU SÁNG</small></button><button id="r3-tablet-fan">🌀<small>QUẠT GIÓ</small></button><button id="r3-tablet-music">🎵<small>ÂM NHẠC</small></button><button id="r3-tablet-door">🚪<small>CỬA RA VÀO</small></button></div><div class="r3-tablet-foot">CHẠM VÀO BIỂU TƯỢNG ĐỂ ĐIỀU KHIỂN</div></div></div><p id="r3-response" class="r3-response">Hãy tìm biểu tượng giúp hành lang sáng lên.</p>');
  $('r3-tablet-light').onclick=()=>{$('r3-response').textContent='✓ Đèn hành lang đã bật!';setTimeout(()=>completeGate(1),450)};
  ['fan','music','door'].forEach(n=>$('r3-tablet-'+n).onclick=()=>{data.mistakes++;save();$('r3-response').textContent='Chưa đúng! Em cần bật hệ thống chiếu sáng.'});return;
 }
 modal('<h2>📱 TRẠM GIẢI MÃ BÀN PHÍM</h2><p>Chạm các phím trên điện thoại để nhập mã <b>BYTE</b> theo đúng thứ tự.</p><div class="r3-smartphone"><div class="r3-phone-notch"></div><div class="r3-phone-screen"><div class="r3-phone-title">🔐 NHẬP MÃ MỞ CỔNG</div><div id="r3-typed" class="r3-phone-entry">_ _ _ _</div><div class="r3-phone-keyboard" id="r3-virtual"></div><button class="r3-phone-delete" id="r3-delete" type="button">⌫ Xóa ký tự</button></div><div class="r3-phone-home"></div></div><p id="r3-response" class="r3-response">Hãy nhấn B → Y → T → E.</p>');
 let typed='';const update=()=>{$('r3-typed').textContent=typed.padEnd(4,'_').split('').join(' ')};const rows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];rows.forEach(row=>{const line=document.createElement('div');line.className='r3-phone-keyrow';[...row].forEach(c=>{const key=document.createElement('button');key.type='button';key.className='r3-phone-key';key.textContent=c;key.onclick=()=>{typed+=c;update();if(!'BYTE'.startsWith(typed)){data.mistakes++;save();$('r3-response').textContent='Chưa đúng thứ tự! Em hãy xóa hoặc thử lại.';typed='';setTimeout(()=>{if($('r3-typed'))update()},450)}else if(typed==='BYTE'){$('r3-response').textContent='✓ Đúng mã BYTE!';setTimeout(()=>completeGate(2),450)}else $('r3-response').textContent='Đúng rồi, tiếp tục nhập ký tự kế tiếp!'};line.append(key)});$('r3-virtual').append(line)});$('r3-delete').onclick=()=>{typed=typed.slice(0,-1);update();$('r3-response').textContent='Em có thể nhập lại mã BYTE.'};
}

const conveyorItems=[
 {name:'Bàn phím',img:'03_ban_phim.png',bin:'Nhập thông tin',tip:'Bàn phím dùng để nhập chữ, số và kí hiệu.'},
 {name:'Màn hình',img:'01_man_hinh.png',bin:'Hiển thị thông tin',tip:'Màn hình hiển thị hình ảnh, chữ và kết quả làm việc.'},
 {name:'Loa',img:'05_loa.png',bin:'Phát âm thanh',tip:'Loa giúp nghe âm thanh từ máy tính.'},
 {name:'Chuột',img:'04_chuot.png',bin:'Điều khiển con trỏ',tip:'Chuột giúp di chuyển con trỏ và lựa chọn đối tượng.'},
 {name:'Máy in',img:'06_may_in.png',bin:'In ra giấy',tip:'Máy in đưa thông tin từ máy tính ra giấy.'}
];
function conveyor(){
 if(data.conveyor>=5){msg('Đã phân loại đủ 5 thiết bị!');return}
 if(!Array.isArray(data.conveyorOrder)||data.conveyorOrder.length!==5){
  // Xáo trộn thứ tự xuất hiện, không để thiết bị nào trùng thứ tự với thùng tương ứng.
  const pool=[0,1,2,3,4];let order;
  do{order=[...pool];for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}}while(order.some((v,i)=>v===i));
  data.conveyorOrder=order;save();
 }
 const item=conveyorItems[data.conveyorOrder[data.conveyor]];
 const bins=['Nhập thông tin','Hiển thị thông tin','Phát âm thanh','Điều khiển con trỏ','In ra giấy'];
 const icons=['⌨️','🖥️','🔊','🖱️','🖨️'];
 const body=`<div class="r3-conveyor-game"><div class="r3-conveyor-head"><span>🏭 XƯỞNG PHÂN LOẠI THIẾT BỊ</span><b>${data.conveyor+1}/5</b></div><p class="r3-conveyor-instruction">🤖 Byte: Hãy <b>kéo thiết bị</b> đang chạy trên băng chuyền vào <b>khu vực đúng với chức năng</b> của nó nhé!</p><div class="r3-conveyor-track"><div class="r3-conveyor-machine"><div class="r3-conveyor-moving" id="r3-conveyor-moving"><img src="assets/room3_devices/${item.img}" draggable="false" alt="${item.name}"><strong>${item.name}</strong></div></div><div class="r3-conveyor-belt"></div><span class="r3-conveyor-direction">▶ HƯỚNG CHUYỂN ĐỘNG ▶</span></div><div class="r3-conveyor-bins" id="r3-conveyor-bins">${bins.map((bin,i)=>`<button class="r3-conveyor-bin" data-bin="${bin}" type="button"><span>${icons[i]}</span><b>${bin}</b></button>`).join('')}</div><p class="r3-conveyor-feedback" id="r3-conveyor-feedback">👆 Kéo hình thiết bị xuống thùng phân loại. Có thể nhấn thiết bị rồi chọn thùng.</p></div>`;
 modal(body);
 const moving=$('r3-conveyor-moving'),feedback=$('r3-conveyor-feedback'),track=moving.closest('.r3-conveyor-track');
 const originalParent=moving.parentElement;let floating=false;
 function restoreSprite(){if(!floating)return;originalParent.append(moving);moving.style.position='';moving.style.left='';moving.style.top='';moving.style.width='';moving.style.height='';moving.style.margin='';moving.style.zIndex='';moving.style.transform='';floating=false;}
 function floatSprite(){if(floating)return;const r=moving.getBoundingClientRect();document.body.append(moving);Object.assign(moving.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:'0',zIndex:'100000',transform:'none'});floating=true;}
 let locked=false,selected=false,dragging=false,originX=0,originY=0;
 const binsEls=[...document.querySelectorAll('#r3-conveyor-bins .r3-conveyor-bin')];
 function select(){if(locked)return;selected=true;moving.classList.add('selected');feedback.textContent='✓ Đã chọn '+item.name+'. Hãy kéo hoặc nhấn vào thùng có chức năng phù hợp.'}
 function submit(target){if(locked)return;select();if(target.dataset.bin!==item.bin){data.mistakes++;save();feedback.textContent='💡 Chưa đúng! Hãy nghĩ xem '+item.name+' được dùng để làm gì.';target.classList.add('wrong');setTimeout(()=>target.classList.remove('wrong'),550);restoreSprite();moving.style.transform='';return}
 locked=true;target.classList.add('correct');moving.classList.add('delivered');feedback.textContent='🌟 Chính xác! '+item.tip;
 const a=moving.getBoundingClientRect(),z=target.getBoundingClientRect();moving.style.transition='transform .65s ease-in, opacity .65s ease-in';moving.style.transform=`translate(${z.left+z.width/2-a.left-a.width/2}px,${z.top+z.height/2-a.top-a.height/2}px) scale(.35)`;moving.style.opacity='0';
 data.conveyor++;save();setTimeout(()=>{if(floating)moving.remove();close();render();if(data.conveyor<5)conveyor();else byteChat('🎉 BĂNG CHUYỀN ĐÃ KHÔI PHỤC','Em đã phân loại đúng 5 thiết bị theo chức năng! Nhấn TIẾP TỤC để đến nhiệm vụ cuối: An toàn khi sử dụng máy tính.',()=>{data.stage=3;x=50;y=81;save();render();byteChat('🔎 NHIỆM VỤ CUỐI: PHÒNG MÁY AN TOÀN','Hãy đi quanh phòng, tìm 4 vị trí có nguy cơ mất an toàn. Đến gần từng vị trí, nhấn E và chọn cách xử lí phù hợp. Em không được tự ý sửa ổ điện hoặc dây điện!',null,'BẮT ĐẦU KIỂM TRA')},'SANG NHIỆM VỤ CUỐI')},1100);
 }
 binsEls.forEach(el=>{el.onclick=()=>submit(el);el.addEventListener('pointerenter',()=>{if(dragging)el.classList.add('hover')});el.addEventListener('pointerleave',()=>el.classList.remove('hover'))});
 moving.addEventListener('pointerdown',e=>{if(locked)return;select();dragging=true;originX=e.clientX;originY=e.clientY;moving.setPointerCapture(e.pointerId);moving.classList.add('dragging');floatSprite();e.preventDefault()});
 moving.addEventListener('pointermove',e=>{if(!dragging)return;moving.style.transform=`translate(${e.clientX-originX}px,${e.clientY-originY}px)`});
 moving.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;moving.classList.remove('dragging');moving.style.pointerEvents='none';const under=document.elementFromPoint(e.clientX,e.clientY)?.closest('.r3-conveyor-bin');moving.style.pointerEvents='';binsEls.forEach(el=>el.classList.remove('hover'));if(under)submit(under);else restoreSprite()});
 moving.addEventListener('pointercancel',()=>{dragging=false;moving.classList.remove('dragging');restoreSprite()});
 moving.onclick=select;
}
const situations=[['Ổ cắm điện bị lỏng','Báo thầy cô hoặc người lớn','Tự cắm lại dây điện'],['Cốc nước đặt cạnh máy tính','Giữ đồ uống cách xa máy tính','Tiếp tục để cốc nước bên cạnh'],['Bàn phím bám bụi','Dùng chổi phủi bụi hoặc khăn mềm phù hợp','Dùng khăn ướt lau bàn phím'],['Dây điện cắm không an toàn','Không tự ý chạm vào dây điện; báo giáo viên','Tự kéo dây điện để sửa']];
function safety(i){const [title,correct,wrong]=situations[i];choice('🚨 PHÁT HIỆN NGUY CƠ: '+title,'Em hãy chọn hành động an toàn.',[[wrong,false,'Không an toàn! Khi có nguy cơ về điện, không tự ý xử lí.'],[correct,true,'',()=>{data.safe.push(i);save();close();render()}]])}
function finish(){if(!data.done){data.done=true;save();if(typeof recordUnlock==='function')recordUnlock(3,4);if(typeof hud==='function')hud();render()}modal('<div class="r3-win">🏆</div><h2>CHÚC MỪNG! EM ĐÃ HOÀN THÀNH ROOM 03</h2><p>🤖 Byte: Em đã tìm và lắp ráp các bộ phận máy tính, sử dụng thiết bị điều khiển, phân loại thiết bị và xử lí an toàn 4 nguy cơ trong phòng máy!</p><p>⭐ Đã hoàn thành 4/4 hoạt động · 🔓 Room 04 đã mở khóa.</p><p>Hãy nhấn <b>VỀ BẢN ĐỒ</b>, sau đó chọn <b>Room 04</b> để tiếp tục hành trình nhé!</p><button class="r3-btn" id="r3-back-map">🗺️ VỀ BẢN ĐỒ · KHÁM PHÁ ROOM 04</button>');$('r3-back-map').onclick=()=>{close();show('map')}}
function open(){introSeen=false;if(grade!==3){openModal('<h2>🚧 ROOM 03</h2><p>Phiên bản thử nghiệm này mới có nội dung Room 03 lớp 3. Lớp 4 và 5 sẽ được bổ sung sau.</p>');return}if(unlockedThrough(3)<3&&new URLSearchParams(location.search).get('teacher')!=='1'){openModal('<h2>🔒 ROOM 03 CHƯA MỞ</h2><p>Hãy hoàn thành Room 02 trước.</p>');return}data=load();x=50;y=58;keys.clear();facing='down';close();show('room3');render();if(data.stage===1){x=50;y=81;positionPlayer();corridorIntro();}if(!data.done&&data.stage===0)modal('<h2>🚨 ROOM 03: HỌC SINH VÀ MÊ CUNG MÁY TÍNH</h2><p>Phòng thí nghiệm đang gặp sự cố. Hãy tìm đủ 4 bộ phận máy tính còn hoạt động, sau đó đến bàn lắp ráp để tạo thành một bộ máy tính hoàn chỉnh. Tiếp theo, hoàn thành ba trạm điều khiển, sửa băng chuyền và bảo đảm an toàn điện.</p><p><b>WASD / ↑ ↓ ← →</b>: di chuyển · <b>E</b>: tương tác gần vật thể.</p><button class="r3-btn" id="r3-go">🚀 BẮT ĐẦU GIẢI CỨU</button>'),$('r3-go').onclick=close}
window.openRoom3=open;window.room3Done=g=>g===3&&load().done===true;
window.resetCurrentRoom3=function(){if(!confirm('Chỉ xóa tiến độ Room 03 lớp 3? Các phòng khác và quyền mở khóa đã đạt được sẽ được giữ nguyên.'))return;localStorage.removeItem(KEY);data=fresh();close();open()};
$('r3-map').onclick=()=>{close();show('map')};$('r3-reset').onclick=()=>window.resetCurrentRoom3();$('r3-help').onclick=()=>{modal('<h2>❔ HƯỚNG DẪN</h2><p>'+([data.assemblyDone?'Em đã lắp ráp xong. Hãy đến cửa ở góc trên bên phải và nhấn E để sang hoạt động 2.':'Thu thập 4 bộ phận còn hoạt động, đến bàn lắp ráp ở phía dưới và nhấn E. Sau khi lắp ráp xong, hãy tự đi đến cửa để tiếp tục.','Khôi phục ba hệ thống an ninh, chiếu sáng và xác thực theo thứ tự bất kỳ. Đến gần từng trạm rồi nhấn E. Hoàn thành đủ ba trạm để mở cửa.','Kéo thả thiết bị vào thùng đúng chức năng trên băng chuyền.','Tìm và xử lí các tình huống không an toàn trong phòng máy tính.'][data.stage])+'</p><p><b>WASD / phím mũi tên</b>: di chuyển · <b>E</b>: tương tác.</p><button class="r3-btn" id="r3-understood">ĐÃ HIỂU</button>');$('r3-understood').onclick=close;};
window.addEventListener('keydown',e=>{if(screen.classList.contains('hidden')||busy||e.target.matches('input,textarea,[contenteditable=true]'))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault()}if(k==='e'&&!e.repeat&&near){const n=near.filter(o=>Math.hypot((o.x-x)*1.65,(o.y-y)*1.2)<24).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(n)n.cb();else msg('Hãy đến gần thiết bị để tương tác. Thu thập đủ 4 bộ phận thì đến bàn lắp ráp.')}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
function loop(t){const dt=Math.min(.045,(t-last)/1000||0);last=t;if(!screen.classList.contains('hidden')&&!busy){let dx=0,dy=0;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;if(keys.has('w')||keys.has('arrowup'))dy--;if(keys.has('s')||keys.has('arrowdown'))dy++;if(dx||dy){facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');stepFrame+=dt;const m=Math.hypot(dx,dy);const nx=Math.max(8,Math.min(92,x+dx/m*24*dt)),ny=Math.max(20,Math.min(85,y+dy/m*32*dt));if(data.stage===1&&nx>59&&nx<77&&ny>36&&ny<66&&data.gateDone.length<3){msg('🔒 Cửa an ninh còn khóa! Hãy khôi phục đủ ba hệ thống.')}else{x=nx;y=ny}positionPlayer();updateNearby()}else{stepFrame=0;positionPlayer();updateNearby()}}requestAnimationFrame(loop)}requestAnimationFrame(loop);
})();
