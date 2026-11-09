# Janus-Pro: Các mã hóa không kết hợp cho các mô hình đa mô hình thống nhất

> Các mô hình đa phương tiện thống nhất có một căng thẳng không thể tránh khỏi. Hiểu cần các tính năng ngữ nghĩa  Các vector đầu ra SigLIP hoặc DINOv2 giàu thông tin cấp khái niệm. Thế hệ muốn có mã thân thiện với tái thiết  mã thông báo VQ kết hợp lại thành các pixel sắc nét. Hai mục tiêu không tương thích trong một bộ mã hóa duy nhất. Janus (DeepSeek, tháng 10 năm 2024) và Janus-Pro (DeepSeek, tháng 1 năm 2025) cho rằng giải pháp là ngừng cố gắng: tách hai bộ mã hóa. Chia sẻ cơ thể biến đổi giữa các nhiệm vụ, nhưng hướng hiểu thông qua SigLIP và phát triển thông qua một token VQ. Ở 7B, Janus-Pro đánh bại DALL-E 3 trên GenEval trong khi so sánh LLaVA trên MMMU. Bài học này giải thích tại sao hai bộ mã hóa hoạt động khi một thất bại.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## Mục tiêu học tập

- Giải thích tại sao một bộ mã hóa được chia sẻ duy nhất làm tổn hại đến sự hiểu biết hoặc chất lượng sản xuất.
- Mô tả định tuyến của Janus-Pro: Các tính năng SigLIP trên phía đầu vào để hiểu, token VQ trên cả đầu vào và đầu ra để tạo ra.
- Theo dõi quy mô kết hợp dữ liệu làm cho Janus-Pro thành công nơi mà Janus không.
- So sánh các kiến trúc tách rời (Janus-Pro), nối tiếp (Transfusion) và nối kín (Show-o).

## Vấn đề

Các mô hình thống nhất chia sẻ một cơ thể biến đổi trên cả sự hiểu biết và sản xuất. Những nỗ lực trước đây (Chameleon, Show-o, Transfusion) đều sử dụng một token thị giác cho cả hai hướng. Tokenizer là một thỏa hiệp:

- Được tối ưu hóa để tái tạo (thế hệ): VQ-VAE chụp chi tiết pixel hạt mỏng nhưng tạo ra các token có sự liên kết ngữ nghĩa yếu.
- Được tối ưu hóa cho ngữ nghĩa (nghiểu): SigLIP nhúng nhóm hình ảnh "cat" gần các token "cat" nhưng không cho phép tái tạo tốt.

Show-o và Transfusion trả tiền cho điều này với một thuế chất lượng rõ ràng trên một hướng. Janus-Pro hỏi: tại sao cần một tokeniser khi các nhiệm vụ có nhu cầu khác nhau?

## Khái niệm

### Mã hóa hình ảnh tách rời

Kiến trúc của Janus-Pro tách hai bộ mã hóa:

- Hiểu đường. Hình ảnh đầu vào → SigLIP-SO400m → 2 lớp MLP → cơ thể biến thể.
- Hướng dẫn tạo. Hình nhập (nếu điều kiện trên hình ảnh hiện có) → VQ tokenizer → ID token → thân biến.
- Tạo sản xuất. Các mã thông báo hình ảnh được dự đoán bởi bộ biến đổi → VQ decoder → pixel.

Cơ thể biến đổi được chia sẻ. Mọi thứ phía trước và phía dưới của cơ thể là đặc biệt cho nhiệm vụ.

Các đầu vào được giải thích bằng định dạng prompt: a `<understand>`Đánh dấu các tuyến đường qua SigLIP; `<generate>`hoặc đường dẫn là ngầm từ nhiệm vụ.

### Tại sao điều này hiệu quả

Hiểu mất nhận được các tính năng SigLIP, mà CLIP-style pretraining đã điều chỉnh cho sự tương đồng ngữ nghĩa.

Thiệt sản xuất nhận được token VQ, mà một token đã điều chỉnh để tái tạo. Chất lượng hình ảnh cải thiện hơn Show-o vì mã VQ kết hợp trở lại với pixel sạch sẽ.

Cơ thể biến đổi chia sẻ nhìn thấy hai phân phối đầu vào (SigLIP và VQ) và học cách làm việc với cả hai.

### Tăng quy mô dữ liệu  Janus vs Janus-Pro

Janus (tôi ban đầu, arXiv 2410.13848) đã giới thiệu việc tách đôi nhưng ở quy mô nhỏ (1.3B param, dữ liệu hạn chế).

- 7B Params (vs 1.3B).
- 90M cặp hình ảnh-môn văn bản cho giai đoạn 1 (sự sắp xếp) lên từ 72M.
- 72M cho giai đoạn 2 (tối hợp) lên từ 26M.
- Thêm 200k mẫu hướng dẫn hình ảnh-gen cho giai đoạn 3.

Kết quả: Janus-Pro-7B phù hợp với LLaVA trên MMMU (60.3 vs ~58) và đánh bại DALL-E 3 trên GenEval (0.80 vs 0.67).

### JanusFlow  biến thể dòng chảy được chỉnh sửa

JanusFlow (arXiv 2411.07975) thay đổi con đường tạo VQ cho con đường tạo dòng chảy chỉnh sửa ( liên tục).

### Công việc của cơ thể chung

Cơ thể biến đổi xử lý một chuỗi thống nhất nhưng với hai phân phối đầu vào.

- Để hiểu: tiêu thụ các tính năng SigLIP + mã thông báo văn bản → phát ra văn bản tự động.
- Để tạo: tiêu thụ mã thông báo văn bản + (tài báo VQ hình ảnh tùy chọn) → phát ra mã thông báo VQ hình ảnh theo cách tự động.

Cơ thể không có trọng lượng cụ thể cho mỗi khối. Đó là biến đổi kiểu văn bản mà bạn mong đợi sẽ tìm thấy bên trong Qwen hoặc Llama, cộng với hai bộ chuyển đổi đầu vào.

Điều thú vị là điều này có nghĩa là cơ thể của Janus-Pro có thể được khởi tạo từ một LLM được đào tạo trước. Janus-Pro thực sự khởi tạo từ DeepSeek-MoE-7B. Sự lựa chọn đó quan trọng: LLM đóng góp vào khả năng suy luận mà các mô hình thống nhất tinh khiết từ đầu vật lộn để đạt được.

### So với InternVL-U

InternVL-U (Dạy 12.10) là sự theo dõi năm 2026.

- Tiến hành trước khi tập luyện đa phương thức (InternVL3 spine).
- Đường dẫn mã hóa không kết nối (SigLIP vào, VQ + phân tán đầu ra).
- Sự hiểu biết thống nhất + thế hệ + chỉnh sửa.

InternVL-U kết hợp lựa chọn kiến trúc của Janus-Pro vào một khung lớn hơn. Ý tưởng mã hóa tách rời hiện nay là mặc định cho các mô hình thống nhất ở quy mô.

### Các giới hạn

Các bộ mã hóa không kết nối thêm sự phức tạp kiến trúc. Hai tokeniser để đào tạo, hai đường lối đầu vào để duy trì, hai bộ chế độ thất bại. Đối với các sản phẩm không cần sản xuất, Janus-Pro được kỹ thuật quá cao.

Đối với các sản phẩm không cần hiểu biết, Janus- Pro quá đủ điều kiện  chọn mô hình Stable Diffusion 3 / Flux.

Đối với các sản phẩm cần cả hai, Janus-Pro hiện là kiến trúc mở tham chiếu.

```figure
l5-janus-decouple
```

## Sử dụng nó

`code/main.py`mô phỏng định tuyến Janus-Pro:

- Hai bộ mã hóa giả: giống như SigLIP (tạo ra các vector ngữ nghĩa 256 chiều) và giống như VQ (tạo ra mã số nguyên).
- Một router prompt chọn bộ mã hóa dựa trên thẻ nhiệm vụ.
- Một cơ thể chia sẻ (stand-in) xử lý chuỗi token bất kể bộ mã hóa nào tạo ra chúng.
- Một chuyển đổi từ giai đoạn 1 (sẵn sàng) sang giai đoạn 3 (từ hướng dẫn) lịch trình mẫu cân nặng.

Bác các đường dẫn được định tuyến cho 3 ví dụ: hình ảnh QA, T2I, chỉnh sửa hình ảnh.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-decoupled-encoder-picker.md`. Với một sản phẩm muốn tạo ra một thế hệ thống nhất + hiểu biết về chất lượng hàng rào, nó chọn Janus-Pro, JanusFlow hoặc InternVL-U với một khuyến nghị quy mô dữ liệu cụ thể.

## Các bài tập

1. Janus-Pro-7B vượt qua DALL-E 3 trên GenEval. Giải thích tại sao mô hình mở 7B có thể phù hợp với mô hình độc quyền hàng rào về thế hệ nhưng không phải về sự hiểu biết.

2. Thực hiện chức năng router: cho văn bản prompt, phân loại như `understand`hoặc `generate`Làm sao để xử lý những lời nhắc nhở không rõ ràng như "để mô tả và sau đó vẽ"?

3. JanusFlow thay thế con đường VQ bằng dòng chảy được chỉnh sửa.

4. đề xuất một nhiệm vụ thứ tư mà kiến trúc Janus-Pro có thể xử lý với một bộ mã hóa tách rời hơn. ví dụ: phân đoạn hình ảnh (tương tự DINO), độ sâu (tương tự MiDaS).

5. Đọc phần 4.2 của Janus-Pro về quy mô dữ liệu.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | Separate tokenizer or encoder per direction: semantic for understanding, reconstruction for generation |
| Shared body | "One transformer" | Single transformer processes either encoder's output; no modality-specific weights |
| SigLIP for understanding | "Semantic features" | CLIP-family vision tower providing rich conceptual features but poor reconstruction |
| VQ for generation | "Reconstruction codes" | Vector-quantized tokens that decode cleanly back to pixels |
| JanusFlow | "Rectified-flow variant" | Janus-Pro with a continuous flow-matching generation head instead of VQ |
| Routing tag | "Task tag" | Prompt marker (`<understand>` / `<generate>`) that picks the input encoder |

## Đọc thêm

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
