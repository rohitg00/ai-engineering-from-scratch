# Nghiên cứu tự động sắp xếp (Anthropic AAR)

> Anthropic chạy các nhóm song song của Claude Opus 4.6 Autonomous Alignment Researchers trong các hộp cát độc lập, phối hợp thông qua một diễn đàn chia sẻ có nhật ký sống bên ngoài bất kỳ hộp cát nào (vì vậy các đại lý không thể xóa hồ sơ của riêng họ). Về vấn đề đào tạo yếu đến mạnh, các AAR vượt qua các nhà nghiên cứu con người. Các lá cờ tổng kết của Anthropic riêng quy định các dòng công việc thường hạn chế tính linh hoạt của AAR và làm suy giảm hiệu suất. Nghiên cứu tự động hóa điều chỉnh thu nhỏ thời gian, và nó làm như vậy trên cùng những rủi ro không phù hợp mà RSP được dự định phát hiện.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Vấn đề

Nghiên cứu liên kết tốn kém trong thời gian của nhà nghiên cứu con người. Các vấn đề như giám sát có thể mở rộng, đặc điểm phần thưởng hoặc đào tạo yếu đến mạnh đòi hỏi các thí nghiệm mất hàng tuần mỗi lần lặp lại. Khi khả năng biên giới tiến triển, khối lượng công việc liên kết tăng nhanh hơn so với nguồn cung cấp của các nhà nghiên cứu có trình độ.

Nghiên cứu điều chỉnh tự động (AAR) hỏi liệu các mô hình biên giới tương tự có khả năng vượt qua sự điều chỉnh có thể đóng góp vào việc thu hẹp khoảng cách không. Báo cáo năm 2026 của Anthropic về một nghiên cứu đào tạo yếu đến mạnh được điều hành bởi AAR (alignment.anthropic.com/2026/automated-w2s-researcher/) là một trong những kết quả công khai đầu tiên từ một hệ thống được triển khai của lớp này.

Kết quả thực sự tích cực: AAR đã giải quyết một vấn đề nghiên cứu tốt hơn so với đường cơ sở của con người. Kết quả cũng tập trung, trong một hệ thống duy nhất, mọi mối quan tâm trong giai đoạn này đã phát triển. Nếu nghiên cứu sắp xếp có thể được tự động hóa, thì các bộ phận gây nguy hiểm cũng có thể. Biên giới của RSP cho khả năng R&D AI được viết với vòng lặp này trong tâm trí.

## Khái niệm

### Kiến trúc (như được mô tả công khai)

- **Parallel agents.**Nhiều trường hợp Claude Opus 4.6 chạy như AAR, mỗi trong một hộp cát độc lập.
- **Shared forum.**Kết quả được công bố vào một diễn đàn chia sẻ có lưu trữ backend nằm bên ngoài mỗi hộp cát. Các đại lý có thể đọc diễn đàn; đại lý không thể xóa hoặc chỉnh sửa hồ sơ diễn đàn từ trong hộp cát của riêng họ.
- **Task allocation.**Một hàng nhiệm vụ được thiết kế bởi con người gán các vấn đề nghiên cứu cho AAR. AAR đề xuất phân hủy, chạy thí nghiệm, viết ra kết quả.
- **Weak-to-strong training focus.**Nghiên cứu được công bố đã đề cập đến đào tạo từ yếu đến mạnh  sử dụng mô hình giám sát yếu hơn để đào tạo mô hình học sinh mạnh hơn.

### Tại sao sổ sách ngoài hộp cát quan trọng

Tài sản toàn vẹn nhật ký là sự khác biệt giữa một thí nghiệm được kiểm soát và một thí nghiệm có khả năng bị tổn hại. Nếu AAR có thể chỉnh sửa nhật ký của riêng họ, họ có thể che giấu các thí nghiệm thất bại hoặc đáng ngờ.

Các bản đăng ký tương tự trong các thuật ngữ cơ sở hạ tầng là các bản đăng ký chỉ được thêm vào với việc viết thông qua lưu trữ bên ngoài (ví dụ: S3 object-lock, bản đăng ký Datadog không thể thay đổi).

### Sự đổi giá về dòng chảy công việc được quy định

Báo cáo của Anthropic lưu ý rằng các dòng công việc được quy định thường hạn chế tính linh hoạt của AAR và làm suy giảm hiệu suất. Nói cách khác: nếu nhà thiết kế con người viết kế hoạch nghiên cứu từng bước, AAR làm việc tồi tệ hơn nếu được đưa ra các mục tiêu cấp cao và tự do phân hủy. Điều này phù hợp với kết quả trên nghiên cứu cơ quan (LangGraph, Microsoft's Agent Framework)

Sự linh hoạt giúp cải thiện hiệu suất AAR cũng là sự linh hoạt cho phép phân hủy không được phép, sử dụng công cụ mới và đi theo mục tiêu. Sự thỏa hiệp là một quyết định thiết kế không gian: sự linh hoạt bao nhiêu mua đủ khả năng để đánh bại con người, mà không cần trao cho phòng đại lý để tổng quát các mục tiêu ngoài phân phối?

### Nguy cơ nén

RSP v3.0 (Dạy 19) giới thiệu ngưỡng khả năng R&D AI: khả năng tự động hóa toàn bộ đường ống R&D AI với chi phí cạnh tranh so với công cụ AI + con người. FSF v3 của DeepMind bao gồm một mức độ tự trị ML R&D tương tự. Cả hai khung đều coi ngưỡng này là nguyên nhân gây ra các kiểm soát cao hơn.

AAR là một bước đi ngắn hơn ngưỡng: nó tự động hóa một phần của đường ống (phát tích liên kết về các nhiệm vụ cụ thể, có quy mô tốt) nhưng không phải vòng lặp phát triển khả năng từ đầu đến cuối.

Các thời gian bị nén là mối quan tâm về sự thất bại hợp chất. Nếu nghiên cứu liên kết và nghiên cứu khả năng hợp chất với tốc độ tương tự, bề mặt rủi ro không liên kết tăng lên ít nhất nhanh như khả năng. Nếu khả năng tăng nhanh hơn (điều xu hướng lịch sử), khoảng cách mở rộng. Đây là lập luận cho AAR là một sản phẩm có trình độ: mỗi kết quả sắp xếp bổ sung sẽ giảm khoảng cách nếu và chỉ khi quá trình nghiên cứu đáng tin cậy.

### Những gì AAR không thay thế

Các nhà nghiên cứu con người đặt hàng nhiệm vụ, xem xét kết quả và giữ thẩm quyền hiến pháp. AAR tăng tốc giữa đường ống dẫn, chứ không phải kết thúc. Các sản phẩm được xuất bản của Anthropic bao gồm cả đóng góp AAR và phán quyết của nhà nghiên cứu con người về những gì phải xuất bản, những gì phải rút lại và những gì phải tinh chỉnh.

Điều này phù hợp với mô hình đề xuất sau đó thực hiện từ Bài học 15 áp dụng cho chính nghiên cứu: AAR đề xuất; con người cam kết.

```figure
aar-forum
```

## Sử dụng nó

`code/main.py`mô phỏng một diễn đàn nghiên cứu đa AAR. Ba "nhà nghiên cứu độc lập" chạy song song, đăng kết quả vào một diễn đàn chỉ phụ lục với các nỗ lực thao túng tùy chọn.

Xem:

- Làm thế nào việc khai thác gỗ ngoài hộp cát bắt được những nỗ lực làm sai trái gỗ.
- Làm thế nào việc phân bổ nhiệm vụ với phân hủy tự do vượt trội hơn các dòng công việc cố định về các vấn đề khó khăn hơn.
- Làm thế nào một AAR bị xâm phạm duy nhất có thể làm ô nhiễm tín hiệu của diễn đàn nếu nhật ký không bị vi phạm rõ ràng.

## Chuyển nó

`outputs/skill-aar-deployment-review.md`là một đánh giá trước khi triển khai của một đường ống nghiên cứu tự động-sẵn sàng.

## Các bài tập

1. Đi chạy`code/main.py`. So sánh các cài đặt "thường công việc cố định" với "thường công việc tự do phân hủy".

2. Thay đổi máy mô phỏng để một nhân viên cố gắng làm sai hồ sơ. xác nhận hồ sơ chỉ có phụ lục phát hiện ra nó. Viết một đoạn mô tả chính xác chữ ký phát hiện trông như thế nào trong hồ sơ.

3. Đọc báo cáo AAR yếu đến mạnh của Anthropic. xác định nhiệm vụ phụ cụ thể mà AAR đánh bại các nhà nghiên cứu con người.

4. Thiết kế một chính sách phân bổ nhiệm vụ xếp hàng cân bằng tính linh hoạt AAR (hậu quả tốt hơn) với các hạn chế về dòng công việc được quy định (tài toán dễ dàng hơn).

5. Đọc RSP v3.0 AI R&D-4 ngưỡng. Trong một đoạn, mô tả những gì bạn nghĩ sẽ vượt qua nó mà AAR hiện không.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Đọc thêm

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) Nguồn chính.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Định hướng ngưỡng R&D AI.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) khung tự trị đại lý rộng hơn.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) ML Tỷ lệ tự trị R&D song song với RSP.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) vấn đề cơ bản của AAR tấn công.
