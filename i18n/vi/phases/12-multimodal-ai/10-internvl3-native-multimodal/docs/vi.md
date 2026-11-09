# InternVL3: Đào tạo đa phương pháp bản địa

> Mỗi VLM mở trước InternVL3 đều theo cùng một công thức ba bước: lấy một văn bản LLM được đào tạo trên hàng nghìn tỷ mã thông báo văn bản, bấm vào một bộ mã hóa thị giác, sau đó chỉnh sửa các đường nét. Điều này hoạt động nhưng có nợ sắp xếp  văn bản LLM đã chi tiêu toàn bộ ngân sách trước đào tạo của mình cho văn bản thuần túy và không hiểu bản địa các token hình ảnh. Khi bạn thêm tầm nhìn sau khi làm việc, LLM phải học lại cách liên kết đầu vào trực quan với lý luận văn bản mà không quên văn bản. InternVL3 (Zhu et al., tháng 4 năm 2025) bác bỏ cách tiếp cận sau hoc: một chạy trước khi tập luyện, văn bản và đa phương thức được giao tiếp từ bước một. Kết quả tương ứng với Gemini 2.5 Pro trên MMMU-Pro ở 78B. Bài học này sẽ giải thích về việc đào tạo trước bản địa và những gì thay đổi khi bạn làm điều đó.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## Mục tiêu học tập

- Giải thích lý do tại sao đào tạo VLM sau khi làm việc tích lũy nợ sắp xếp, trích dẫn ba triệu chứng có thể đo lường (ngho quên thảm khốc, biến động trả lời, không phù hợp văn bản hình ảnh).
- Mô tả sự kết hợp cơ bản của InternVL3 và lý do tại sao tỷ lệ văn bản: liên kết: phụ đề quan trọng.
- So sánh V2PE (tạo mã định vị thị giác biến) với M-RoPE của Qwen2-VL.
- Tên của Visual Resolution Router (ViR) và DvD (Discoupled Vision-Language) tối ưu hóa triển khai.

## Vấn đề

Các khóa đào tạo VLM sau đại học là mặc định. LLaVA, BLIP-2, Qwen-VL, Idefics  tất cả đều có một LLM đã được đào tạo trước (Llama, Vicuna, Qwen, Mistral) và thêm thị lực.

1. Frozen LLM + bộ mã hóa tầm nhìn đóng băng + máy chiếu có thể đào tạo, được đào tạo trên các cặp caption để sắp xếp các nhúng.
2. Tháo dỡ LLM, đào tạo về dữ liệu hướng dẫn (LLaVA-Instruct, ShareGPT4V).
3. - Tùy chọn chỉnh sửa kỹ thuật cụ thể cho nhiệm vụ.

Ba triệu chứng của nợ sắp xếp xuất hiện:

- Sự quên lãng thảm khốc, VLM sau khi làm việc quên đi kỹ năng chỉ dùng văn bản, điểm GSM8K giảm 5-10 điểm, điểm Hellaswag giảm, điểm trung tâm văn bản thu hẹp giảm.
- Phản ứng: Phản ứng nhỏ của cùng một câu hỏi trực quan có được câu trả lời khác nhau.
- VLM có thể mô tả một hình ảnh một cách chính xác và sau đó trả lời một câu hỏi mâu thuẫn với mô tả của riêng nó.

Các triệu chứng này được ghi nhận rõ ràng. MM1.5 Phần 4 định lượng chúng. LLaVA-OneVision có những dấu hiệu cho thấy chúng.

## Khái niệm

### Tiền đào tạo đa phương pháp bản địa

InternVL3 đào tạo từ đầu trên một cơ thể là đa phương tiện bản địa từ bước một.

- 40% dữ liệu chỉ có văn bản (FineWeb, Proof-Pile-2, vv)
- 35% dữ liệu hình ảnh-môn văn bản được giao nhau (OBELICS, kiểu MMC4)
- 20% dữ liệu ghi chú hình ảnh kết hợp
- 5% dữ liệu văn bản video

Các token thị giác, token văn bản và tương tác chéo-mô-đal đều tham gia vào sự mất mát tương tự từ bước gradient đầu tiên. Không có sự sắp xếp trước khi tập luyện, không có giai đoạn đóng băng máy chiếu, không có sự quên lãng thảm khốc để phục hồi.

Việc đào tạo là một giai đoạn duy nhất cho mô hình cơ bản.

### V2PE (tạo mã vị trí thị giác biến)

Qwen2-VL sử dụng M-RoPE với phân bổ trục cố định. InternVL3 giới thiệu V2PE: mã hóa vị trí thay đổi theo loại phương thức (tinh văn, hình ảnh, video) với quy mô học tập.

- Các mã thông báo văn bản có vị trí 1D (tín chỉ văn bản).
- Các bản vá hình ảnh có vị trí 2D (trung, col).
- Các khung video có vị trí 3D (giờ, hàng, col).

Ba nhóm này chia sẻ cùng một cơ sở tần số RoPE, nhưng phân bổ độ mờ ẩn trên mỗi băng là một tham số được học chứ không phải là một phân chia cố định.

V2PE tuyên bố của ablation: 1-2 điểm trên video benchmarks so với M-RoPE tại cùng một tính toán.

### Đường dẫn độ phân giải trực quan (ViR)

Tích ứng tối ưu hóa. Không phải tất cả hình ảnh đều cần mã hóa độ phân giải đầy đủ. Một bức ảnh với một đối tượng ở chi tiết thấp lãng phí token khi mã hóa ở 1280px bản địa. ViR là một phân loại nhỏ dự đoán độ phân giải tối thiểu cần thiết để trả lời câu hỏi, trước khi mã hóa.

Các tuyến đường có ba cấp độ: độ phân giải thấp (256 token), trung bình (576), cao (2048+). Đối với 60% truy vấn trong lưu lượng sản xuất, thấp hoặc trung bình là đủ.

### Việc triển khai ngôn ngữ thị giác không kết nối (DvD)

Khi bạn phục vụ một VLM lớn, bộ mã hóa thị giác chạy một lần cho mỗi hình ảnh nhưng LLM chạy theo cách tự động cho mỗi token đầu ra. Hai thành phần có những nút thắt khác nhau (viết = băng thông bộ nhớ GPU cho conv + chú ý; LLM = KV cache). DvD chia chúng thành GPU riêng biệt với lưu lượng giữa.

Đối với mô hình mã hóa 8B + 400M, DvD gần gấp đôi dung lượng mỗi nút so với vị trí cùng.

### Chất lượng một giai đoạn so với nhiều giai đoạn

Đề xuất chuẩn chính của InternVL3: ở 78B Params, phù hợp với MMMU-Pro của Gemini 2.5 Pro. Ở 38B, phù hợp với GPT-4o. Ở 8B, dẫn đầu bảng xếp hạng mở-8B. Tất cả trên một công thức chuẩn bị trước tập luyện + hướng dẫn-đấu hiệu.

Hipoteis nợ phù hợp có thể đo lường: InternVL3-8B mất ít điểm chuẩn văn bản (MMLU, GSM8K) hơn Qwen2.5-VL-7B mỗi đơn vị tăng điểm chuẩn thị giác. Mô hình này là một mô hình tổng quát hơn vì đào tạo là một mảnh, chứ không phải hai.

### InternVL3.5 và InternVL-U

InternVL3.5 (Tháng 8 năm 2025) mở rộng công thức. Cách tiếp cận trước đào tạo bản địa tương tự, nhiều dữ liệu hơn, nhiều param hơn.

InternVL-U (2026) thêm sản xuất hình ảnh  thế hệ thống thông qua đầu MMDiT trên cùng một xương sống. "U" là "Giải quan + thế hệ", theo đuổi các mô hình thống nhất kiểu Transfusion (Dạy 12.13).

### Các sự đổi giá của việc đào tạo trước bản địa

Đào tạo trước bản địa không miễn phí:

- Lập trình tính toán. Việc đào tạo một VLM mới từ đầu có giá tương tự như việc đào tạo một LLM văn bản  triệu giờ GPU.
- Dữ liệu. Các hình ảnh-môn ngữ được giao lưu ở quy mô hiếm. OBELICS là 141M tài liệu; MMC4 là 571M. Chỉ văn bản được gửi đến các token 15T. Sự khan hiếm dữ liệu trước khi đào tạo đa phương tiện là một hạn chế khó khăn.
- Sử dụng lại LM cơ sở. Đào tạo trước bản địa từ bỏ tùy chọn để bỏ vào một LLM mới sau đó.

InternVL3 đặt cược: nợ sắp xếp tệ hơn tổn thất tái sử dụng. Các điểm chuẩn ủng hộ tuyên bố. Chi phí sản xuất ngăn chặn các phòng thí nghiệm tương lai từ sao chép rẻ. VLM sau khi được thực hiện sẽ tiếp tục tồn tại vì chúng vẫn rẻ hơn cho hầu hết các dự án.

```figure
l5-native-pretrain
```

## Sử dụng nó

`code/main.py`là một bộ trộn tập thể và bộ viR.

- Lấy một hỗn hợp corpus mục tiêu (% văn bản, % interleaved, %caption, %video) và tính toán các bước dự kiến theo phương pháp.
- Tái mô ViR định tuyến trên một loạt các truy vấn (cải phân phối: 50% chi tiết thấp, 30% trung bình, 20% chi tiết cao) và báo cáo số lượng token trung bình.
- Báo cáo ước tính thông qua DvD cho mã hóa so với LLM FLOPs.
- Bác tạo ra một bảng xếp hạng của các bài học trước khi làm việc và các bài học trước khi làm việc trong các ngành công nghiệp, tính toán, dữ liệu và các triệu chứng nợ sắp xếp dự kiến.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-native-vs-posthoc-auditor.md`. Với kế hoạch đào tạo VLM được đề xuất, nó kiểm toán xem có nên làm việc bản địa hay sau khi làm việc, đánh dấu rủi ro liên kết nợ và đề nghị một hỗn hợp cơ bản.

## Các bài tập

1. ước tính số lượng điện toán delta giữa InternVL3-8B (đáng tập bản địa) và LLaVA-OneVision-7B (sau hoc).

2. InternVL3 báo cáo 40% văn bản / 35% giao lưu / 20% tiêu đề / 5% video. Nếu nhiệm vụ mục tiêu của bạn là video nặng, đề xuất một tỷ lệ mới và tranh luận tại sao mô hình cơ bản vẫn cần dữ liệu văn bản và tiêu đề đáng kể.

3. Đọc MM1.5 Phần 4 về quên lãng. Hãy nêu tên chỉ số chuẩn xác định nơi đào tạo sau hoc đã cho thấy sự lùi lại lớn nhất.

4. ViR chuyển 60% lưu lượng truy cập sang mã hóa độ phân giải thấp. Quý vị này chuyển hướng sai hướng (đưa đến độ phân giải thấp khi cần độ phân giải cao) cho các chế độ thất bại router ba.

5. DvD chia thị giác và LLM thành GPU riêng biệt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## Đọc thêm

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
