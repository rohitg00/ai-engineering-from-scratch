# Công thức chế biến VLM với trọng lượng mở: Điều thực sự quan trọng

> Văn học VLM trọng lượng mở 2024-2026 là một khu rừng của bảng phân hủy. MM1 của Apple đã thử nghiệm 13 kết hợp mã hóa hình ảnh, kết nối và hỗn hợp dữ liệu. Molmo của Allen AI đã chứng minh các bản tóm tắt chi tiết của con người vượt qua việc chưng cất GPT-4V. Cambrian-1 đã chạy 20 + so sánh mã hóa. Idefics2 đã chính thức hóa không gian thiết kế năm trục. Các VLM Prismatic so sánh 27 công thức đào tạo trên một chỉ số chuẩn bị kiểm soát. Trong tất cả những tiếng ồn đó, một tập hợp nhỏ kết quả có thể được ghi trên giấy tờ: mã hóa hình ảnh quan trọng hơn kiến trúc kết nối, hỗn hợp dữ liệu quan trọng hơn cả hai, và các tiêu đề chi tiết của con người vượt qua dữ liệu tổng hợp được chưng cất. Bài học này đọc các bảng đó để bạn không cần phải.

**Type:** Learn + lab
**Languages:** Python, TypeScript (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## Mục tiêu học tập

- Tên miền không gian thiết kế VLM năm trục: mã hóa hình ảnh, kết nối, LLM, hỗn hợp dữ liệu, lịch trình độ phân giải.
- Đọc bảng trục xuất MM1 / Idefics2 / Cambrian-1 và dự đoán nút nào di chuyển một điểm chuẩn nhất định.
- Chọn một công thức (code, kết nối, dữ liệu, độ phân giải) cho một VLM mới với ngân sách tính toán và hỗn hợp nhiệm vụ.
- Giải thích tại sao các tiêu đề chi tiết của con người vượt qua việc chưng cất GPT-4V với số lượng đồng token.

## Vấn đề

Có hàng trăm VLM có trọng lượng mở. Hầu hết khoảng cách giữa "tốt" và "đại cấp" không phải là kiến trúc. Đó là dữ liệu, lịch trình độ phân giải và lựa chọn mã hóa. Biết phải xoay đầu tiên khi mô hình của bạn hoạt động kém sẽ giúp bạn tiết kiệm một lỗi 5 triệu GPU-tham.

Làn sóng 2023 (LLaVA-1.5, InstructBLIP, MiniGPT-4) chạy trên cặp tiền huấn luyện + LLaVA-Instruct-150k.

Làn sóng 2024 (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) đã chạy các vụ trừu tượng đầy đủ.

## Khái niệm

### Không gian thiết kế năm trục

Idefics2 (Laurençon et al., 2024) đã đặt tên các trục:

1. Bộ mã hóa hình ảnh. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Các bộ mã hóa khác nhau về kích thước vá, độ phân giải và mục tiêu trước khi tập luyện.
2. Kết nối: MLP (2-4 lớp), Q-Former (32 truy vấn + giao diện chéo), Perceiver Resampler (64 truy vấn), C-Abstractor (công hợp hợp hợp đồng liên kết + hai tuyến).
3. Mô hình ngôn ngữ: Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5.
4. Dữ liệu đào tạo: cặp phụ đề (CC3M, LAION), giao tiếp (OBELICS, MMC4), hướng dẫn (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Định hướng độ phân giải: cố định 224/336/448, AnyRes, động lực bản địa.

Mỗi sản xuất VLM đưa ra một lựa chọn trên mỗi trục. Hầu hết sự khác biệt trong điểm số MMMU được giải thích bởi trục 1, 4, và 5  chứ không phải bởi các kết nối bạn chọn.

### Trục 1: mã hóa > kết nối

MM1 Phần 3.2 cho thấy: trao đổi từ CLIP ViT-L/14 sang SigLIP SO400m/14 thêm 3 điểm MMMU. Thay đổi các kết nối từ MLP sang nhận dạng Resampler thêm ít hơn 1 điểm. Idefics2 sao chép: SigLIP > CLIP, Q-Former ≈ MLP ≈ nhận dạng với cùng số lượng mã thông báo.

Cambrian-1 "Cambrian Vision Encoders Match-Up" (Tong et al., 2024) chạy 20 + bộ mã hóa trên một tiêu chuẩn trung tâm tầm nhìn (CV-Bench).

Mã mã mặc định 2026 cho VLM mở là SigLIP 2 SO400m/14 cho các tính năng ngữ nghĩa + mật, đôi khi được kết nối với các tính năng DINOv2 ViT-g/14 (Cambrian's "Spacial Vision Aggregator" làm điều này).

### Trục 2: thiết kế kết nối là một rửa

MM1, Idefics2, Prismatic và MM-Interleaved đều đạt được kết luận tương tự: với số lượng mã thị giác cố định, kiến trúc kết nối hầu như không quan trọng.

Điều quan trọng là số lượng token. Nhiều token hình ảnh hơn = tính toán LLM hơn = hiệu suất tốt hơn đến một điểm, sau đó giảm lợi nhuận. 64 token mỗi hình ảnh là quá ít cho OCR. 576-1024 token là điểm ngọt ngào cho hầu hết các VLM mở. 2048+ chỉ giúp cho tài liệu và biểu đồ.

Q-Former vs MLP là một câu hỏi về chi phí, không phải là một câu hỏi về chất lượng: Q-Former giới hạn các token ở 32-64 bất kể độ phân giải hình ảnh; MLP phát ra tất cả các token patch. Đối với các đầu vào độ phân giải cao, Q-Former lưu trữ bối cảnh LLM; cho độ phân giải thấp, sự khác biệt là tiếng ồn.

### Trục 3: kích thước LLM đặt trần

Tăng gấp đôi LLM từ 7B đến 13B một cách đáng tin cậy thêm 2-4 điểm trên MMMU trên mỗi bài báo VLM. Ở 70B bạn bão hòa hầu hết các điểm chuẩn. Mức giới hạn lý luận đa phương thức của VLM là giới hạn lý luận văn bản của LLM  bộ mã hóa thị giác chỉ có thể cung cấp nó, không phải lý do cho nó.

Đây là lý do tại sao Qwen2.5VL-72B và Claude Opus 4.7 đập vỡ MMMU-Pro và ScreenSpot-Pro: bộ não ngôn ngữ là rất lớn. Một VLM 7B không thể thay thế cho một VLM 70B thông qua thiết kế kết nối thông minh.

### Trục 4: dữ liệu  chi tiết người caption beat chưng cất

Molmo + PixMo (Deitke et al., 2024) là kết quả 2024 mà mọi người nên đọc. Allen AI đã có các nhà ghi chú con người mô tả hình ảnh trong 1-3 phút mật độ nói chuyện-đối với văn bản, tạo ra 712K hình ảnh có nét mật. Không có khử trùng GPT-4V ở bất cứ đâu trong dữ liệu đào tạo.

Molmo-72B đánh bại Llama-3.2-90B-Vision trên 11 trong 11 điểm chuẩn. Delta không phải là kiến trúc  nó là chất lượng caption. Các tựa đề chi tiết của con người chứa 5-10 lần nhiều thông tin mỗi hình ảnh so với các tựa đề web ngắn và ở lại thực tế được đặt nền trong khi phân tán GPT-4V ảo giác.

ShareGPT4V (Chen et al., 2023) và Cauldron (Idefics2) đã theo dõi cùng một cuốn sách chơi với các tiêu đề người + GPT-4V hỗn hợp.

### Trục 5: giải pháp và lịch trình của nó

Idefics2's ablations: 384 -> 448 thêm 1-2 điểm. 448 -> 980 với phân chia hình ảnh (AnyRes) thêm 3-5 điểm khác trên các tiêu chuẩn OCR.

Cambrian-1 đã thực hiện một sự đổi giá độ phân giải so với token: với tính toán cố định, bạn có thể có nhiều token với độ phân giải thấp hơn hoặc ít token với độ phân giải cao hơn.

Công thức sản xuất năm 2026: tàu giai đoạn 1 ở 384 cố định, giai đoạn 2 với độ phân giải động lên đến 1280 cho các nhiệm vụ nặng OCR.

### So sánh được kiểm soát bởi Prismatic

Prismatic VLMs (Karamcheti et al., 2024) là bài báo kiểm soát tất cả các trục.

- Số lượng mã thông báo trực quan mỗi hình ảnh giải thích ~ 60% sự khác biệt.
- Sự lựa chọn của bộ mã hóa giải thích ~ 20%.
- Kiến trúc kết nối giải thích ~5%.
- Tất cả mọi thứ khác (mix dữ liệu, lập trình, LR) ~ 15% còn lại.

Đây là một sự phân hủy thô lỗ, nhưng nó là câu trả lời sạch nhất cho "điều gì tôi nên bỏ đi trước" trong văn học.

### Một người chọn cho năm 2026

Với bằng chứng, công thức mở VLM mặc định cho một dự án mới vào năm 2026:

- Mã mã hóa: SigLIP 2 SO400m/14 ở độ phân giải bản địa với NaFlex, kết nối với DINOv2 ViT-g/14 để có tính năng dày đặc nếu bạn cần phân đoạn / đặt đất.
- Cụ thể: 2 lớp MLP trên mã thông báo vá. Tránh Q-Former trừ khi bạn bị hạn chế mã thông báo.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, 7B cho chi phí, 70B cho chất lượng, được chọn theo độ trễ mục tiêu.
- Dữ liệu: PixMo + ShareGPT4V + Cauldron, được bổ sung với dữ liệu hướng dẫn cụ thể cho nhiệm vụ.
- Độ phân giải: động (min 256, tối đa 1280 pixel mỗi bên dài).
- Chương trình: Lớp nối giai đoạn 1 (chỉ cho máy chiếu), giai đoạn 2 hoàn chỉnh, giai đoạn 3 hoàn chỉnh cụ thể cho nhiệm vụ.

Mỗi một trong những mặc định này bắt nguồn từ một sự giảm cân đo lường trong các báo cáo được trích dẫn ở cuối bài học này.

```figure
l5-vlm-recipe-knobs
```

## Sử dụng nó

`code/main.py`là một trình phân tích bảng phân hủy và chọn công thức. Nó mã hóa các bảng phân hủy MM1 và Idefics2 (đồng nhất) và cho phép bạn truy vấn:

- "Với ngân sách X và nhiệm vụ Y, công thức nào sẽ thắng?"
- "Nếu tôi đổi SigLIP thành CLIP trên một Llama 7B, delta MMMU dự kiến là gì?"
- "Tôi nên chọn trục nào trước tiên để có được câu trả lời tự tin 80%?"

Kết quả là một danh sách công thức xếp hạng với các điểm tham khảo dự kiến và một khuyến nghị "blah trước".

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-vlm-recipe-picker.md`. Với một kết hợp nhiệm vụ mục tiêu, ngân sách tính toán và mục tiêu trễ, nó phát hành một công thức đầy đủ (code, kết nối, LLM, kết hợp dữ liệu, lịch trình giải quyết) với các trích dẫn đến việc trừ bỏ biện minh cho mỗi lựa chọn.

## Các bài tập

1. Đọc MM1 Phần 3.2. Đối với một LLM 2B cố định với ngân sách 50M hình ảnh, mã hóa nào thắng?

2. Cambrian-1 phát hiện ra rằng kết nối DINOv2 + SigLIP vượt trội hơn chỉ riêng trên các điểm tham khảo tập trung vào tầm nhìn nhưng không thêm tín hiệu nào trên MMMU.

3. Mục tiêu của bạn là một đại lý UI di động trên một 2B LLM. Chọn bộ mã hóa, kết nối, độ phân giải và kết hợp dữ liệu. Định lý cho mỗi lựa chọn bằng một bảng ablation cụ thể.

4. Molmo bán mẫu 4B và 72B. 4B cạnh tranh với các VLM 7B đóng cửa; 72B đánh bại Llama-3.2-90B-Vision trên các điểm chuẩn 11/11. Điều đó cho bạn biết gì về giả thuyết cao nguyên kích thước LLM?

5. Thiết kế một bảng phân hủy để tách chất lượng hỗn hợp dữ liệu từ chất lượng mã hóa trên một VLM 7B.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Ablation | "Turning one knob" | Training multiple runs that differ in exactly one design-space axis, holding everything else constant |
| Connector | "Bridge" / "projector" | Trainable module that maps vision encoder output into the LLM's token space (MLP, Q-Former, Perceiver) |
| Detailed human caption | "Dense caption" | A multi-sentence human-written description (typically 80-300 tokens) richer than a web alt text |
| Distillation | "GPT-4V captions" | Training data generated by a stronger proprietary VLM; convenient but prone to inherited hallucination |
| AnyRes / dynamic res | "High-res path" | Strategy to feed images larger than the encoder's native resolution via tiling or M-RoPE |
| Resolution ramp | "Curriculum" | Training schedule that starts low-resolution and increases, speeding alignment learning |
| Vision-centric bench | "CV-Bench / BLINK" | Evaluation that stresses fine-grained visual perception rather than language-heavy reasoning |
| PixMo | "Molmo's data" | Allen AI's 712K densely-captioned image dataset; human speech transcribed into dense captions |

## Đọc thêm

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
