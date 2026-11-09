# Xã hội tâm trí và tranh luận đa tác nhân

> Thuyết năm 1986 của Minsky  trí thông minh là một xã hội của các chuyên gia  được khám phá lại mỗi thập kỷ. Năm 2023, Du et al. đã biến nó thành một thuật toán cụ thể: nhiều trường hợp LLM đề xuất câu trả lời, đọc câu trả lời của nhau, chỉ trích và cập nhật. Trong suốt N vòng họ tụ tụ tập về một sự đồng thuận vượt qua CoT không bắn và suy nghĩ về sáu nhiệm vụ lý luận và thực tế. Hai phát hiện quan trọng: cả hai **multiple agents**và **multiple rounds**xã hội đánh bại một đơn độc lập; trao đổi đa vòng đánh bại một lần bỏ phiếu.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Vấn đề

Sự nhất quán tự nhiên  lấy nhiều lần một mẫu và lấy câu trả lời đa số  là cải tiến lý luận rẻ nhất bạn có thể bắt đầu. Nó hoạt động, nhưng nó bão hòa nhanh chóng. Bạn có thể tăng gấp đôi các mẫu của mình và không thấy một bước nhảy có ý nghĩa khác.

Cuộc tranh luận phá vỡ sự bão hòa. Thay vì các mẫu độc lập N từ một mô hình, các đại lý N đọc luận và sửa đổi của nhau.

## Khái niệm

### Du et al. 2023 thuật toán

Từ arXiv:2305.14325 (ICML 2024):

1. Mỗi nhân viên N tạo ra câu trả lời ban đầu cho câu hỏi.
2. Đối với vòng r = 2..R: mỗi đại lý được hiển thị các câu trả lời vòng r-1 của các đại lý khác và được hỏi "Tuy nhiên, hãy đưa ra câu trả lời cập nhật của bạn".
3. Sau vòng R, đa số bỏ phiếu cho câu trả lời cuối cùng.

Các bài kiểm tra trên giấy về MMLU, GSM8K, tiểu sử, MATH, và các điểm chuẩn thực tế.

### Hai nút độc lập

Các bài viết từ cùng một giấy tờ:

- **Agent count alone**(1 vòng, đa số phiếu N) đánh bại đơn vị trong hầu hết các nhiệm vụ, nhưng cao nguyên.
- **Round count alone**(1 nhân viên nhìn thấy lý luận trước đó của riêng mình) hầu như không giúp  yếu kém của phản xạ được biết đến.
- **Both together**Sự trao đổi nhiều vòng giữa nhiều đại lý thúc đẩy lợi nhuận.

### Tại sao nó hoạt động

Hai cơ chế:

1. **Exposure to disagreement.**Khi một đại lý thấy chuỗi lý luận của đại lý khác với một kết luận khác, nó phải biện minh hoặc cập nhật.
2. **Correlated error reduction.**Trong tính nhất quán, tất cả các mẫu đều đến từ cùng một mô hình, vì vậy các lỗi tương quan với một câu trả lời sai lầm. Các mô hình khác nhau hoặc hạt giống khác nhau không liên quan. Các quan điểm tranh luận khác nhau không liên quan.

### Cuộc tranh luận đa dạng

A-HMAD và các tiếp theo liên quan sử dụng * các mô hình cơ sở khác nhau* cho các tác nhân khác nhau. Llama + Claude + GPT tranh luận làm giảm sự sụp đổ của monoculture (Dạy 26) bởi vì các lỗi tương quan của một gia đình mô hình không được chia sẻ bởi những người khác.

Nhược điểm: mô hình yếu tham gia vào một cuộc tranh luận có thể kéo sự đồng thuận về phía câu trả lời sai (xem "Chúng ta nên trở nên điên rồ?", arXiv:2311.17371).

### NLSOM  mở rộng 129-agent

Zhuge et al. ("Mindstorms in Natural Language-Based Societies of Mind", arXiv:2305.17066) đã mở rộng ý tưởng này sang 129 xã hội thành viên. Kết quả: chuyên môn hóa và tự tổ chức xuất hiện với quy mô, và hệ thống vượt trội hơn một đại lý trong các nhiệm vụ như trả lời câu hỏi trực quan.

### Các chế độ thất bại

- **Sycophancy cascade.**Tất cả các đại lý đều trì hoãn cho bất kỳ đại lý nào có vẻ tự tin nhất. Cuộc tranh luận sụp đổ với giọng nói lớn nhất.
- **Topic drift.**Các cuộc tranh luận trong nhiều vòng trôi ra khỏi câu hỏi ban đầu.
- **Compute blowup.**N đại lý × R vòng = N·R LLM cuộc gọi, mỗi cuộc gọi có một bối cảnh phát triển. 5 đại lý, 5 vòng tranh luận là 25 cuộc gọi trong bối cảnh phát triển. Chi phí cho mỗi câu hỏi có thể vượt quá 10 lần một cuộc gọi CoT duy nhất.

```figure
multi-agent-debate
```

## Hãy xây dựng nó

`code/main.py`chạy một cuộc tranh luận 3 đại lý × 3 vòng về một câu hỏi toán học nơi mỗi đại lý bắt đầu với một câu trả lời khác nhau (có thể sai).

Demo cho thấy hai hiệu ứng chính:

- Một vòng trao đổi duy nhất giúp các đại lý tiến gần hơn đến câu trả lời chính xác.
- Các vòng bổ sung sau vòng 2 cho thấy lợi nhuận giảm (cái khớp với cao nguyên của Du et al).

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

## Sử dụng nó

`outputs/skill-debate-configurator.md`cấu hình một cuộc tranh luận cho một nhiệm vụ mới: số lượng các đại lý, số lần ra mắt, tính đa dạng (những mô hình tương tự so với hỗn hợp), việc phân bổ vai trò (tương đối so với một đối thủ).

## Chuyển nó

Nếu bạn vận chuyển tranh luận:

- **Cap rounds at 3.**Du et al. cho thấy 3 vòng chiếm phần lớn lợi nhuận.
- **Cap agents at 5.**Ngoài 5, tình trạng bùng nổ và chi phí chiếm ưu thế.
- **Heterogeneous by default.**Ít nhất là hai mẫu cơ sở khác nhau trong hồ bơi.
- **Adversarial slot.**Một nhân viên đã khiến tôi bất đồng bất kể.
- **Log every round.**Các hệ thống tranh luận che giấu các vòng trung gian không thể được gỡ lỗi hoặc kiểm toán.

## Các bài tập

1. Đi chạy`code/main.py`, sau đó đặt số vòng lên 5 và xem lợi nhuận giảm.
2. Thêm một nhân viên thứ tư với vai trò đối lập: luôn không đồng ý với đa số hiện tại.
3. Trình (phác) điểm thỏa thuận cho mỗi vòng (phân số các đại lý trên câu trả lời đa số). Khi nào nó đạt 1,0 và đó tương đương với "sự đúng"?
4. Đọc Du et al. Phần 4 Ablations. sao chép "chỉ đại lý" vs "chỉ vòng" vs "cả hai" kết quả bằng cách sử dụng mã này.
5. Đọc "Chúng ta nên điên lên?" (arXiv:2311.17371) và liệt kê hai biến thể tranh luận ngoài vòng tròn  ví dụ, do thẩm phán dẫn đầu, chuỗi tranh luận, đối thủ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | "Minsky's idea" | Intelligence as interacting specialists; 1986 framing now operationalized via LLM debate. |
| Multi-agent debate | "Agents argue" | N agents propose, critique each other, revise over R rounds, majority-vote. |
| Consensus | "They agree" | Not epistemic truth — just fraction-on-majority-answer. Can be confidently wrong. |
| Rounds | "Exchange steps" | One round = each agent reads the others and updates once. |
| Heterogeneous debate | "Mix model families" | Using different base models to decorrelate errors. |
| Sycophancy cascade | "Everyone agrees with the loud one" | Debate failure where agents defer to the most confident agent regardless of correctness. |
| NLSOM | "129-agent society" | Natural-language society of mind; Zhuge et al.'s scaled version. |
| Correlated error | "Same model, same bug" | Why self-consistency saturates; debate across different views decorrelates. |

## Đọc thêm

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) giấy tham chiếu, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) 129-agent NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) Các biến thể tranh luận tham chiếu
- [Debate project page](https://composable-models.github.io/llm_debate/) Mã của Du et al., chi tiết về demo và việc bỏ
