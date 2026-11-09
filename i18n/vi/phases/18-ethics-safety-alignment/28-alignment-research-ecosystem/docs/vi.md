# Hệ sinh thái nghiên cứu phù hợp MATS, Redwood, Apollo, METR

> Năm tổ chức xác định lớp nghiên cứu không phải trong phòng thí nghiệm năm 2026. MATS (ML Alignment & Theory Scholars): 527+ nhà nghiên cứu kể từ cuối năm 2021, 180+ bài báo, 10K+ trích dẫn, h-index 47; mùa hè 2024 nhóm được thành lập như 501 ((c) ((3) với ~ 90 học giả và 40 cố vấn; 80% cựu sinh viên trước năm 2025 làm việc về an toàn / an ninh với 200+ tại Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo. Nghiên cứu Redwood: phòng thí nghiệm sắp xếp ứng dụng được thành lập bởi Buck Shlegeris; giới thiệu AI Control (Lớp học 10); hợp tác với AISI Anh về các trường hợp an toàn kiểm soát. Nghiên cứu Apollo: đánh giá kế hoạch trước khi triển khai cho các phòng thí nghiệm biên giới; tác giả của In-Context Scheming (Dạy 8) và Towards Safety Cases for AI Scheming. METR (Model Evaluation and Threat Research): đánh giá khả năng dựa trên nhiệm vụ, nghiên cứu về khung thời gian nhiệm vụ tự trị; "Thông tố chung của các chính sách an toàn AI biên giới" so sánh các khung thí nghiệm. Eleos AI Research: đánh giá trước khi triển khai mô hình phúc lợi (Dạy học 19); tiến hành đánh giá phúc lợi của Claude Opus 4.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Mục tiêu học tập

- Xác định năm tổ chức của hệ sinh thái nghiên cứu không phải trong phòng thí nghiệm và sản lượng cốt lõi của chúng.
- Mô tả quy mô của MATS (những học giả, bài báo, chỉ số h) và vai trò của nó như một đường ống tài năng.
- Mô tả chương trình nghị sự kiểm soát AI của Redwood và quan hệ đối tác của nó với AISI của Anh.
- Mô tả phương pháp đánh giá dựa trên nhiệm vụ của METR.

## Vấn đề

Các phòng thí nghiệm biên giới (Học 18) sản xuất đánh giá an toàn nội bộ và xuất bản kết quả được chọn. Hệ sinh thái bên ngoài phòng thí nghiệm là nơi đánh giá được xác nhận, nơi các chế độ thất bại mới được phát hiện lần đầu tiên, và nơi đào tạo tài năng. Hiểu hệ sinh thái giúp giải thích những phát hiện nghiên cứu nào được tin cậy bởi ai.

## Khái niệm

### MATS (ML Alignment & Theory Scholars)

Bắt đầu vào cuối năm 2021. Chương trình hướng dẫn nghiên cứu; các học giả dành 10-12 tuần với một nhà nghiên cứu cấp cao về một vấn đề sắp xếp cụ thể.

Scale (2026):
- 527+ nhà nghiên cứu kể từ khi thành lập.
- 180+ bài báo được xuất bản.
- 10K + trích dẫn.
- H-index 47.
- Mùa hè 2024: 90 học giả + 40 cố vấn; được thành lập như là 501 ((c) ((3).

Kết quả nghề nghiệp: ~ 80% cựu sinh viên trước năm 2025 đang làm việc về an toàn / an ninh. 200+ tại Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo.

### Nghiên cứu gỗ đỏ

Phòng thí nghiệm sắp xếp ứng dụng. Được thành lập bởi Buck Shlegeris. Ông giới thiệu chương trình nghị sự kiểm soát AI (Dạy 10) hợp tác với AISI của Anh về các trường hợp an toàn kiểm soát. Ông tư vấn cho DeepMind và Anthropic về thiết kế đánh giá.

Các bài báo Canonical: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Alignment Faking (Greenblatt, Denison, Wright et al., arXiv:2412.14093, chung với Anthropic).

Thiết kế: mô hình đe dọa cụ thể, đối thủ tồi tệ nhất, các giao thức cụ thể có thể được kiểm tra bằng căng thẳng.

### Nghiên cứu Apollo

Đánh giá kế hoạch trước khi triển khai cho các phòng thí nghiệm biên giới. Tác giả In-Context Scheming (Lớp 8, arXiv:2412.04984). Đối tác về sự hợp tác đào tạo chống kế hoạch OpenAI năm 2025.

Thiết kế: đánh giá thiết lập cơ quan nơi có thể xuất hiện lừa đảo; phân hủy ba trụ (không phù hợp, hướng mục tiêu, nhận thức tình huống).

### METR (Phân tích đánh giá mô hình và nghiên cứu về mối đe dọa)

Đánh giá khả năng dựa trên nhiệm vụ. Nghiên cứu thời gian hoàn thành nhiệm vụ tự trị. "Các yếu tố chung của Chính sách an toàn AI biên giới" (metr.org/common-elements, 2025) so sánh các khung thí nghiệm.

Đồng tác giả của bản phác thảo trường hợp an toàn với Apollo.

Thiết kế: đánh giá nhiệm vụ theo đường chân trời dài, đo khả năng thực nghiệm, tổng hợp khung.

### Eleos AI Research

Các mô hình đánh giá phúc lợi trước khi triển khai. thực hiện đánh giá phúc lợi Claude Opus 4 được ghi lại trong phần 5.3 của thẻ hệ thống. cung cấp kiểm tra phương pháp bên ngoài cho các tuyên bố liên quan đến phúc lợi trong Bài 19.

### Dòng chảy

MATS đào tạo các nhà nghiên cứu. Sinh viên tốt nghiệp đi đến Anthropic, DeepMind, OpenAI (nhóm an toàn phòng thí nghiệm) hoặc đến Redwood, Apollo, METR, Eleos (học định bên ngoài). Các nhà đánh giá bên ngoài hợp tác với các phòng thí nghiệm và với AISI / CAISI của Anh. Các ấn phẩm cung cấp hệ sinh thái trở lại MATS cho nhóm tiếp theo.

### Tại sao lớp này quan trọng

Các đánh giá từ một nguồn không đáng tin cậy: các phòng thí nghiệm đánh giá các mô hình của riêng họ có một xung đột lợi ích cấu trúc. Các nhà đánh giá bên ngoài có thể nâng cao và xác nhận các chế độ thất bại mà phòng thí nghiệm có thể báo cáo thấp. Bài báo của 2024 Sleeper Agents (Lớp 7) là Anthropic + Redwood; Alignment Faking là Anthropic + Redwood; In-Context Scheming là Apollo; Anti-Scheming là Apollo + OpenAI. Cơ cấu đa cơ quan là kiểm soát chất lượng.

### Khi điều này phù hợp với giai đoạn 18

Bài học 7-11 đề cập đến công việc Redwood và Apollo; Bài học 18 đề cập đến so sánh khung METR; Bài học 19 đề cập đến Eleos. Bài học 28 là bản đồ tổ chức rõ ràng cho hệ sinh thái mà phần còn lại của giai đoạn dựa trên.

```figure
sae-features
```

## Sử dụng nó

Không có mã. Đọc "Các yếu tố chung của các chính sách an toàn AI biên giới" của METR như một ví dụ về cách tổng hợp bên ngoài thêm giá trị vào công việc chính sách nội bộ trong phòng thí nghiệm.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-ecosystem-map.md`. Với yêu cầu hoặc đánh giá về sự phù hợp, nó xác định tổ chức, địa điểm xuất bản, phong cách phương pháp và kiểm tra chéo đối với các tổ chức đối tác được biết đến.

## Các bài tập

1. Chọn một bài báo từ Bài học 7-15 và xác định các tổ chức liên quan.

2. Đọc "Các yếu tố chung của các chính sách an toàn AI biên giới" của METR.

3. Kết quả nghề nghiệp MATS là ~ 80% an toàn / an toàn. tranh luận liệu áp lực lựa chọn này có thích ứng (đào tạo lĩnh vực) hoặc thiên vị (đánh lọc các vị trí không chính xác).

4. Redwood và Apollo đều làm việc kiểm soát / kế hoạch nhưng với phong cách khác nhau. chọn một chế độ thất bại và mô tả cách mỗi người sẽ điều tra nó.

5. Eleos AI là tổ chức phúc lợi mô hình thuần túy duy nhất. Thiết kế một tổ chức thứ hai giả thuyết tập trung vào một câu hỏi phúc lợi khác nhau (tự do nhận thức, thể hiện robot, vv) và diễn tả phương pháp của nó.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Đọc thêm

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) chương trình dạy dỗ
- [Redwood Research](https://www.redwoodresearch.org/) AI Control Paper
- [Apollo Research](https://www.apolloresearch.ai/) đánh giá kế hoạch
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) So sánh khung
- [Eleos AI Research](https://www.eleosai.org/research) Mô hình phương pháp phúc lợi
