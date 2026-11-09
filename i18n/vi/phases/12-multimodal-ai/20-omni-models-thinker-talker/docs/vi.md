# Mô hình Omni: Qwen2.5 Omni và Thinker-Talker Split

> GPT-4o đã trình bày sản phẩm vào tháng 5 năm 2024 không phải vì mô hình cơ bản mà vì hình dạng sản phẩm  một giao diện giọng nói nơi bạn nói, mô hình nhìn thấy những gì máy ảnh nhìn thấy, và nó nói lại trong dưới 250ms. Hệ sinh thái mở đã dành phần còn lại của năm 2024 và 2025 để chạy đua để đạt đến bề mặt sản phẩm đó. Qwen2.5-Omni (tháng 3 năm 2025) là thiết kế mở tham chiếu: một Thinker (hình biến tạo văn bản lớn) cộng với một Talker (hình biến tạo giọng nói song song), được kết nối bằng các token phát thanh trực tuyến. Mini-Omni đơn giản hóa nó, Moshi phù hợp với độ trễ của nó, GLM-4-Voice mở rộng nó cho Trung Quốc. Bài học này đọc kiến trúc Thinker-Talker và ngân sách thời gian trễ làm cho việc phát trực tuyến trong thời gian thực.

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop), TypeScript
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## Mục tiêu học tập

- Chia đường ống dẫn suy luận thành Thinker (sự lý luận văn bản) và Talker (sự tổng hợp ngôn ngữ) và giải thích tại sao streaming song song hoạt động.
- Xét ngân sách thời gian đến đầu tiên-byte âm thanh (TTFAB) cho một tương tác trò chuyện, thành phần theo thành phần.
- Mô tả vị trí phù hợp với thời gian của TMRoPE mã hóa qua thị giác, âm thanh và văn bản trong Thinker.
- Hãy nêu tên hai mô hình trò chuyện thời gian thực, nửa duplex và đầy đủ duplex, và giải thích cách VAD chuyển đổi thúc đẩy giao dịch bán duplex.

## Vấn đề

Một trợ lý giọng nói thời gian thực phải làm rất nhiều, nhanh chóng:

1. Nghe người dùng. Đánh dấu giọng nói thời gian thực, phát hiện hoạt động giọng nói (VAD) để biết khi nào họ nói xong.
2. Nhớ xem, camera nhập vào với tốc độ 2-4 FPS, được truyền vào Thinker cùng với âm thanh.
3. Hãy nghĩ lại, viết câu trả lời dựa trên lịch sử cuộc trò chuyện.
4. Nói, tổng hợp các mã thông báo âm thanh, giải mã thành dạng sóng, phát trực tuyến đến loa của người dùng.

Mỗi bước thêm độ trễ. cảm giác trò chuyện đòi hỏi tổng chuyến đi vòng < 500ms  dưới đó, người dùng ngừng nhận thấy sự chậm trễ. GPT-4o tuyên bố ~250ms. Moshi ~160ms. Qwen2.5-Omni ~350-500ms.

Không có gì có thể là "đặt hàng tất cả rồi giải mã".

## Khái niệm

### Người suy nghĩ và người nói

Sự phân hủy của Qwen2.5 Omni:

- Thinker: một bộ biến đổi tạo văn bản 7B-80B. Nêu thụ các mã thông báo văn bản + hình ảnh + âm thanh liên kết. Xuất khẩu mã thông báo văn bản đại diện cho những gì phải nói.
- Speaker: một bộ biến đổi tạo giọng nói nhỏ hơn (200M-1B). tiêu thụ các token đầu ra văn bản của Thinker cộng với các token ngữ cảnh giọng nói gần đây.
- Bộ giải mã giọng nói: một bộ giải mã dạng sóng phát sóng (SNAC, gia đình MoVQGAN) đưa các token giọng nói đến các mẫu âm thanh trong thời gian thực.

Sự tách biệt quan trọng. Người suy nghĩ phải lớn để có lý luận tốt. Người nói có thể nhỏ bởi vì công việc của nó là địa phương  chuyển đổi văn bản thành mã thông báo nói chuyện. Người nói lớn hơn không thể diễn tả nhiều hơn; nó chậm hơn.

Đi cả hai cùng nhau:

1. Thinker phát hành mã thông báo văn bản $t_i$- Tôi không biết.
2. Người nói tiêu thụ $t_i$(via streaming) và phát ra các token nói $s_i, s_{i+1}, \ldots, s_{i+k}$- Tôi không biết.
3. Bộ giải mã giọng nói tiêu thụ các mã thông báo giọng nói khi chúng đến và phát ra các mẫu âm thanh.
4. Khi Thinker có thể viết tin nhắn$t_{i+3}$, Talker đã phát âm cho $t_0, \ldots, t_{i+2}$- Tôi không biết.

### TMRoPE  Vị trí đa phương tiện phù hợp với thời gian

Người suy nghĩ cần tích hợp khung hình ảnh (đến với, nói, 4 FPS), khung âm thanh (đến với 50 khung / giây), và văn bản từ lịch sử cuộc trò chuyện.

TMRoPE gán dấu thời gian tuyệt đối cho mỗi token. Địa chỉ thị giác ở t = 2.3s. Địa chỉ âm thanh ở t = 2.32s. Địa chỉ văn bản từ người dùng " dừng " ở t = 2.35s. RoPE xoay sự chú ý theo dấu thời gian; mô hình nhìn thấy chúng như đồng thời tạm thời.

Đây là cơ sở hạ tầng cho "nhưng anh ta vẫy tay chào" để làm việc  mô hình nhìn thấy khung video và âm thanh cùng một khoảnh khắc khái niệm.

### Kết hợp phát biểu trực tuyến

Các token phát biểu phải được truyền tải. Mini-Omni (Xie & Wu, 2024) giới thiệu "những mô hình ngôn ngữ có thể nghe, nói chuyện trong khi suy nghĩ trong streaming": Các token đầu ra Thinker và các token đầu ra Talker liên tục trong cùng một chuỗi.

Moshi (Défossez et al., tháng 10 năm 2024) là triển khai mở nhanh nhất. 160ms TTFAB trên một A100 duy nhất. Kiến trúc: một biến thể 7B duy nhất phát ra các mã thông báo văn bản và giọng nói trên các vị trí thay thế, với một "mônolog bên trong" tách dòng suy nghĩ khỏi dòng nói.

### VAD và quay

Khám phá hoạt động giọng nói chạy trên bên đầu vào.

- Half-duplex: người dùng nói, mô hình lắng nghe. mô hình nói, người dùng lắng nghe.
- Full-duplex: cả hai có thể nói cùng một lúc. Model có thể backchannel ("uh-huh") hoặc gián đoạn. Khó hơn nhiều. Moshi hỗ trợ điều này.

Qwen2.5 Omni hỗ trợ nửa duplex theo mặc định, với chuyển đổi qua ngưỡng im lặng. Full duplex đòi hỏi xử lý lớp ứng dụng.

### Qwen3-Omni (Tháng 11 năm 2025)

Người kế nhiệm. Qwen3-80B Thinker, lớn hơn Talker, cải thiện TMRoPE-v2. độ trễ gần 250ms của GPT-4o. trọng lượng mở.

### Ngân sách thời gian trễ sản xuất

Đối với một tương tác truyền hình điển hình:

- Mic -> mã thông báo âm thanh: 40-80ms.
- Prefill (quan nhanh + lịch sử): 100-200ms ở 7B, nhiều hơn ở 70B.
- Đơn vị văn bản đầu tiên của Thinker: 40ms.
- Người nói xử lý mã thông báo văn bản đầu tiên: 20ms.
- Đơn vị giao dịch đầu tiên: 40ms.
- Tự giải mã residual-VQ: 30ms.
- Tự giải mã dạng sóng nói: 50-80ms.

Tổng TTFAB: 320-490ms tại 7B, 600-900ms tại 70B. Chất lượng biên giới thường có nghĩa là 70B +; do đó khoảng cách độ trễ biên giới.

### Phương pháp toán tỷ lệ token

Tại 16kHz nói chuyện với 50 Hz điểm thoại cơ bản, bạn cần 50 điểm thoại mỗi giây đầu ra. Người nói phải phát ra ≥50 điểm/s để theo kịp. Ở một hiệu suất LLM điển hình là 30-80 điểm/s trên H100, một người nói nhỏ (200-300M) đủ nhanh; một người nói 7B sẽ tụt lại phía sau.

Đây là lý do tại sao các mô hình Talker chuyên dụng nhỏ tồn tại thay vì "chỉ sử dụng mô hình chính".

```figure
l5-thinker-talker
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Mô phỏng một đường ống Thinker-Talker với tỷ lệ phát hành token giả.
- Tính toán TTFAB cho kích thước mô hình có thể cấu hình và tỷ lệ mẫu mic.
- Chứng minh việc quay nửa duplex với ngưỡng im lặng VAD.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-omni-streaming-budget.md`. Với mục tiêu TTFAB và bộ tính năng của sản phẩm giọng nói thời gian thực (vision-in, hai ngôn ngữ, duplex đầy đủ), chọn Qwen2.5-Omni, Qwen3-Omni, Moshi hoặc Mini-Omni và kích thước Thinker/Speaker.

## Các bài tập

1. Mục tiêu của bạn là TTFAB là 300ms. trên một 7B Thinker và 300M Talker, viết ra thời gian trễ của mỗi thành phần.

2. Qwen2.5-Omni sử dụng TMRoPE. Mô tả những gì mô hình nhìn thấy cho một lời nhắc khi người dùng bắt đầu nói ở t = 1s và máy ảnh bắt được một cử chỉ ở t = 1.2s.

3. Hỗ trợ đầy đủ duplex yêu cầu mô hình phát âm khi nghe. đề xuất định dạng dữ liệu đào tạo dạy điều này.

4. Đọc bài báo của Moshi Phần 4. Mô tả sự tách biệt "mônolog nội bộ" và lý do tại sao nó tránh sự chia rẽ của Nhà suy nghĩ-Người nói.

5. Xét ngân sách thông qua: một người nói phải phát ra các token nhanh như thế nào để theo kịp với 16kHz nói chuyện ở 50 token lớp cơ sở / giây?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Thinker | "Reasoning brain" | Large text-generating transformer producing what to say |
| Talker | "Speech-generating mouth" | Small transformer producing discrete speech tokens from Thinker's text |
| TTFAB | "Latency budget" | Time-to-first-audio-byte: from user speech end to first audio sample out |
| TMRoPE | "Time-aligned RoPE" | Position encoding using absolute timestamps across vision, audio, text |
| Half-duplex | "Turn-taking" | User and model alternate; VAD silence detects user-done |
| Full-duplex | "Simultaneous" | Model can speak and listen at the same time; backchannel capable |
| Inner monologue | "Moshi separation" | Single-model design where thinking-stream and speaking-stream interleave |

## Đọc thêm

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
