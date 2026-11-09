# CLIP và sự chuẩn bị ngôn ngữ thị giác tương phản

> CLIP (2021) của OpenAI chứng minh một ý tưởng duy nhất đủ lớn để cung cấp năng lượng trong năm năm tiếp theo: sắp xếp một bộ mã hóa hình ảnh và một bộ mã hóa văn bản trong cùng một không gian vector chỉ sử dụng các cặp hình ảnh-chủ đề web ồn ào và một lỗ hổng tương phản. Không có nhãn giám sát. 400 triệu cặp. Không gian nhúng kết quả làm phân loại chụp không, lấy lại hình ảnh văn bản, và cắm vào mỗi VLM năm 2026 như tháp tầm nhìn của nó. SigLIP 2 (2025) thay thế softmax bằng sigmoid và quy mô sau CLIP với chi phí thấp hơn. Bài học này đi bộ toán từ InfoNCE đến mất tích cặp sigmoid và xây dựng bước đào tạo trong stdlib Python.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Mục tiêu học tập

- Thuộc dẫn mất InfoNCE từ thông tin lẫn nhau và thực hiện một phiên bản vector hóa ổn định về số.
- Giải thích tại sao Sigmoid pairwise loss (SigLIP) đạt 32768+ mà không có yêu cầu về tổng tổng tổng chi phí trên mềm.
- Thực hiện phân loại ImageNet bằng cách xây dựng các mẫu văn bản (`a photo of a {class}`) và dùng argmax thay vì sự tương đồng cosine.
- Tên bốn đòn bẩy CLIP / SigLIP trước khi đào tạo cho bạn: kích thước lô, nhiệt độ, mẫu yêu cầu, chất lượng dữ liệu.

## Vấn đề

Tầm nhìn trước CLIP được giám sát. Thu thập các tập dữ liệu có nhãn (ImageNet: 1.2M hình ảnh, 1000 lớp), đào tạo một CNN, vận chuyển nó.

Các hình ảnh tựa đề web có hơn một tỷ cặp được dán nhãn miễn phí. Một bức ảnh của một chiếc xe thu hồi vàng với văn bản thay thế "con chó Max của tôi ở công viên" mang theo một tín hiệu giám sát văn bản mô tả hình ảnh. Câu hỏi: bạn có thể biến điều này thành một bài tập hữu ích không?

Câu trả lời của CLIP: coi cặp hình ảnh-chủ đề như một nhiệm vụ phù hợp. Với một loạt các hình ảnh N và các tiêu đề N, hãy học cách phù hợp với mỗi hình ảnh với tiêu đề riêng của nó đối với các chất phân tâm N-1.

Không gian nhúng kết quả làm nhiều hơn CLIP được đào tạo cho. ImageNet chụp không hoạt động bởi vì "một bức ảnh của một con mèo" nhúng gần hình ảnh của mèo mà không bao giờ được gắn nhãn rõ ràng mèo. Đây là sự đặt cược đã sinh ra mỗi 2026 VLM.

## Khái niệm

### Bộ mã hóa kép

CLIP có hai tháp:

- Mã mã hình ảnh `f`: ViT hoặc ResNet, đưa ra một vector D-dim cho mỗi hình ảnh.
- Mã mã văn bản `g`: biến đổi nhỏ, phát ra một D-dim vector mỗi caption.

Cả hai tháp đều bình thường hóa đầu ra của họ cho chiều dài đơn vị.`cos(f(x), g(y)) = f(x)^T g(y)`vì cả hai đều là chuẩn đơn vị.

Để một loạt $N$(hình, caption) cặp, xây dựng các matrix tương đồng `S`hình dạng`(N, N)`- Có thể là:

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

nơi `tau`là nhiệt độ được học (CLIP bắt đầu với 0.07; được học trong log-space).

### Lãng InfoNCE

CLIP sử dụng một entropy chéo đối xứng trên các hàng và cột:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

Đây là InfoNCE. Softmax trong CE buộc mỗi hình ảnh phù hợp với tiêu đề của nó nhiều hơn bất kỳ tiêu đề nào khác trong lô. "Lối tiêu cực" là tất cả các mục lô khác.

### Nhiệt độ

`tau`điều khiển độ sắc nét của Softmax.$\tau$→ phân bố sắc bén, tác dụng khai thác tiêu cực cứng.$\tau$→ mềm, tất cả các mẫu đóng góp. CLIP học hỏi $\log(1/\tau)$SigLIP 2 sửa chữa các điểm đầu tiên$\tau$và sử dụng một sự thiên vị học tập thay vào đó.

### Tại sao cân bằng sigmoid tốt hơn (SigLIP)

Softmax cần toàn bộ các matrix tương đồng đồng. trong đào tạo phân tán bạn phải tập hợp tất cả mọi nhúng vào mỗi bản sao, sau đó làm softmax.

SigLIP thay thế softmax bằng sigmoid thông minh về yếu tố: cho mỗi cặp `(i, j)`, mất là phân loại nhị phân của "có cặp phù hợp không?" nhãn lớp tích cực là đường viền, tất cả mọi thứ khác là âm. mất là:

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`y_ij = 1`Nếu`i == j`, khác 0. mỗi cặp mất tích độc lập. Không cần tất cả. Mỗi GPU tính toán khối và số tiền địa phương của mình. SigLIP 2 cân bằng để lô 32k-512k rẻ nơi CLIP cần tương xứng nhiều hơn giao tiếp.

### Định dạng không bắn

Với tên lớp N, cho mỗi lớp tạo một mẫu văn bản:

```
"a photo of a {class}"
```

Nhập mỗi mẫu với mã hóa văn bản. Nhập hình ảnh của bạn với mã hóa hình ảnh. Argmax cosine tương đồng = lớp dự đoán. Không có đào tạo về các lớp mục tiêu.

Các mẫu nhanh là quan trọng. Bức giấy ban đầu của CLIP sử dụng 80 mẫu cho mỗi lớp (sơn, nghệ thuật, ảnh, vẽ, vv) và trung bình các nhúng. +3 điểm ImageNet. Sử dụng hiện đại thường chọn một hoặc hai mẫu.

### Các thăm dò tuyến tính và điều chỉnh tinh tế

Zero-shot là một đường cơ sở. Một thăm dò tuyến tính (đưa một lớp tuyến tính trên các tính năng CLIP đóng băng cho các lớp mục tiêu của bạn) vượt qua zero-shot trên các nhiệm vụ trong lĩnh vực.

### SigLIP 2: NaFlex và các tính năng dày đặc

SigLIP 2 (2025) thêm:
- NaFlex: mô hình đơn xử lý tỷ lệ và độ phân giải của các khía cạnh thay đổi.
- Các tính năng mật thiết tốt hơn cho phân đoạn và ước tính độ sâu, nhắm mục tiêu sử dụng như một xương sống đóng băng trong VLMs.
- Nhiều ngôn ngữ: được đào tạo trên 100+ ngôn ngữ nơi CLIP chỉ có tiếng Anh.
- 1B param scale nơi CLIP đạt đỉnh ở 400M.

Trong 2026 VLM mở, SigLIP 2 SO400m/14 là tháp tầm nhìn mặc định. CLIP vẫn là mặc định cho việc lấy lại văn bản hình ảnh khi phân phối đào tạo LAION-2B cụ thể phù hợp với mô hình truy vấn của bạn.

### ALIGN, BASIC, OpenCLIP, EVA-CLIP

ALIGN (Google, 2021): cùng một ý tưởng như CLIP, thang đo đôi 1.8B, 90% tiếng ồn. Scales dữ liệu ồn ào được chứng minh. OpenCLIP (LAION): tái tạo CLIP mở trên LAION-400M / 2B, nhiều thang đo, điểm kiểm soát mở. EVA-CLIP: khởi tạo từ mô hình hình hóa mặt nạ; xương sống mạnh mẽ cho VLMs. BASIC: CLIP + ALIGN lai của Google. Tất cả cùng một gia đình, dữ liệu khác nhau và điều chỉnh.

### Màn trần không bắn

Các mô hình CLIP-class có mức tối đa khoảng 76% ImageNet zero-shot (CLIP-G, OpenCLIP-G). Ngoài ra có thể cần dữ liệu lớn hơn nhiều (SigLIP 2 nhận 80% +) hoặc thay đổi kiến trúc (chủ đầu giám sát, nhiều tham số hơn).

```figure
multimodal-fusion
```

## Sử dụng nó

`code/main.py`thực hiện:

1. Một mã hóa đồ chơi kép (chương tính hình ảnh dựa trên hash, tính năng biểu đồ văn bản) để bạn có thể xem hình dạng InfoNCE mà không cần numpy.
2. InfoNCE mất mát trong Python tinh khiết (thường ổn định số bằng log-sum-exp).
3. Lối mất cặp Sigmoid để so sánh.
4. Một thói quen phân loại chụp không: tính toán sự tương đồng cosine với một tập hợp các lời nhắc văn bản, argmax cho dự đoán.

Hãy chạy nó và xem đường cong thua lỗ. Số tuyệt đối là đồ chơi; hình dạng phù hợp với những gì một huấn luyện viên CLIP thực sự phát ra.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-clip-zero-shot.md`. Với một bộ hình ảnh (via path) và một danh sách các lớp mục tiêu, nó xây dựng các lời nhắc văn bản với mẫu CLIP, nhúng cả hai bên với một điểm kiểm soát được chỉ định (ví dụ: `openai/clip-vit-large-patch14`), và trả lại dự đoán top-1 / top-5 với điểm tương đồng. Kỹ năng từ chối đưa ra tuyên bố về các lớp không trong danh sách yêu cầu.

## Các bài tập

1. Thực hiện InfoNCE cho một loạt 4 cặp bằng tay. Xây dựng các hình tử hình tương tự 4x4, chạy softmax, chọn đường chéo, tính toán chéo entropy. Kiểm tra Python thực hiện của bạn với tính toán tay này.

2. SigLIP sử dụng một tham số thiên vị `b`Ngoài nhiệt độ: `S'[i,j] = S[i,j]/tau + b`- Vai trò của nó là gì?`b`chơi khi các lô có sự mất cân bằng lớp lớn (nhiều hơn nhiều âm tính so với tích cực cho mỗi hàng)?

3. Xây dựng một phân loại không bắn cho mèo so với chó.`a photo of a {class}`và `a picture of a {class}`- Đánh giá độ chính xác trên 100 hình ảnh thử nghiệm.

4. Xét chi phí truyền thông của Softmax InfoNCE vs sigmoid đôi cho một 512-GPU chạy tại lô 32k.$O(N)$, như $O(N^2)$- Cita phần 4 của Siglip.

5. Đọc bài báo OpenCLIP về quy mô quy mô (arXiv:2212.07143, Cherti et al.). Tạo lại kết luận của họ về quy mô dữ liệu từ các con số: ở kích thước mô hình cố định, mối quan hệ log-linear giữa độ chính xác chụp không của ImageNet và kích thước dữ liệu đào tạo là gì?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## Đọc thêm

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) giấy CLIP.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) SigLIP.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) đa ngôn ngữ + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) quy mô với dữ liệu web ồn ào.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) OpenCLIP quy mô luật.
