# RAG đa phương tiện và thu thập đa phương tiện

> Tài liệu RAG của thị giác là một mảnh. RAG đa phương pháp sản xuất mở rộng hơn  thu thập thông qua văn bản, hình ảnh, âm thanh và video cho các dòng công việc như lập kế hoạch chuyến đi ("đặt cho tôi một bữa ăn uống vegan yên tĩnh với ánh sáng tự nhiên"), phân loại y tế ("những vết thương nào phù hợp với bức ảnh này + những ghi chú này"), thương mại điện tử ("những trang phục tương tự như selfie này, kích thước của tôi"), và dịch vụ thực địa ("chẩn đoán âm thanh động cơ này cộng với ảnh của bộ phận"). Ba cuộc khảo sát năm 2025  Abootorabi et al., Mei et al., Zhao et al.  hợp pháp hóa các phụ vấn đề: thu hồi đa phương thức, hợp nhất thu hồi, hạ tầng sản xuất, đánh giá đa phương thức. Bài học này đọc các cuộc khảo sát và thiết kế một đường ống sản xuất.

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator), TypeScript
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## Mục tiêu học tập

- Thiết kế truy xuất đa phương thức: văn bản → hình ảnh, hình ảnh → văn bản, âm thanh → video, vv
- So sánh ba chiến lược hợp nhất: hợp nhất điểm, hợp nhất dựa trên sự chú ý, hợp nhất MoE.
- Giải thích việc đặt nền thế hệ: "đọc nguồn của bạn" trông như thế nào khi các nguồn là một sự pha trộn của các phương pháp.
- Tên gọi ba cuộc khảo sát RAG đa phương pháp theo quy định năm 2025 và phân loại phân loại phụ của họ.

## Vấn đề

RAG một cách đơn phương là một mô hình được giải quyết: đặt truy vấn, đặt các khối, lấy lại, mọi thứ vào LLM. RAG đa phương pháp đòi hỏi:

1. Nhiều đầu lấy (mỗi phương thức cần được nhúng vào một không gian tương thích).
2. Kết quả thu hồi kết hợp trên các phương pháp.
3. Việc tạo ra đất mà trích dẫn các nguồn qua các phương thức.
4. Các số liệu đánh giá bao gồm tín hiệu qua phương tiện.

Các cuộc khảo sát năm 2025 đều đến với cùng một phân loại.

## Khái niệm

### Khám phá liên hợp

Nhận lại các tài liệu của chế độ B khi đưa ra truy vấn của chế độ A. Ba mô hình:

1. Không gian nhúng chung. CLIP và CLAP tạo ra văn bản + hình ảnh / văn bản + âm thanh nhúng trong không gian chung. Sự tương đồng của cosine trên các phương pháp hoạt động trực tiếp.

2. Bộ mã hóa tính năng tính năng (per-modality encoder + translation). Bộ mã hóa văn bản + bộ mã hóa hình ảnh + mô-đun dịch thuật nhỏ lập bản đồ giữa không gian. Sen2Sen của Gupta et al. và các thiết kế khác năm 2024.

3. VLM làm mã hóa. sử dụng các trạng thái ẩn của VLM như đại diện lấy lại. bất kỳ phương thức nào mà VLM hỗ trợ hoạt động. chất lượng cao hơn, đắt hơn.

Tùy chọn: CLIP / SigLIP 2 cho văn bản + hình ảnh; CLAP cho văn bản + âm thanh; VLM-họa-thường cho cross-modal ở chất lượng biên giới.

### Chiến lược sáp nhập

Bạn đã lấy lại 10 kết quả: 5 hình ảnh, 3 đoạn văn bản, 2 đoạn âm thanh. Làm thế nào để sáp nhập?

Kết hợp điểm số (tô nhất). Mỗi phương thức có bộ thu hồi riêng của mình, mỗi phương thức trả lại điểm số.

Phối hợp dựa trên sự chú ý, kết hợp tất cả các mục được lấy lại, để một mạng lưới chú ý nhỏ cân nặng chúng.

Phối hợp MoE. Gating mạng đường đến các chuyên gia cụ thể về phương pháp. Các loại truy vấn khác nhau đường khác nhau  một câu hỏi trực quan cân nặng hình ảnh cao hơn.

Tiêu chuẩn sản xuất: kết hợp điểm số với một sự thiên vị nhẹ đối với phương thức thống trị của truy vấn. Tăng lên MoE nếu A / B cho thấy chiến thắng rõ ràng trên miền của bạn.

### Địa đất thế hệ

LLM nên nêu ra mục nào được thu hồi đã thúc đẩy mỗi yêu cầu.

- Nguồn văn bản: trích dẫn tiêu chuẩn `[1]`- Tôi không biết.
- Nguồn hình ảnh: `[img 3]`với một đoạn văn ngắn.
- Âm thanh: `[audio 2 at 0:34]`- Tôi không biết.

Trình tạo với dữ liệu có ý thức về nền tảng: mỗi tuyên bố trong mục tiêu đào tạo được dán nhãn với chỉ số nguồn.

### Các cuộc khảo sát năm 2025

Abootorabi et al. (arXiv:2502.08826, "Hãy hỏi trong bất kỳ modality"): phân loại cho RAG đa phương thức. Bao gồm thu hồi, hợp nhất, sản xuất.

Mei et al. (arXiv:2504.08748, "A Survey of Multimodal RAG"): tập trung vào các tiêu chuẩn phụ nhiệm vụ và chế độ thất bại. hữu ích cho thiết kế đánh giá.

Zhao et al. (arXiv:2503.18016): khảo sát tập trung vào tầm nhìn.

Đọc cả ba sẽ cho bạn những thông tin mới nhất vào mùa xuân năm 2025.

### MuRAG  bài báo cơ bản

MuRAG (Chen et al., 2022) là RAG đa phương thức đầu tiên. lấy hình ảnh + văn bản từ KB đa phương thức, tạo ra câu trả lời.

### Ví dụ về kế hoạch hành trình sản xuất

Câu hỏi: "Hãy tìm cho tôi một bữa ăn sáng vegan yên tĩnh với ánh sáng tự nhiên".

Đường ống:

1. Tháo gỡ truy vấn. "quiet" → từ khóa âm thanh / đánh giá; "vegan brunch" → mục menu; "natural light" → tính năng hình ảnh.
2. Thu thập theo phương thức:
   - Tìm kiếm văn bản trong đánh giá: "Bunch vegan, bầu không khí yên tĩnh".
   - Khám ảnh trên ảnh nhà hàng: "Ánh sáng tự nhiên, không khí".
   - Khám phá âm thanh trên các đoạn âm thanh xung quanh: "Nuyết decibel thấp, không có âm nhạc".
3. Mỗi nhà hàng đều có điểm số hỗn hợp.
4. Top-k nhà hàng → VLM máy phát điện với tất cả các bằng chứng → trả lời với trích dẫn.

Điều này vượt xa text-RAG. Mỗi phương thức thêm tín hiệu mà văn bản một mình bỏ lỡ.

### Máy vận hành đa phương tiện RAG

Multi-hop: nếu lần tìm kiếm đầu tiên không trả lời tự tin cao, LLM lại định dạng lại và lấy lại một lần nữa.

- Khôi phục top-10 đầu tiên → LLM yêu cầu "quá tiếng ồn, lọc cho <40 dB" → khôi phục lại.
- Khôi phục hình ảnh → LLM thấy một có một menu → lấy lại văn bản menu → trả lời.

Thêm sự phức tạp nhưng xử lý các truy vấn mà chỉ lấy lại một lần không thể.

### Đánh giá

Việc đánh giá qua phương thức vẫn chưa trưởng thành.

- Recall@k theo từng phương pháp.
- Độ chính xác top-k hợp nhất.
- Sự hài lòng của người.
- Đặc biệt về nhiệm vụ (bản đặt phòng hoàn thành, mua hàng được thực hiện).

Không có điểm chuẩn tiêu chuẩn nào bao gồm tất cả các phương pháp.

```figure
contrastive-matrix
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Ba máy lấy lại giả (text, image, audio) hoạt động trên một tập hợp chung của các nhà hàng.
- Kết hợp điểm số kết hợp điểm số modality với trọng lượng có thể cấu hình.
- Một cái cột máy phát ra câu trả lời cuối cùng với các trích dẫn.
- Một vòng lặp đơn giản của các nhà quản lý để định dạng lại câu hỏi nếu sự tin tưởng thấp.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-multimodal-rag-designer.md`Với một đặc điểm sản phẩm với một dòng truy vấn đa phương thức, thiết kế máy thu hồi, hợp nhất, máy phát và đánh giá.

## Các bài tập

1. đề xuất một RAG đa phương pháp y tế-triage: truy vấn = ảnh chấn thương + triệu chứng văn bản.

2. Phân hợp điểm là một tổng hợp trọng lượng đơn giản.

3. Đọc phân loại của Abootorabi et al. (Bộ 3). Ba phụ vấn đề kinh điển là gì và chúng được định nghĩa như thế nào với sản phẩm bạn chọn?

4. Thiết kế một mô hình đánh giá cho một RAG đa phương thức của máy lập kế hoạch du lịch.

5. Agentic multi-hop RAG có một thuế độ trễ cho mỗi chuyến đi trở lại.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | Text query retrieves images; image query retrieves text; requires a shared space or translator |
| Score fusion | "Combine scores" | Weighted sum of per-modality retrieval scores; simplest fusion |
| MoE fusion | "Modality-routed experts" | Gating network picks which modality's scores to trust per query |
| Grounded generation | "Cite your sources" | Each claim in the answer tagged with the source index |
| MuRAG | "First multimodal RAG" | 2022 paper that established the multimodal RAG pattern |
| Agentic multi-hop | "Reformulate and retry" | LLM re-queries retrievers when first-pass confidence is low |

## Đọc thêm

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
