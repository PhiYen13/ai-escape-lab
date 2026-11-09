-- ============================================================================
-- 20261102000004_seed_master_data.sql (Phiên bản hoàn thiện bootstrap & validation toàn diện)
-- Dự án: AI Escape Lab - Nạp bộ câu hỏi gốc Master Template (Room 01: Lớp 3, 4, 5)
-- ============================================================================

DO $$
DECLARE
    v_admin_id UUID;
    v_admin_verified BOOLEAN := FALSE;
    v_camp_id UUID;
    v_room_id UUID;
    v_room_count INT;
    v_item_count INT;
    v_task_count INT;
    v_secret_count INT;
    v_rooms_json JSONB := '[]'::jsonb;
    v_room_json JSONB;
    v_tasks_obj JSONB;
    v_secrets_obj JSONB;
    v_item RECORD;
    v_room RECORD;
    v_item_data JSONB;
    v_published_payload JSONB;
    v_verified_payload JSONB;
    v_pub_room JSONB;
    v_task_digits TEXT[];
    v_sorted_digits TEXT;
    v_sorted_passcode TEXT;
    v_p JSONB;
    v_ans_len INT;
    v_it_len INT;
    v_elem JSONB;
BEGIN
    -- 1. XÁC MINH DANH TÍNH ADMIN TỪ SUPABASE AUTH & ĐỒNG BỘ PROFILES
    -- Không sử dụng custom GUC (app.is_admin_bootstrap); trigger xác minh trực tiếp qua auth.users & admin_whitelist
    SELECT u.id,
           ((u.email_confirmed_at IS NOT NULL) OR (u.confirmed_at IS NOT NULL))
    INTO v_admin_id, v_admin_verified
    FROM auth.users u
    JOIN public.admin_whitelist w ON LOWER(w.email) = LOWER(u.email)
    WHERE LOWER(u.email) = 'yenttp@skylineschool.edu.vn'
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION '⚠️ Chưa tìm thấy tài khoản Admin (yenttp@skylineschool.edu.vn) trong auth.users! Vui lòng vào Authentication > Users trên Supabase Dashboard để tạo tài khoản trước khi chạy file Seed này.';
    END IF;

    IF NOT v_admin_verified THEN
        RAISE EXCEPTION '⚠️ Tài khoản Admin (yenttp@skylineschool.edu.vn) trong auth.users chưa được xác minh email (email_confirmed_at IS NULL)! Vui lòng xác nhận email trên Supabase Auth Dashboard trước khi chạy Seed.';
    END IF;

    -- Đảm bảo hồ sơ Admin trong public.profiles được đồng bộ chính xác với role = 'admin'
    INSERT INTO public.profiles (id, email, full_name, role, school_name)
    VALUES (v_admin_id, 'yenttp@skylineschool.edu.vn', 'Quản trị viên (Admin)', 'admin', 'Sky-Line School')
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        email = EXCLUDED.email,
        updated_at = NOW();

    -- 2. BẢO VỆ DỮ LIỆU ĐÃ SỬA CỦA ADMIN:
    -- Nếu bộ Master đã tồn tại trong hệ thống, giữ nguyên nội dung hiện tại, không tự ý ghi đè.
    SELECT id INTO v_camp_id FROM public.campaigns WHERE share_code = 'MASTER';

    IF v_camp_id IS NOT NULL THEN
        RAISE NOTICE 'ℹ️ Bộ câu hỏi gốc (MASTER) đã tồn tại trong hệ thống. Để bảo vệ các chỉnh sửa trước đó của Admin, toàn bộ câu hỏi và phòng chơi sẽ được giữ nguyên (KHÔNG ghi đè).';
        RETURN;
    END IF;

    -- 4. TẠO MASTER CAMPAIGN MỚI (Khởi tạo lần đầu)
    INSERT INTO public.campaigns (
        teacher_id,
        title,
        share_code,
        is_template,
        is_published,
        version,
        metadata
    )
    VALUES (
        v_admin_id,
        'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
        'MASTER',
        TRUE,
        TRUE,
        1,
        '{"description":"Bộ câu hỏi Escape Room chuẩn cho học sinh lớp 3, 4, 5","author":"Sky-Line School","admin_email":"yenttp@skylineschool.edu.vn"}'::jsonb
    )
    RETURNING id INTO v_camp_id;

    -- 5. NẠP DỮ LIỆU CÁC PHÒNG VÀ THỬ THÁCH (KHỐI 3, 4, 5)

    -- ========================================================================
    -- PHÒNG 1 - KHỐI LỚP 3: Thông tin và quyết định
    -- ========================================================================
    INSERT INTO public.campaign_rooms (
        campaign_id,
        room_number,
        grade,
        topic,
        passcode,
        theme,
        accent_color
    )
    VALUES (
        v_camp_id,
        1,
        3,
        'Thông tin và quyết định',
        '4279',
        'Phòng thí nghiệm thông tin',
        '#77e6a0'
    )
    RETURNING id INTO v_room_id;

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'map',
        'task',
        'match',
        'THÔNG TIN QUANH EM',
        NULL,
        'Ghép mỗi thông tin với quyết định phù hợp.',
        '4',
        NULL,
        '{"question":"Ghép mỗi thông tin với quyết định phù hợp.","feedback":"Thông tin giúp em đưa ra quyết định phù hợp. Hãy đọc kỹ từng tình huống nhé!","left":["🔔 Tiếng chuông báo vào lớp","🌧️ Trời đang mưa","🚦 Đèn giao thông màu đỏ"],"right":["Dừng lại","Chuẩn bị vào lớp học","Mang theo áo mưa"],"correct":[1,2,0]}'::jsonb,
        1
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'computer',
        'task',
        'sequence',
        'THÁM TỬ THÔNG TIN',
        NULL,
        'Chọn giác quan giúp em tiếp nhận thông tin.',
        '2',
        NULL,
        '{"question":"Chọn giác quan giúp em tiếp nhận thông tin.","feedback":"Hãy nghĩ xem em nhìn thấy hay nghe thấy thông tin này.","items":[{"question":"Lan nhìn thấy biển báo “Không chạy nhảy”.","answers":["👁️ Mắt","👂 Tai"],"correct":0},{"question":"Minh nghe tiếng trống báo giờ ra chơi.","answers":["👁️ Mắt","👂 Tai"],"correct":1},{"question":"An đọc được thông báo ngày mai lớp đi tham quan.","answers":["👁️ Mắt","👂 Tai"],"correct":0}]}'::jsonb,
        2
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'library',
        'task',
        'sequence',
        'QUYẾT ĐỊNH THÔNG MINH',
        'Ngày mai, lớp 3A tổ chức hoạt động trồng cây. Cô giáo thông báo: “Các em nhớ mang theo một chai nước nhỏ và đội mũ khi tham gia hoạt động ngoài trời.”',
        '',
        '7',
        NULL,
        '{"question":"","feedback":"Hãy đọc lại thông báo và tìm những việc cô giáo nhắc em chuẩn bị.","items":[{"question":"Em nhận được thông tin gì từ thông báo của cô giáo?","answers":["Ngày mai lớp được nghỉ học.","Ngày mai lớp tham gia hoạt động ngoài trời và cần chuẩn bị nước, mũ.","Ngày mai lớp đi bơi."],"correct":1},{"question":"Dựa vào thông tin đó, em sẽ quyết định làm gì?","answers":["Chuẩn bị chai nước và mũ.","Không cần chuẩn bị gì.","Chỉ mang đồ chơi."],"correct":0}]}'::jsonb,
        3
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'station',
        'task',
        'multi',
        'MỘT THÔNG TIN – NHIỀU QUYẾT ĐỊNH',
        'Robot nghiên cứu nhận được thông tin: “Ngoài trời đang mưa rất to.”',
        'Những quyết định nào phù hợp với thông tin trên?',
        '9',
        NULL,
        '{"question":"Những quyết định nào phù hợp với thông tin trên?","feedback":"Một thông tin có thể dẫn đến nhiều quyết định phù hợp. Em hãy chọn tất cả quyết định an toàn.","answers":["Bạn An mang áo mưa khi ra ngoài.","Bạn Bình chạy ra sân chơi.","Bạn Chi đóng cửa sổ để tránh nước mưa hắt vào phòng."],"correct":[0,2]}'::jsonb,
        4
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'robot',
        'secret',
        'single',
        'ROBOT CẦN EM GIÚP!',
        NULL,
        'Pin của robot chỉ còn 5%. Robot nên làm gì?',
        NULL,
        'Chữ số đầu tiên là số chẵn lớn hơn 2.',
        '{"question":"Pin của robot chỉ còn 5%. Robot nên làm gì?","feedback":"","answers":["Tiếp tục hoạt động đến khi hết pin.","Di chuyển đến trạm sạc pin.","Tăng tốc độ di chuyển."],"correct":1}'::jsonb,
        5
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'plant',
        'secret',
        'single',
        'GIẢI CỨU CÂY XANH',
        NULL,
        'Cảm biến phát hiện đất trong chậu đang khô. Hệ thống nên làm gì?',
        NULL,
        'Chữ số thứ hai là số nhỏ nhất trong bốn chữ số.',
        '{"question":"Cảm biến phát hiện đất trong chậu đang khô. Hệ thống nên làm gì?","feedback":"","answers":["Bật hệ thống tưới nước.","Tắt hệ thống tưới nước.","Bật đèn trang trí."],"correct":0}'::jsonb,
        6
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'book',
        'secret',
        'single',
        'AI ĐƯA RA QUYẾT ĐỊNH ĐÚNG?',
        'Nam nghe thấy tiếng chuông báo cháy và chen lấn để chạy ra ngoài. Mai bình tĩnh làm theo hướng dẫn của giáo viên.',
        'Bạn nào đưa ra quyết định phù hợp?',
        NULL,
        'Chữ số cuối cùng là số lớn nhất trong bốn chữ số.',
        '{"question":"Bạn nào đưa ra quyết định phù hợp?","feedback":"","answers":["Nam.","Mai.","Cả hai bạn."],"correct":1}'::jsonb,
        7
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'chest',
        'secret',
        'multi',
        'GIẢI MÃ THÔNG ĐIỆP',
        'Ngày mai trường tổ chức ngày hội thể thao. Học sinh cần mặc trang phục thể thao và mang theo nước uống.',
        'Em cần chuẩn bị những gì?',
        NULL,
        'Chữ số thứ ba lớn hơn chữ số đầu tiên.',
        '{"question":"Em cần chuẩn bị những gì?","feedback":"","answers":["Trang phục thể thao.","Nước uống.","Đồ chơi điện tử.","Sách truyện."],"correct":[0,1]}'::jsonb,
        8
    );

    -- ========================================================================
    -- PHÒNG 1 - KHỐI LỚP 4: Phần cứng và phần mềm máy tính
    -- ========================================================================
    INSERT INTO public.campaign_rooms (
        campaign_id,
        room_number,
        grade,
        topic,
        passcode,
        theme,
        accent_color
    )
    VALUES (
        v_camp_id,
        1,
        4,
        'Phần cứng và phần mềm máy tính',
        '8631',
        'Xưởng công nghệ máy tính',
        '#65c8ff'
    )
    RETURNING id INTO v_room_id;

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'map',
        'task',
        'sort',
        'PHÂN LOẠI THIẾT BỊ',
        NULL,
        'Kéo các thẻ vào nhóm PHẦN CỨNG hoặc PHẦN MỀM.',
        '6',
        NULL,
        '{"question":"Kéo các thẻ vào nhóm PHẦN CỨNG hoặc PHẦN MỀM.","feedback":"Em hãy thử lại nhé! Phần cứng là những thiết bị mà em có thể nhìn thấy, cầm nắm và sờ được. Phần mềm là các chương trình máy tính mà em không thể cầm nắm được. Hãy dựa vào đặc điểm này để phân loại lại các thành phần nhé!","items":["🖥️ Màn hình","⌨️ Bàn phím","🖱️ Chuột máy tính","🎨 Phần mềm Paint","📝 Microsoft Word","🌐 Trình duyệt web"],"correct":[0,0,0,1,1,1],"groups":["PHẦN CỨNG","PHẦN MỀM"]}'::jsonb,
        1
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'computer',
        'task',
        'sequence',
        'AI LÀM NHIỆM VỤ GÌ?',
        NULL,
        '',
        '3',
        NULL,
        '{"question":"","feedback":"Hãy xác định chức năng của thiết bị hoặc phần mềm mà em cần.","items":[{"question":"Em muốn nhập một đoạn văn bản vào máy tính. Thiết bị nào giúp em nhập chữ?","answers":["Loa.","Bàn phím.","Màn hình."],"correct":1},{"question":"Em muốn nghe âm thanh từ một video. Thiết bị nào giúp phát âm thanh?","answers":["Loa.","Chuột.","Bàn phím."],"correct":0},{"question":"Em muốn vẽ một bức tranh trên máy tính. Phần mềm nào phù hợp?","answers":["Phần mềm Paint.","Phần mềm máy tính không rõ chức năng.","Hệ điều hành."],"correct":0}]}'::jsonb,
        2
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'library',
        'task',
        'sequence',
        'ĐIỀU GÌ SẼ XẢY RA?',
        NULL,
        '',
        '8',
        NULL,
        '{"question":"","feedback":"Hãy xác định thành phần bị thiếu và công việc mà thành phần đó hỗ trợ.","items":[{"question":"Máy tính vẫn hoạt động nhưng loa bị hỏng. Điều gì có thể xảy ra?","answers":["Không thể nhìn thấy hình ảnh trên màn hình.","Không thể nghe âm thanh qua loa bị hỏng.","Không thể nhập chữ bằng bàn phím."],"correct":1},{"question":"Máy tính có màn hình, bàn phím, chuột nhưng chưa có phần mềm vẽ. Em gặp khó khăn gì?","answers":["Không thể sử dụng phần mềm vẽ đó để tạo tranh.","Không thể bật màn hình.","Không thể sử dụng bàn phím."],"correct":0},{"question":"Bạn An muốn soạn một bài văn. Em chọn phần mềm nào?","answers":["Phần mềm Paint.","Phần mềm soạn thảo văn bản.","Phần mềm nghe nhạc."],"correct":1}]}'::jsonb,
        3
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'station',
        'task',
        'pair',
        'KHÔI PHỤC HỆ THỐNG MÁY TÍNH',
        NULL,
        'Ghép mỗi công việc với một thiết bị phần cứng và một phần mềm phù hợp.',
        '1',
        NULL,
        '{"question":"Ghép mỗi công việc với một thiết bị phần cứng và một phần mềm phù hợp.","feedback":"Hệ thống chưa thể hoạt động. Em hãy kiểm tra lại: Công việc này cần thiết bị nào và chương trình nào?","jobs":["Soạn thảo bài văn","Vẽ tranh","Nghe nhạc"],"hardware":["Bàn phím","Chuột","Loa"],"software":["Phần mềm soạn thảo văn bản","Phần mềm Paint","Phần mềm phát nhạc"],"correct":[[0,0],[1,1],[2,2]]}'::jsonb,
        4
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'robot',
        'secret',
        'single',
        'ROBOT BỊ MẤT GIỌNG',
        'Robot phát một bài hát nhưng không nghe thấy âm thanh vì loa đã bị hỏng.',
        'Thành phần bị hỏng thuộc nhóm nào?',
        NULL,
        'Chữ số đầu tiên là số lớn nhất trong bốn chữ số.',
        '{"question":"Thành phần bị hỏng thuộc nhóm nào?","feedback":"","answers":["Phần mềm.","Phần cứng.","Cả phần cứng và phần mềm."],"correct":1}'::jsonb,
        5
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'plant',
        'secret',
        'single',
        'BỘ NÃO CỦA CHẬU CÂY',
        'Chậu cây có cảm biến độ ẩm, máy bơm nước và chương trình điều khiển tưới cây.',
        'Thành phần nào là phần mềm?',
        NULL,
        'Chữ số cuối cùng là số nhỏ nhất trong bốn chữ số.',
        '{"question":"Thành phần nào là phần mềm?","feedback":"","answers":["Cảm biến độ ẩm đất.","Máy bơm nước.","Chương trình điều khiển tưới cây."],"correct":2}'::jsonb,
        6
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'book',
        'secret',
        'multi',
        'TÌM PHÁT BIỂU ĐÚNG',
        NULL,
        'Chọn tất cả phát biểu đúng.',
        NULL,
        'Chữ số thứ hai là số chẵn nhỏ hơn 8.',
        '{"question":"Chọn tất cả phát biểu đúng.","feedback":"","answers":["Phần cứng là những bộ phận vật lí của máy tính.","Phần mềm là những chương trình giúp máy tính thực hiện công việc.","Chuột máy tính là một phần mềm."],"correct":[0,1]}'::jsonb,
        7
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'chest',
        'secret',
        'single',
        'CHỌN BỘ CÔNG CỤ PHÙ HỢP',
        'Bạn Mai muốn tạo một bức tranh trên máy tính.',
        'Bộ công cụ nào phù hợp nhất?',
        NULL,
        'Chữ số thứ ba là số lẻ lớn hơn 1.',
        '{"question":"Bộ công cụ nào phù hợp nhất?","feedback":"","answers":["Loa và phần mềm nghe nhạc.","Chuột và phần mềm Paint.","Máy in và phần mềm phát nhạc.","Bàn phím và phần mềm nghe nhạc."],"correct":1}'::jsonb,
        8
    );

    -- ========================================================================
    -- PHÒNG 1 - KHỐI LỚP 5: Em có thể làm gì với máy tính?
    -- ========================================================================
    INSERT INTO public.campaign_rooms (
        campaign_id,
        room_number,
        grade,
        topic,
        passcode,
        theme,
        accent_color
    )
    VALUES (
        v_camp_id,
        1,
        5,
        'Em có thể làm gì với máy tính?',
        '5924',
        'Trung tâm sáng tạo số',
        '#cf9aff'
    )
    RETURNING id INTO v_room_id;

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'map',
        'task',
        'match',
        'NHÀ THÁM HIỂM SỐ',
        'Robot muốn khám phá các địa danh nổi tiếng nhưng không thể trực tiếp đến đó.',
        'Ghép mỗi mục đích với cách sử dụng máy tính phù hợp.',
        '2',
        NULL,
        '{"question":"Ghép mỗi mục đích với cách sử dụng máy tính phù hợp.","feedback":"Máy tính giúp chúng ta sử dụng bản đồ số, xem hình ảnh, video và tìm kiếm thông tin.","left":["Muốn biết vị trí Vịnh Hạ Long","Muốn quan sát tháp Eiffel","Muốn tìm hiểu lịch sử Kim tự tháp Ai Cập"],"right":["Tìm kiếm và đọc thông tin","Xem bản đồ số","Xem hình ảnh hoặc video"],"correct":[1,2,0]}'::jsonb,
        1
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'computer',
        'task',
        'sequence',
        'CHUYÊN GIA CÔNG NGHỆ',
        NULL,
        '',
        '5',
        NULL,
        '{"question":"","feedback":"Hãy xác định công việc muốn thực hiện rồi chọn phần mềm có chức năng phù hợp.","items":[{"question":"Bạn An muốn viết bài văn kể về chuyến tham quan. Bạn nên dùng phần mềm nào?","answers":["Phần mềm soạn thảo văn bản.","Phần mềm nghe nhạc.","Phần mềm xem video."],"correct":0},{"question":"Bạn Bình muốn tạo bài trình chiếu giới thiệu các loài động vật. Bạn dùng phần mềm nào?","answers":["Phần mềm vẽ.","Phần mềm trình chiếu.","Phần mềm phát nhạc."],"correct":1},{"question":"Bạn Chi muốn thiết kế thiệp điện tử tặng mẹ. Bạn nên dùng phần mềm nào?","answers":["Phần mềm thiết kế đồ họa.","Phần mềm nghe nhạc.","Phần mềm xem video."],"correct":0}]}'::jsonb,
        2
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'library',
        'task',
        'order',
        'DỰ ÁN HỌC TẬP THÔNG MINH',
        'Nhóm Minh muốn dùng máy tính làm bài trình chiếu về “Bảo vệ môi trường xanh”.',
        'Sắp xếp các công việc theo trình tự hợp lí.',
        '9',
        NULL,
        '{"question":"Sắp xếp các công việc theo trình tự hợp lí.","feedback":"Trước khi tạo bài trình chiếu, em cần chuẩn bị gì? Sau khi hoàn thành, em có cần kiểm tra lại không?","items":["Tạo bài trình chiếu, kết hợp nội dung và hình ảnh.","Xác định những thông tin cần tìm hiểu về chủ đề.","Tìm kiếm, lựa chọn thông tin và hình ảnh phù hợp.","Kiểm tra, chỉnh sửa và hoàn thiện bài trình chiếu."],"correct":[1,2,0,3]}'::jsonb,
        3
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'station',
        'task',
        'multi',
        'MÁY TÍNH CÓ THỂ GIÚP GÌ?',
        NULL,
        'Chọn tất cả hoạt động có thể thực hiện bằng máy tính thông thường khi sử dụng phần mềm và thiết bị phù hợp.',
        '4',
        NULL,
        '{"question":"Chọn tất cả hoạt động có thể thực hiện bằng máy tính thông thường khi sử dụng phần mềm và thiết bị phù hợp.","feedback":"Máy tính giúp học tập, tìm kiếm thông tin, sáng tạo và giao tiếp. Một số công việc thực tế cần thêm thiết bị phù hợp.","answers":["Soạn thảo một bài văn.","Tìm kiếm thông tin trên Internet.","Tự nấu một bữa cơm mà không cần thiết bị hỗ trợ.","Thiết kế một tấm thiệp điện tử.","Trò chuyện trực tuyến với bạn bè.","Tự quét dọn nhà cửa mà không cần thiết bị hỗ trợ."],"correct":[0,1,3,4]}'::jsonb,
        4
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'robot',
        'secret',
        'single',
        'ROBOT CẦN MỘT BÀI THUYẾT TRÌNH',
        'Robot cần bài giới thiệu phòng thí nghiệm có chữ, hình ảnh và các trang trình chiếu.',
        'Robot nên sử dụng phần mềm nào?',
        NULL,
        'Chữ số đầu tiên là số lẻ lớn hơn 3 và nhỏ hơn 7.',
        '{"question":"Robot nên sử dụng phần mềm nào?","feedback":"","answers":["Phần mềm trình chiếu.","Phần mềm nghe nhạc.","Phần mềm xem video."],"correct":0}'::jsonb,
        5
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'plant',
        'secret',
        'single',
        'NHẬT KÍ CHĂM SÓC CÂY',
        'Chậu cây muốn theo dõi sự phát triển: chụp ảnh mỗi tuần, ghi chiều cao, lưu thông tin vào máy tính và dùng bảng tính theo dõi sự thay đổi.',
        'Máy tính có thể trực tiếp hỗ trợ những công việc nào trong danh sách?',
        NULL,
        'Chữ số cuối cùng là số chẵn lớn hơn 2 và nhỏ hơn 5.',
        '{"question":"Máy tính có thể trực tiếp hỗ trợ những công việc nào trong danh sách?","feedback":"","answers":["Chỉ công việc 1.","Chỉ công việc 2.","Công việc 3 và 4.","Không công việc nào."],"correct":2}'::jsonb,
        6
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'book',
        'secret',
        'multi',
        'NGƯỜI BẠN CÔNG NGHỆ',
        NULL,
        'Chọn tất cả phát biểu đúng.',
        NULL,
        'Chữ số thứ hai là số lớn nhất trong bốn chữ số.',
        '{"question":"Chọn tất cả phát biểu đúng.","feedback":"","answers":["Máy tính giúp tìm kiếm thông tin phục vụ học tập.","Máy tính giúp tạo bài trình chiếu.","Máy tính tự thực hiện mọi công việc trong cuộc sống mà không cần con người hoặc thiết bị hỗ trợ.","Máy tính giúp trao đổi thông tin với người khác qua Internet."],"correct":[0,1,3]}'::jsonb,
        7
    );

    INSERT INTO public.room_items (
        room_id,
        item_key,
        item_type,
        kind,
        title,
        intro,
        question,
        digit,
        hint,
        content_payload,
        sort_order
    )
    VALUES (
        v_room_id,
        'chest',
        'secret',
        'single',
        'MÓN QUÀ CÔNG NGHỆ',
        'Mai muốn làm thiệp điện tử tặng mẹ: thiết kế thiệp, chèn ảnh gia đình, viết lời chúc và thêm nhạc nền.',
        'Máy tính có thể hỗ trợ Mai thực hiện những công việc nào?',
        NULL,
        'Chữ số thứ ba là số chẵn nhỏ nhất trong bốn chữ số.',
        '{"question":"Máy tính có thể hỗ trợ Mai thực hiện những công việc nào?","feedback":"","answers":["Chỉ thiết kế thiệp.","Chỉ chèn hình ảnh.","Chỉ viết lời chúc.","Cả bốn công việc trên."],"correct":3}'::jsonb,
        8
    );

    -- 6. QUY TRÌNH VALIDATION TƯƠNG ĐƯƠNG 100% VỚI validate_campaign()
    -- Kiểm tra tổng số phòng (3 phòng: Khối 3, 4, 5) và tổng số nhiệm vụ (24 nhiệm vụ)
    SELECT COUNT(*) INTO v_room_count FROM public.campaign_rooms WHERE campaign_id = v_camp_id;
    SELECT COUNT(*) INTO v_item_count 
    FROM public.room_items r 
    JOIN public.campaign_rooms c ON c.id = r.room_id 
    WHERE c.campaign_id = v_camp_id;

    IF v_room_count <> 3 OR v_item_count <> 24 THEN
        RAISE EXCEPTION 'Dữ liệu MASTER nạp chưa đầy đủ (hiện có % phòng, % nhiệm vụ; yêu cầu đúng 3 phòng, 24 nhiệm vụ). Hủy bỏ xuất bản!', v_room_count, v_item_count;
    END IF;

    -- Kiểm tra chi tiết từng phòng và từng nhiệm vụ (mật mã, chữ số thưởng, manh mối, cấu trúc JSONB & đáp án đúng)
    FOR v_room IN SELECT * FROM public.campaign_rooms WHERE campaign_id = v_camp_id ORDER BY grade, room_number LOOP
        IF v_room.topic IS NULL OR TRIM(v_room.topic) = '' THEN
            RAISE EXCEPTION 'Phòng % (Khối %): Tên chủ đề không được để trống!', v_room.room_number, v_room.grade;
        END IF;

        IF v_room.room_number = 1 THEN
            IF v_room.passcode IS NULL OR NOT (v_room.passcode ~ '^[0-9]{4}$') THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Mật mã không đúng 4 chữ số!', v_room.grade;
            END IF;

            SELECT 
                COUNT(*) FILTER (WHERE item_type = 'task'),
                COUNT(*) FILTER (WHERE item_type = 'secret')
            INTO v_task_count, v_secret_count
            FROM public.room_items
            WHERE room_id = v_room.id;

            IF v_task_count <> 4 OR v_secret_count <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Phải có đúng 4 task và 4 secret (hiện có % task, % secret)!', v_room.grade, v_task_count, v_secret_count;
            END IF;

            v_task_digits := ARRAY(
                SELECT digit FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'task' AND digit IS NOT NULL AND digit ~ '^[0-9]$'
            );

            IF array_length(v_task_digits, 1) <> 4 THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Thiếu chữ số phần thưởng của 4 nhiệm vụ chính!', v_room.grade;
            END IF;

            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_digits FROM unnest(v_task_digits) AS ch;
            SELECT string_agg(ch, '' ORDER BY ch) INTO v_sorted_passcode FROM regexp_split_to_table(v_room.passcode, '') AS ch;

            IF v_sorted_digits <> v_sorted_passcode THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): 4 chữ số [%] không khớp mật mã [%]!', v_room.grade, array_to_string(v_task_digits, ','), v_room.passcode;
            END IF;

            IF EXISTS (
                SELECT 1 FROM public.room_items 
                WHERE room_id = v_room.id AND item_type = 'secret' AND (hint IS NULL OR LENGTH(TRIM(hint)) < 5)
            ) THEN
                RAISE EXCEPTION 'Phòng 01 (Khối %): Tất cả 4 manh mối bí mật phải có nội dung gợi ý giải mã (>= 5 ký tự)!', v_room.grade;
            END IF;
        END IF;

        -- Kiểm tra cấu trúc JSONB và đáp án đúng của từng nhiệm vụ trong phòng
        FOR v_item IN SELECT * FROM public.room_items WHERE room_id = v_room.id LOOP
            IF v_item.title IS NULL OR TRIM(v_item.title) = '' THEN
                RAISE EXCEPTION 'Phòng % (Khối %): Nhiệm vụ "%" chưa có tiêu đề!', v_room.room_number, v_room.grade, v_item.item_key;
            END IF;

            v_p := v_item.content_payload;

            IF v_item.kind = 'single' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng single phải có >= 2 phương án trả lời!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF v_p->>'correct' IS NULL OR NOT (v_p->>'correct' ~ '^[0-9]+$') OR (v_p->>'correct')::INT < 0 OR (v_p->>'correct')::INT >= v_ans_len THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Đáp án đúng của dạng single không hợp lệ!', v_item.item_key;
                END IF;

            ELSIF v_item.kind = 'multi' THEN
                IF jsonb_typeof(v_p->'answers') <> 'array' OR jsonb_array_length(v_p->'answers') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng multi phải có >= 2 lựa chọn!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'answers');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') < 1 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng multi phải có >= 1 đáp án đúng!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số đáp án multi không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'sequence' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng sequence phải có >= 2 câu hỏi con!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'items') LOOP
                    IF v_elem->>'question' IS NULL OR TRIM(v_elem->>'question') = ''
                       OR jsonb_typeof(v_elem->'answers') <> 'array' OR jsonb_array_length(v_elem->'answers') < 2 THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Câu hỏi con trong sequence không hợp lệ!', v_item.item_key;
                    END IF;
                    v_ans_len := jsonb_array_length(v_elem->'answers');
                    IF v_elem->>'correct' IS NULL OR NOT (v_elem->>'correct' ~ '^[0-9]+$') OR (v_elem->>'correct')::INT < 0 OR (v_elem->>'correct')::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Đáp án đúng của câu hỏi con trong sequence không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'match' THEN
                IF jsonb_typeof(v_p->'left') <> 'array' OR jsonb_typeof(v_p->'right') <> 'array'
                   OR jsonb_array_length(v_p->'left') <> jsonb_array_length(v_p->'right') OR jsonb_array_length(v_p->'left') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng match phải có 2 cột bằng nhau (>= 2)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'right');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> jsonb_array_length(v_p->'left') THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng match không khớp độ dài!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số đáp án match không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'sort' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_typeof(v_p->'groups') <> 'array'
                   OR jsonb_array_length(v_p->'items') < 2 OR jsonb_array_length(v_p->'groups') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng sort phải có items và groups (>= 2)!', v_item.item_key;
                END IF;
                v_ans_len := jsonb_array_length(v_p->'groups');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> jsonb_array_length(v_p->'items') THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng sort không khớp số lượng items!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_ans_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số nhóm sort không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'order' THEN
                IF jsonb_typeof(v_p->'items') <> 'array' OR jsonb_array_length(v_p->'items') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng order phải có >= 2 bước!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'items');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> v_it_len THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng order không khớp số bước!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem::TEXT)::INT < 0 OR (v_elem::TEXT)::INT >= v_it_len THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Chỉ số thứ tự order không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;

            ELSIF v_item.kind = 'pair' THEN
                IF jsonb_typeof(v_p->'jobs') <> 'array' OR jsonb_typeof(v_p->'hardware') <> 'array' OR jsonb_typeof(v_p->'software') <> 'array'
                   OR jsonb_array_length(v_p->'jobs') < 2 OR jsonb_array_length(v_p->'hardware') < 2 OR jsonb_array_length(v_p->'software') < 2 THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Dạng pair thiếu mảng jobs, hardware hoặc software!', v_item.item_key;
                END IF;
                v_it_len := jsonb_array_length(v_p->'jobs');
                IF jsonb_typeof(v_p->'correct') <> 'array' OR jsonb_array_length(v_p->'correct') <> v_it_len THEN
                    RAISE EXCEPTION 'MASTER Validation - "%": Mảng correct của dạng pair không khớp số lượng jobs!', v_item.item_key;
                END IF;
                FOR v_elem IN SELECT jsonb_array_elements(v_p->'correct') LOOP
                    IF jsonb_typeof(v_elem) <> 'array' OR jsonb_array_length(v_elem) <> 2
                       OR jsonb_typeof(v_elem->0) <> 'number' OR jsonb_typeof(v_elem->1) <> 'number'
                       OR ((v_elem->0)::TEXT)::INT < 0 OR ((v_elem->0)::TEXT)::INT >= jsonb_array_length(v_p->'hardware')
                       OR ((v_elem->1)::TEXT)::INT < 0 OR ((v_elem->1)::TEXT)::INT >= jsonb_array_length(v_p->'software') THEN
                        RAISE EXCEPTION 'MASTER Validation - "%": Cặp chỉ số [hardware, software] trong correct của dạng pair không hợp lệ!', v_item.item_key;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    -- 7. ĐÓNG GÓI VÀ XUẤT BẢN TRỰC TIẾP TỪ QUY TRÌNH QUẢN TRỊ SEED
    FOR v_room IN 
        SELECT * FROM public.campaign_rooms 
        WHERE campaign_id = v_camp_id 
        ORDER BY grade ASC, room_number ASC
    LOOP
        v_tasks_obj := '{}'::jsonb;
        v_secrets_obj := '{}'::jsonb;

        FOR v_item IN 
            SELECT * FROM public.room_items 
            WHERE room_id = v_room.id 
            ORDER BY sort_order ASC
        LOOP
            v_item_data := jsonb_build_object(
                'title', v_item.title,
                'kind', v_item.kind
            );

            IF v_item.intro IS NOT NULL AND v_item.intro <> '' THEN
                v_item_data := v_item_data || jsonb_build_object('intro', v_item.intro);
            END IF;

            IF v_item.item_type = 'task' THEN
                v_item_data := v_item_data || jsonb_build_object('digit', v_item.digit);
            ELSE
                v_item_data := v_item_data || jsonb_build_object('hint', v_item.hint);
            END IF;

            v_item_data := v_item_data || v_item.content_payload;

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
            'version', 1,
            'published_at', NOW()
        ),
        'rooms', v_rooms_json
    );

    INSERT INTO public.published_campaigns (
        share_code,
        campaign_id,
        teacher_id,
        title,
        version,
        published_payload,
        published_at
    )
    VALUES (
        'MASTER',
        v_camp_id,
        v_admin_id,
        'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
        1,
        v_published_payload,
        NOW()
    )
    ON CONFLICT (share_code) DO NOTHING;

    -- 8. ĐỐI CHIẾU DỮ LIỆU ĐÃ XUẤT BẢN KHỚP VỚI DỮ LIỆU ĐÃ KIỂM TRA
    SELECT published_payload INTO v_verified_payload
    FROM public.published_campaigns
    WHERE share_code = 'MASTER' AND campaign_id = v_camp_id;

    IF v_verified_payload IS NULL OR jsonb_typeof(v_verified_payload->'rooms') <> 'array'
       OR jsonb_array_length(v_verified_payload->'rooms') <> 3 THEN
        RAISE EXCEPTION 'Lỗi xuất bản MASTER: Dữ liệu trong published_campaigns không khớp 3 phòng đã kiểm tra!';
    END IF;

    FOR v_pub_room IN SELECT jsonb_array_elements(v_verified_payload->'rooms') LOOP
        IF (SELECT COUNT(*) FROM jsonb_object_keys(v_pub_room->'tasks')) <> 4
           OR (SELECT COUNT(*) FROM jsonb_object_keys(v_pub_room->'secrets')) <> 4 THEN
            RAISE EXCEPTION 'Lỗi xuất bản MASTER: Phòng khối % trong published_campaigns không đủ 4 tasks và 4 secrets!', v_pub_room->>'grade';
        END IF;
    END LOOP;

    RAISE NOTICE '✓ ĐÃ KHỞI TẠO, XÁC THỰC VÀ XUẤT BẢN THÀNH CÔNG BỘ CÂU HỎI GỐC (MASTER) ĐẦY ĐỦ 3 PHÒNG VÀ 24 THỬ THÁCH!';
END $$;
