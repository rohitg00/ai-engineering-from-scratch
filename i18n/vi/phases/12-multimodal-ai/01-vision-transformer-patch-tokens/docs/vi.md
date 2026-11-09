# Máy biến hình thị giác và bộ nguyên thủy có mã hóa vá

> Trước khi có bất cứ thứ gì đa phương thức, một hình ảnh phải trở thành một chuỗi các token mà một biến thể có thể ăn. Bài báo ViT 2020 trả lời câu hỏi này bằng các bản vá 16x16 pixel, một dự đoán tuyến tính và một vị trí nhúng. Năm năm sau, mỗi mô hình biên giới 2026 (Claude Opus 4.7 ở 2576px bản địa, Gemini 3.1 Pro, Qwen3.5-Omni) vẫn bắt đầu theo cách này  mã hóa thay đổi từ ViT sang DINOv2 sang SigLIP 2, mã đăng ký đã được thêm vào, kế hoạch vị trí trở thành 2D-RoPE, nhưng nguyên thủy vẫn giữ. Bài học này đọc đường ống mã patch từ đầu đến cuối và xây dựng nó trong stdlib Python để phần còn lại của giai đoạn 12 có một mô hình tinh thần cụ thể cho "tô hiệu thị giác".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Mục tiêu học tập

- Chuyển đổi một hình ảnh HxWx3 thành một chuỗi các mã hóa vá với mã hóa vị trí chính xác.
- Lượng bộ vi số, số parameter và FLOP cho ViT của một số liệu (kích thước bản vá, độ phân giải, mờ ẩn, độ sâu).
- Hãy nêu tên ba nâng cấp đã đưa ViT từ nghiên cứu năm 2020 đến sản xuất năm 2026: tự giám sát trước khi đào tạo (DINO / MAE), mã đăng ký và đóng gói độ phân giải bản địa.
- Chọn giữa CLS pooling, trung bình pooling, và đăng ký token cho một nhiệm vụ dòng chảy.

## Vấn đề

Các bộ biến chuyển hoạt động trên chuỗi các vector. Văn bản đã là một chuỗi (byte hoặc token). Một hình ảnh là một lưới 2D của các pixel với ba kênh màu  không phải một chuỗi. Nếu bạn phẳng mỗi pixel, một hình ảnh RGB 224x224 trở thành 150,528 token, và sự chú ý tự tại chiều dài đó là không khởi động (quadrat trong chiều dài chuỗi).

Các cách tiếp cận trước năm 2020 đã kéo một bộ trích dẫn tính năng CNN lên mặt trước: ResNet tạo ra một bản đồ tính năng 7x7 của các vector 2048 chiều, cung cấp 49 token đó cho một biến thể. Điều này hoạt động nhưng thừa hưởng sự thiên vị của CNN (tương đương dịch, các trường thụ thể địa phương) và mất sự thèm ăn của biến thể đối với quy mô.

Dosovitskiy et al. (2020) đặt ra câu hỏi thẳng thắn: nếu chúng ta bỏ qua CNN thì sao? Chia hình ảnh thành các bản vá kích thước cố định (chẳng hạn 16x16 pixel), chiếu theo đường thẳng mỗi bản vá vào một vector, thêm một bản nhúng vị trí, và đưa chuỗi vào một bộ biến thể vanilla. Vào thời điểm đó đây là một sự dị giáo mà không có sự xoay quanh. Với đủ dữ liệu (JFT-300M, sau đó là LAION) nó đánh bại ResNet trên ImageNet và tiếp tục cải thiện.

Đến năm 2026, ViT nguyên thủy là nền tảng không thể nghi ngờ. Tháp tầm nhìn của mỗi VLM có trọng lượng mở là một số hậu duệ (DINOv2, SigLIP 2, CLIP, EVA, InternViT).

## Khái niệm

### Các bản vá như các token

Nhờ hình ảnh `x`hình dạng`(H, W, 3)`và một kích thước đệm `P`, bạn khắc hình ảnh thành một lưới của `(H/P) x (W/P)`Các đệm không chồng chéo.`P x P x 3`Cube của các pixel. phẳng mỗi cube để một `3 P^2`Vector. Sử dụng một dự án tuyến tính chia sẻ `W_E`hình dạng`(3 P^2, D)`để lập bản đồ mỗi đệm vào chiều kích ẩn của mô hình `D`- Tôi không biết.

Đối với cấu hình ViT-B/16:
- Nghị quyết 224, kích thước vá 16 → lưới 14x14 → 196 mã vá.
- Mỗi đệm là `16 x 16 x 3 = 768`giá trị pixel, dự đoán là `D = 768`- Tôi không biết.
- Thêm một cái học được `[CLS]`token → chuỗi dài 197.

Dự án váy là toán học giống hệt với một convolution 2D với kích thước hạt nhân `P`, bước đi`P`, và`D`Đó là cách mà mã sản xuất thực sự thực hiện nó `nn.Conv2d(3, D, kernel_size=P, stride=P)`. Phong khung "động chiếu tuyến tính" là khái niệm; Phong khung hạt nhân là hiệu quả.

### Các tích hợp vị trí

Các bản vá không có thứ tự bản chất  người biến hình nhìn thấy chúng như một túi. ViT đầu tiên đã thêm một việc nhúng vị trí 1D có thể học được (một vector 768 chiều mỗi vị trí, 197 trong số đó).

Các xương sống thị giác hiện đại sử dụng 2D-RoPE (M-RoPE của Qwen2-VL, mặc định của SigLIP 2) hoặc các vị trí 2D được phân tích theo yếu tố. 2D-RoPE xoay các truy vấn và các vector khóa dựa trên chỉ số của vá (câu, cột), vì vậy mô hình này suy luận vị trí 2D tương đối từ góc quay. Không có bảng vị trí. mô hình xử lý kích thước lưới tùy ý khi suy luận.

### Các token CLS, đầu ra tổng hợp và mã đăng ký

Định nghĩa hình ảnh là gì? Ba lựa chọn tồn tại cùng nhau:

1. `[CLS]`token. Prependable vector để các chuỗi vá. Sau tất cả các khối biến thể, trạng thái ẩn của token CLS là đại diện hình ảnh. thừa kế từ BERT. được sử dụng bởi ViT gốc, CLIP.
2. - Phòng trung bình, trung bình các thông báo của các mã hóa được sử dụng bởi SigLIP, DINOv2, hầu hết các VLM hiện đại.
3. Các mã đăng ký được đào tạo mà không có mã thông báo rửa mặt rõ ràng (2023) quan sát thấy rằng các mã thông báo được đào tạo mà không có mã thông báo rửa mặt rõ ràng phát triển các bản vá "đồ tạo" có chuẩn cao bắt cóc sự chú ý bản thân.

Sự lựa chọn quan trọng đối với các nhiệm vụ dòng chảy xuống. CLS là tốt cho việc phân loại. Đối với VLMs cung cấp các mã hóa vá vào LLM, bạn bỏ qua việc hợp nhất hoàn toàn  mỗi mã vá trở thành mã hóa nhập vào LLM. Các sổ đăng ký bị loại bỏ trước khi giao (bạn đang đặt hàng, không phải là nội dung).

### Đào tạo trước: giám sát, tương phản, che giấu, tự chưng cất

ViT 2020 đã được đào tạo trước với phân loại giám sát trên JFT-300M.

- CLIP (2021): hình ảnh-môn ngữ tương phản trên 400M cặp. Bài học 12.02.
- MAE (2021, He et al.): che 75% các bản vá, tái tạo pixel.
- DINO (2021) / DINOv2 (2023): tự chưng cất với học sinh-người dạy, không có nhãn, không có phụ đề. 2023 DINOv2 ViT-g/14 là xương sống tinh khiết trực quan mạnh nhất và là mặc định cho trường hợp sử dụng "lợi đặc điểm dày đặc".
- SigLIP / SigLIP 2 (2023, 2025): CLIP với mất tích sigmoid và NaFlex cho tỷ lệ hình ảnh bản địa. Tháp tầm nhìn thống trị trong 2026 mở VLM (Qwen, Idefics2, LLaVA-OneVision).

Sự lựa chọn của bạn về việc đào tạo trước quyết định xương sống là tốt cho: CLIP/SigLIP cho sự phù hợp ngữ nghĩa với văn bản, DINOv2 cho các tính năng trực quan dày đặc, MAE như một điểm khởi đầu cho chỉnh sửa tinh tế dòng chảy.

### Luật quy mô

ViT quy mô (Zhai et al. 2022) đã xác định rằng chất lượng của ViT tuân thủ các luật có thể dự đoán được về kích thước mô hình, kích thước dữ liệu và tính toán.
- Mô hình lớn hơn + dữ liệu nhiều hơn → chất lượng tốt hơn.
- Kích thước các bản vá là một đòn bẩy về độ dài chuỗi so với độ trung thực. Patch 14 (đặc trưng cho DINOv2/SigLIP SO400m) cung cấp nhiều token mỗi hình ảnh so với patch 16; tốt hơn cho OCR và các nhiệm vụ dày đặc, tệ hơn cho tốc độ.
- Khả năng giải quyết là một đòn bẩy lớn khác. Đi từ 224 đến 384 đến 512 hầu như luôn luôn giúp, với chi phí vuông trong FLOP.

ViT-g/14 (1B params, patch 14, độ phân giải 224 → 256 token) và SigLIP SO400m/14 (400M params, patch 14) là hai mã hóa ngựa làm việc cho 2026 VLM mở.

### Số parameter cho một ViT

Việc tính toán đầy đủ là trong `code/main.py`Đối với ViT-B/16 ở 224:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Đặt bóng vào mỗi VT trước khi bạn tải vào điểm kiểm soát.

### 2026 cấu hình sản xuất

Các mã hóa VLM mở nhất tàu với năm 2026 là SigLIP 2 SO400m/14 với độ phân giải bản địa (NaFlex).
- Các tham số 400M.
- kích thước vá 14, độ phân giải mặc định 384 → 729 mã vá cho mỗi hình ảnh.
- Đội trung bình cho các nhiệm vụ cấp hình ảnh; tất cả 729 bản vá chảy vào LLM cho VQA.
- 4 thẻ đăng ký, bị loại bỏ trước khi giao LLM.
- 2D-RoPE với quy mô cấp hình ảnh cho tỷ lệ hình ảnh bản địa.

Mỗi quyết định trong bộ sưu tập đó đều có nguồn gốc từ một tờ báo mà bạn có thể đọc.

```figure
image-patch-tokens
```

## Sử dụng nó

`code/main.py`là một token hóa bản vá và máy tính hình học. Nó lấy (hình H, W, bản vá P, ẩn D, độ sâu L) và báo cáo:

- Hình dạng lưới và chiều dài chuỗi sau khi dán.
- Dòng mã thông báo cho hình ảnh đồ chơi tổng hợp 8x8 pixel (làm bộ qua đường phẳng + dự án).
- Số parameter được chia theo patch embed, position embed, block biến thể và head.
- FLOPs cho mỗi lần đi về phía trước tại độ phân giải mục tiêu.
- Một bảng so sánh trên ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384.

Hãy chạy nó, so sánh số lượng tham số với số lượng được xuất bản, chơi với kích thước và độ phân giải để cảm nhận chi phí số lượng token.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-patch-geometry-reader.md`Với cấu hình ViT (kích thước bản vá, độ phân giải, mờ ẩn, độ sâu), nó tạo ra một số lượng token, số parameter và ước tính VRAM với các biện minh. Sử dụng kỹ năng này bất cứ khi nào bạn chọn một xương sống thị giác cho một VLM  nó ngăn chặn "các token nổ và bối cảnh LLM của tôi điền" bất ngờ.

## Các bài tập

1. Xét chiều dài chuỗi mã đệm cho Qwen2.5-VL tại đầu vào 1280x720 gốc với kích thước đệm 14. Làm thế nào so sánh với một đại diện CLS-chỉ?

2. Một khung hình 1080p (1920x1080) ở patch 14 tạo ra bao nhiêu token? Với 30 FPS trong một video 5 phút, bao nhiêu token trực quan tổng thể? Chi phí nào tiết kiệm bạn nhiều nhất: tập hợp, lấy mẫu khung hình hoặc hợp nhất token?

3. Thực hiện trung bình tập hợp trên mã thông báo vá trong Python tinh khiết. Kiểm tra rằng trung bình tập hợp trên 196 mã thông báo của một DINOv2 đầu ra phù hợp với mô hình `forward`trả lại khi bạn yêu cầu một tập hợp tích hợp.

4. Đọc Phần 3 của "Các bộ biến đổi tầm nhìn cần đăng ký" (arXiv:2309.16588).

5. Thay đổi `code/main.py`để hỗ trợ patch-n'-pack: được đưa ra một danh sách hình ảnh với độ phân giải khác nhau, tạo ra một chuỗi gói đơn và mặt nạ chú ý khối-chương vị.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## Đọc thêm

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) ViT gốc.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) MAE, tự giám sát trước khi tập luyện.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) tự chưng cất ở quy mô, không có nhãn.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) đăng ký token và phân tích đồ tạo vật.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) tháp tầm nhìn mặc định năm 2026.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) Luật quy mô thực nghiệm.
