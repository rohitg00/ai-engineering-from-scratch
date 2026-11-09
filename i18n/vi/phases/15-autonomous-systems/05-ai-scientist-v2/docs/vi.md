# Nhà khoa học AI v2  Nghiên cứu tự trị cấp workshop

> Nhà khoa học AI của Sakana v2 (Yamada et al., arXiv:2504.08066) chạy vòng lặp nghiên cứu đầy đủ: giả thuyết, mã, thí nghiệm, số liệu, viết, nộp. Đây là hệ thống đầu tiên có đánh giá đồng nghiệp được tạo ra trên giấy qua tại một hội thảo ICLR 2025. Đánh giá độc lập (Beel et al.) cho thấy 42% thí nghiệm thất bại từ lỗi mã hóa và đánh giá văn học thường đánh giá sai các khái niệm được thiết lập là mới. Các bác sĩ của Sakana cảnh báo rằng hệ thống mã hóa thực hiện mã LLM và khuyên nên cô lập Docker. Cả hai nửa của bức tranh là điểm.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Vấn đề

Nghiên cứu là một nhiệm vụ mở. Không giống như tìm kiếm thuật toán của AlphaEvolve hoặc tự sửa đổi giới hạn của DGM, kết quả nghiên cứu không có tiêu chí chính xác có thể kiểm tra bằng máy. Một bài báo được đánh giá bởi các nhà đánh giá, chứ không phải là các thử nghiệm đơn vị. Điều đó làm cho vòng lặp khó khăn hơn để đóng  và có giá trị hơn nếu đóng, bởi vì nghiên cứu là nơi tiến bộ hợp chất sống.

AI Scientist v1 (Sakana, 2024) đã đóng vòng lặp bằng cách bắt đầu từ các mẫu do con người viết. LLM đã thực hiện các thí nghiệm trong một nền cố định. AI Scientist v2 (Yamada et al., 2025) loại bỏ yêu cầu mẫu bằng cách sử dụng tìm kiếm cây nhân viên với vòng lặp phê bình mô hình ngôn ngữ thị giác. Hệ thống tạo ra ý tưởng, thực hiện thí nghiệm, tạo ra số liệu, viết bài báo và lặp lại phản hồi của nhà phê bình.

Phán quyết đánh giá đồng nghiệp: một bài báo được tạo ra bởi v2 đã được chấp nhận tại một hội thảo ICLR 2025 (với tiết lộ). Phán quyết đánh giá độc lập: hệ thống này không đáng tin cậy. Cả hai đều đúng.

## Khái niệm

### Kiến trúc

1. **Idea generation.**LLM đề xuất ý tưởng nghiên cứu được điều chỉnh trên một chủ đề và văn học trước đó. v1 sử dụng mẫu; v2 sử dụng tìm kiếm cơ quan trên một không gian giả thuyết.
2. **Novelty check.**Một bước tìm kiếm văn học kiểm tra xem ý tưởng đã được xuất bản hay không. Đây là bước mà đánh giá của Beel et al. đã tìm thấy nhãn sai  các phương pháp được thiết lập thường được phân loại là mới.
3. **Experiment plan.**Đặc vụ đã thiết kế một quy định thí nghiệm và viết mã.
4. **Execution.**Mã chạy trong một hộp cát. Các lỗi được đưa lại vào vòng lặp thử lại. Trong các phép đo của Beel et al., 42% thí nghiệm thất bại vì lỗi mã hóa ở giai đoạn này.
5. **Figure generation.**Một mô hình ngôn ngữ thị giác đọc các con số được tạo ra và viết lại chúng để rõ ràng hơn. Đây là sự bổ sung kỹ thuật chính của v2.
6. **Writeup.**LLM soạn thảo một bài báo, lặp lại với một nhà phê bình nội bộ.
7. **Optional: submission.**Bài báo được gửi đến một địa điểm.

### Kết quả chấp nhận hội thảo có nghĩa là gì

Một bài báo được tạo ra bởi v2 đã vượt qua đánh giá của các đồng nghiệp tại một hội thảo ICLR 2025. Các tác giả tiết lộ nguồn gốc của bài báo cho ủy ban chương trình. Việc chấp nhận là một điểm dữ liệu; đó không phải là giấy phép để tuyên bố hệ thống "phát nghiên cứu".

Tầm quan trọng: các bài báo hội thảo là một thanh thấp hơn so với các bài báo hội nghị chính. Tin xét của các đồng nghiệp là tiếng ồn; một phần nhỏ của các bài đăng được chấp nhận vào một ngày nào đó. Một thành công là một bằng chứng về khái niệm, không phải là một tuyên bố độ tin cậy. Bài báo Nature 2026 ghi lại vòng lặp cuối đến cuối và chính nó được đồng tác giả bởi các nhà nghiên cứu con người; nó không phải là "hệ thống đã viết một bài báo Nature".

### Những gì được đánh giá độc lập cho thấy

Beel et al. (arXiv:2502.14297) đã tiến hành một đánh giá bên ngoài.

- **Experiment failures.**42% thí nghiệm thất bại vì lỗi mã hóa (thu nhập sai, không phù hợp hình dạng, biến không xác định).
- **Novelty mislabeling.**Bước tìm lại văn học thường đánh dấu các khái niệm đã được thiết lập là mới mẻ.
- **Presentation-quality gap.**Việc phê bình hình ảnh ngôn ngữ thị giác đã tạo ra hình ảnh cấp ấn phẩm, che giấu những điểm yếu thử nghiệm cơ bản.

Một hệ thống tạo ra kết quả thuyết phục mà không thực hiện nghiên cứu thuyết phục là nguy hiểm hơn, không an toàn hơn, so với một hệ thống thất bại rõ ràng.

### Vấn đề trốn thoát hộp cát

Đồ lưu trữ của Sakana README cảnh báo:

> Do tính chất của phần mềm này, mà thực hiện mã được tạo bởi LLM, chúng tôi không thể đảm bảo an toàn. Có những rủi ro của các gói nguy hiểm, truy cập web không kiểm soát, và sinh ra các quy trình không mong muốn. Sử dụng với rủi ro của riêng bạn và xem xét cách ly Docker.

Đây là hình thức hoạt động của tự trị trong một miền không được xác minh. LLM viết mã; mã chạy; mã có thể làm bất cứ điều gì mà quá trình được phép làm. Không có hộp cát hạn chế các hệ thống tập tin, mạng và hành động quy trình, bất kỳ đại lý nghiên cứu tự hướng nào có thể lọc dữ liệu, đốt tính toán hoặc tự viết lại.

Câu chuyện sandbox của AlphaEvolve dễ dàng hơn vì đánh giá của nó chặt chẽ. Loop của AI Scientist v2 chạy mã mở với mục tiêu mở. Đó là lý do tại sao nó cần sự cô lập mạnh mẽ hơn (Docker tối thiểu; seccomp / gVisor được ưa thích) và một đánh giá thủ công của mỗi bài đăng trước khi rời khỏi hệ thống.

### Khi v2 nằm trong hàng biên giới

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

V2 có trình đánh giá tự động yếu nhất trong ba, bề mặt đầu ra rộng nhất và con đường ngắn nhất đến các hiện vật công cộng.

```figure
mx-research-loop
```

## Sử dụng nó

`code/main.py`mô phỏng vòng v2 như một máy trạng thái: ý tưởng → kiểm tra tính mới → thí nghiệm → hình thức → viết lên → đánh giá → chấp nhận-hoặc lặp lại. Mỗi trạng thái có một xác suất thất bại có thể cấu hình được rút ra từ các phát hiện của Beel et al.

- Có bao nhiêu ý tưởng đạt đến sự phục vụ.
- Bao nhiêu bài nộp sẽ có một lỗi thử nghiệm quan trọng giấy bóng được che giấu.
- Làm thế nào các ngân sách thử lại giao dịch với chất lượng so với năng suất.

## Chuyển nó

`outputs/skill-ai-scientist-sandbox-review.md`là một danh sách kiểm tra hai cửa cho bất cứ thứ gì được sản xuất bởi một đại lý vòng nghiên cứu trước khi nó rời khỏi hộp cát.

## Các bài tập

1. Đi chạy`code/main.py`với các tham số mặc định. Phân tích nào của loop chạy tạo ra một giấy " sạch "? Phân tích nào tạo ra một giấy với một lỗi thử nghiệm-lỗi hình ảnh phê bình được đánh bóng?

2. Các mặc định đã sử dụng 42% / 25% của Beel et al.`--experiment-failure 0.20 --novelty-mislabel 0.10`và sau đó với `--experiment-failure 0.60 --novelty-mislabel 0.40`- Làm thế nào để chia sẻ tốt nhưng không tốt thay đổi giữa hai vòng?

3. Đọc Sakanas AI Scientist v2 repo README về yêu cầu hộp cát. Hãy nêu tên hai hạn chế bổ sung (nên ngoài Docker) bạn sẽ áp dụng cho một chạy tự động nhiều ngày.

4. Đọc Beel et al. Phần 4 về khoảng cách chất lượng trình bày. Thiết kế một đánh giá bổ sung để bắt được các giấy có vẻ đẹp đẹp nhưng có lỗi thí nghiệm.

5. đề xuất một quy tắc đánh giá của con người cho kết quả của các đại lý nghiên cứu có quy mô tốt hơn "một tiến sĩ đọc mọi bài báo".

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Đọc thêm

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066)- Báo.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) Tổng kết nhà cung cấp với bối cảnh đánh giá ngang hàng.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) số đánh giá bên ngoài.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) người tiền nhiệm được tạo mẫu.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) định hình rộng hơn về các cơ quan nghiên cứu mở.
