# ASCII Nghệ thuật và hình ảnh jailbreaks

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753). Mùi các mã thông báo liên quan đến an toàn trong một yêu cầu có hại, thay thế chúng bằng các phiên bản nghệ thuật ASCII của cùng một chữ cái, và gửi lời yêu cầu che giấu. GPT-3.5, GPT-4, Gemini, Claude, Llama-2 đều không nhận ra các token nghệ thuật ASCII. Cuộc tấn công bỏ qua PPL (trình lọc phức tạp), phòng thủ Paraphrase và Retokenization. Liên quan: ViTC chuẩn đo nhận dạng các lời nhắc thị giác không nghĩa; StructuralSleight tổng quát đến các cấu trúc mã hóa văn bản không phổ biến (cây, đồ thị, JSON tổ) như một gia đình các cuộc tấn công mã hóa.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả cuộc tấn công ArtPrompt: bước xác định từ, thay thế ASCII-art, lời nhắc cuối cùng được che giấu.
- Giải thích lý do tại sao các hệ thống phòng thủ tiêu chuẩn (PPL, Paraphrase, Retokenization) thất bại trên ArtPrompt.
- Định nghĩa ViTC và mô tả những gì nó đo lường.
- Mô tả StructuralSleight như là một khái quát hóa cho các cấu trúc mã hóa văn bản bất thường tùy ý.

## Vấn đề

Các cuộc tấn công thông qua đoạn phrasing và role play (Dạy học 12) và thông qua ngữ cảnh dài (Dạy học 13) hoạt động trên mô hình cấp văn bản. ArtPrompt hoạt động ở cấp độ nhận dạng: mô hình không phân tích mã thông báo cấm. Nó phân tích một hình ảnh được hiển thị bằng ký tự.

## Khái niệm

### ArtPrompt, hai bước

Bước 1. Chứng nhận từ: Khi có yêu cầu gây hại, kẻ tấn công sử dụng LLM để xác định các từ liên quan đến an toàn (ví dụ: "bomb" trong " làm thế nào để làm một quả bom"). 

Bước 2. Phép tạo Prompt được che giấu. Thay thế mỗi từ được xác định bằng cách hiển thị nghệ thuật ASCII của nó (một khối ký tự 7x5 hoặc 7x7 tạo thành hình chữ). Mô hình nhận được một lưới dấu chấm và không gian mà một mô hình đủ khả năng có thể nhận ra như là từ; một bộ lọc an toàn chỉ nhìn thấy lưới.

Kết quả: GPT-4, Gemini, Claude, Llama-2, GPT-3.5 đều thất bại. tỷ lệ thành công tấn công trên 75% trên bộ phận chuẩn của họ.

### Tại sao các hệ thống phòng thủ tiêu chuẩn thất bại

- **PPL (perplexity filter).**Nghệ thuật ASCII có độ phức tạp cao nhưng cũng như tất cả các đầu vào mới. Các lựa chọn ngưỡng chặn ArtPrompt cũng chặn đầu vào có cấu trúc hợp pháp.
- **Paraphrase.**Các quy định định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định nghĩa của các quy định định định định nghĩa của quy định định nghĩa của quy định định nghĩa của quy định định nghĩa.
- **Retokenization.**Chia mã hiệu khác nhau không thay đổi rằng tầm nhìn của mô hình là nhận ra hình chữ cái.

Vấn đề cơ bản là bộ lọc an toàn là cấp token hoặc cấp ngữ nghĩa; ArtPrompt hoạt động ở cấp độ nhận dạng thị giác.

### Chỉ số chuẩn ViTC

Việc nhận dạng các lời nhắc thị giác không ngữ nghĩa. đo khả năng của mô hình để đọc ASCII-art, wingdings và nội dung thị giác không ngữ nghĩa văn bản khác. Hiệu quả của ArtPrompt tương quan với độ chính xác ViTC: mô hình đọc văn bản thị giác tốt hơn, ArtPrompt làm việc tốt hơn trên nó. Đây là một sự thỏa hiệp về khả năng và an toàn.

### Dòng cấu trúc

ArtPrompt: Các cấu trúc mã hóa văn bản không phổ biến (UTES). Cây, đồ thị, JSON nhốt, CSV-in-JSON, khối mã phong cách khác nhau. Nếu một cấu trúc hiếm khi được đào tạo dữ liệu an toàn nhưng có thể phân tích bằng mô hình, nó có thể che giấu nội dung có hại.

Sự liên quan của phòng thủ: an toàn phải tổng quát trên các đại diện cấu trúc mô hình có thể phân tích.

### Phương pháp tương tự hình ảnh

Các LLM hình ảnh (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) mở rộng bề mặt tấn công. Các cuộc tấn công theo kiểu ArtPrompt với hình ảnh thực tế mạnh hơn so với các tương tự ASCII-art vì mã hóa hình ảnh tạo ra tín hiệu phong phú hơn.

### Khi điều này phù hợp với giai đoạn 18

Bài học 12-14 mô tả ba vector tấn công trực giác: tinh chỉnh lặp lại (PAIR), chiều dài ngữ cảnh (MSJ) và mã hóa (ArtPrompt / StructuralSleight). Bài học 15 chuyển từ các cuộc tấn công tập trung vào mô hình sang các cuộc tấn công giới hạn hệ thống (động lắp sao trực tiếp). Bài học 16 mô tả phản ứng công cụ phòng thủ.

```figure
al-ascii-cloak
```

## Sử dụng nó

`code/main.py`Bạn có thể che giấu các từ cụ thể trong truy vấn gây hại bằng glyph ASCII-art, xác minh chuỗi che giấu vượt qua một bộ lọc từ khóa, và (tự chọn) giải mã lại chuỗi che giấu bằng cách sử dụng một công nhận đơn giản.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-encoding-audit.md`. Với báo cáo phòng thủ jailbreak, nó liệt kê các nhóm mã hóa tấn công được bao gồm (ASCII art, base64, leet-speak, UTF-8 homoglyph, UTES) và lớp phòng thủ bắt được mỗi nhóm.

## Các bài tập

1. Đi chạy`code/main.py`- Kiểm tra chuỗi che giấu vượt qua một bộ lọc từ khóa đơn giản. báo cáo sự thay đổi cấp độ ký tự cần thiết.

2. Thực hiện mã hóa thứ hai: base64 cho cùng một từ mục tiêu. So sánh tỷ lệ bỏ lọc so với ArtPrompt và khó khăn phục hồi.

3. Đọc Jiang et al. 2024 Mục 4.3 (hậu quả năm mô hình). đề xuất một lý do tại sao độ kháng ArtPrompt của Claude cao hơn so với Gemini trên cùng một tiêu chuẩn.

4. Thiết kế một hệ thống phòng thủ trước thế hệ phát hiện các vùng hình dạng nghệ thuật ASCII trong prompt. đo tỷ lệ dương tính sai trên mã hợp pháp, bảng và ghi chú toán học.

5. StructuralSleight liệt kê 10 cấu trúc mã hóa. vẽ một hệ thống phòng thủ tổng quát xử lý tất cả 10 và ước tính chi phí tính toán cho mỗi lệnh bảo vệ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## Đọc thêm

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) giấy jailbreak ASCII-art
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) UTS tổng quát
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) tấn công lặp lại bổ sung
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) tấn công dài bổ sung
