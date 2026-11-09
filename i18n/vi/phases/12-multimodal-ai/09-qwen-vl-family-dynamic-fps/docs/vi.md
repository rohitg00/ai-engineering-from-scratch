# Qwen-VL Gia đình và Dynamic-FPS Video

> Gia đình Qwen-VL  Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025)  là dòng dõi mô hình ngôn ngữ thị giác mở có ảnh hưởng nhất vào năm 2026. Mỗi thế hệ đã đặt cược kiến trúc quyết định duy nhất mà phần còn lại của hệ sinh thái mở đã sao chép trong vòng mười hai tháng: độ phân giải động bản địa thông qua M-RoPE, lấy mẫu động-FPS với sự sắp xếp thời gian tuyệt đối, chú ý cửa sổ trong ViT và các định dạng xuất phát của đại lý có cấu trúc. Bằng Qwen3-VL, công thức đã ổn định: một bộ mã hóa 2D-RoPE-ViT với đầu vào tỷ lệ khía cạnh bản địa, một máy chiếu MLP vào cơ sở ngôn ngữ Qwen3 lớn, và các giai đoạn đào tạo nhấn mạnh OCR, hạ tầng và hành vi của đại lý như các mục tiêu hạng nhất. Bài học này đọc theo thời gian của gia đình để bạn hiểu tại sao mỗi nút ở nơi nó ở.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## Mục tiêu học tập

- Xét các vòng quay ba trục của M-RoPE (thời gian, chiều cao, chiều rộng) và giải thích tại sao cả ba đều cần thiết.
- Chọn một chiến lược lấy mẫu FPS động cho một video và lý luận về độ chính xác của token-per-second vs. phát hiện sự kiện.
- Hãy nêu tên bốn phiên bản nâng cấp Qwen-VL theo thứ tự và điều gì mỗi phiên bản đã tạo ra.
- Đưa một định dạng đầu ra đại lý JSON kiểu Qwen2.5-VL và phân tích các cuộc gọi công cụ có cấu trúc từ phản ứng VLM.

## Vấn đề

Qwen-VL được xuất khẩu vào tháng 8 năm 2023 như là phản ứng trực tiếp với LLaVA-1.5 và BLIP-2.

Giải pháp: LLaVA-1.5 chạy ở 336x336. Đẹp cho ảnh, vô dụng cho một hóa đơn bằng tiếng Trung hoặc một ảnh chụp màn hình bảng tính dày đặc.

Video: Video-LLaMA xếp chồng các bộ mã hóa mỗi khung hình và cung cấp chúng cho LLM. Nó hoạt động cho các clip ngắn, không phải cho các video dài nhiều phút nơi trục thời gian là tín hiệu. Nhóm Qwen muốn một bộ mã hóa duy nhất hiểu thời gian.

Khả năng xuất phát được cấu trúc: LLaVA phát ra văn bản dạng tự do. Một đại lý cần JSON. Qwen-VL được đào tạo về các định dạng xuất phát JSON rõ ràng bao gồm các phối hợp hộp biên như văn bản.

Mỗi thế hệ Qwen-VL mở rộng một trong ba trục này.

## Khái niệm

### Qwen-VL (tháng 8 năm 2023)

Thế hệ đầu tiên: OpenCLIP ViT-bigG/14 như một bộ mã hóa (2.5B param), LLama tương thích Q-Former (1 bước với 256 truy vấn), cơ sở Qwen-7B.

- Độ phân giải 448x448 (sau đó SOTA cho một VLM mở).
- Địa điểm: được đào tạo trên các cặp hình ảnh-tinh văn với đầu ra mã phối hợp rõ ràng. "Căn nuôi ở <box>112, 204), (280, 344)</box>".
- Đào tạo đa ngôn ngữ Trung Quốc + tiếng Anh từ đầu.

Các điểm chuẩn vào thời điểm đó: cạnh tranh với GPT-4V ở tiếng Anh, thống trị ở tiếng Trung Quốc.

### Qwen2-VL (Ngày 9 năm 2024)  M-RoPE và giải pháp bản địa

Qwen2-VL đã thay thế stack Q-Former với độ phân giải cố định bằng một bộ mã hóa ViT có độ phân giải động bản địa.

- ViT chấp nhận bất kỳ HxW nào có thể chia bằng 28 (phát 14 với 2x kết hợp không gian). Một hình ảnh ở 1120x672 (40x24 phát kết hợp) tạo ra 960 token thị giác. Không có kích thước, không có tay, không có hình ảnh thu nhỏ.
- M-RoPE (Multimodal RoPE). Mỗi token mang một vị trí 3D (t, h, w) thay vì 1D. Đối với hình ảnh t = 0, cho video t = frame_index. RoPE xoay các vector truy vấn / khóa theo tần số mỗi trục. Không có bảng nhúng vị trí.
- MLP Projector. Thả Q-Former; sử dụng 2 lớp MLP trên các mã thông báo nhấp hợp.
- Video với FPS động. Video được lấy mẫu ở 1-2 FPS theo mặc định, nhưng mô hình chấp nhận tính toán khung hình tùy ý.

Kết quả: Qwen2-VL-7B phù hợp với GPT-4o trên một số điểm chuẩn đa phương thức và đánh bại nó trên DocVQA (94.5 vs 88.4).

### Qwen2,5-VL (Tháng 2 năm 2025)  FPS động + thời gian tuyệt đối

Vị trí lớn của Qwen2.5VL là video. FPS động không chỉ là "chọn mẫu nhiều khung hình hơn khi cần thiết".

- Thời gian tuyệt đối trong các ID vị trí. Thay vì chỉ số khung (phần 0, 1, 2...), trục thời gian của M-RoPE theo dấu thời gian thực tế, do đó khoảng cách giữa hai ID khung theo dõi các giây giữa chúng. "Ở 0:04, mèo nhảy". Không có mã văn bản bổ sung mang thời gian, vì vậy mã hóa không thêm chiều dài chuỗi.
- FPS động. Sample ở 1 FPS cho đoạn băng chậm, 4+ FPS cho hành động. người dùng hoặc huấn luyện viên chọn; M-RoPE thích nghi.
- Sự chú ý cửa sổ trong ViT. Sự chú ý không gian được mở cửa sổ (địa điểm trong các khối) cho thông qua; sự chú ý toàn cầu mỗi vài lớp.
- Mô hình phát ra JSON rõ ràng. được đào tạo trên dữ liệu gọi công cụ: "{\" công cụ\": \"click\", \"coords\": [380, 220]}".
- MRoPE-v2 quy mô. Tầm định vị với kích thước đầu vào tối đa để video 10 phút không bị mất tần số.

Điểm chuẩn: Qwen2.5-VL-72B vượt qua GPT-4o trên hầu hết các điểm chuẩn video, phù hợp với Gemini 2.0 trên tài liệu, và thiết lập SOTA mô hình mở cho việc kết nối GUI (ScreenSpot: 84% chính xác so với 38% cho GPT-4o).

### Qwen3-VL (Tháng 11 năm 2025)

Qwen3-VL là một nâng cấp tăng lên tập hợp thay vì tái phát minh: xương sống LLM lớn hơn (Qwen3-72B), dữ liệu đào tạo mở rộng, OCR cải thiện, lý luận mạnh mẽ hơn thông qua "chế độ suy nghĩ" Qwen3. ViT và M-RoPE ở lại.

Điểm cuối cùng: vào năm 2025, kiến trúc Qwen-VL đã ổn định. Các thế hệ khác tính toán và dữ liệu quy mô, không phải nguyên thủy.

### M-RoPE về mặt toán học

RoPE cổ điển xoay một truy vấn `q`kích thước `d`theo vị trí `m`sử dụng các phối hợp:

```math
\begin{aligned}
q_{\text{rot}}[2i] &= q[2i] \cos(m \theta_i) - q[2i+1] \sin(m \theta_i) \\
q_{\text{rot}}[2i+1] &= q[2i] \sin(m \theta_i) + q[2i+1] \cos(m \theta_i) \\
\theta_i &= 10000^{-2i/d}
\end{aligned}
```

M-RoPE chia mờ ẩn thành ba băng.`d = 96`. Đưa 32 điểm tối đến thời gian, 32 điểm cao, 32 điểm rộng. Mỗi băng xoay theo vị trí trục riêng của nó. Một đệm ở (t=5, h=10, w=20) có được xoay `R_t(5)`- `R_h(10)`- `R_w(20)`được áp dụng cho ba băng của nó.

Sử dụng mã thông báo văn bản `t = text_index, h = 0, w = 0`(hoặc một lựa chọn bình thường), giữ sự tương thích.`t = frame_time, h = row, w = col`. Sử dụng hình ảnh đơn `t = 0`- Tôi không biết.

Lợi ích: một mã vị trí xử lý văn bản, hình ảnh và video mà không cần mã phân nhánh hoặc bảng vị trí khác nhau.

### Lý thuyết lấy mẫu FPS động

Với đoạn video thời gian `T`giây và ngân sách token mục tiêu `B`- Có thể là:

1. Xét FPS tối đa mà bạn có thể đủ khả năng: `fps_max = B / (T * tokens_per_frame)`- Tôi không biết.
2. Chọn một mục tiêu FPS từ `{1, 2, 4, 8}`Điều đó làm thỏa mãn `fps <= fps_max`- Tôi không biết.
3. Nếu chuyển động cao (tức là quy trình quang học hoặc yêu cầu rõ ràng của người dùng), hãy chọn FPS cao hơn.
4. Mô hình đồng nhất tại FPS được chọn; đặt ID thời gian M-RoPE của mỗi khung từ dấu thời gian của nó trong vài giây.

Qwen2.5-VL đào tạo logic này ngầm; khi suy luận người dùng kiểm soát qua `fps`Parameter: Một chuỗi hành động 60 giây ở 4 FPS với 81 token mỗi khung = 19440 token, có thể quản lý trong bối cảnh 32k.

### Tạo ra các chất cơ cấu

Việc đào tạo các đại lý của Qwen2.5VL rõ ràng nhắm vào các cuộc gọi công cụ có cấu trúc:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Phân tích là xác định: JSON.parse trên đầu ra của mô hình. So sánh với dạng tự do "thấp vào (1024, 512) " đòi hỏi phải xử lý regex và mơ hồ. Sự thay đổi là lý do tại sao điểm ScreenSpot của Qwen2.5-VL đã nhảy từ 55% đến 84%.

```figure
mm-mrope-axes
```

## Sử dụng nó

`code/main.py`thực hiện:

- M-RoPE tính vị trí cho một chuỗi đóng gói trộn văn bản, các bản vá hình ảnh và khung video.
- Mô hình FPS động: được cho (thời gian, ngân sách, motion_level), chọn FPS và phát ra dấu thời gian khung.
- Một máy phân tích sản xuất JSON toy Qwen2.5-VL xử lý các phản ứng gọi công cụ với các trường phối hợp.

Hãy chạy nó, và cảm nhận sự khác biệt khi bạn đổi FPS cố định cho FPS động trong một video 5 phút.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-qwen-vl-pipeline-designer.md`Với một nhiệm vụ video (phòng dõi, đại lý, nhận dạng hành động, khả năng truy cập), nó phát ra cấu hình Qwen2.5 - VL (kế hoạch khung, chiến lược FPS, cờ chú ý cửa sổ, chế độ xuất phát đại lý) và ước tính độ trễ. Sử dụng điều này bất cứ khi nào bạn triển khai mô hình gia đình Qwen-VL cho một sản phẩm video.

## Các bài tập

1. Xét các vòng quay M-RoPE cho một đệm ở (t=3, h=5, w=7) với ẩn 48 (16 mỗi băng, cơ sở theta 10000).

2. Một máy ảnh bảo mật 10 phút ghi lại ở 1 FPS tạo ra bao nhiêu khung hình? ở độ phân giải 384 với 3x pool, bao nhiêu mã thông báo tổng cộng?

3. Chọn FPS cho một cuộc đua quần vợt 30 giây so với một bản demo công thức 30 giây so với một ghi lại của đại lý UI 30 giây.

4. Qwen2.5VL hoàn toàn loại bỏ Q-Former. Tại sao một MLP đơn giản hoạt động vào năm 2025 nhưng không hoạt động vào năm 2023?

5. Phân tích ba các sản phẩm gọi công cụ JSON Qwen2.5-VL vào các phím Python.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time encoding | "Time-aligned M-RoPE" | Temporal position IDs set from each frame's timestamp, so the model sees actual seconds, not frame index, with no extra tokens |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## Đọc thêm

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
