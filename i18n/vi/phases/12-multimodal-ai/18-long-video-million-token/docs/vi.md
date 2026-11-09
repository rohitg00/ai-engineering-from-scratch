# Video dài được hiểu trong bối cảnh của hàng triệu người

> Một video 4K 1 giờ với tốc độ 24 FPS, được dán và nhúng, tạo ra khoảng 60 triệu token. Một tập podcast 2 giờ được sao chép là 30.000 token. Một bộ phim đầy đủ Blu-ray, thậm chí được nén với sự tập hợp dữ dội, là hàng trăm ngàn token. Google's Gemini 1.5 (Tháng 3 năm 2024) mở ra thời đại này với một ngữ cảnh 10 triệu token, thực hiện thu hồi kim cáp trong một đống cỏ đáng tin cậy trong các video dài một giờ. LWM (Liu et al., tháng 2 năm 2024) cho thấy con đường quy mô của sự chú ý vòng. LongVILA và Video- XL đã tăng cường lượng tiêu thụ. VideoAgent đã đổi ngữ cảnh nguyên liệu cho thu hồi của đại lý. Mỗi cách tiếp cận là một sự đổi mới khác nhau về tính toán, nhớ lại và phức tạp kỹ thuật. Bài học này đọc cho chúng một bên nhau.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router), TypeScript
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## Mục tiêu học tập

- Xét tổng số mã thông báo thị giác cho video hình dạng dài với FPS và tích hợp khác nhau.
- Giải thích bốn con đường quy mô: bối cảnh thô (Gemini 1.5), chú ý vòng (LWM), nén token (LongVILA / Video-XL), lấy lại cơ quan (VideoAgent).
- So sánh VLMs video trong bối cảnh nguyên liệu với VLMs video thu hồi bằng máy chủ (VideoAgent) về độ chính xác và độ trễ.
- Thiết kế một thử nghiệm kim trong một đống cỏ cho một video 30 phút và đo lường hồi tưởng vào một phút cụ thể.

## Vấn đề

Một khung hình đơn của các bản vá kích thước Qwen2.5VL với độ phân giải bản địa là ~ 729 token. Với 3x3 tích hợp đó là 81 token mỗi khung hình. Một clip 30 phút với 1 FPS = 1800 khung hình = 145.800 token. Có thể thực hiện vào năm 2025 mở VLM, chặt chẽ. Ở 2 FPS, 291.600 token chỉ phù hợp với các bối cảnh lớn nhất.

Một bộ phim 2 giờ với 1 FPS là 583k token. Ngoài hầu hết các mô hình mở 2026; yêu cầu Gemini 2.5 Pro hoặc hợp tác mạnh mẽ hơn.

Bốn con đường leo lên đã xuất hiện.

## Khái niệm

### Chặng đường 1: Bối cảnh thô (Gemini 1.5, Claude Opus)

Thả phần cứng vào vấn đề, mở rộng ngữ cảnh lên hàng triệu token, xử lý mọi thứ trong một lần đi trước.

Gemini 1.5 Pro được tung ra với 1M token; Gemini 1.5 Ultra đến 10M; Gemini 2.5 Pro vào năm 2026 thực hiện nhiều giờ video đáng tin cậy.

Kỹ thuật: một ứng dụng chú ý tùy chỉnh với hệ thống phân cấp bộ nhớ (đại địa phương + toàn cầu + hiếm) cộng với định tuyến chuyên gia MoE cho hiệu quả trong bối cảnh dài. Không được công bố chi tiết đầy đủ. Không nguồn mở.

### Đường 2: Cảnh sát vòng (LWM, LongVILA)

Sự chú ý vòng phân phối các chuỗi dài giữa các thiết bị trong một "phòng" nơi mỗi thiết bị giữ một phần. Sự chú ý trên toàn bộ chuỗi xảy ra bởi mỗi thiết bị gửi phần của nó đến thứ tiếp theo trong một mô hình vòng, tính toán sự chú ý một phần, và tổng hợp.

LWM (Liu et al., 2024) đã đào tạo một mô hình ngữ cảnh 1M-token theo cách này. Phân tích bộ nhớ trên mỗi thiết bị với phần mà mỗi thiết bị nắm giữ, do đó việc thêm các thiết bị mở rộng ngữ cảnh về mặt tuyến tính.

LongVILA (arXiv:2408.10188) đã điều chỉnh mô hình cho VLMs. 1400-phần video với 192 token mỗi khung = 268k ngữ cảnh, được đào tạo với sự chú ý vòng qua song song đường 8-way.

### Path 3: Compression token (Video-XL, LongVA)

Giá rẻ hơn so với bối cảnh thô: nén mạnh mẽ trước khi LLM thấy chuỗi.

Video-XL (arXiv:2409.14485) sử dụng một token tóm tắt trực quan: mỗi clip của các khung N tạo ra một token "tóm tắt" duy nhất tham gia trên N. Khi suy luận, LLM thấy một token tóm tắt mỗi clip, làm giảm đáng kể bối cảnh.

LongVA mở rộng ngữ cảnh LLM từ 200k đến 2M với kỹ thuật "transai ngữ cảnh dài".

Việc nén token không được thu hồi tại các dấu thời gian cụ thể để có thể mở rộng. mô hình thường biết những gì đã xảy ra nhưng đôi khi bỏ lỡ khung chính xác.

### Path 4: Nhận lại đại lý (VideoAgent)

Đừng cung cấp toàn bộ video cho LLM. Thay vào đó, coi video như một cơ sở dữ liệu và sử dụng LLM để truy vấn nó.

VideoAgent (arXiv:2403.10517):

1. LLM đọc câu hỏi.
2. LLM yêu cầu một công cụ lấy lại các clip liên quan ("mở tôi các phân đoạn với một con mèo").
3. Công cụ trả lại phù hợp với các dấu thời gian clip.
4. LLM đọc những đoạn băng đó qua VLM.
5. LLM soạn thảo câu trả lời hoặc hỏi các câu hỏi tiếp theo.

Đây là mô hình LLM-as-agent được áp dụng cho video dài. Kết luận rẻ hơn (chỉ có đoạn clip có liên quan được mã hóa), kỹ thuật khó khăn hơn (huyết điểm về chất lượng truy xuất trở thành nút thắt).

### Chỉ số chuẩn kim cương

Thử nghiệm ngữ cảnh dài tiêu chuẩn: chèn một dấu hiệu thị giác hoặc văn bản độc đáo tại một điểm ngẫu nhiên trong video, sau đó hỏi một câu hỏi đòi hỏi phải nhớ lại nó.

Metric: Recall@k qua chiều dài video và vị trí đánh dấu.

Gemini 2.5 Pro ghi điểm >99% nhớ lại trong video tối đa 90 phút. Các mô hình mở 72B (Qwen2.5-VL-72B, InternVL3-78B) ghi điểm ~85-90% sau 30 phút và giảm xuống hơn 60.

VideoAgent có thể phù hợp hoặc đánh bại các mô hình trong bối cảnh nguyên liệu trong 2 giờ hoặc hơn vì việc lấy lại chạm vào kim cáp nếu công cụ tốt.

### Đường nào để chọn

Để xem đoạn clip 15 phút ở độ chính xác biên giới: mở 72B + ngữ cảnh bản địa thường hoạt động. Chọn Qwen2.5-VL-72B.

Đối với nội dung từ 30 phút đến 1 giờ: LongVILA hoặc Video-XL mở; Gemini 2.5 Pro đóng.

Đối với nội dung 2 giờ trở lên: VideoAgent hoặc các mô hình tìm kiếm tương tự. Ngoài ra, tóm tắt thành các đoạn nhỏ hơn và cung cấp tóm tắt hàng đầu.

### Mô hình sản xuất năm 2026

Trong thực tế, các đường ống sản xuất video dài là lai:

1. Thực hiện lấy mẫu FPS động + tích hợp dữ liệu tích cực trên toàn bộ video (được đại diện toàn cầu 100k token).
2. Nhận được một VLM 72B để xem tổng kết toàn cầu.
3. Nếu người dùng hỏi các câu hỏi chi tiết, hãy chạy tìm kiếm bằng cách sử dụng bản tóm tắt như một chỉ mục.

Điều này kết hợp bối cảnh thô cho sự hiểu biết toàn cầu và tìm kiếm chi tiết địa phương.

```figure
mm-video-token-budget
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Xét ngân sách token cho video từ 1 phút đến 3 giờ với FPS + hợp nhất khác nhau.
- Mô phỏng một cuộc chạy kim trong một đống cỏ: tiêm một dấu hiệu vào một dấu thời gian ngẫu nhiên, hỏi một câu hỏi, ghi lại.
- Bao gồm một bộ mô phỏng bộ định tuyến lấy lại cơ quan chọn các clip cụ thể để cung cấp cho một VLM dòng chảy xuống.

Hãy kiểm tra bảng ngân sách và cảm nhận được khoảng cách ở quy mô.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-long-video-strategy-planner.md`. Với thời gian video và độ phức tạp của truy vấn, nó chọn giữa ngữ cảnh thô, nén và tìm kiếm cơ quan, và tính toán kỳ vọng độ trễ + chất lượng.

## Các bài tập

1. Một bài giảng 45 phút với tốc độ 1 FPS, 81 token mỗi khung hình.

2. Thiết kế một thử nghiệm kim cáp trong một đống cỏ: bạn tiêm dấu hiệu vào phút nào, và định dạng truy vấn chính xác là gì?

3. So sánh ngữ cảnh nguyên chất Qwen2.5-VL-72B (80k ngữ cảnh) với VideoAgent (Claude 3.5 + lấy lại) trên một video 1 giờ.

4. Lượng bộ nhớ của sự chú ý vòng cho mỗi thiết bị với chiều dài chuỗi chia theo số lượng thiết bị, trong khi tính toán sự chú ý tổng thể vẫn giữ nguyên hình vuông. Giải thích tại sao và điều gì thất bại nếu bạn bỏ giai đoạn quay vòng.

5. Đọc Gemini 1.5 Phần 5 về kim cương.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## Đọc thêm

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
