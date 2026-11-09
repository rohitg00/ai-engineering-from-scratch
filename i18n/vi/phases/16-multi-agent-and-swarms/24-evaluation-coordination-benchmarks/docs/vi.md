# Các tiêu chuẩn đánh giá và phối hợp

> Năm tiêu chuẩn 2025-2026 bao gồm không gian đánh giá đa đại lý. **MultiAgentBench / MARBLE**(ACL 2025, arXiv:2503.01935) đánh giá các topology sao/ chuỗi/ cây/ biểu đồ với KPI thành tích; **graph is best for research**, lập kế hoạch nhận thức thêm ~ 3% thành tích miêu cột mốc. **COMMA**đánh giá phối hợp thông tin không đối xứng đa phương thức; các mô hình hiện đại bao gồm GPT-4o đấu tranh để vượt qua một đường cơ sở ngẫu nhiên. **MedAgentBoard**(arXiv:2505.12371) bao gồm bốn loại nhiệm vụ y tế và thường thấy đa tác nhân không thống trị một LLM. **AgentArch**(arXiv:2509.10769) đánh giá kiến trúc đại lý doanh nghiệp kết hợp sử dụng công cụ + bộ nhớ + dàn xếp. **SWE-bench Pro**([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)(văn khoái) có 1865 vấn đề trên 41 repos bao gồm các ứng dụng kinh doanh, dịch vụ B2B và công cụ phát triển; các mô hình biên giới đạt điểm ~23% trên Pro vs 70% + trên Verified.**64.3%**về Pro với sự phối hợp rõ ràng giữa các nhóm đại lý (không có nguồn chính Anthropic được công bố chưa  xử lý như là sơ bộ); Verdent (chế trình đại lý) hits **76.1% pass@1**về Verified ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report) ).**AAAI 2026 Bridge Program WMAC**(https://multiagents.org/2026/Bài học này dựa trên các số liệu của MARBLE, chạy một cuộc quét topology-vs-metric, và pin quy tắc "chỉ qua SWE-bench Verified không bằng chứng về tổng quát".

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## Vấn đề

Khi một bài báo tuyên bố "hệ thống đa đại lý của chúng tôi tốt hơn", câu hỏi là: tốt hơn gì, trên gì, được đo bằng cách nào? Thời đại đánh giá đa đại lý 2023-2024 là hỗn loạn  mọi người đã chọn métrics riêng của họ, đường cơ sở riêng của họ, và các tập hợp nhiệm vụ riêng của họ. Các tiêu chuẩn 2025-2026 áp đặt cấu trúc.

Nếu không có tiêu chuẩn chung, bạn không thể so sánh hai hệ thống đa đại lý một cách có ý nghĩa. tệ hơn, nếu không có tiêu chuẩn kéo dài, các mô hình biên giới có thể gây ô nhiễm. SWE-bench Verified bị ô nhiễm một phần trong các cơ quan đào tạo vào giữa năm 2025; điểm số biên giới tăng cao; Pro được thiết kế như một kiểm tra thực tế không ô nhiễm.

Bài học này liệt kê năm tiêu chuẩn chuẩn của 2026, nêu tên những gì mỗi tiêu chuẩn đo lường, và dạy bạn đọc các tuyên bố tiêu chuẩn một cách hoài nghi.

## Khái niệm

### MultiAgentBench (MARBLE)  ACL 2025

ArXiv:2503.01935. đánh giá bốn topology phối hợp (những ngôi sao, chuỗi, cây, biểu đồ) về các nhiệm vụ nghiên cứu, lập trình và lập kế hoạch.

Kết quả đo lường:

- **Graph**Topology tốt nhất cho các kịch bản nghiên cứu; hỗ trợ bất kỳ sự chỉ trích nào.
- **Chain**tốt nhất cho việc mã hóa tinh chế từng bước.
- **Star**tốt nhất cho việc hợp nhất thực tế nhanh chóng.
- **Coordination tax**xuất hiện qua ~ 4 đại lý trên biểu đồ.
- **Cognitive planning**thêm ~ 3% thành công thành công trong các topology.

Sử dụng khi: bạn muốn so sánh các topology phối hợp từ táo đến táo.https://github.com/ulab-uiuc/MARBLE) cung cấp cho người đánh giá.

### COMMA  thông tin đa phương thức không đối xứng

Bao gồm các nhiệm vụ mà các nhân viên có các phương thức quan sát khác nhau và phải phối hợp mà không chia sẻ thông tin đầy đủ.**random baseline**về hợp tác giữa đại lý và đại lý trong COMMA. tín hiệu là các phương pháp đa đại lý không được đào tạo và đánh giá thấp  LLM xử lý hợp lý hợp tác một phương pháp; phối hợp đa phương pháp sụp đổ.

Sử dụng khi: hệ thống của bạn có phối hợp thông tin đa phương thức hoặc không đối xứng. Kết quả không có giá trị từ COMMA là một cảnh báo để đo trước khi yêu cầu.

### MedAgentBoard  kiểm tra căng thẳng miền

ArXiv:2505.12371. Bốn loại nhiệm vụ y tế: chẩn đoán, lập kế hoạch điều trị, tạo báo cáo, giao tiếp với bệnh nhân. So sánh hệ thống dựa trên quy tắc đa tác nhân vs LLM đơn.

Tìm thấy: đa đại lý KHÔNG thống trị LLM đơn trên hầu hết các loại. Lợi thế đa đại lý là hẹp  phân hủy nhiệm vụ giúp khi các nhiệm vụ phụ có thể tách ra rõ ràng (chẩn đoán + điều trị); nó làm tổn thương khi chi phí phối hợp vượt quá lợi nhuận chuyên môn (tạo báo cáo).

Sử dụng khi nào: miền của bạn có đường cơ sở đơn-LLM rõ ràng. Nếu bài học của MedAgentBoard nói chung, nhiều hệ thống đa đại lý được đề xuất là quá kỹ thuật.

### AgentArch  kiến trúc doanh nghiệp

ArXiv:2509.10769. cài đặt doanh nghiệp với việc sử dụng công cụ, bộ nhớ và dàn xếp cùng nhau. Benchmark cô lập sự đóng góp của mỗi lớp: thêm công cụ giúp ích bao nhiêu? thêm bộ nhớ? thêm dàn xếp đa đại lý?

Sử dụng khi: bạn đang thiết kế một hàng đại lý doanh nghiệp và cần phải biện minh cho mỗi lớp. AgentArch giúp tránh mua các tính năng mà bạn không thể đo giá trị.

### SWE-bench Pro  kiểm tra thực tế

1865 vấn đề trên 41 kho chứa bao gồm các ứng dụng kinh doanh, dịch vụ B2B và các công cụ phát triển.**uncontaminated**với thời gian training cutoff sau đó. các mẫu Frontier đạt điểm ~23% trên Pro vs 70%+ trên Verified.

Điểm điểm tháng 4 năm 2026:
- Claude Opus 4.7 trên Pro: **64.3%**(được báo cáo với sự phối hợp rõ ràng giữa các nhóm đại lý; chưa có nguồn chính Anthropic được công bố).
- Verdent (đầu cơ nhân) trên Verified: **76.1% pass@1**([technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)().
- Điểm số thô biên giới trên Pro mà không có trình trình bày đại lý: ~ 23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941)().

Điểm cuối cùng: "chúng tôi đã đánh bại SWE-bench Verified" không còn là bằng chứng về khả năng. Pro là thử nghiệm gài hiện tại.

### AAAI 2026 WMAC

Chương trình cầu AAAI 2026  Hội thảo về phối hợp đa đại lý (https://multiagents.org/2026/Các bài báo được chấp nhận và các cuộc thảo luận tại hội thảo là nơi có thể được đánh giá các phương pháp mới; hãy bỏ lại các tuyên bố được WMAC chấp nhận về các bản in trước của arXiv cho các quyết định sản xuất.

### Đọc các yêu cầu chuẩn theo cách hoài nghi  danh sách kiểm tra năm 2026

Khi ai đó yêu cầu kết quả đa đại lý:

1. **Which benchmark, which split?**SWE-bench Verified vs Pro quan trọng rất nhiều.
2. **Contamination check.**Liệu chỉ số chuẩn đã được phát hành sau khi mẫu xe bị cắt giảm tập luyện?
3. **Baseline comparison.**Vâng cơ sở của một LLM, vâng ngẫu nhiên, vâng trước đây của nhiều đại lý làm việc.
4. **Statistical significance.**N thử nghiệm, p-đáng giá, confidence interval.
5. **Task diversity.**Một nhiệm vụ hay nhiều?
6. **Cost disclosure.**Địa chỉ cho mỗi nhiệm vụ, đồng hồ tường. Một giải pháp 90% với chi phí 20 lần là một quyết định kinh doanh, không phải là yêu cầu khả năng.

### Những gì không có một chỉ số chuẩn nào đo tốt

- **Long-horizon coordination.**Những ngày liên lạc với đồng hồ tường, tất cả các tiêu chuẩn hiện tại đều thiếu.
- **Adversarial resilience.**Điều gì xảy ra khi một nhân viên có ý xấu hay bị xâm phạm?
- **Drift under deployment.**Các điểm chuẩn là tĩnh; phân phối sản xuất thay đổi.
- **Cost-normalized performance.**Hầu hết các chỉ số chuẩn báo cáo chính xác nguyên liệu, không phải chính xác trên mỗi đô la.

Xây dựng điểm chuẩn nội bộ của riêng bạn cho trục bạn thực sự quan tâm thường là động thái đúng đắn.

```figure
a5-bench-gap
```

## Hãy xây dựng nó

`code/main.py`là một bước đi không tương tác:

- Mô phỏng 3 hệ thống đa đại lý trên một nhiệm vụ đồ chơi.
- Xét số liệu bước ngoặt kiểu MARBLE cho mỗi người.
- Thực hiện kiểm tra ô nhiễm bằng cách giữ lại các nhiệm vụ từ một bộ "trình huấn luyện".
- So sánh với một đường cơ sở ngẫu nhiên rõ ràng.
- Bác in một thẻ điểm của các yêu cầu chuẩn.

Đi chạy:

```bash
python3 code/main.py
npx tsx code/main.ts
```

Kết quả dự kiến: bảng điểm hệ thống với độ chính xác nguyên liệu, thành tựu thành công, chi phí cho mỗi nhiệm vụ, đối với delta đường cơ sở ngẫu nhiên, và một ghi chú kiểm tra ô nhiễm.

## Sử dụng nó

`outputs/skill-benchmark-reader.md`đọc bất kỳ yêu cầu tham chiếu đa đại lý nào và áp dụng danh sách kiểm tra kiểm tra.

## Chuyển nó

Phân tích đánh giá sản xuất:

- **Build an internal benchmark**Các chỉ số chuẩn công cộng thông báo nhưng không thay thế.
- **Include a random baseline**Nếu bạn không thể đánh bại ngẫu nhiên bằng một khoảng cách lớn trong một nhiệm vụ phối hợp, nhiệm vụ có thể bị đặt sai.
- **Report cost alongside accuracy.**Chi phí token và đồng hồ tường.
- **Rebuild the benchmark quarterly.**Sự thay đổi phân phối sản xuất; các chỉ số chuẩn cũ sai lầm.
- **Avoid published-benchmark overfitting.**Nếu nhóm của bạn đang tối ưu hóa đặc biệt cho số SWE-bench Pro, bạn sẽ lùi lại sản xuất.

## Các bài tập

1. Đi chạy`code/main.py`- xác định hệ thống mô phỏng ba có chi phí cho mỗi bước quan trọng tốt nhất.
2. Đọc MultiAgentBench (arXiv:2503.01935). Đối với lĩnh vực nhiệm vụ của riêng bạn, hãy quyết định mà trong bốn topology MARBLE sẽ khuyến nghị.
3. Hãy đọc bài báo SWE-bench Pro. Điều gì đặc biệt làm cho nó chống ô nhiễm?
4. Đọc kết quả của COMMA về phối hợp đa phương thức. Thiết kế một nhiệm vụ phối hợp đa phương thức đơn giản mà bạn có thể thêm vào điểm tham khảo nội bộ của bạn.
5. Lấy danh sách kiểm tra các yêu cầu chuẩn cho một kết quả tiêu đề của một bài báo đa đại lý gần đây. Bạn sẽ đánh giá yêu cầu như thế nào?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## Đọc thêm

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) Chỉ số chuẩn topology với KPI milestone
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) Thực hiện tham chiếu
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) kiểm tra căng thẳng miền; đa tác nhân thường không thống trị
- [AgentArch](https://arxiv.org/abs/2509.10769) Các kiến trúc đại lý doanh nghiệp
- [SWE-bench leaderboards](https://www.swebench.com/) Điểm kiểm tra và điểm số Pro cho các mô hình biên giới
- [AAAI 2026 WMAC](https://multiagents.org/2026/) điểm trung tâm cộng đồng năm 2026
