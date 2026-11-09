# Flamingo và Gated Cross-Attention cho VLM ít bắn

> Flamingo của DeepMind (2022) đã làm hai điều trước bất cứ ai khác. Nó cho thấy một mô hình duy nhất có thể xử lý theo trình tự tự tự nhiên của hình ảnh, video và văn bản. Và nó cho thấy VLM có thể học trong bối cảnh  đưa ra một vài cú chụp với ba cặp ví dụ (hình ảnh, tiêu đề) và mô hình ghi chú một hình ảnh mới mà không cần bất kỳ bước gradient nào. Cơ chế: các lớp chú ý chéo bị khóa, được đưa vào giữa các lớp hiện có của LLM đóng băng, với một cổng tanh học được bắt đầu từ không để khả năng văn bản của LLM được bảo tồn khi khởi tạo. Bài học này đi bộ với thiết kế thiết kế nhận thức của Flamingo và kiến trúc quan tâm chéo  tổ tiên của các đầu vào liên kết của Gemini và các token thị giác của Idefics2.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Mục tiêu học tập

- Giải thích cách thức quan tâm chéo được gài giữ lại khả năng văn bản của LLM đóng băng khi khởi tạo thông qua tanh(gate) = 0.
- Đi qua một thiết bị lấy mẫu lại của Perceiver: N image patches → K cố định các truy vấn "latent" thông qua sự chú ý chéo.
- Mô tả cách Flamingo xử lý các chuỗi hình ảnh-môn văn được giao với sự che giấu nguyên nhân tôn trọng vị trí hình ảnh.
- Tạo lại cấu trúc đơn giản đa phương pháp với vài lần chụp (3 ví dụ về tựa đề hình ảnh sau đó là hình ảnh truy vấn).

## Vấn đề

BLIP-2 cung cấp 32 token thị giác vào lớp đầu vào của LLM đóng băng. Làm việc cho một hình ảnh mỗi lời nhắc. Nhưng nếu bạn muốn cung cấp nhiều hình ảnh với văn bản, như trong "đây là hình ảnh A, ghi chú nó; đây là hình ảnh B, ghi chú nó; bây giờ đây là hình ảnh C, ghi chú nó"? Sự tự chú ý của LLM sẽ cần phải xử lý các token hình ảnh và các token văn bản trong một dòng chảy duy nhất, và câu hỏi về vị trí nào có thể tham gia vào hình ảnh nào trở nên khó khăn.

Câu trả lời của Flamingo: không thay đổi dòng đầu vào của LLM. Đặt thêm các lớp chú ý chéo giữa các khối LLM hiện có. Các mã thông báo văn bản vẫn chảy qua sự chú ý tự do của LLM như thường lệ. Giữa mỗi vài khối LLM, các mã thông báo văn bản cũng xuyên qua các tính năng hình ảnh thông qua một lớp bị khóa mới. Cổng (được khởi tạo thành không) có nghĩa là ở bước không, các lớp mới là không có hoạt động. Khi đào tạo tiến triển, cánh cổng mở ra và thông tin trực quan bắt đầu chảy.

Flamingo trả lời câu hỏi thứ hai: làm thế nào để xử lý một số hình ảnh biến (0, 1 hoặc nhiều) mỗi yêu cầu? Một thiết bị lấy mẫu lại Perceiver là một mô-đun nhỏ liên quan đến sự chú ý, lấy bất cứ số lượng các bản vá nào bạn có và tạo ra một số lượng cố định của các token ẩn hình ảnh cho mỗi hình ảnh. Tổng số tăng lên với số lượng hình ảnh, nhưng mỗi mã thông báo văn bản chỉ đọc các dấu ẩn của một hình ảnh, vì vậy bất kỳ mã thông báo văn bản nào nhìn thấy trong sự chú ý chéo đều có cùng một hình dạng bất kể có bao nhiêu hình ảnh trong thư nhắc.

## Khái niệm

### LLM đóng băng

Flamingo bắt đầu với một bộ phim LLM 70B của Chinchilla.

### Tâm đơn nhận thức

Đối với mỗi hình ảnh trong prompt, ViT tạo ra $N$Các mã đệm.$K$các khóa học cố định (Flamingo sử dụng $K=64$). Mỗi khối resampler là hai bước phụ:

1. Sự chú ý qua nhau:$K$$N$token patch (Q từ laten, K/V từ patches).
2. Sự chú ý tự chủ + FFN trong những điều ẩn dật.

Sau 6 khối resampler, đầu ra là $K=64$Các mã thông báo hình ảnh của dim 1024, bất kể ViT đã tạo ra bao nhiêu mã thông báo. Một hình ảnh 224x224 (196 mã thông báo) và một hình ảnh 480x480 (900 mã thông báo) cả hai đều xuất hiện như 64 mã thông báo resampler.

Đối với video, resampler được áp dụng theo thời gian: các bản vá của mỗi khung tạo ra 64 laten, và mã hóa vị trí thời gian cho phép mô hình phân biệt $t=0$từ $t=N$. Video đầy đủ trở thành$T \cdot 64$các token hình ảnh.

### Sự chú ý qua nhau

Giữa mỗi $M$các lớp của LLM đóng băng (Flamingo sử dụng $M=4$), thêm một khối quan tâm chéo bị khóa mới:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha`là một scalar có thể học được khởi tạo lên 0.
- `tanh(0) = 0`, vì vậy tại init, chi nhánh đóng cửa đóng góp bằng không.
- Như `alpha`nếu chuyển xa khỏi 0 thì sự đóng góp của sự chú ý qua nhau sẽ tăng lên một cách trơn tru.
- Kết nối còn lại có nghĩa là ngay cả một cổng mở hoàn toàn không ghi lại bản đại diện văn bản của LLM; nó chỉ thêm thông tin trực quan ở trên.

Đây là lựa chọn thiết kế duy nhất quan trọng nhất trong Flamingo: điều kiện thị giác là cộng, bị khóa và không khi khởi tạo.

### Sự chú ý chéo che giấu cho các đầu vào được giao tiếp

Trong một lệnh như "<image A> caption A <image B> caption B <image C> ?", mỗi mã thông báo văn bản chỉ nên hiển thị các hình ảnh trước đó trong chuỗi.`t`chỉ tham gia vào các token resampler của hình ảnh `i_t`, nơi `i_t`là hình ảnh gần đây nhất trước vị trí `t`"Cô chỉ nhìn thấy hình ảnh trước cuối cùng" hoặc "cô nhìn thấy tất cả hình ảnh trước" là cả hai lựa chọn hợp lệ; Flamingo chọn thứ nhất.

### Học tập trong bối cảnh ít ảnh

Một lời nhắc nhở của Flamingo trông giống như:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

Mô hình nhìn thấy mô hình hoàn thành và xuất hiện "con chim" (hoặc bất cứ hình ảnh nào3 cho thấy). Không có bước nghiêng. Khả năng học tập trong bối cảnh của LLM đóng băng mang thông qua sự chú ý chéo bị khóa.

### Dữ liệu đào tạo

Flamingo được đào tạo trên ba bộ dữ liệu:

1. MultiModal MassiveWeb (M3W): 43M trang web với hình ảnh và văn bản được giao lưu, tái cấu trúc thứ tự đọc.
2. Cặp hình ảnh-môn văn: ALIGN (1.8B cặp) cộng với LTIP (312M cặp), tổng cộng khoảng 2.1B cặp.
3. Video-Text Pairs (VTP): 27M clip video ngắn.

OBELICS (2023) là một bản sao mở của các kết nối web được giao lưu, mà Idefics, Idefics2 và hầu hết các mô hình "Flamingo-like" mở được đào tạo.

### OpenFlamingo và Otter

OpenFlamingo (2023) là bản sao mở. Kiến trúc giống hệt nhau (Perceiver resampler + gated cross-attention trên LLaMA hoặc MPT đóng băng).

Otter (2023) xây dựng trên OpenFlamingo với điều chỉnh hướng dẫn trên MIMIC-IT (một bộ dữ liệu của các hướng dẫn đa phương thức), cho thấy các công việc chú ý chéo bị khóa cho hướng dẫn theo dõi cũng vậy.

### Những hậu duệ

- Idefics / Idefics2 / Idefics3: dòng dõi chú ý chéo được đóng cửa của Hugging Face, dần đơn giản hơn (Idefics2 đã bỏ lại mẫu lại để ủng hộ các mã thông báo vá trực tiếp với sự hợp tác thích ứng).
- Chuyển đổi Flamingo-Chameleon: đến năm 2024, nhiều đội đã chuyển sang hợp nhất sớm (Dạy 12.11); Sự chú ý chéo theo phong cách Flamingo vẫn còn trong sản xuất nơi cần đóng băng xương sống.
- Sự nhập vào liên kết của Gemini: theo khái niệm thừa hưởng tính linh hoạt định dạng liên kết của Flamingo, mặc dù cơ chế chính xác là độc quyền.

### So sánh với BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | ~2.1B pairs + 27M video clips + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

Chọn BLIP-2 cho VQA hình ảnh đơn trên một ngân sách. Chọn Flamingo / Idefics2 cho lý luận hình ảnh liên kết, ít ảnh hoặc nhiều hình ảnh.

```figure
cross-attention-fusion
```

## Sử dụng nó

`code/main.py`chứng minh:

1. Một thiết bị lấy mẫu lại Perceiver trên 36 mã thông báo vá giả với 8 dấu ẩn có thể học (trong Python tinh khiết).
2. Một bước đi quan tâm qua cửa với `alpha = 0`→ đầu ra bằng đầu vào (LLM không thay đổi), sau đó `alpha = 2.0`→ đóng góp thị giác trộn lẫn.
3. Một nhà xây dựng mặt nạ nhộn nhịp tạo ra mặt nạ chú ý 2D cho chuỗi "(hình 1) (màn văn 1) (hình 2) (màn văn 2)".

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-gated-bridge-diagnostic.md`. Với cấu hình của một VLM mở (sampleer Y/N, tần số giao tiếp chéo, hệ thống cổng), nó xác định các yếu tố dòng dõi Flamingo và giải thích chiến lược đóng băng. hữu ích để cố định lý do tại sao một bản chỉnh tinh tế suy giảm hiệu suất văn bản (câu trả lời: cổng đã quá rộng quá nhanh).

## Các bài tập

1. Xét số tham số thị giác của Flamingo-9B: 9B LLM + 1.4B lớp quan tâm chéo được vạch + 64M resampler.

2. Thực hiện các phần còn lại bị khóa `y = tanh(alpha) * cross + x`Trong PyTorch.`alpha=0`- `y==x`chính xác ở init.

3. Đọc phần 3.2 (arXiv:2308.01390) của OpenFlamingo về cách xử lý nhiều hình ảnh trong một lô khi mỗi prompt có số hình ảnh khác nhau.

4. Tại sao mặt nạ thu hút sự chú ý của Flamingo cho phép một mã thông báo văn bản chỉ xem * hình ảnh gần đây nhất* trước đó chứ không phải tất cả hình ảnh trước đó?

5. Trong bối cảnh vài lần chụp: xây dựng một lời nhắc với 4 ví dụ về "phức ảnh → màu của đối tượng chính" cho một biến thể Flamingo mới. Mô tả mô hình độ chính xác mong đợi khi bạn thay đổi số ví dụ từ 0 đến 8.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses $M=4$ |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## Đọc thêm

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) giấy gốc.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) sinh sản mở.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) các trang web được giao nhau.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) kiến trúc Perceiver chung.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726)- Thủy sao Flamingo theo hướng dẫn.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) đơn giản hóa hiện đại của cách tiếp cận Flamingo.
