# ColPali và Vision-Native Document RAG

> RAG truyền thống phân tích các file PDF thành văn bản, chia thành các mảnh, nhúng các mảnh, lưu trữ các vector. Mỗi bước mất tín hiệu: OCR bỏ dữ liệu biểu đồ, chia nhỏ các hàng bảng, nhúng văn bản bỏ qua các số liệu. ColPali (Faysse et al., tháng 7 năm 2024) đặt ra câu hỏi đơn giản hơn: tại sao lại trích xuất văn bản? Nhúng hình ảnh trang trực tiếp thông qua PaliGemma, sử dụng tương tác muộn kiểu ColBERT để lấy lại, và giữ tất cả bố cục, hình ảnh, phông chữ và tín hiệu định dạng tài liệu mang. Các điểm tham khảo được xuất bản: 20-40% độ chính xác đầu đến cuối tốt hơn so với văn bản-RAG trên các tài liệu giàu hình ảnh. ColQwen2, ColSmol và VisRAG đã mở rộng mô hình. Bài học này đọc luận án RAG về thị giác và xây dựng một chỉ số nhỏ giống ColPali.

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer), TypeScript
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## Mục tiêu học tập

- Giải thích sự khác biệt giữa việc lấy lại bộ mã hóa hai (một vector cho mỗi tài liệu) và việc lấy lại tương tác muộn (nhiều vector cho mỗi tài liệu).
- Mô tả hoạt động MaxSim của ColBERT và cách ColPali tổng quát nó từ mã thông báo văn bản đến các bản vá hình ảnh.
- Xây dựng một chỉ mục nhỏ giống ColPali: trang → bản vá nhúng → MaxSim trên các bản nhúng từ truy vấn → top-k trang.
- So sánh ColPali + Qwen2.5VL máy phát điện vs văn bản-RAG + GPT-4 trên một trường hợp sử dụng hóa đơn / báo cáo tài chính.

## Vấn đề

Text-RAG trên PDF ném đi hầu hết tài liệu. Tăng trưởng doanh thu quý 3 của báo cáo tài chính thường là trong biểu đồ; kết quả của báo cáo y tế là trong hình ảnh ghi chú; khối ký kết hợp đồng pháp lý là một thực tế bố trí, không phải là một thực tế văn bản.

Các đường ống văn bản-RAG:

1. PDF → văn bản thông qua OCR / pdftotext.
2. Text → 300-500 token.
3. Chunk → nhúng bộ mã hóa (một vector).
4. User query → embedding → cosine similarity → top-k chunks.
5. Chunks + query → LLM.

5 bước mất tích, các biểu đồ không được ghi lại, bảng bị chia thành từng mảnh, bố cục nhiều cột bị phẳng, ghi chú hình ảnh biến mất.

Giải pháp của ColPali: bỏ qua OCR, nhúng hình ảnh trang trực tiếp. Sử dụng tương tác muộn kiểu ColBERT để lấy lại để mô hình có thể tham gia vào các bản vá hạt mỏng vào thời điểm truy vấn.

## Khái niệm

### Colbert (2020)

ColBERT (Khattab & Zaharia, arXiv:2004.12832) là một phương pháp lấy lại văn bản. Thay vì một vector mỗi tài liệu, nó tạo ra một vector mỗi token.

- Các mã thông báo truy vấn có được các bản nhúng riêng của họ ($N_q$các vector).
- Các token tài liệu nhận được nhúng ($N_d$các vector, thường được lưu trữ trong cache).
- Score = tổng số trên mã thông báo truy vấn tối đa trên mã thông báo có sự tương đồng cosine: $\sum_i \max_j \cos(q_i, d_j)$- Tôi không biết.

Đây là hoạt động MaxSim. Mỗi mã thông báo truy vấn "tác" mã thông báo phù hợp nhất của mình. Điểm cuối cùng là tổng.

Lợi thế: nhớ lại mạnh, xử lý ngữ nghĩa cấp thuật ngữ.$N_d$vector mỗi tài liệu, lưu trữ đắt tiền.

### ColPali

ColPali (Faysse et al., arXiv:2407.01449) áp dụng mô hình ColBERT cho hình ảnh.

- Mỗi trang được mã hóa bởi PaliGemma (ViT + ngôn ngữ) thành các bản cheo: $N_p$vector trên mỗi trang.
- Mỗi truy vấn người dùng (tin nhắn) được mã hóa vào các nội dung mã truy vấn: $N_q$các vector.
- Điểm = $\sum_i \max_j \cos(q_i, p_j)$, tức là, MaxSim trên truy vấn văn bản-chỉ mã và trang-phần-phần-phần.
- Nhận lại các trang top-k theo điểm số tổng.

Vào thời điểm nhập tài liệu: nhúng mỗi trang với PaliGemma, lưu trữ tất cả các bản nhúng vá. Vào thời điểm truy vấn: nhúng các mã thông báo truy vấn, tính toán MaxSim so với tất cả các bản nhúng trang được lưu trữ, trả về các trang top-k.

Lợi thế: kết thúc đến kết thúc vượt qua văn bản-RAG bằng 20-40% trên tài liệu giàu thị giác. Mỗi patch-vector nắm bắt bố cục và nội dung địa phương.

Khối thấu: $N_p$Các bản vá × 4 byte floats × $D$-dim vector per page = lưu trữ tăng nhanh.

### ColQwen2 và ColSmol

ColQwen2 (illuin-tech, 2024-2025) thay đổi PaliGemma với Qwen2-VL. Mã hóa cơ sở tốt hơn, lấy lại tốt hơn.

ColSmol là biến thể quy mô nhỏ hơn cho sử dụng địa phương / cạnh.

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) là một biến thể khác: thay vì MaxSim trên các bản vá, tập hợp mỗi trang thành một vector duy nhất với một VLM sau đó lấy lại bộ mã hóa hai. Chỉ mục nhanh hơn + lưu trữ nhỏ hơn, nhớ lại yếu hơn.

Sự đổi giá về chất lượng: ColPali cho chất lượng, VisRAG cho quy mô.

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) mở rộng tìm kiếm đa phương thức đến lý luận đa tài liệu nhiều trang.

### ViDoRe  chỉ số chuẩn

Định nghĩa chuẩn của ColPali. Đánh giá thu hồi tài liệu trực quan. Các nhiệm vụ bao gồm báo cáo tài chính, bài báo khoa học, tài liệu hành chính, hồ sơ y tế, hướng dẫn.

ColPali-v1 ghi điểm ~ 80% nDCG@5 trên ViDoRe; text-RAG trên các tài liệu tương tự ghi điểm ~ 50-60%.

### Đường ống dẫn RAG đầu đến cuối

Đối với một RAG thị giác:

1. Thêm: PDF → hình ảnh trang → PaliGemma mã hóa → lưu trữ tất cả các bản nhúng vá.
2. Query: User text → embedment query-token → MaxSim đối với tất cả các trang được chỉ mục → top-k pages.
3. Tạo: top-k trang hình ảnh + truy vấn → VLM (Qwen2.5-VL hoặc Claude) → câu trả lời.

Không có OCR ở đâu cả. Hình ảnh, biểu đồ, phông chữ, bố cục đều chảy vào câu trả lời.

### Hóa toán lưu trữ

Một báo cáo tài chính 50 trang với 729 bản vá trên mỗi trang và 128 chiều:

- ColPali: 50 * 729 * 128 * 4 byte = ~ 18 MB nguyên liệu, ~ 2,3 MB sau 8x PQ.
- Text-RAG: 50 mảnh * 768-dim * 4 byte = ~ 150 kB.

ColPali là ~ 120x lưu trữ nhiều hơn cho mỗi tài liệu nguyên liệu. Ở quy mô, 8x OPQ / PQ làm giảm nó xuống còn ~ 15x, thường dung nạp.

### Khi text-RAG vẫn thắng

- Tài liệu văn bản thuần túy không có tín hiệu bố trí (thương tự wiki, nhật ký trò chuyện). Text-RAG đơn giản hơn và lưu trữ rẻ hơn.
- Các hồ sơ hàng triệu trang nơi lưu trữ chiếm ưu thế về chi phí.
- Các yêu cầu quy định nghiêm ngặt đòi hỏi văn bản OCR có thể thu được bên cạnh việc lấy lại.

Đối với tất cả mọi thứ khác vào năm 2026  báo cáo tài chính, bài báo khoa học, hợp đồng pháp lý, hồ sơ y tế, tài liệu UX  RAG vision-native thắng.

```figure
mm-maxsim
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Mã hóa đệm đồ chơi: lập bản đồ một "trần" (trung nhỏ các vector tính năng) cho một loạt các bản nhúng đệm.
- Máy ghi điểm MaxSim: tính toán điểm số theo kiểu ColBERT giữa một bộ tích hợp mã thông báo truy vấn và một bộ vá trang.
- Chỉ số 5 trang đồ chơi, chạy 3 truy vấn, trả lại top-k với điểm số.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-vision-rag-designer.md`Với dự án tài liệu-RAG, chọn ColPali / ColQwen2 / VisRAG / text-RAG và kích thước lưu trữ.

## Các bài tập

1. Một báo cáo hàng năm 200 trang với 729 bản vá trên mỗi trang, 128-dimen emb, floats 4 byte.

2. MaxSim là $\sum_i \max_j \cos(q_i, p_j)$Số lượng này nắm bắt được gì mà một sự tương đồng đơn giản không thể?

3. ColPali chỉ mục các trang như bộ vá. Những thay đổi gì nếu chúng ta chỉ mục ở mức từ (như ColBERT làm)?

4. Thiết kế đường ống cuối đến cuối cho một cơ thể 1M trang với ngân sách thời gian trễ 500ms mỗi truy vấn. Chọn ColQwen2 / VisRAG và biện minh.

5. Đọc M3DocRAG (arXiv:2411.04952). Mô tả mô hình chú ý nhiều trang và cách nó khác với việc lấy lại ColPali một trang.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Retrieval using per-token or per-patch embeddings + MaxSim, not a single doc vector |
| MaxSim | "Max-over-patches" | For each query token, pick the highest-similarity document token; sum across query |
| Bi-encoder | "Single-vector" | One vector per document; faster but loses granularity |
| Multi-vector | "Many-vectors-per-doc" | Store $N_p$ vectors per document / page; storage cost grows but recall improves |
| Patch embedding | "Page feature" | One vector per image patch from a VLM encoder, cached per page |
| ViDoRe | "Vision doc bench" | ColPali's benchmark suite for visual document retrieval |
| PQ quantization | "Product quantization" | Compression that maintains vector similarity while shrinking storage ~8x |

## Đọc thêm

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
