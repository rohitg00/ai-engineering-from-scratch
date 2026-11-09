# Đội đỏ: Đội đồng và tấn công tự động

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419). PAIR  Quick Automatic Iterative Refinement  là jailbreak hộp đen tự động. Một LLM tấn công với hệ thống yêu cầu nhóm đỏ lặp đi lặp lại đề xuất jailbreak cho LLM mục tiêu, tích lũy các nỗ lực và phản ứng trong lịch sử trò chuyện của riêng mình như phản hồi trong ngữ cảnh. PAIR thường thành công trong vòng 20 truy vấn, hiệu quả hơn GCG (sự tìm kiếm gradient cấp token của Zou et al.) và không yêu cầu truy cập hộp trắng. PAIR hiện là một đường cơ sở tiêu chuẩn trong JailbreakBench (arXiv:2404.01318) và HarmBench, cùng với GCG, AutoDAN, TAP và Persuasive Adversarial Prompt.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Mục tiêu học tập

- Mô tả thuật toán PAIR: hệ thống tấn công nhanh chóng, tinh chỉnh lặp lại, phản hồi trong ngữ cảnh.
- Giải thích tại sao PAIR hiệu quả hơn GCG khi mục tiêu là hộp đen.
- Hãy nêu tên bốn đường cơ sở tấn công tự động khác (GCG, AutoDAN, TAP, PAP) và nêu một tính năng phân biệt của mỗi đường.
- Mô tả các giao thức đánh giá JailbreakBench và HarmBench và "tỷ lệ thành công tấn công" có nghĩa là gì trong mỗi.

## Vấn đề

Red-teaming từng là một hoạt động thủ công. Một số lượng nhỏ các nhà kiểm tra chuyên gia xây dựng các lời nhắc đối kháng và theo dõi những lời nhắc nào hoạt động. Điều này không có quy mô: tỷ lệ thành công của cuộc tấn công cần một mẫu thống kê, và mục tiêu là một mục tiêu di chuyển với mỗi phiên bản mô hình. PAIR hoạt động hóa red-teaming như một vấn đề tối ưu hóa với mục tiêu hộp đen.

## Khái niệm

### Algoritm PAIR

Các đầu vào:
- Mục tiêu LLM T (chương trình chúng ta đang tấn công).
- Thẩm phán LLM J (đánh điểm xem câu trả lời là jailbreak hay không).
- Đội tấn công LLM A (những người tối ưu hóa đội đỏ).
- Đường mục tiêu G: "đưa lời [cảnh dẫn gây hại]".
- Ngân sách K (thường là 20 câu hỏi).

Loop, cho k trong 1..K:
1. A được nhắc đến với mục tiêu G và lịch sử của (quá trình, phản ứng) cặp cho đến nay.
2. A phát ra một lời nhắc mới $p_k$- Tôi không biết.
3. Đưa ra$p_k$để T; nhận được phản hồi $r_k$- Tôi không biết.
4. J điểm $(p_k, r_k)$trên bàn thắng.
5. Nếu điểm >= ngưỡng, dừng  jailbreak tìm thấy.
6. Còn nữa, thêm $(p_k, r_k)$để lịch sử của A; tiếp tục.

Kết quả thực nghiệm (NeurIPS 2023): > 50% tỷ lệ thành công của cuộc tấn công đối với GPT-3.5-turbo, Llama-2-7B-chat; trung bình các truy vấn thành công trong phạm vi 10-20

### Tại sao PAIR hiệu quả

GCG (Zou et al. 2023) tìm kiếm các hậu tố token đối lập theo gradient; nó đòi hỏi truy cập mô hình hộp trắng và tạo ra hậu tố không thể đọc được. PAIR là hộp đen và tạo ra các cuộc tấn công ngôn ngữ tự nhiên chuyển qua các mô hình. Phản hồi trong bối cảnh của PAIR cho phép kẻ tấn công học hỏi từ mỗi từ chối; GCG không có tương đương (mỗi cập nhật mã thông báo mới phải khám phá lại tiến bộ trước đó).

### Các cuộc tấn công tự động liên quan

- **GCG (Zou et al. 2023, arXiv:2307.15043).**Tìm kiếm gradient cấp token cho hậu tố đối lập. hộp trắng, chuyển thể, tạo ra chuỗi không thể đọc được.
- **AutoDAN (Liu et al. 2023).**Tìm kiếm tiến hóa về các yêu cầu, được hướng dẫn bởi một mục tiêu hàng đầu.
- **TAP (Mehrotra et al. 2024).**Cây tấn công với cắt  nhánh nhiều triển khai kiểu PAIR.
- **PAP (Zeng et al. 2024).**Các lời khuyên phản đối thuyết phục  mã hóa các kỹ thuật thuyết phục con người như các mẫu lời khuyên.

### JailbreakBench và HarmBench

Cả hai (2024) chuẩn hóa đánh giá:

- JailbreakBench (arXiv:2404.01318). 100 hành vi gây hại trong 10 danh mục chính sách OpenAI. Tỷ lệ thành công tấn công (ASR) như là thước đo chính.
- HarmBench (Mazeika et al. 2024). 510 hành vi trong 7 loại, với các thử nghiệm tổn hại ngữ nghĩa và chức năng. So sánh 18 cuộc tấn công với 33 mô hình.

ASR thường được báo cáo với một ngân sách truy vấn cố định. So sánh các cuộc tấn công đòi hỏi phải phù hợp ngân sách; 90% ASR tại 200 truy vấn không tương đương với 85% ASR tại 20.

### Lý do nó quan trọng cho các triển khai năm 2026

Mỗi phòng thí nghiệm biên giới hiện đang chạy PAIR và TAP đối với các mô hình sản xuất trước khi phát hành. Các quỹ đạo ASR xuất hiện trong thẻ mô hình (Dạy học 26) và phụ lục trường hợp an toàn (Dạy học 18).

### Khi điều này phù hợp với giai đoạn 18

Bài học 12 là nền tảng tấn công tự động. Bài học 13 (Many-Shot Jailbreaking) là một hoạt động khai thác dài bổ sung. Bài học 14 (ASCII Art / Visual) là một cuộc tấn công mã hóa. Bài học 15 (Indirect Prompt Injection) là bề mặt tấn công sản xuất năm 2026. Bài học 16 bao gồm các đối tác công cụ phòng thủ (Llama Guard, Garak, PyRIT).

```figure
al-pair-loop
```

## Sử dụng nó

`code/main.py`mục tiêu là một phân loại giả mạo từ chối các lời nhắc "bất ngờ" gây hại (trình lọc từ khóa). Người tấn công là một nhà tinh chế dựa trên quy tắc thử định nghĩa, khung chơi vai và mã hóa. Thẩm phán ghi điểm phản ứng. Bạn xem kẻ tấn công thành công trong ~ 5-15 lặp lại chống lại bộ lọc từ khóa và thất bại chống lại bộ lọc ngữ nghĩa.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-attack-audit.md`- Với một báo cáo đánh giá của nhóm đỏ, nó kiểm tra: những cuộc tấn công nào đã được thực hiện (PAIR, GCG, TAP, AutoDAN, PAP), với ngân sách nào mỗi cuộc tấn công, với thẩm phán nào, hành vi gây hại nào được thiết lập (JailbreakBench, HarmBench, nội bộ).

## Các bài tập

1. Đi chạy`code/main.py`- Đánh giá các yêu cầu trung bình cho thành công cho ba chiến lược tấn công tích hợp. Giải thích các giả định phòng thủ mục tiêu nào mỗi khai thác.

2. Thực hiện chiến lược tấn công thứ tư (ví dụ: dịch sang ngôn ngữ khác, mã hóa base64). báo cáo các yêu cầu trung bình mới để thành công đối với mục tiêu lọc từ khóa và mục tiêu lọc ngữ nghĩa.

3. Đọc Chao et al. 2023 Hình 5 (PAIR vs GCG so sánh). Mô tả hai kịch bản mà GCG được ưa thích mặc dù lợi thế hiệu quả của PAIR.

4. JailbreakBench báo cáo ASR đối với một mục tiêu cố định. Thiết kế một số liệu bổ sung đo đa dạng tấn công (phân biến trong các lời nhắc thành công). Giải thích tại sao đa dạng quan trọng đối với đánh giá phòng thủ.

5. TAP (Mehrotra 2024) mở rộng PAIR bằng cách nhánh + cắt.`code/main.py`và mô tả sự cân bằng giữa chi phí tính toán và tỷ lệ thành công.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## Đọc thêm

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) Tờ PAIR, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) Bảng giấy GCG
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) Đánh giá tiêu chuẩn hóa
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) đánh giá rộng hơn
