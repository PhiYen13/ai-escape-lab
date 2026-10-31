'use strict';
const $=s=>document.querySelector(s), canvas=$('#scene'),ctx=canvas.getContext('2d');
const bg=new Image();bg.src='assets/room.png';
const sprites={};for(const d of ['up','down','left','right'])sprites[d]=[0,1,2].map(n=>{const im=new Image();im.src=`assets/${(localStorage.getItem('ai-escape-lab-avatar')==='girl'?'girl_':'')+d+n}.png`;return im});
let grade=3;
const storeKey=()=>`ai-escape-lab-v23-grade-${grade}`;
function fresh(){return {digits:[],doneTasks:[],hints:[],completed:false,mistakes:0,attempts:{},hintUses:{level1:0,level2:0}}}
function load(){try{const v=JSON.parse(localStorage.getItem(storeKey()));if(!v||!Array.isArray(v.doneTasks)||!Array.isArray(v.hints))return fresh();return {digits:[...new Set((v.digits||[]).map(String))],doneTasks:[...new Set(v.doneTasks)],hints:[...new Set(v.hints)],completed:v.completed===true,mistakes:Number(v.mistakes)||0,attempts:v.attempts||{},hintUses:v.hintUses||{level1:0,level2:0}}}catch{return fresh()}}
let progress=load();
window.addEventListener('ai-avatar-change',()=>{for(const d of ['up','down','left','right'])sprites[d].forEach((im,n)=>{im.src=`assets/${(localStorage.getItem('ai-escape-lab-avatar')==='girl'?'girl_':'')+d+n}.png`})});
const state={screen:'welcome',playing:false,modal:false,x:768,y:660,dir:'down',moving:false,frame:0,keys:new Set(),last:0};
// Điểm kích hoạt đặt tại lối đi, không nằm trong nội thất.
const tasks=[
{id:'map',name:'Bản đồ thế giới',x:550,y:410,r:75,digit:'7',title:'Khám phá thế giới',question:'Lan muốn tìm hiểu Vịnh Hạ Long bằng máy tính. Cách nào phù hợp nhất?',answers:['Chỉ nhìn màn hình mà không thao tác','Xem hình ảnh, video và tìm kiếm thông tin','Chỉ sử dụng máy tính để chơi trò chơi'],correct:1},
{id:'computer',name:'Máy tính nghiên cứu',x:1015,y:480,r:110,digit:'4',title:'Máy tính giúp ích gì?',question:'Công việc nào có thể thực hiện bằng máy tính?',answers:['Soạn thảo văn bản, vẽ tranh và học trực tuyến','Tự nấu ăn mà không cần thiết bị hỗ trợ','Tự tưới cây mà không có thiết bị điều khiển'],correct:0},
{id:'library',name:'Thư viện số',x:1250,y:615,r:66,digit:'2',title:'Công cụ học tập',question:'Để viết một bài văn trên máy tính, em nên dùng phần mềm nào?',answers:['Phần mềm nghe nhạc','Phần mềm vẽ tranh','Phần mềm soạn thảo văn bản'],correct:2},
{id:'station',name:'Trạm nghiên cứu',x:730,y:770,r:77,digit:'9',title:'Ứng dụng công nghệ',question:'Để đo nhiệt độ và gửi số liệu về máy tính, ta cần thiết bị nào?',answers:['Loa','Cảm biến nhiệt độ','Máy in'],correct:1}
];
const secrets=[
{id:'robot',name:'Robot trợ lý',x:750,y:480,r:72,icon:'🤖',title:'Manh mối 01',question:'Thiết bị nào giúp máy tính thu nhận hình ảnh?',answers:['Loa','Webcam','Máy in','Màn hình'],correct:1,hint:'Chữ số đầu tiên là số chẵn lớn nhất trong bốn chữ số.'},
{id:'plant',name:'Chậu cây thông minh',x:1105,y:650,r:64,icon:'🪴',title:'Manh mối 02',question:'Thiết bị nào có thể đo độ ẩm của đất?',answers:['Cảm biến độ ẩm đất','Bàn phím','Loa','Máy in'],correct:0,hint:'Chữ số thứ hai là số nhỏ nhất trong bốn chữ số.'},
{id:'book',name:'Cuốn sổ tri thức',x:1265,y:765,r:55,icon:'📖',title:'Manh mối 03',question:'Khi tìm thông tin trên Internet, em nên làm gì?',answers:['Tin tất cả thông tin','Chỉ xem tiêu đề','Kiểm tra thông tin từ nguồn đáng tin cậy','Chia sẻ ngay thông tin chưa kiểm chứng'],correct:2,hint:'Chữ số cuối cùng là số lớn nhất trong bốn chữ số.'},
{id:'chest',name:'Hộp quà bí mật',x:865,y:760,r:74,icon:'🎁',title:'Manh mối 04',question:'Hành động nào giúp bảo vệ thông tin cá nhân?',answers:['Chia sẻ mật khẩu với bạn','Đăng công khai thông tin cá nhân','Sử dụng mật khẩu mạnh và giữ bí mật','Nhấn mọi đường liên kết lạ'],correct:2,hint:'Chữ số thứ ba lớn hơn chữ số thứ hai và nhỏ hơn chữ số cuối cùng.'}
];
// Mỗi khối có bộ vật phẩm, tọa độ và phong cách riêng. Tọa độ là vị trí tương tác có thể tiếp cận.
// x/y: vị trí nhân vật tiếp cận; vx/vy: vị trí hình ảnh trên đồ nội thất.
// Không dùng khung, viền sáng hoặc nhãn tên khi chưa đến gần.
const layouts={
3:{theme:'Phòng thí nghiệm thông tin',accent:'#77e6a0',items:{
 map:['🌍','Bản đồ thế giới',550,410,210,345,0],
 computer:['💻','Máy tính',1040,475,1210,375,0],
 library:['📚','Tủ sách',1250,640,1340,650,0],
 station:['🔬','Bàn nghiên cứu',570,770,340,630,0],
 robot:['🤖','Robot nhỏ',770,515,780,440,43],
 plant:['🌱','Chậu cây',1090,635,1040,600,34],
 book:['📖','Cuốn sổ',1250,770,1248,810,34],
 chest:['🎁','Hộp quà',865,755,855,825,39]}},
4:{theme:'Xưởng công nghệ máy tính',accent:'#65c8ff',items:{
 map:['🖥️','Kệ thiết bị máy tính',550,410,235,345,0],
 computer:['⌨️','Bàn máy tính kỹ thuật',1050,485,1210,375,0],
 library:['💾','Kho phần mềm',1250,635,1340,650,0],
 station:['🛠️','Trạm sửa chữa máy tính',565,770,345,630,0],
 robot:['🔊','Loa bị hỏng',1120,495,1350,435,0],
 plant:['🎛️','Bộ điều khiển tưới cây',1100,700,1065,650,35],
 book:['📋','Bảng kiểm tra hệ thống',1250,780,1250,810,33],
 chest:['🎨','Hộp dụng cụ thiết kế',1250,760,1245,822,0]}},
5:{theme:'Trung tâm sáng tạo số',accent:'#cf9aff',items:{
 map:['🗺️','Màn hình khám phá thế giới',550,410,220,345,0],
 computer:['💻','Máy tính sáng tạo',1040,485,1210,375,0],
 library:['📽️','Bảng dự án học tập',1250,635,1340,650,0],
 station:['🎛️','Bảng điều khiển đa nhiệm',570,770,345,630,0],
 robot:['🤖','Robot thuyết trình',970,600,970,560,0],
 plant:['📊','Màn hình theo dõi cây',1100,495,1170,425,0],
 book:['📱','Máy tính bảng tri thức',1250,760,1295,820,0],
 chest:['💌','Thiệp sinh nhật điện tử',1130,500,1310,465,0]}}
};
function setLayout(){const cfg=layouts[grade];for(const p of [...tasks,...secrets]){const [icon,name,x,y,vx,vy,size]=cfg.items[p.id];Object.assign(p,{icon,name,x,y,vx,vy,size})}document.documentElement.style.setProperty('--grade-accent',cfg.accent);$('#room-theme').textContent=cfg.theme}
let exploration=0,helpLevel=0,help2Wait=0,beacon=null;
function resetExploration(){exploration=0;helpLevel=0;help2Wait=0;beacon=null;updateHintButton()}
function updateHintButton(){const b=$('#find-item');if(!b)return;b.classList.toggle('hidden',helpLevel===0);b.textContent=helpLevel>=2?'📍 Gợi ý vị trí':'🔎 Gợi ý khu vực';b.title=helpLevel===1?'Gợi ý khu vực tương đối':'Có thể đánh dấu vật phẩm'}
// Tọa độ tương tác tính theo khung canvas 1536×1024.

// Nội dung 8 thử thách được duyệt cho từng khối. Mỗi nhiệm vụ có cách chơi riêng.
const lessonData={
  3:{topic:'Thông tin và quyết định',code:'4279',
    tasks:{
      map:{title:'THÔNG TIN QUANH EM',kind:'match',digit:'4',question:'Ghép mỗi thông tin với quyết định phù hợp.',left:['🔔 Tiếng chuông báo vào lớp','🌧️ Trời đang mưa','🚦 Đèn giao thông màu đỏ'],right:['Dừng lại','Chuẩn bị vào lớp học','Mang theo áo mưa'],correct:[1,2,0],feedback:'Thông tin giúp em đưa ra quyết định phù hợp. Hãy đọc kỹ từng tình huống nhé!'},
      computer:{title:'THÁM TỬ THÔNG TIN',kind:'sequence',digit:'2',question:'Chọn giác quan giúp em tiếp nhận thông tin.',items:[{question:'Lan nhìn thấy biển báo “Không chạy nhảy”.',answers:['👁️ Mắt','👂 Tai'],correct:0},{question:'Minh nghe tiếng trống báo giờ ra chơi.',answers:['👁️ Mắt','👂 Tai'],correct:1},{question:'An đọc được thông báo ngày mai lớp đi tham quan.',answers:['👁️ Mắt','👂 Tai'],correct:0}],feedback:'Hãy nghĩ xem em nhìn thấy hay nghe thấy thông tin này.'},
      library:{title:'QUYẾT ĐỊNH THÔNG MINH',kind:'sequence',digit:'7',intro:'Ngày mai, lớp 3A tổ chức hoạt động trồng cây. Cô giáo thông báo: “Các em nhớ mang theo một chai nước nhỏ và đội mũ khi tham gia hoạt động ngoài trời.”',items:[{question:'Em nhận được thông tin gì từ thông báo của cô giáo?',answers:['Ngày mai lớp được nghỉ học.','Ngày mai lớp tham gia hoạt động ngoài trời và cần chuẩn bị nước, mũ.','Ngày mai lớp đi bơi.'],correct:1},{question:'Dựa vào thông tin đó, em sẽ quyết định làm gì?',answers:['Chuẩn bị chai nước và mũ.','Không cần chuẩn bị gì.','Chỉ mang đồ chơi.'],correct:0}],feedback:'Hãy đọc lại thông báo và tìm những việc cô giáo nhắc em chuẩn bị.'},
      station:{title:'MỘT THÔNG TIN – NHIỀU QUYẾT ĐỊNH',kind:'multi',digit:'9',intro:'Robot nghiên cứu nhận được thông tin: “Ngoài trời đang mưa rất to.”',question:'Những quyết định nào phù hợp với thông tin trên?',answers:['Bạn An mang áo mưa khi ra ngoài.','Bạn Bình chạy ra sân chơi.','Bạn Chi đóng cửa sổ để tránh nước mưa hắt vào phòng.'],correct:[0,2],feedback:'Một thông tin có thể dẫn đến nhiều quyết định phù hợp. Em hãy chọn tất cả quyết định an toàn.'}
    },secrets:{
      robot:{title:'ROBOT CẦN EM GIÚP!',kind:'single',question:'Pin của robot chỉ còn 5%. Robot nên làm gì?',answers:['Tiếp tục hoạt động đến khi hết pin.','Di chuyển đến trạm sạc pin.','Tăng tốc độ di chuyển.'],correct:1,hint:'Chữ số đầu tiên là số chẵn lớn hơn 2.'},
      plant:{title:'GIẢI CỨU CÂY XANH',kind:'single',question:'Cảm biến phát hiện đất trong chậu đang khô. Hệ thống nên làm gì?',answers:['Bật hệ thống tưới nước.','Tắt hệ thống tưới nước.','Bật đèn trang trí.'],correct:0,hint:'Chữ số thứ hai là số nhỏ nhất trong bốn chữ số.'},
      book:{title:'AI ĐƯA RA QUYẾT ĐỊNH ĐÚNG?',kind:'single',intro:'Nam nghe thấy tiếng chuông báo cháy và chen lấn để chạy ra ngoài. Mai bình tĩnh làm theo hướng dẫn của giáo viên.',question:'Bạn nào đưa ra quyết định phù hợp?',answers:['Nam.','Mai.','Cả hai bạn.'],correct:1,hint:'Chữ số cuối cùng là số lớn nhất trong bốn chữ số.'},
      chest:{title:'GIẢI MÃ THÔNG ĐIỆP',kind:'multi',intro:'Ngày mai trường tổ chức ngày hội thể thao. Học sinh cần mặc trang phục thể thao và mang theo nước uống.',question:'Em cần chuẩn bị những gì?',answers:['Trang phục thể thao.','Nước uống.','Đồ chơi điện tử.','Sách truyện.'],correct:[0,1],hint:'Chữ số thứ ba lớn hơn chữ số đầu tiên.'}
    }},
  4:{topic:'Phần cứng và phần mềm máy tính',code:'8631',
    tasks:{
      map:{title:'PHÂN LOẠI THIẾT BỊ',kind:'sort',digit:'6',question:'Kéo các thẻ vào nhóm PHẦN CỨNG hoặc PHẦN MỀM.',items:['🖥️ Màn hình','⌨️ Bàn phím','🖱️ Chuột máy tính','🎨 Phần mềm Paint','📝 Microsoft Word','🌐 Trình duyệt web'],correct:[0,0,0,1,1,1],groups:['PHẦN CỨNG','PHẦN MỀM'],feedback:'Em hãy thử lại nhé! Phần cứng là những thiết bị mà em có thể nhìn thấy, cầm nắm và sờ được. Phần mềm là các chương trình máy tính mà em không thể cầm nắm được. Hãy dựa vào đặc điểm này để phân loại lại các thành phần nhé!'},
      computer:{title:'AI LÀM NHIỆM VỤ GÌ?',kind:'sequence',digit:'3',items:[{question:'Em muốn nhập một đoạn văn bản vào máy tính. Thiết bị nào giúp em nhập chữ?',answers:['Loa.','Bàn phím.','Màn hình.'],correct:1},{question:'Em muốn nghe âm thanh từ một video. Thiết bị nào giúp phát âm thanh?',answers:['Loa.','Chuột.','Bàn phím.'],correct:0},{question:'Em muốn vẽ một bức tranh trên máy tính. Phần mềm nào phù hợp?',answers:['Phần mềm Paint.','Phần mềm máy tính không rõ chức năng.','Hệ điều hành.'],correct:0}],feedback:'Hãy xác định chức năng của thiết bị hoặc phần mềm mà em cần.'},
      library:{title:'ĐIỀU GÌ SẼ XẢY RA?',kind:'sequence',digit:'8',items:[{question:'Máy tính vẫn hoạt động nhưng loa bị hỏng. Điều gì có thể xảy ra?',answers:['Không thể nhìn thấy hình ảnh trên màn hình.','Không thể nghe âm thanh qua loa bị hỏng.','Không thể nhập chữ bằng bàn phím.'],correct:1},{question:'Máy tính có màn hình, bàn phím, chuột nhưng chưa có phần mềm vẽ. Em gặp khó khăn gì?',answers:['Không thể sử dụng phần mềm vẽ đó để tạo tranh.','Không thể bật màn hình.','Không thể sử dụng bàn phím.'],correct:0},{question:'Bạn An muốn soạn một bài văn. Em chọn phần mềm nào?',answers:['Phần mềm Paint.','Phần mềm soạn thảo văn bản.','Phần mềm nghe nhạc.'],correct:1}],feedback:'Hãy xác định thành phần bị thiếu và công việc mà thành phần đó hỗ trợ.'},
      station:{title:'KHÔI PHỤC HỆ THỐNG MÁY TÍNH',kind:'pair',digit:'1',question:'Ghép mỗi công việc với một thiết bị phần cứng và một phần mềm phù hợp.',jobs:['Soạn thảo bài văn','Vẽ tranh','Nghe nhạc'],hardware:['Bàn phím','Chuột','Loa'],software:['Phần mềm soạn thảo văn bản','Phần mềm Paint','Phần mềm phát nhạc'],correct:[[0,0],[1,1],[2,2]],feedback:'Hệ thống chưa thể hoạt động. Em hãy kiểm tra lại: Công việc này cần thiết bị nào và chương trình nào?'}
    },secrets:{
      robot:{title:'ROBOT BỊ MẤT GIỌNG',kind:'single',intro:'Robot phát một bài hát nhưng không nghe thấy âm thanh vì loa đã bị hỏng.',question:'Thành phần bị hỏng thuộc nhóm nào?',answers:['Phần mềm.','Phần cứng.','Cả phần cứng và phần mềm.'],correct:1,hint:'Chữ số đầu tiên là số lớn nhất trong bốn chữ số.'},
      plant:{title:'BỘ NÃO CỦA CHẬU CÂY',kind:'single',intro:'Chậu cây có cảm biến độ ẩm, máy bơm nước và chương trình điều khiển tưới cây.',question:'Thành phần nào là phần mềm?',answers:['Cảm biến độ ẩm đất.','Máy bơm nước.','Chương trình điều khiển tưới cây.'],correct:2,hint:'Chữ số cuối cùng là số nhỏ nhất trong bốn chữ số.'},
      book:{title:'TÌM PHÁT BIỂU ĐÚNG',kind:'multi',question:'Chọn tất cả phát biểu đúng.',answers:['Phần cứng là những bộ phận vật lí của máy tính.','Phần mềm là những chương trình giúp máy tính thực hiện công việc.','Chuột máy tính là một phần mềm.'],correct:[0,1],hint:'Chữ số thứ hai là số chẵn nhỏ hơn 8.'},
      chest:{title:'CHỌN BỘ CÔNG CỤ PHÙ HỢP',kind:'single',intro:'Bạn Mai muốn tạo một bức tranh trên máy tính.',question:'Bộ công cụ nào phù hợp nhất?',answers:['Loa và phần mềm nghe nhạc.','Chuột và phần mềm Paint.','Máy in và phần mềm phát nhạc.','Bàn phím và phần mềm nghe nhạc.'],correct:1,hint:'Chữ số thứ ba là số lẻ lớn hơn 1.'}
    }},
  5:{topic:'Em có thể làm gì với máy tính?',code:'5924',
    tasks:{
      map:{title:'NHÀ THÁM HIỂM SỐ',kind:'match',digit:'2',intro:'Robot muốn khám phá các địa danh nổi tiếng nhưng không thể trực tiếp đến đó.',question:'Ghép mỗi mục đích với cách sử dụng máy tính phù hợp.',left:['Muốn biết vị trí Vịnh Hạ Long','Muốn quan sát tháp Eiffel','Muốn tìm hiểu lịch sử Kim tự tháp Ai Cập'],right:['Tìm kiếm và đọc thông tin','Xem bản đồ số','Xem hình ảnh hoặc video'],correct:[1,2,0],feedback:'Máy tính giúp chúng ta sử dụng bản đồ số, xem hình ảnh, video và tìm kiếm thông tin.'},
      computer:{title:'CHUYÊN GIA CÔNG NGHỆ',kind:'sequence',digit:'5',items:[{question:'Bạn An muốn viết bài văn kể về chuyến tham quan. Bạn nên dùng phần mềm nào?',answers:['Phần mềm soạn thảo văn bản.','Phần mềm nghe nhạc.','Phần mềm xem video.'],correct:0},{question:'Bạn Bình muốn tạo bài trình chiếu giới thiệu các loài động vật. Bạn dùng phần mềm nào?',answers:['Phần mềm vẽ.','Phần mềm trình chiếu.','Phần mềm phát nhạc.'],correct:1},{question:'Bạn Chi muốn thiết kế thiệp điện tử tặng mẹ. Bạn nên dùng phần mềm nào?',answers:['Phần mềm thiết kế đồ họa.','Phần mềm nghe nhạc.','Phần mềm xem video.'],correct:0}],feedback:'Hãy xác định công việc muốn thực hiện rồi chọn phần mềm có chức năng phù hợp.'},
      library:{title:'DỰ ÁN HỌC TẬP THÔNG MINH',kind:'order',digit:'9',intro:'Nhóm Minh muốn dùng máy tính làm bài trình chiếu về “Bảo vệ môi trường xanh”.',question:'Sắp xếp các công việc theo trình tự hợp lí.',items:['Tạo bài trình chiếu, kết hợp nội dung và hình ảnh.','Xác định những thông tin cần tìm hiểu về chủ đề.','Tìm kiếm, lựa chọn thông tin và hình ảnh phù hợp.','Kiểm tra, chỉnh sửa và hoàn thiện bài trình chiếu.'],correct:[1,2,0,3],feedback:'Trước khi tạo bài trình chiếu, em cần chuẩn bị gì? Sau khi hoàn thành, em có cần kiểm tra lại không?'},
      station:{title:'MÁY TÍNH CÓ THỂ GIÚP GÌ?',kind:'multi',digit:'4',question:'Chọn tất cả hoạt động có thể thực hiện bằng máy tính thông thường khi sử dụng phần mềm và thiết bị phù hợp.',answers:['Soạn thảo một bài văn.','Tìm kiếm thông tin trên Internet.','Tự nấu một bữa cơm mà không cần thiết bị hỗ trợ.','Thiết kế một tấm thiệp điện tử.','Trò chuyện trực tuyến với bạn bè.','Tự quét dọn nhà cửa mà không cần thiết bị hỗ trợ.'],correct:[0,1,3,4],feedback:'Máy tính giúp học tập, tìm kiếm thông tin, sáng tạo và giao tiếp. Một số công việc thực tế cần thêm thiết bị phù hợp.'}
    },secrets:{
      robot:{title:'ROBOT CẦN MỘT BÀI THUYẾT TRÌNH',kind:'single',intro:'Robot cần bài giới thiệu phòng thí nghiệm có chữ, hình ảnh và các trang trình chiếu.',question:'Robot nên sử dụng phần mềm nào?',answers:['Phần mềm trình chiếu.','Phần mềm nghe nhạc.','Phần mềm xem video.'],correct:0,hint:'Chữ số đầu tiên là số lẻ lớn hơn 3 và nhỏ hơn 7.'},
      plant:{title:'NHẬT KÍ CHĂM SÓC CÂY',kind:'single',intro:'Chậu cây muốn theo dõi sự phát triển: chụp ảnh mỗi tuần, ghi chiều cao, lưu thông tin vào máy tính và dùng bảng tính theo dõi sự thay đổi.',question:'Máy tính có thể trực tiếp hỗ trợ những công việc nào trong danh sách?',answers:['Chỉ công việc 1.','Chỉ công việc 2.','Công việc 3 và 4.','Không công việc nào.'],correct:2,hint:'Chữ số cuối cùng là số chẵn lớn hơn 2 và nhỏ hơn 5.'},
      book:{title:'NGƯỜI BẠN CÔNG NGHỆ',kind:'multi',question:'Chọn tất cả phát biểu đúng.',answers:['Máy tính giúp tìm kiếm thông tin phục vụ học tập.','Máy tính giúp tạo bài trình chiếu.','Máy tính tự thực hiện mọi công việc trong cuộc sống mà không cần con người hoặc thiết bị hỗ trợ.','Máy tính giúp trao đổi thông tin với người khác qua Internet.'],correct:[0,1,3],hint:'Chữ số thứ hai là số lớn nhất trong bốn chữ số.'},
      chest:{title:'MÓN QUÀ CÔNG NGHỆ',kind:'single',intro:'Mai muốn làm thiệp điện tử tặng mẹ: thiết kế thiệp, chèn ảnh gia đình, viết lời chúc và thêm nhạc nền.',question:'Máy tính có thể hỗ trợ Mai thực hiện những công việc nào?',answers:['Chỉ thiết kế thiệp.','Chỉ chèn hình ảnh.','Chỉ viết lời chúc.','Cả bốn công việc trên.'],correct:3,hint:'Chữ số thứ ba là số chẵn nhỏ nhất trong bốn chữ số.'}
    }}
};
function lesson(){return lessonData[grade]}
function itemData(p,isHint){return (isHint?lesson().secrets:lesson().tasks)[p.id]}
function chooseGrade(n){grade=n;progress=load();setLayout();resetExploration();$('#map-grade-label').textContent=`AI ESCAPE LAB ${grade}`;$('#room-grade-label').textContent=`LỚP ${grade}`;$('#topic-label').textContent=lesson().topic;show('map')}
const door={id:'door',name:'Cửa phòng 02',x:785,y:363,r:115};
const blocks=[
// Màn hình bản đồ: có thể đứng trước màn hình từ phía bên phải.
{x:0,y:100,w:390,h:345},
// Bàn quả địa cầu bên trái: không đi xuyên bàn, vẫn có lối vào bản đồ.
{x:0,y:505,w:525,h:235},
// Bàn máy tính phía trên bên phải.
{x:1135,y:280,w:401,h:230},
// Tủ sách bên phải: chừa lối phía trước để đọc sách và khám phá chậu cây.
{x:1335,y:510,w:201,h:220}
];
function save(){localStorage.setItem(storeKey(),JSON.stringify(progress));hud()}
function hud(){const n=(progress.completed?1:0)+(window.room2Done&&window.room2Done(grade)?1:0)+(window.room3Done&&window.room3Done(grade)?1:0);$('#room-count').textContent=n+'/16';$('#secret-count').textContent=progress.hints.length+'/4';$('#clues').textContent=progress.digits.length?progress.digits.join('　')+('　🔒'.repeat(4-progress.digits.length)):'🔒　🔒　🔒　🔒';$('#mistakes-count').textContent=progress.mistakes}
function show(id){['welcome','grades','map','room','room2','room3'].forEach(n=>$('#'+n).classList.toggle('hidden',n!==id));state.screen=id;state.keys.clear();if(id==='map')renderMap();hud()}
function openModal(html){state.modal=true;state.keys.clear();$('#content').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){state.modal=false;$('#modal').classList.add('hidden');$('#content').innerHTML='';state.keys.clear()}
function action(label,fn){const b=document.createElement('button');b.className='action';b.textContent=label;b.onclick=fn;$('#content').appendChild(b)}
function intro(){state.playing=false;openModal(`<h2>🤖 LỚP ${grade} – PHÒNG 01: TRUNG TÂM ĐIỀU KHIỂN</h2><h3>${lesson().topic.toUpperCase()}</h3><p>Hãy hoàn thành <b>4 nhiệm vụ chính</b> để thu thập bốn chữ số. Khám phá <b>4 vật phẩm bí mật</b> để nhận manh mối sắp xếp mật mã.</p><p>Di chuyển bằng <b>WASD</b> hoặc <b>phím mũi tên</b>; đến gần đồ vật và nhấn <b>E</b>. Sau 30 giây chưa tìm thấy vật phẩm mới, em sẽ được mở khóa <b>gợi ý khu vực</b>; tiếp tục tìm thêm 20 giây để có gợi ý vị trí chính xác. Mở <b>Sổ tay giải mã</b> để xem lại thông tin.</p>`);action('BẮT ĐẦU KHÁM PHÁ',()=>{closeModal();state.playing=true})}
function room(){show('room');state.x=768;state.y=660;resetExploration();intro()}
function nearest(){let best=null,dist=Infinity;for(const p of [...tasks,...secrets,door]){const d=Math.hypot(state.x-p.x,state.y-p.y);if(d<p.r&&d<dist){best=p;dist=d}}return best}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function quiz(p,isHint){
  const data=itemData(p,isHint),already=isHint?progress.hints.includes(p.id):progress.doneTasks.includes(p.id);
  if(already){openModal(`<h2>${escapeHTML(data.title)}</h2><p>Em đã hoàn thành thử thách này!</p><p class="reward">${isHint?escapeHTML(data.hint):'Chữ số đã nhận: '+data.digit}</p>`);action('ĐÓNG',closeModal);return}
  const quizKey=`${isHint?'secret':'task'}-${p.id}`;
  let step=0,selection=[],pairs=[],sortGroups=Array(data.items?.length||0).fill(-1),order=[],pairHardware=[],pairSoftware=[];
  function wrong(){progress.mistakes++;progress.attempts[quizKey]=(progress.attempts[quizKey]||0)+1;save();const feedback=$('#feedback');if(feedback){feedback.className='wrong';feedback.textContent='💡 '+(data.feedback||'Chưa chính xác. Hãy suy nghĩ và thử lại nhé!')}}
  function finish(){resetExploration();if(isHint){progress.hints.push(p.id)}else{progress.doneTasks.push(p.id);progress.digits.push(data.digit)}save();openModal(isHint?`<h2>🔎 ĐÃ TÌM THẤY MANH MỐI!</h2><p>${escapeHTML(data.title)}</p><p class="reward">${escapeHTML(data.hint)}</p>`:`<h2>✨ NHẬN ĐƯỢC CHỮ SỐ!</h2><p>Em đã hoàn thành nhiệm vụ:</p><h1 class="reward" style="font-size:62px">${data.digit}</h1><p>Chữ số được lưu trong Sổ tay. Thứ tự tìm thấy chưa phải mật mã.</p>`);action('TIẾP TỤC KHÁM PHÁ',closeModal)}
  function start(){openModal(`<h2>${escapeHTML(p.icon||'🧩')} ${escapeHTML(data.title)}</h2>${data.intro?`<p class="story">${escapeHTML(data.intro)}</p>`:''}<p>${escapeHTML(data.question||'Hoàn thành các yêu cầu dưới đây.')}</p><div id="activity"></div><p id="feedback" aria-live="polite"></p>`);render()}
  function render(){const box=$('#activity');if(!box)return;box.innerHTML='';const kind=data.kind;
    const makeButton=(text,handler,cls='answer')=>{const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=handler;box.appendChild(b);return b};
    const verify=(fn)=>{const b=makeButton('✓ KIỂM TRA',()=>{if(fn())finish();else wrong()},'action check-button')};
    if(kind==='single'){data.answers.forEach((v,i)=>makeButton(String.fromCharCode(65+i)+'. '+v,()=>i===data.correct?finish():wrong()));return}
    if(kind==='sequence'){const it=data.items[step];box.innerHTML=`<div class="step-label">Câu ${step+1}/${data.items.length}</div><p class="question-line">${escapeHTML(it.question)}</p>`;it.answers.forEach((v,i)=>makeButton(String.fromCharCode(65+i)+'. '+v,()=>{if(i!==it.correct){wrong();return}step++;if(step===data.items.length)finish();else start()}));return}
    if(kind==='multi'){const selected=new Set();data.answers.forEach((v,i)=>{const b=makeButton('☐ '+v,()=>{if(selected.has(i))selected.delete(i);else selected.add(i);b.classList.toggle('selected',selected.has(i));b.textContent=(selected.has(i)?'☑ ':'☐ ')+v})});verify(()=>selected.size===data.correct.length&&data.correct.every(i=>selected.has(i)));return}
    if(kind==='match'){
      box.innerHTML='<p class="activity-help">Chọn một thẻ cột trái, rồi chọn thẻ cột phải để nối. Em có thể nối cả khi chưa chắc đáp án, đổi lại cặp nối và chỉ kiểm tra sau khi ghép đủ.</p><div class="match-grid"><div id="left-options" class="match-column"></div><div id="right-options" class="match-column"></div></div><div id="match-results" class="match-results" aria-live="polite"></div>';
      const left=$('#left-options'),right=$('#right-options');let active=-1;const pairsMap={};
      const pairColors=[['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],['#fef3c7','#a16207'],['#ede9fe','#6d28d9'],['#ffedd5','#c2410c']];
      const paintPair=(b,index)=>{
        if(index<0){
          ['background','background-color','border-color','color','box-shadow'].forEach(k=>b.style.removeProperty(k));
          return;
        }
        const [bg,fg]=pairColors[index%pairColors.length];
        // Force identical color on BOTH sides; override legacy .tile.selected styles.
        b.style.setProperty('background',bg,'important');
        b.style.setProperty('background-color',bg,'important');
        b.style.setProperty('border-color',fg,'important');
        b.style.setProperty('color',fg,'important');
        b.style.setProperty('box-shadow','inset 0 0 0 2px '+fg,'important');
      };
      const redraw=()=>{
        const count=Object.keys(pairsMap).length;
        left.querySelectorAll('button').forEach((b,i)=>{
          b.classList.toggle('selected',active===i && pairsMap[i]===undefined);
          paintPair(b,pairsMap[i]!==undefined?i:-1);
          b.textContent=(pairsMap[i]!==undefined?'🔗 ':'')+data.left[i]+(pairsMap[i]!==undefined?' → '+(Number(pairsMap[i])+1):'');
        });
        right.querySelectorAll('button').forEach((b,i)=>{
          b.classList.toggle('selected',false);
          const pairedLeft=Object.keys(pairsMap).find(k=>pairsMap[k]===i);
          paintPair(b,pairedLeft===undefined?-1:Number(pairedLeft));
          b.textContent=(Object.values(pairsMap).includes(i)?'🔗 ':'')+(i+1)+'. '+data.right[i];
        });
        $('#match-results').textContent=`Đã nối ${count}/${data.left.length} cặp. ${count===data.left.length?'Đã nối đủ, hãy nhấn KIỂM TRA.':'Tiếp tục nối các cặp còn lại.'}`;
      };
      data.left.forEach((v,i)=>{const b=document.createElement('button');b.className='tile';b.draggable=true;b.onclick=()=>{active=i;redraw()};b.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(i));active=i};left.appendChild(b)});
      data.right.forEach((v,j)=>{const b=document.createElement('button');b.className='tile';b.onclick=()=>{
        if(active<0)return;
        for(const k of Object.keys(pairsMap))if(pairsMap[k]===j)delete pairsMap[k];
        pairsMap[active]=j;active=-1;redraw();
      };b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();active=Number(e.dataTransfer.getData('text/plain'));b.click()};right.appendChild(b)});
      redraw();verify(()=>Object.keys(pairsMap).length===data.left.length&&data.correct.every((v,i)=>pairsMap[i]===v));return
    }
    if(kind==='sort'){
      box.innerHTML='<p class="activity-help">Chọn một thẻ rồi chọn nhóm phù hợp. Có thể kéo thả thẻ vào nhóm.</p><div id="sort-items" class="tile-grid"></div><div id="sort-groups" class="sort-groups"></div>';
      let active=-1;const items=$('#sort-items'),groups=$('#sort-groups');
      const redraw=()=>{items.querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('selected',active===i);b.textContent=data.items[i]+(sortGroups[i]<0?'':` → ${data.groups[sortGroups[i]]}`)})};
      data.items.forEach((v,i)=>{const b=document.createElement('button');b.className='tile';b.draggable=true;b.textContent=v;b.onclick=()=>{active=i;redraw()};b.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(i));active=i};items.appendChild(b)});
      data.groups.forEach((v,j)=>{const b=document.createElement('button');b.className='dropzone';b.textContent=v;b.onclick=()=>{if(active<0)return;sortGroups[active]=j;active=-1;redraw()};b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();active=Number(e.dataTransfer.getData('text/plain'));b.click()};groups.appendChild(b)});verify(()=>data.correct.every((v,i)=>sortGroups[i]===v));return
    }
    if(kind==='order'){
      order=[];box.innerHTML='<p class="activity-help">Nhấn lần lượt các bước theo thứ tự thực hiện. Nhấn vào bước đã chọn để bỏ chọn.</p><div id="order-items" class="tile-grid"></div><p id="order-preview"></p>';
      const pool=[2,0,3,1],container=$('#order-items');const redraw=()=>{container.querySelectorAll('button').forEach(b=>{const i=Number(b.dataset.index);b.classList.toggle('selected',order.includes(i));b.textContent=(order.includes(i)?(order.indexOf(i)+1)+'. ':'')+data.items[i]});$('#order-preview').textContent=`Đã sắp xếp ${order.length}/${data.items.length} bước`};
      pool.forEach(i=>{const b=document.createElement('button');b.className='tile';b.dataset.index=i;b.onclick=()=>{if(order.includes(i))order=order.filter(v=>v!==i);else order.push(i);redraw()};container.appendChild(b)});redraw();verify(()=>order.length===data.correct.length&&order.every((v,i)=>v===data.correct[i]));return
    }
    if(kind==='pair'){
      box.innerHTML='<p class="activity-help">Với mỗi công việc, chọn một phần cứng và một phần mềm.</p><div id="pair-rows"></div>';
      data.jobs.forEach((job,i)=>{const row=document.createElement('div');row.className='pair-row';row.innerHTML=`<b>${escapeHTML(job)}</b>`;const hardware=document.createElement('select'),software=document.createElement('select');
        const addOptions=(select,options)=>{const first=document.createElement('option');first.value='';first.textContent='— Chọn —';select.appendChild(first);options.forEach((v,j)=>{const opt=document.createElement('option');opt.value=j;opt.textContent=v;select.appendChild(opt)})};addOptions(hardware,data.hardware);addOptions(software,data.software);hardware.setAttribute('aria-label','Phần cứng cho '+job);software.setAttribute('aria-label','Phần mềm cho '+job);hardware.onchange=()=>pairHardware[i]=hardware.value===''?-1:Number(hardware.value);software.onchange=()=>pairSoftware[i]=software.value===''?-1:Number(software.value);row.append(hardware,software);$('#pair-rows').appendChild(row)});
      verify(()=>data.correct.every(([h,s],i)=>pairHardware[i]===h&&pairSoftware[i]===s));return
    }
  }
  start();
}
function interact(){if(!state.playing||state.modal)return;const p=nearest();if(!p)return;if(p.id==='door')return keypad();if(!(progress.doneTasks.includes(p.id)||progress.hints.includes(p.id)))resetExploration();quiz(p,secrets.some(s=>s.id===p.id))}
// Hỗ trợ tìm vật phẩm: chỉ gợi ý vị trí, không tiết lộ đáp án hay mật mã.
function findItem(){
 if(helpLevel===0)return;
 const remaining=[...tasks.filter(p=>!progress.doneTasks.includes(p.id)),...secrets.filter(p=>!progress.hints.includes(p.id))];
 if(!remaining.length){openModal('<h2>🎉 Em đã tìm đủ vật phẩm!</h2><p>Hãy xem Sổ tay giải mã và đến cánh cửa để nhập mật mã.</p>');action('ĐÓNG',closeModal);return}
 const detailed=helpLevel>=2;
 progress.hintUses[detailed?'level2':'level1']++;save();
 openModal(`<h2>${detailed?'📍 GỢI Ý VỊ TRÍ':'🔎 GỢI Ý KHU VỰC'}</h2><p>${detailed?'Chọn vật phẩm để làm sáng vị trí trong 8 giây.':'Em hãy tự tìm theo hướng được gợi ý. Nếu vẫn khó tìm, tiếp tục khám phá thêm 20 giây để mở khóa đánh dấu vị trí.'}</p><div class="find-list"></div>`);
 const list=$('.find-list');
 for(const p of remaining){
   const dx=p.vx-state.x,dy=p.vy-state.y;
   const direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'bên phải':'bên trái'):(dy>0?'phía dưới':'phía trên');
   const b=document.createElement('button');b.className='find-choice';
   b.textContent=`${p.icon} ${p.name} — ${direction}`;
   b.onclick=()=>{if(detailed){beacon={p,until:performance.now()+8000};closeModal()}else{$('#hint-detail').textContent='Hãy quan sát khu vực '+direction+' của nhân vật nhé!'}};
   list.appendChild(b)
 }
 if(!detailed){const d=document.createElement('p');d.id='hint-detail';list.after(d)}
 action('ĐÓNG',closeModal)
}

function journal(){openModal(`<h2>📖 SỔ TAY GIẢI MÃ – LỚP ${grade}</h2><p><b>Bài học: ${escapeHTML(lesson().topic)}</b></p><p>Chữ số đã tìm thấy: <b>${progress.digits.length}/4</b></p><p class="reward">${progress.digits.length?progress.digits.join('　–　'):'Chưa tìm được chữ số nào'}</p><p><i>Đây là thứ tự thu thập, không phải thứ tự mật mã.</i></p><h3>🔎 Manh mối: ${progress.hints.length}/4</h3><div class="collection">${secrets.map(s=>`<div class="collect-item"><span>${progress.hints.includes(s.id)?s.icon:'🔒'}</span><div><b>${progress.hints.includes(s.id)?escapeHTML(itemData(s,true).title):'Manh mối chưa mở'}</b><small>${progress.hints.includes(s.id)?escapeHTML(itemData(s,true).hint):'Tìm vật phẩm và hoàn thành thử thách'}</small></div></div>`).join('')}</div><p>📝 Số lần trả lời sai: <b>${progress.mistakes}</b></p><p>🔎 Gợi ý khu vực đã dùng: <b>${progress.hintUses.level1||0}</b> · 📍 Gợi ý vị trí đã dùng: <b>${progress.hintUses.level2||0}</b></p><p>${progress.completed?'🚪 Đã mở khóa Phòng 02.':''}</p>`);action('TIẾP TỤC',closeModal);action('🔄 CHƠI LẠI TỪ ĐẦU',confirmReset)}
function confirmReset(){openModal('<h2>🔄 BẮT ĐẦU LẠI?</h2><p>Chỉ xóa tiến độ Phòng 01. Các phòng đã mở khóa vẫn có thể truy cập.</p>');action('KHÔNG, GIỮ TIẾN ĐỘ',journal);action('CÓ, XÓA VÀ CHƠI LẠI',()=>{Object.assign(progress,fresh());save();closeModal();room()})}
function keypad(){openModal(`<h2>🔐 CỬA PHÒNG 02</h2><p>Chữ số đã thu thập: <b>${progress.digits.length?progress.digits.join(' – '):'Chưa có'}</b></p><p>Gợi ý đã tìm được: <b>${progress.hints.length}/4</b></p><p>Hãy suy luận và nhập mật mã gồm <b>4 chữ số</b>.</p><input class="code" id="code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="____"><p id="feedback" aria-live="polite"></p>`);const input=$('#code');input.focus();const submit=()=>{if(progress.digits.length<4){$('#feedback').textContent='Bạn cần tìm đủ 4 chữ số trước khi mở khóa!';$('#feedback').className='wrong';return}if(input.value===lesson().code){progress.completed=true;recordUnlock(grade,2);save();openModal(`${`<h2>🎉 CHÚC MỪNG! EM ĐÃ HOÀN THÀNH ROOM 01</h2><p>🔐 Tuyệt vời! Em đã tìm đủ bốn chữ số, giải mã chính xác và mở được cánh cửa bí mật của phòng thí nghiệm!</p><p>⭐ Hoàn thành 4/4 nhiệm vụ giải mã · 🔓 Room 02 đã mở khóa.</p>`}<p>Đã khám phá <b>${progress.hints.length}/4</b> gợi ý.</p>${progress.hints.length<4?'<p>Bạn vẫn có thể quay lại tìm những bí mật còn thiếu.</p>':''}`);action('🚀 VÀO PHÒNG 02 NGAY',()=>{closeModal();window.openRoom2()});action('▣ XEM BẢN ĐỒ',()=>{closeModal();show('map')});}else{$('#feedback').textContent='Mật mã chưa đúng. Hãy kiểm tra các gợi ý trong Sổ tay giải mã!';$('#feedback').className='wrong';input.select()}};input.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});action('MỞ KHÓA',submit);action('📖 XEM SỔ TAY',journal)}
const doorPoints=[[25.7,37.2],[41.9,37.2],[59.0,37.2],[75.2,37.2],[18.3,54.3],[36.1,54.3],[65.4,54.3],[83.2,54.3],[16.9,70.6],[34.4,70.6],[66.3,70.6],[83.3,70.6],[29.0,86.5],[45.9,86.5],[62.5,86.5],[83.3,86.5]];
/* Bản đồ: trạng thái hoàn thành hiện tại tách khỏi quyền truy cập đã mở. */
const accessKey=g=>`ai-escape-lab-access-grade-${g}`;
function unlockedThrough(g){
 let stored=1;try{stored=Number(localStorage.getItem(accessKey(g)))||1}catch{}
 const first=g===grade?progress.completed:JSON.parse(localStorage.getItem(`ai-escape-lab-v23-grade-${g}`)||'{}').completed===true;
 const second=typeof window.room2Done==='function'&&window.room2Done(g);
 // Grade 3: Room 04 may ONLY unlock when Room 03 is actually completed.
 // Ignore legacy stored unlock=4 left by earlier versions or teacher tests.
 const completed3=typeof window.room3Done==='function'&&window.room3Done(g);
 const base=Math.max(1,Math.min(16,stored,16),first?2:1,second?3:1,completed3?4:1);
 return g===3&&!completed3?Math.min(3,base):base;
}
function recordUnlock(g,roomNumber){
 const old=unlockedThrough(g);
 if(g===3&&roomNumber>=4&&!(typeof window.room3Done==='function'&&window.room3Done(g)))return false;
 const next=Math.min(16,Math.max(old,roomNumber));
 localStorage.setItem(accessKey(g),String(next));return next>old;
}
function roomFinished(number){if(number===1)return progress.completed;if(number===2)return typeof window.room2Done==='function'&&window.room2Done(grade);if(number===3)return typeof window.room3Done==='function'&&window.room3Done(grade);return false}
function enterMapRoom(number){
 if(number>unlockedThrough(grade)&&!(number===3&&grade===3&&new URLSearchParams(location.search).get('teacher')==='1'))return;
 if(number===1){room();return}
 if(number===2){window.openRoom2();return}
 if(number===3){if(grade===3)window.openRoom3();else openModal('<h2>🚧 ROOM 03</h2><p>Room 03 lớp '+grade+' đang được phát triển. Phiên bản thử nghiệm hiện có lớp 3.</p>');return}
 openModal(`<h2>🚧 PHÒNG ${String(number).padStart(2,'0')} ĐÃ MỞ KHÓA</h2><p>Phòng này đã được mở trên bản đồ, nhưng nội dung học tập đang được xây dựng.</p>`);action('▣ VỀ BẢN ĐỒ',()=>{closeModal();show('map')});
}
function renderMap(){
 const unlocked=unlockedThrough(grade);hud();const box=$('#doors');box.innerHTML='';
 doorPoints.forEach(([x,y],i)=>{
  const number=i+1,finished=roomFinished(number),available=number<=unlocked;
  const b=document.createElement('button');b.className='door map-door '+(finished?'map-done':available?'map-open':'map-locked');
  b.style.left=x+'%';b.style.top=y+'%';
  b.disabled=!available;b.title=`Phòng ${String(number).padStart(2,'0')} – ${finished?'Đã hoàn thành':available?'Đã mở khóa':'Chưa mở khóa'}`;
  b.setAttribute('aria-label',b.title);
  const badge=document.createElement('span');badge.className='map-status';badge.innerHTML=finished?'<img src="assets/map_star.svg" alt="">':available?'<img src="assets/map_unlock.svg" alt="">':'';badge.setAttribute('aria-hidden','true');b.appendChild(badge);
  b.onclick=()=>enterMapRoom(number);box.appendChild(b);
 });
 const next=Array.from({length:unlocked},(_,i)=>i+1).find(n=>!roomFinished(n))||unlocked;
 if(grade===3&&new URLSearchParams(location.search).get('teacher')==='1'){const test=document.createElement('button');test.textContent='🧪 XEM THỬ ROOM 03 LỚP 3';test.id='r3-teacher-entry';test.onclick=()=>window.openRoom3();box.append(test)}
 $('#map-play').setAttribute('aria-label',`Vào phòng ${String(next).padStart(2,'0')}`);
 $('#map-play').textContent=`▶ VÀO PHÒNG ${String(next).padStart(2,'0')} →`;
}

function help(){openModal('<h2>📖 HƯỚNG DẪN</h2><p><b>WASD / phím mũi tên</b>: Di chuyển. <b>E</b>: Tương tác khi đứng gần đồ vật.</p><p>Hoàn thành <b>4 nhiệm vụ chính</b> để lấy bốn chữ số. Tìm <b>4 đồ vật bí mật</b> và trả lời câu hỏi để nhận gợi ý thứ tự. Sau 30 giây khám phá chưa tìm được vật phẩm mới, gợi ý khu vực sẽ xuất hiện. Sau 20 giây tiếp theo, em có thể dùng gợi ý đánh dấu vị trí. Dùng <b>Sổ tay giải mã</b> để suy luận mật mã mở cửa. Không bắt buộc phải tìm đủ gợi ý nếu bạn đã suy luận được.</p>');action('ĐÃ HIỂU',closeModal)}
function blocked(x,y){if(x<75||x>1460||y<315||y>855)return true;const pad=20;return blocks.some(b=>x>b.x-pad&&x<b.x+b.w+pad&&y>b.y-pad&&y<b.y+b.h+pad)}
// Đồ vật minh họa theo phối cảnh, có bóng tiếp xúc với bàn/sàn và không có viền sáng.
function drawIntegratedProp(p){
 const x=p.vx,y=p.vy,id=p.id;
 ctx.save();ctx.translate(x,y);ctx.lineJoin='round';ctx.lineCap='round';
 function poly(points,fill,stroke='#17324d',lw=2){ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
 function rr(x,y,w,h,r,fill,stroke='#1b3552'){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
 function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
 ellipse(0,8,32,9,'#08244266');
 if(grade===4&&id==='robot'){
   // Loa trên mặt bàn máy tính, cùng phối cảnh với các thiết bị hiện có.
   poly([[-21,-41],[8,-46],[21,-36],[-8,-31]],'#547eaa');poly([[-8,-31],[21,-36],[21,2],[-8,7]],'#172b43');poly([[-21,-41],[-8,-31],[-8,7],[-21,-3]],'#304f6d');
   ellipse(6,-15,12,13,'#0a1a2d');ellipse(6,-15,7,8,'#2b6d91');ellipse(6,-15,3,4,'#122d47');ellipse(7,-33,3,3,'#ff9b6c');
 }else if(grade===4&&id==='chest'){
   // Hộp dụng cụ thiết kế trên bàn tròn thư viện.
   poly([[-30,-14],[13,-21],[34,-9],[-9,-1]],'#dce8f0');poly([[-9,-1],[34,-9],[32,12],[-10,20]],'#376f98');poly([[-30,-14],[-9,-1],[-10,20],[-30,6]],'#284966');
   for(let i=0;i<5;i++){ctx.save();ctx.translate(-17+i*9,-13-i*1.2);ctx.rotate(-.2);rr(-2,-22,5,24,2,['#f1b95b','#e65c77','#64c4f0','#7bd7aa','#b2a3f0'][i],null);ctx.restore()}
 }else if(grade===5&&id==='robot'){
   // Robot nhỏ đứng trên sàn cạnh bàn làm việc, có chân và bóng đổ.
   ellipse(0,17,24,7,'#0b243a88');rr(-17,-40,34,40,9,'#d3e7f0');rr(-15,-65,30,24,7,'#beddeb');rr(-11,-60,22,14,4,'#173b62');ellipse(-5,-53,2,2,'#79e6ff');ellipse(6,-53,2,2,'#79e6ff');rr(-8,-27,16,13,4,'#386e9e');rr(-25,-32,7,25,3,'#7cabc8');rr(18,-32,7,25,3,'#7cabc8');rr(-15,0,10,15,3,'#6689a5');rr(5,0,10,15,3,'#6689a5');
 }else if(grade===5&&id==='plant'){
   // Màn hình theo dõi cây nằm trên bàn máy tính bên cạnh chậu cây.
   poly([[-32,-31],[26,-34],[29,5],[-30,8]],'#152d47');poly([[-26,-26],[22,-29],[24,0],[-25,3]],'#20547c',null);ctx.strokeStyle='#8de1bf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-19,-3);ctx.lineTo(-11,-12);ctx.lineTo(-4,-8);ctx.lineTo(5,-19);ctx.lineTo(17,-14);ctx.stroke();rr(-4,8,8,9,2,'#6789a4');poly([[-17,17],[15,17],[21,21],[-21,21]],'#3d647e');
 }else if(grade===5&&id==='book'){
   // Máy tính bảng đặt nằm trên mặt bàn đọc sách.
   poly([[-31,-11],[17,-21],[35,5],[-13,16]],'#152a43');poly([[-26,-10],[16,-17],[29,4],[-13,12]],'#3e7197',null);ctx.strokeStyle='#b5e9e7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-16,-1);ctx.lineTo(11,-7);ctx.moveTo(-13,4);ctx.lineTo(16,-2);ctx.stroke();
 }else if(grade===5&&id==='chest'){
   // Thiệp điện tử trên màn hình nhỏ, đặt cạnh bàn máy tính.
   rr(-28,-35,56,40,5,'#1c324f');rr(-23,-30,46,30,3,'#e9b9cb',null);poly([[-15,-24],[0,-15],[15,-24],[15,-7],[-15,-7]],'#f8e5e7',null);ctx.strokeStyle='#c46d88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-15,-24);ctx.lineTo(0,-15);ctx.lineTo(15,-24);ctx.stroke();rr(-3,5,6,8,2,'#6986a0');poly([[-17,13],[17,13],[22,17],[-22,17]],'#416785');
 }
 ctx.restore();
}
function draw(t){const dt=Math.min((t-(state.last||t))/1000,.05);state.last=t;if(state.screen==='room'){ctx.clearRect(0,0,1536,1024);if(bg.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,1536,1024);
// Bốn vật phẩm chính tận dụng các đồ vật có sẵn trên nền: màn hình bản đồ,
// bàn máy tính, tủ sách và bàn quả địa cầu. Vật phẩm bí mật nằm trên bề mặt
// bàn/kệ hoặc sát sàn, không có bảng tên, khung hay viền sáng.
for(const p of [...tasks,...secrets]){
 if(!p.size){if(secrets.includes(p)&&((grade===4&&['robot','chest'].includes(p.id))||(grade===5&&['robot','plant','book','chest'].includes(p.id))))drawIntegratedProp(p);continue;}
 const done=tasks.includes(p)?progress.doneTasks.includes(p.id):progress.hints.includes(p.id);
 ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.globalAlpha=done?.68:1;
 ctx.font=`${p.size}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
 ctx.fillText(p.icon,p.vx,p.vy);
 ctx.restore();
}
if(state.playing&&!state.modal){exploration+=dt;if(helpLevel===0&&exploration>=30){helpLevel=1;updateHintButton()}if(helpLevel===1&&exploration>=50){helpLevel=2;updateHintButton()}let dx=0,dy=0,k=state.keys;if(k.has('a')||k.has('arrowleft'))dx--;if(k.has('d')||k.has('arrowright'))dx++;if(k.has('w')||k.has('arrowup'))dy--;if(k.has('s')||k.has('arrowdown'))dy++;state.moving=dx!==0||dy!==0;if(state.moving){const len=Math.hypot(dx,dy);dx=dx/len*250*dt;dy=dy/len*250*dt;if(!blocked(state.x+dx,state.y))state.x+=dx;if(!blocked(state.x,state.y+dy))state.y+=dy;if(Math.abs(dx)>Math.abs(dy))state.dir=dx>0?'right':'left';else state.dir=dy>0?'down':'up';state.frame+=dt}}else state.moving=false;
if(beacon&&t<beacon.until){
  const p=beacon.p, pulse=5*Math.sin(t/190),radius=(p.size?Math.max(27,p.size):32)+14+pulse;
  ctx.save();ctx.strokeStyle='#ffe46b';ctx.lineWidth=7;ctx.shadowColor='#fff17b';ctx.shadowBlur=28;
  ctx.beginPath();ctx.arc(p.vx,p.vy,radius,0,Math.PI*2);ctx.stroke();
  ctx.shadowBlur=6;ctx.fillStyle='#ffe46b';ctx.textAlign='center';ctx.font='bold 23px Arial';
  ctx.fillText('📍 '+p.name,p.vx,Math.max(315,p.vy-radius-18));
  const angle=Math.atan2(p.vy-state.y,p.vx-state.x);
  ctx.translate(state.x,state.y-155);ctx.rotate(angle+Math.PI/2);
  ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-16,12);ctx.lineTo(16,12);ctx.closePath();ctx.fill();ctx.restore();
}else if(beacon){beacon=null}
const frame=state.moving?(Math.floor(state.frame*9)%2)+1:0,sprite=sprites[state.dir][frame],bob=state.moving?Math.sin(state.frame*18)*2:0;ctx.save();ctx.translate(state.x,state.y);ctx.fillStyle='#001b3955';ctx.beginPath();ctx.ellipse(0,0,30,10,0,0,Math.PI*2);ctx.fill();if(sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,-43,-134+bob,86,136);ctx.restore();const near=state.playing&&!state.modal?nearest():null;$('#nearby').classList.toggle('hidden',!near);if(near)$('#nearby').textContent='[E] Khám phá · '+near.name}requestAnimationFrame(draw)}requestAnimationFrame(draw);
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(state.modal)return;if(state.screen==='room'&&state.playing){if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))state.keys.add(k);if(k==='e'&&!e.repeat)interact()}});
window.addEventListener('keyup',e=>{state.keys.delete(e.key.toLowerCase());if(!state.keys.size)state.moving=false});window.addEventListener('blur',()=>state.keys.clear());
$('#start').onclick=()=>{show('grades');if(!localStorage.getItem('ai-escape-lab-avatar'))setTimeout(()=>window.openAvatarSettings?.(true),150)};if($('#grade-back')) $('#grade-back').onclick=()=>show('welcome');document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>chooseGrade(Number(b.dataset.grade)));$('#map-play').onclick=()=>{const max=unlockedThrough(grade);const next=Array.from({length:max},(_,i)=>i+1).find(n=>!roomFinished(n))||max;enterMapRoom(next)};document.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>{closeModal();show('welcome')});document.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{closeModal();show('map')});document.querySelectorAll('[data-help]').forEach(b=>b.onclick=help);$('#achievements').onclick=journal;$('#find-item').onclick=findItem; if(new URLSearchParams(location.search).get('teacher')==='1'){const test=document.createElement('button');test.id='teacher-test';test.textContent='🧪 Kiểm thử gợi ý';test.title='Chỉ dành cho giáo viên – mở bằng ?teacher=1';test.onclick=()=>{helpLevel=helpLevel===0?1:2;exploration=helpLevel===1?30:50;updateHintButton();findItem()};$('#find-item').after(test)}setLayout();updateHintButton();$('#close').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});hud();

/* Reset đúng phạm vi: trang chủ = tất cả, bản đồ = phòng hiện tại của lớp,
   Phòng 01 / Phòng 02 = chỉ tiến độ phòng đang chơi. */
function resetEntireGame(){
 openModal('<h2>⚠️ XÓA TOÀN BỘ TIẾN ĐỘ?</h2><p>Xóa tiến độ của <b>tất cả các phòng và lớp</b>. Nhân vật đã chọn vẫn được giữ lại. Không thể hoàn tác.</p>');
 action('HỦY',closeModal);
 action('XÁC NHẬN XÓA TẤT CẢ',()=>{
  for(const g of [3,4,5]){
   localStorage.removeItem('ai-escape-lab-v23-grade-'+g);
   localStorage.removeItem('ai-escape-lab-room2-grade-'+g);
   localStorage.removeItem('ai-escape-lab-room3-grade-'+g);
   localStorage.removeItem(accessKey(g));
  }
  progress=fresh();resetExploration();closeModal();show('welcome');
 });
}
function resetRoomOne(){
 openModal(`<h2>↻ CHƠI LẠI PHÒNG 01 – LỚP ${grade}?</h2><p>Chỉ xóa chữ số, manh mối, lần sai và gợi ý của <b>Phòng 01 – Lớp ${grade}</b>. Phòng 02 và các lớp khác vẫn giữ nguyên dữ liệu.</p>`);
 action('HỦY',closeModal);
 action('CHƠI LẠI PHÒNG 01',()=>{
  // Giữ quyền truy cập phòng 02 nếu đã mở trước đây.
  const wasUnlocked=unlockedThrough(grade);
  progress=fresh();
  localStorage.setItem(accessKey(grade),String(wasUnlocked));
  save();resetExploration();closeModal();room();
 });
}
function resetRoomTwo(){if(typeof window.resetCurrentRoom2==='function')window.resetCurrentRoom2()}
function resetFromMap(){
 openModal(`<h2>↻ CHỌN PHÒNG CẦN CHƠI LẠI – LỚP ${grade}</h2><p>Chỉ phòng được chọn bị xóa dữ liệu.</p>`);
 action('PHÒNG 01',resetRoomOne);
 if(unlockedThrough(grade)>=2)action('PHÒNG 02',resetRoomTwo);
 if(grade===3&&unlockedThrough(grade)>=3)action('PHÒNG 03',()=>{closeModal();window.resetCurrentRoom3()});
 action('HỦY',closeModal);
}
for(const id of ['reset-game','reset-game-grades']){
 const b=document.getElementById(id);if(b)b.addEventListener('click',resetEntireGame);
}
const mapReset=document.getElementById('reset-game-map');if(mapReset)mapReset.addEventListener('click',resetFromMap);
const roomReset=document.getElementById('reset-game-room');if(roomReset)roomReset.addEventListener('click',resetRoomOne);
