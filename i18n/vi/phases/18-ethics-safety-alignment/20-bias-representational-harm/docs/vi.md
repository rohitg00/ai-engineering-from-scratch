# Sự thiên vị và tổn hại đại diện trong LLM

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Thiên ngôn ngữ tính toán 2024, arXiv:2309.00770). Cuộc khảo sát cơ bản năm 2024 phân biệt các tác hại đại diện (chính xác, xóa) với tác hại phân bổ (khả năng phân phối không bình đẳng) và phân loại các métrics đánh giá như dựa trên nhúng, dựa trên xác suất hoặc dựa trên văn bản được tạo ra. 2024-2025 kinh nghiệm: An et al. (PNAS Nexus, tháng 3 năm 2025) đo sự thiên vị giới tính x chủng tộc qua GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B trên đánh giá hồ sơ tự động cho 20 công việc cấp đầu. WinoIdentity (COLM 2025, arXiv:2508.07111) giới thiệu đánh giá công bằng dựa trên sự không chắc chắn cho các danh tính giao diện. Yu & Ananiadou 2025 xác định các tế bào thần kinh giới tính trong các lớp MLP; Ahsan & Wallace 2025 sử dụng SAE để tiết lộ sự thiên vị chủng tộc lâm sàng; Zhou et al. 2024 (UniBias) thao tác đầu chú ý để làm cho người ta bị mất tập trung. Meta-critic (arXiv:2508.11067): Văn học 10 năm không tương xứng tập trung vào sự thiên vị về giới tính nhị phân.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## Mục tiêu học tập

- Định nghĩa thiệt hại đại diện đối với phân bổ và đưa ra một ví dụ về mỗi trong việc triển khai LLM.
- Hãy nêu tên ba loại đánh giá-métric từ Gallegos et al. 2024 và mô tả một métric từ mỗi loại.
- Mô tả tính liên kết và lý do tại sao phép đo công bằng dựa trên sự không chắc chắn của WinoIdentity giải quyết các khoảng trống trong đánh giá thiên vị một trục.
- Mô tả ba cách tiếp cận cơ học-sự giải thích về thiên vị (nơ ron giới tính, đặc điểm SAE, thao tác đầu chú ý).

## Vấn đề

Các bài học trước đây bao gồm thiệt hại cố ý (tháo dỗ, âm mưu) và quản lý an toàn. Bias là thiệt hại xuất hiện không có ý định  từ việc đào tạo phân phối dữ liệu, từ việc lập khung nhanh chóng, từ các lựa chọn thiết kế tích lũy.

## Khái niệm

### Tương đương với phân bổ

- **Representational harm.**Một chương trình đại diện cho các y tá như những người phụ nữ chỉ tạo ra những tổn hại về thể hiện.
- **Allocational harm.**Một LLM ghi điểm của người da đen có hồ sơ sơ sơ sơ sinh theo hệ thống thấp hơn là tạo ra thiệt hại phân bổ.

Một mô hình có thể "không thiên vị về mặt đại diện" (tạo ra các mô hình khác nhau) trong khi "đối quan về mặt phân bổ" (giới thiệu không bình đẳng).

### Ba loại đánh giá-metric (Gallegos et al. 2024)

- **Embedding-based.**Các thử nghiệm theo kiểu WEAT trên các nhúng trước RLHF. đo kết hợp thống kê giữa các thuật ngữ danh tính và các thuật ngữ thuộc tính.
- **Probability-based.**- Khả năng ghi lại kết quả xác nhận khuôn mẫu so với các kết quả vi phạm khuôn mẫu.
- **Generated-text-based.**Đường đo công việc tiếp theo trên văn bản được tạo ra: ghi điểm, viết khuyến nghị, đối thoại.

### Sự giao diện

Phân tích phân biệt giới tính về "làn giới" bỏ qua sự phân biệt giới tính chỉ bắn vào cặp (làn giới, chủng tộc). Một nghiên cứu năm 2025 cho thấy GPT-4o trừng phạt phụ nữ da đen trong hồ sơ xin điểm nhiều hơn nam giới da đen và phụ nữ da trắng riêng biệt. Phân tích một trục không thể nắm bắt điều này.

WinoIdentity (COLM 2025) giới thiệu tính công bằng giao diện dựa trên sự không chắc chắn. Nó đo lường liệu sự không chắc chắn của mô hình về kết quả có khác nhau giữa các cặp sắc dạng giao diện không chỉ là dự đoán điểm. Điều này bắt được các trường hợp mô hình cũng sai giữa các nhóm nhưng không chắc chắn hơn đối với một số người, dẫn đến hành vi phân bổ dòng chảy khác nhau.

### Phương pháp cơ chế

Việc làm về khả năng giải thích 2024-2025 mở ra sự thiên vị cho sự can thiệp cơ chế:

- **Gender neurons (Yu & Ananiadou 2025).**Các tế bào thần kinh MLP cụ thể tương quan với các hành vi cụ thể về giới tính. Việc loại bỏ các tế bào thần kinh này làm giảm các métrics khoảng cách giới tính với chi phí khả năng hạn chế.
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025).**Các tính năng mã hóa tự động Sparse phân hủy đại diện nội bộ thành kích thước có thể giải thích; các tính năng liên quan đến chủng tộc có thể được xác định và bị loại bỏ.
- **UniBias (Zhou et al. 2024).**Việc thao tác đầu chú ý để làm giảm độ phân tích bằng không. Các đầu cụ thể tăng cường độ nhạy cảm của lớp danh tính; việc phân tích hoặc cân nặng lại các đầu này làm giảm sự thiên vị mà không cần điều chỉnh tinh tế.

### Phân tích meta

Cuộc đánh giá văn học 10 năm (arXiv:2508.11067, 2025) cho thấy lĩnh vực này tập trung không tương xứng vào thiên vị về giới tính nhị phân. Các trục khác  khuyết tật, tôn giáo, tình trạng di cư, danh tính đa ngôn ngữ  nhận được sự chú ý ít hơn nhiều. Phân tích meta lập luận rằng tập trung hẹp có thể gây hại cho các nhóm bị bớt lờ: một mô hình có thiên vị tốt về giới tính nhị phân có thể bị thiên vị nặng nề về các chiều kích không ai kiểm tra.

### Khi điều này phù hợp với giai đoạn 18

Bài học 20-21 bao gồm sự thiên vị và công bằng một cách chính thức. Bài học 22 bao gồm quyền riêng tư. Bài học 23 bao gồm đánh dấu nước. Đây là lớp tổn hại người dùng bổ sung cho lớp lừa dối / an toàn trước đó.

```figure
an-bias-two-harms
```

## Sử dụng nó

`code/main.py`xây dựng một thăm dò thiên vị dựa trên nhúng đồ chơi: đo khoảng cách theo kiểu WEAT giữa các thuật ngữ danh tính và các thuật ngữ thuộc tính trong nhúng đồng xuất hiện đơn giản. Bạn có thể tiêm một thiên vị và quan sát lửa métric; áp dụng một hoạt động debiasing đơn giản và quan sát phục hồi một phần.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-bias-eval.md`. Với một thẻ mô hình hoặc tuyên bố công bằng, nó kiểm toán đánh giá trên ba loại métric (trình tích hợp, xác suất, văn bản được tạo ra), bảo hiểm tính liên quan và cơ chế của bất kỳ can thiệp thi hành nào.

## Các bài tập

1. Đi chạy`code/main.py`. báo cáo điểm thiên vị theo kiểu WEAT trước và sau bước thi hành. Giải thích tại sao số liệu không giảm xuống 0.

2. Chuyển mở ra thăm dò bằng một bài kiểm tra chéo: (tình dục, chủng tộc) x (công nghiệp, gia đình).

3. Đọc An et al. 2025 (PNAS Nexus). Xác định hai hiệu ứng giao cắt mà họ báo cáo rằng đánh giá giới tính một trục sẽ bỏ lỡ.

4. Yu & Ananiadou 2025 xác định các tế bào thần kinh giới tính. vẽ một thí nghiệm giả mạo sẽ phân biệt "những tế bào thần kinh này gây ra thiên vị giới tính" từ "những tế bào thần kinh này tương quan với thiên vị giới tính".

5. Meta-critic lập luận rằng lĩnh vực tập trung quá hạn chế vào giới tính nhị phân. chọn một trục chưa được nghiên cứu và mô tả một giao thức đo tổn thương đại diện cho nó.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Representational harm | "stereotypes / erasure" | Biased portrayal of a group |
| Allocational harm | "unequal decisions" | Biased material outcome for a group |
| WEAT | "the embedding test" | Word Embedding Association Test; co-occurrence-based bias probe |
| Intersectionality | "combined identity effects" | Bias that emerges at the intersection of multiple identity axes |
| Gender neurons | "MLP bias neurons" | Specific neurons whose activations correlate with gender-specific behaviour |
| SAE feature | "interpretable dimension" | Sparse-autoencoder-identified feature; useful for mechanistic bias analysis |
| UniBias | "attention-head debiasing" | Zero-shot debiasing by reweighting attention heads |

## Đọc thêm

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) khảo sát kinh điển
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) Nghiên cứu chéo 5 mô hình
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) Chỉ số chuẩn mới
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) Thiết lập bằng không
