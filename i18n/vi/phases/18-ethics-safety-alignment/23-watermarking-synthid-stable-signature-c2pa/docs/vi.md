# Đánh dấu nước  SynthID, chữ ký ổn định, C2PA

> Ba công nghệ cấu trúc 2026 nguồn gốc nội dung được tạo ra bởi AI. SynthID (Google DeepMind)  đánh dấu nước hình ảnh được tung ra vào tháng 8 năm 2023, văn bản + video tháng 5 năm 2024 (Gemini + Veo), văn bản nguồn mở tháng 10 năm 2024 thông qua Responsible GenAI Toolkit, bộ phát hiện đa phương tiện thống nhất tháng 11 năm 2025 cùng với Gemini 3 Pro. Đánh dấu nước văn bản điều chỉnh khả năng lấy mẫu mã tiếp theo một cách không thể nhận thấy; dấu nước hình ảnh / video tồn tại khi nén, cắt, lọc, thay đổi tốc độ khung hình. Stable Signature (Fernandez et al., ICCV 2023, arXiv:2303.15435)  chỉnh sửa kỹ thuật giải mã phân tán ẩn để mỗi đầu ra chứa một thông điệp cố định; hình ảnh được cắt (10% nội dung) được phát hiện > 90% tại FPR<1e-6. Tiếp theo "Signature stable is Unstable" (arXiv:2405.07145, tháng 5 năm 2024)  điều chỉnh tinh tế loại bỏ dấu nước trong khi vẫn giữ chất lượng. C2PA  chuẩn metadata có dấu hiệu mã hóa, rõ ràng là bị vi phạm (C2PA 2.2 Explainer 2025). Watermarking và C2PA là bổ sung: metadata có thể được xóa nhưng mang nguồn gốc phong phú hơn; watermark tồn tại thông qua transcoding nhưng mang ít thông tin hơn.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Mục tiêu học tập

- Mô tả đánh dấu nước cấp token (tý thức văn bản SynthID) và cơ chế mà nó có thể phát hiện.
- Mô tả Stable Signature và cuộc tấn công gỡ bỏ năm 2024 đã phá vỡ nó.
- Vai trò của C2PA của nhà nước và lý do tại sao nó bổ sung cho watermarking.
- Mô tả những hạn chế chính: tín hiệu cụ thể cho mô hình, độ vững chắc dưới sự phác thảo và các cuộc tấn công bảo tồn ý nghĩa (arXiv:2508.20228).

## Vấn đề

2023-2024 đã thấy các nội dung giả mạo sâu và nội dung được tạo ra bởi AI xâm nhập vào bối cảnh chính trị và tiêu dùng ở quy mô lớn. Watermarking là tín hiệu xuất phát kỹ thuật được đề xuất: đánh dấu các thế hệ tại thời điểm tạo, phát hiện chúng sau đó. 2025 bằng chứng: không có dấu nước chắc chắn không điều kiện, nhưng được xếp lớp với các metadata C2PA sự kết hợp cung cấp một câu chuyện xuất phát có thể sử dụng.

## Khái niệm

### Đánh dấu nước văn bản (tý dạng văn bản SynthID)

Cơ chế Kirchenbauer et al. 2023 được sản xuất bởi Google:

1. Tại mỗi bước giải mã, kết hợp các mã thông báo K trước đó để tạo ra một phân vùng ngẫu nhiên của từ vựng thành tập hợp "công màu xanh lá cây" và "màu đỏ".
2. Tiến mẫu Bias hướng đến tập hợp xanh bằng cách thêm δ vào các logit xanh.
3. Thế hệ này chứa nhiều mã thông báo xanh hơn so với tình cờ.

Khám phá: tái ghi lại từng tiền tố, đếm các mã thông báo xanh trong thế hệ, tính toán điểm z. Điểm z là >0 cho văn bản có dấu nước, ~0 cho văn bản con người.

Các tính chất:
- Không thể nhận thấy được đối với người đọc (δ đủ nhỏ để mất chất lượng là nhỏ).
- Khám phá với truy cập vào chức năng phân vùng từ vựng.
- Không mạnh mẽ để diễn tả  viết lại văn bản phá hủy tín hiệu.

SynthID-text là nguồn mở tháng 10 năm 2024 thông qua Responsible GenAI Toolkit của Google.

### Chữ ký ổn định (hình ảnh)

Fernandez et al. ICCV 2023. Định chỉnh bộ giải mã phân tán tiềm ẩn để mỗi hình ảnh được tạo chứa một tin nhắn nhị phân cố định được nhúng vào đại diện tiềm ẩn. Khám phá được giải mã từ tiềm ẩn bằng một bộ giải mã thần kinh. Hình ảnh cắt (tới 10% nội dung) được phát hiện >90% tại FPR<1e-6.

Tháng 5 năm 2024 "Signature stable is unstable" (arXiv:2405.07145): điều chỉnh tinh tế của bộ giải mã loại bỏ dấu nước trong khi vẫn giữ chất lượng hình ảnh.

### Bộ phát hiện đơn nhất SynthID (Tháng 11 năm 2025)

Cùng với Gemini 3 Pro: một bộ phát hiện đa phương tiện đọc tín hiệu SynthID từ văn bản, hình ảnh, âm thanh và video trong một API. Thống gốc Google thống nhất.

### C2PA

Liên minh về nguồn gốc và xác thực nội dung. Tiêu chuẩn metadata rõ ràng bị vi phạm được ký mật mã. C2PA 2.2 Giải thích (2025). Một bản khai báo C2PA ghi lại tuyên bố nguồn gốc (người đã tạo ra, khi nào, những biến đổi nào) được ký bởi khóa của người tạo.

Tương tự với watermarking:
- Các metadata có thể bị xóa; dấu nước không thể (hiện dễ dàng).
- Các metadata giàu (chuỗi nguồn gốc đầy đủ); dấu nước mang các bit.
- C2PA phụ thuộc vào việc áp dụng nền tảng; dấu nước được nhúng tự động.

Google tích hợp cả trong Tìm kiếm, quảng cáo và "Thiết kế này".

### Các giới hạn

- **Model-specific.**SynthID watermarks thế hệ từ các mô hình được bật SynthID. Một thế hệ từ một mô hình không có SynthID không được đánh dấu bằng nước, vì vậy "không có tín hiệu SynthID" không phải là bằng chứng về tính xác thực.
- **Paraphrase.**Các dấu nước văn bản không tồn tại trong các đoạn phác thảo giữ lại ý nghĩa.
- **Transformation attacks.**arXiv:2508.20228 (2025) cho thấy các cuộc tấn công bảo tồn ý nghĩa phá hủy cả dấu nước văn bản và nhiều dấu nước hình ảnh.
- **Fine-tune removal.**Theo "Signature ổn định là không ổn định", chỉnh sửa tinh tế sau thế hệ loại bỏ các dấu hiệu nước nhúng.

### Đạo luật AI của EU Điều 50

Bộ luật minh bạch cho việc dán nhãn nội dung được tạo ra bởi AI (mở đầu tiên vào tháng 12 năm 2025, dự thảo thứ hai vào tháng 3 năm 2026, dự kiến cuối cùng vào tháng 6 năm 2026 theo các quy định của quy định của quy định tại quy định của quy định tại quy định của quy định tại quy định của quy định tại quy định của quy định tại quy định của quy định tại quy định tại quy định của quy định tại quy định tại quy định của quy định tại quy định tại quy định tại quy định của quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định tại quy định:[European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)(c) Bộ luật vẫn còn trong dự thảo từ tháng 4 năm 2026 và thời gian có thể thay đổi.

### Khi điều này phù hợp với giai đoạn 18

Bài học 22-23 là về những gì mô hình phát ra (dữ liệu riêng tư, tín hiệu xuất xứ). Bài học 27 bao gồm quản lý dữ liệu đào tạo. Bài học 24 là khuôn khổ quy định đòi hỏi các biện pháp kỹ thuật này.

```figure
an-watermark-greenlist
```

## Sử dụng nó

`code/main.py`xây dựng một dấu nước văn bản đồ chơi. Các mã thông báo là số nguyên số 0..N-1; dấu nước lấy mẫu thiên hướng đến bộ màu xanh lá cây được xác định bằng hash. Một máy dò tính điểm z của mã thông báo xanh lá cây. Bạn có thể quan sát phát hiện ở 1000 thế hệ mã thông báo, xem cách phác thảo phá hủy tín hiệu và đo lường tỷ lệ dương tính sai trên văn bản con người.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-provenance-audit.md`. Với việc triển khai nội dung với tuyên bố xuất xứ, nó kiểm toán: cơ chế watermark (nếu có), chuỗi ký kết C2PA (nếu có), độ bền đối kháng của mỗi loại và bảo hiểm theo từng modality.

## Các bài tập

1. Đi chạy`code/main.py`. báo cáo điểm z cho hệ thống 1000 token được đánh dấu bằng nước so với văn bản do con người viết.

2. Thực hiện một cuộc tấn công phrasing thay thế 30% mã thông báo bằng các từ đồng nghĩa.

3. Đọc Kirchenbauer et al. 2023 Phần 6 về độ bền. Tại sao các dấu nước văn bản thất bại trong việc phác thảo nhưng các dấu nước hình ảnh tồn tại khi cắt?

4. Thiết kế một triển khai sử dụng SynthID-text + C2PA metadata. Mô tả chuỗi nguồn gốc mà người tiêu dùng thấy. Xác định một chế độ thất bại của mỗi thành phần.

5. Kết quả 2024 "Signature ổn định không ổn định" cho thấy điều chỉnh tinh tế loại bỏ dấu nước hình ảnh. Thiết kế một điều khiển triển khai hạn chế cuộc tấn công này.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## Đọc thêm

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) cơ chế watermark token
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) hình ảnh giấy watermark
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) cuộc tấn công dỡ bỏ
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) dấu nước hình thái chéo
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) Tiêu chuẩn siêu dữ liệu
