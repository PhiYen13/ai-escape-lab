-- ============================================================================
-- 20261102000011_sync_room03_grade4_master.sql
-- Dự án: AI Escape Lab
-- Mục tiêu:
--   1. Đồng bộ an toàn Khối 4 - Phòng 03 (Thông tin trên trang web - web_exploration_lab_v1)
--      vào chiến dịch MASTER với nguyên tắc Idempotent thực sự.
--   2. Bảo toàn tuyệt đối mọi thay đổi nếu Admin đã tinh chỉnh.
--   3. Đồng bộ 18 nhiệm vụ học tập (4 trạm và 4 mảnh ghép chìa khóa).
--   4. Tự động cập nhật published_payload của MASTER để Game Client nhận ngay cấu hình phòng 3 lớp 4.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHẦN 1. CẬP NHẬT RÀNG BUỘC KIND CHO ROOM_ITEMS ĐỂ HỖ TRỢ DẠNG 'fill_select'
-- ----------------------------------------------------------------------------
ALTER TABLE public.room_items DROP CONSTRAINT IF EXISTS room_items_kind_check;
ALTER TABLE public.room_items ADD CONSTRAINT room_items_kind_check CHECK (kind IN (
  'single', 'multi', 'sequence', 'match', 'sort', 'order', 'pair', 'typing', 'fingers',
  'rescue_search', 'rescue_usb', 'web_nav', 'share_files', 'assemble',
  'touchpad_gate', 'tablet_gate', 'phone_gate', 'conveyor', 'hazard_safety',
  'fill_select'
));

-- ----------------------------------------------------------------------------
-- PHẦN 2. ĐỒNG BỘ PHÒNG 03 LỚP 4 VÀO KHO MASTER
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_camp_id UUID;
    v_room_id UUID;
    v_room_count INT;
    v_item_count INT;
    v_rooms_inserted INT := 0;
    v_items_inserted INT := 0;
    v_rooms_json JSONB := '[]'::jsonb;
    v_room_json JSONB;
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_items_arr JSONB;
    v_item RECORD;
    v_room RECORD;
    v_item_data JSONB;
    v_published_payload JSONB;
    v_new_version INT;
BEGIN
    -- 1. Tìm chiến dịch MASTER
    SELECT id, COALESCE(version, 1) + 1
    INTO v_camp_id, v_new_version
    FROM public.campaigns
    WHERE is_template = true OR share_code = 'MASTER'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_camp_id IS NULL THEN
        RAISE EXCEPTION '⚠️ Không tìm thấy chiến dịch MASTER trong database!';
    END IF;

    RAISE NOTICE '🚀 Bắt đầu đồng bộ Room 03 Lớp 4 vào MASTER (ID: %)...', v_camp_id;

    -- 2. Kiểm tra hoặc thêm mới Phòng 03 Khối 4
    SELECT id INTO v_room_id
    FROM public.campaign_rooms
    WHERE campaign_id = v_camp_id AND grade = 4 AND room_number = 3;

    IF v_room_id IS NULL THEN
        INSERT INTO public.campaign_rooms (
            campaign_id,
            grade,
            room_number,
            topic,
            theme,
            passcode,
            module_id,
            development_status,
            engine_config
        ) VALUES (
            v_camp_id,
            4,
            3,
            'Thông tin trên trang web',
            'Kho Tri thức Web',
            'WEB_RESTORED',
            'web_exploration_lab_v1',
            'ready',
            '{"background":"assets/room3_4/nen_room.png","station_count":4,"task_count":18,"stations_coords":[{"id":0,"name":"Kho dữ liệu","icon":"📁","story":"khôi phục khả năng nhận biết văn bản, hình ảnh, âm thanh và video trên trang Đêm hội Trung thu.","x":150,"y":320,"w":260,"h":173,"cx":280,"cy":515,"file":"assets/room3_4/tram1.png","file_done":"assets/room3_4/tram1_ht.png","fragment":"assets/room3_4/manh_ghep_du_lieu.png","fragment_name":"Mảnh ghép Dữ liệu"},{"id":1,"name":"Bộ điều khiển liên kết","icon":"🔗","story":"tìm và sửa đường dẫn trên trang thư viện và website trường.","x":330,"y":80,"w":260,"h":173,"cx":460,"cy":275,"file":"assets/room3_4/tram2.png","file_done":"assets/room3_4/tram2_ht.png","fragment":"assets/room3_4/manh_ghep_dieu_khien.png","fragment_name":"Mảnh ghép Điều khiển liên kết"},{"id":2,"name":"Hệ thống bảo mật","icon":"🛡️","story":"xử lí tình huống an toàn trên web.","x":950,"y":150,"w":260,"h":173,"cx":1080,"cy":345,"file":"assets/room3_4/tram3.png","file_done":"assets/room3_4/tram3_ht.png","fragment":"assets/room3_4/manh_ghep_bao_mat.png","fragment_name":"Mảnh ghép Bảo mật"},{"id":3,"name":"Kho tri thức","icon":"📚","story":"vận dụng trên trang Thế giới động vật.","x":950,"y":600,"w":260,"h":173,"cx":1080,"cy":795,"file":"assets/room3_4/tram4.png","file_done":"assets/room3_4/tram4_ht.png","fragment":"assets/room3_4/manh_ghep_tri_thuc.png","fragment_name":"Mảnh ghép Tri thức"}],"door_coords":{"x":1280,"y":75,"w":260,"h":195,"cx":1410,"cy":175},"vault_door":{"locked":"assets/room3_4/cua_khoa.png","assembled":"assets/room3_4/cua_manh_ghep.png","open":"assets/room3_4/cua_mo.png"},"media":{"lantern":"assets/room3_4/long_den.png","lion_dance_video":"assets/room3_4/mua_lan_trung_thu.mp4","lion_dance_poster":"assets/room3_4/mua_lan_trung_thu.png","turtle_video":"assets/room3_4/rua_bien_boi.mp4","turtle_poster":"assets/room3_4/rua_bien.png","school_drum_audio":"assets/room3_4/tieng_trong_truong.mp3"},"spawn_point":{"x":480,"y":480},"unlock_target_room":4}'::jsonb
        ) RETURNING id INTO v_room_id;
        v_rooms_inserted := v_rooms_inserted + 1;
        RAISE NOTICE '  ✅ Đã thêm mới Khối % Phòng 0% (ID: %)', 4, 3, v_room_id;
    ELSE
        UPDATE public.campaign_rooms SET
            module_id = COALESCE(module_id, 'web_exploration_lab_v1'),
            development_status = 'ready',
            engine_config = CASE WHEN engine_config IS NULL OR engine_config = '{}'::jsonb THEN '{"background":"assets/room3_4/nen_room.png","station_count":4,"task_count":18,"stations_coords":[{"id":0,"name":"Kho dữ liệu","icon":"📁","story":"khôi phục khả năng nhận biết văn bản, hình ảnh, âm thanh và video trên trang Đêm hội Trung thu.","x":150,"y":320,"w":260,"h":173,"cx":280,"cy":515,"file":"assets/room3_4/tram1.png","file_done":"assets/room3_4/tram1_ht.png","fragment":"assets/room3_4/manh_ghep_du_lieu.png","fragment_name":"Mảnh ghép Dữ liệu"},{"id":1,"name":"Bộ điều khiển liên kết","icon":"🔗","story":"tìm và sửa đường dẫn trên trang thư viện và website trường.","x":330,"y":80,"w":260,"h":173,"cx":460,"cy":275,"file":"assets/room3_4/tram2.png","file_done":"assets/room3_4/tram2_ht.png","fragment":"assets/room3_4/manh_ghep_dieu_khien.png","fragment_name":"Mảnh ghép Điều khiển liên kết"},{"id":2,"name":"Hệ thống bảo mật","icon":"🛡️","story":"xử lí tình huống an toàn trên web.","x":950,"y":150,"w":260,"h":173,"cx":1080,"cy":345,"file":"assets/room3_4/tram3.png","file_done":"assets/room3_4/tram3_ht.png","fragment":"assets/room3_4/manh_ghep_bao_mat.png","fragment_name":"Mảnh ghép Bảo mật"},{"id":3,"name":"Kho tri thức","icon":"📚","story":"vận dụng trên trang Thế giới động vật.","x":950,"y":600,"w":260,"h":173,"cx":1080,"cy":795,"file":"assets/room3_4/tram4.png","file_done":"assets/room3_4/tram4_ht.png","fragment":"assets/room3_4/manh_ghep_tri_thuc.png","fragment_name":"Mảnh ghép Tri thức"}],"door_coords":{"x":1280,"y":75,"w":260,"h":195,"cx":1410,"cy":175},"vault_door":{"locked":"assets/room3_4/cua_khoa.png","assembled":"assets/room3_4/cua_manh_ghep.png","open":"assets/room3_4/cua_mo.png"},"media":{"lantern":"assets/room3_4/long_den.png","lion_dance_video":"assets/room3_4/mua_lan_trung_thu.mp4","lion_dance_poster":"assets/room3_4/mua_lan_trung_thu.png","turtle_video":"assets/room3_4/rua_bien_boi.mp4","turtle_poster":"assets/room3_4/rua_bien.png","school_drum_audio":"assets/room3_4/tieng_trong_truong.mp3"},"spawn_point":{"x":480,"y":480},"unlock_target_room":4}'::jsonb ELSE engine_config END
        WHERE id = v_room_id;
        RAISE NOTICE '  ℹ️ Khối % Phòng 0% đã tồn tại -> Bảo toàn nguyên vẹn nội dung của Admin (Cập nhật ready)', 4, 3;
    END IF;

    -- Item: w4_task_01
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_01') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_01',
            'task',
            'fill_select',
            'Trạm 1: Quan sát 5 nội dung trên website Đêm hội Trung thu',
            'Quan sát các phần tử thông tin trên trang web Lễ hội Đêm hội Trung thu và gán đúng dạng thông tin tương ứng.',
            'Quan sát 5 nội dung trên website Đêm hội Trung thu:',
            '',
            1,
            NULL,
            '{"examples":["🎵 Em nhấn nút ▶ và nghe bài hát “Tiếng trống trường” trên website","📄 Trên trang có đoạn giới thiệu: “Tết Trung thu là lễ hội thiếu nhi cổ truyền...”","🎬 Em nhấn ▶ và xem đoạn phim hoạt hình múa lân có hình chuyển động","🔗 Em đưa chuột vào chữ “Xem thêm hoạt động”, con trỏ biến thành hình bàn tay","🏮 Trang web đăng bức ảnh các bạn học sinh rước đèn ông sao rực rỡ"],"words":["Văn bản","Hình ảnh","Âm thanh","Video","Siêu liên kết"],"answers":[2,0,3,4,1],"feedback_incorrect":"Một số ví dụ chưa được phân loại đúng. Hãy kiểm tra từng thẻ!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_02
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_02') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_02',
            'task',
            'multi',
            'Trạm 1: Nhận diện nội dung thông tin trên website',
            'Phân biệt nội dung thông tin với các thành phần điều hướng trang.',
            'Em đang xem website lễ hội của trường. Chọn tất cả thẻ chứa nội dung thông tin (không chọn đường dẫn điều hướng).',
            '',
            1,
            NULL,
            '{"options":["📄 Đoạn văn","🖼️ Bức ảnh","🔊 Bản nhạc","🎬 Phim hoạt hình","🔗 Đường dẫn"],"answers":[0,1,2,3],"feedback_incorrect":"Siêu liên kết là thành phần điều hướng; các thẻ còn lại là nội dung thông tin."}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_03
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_03') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_03',
            'task',
            'match',
            'Trạm 1: Nối loại thông tin với chức năng',
            'Nối mỗi dạng thông tin với chức năng thể hiện tương ứng của nó trên trang web.',
            'Nối loại thông tin với chức năng tương ứng:',
            '',
            1,
            NULL,
            '{"left":["Văn bản","Hình ảnh","Âm thanh","Siêu liên kết"],"right":["A. Nghe giai điệu (ví dụ: Tiếng trống trường)","B. Mở trang hoặc vị trí khác","C. Chữ, câu, đoạn văn","D. Tranh ảnh trực quan"],"answers":[2,3,0,1],"feedback_incorrect":"Có cặp chưa đúng. Hãy nhớ chức năng của từng loại thông tin."}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_04
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_04') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_04',
            'task',
            'single',
            'Trạm 1: Các dạng thông tin trên trang giới thiệu lớp',
            'Lan làm website giới thiệu lớp học chứa nhiều thành phần đa phương tiện.',
            'Lan đang làm trang web giới thiệu lớp học, có bài viết, ảnh, bài hát, video và nút “Xem thêm”. Trang web của Lan có những dạng nào?',
            '',
            1,
            NULL,
            '{"options":["Chỉ văn bản và hình ảnh","Chỉ âm thanh và video","Văn bản, hình ảnh, âm thanh, video và siêu liên kết","Chỉ siêu liên kết"],"answers":2,"feedback_incorrect":"Hãy quan sát kĩ: trang có bài viết (văn bản), ảnh, bài hát (âm thanh), video và nút Xem thêm (siêu liên kết)!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_05
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_05') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_05',
            'task',
            'single',
            'Trạm 1: Nhận biết thông tin dạng Video',
            'Minh theo dõi hoạt động múa lân trên website trường học.',
            '🎬 Trên website của trường, Minh nhấn nút ▶ và thấy hình ảnh chuyển động kèm tiếng nói. Minh đang xem dạng thông tin nào?',
            '',
            1,
            NULL,
            '{"options":["Văn bản","Video","Siêu liên kết","Chỉ hình ảnh"],"answers":1,"feedback_incorrect":"Hình ảnh chuyển động kết hợp cùng âm thanh là dạng thông tin Video!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_06
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_06') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_06',
            'task',
            'match',
            'Trạm 2: Kết nối chức năng các thành phần Web',
            'Xác định vai trò của các dạng thông tin và siêu liên kết trên trang web.',
            'Kết nối chức năng của các thành phần:',
            '',
            1,
            NULL,
            '{"left":["Văn bản","Hình ảnh","Âm thanh","Siêu liên kết"],"right":["A. Mở trang khác","B. Tranh, ảnh","C. Nghe nội dung","D. Chữ và đoạn văn"],"answers":[3,1,2,0],"feedback_incorrect":"Hãy ghép đúng: Văn bản - Chữ và đoạn văn, Hình ảnh - Tranh ảnh, Âm thanh - Nghe nội dung, Siêu liên kết - Mở trang khác!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_07
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_07') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_07',
            'task',
            'single',
            'Trạm 2: Dấu hiệu nhận biết siêu liên kết',
            'Quan sát con trỏ chuột khi lướt web để nhận biết liên kết.',
            '🖱️ An đưa chuột vào dòng “Xem lịch học” trên website trường. Dấu hiệu nào giúp An nhận ra đó có thể là siêu liên kết?',
            '',
            1,
            NULL,
            '{"options":["Con trỏ chuyển thành hình bàn tay","Màn hình tự tối đi","Chuột không thể di chuyển","Không còn chữ trên trang"],"answers":0,"feedback_incorrect":"Khi đưa trỏ chuột lên siêu liên kết, con trỏ thường đổi từ mũi tên thành hình bàn tay 👆!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_08
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_08') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_08',
            'task',
            'single',
            'Trạm 2: Lựa chọn liên kết theo nhu cầu tìm kiếm',
            'Chọn liên kết phù hợp với mục tiêu tìm hiểu cách làm đèn ông sao trong thư viện điện tử.',
            '🏮 Em đang đọc bài về Tết Trung thu và muốn học làm đèn ông sao. Em nên nhấn liên kết nào?',
            '',
            1,
            NULL,
            '{"options":["Xem lịch học","Hướng dẫn làm đèn ông sao","Bảng cửu chương","Thông tin thời tiết"],"answers":1,"feedback_incorrect":"Để học làm đèn ông sao, em cần bấm vào đúng liên kết ''Hướng dẫn làm đèn ông sao''!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_09
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_09') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_09',
            'task',
            'single',
            'Trạm 2: Tác dụng khi nhấn vào siêu liên kết',
            'Tìm hiểu hành vi điều hướng của trình duyệt web.',
            '🖱️ Khi em nhấn dòng chữ “Thư viện ảnh” trên website trường, trình duyệt có thể thực hiện điều gì?',
            '',
            1,
            NULL,
            '{"options":["Chỉ làm thay đổi màu chữ","Mở trang web khác hoặc chuyển đến vị trí khác trên trang","Tự xóa mọi thông tin","Tắt máy tính"],"answers":1,"feedback_incorrect":"Siêu liên kết giúp chuyển hướng mở một trang web khác hoặc nhảy tới một vị trí khác trên trang!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_10
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_10') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_10',
            'task',
            'single',
            'Trạm 3: Nguy cơ khi xem nội dung không phù hợp',
            'Nhận biết các rủi ro an toàn số khi tiếp xúc với trang web xấu.',
            '⚠️ Bình thấy một trang web có nội dung đáng sợ và vẫn cố xem. Nguy cơ nào Bình có thể gặp?',
            '',
            1,
            NULL,
            '{"options":["Có thể bị dụ dỗ, lừa đảo hoặc bắt nạt trên mạng","Gõ bàn phím nhanh hơn","Máy tính chạy nhanh hơn","Luôn học tốt hơn"],"answers":0,"feedback_incorrect":"Xem trang web độc hại có thể khiến em bị dụ dỗ, lừa đảo, bắt nạt mạng hoặc ảnh hưởng tâm lý tiêu cực."}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_11
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_11') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_11',
            'task',
            'multi',
            'Trạm 3: Hành động an toàn khi tìm tài liệu trực tuyến',
            'Lựa chọn các quy tắc bảo đảm an toàn khi khai thác Internet.',
            '👩‍💻 Mai tìm tài liệu làm bài tập ở nhà. Hãy chọn tất cả hành động an toàn mà Mai nên làm.',
            '',
            1,
            NULL,
            '{"options":["Nhờ người lớn giúp khi cần","Tin ngay mọi thông tin trên mạng","Truy cập trang phù hợp lứa tuổi","Bấm mọi quảng cáo lạ"],"answers":[0,2],"feedback_incorrect":"Mai chỉ nên nhờ người lớn giúp đỡ và truy cập trang web phù hợp lứa tuổi. Không tin ngay mọi thứ hay bấm quảng cáo lạ!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_12
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_12') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_12',
            'task',
            'single',
            'Trạm 3: Nhận biết liên kết quảng cáo bạo lực',
            'Phát hiện siêu liên kết ẩn sau các biểu ngữ quảng cáo.',
            '🎮 Khi đọc bài học, Nam thấy quảng cáo trò chơi bạo lực. Nam đưa chuột lên quảng cáo, con trỏ thành hình bàn tay. Điều đó cho biết gì?',
            '',
            1,
            NULL,
            '{"options":["Ô quảng cáo có thể chứa siêu liên kết","Máy tính đã bị hỏng","Đó chắc chắn là trang an toàn","Không có chức năng gì"],"answers":0,"feedback_incorrect":"Con trỏ biến thành hình bàn tay cho thấy ô quảng cáo chứa siêu liên kết sẵn sàng dẫn đến trang web độc hại khác!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_13
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_13') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_13',
            'task',
            'single',
            'Trạm 3: Xử lý tình huống khi gặp quảng cáo độc hại',
            'Cách ứng xử đúng đắn của học sinh tiểu học trước cạm bẫy trực tuyến.',
            '🛑 Quảng cáo trò chơi bạo lực xuất hiện trên trang Nam đang học. Nam nên xử lý như thế nào?',
            '',
            1,
            NULL,
            '{"options":["Nhấn để thử chơi","Gửi cho bạn bè","Không nhấn, rời nội dung và báo người lớn đáng tin cậy","Tải xuống ngay"],"answers":2,"feedback_incorrect":"Em tuyệt đối không nhấn, đóng nội dung lại ngay và báo cho bố mẹ hoặc thầy cô!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_14
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_14') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_14',
            'task',
            'single',
            'Trạm 3: Bảo vệ thông tin cá nhân trên mạng',
            'Lý do cần sự trợ giúp của người lớn khi bị yêu cầu khai báo thông tin cá nhân.',
            '👨‍👩‍👧 Khi tìm tài liệu, Hoa gặp một trang web yêu cầu nhập họ tên và số điện thoại. Vì sao Hoa nên nhờ bố mẹ hoặc thầy cô?',
            '',
            1,
            NULL,
            '{"options":["Để được hướng dẫn chọn thông tin phù hợp và xử lý tình huống không an toàn","Để truy cập mọi trang web tùy thích","Để không cần suy nghĩ khi đọc thông tin","Để máy tính tự động nhanh hơn"],"answers":0,"feedback_incorrect":"Khai báo thông tin cá nhân rất nguy hiểm. Cần người lớn hướng dẫn và bảo vệ em trước các nguy cơ lừa đảo!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_15
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_15') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_15',
            'task',
            'multi',
            'Trạm 4: Nhận diện đa phương tiện trên website',
            'Xác định các dạng dữ liệu thực tế xuất hiện trong một trang tin.',
            '🏮 Trang “Vui hội trăng rằm” hiển thị một đoạn giới thiệu và bức ảnh múa lân. Hãy chọn đúng hai dạng thông tin em nhìn thấy.',
            '',
            1,
            NULL,
            '{"options":["Văn bản","Hình ảnh","Âm thanh","Video"],"answers":[0,1],"feedback_incorrect":"Đoạn giới thiệu là Văn bản, bức ảnh múa lân là Hình ảnh!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_16
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_16') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_16',
            'task',
            'multi',
            'Trạm 4: Phân biệt Video và Âm thanh trên trang Thế giới động vật',
            'Kết hợp tương tác nghe nhìn trên nền tảng khám phá Thế giới động vật.',
            '🎬 🔊 Trên website Thế giới động vật, em bấm ▶ xem phim rùa biển bơi và 🔊 nghe bài thuyết minh. Chọn hai dạng thông tin tương ứng.',
            '',
            1,
            NULL,
            '{"options":["Văn bản","Hình ảnh","Âm thanh","Video"],"answers":[2,3],"feedback_incorrect":"Phim khoa học có hình chuyển động là Video, bài thuyết minh phát ra loa là Âm thanh!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_17
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_17') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_17',
            'task',
            'multi',
            'Trạm 4: Nhận diện hai nguy cơ tiềm ẩn trên mạng',
            'Tổng hợp các rủi ro chính khi truy cập môi trường mạng thiếu kiểm soát.',
            '⚠️ Một bạn nhỏ vô tình mở website không phù hợp lứa tuổi. Chọn hai nguy cơ có thể xảy ra.',
            '',
            1,
            NULL,
            '{"options":["Bị lừa đảo hoặc dụ dỗ","Có thể gặp nội dung gây sợ hãi","Máy tính chắc chắn chạy nhanh hơn","Luôn được điểm cao hơn"],"answers":[0,1],"feedback_incorrect":"Vào trang không phù hợp có nguy cơ bị lừa đảo, dụ dỗ hoặc gặp phải hình ảnh bạo lực gây sợ hãi!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- Item: w4_task_18
    IF NOT EXISTS (SELECT 1 FROM public.room_items WHERE room_id = v_room_id AND item_key = 'w4_task_18') THEN
        INSERT INTO public.room_items (
            room_id,
            item_key,
            item_type,
            kind,
            title,
            intro,
            question,
            hint,
            sort_order,
            digit,
            content_payload
        ) VALUES (
            v_room_id,
            'w4_task_18',
            'task',
            'single',
            'Trạm 4: Tình huống tổng hợp xử lý trang web lớp học',
            'Xử lý lỗi định dạng dữ liệu và cảnh báo quảng cáo không lành mạnh.',
            '🔍 Em kiểm tra trang web của lớp: mục “Ảnh múa lân” lại phát bài hát; bên cạnh có liên kết quảng cáo trò chơi bạo lực. Em sẽ xử lý thế nào?',
            '',
            1,
            NULL,
            '{"options":["Gọi bài hát là hình ảnh và nhấn quảng cáo","Nhận biết bài hát là âm thanh, không nhấn quảng cáo không phù hợp và nhờ người lớn hỗ trợ","Bấm quảng cáo để kiểm tra","Bỏ qua mọi cảnh báo"],"answers":1,"feedback_incorrect":"Bài hát phát ra là Âm thanh. Tuyệt đối không bấm quảng cáo độc hại và hãy báo ngay cho thầy cô/bố mẹ!"}'::jsonb
        );
        v_items_inserted := v_items_inserted + 1;
    END IF;

    -- ------------------------------------------------------------------------
    -- KIỂM TRA TÍNH TOÀN VẸN CỦA PHÒNG 3 KHỐI 4
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_item_count
    FROM public.room_items
    WHERE room_id = v_room_id;

    RAISE NOTICE '🎉 TỔNG KẾT: Phòng 03 Khối 4 hiện có % vật phẩm (Yêu cầu: 18). Thêm mới: % item.', v_item_count, v_items_inserted;

    IF v_item_count <> 18 THEN
        RAISE EXCEPTION '⚠️ Phòng 03 Khối 4 chưa có đủ 18 vật phẩm (Hiện có: %)! Hủy giao dịch.', v_item_count;
    END IF;

    -- ------------------------------------------------------------------------
    -- CẬP NHẬT published_payload CỦA MASTER
    -- ------------------------------------------------------------------------
    FOR v_room IN
        SELECT * FROM public.campaign_rooms
        WHERE campaign_id = v_camp_id
        ORDER BY grade ASC, room_number ASC
    LOOP
        v_tasks_obj := '{}'::jsonb;
        v_secrets_obj := '{}'::jsonb;
        v_items_arr := '[]'::jsonb;

        FOR v_item IN
            SELECT * FROM public.room_items
            WHERE room_id = v_room.id
            ORDER BY sort_order ASC
        LOOP
            v_item_data := jsonb_build_object(
                'id', v_item.id,
                'item_key', v_item.item_key,
                'item_type', v_item.item_type,
                'kind', v_item.kind,
                'title', v_item.title,
                'intro', v_item.intro,
                'question', v_item.question,
                'hint', v_item.hint,
                'sort_order', v_item.sort_order,
                'content_payload', v_item.content_payload
            );

            v_items_arr := v_items_arr || jsonb_build_array(v_item_data);

            IF v_item.item_type = 'task' THEN
                v_tasks_obj := jsonb_set(v_tasks_obj, ARRAY[v_item.item_key], v_item_data);
            ELSE
                v_secrets_obj := jsonb_set(v_secrets_obj, ARRAY[v_item.item_key], v_item_data);
            END IF;
        END LOOP;

        v_room_json := jsonb_build_object(
            'room_number', v_room.room_number,
            'grade', v_room.grade,
            'topic', v_room.topic,
            'code', v_room.passcode,
            'theme', v_room.theme,
            'accent', v_room.accent_color,
            'module_id', COALESCE(v_room.module_id, 'escape_room_point_click_v1'),
            'development_status', COALESCE(v_room.development_status, 'ready'),
            'engine_config', COALESCE(v_room.engine_config, '{}'::jsonb),
            'items', v_items_arr,
            'tasks', v_tasks_obj,
            'secrets', v_secrets_obj
        );

        v_rooms_json := v_rooms_json || jsonb_build_array(v_room_json);
    END LOOP;

    v_published_payload := jsonb_build_object(
        'campaign', jsonb_build_object(
            'id', v_camp_id,
            'title', 'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
            'share_code', 'MASTER',
            'version', v_new_version,
            'published_at', NOW()
        ),
        'rooms', v_rooms_json
    );

    UPDATE public.campaigns
    SET is_published = TRUE,
        version = v_new_version,
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{published_payload}', v_published_payload),
        updated_at = NOW()
    WHERE id = v_camp_id;

    RAISE NOTICE '✅ Đồng bộ hoàn tất! Chiến dịch MASTER đã nâng lên phiên bản v% với đầy đủ 8 phòng.', v_new_version;
END;
$$;
