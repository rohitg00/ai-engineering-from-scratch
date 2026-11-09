# Tự tinh chỉnh và phê bình: Tăng sản lượng lặp đi lặp lại

> Self-Refine (Madaan et al., 2023) sử dụng một LLM trong ba vai trò  tạo, phản hồi, tinh chỉnh  trong vòng lặp. Lợi nhuận trung bình: +20 tuyệt đối trên 7 nhiệm vụ. CRITIC (Gou et al., 2023) làm cứng bước phản hồi bằng cách định tuyến xác minh thông qua các công cụ bên ngoài. Năm 2026, mô hình này được chuyển giao trong mọi khung như "đánh giá-tích cực" (Anthropic) hoặc vòng lặp guardrail (OpenAI Agents SDK).

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## Mục tiêu học tập

- Ba lời nhắc của State Self-Refine (tạo, phản hồi, tinh chỉnh) và giải thích tại sao lịch sử quan trọng đối với lời nhắc tinh chỉnh.
- Giải thích quan điểm quan trọng của CRITIC: LLM không đáng tin cậy trong việc tự xác minh mà không có nền tảng bên ngoài.
- Thực hiện một vòng tự lọc stdlib với lịch sử và một xác minh bên ngoài tùy chọn.
- Bản đồ mô hình này cho dòng công việc "học toán-tích toán" của Anthropic và cửa sổ bảo vệ đầu ra của OpenAI Agents SDK.

## Vấn đề

Một đại lý tạo ra một câu trả lời gần như đúng. Có thể một dòng mã có lỗi tổng hợp. Có thể một bản tóm tắt quá dài. Có thể một kế hoạch bỏ lỡ một trường hợp cạnh. Bạn muốn là: đại lý chỉ trích đầu ra của riêng mình, sau đó sửa chữa nó.

Self-Refine cho thấy điều này hoạt động với một mô hình duy nhất, không có dữ liệu đào tạo, không có RL. Nhưng có một câu đố: LLM không tốt trong việc tự xác minh trên thực tế cứng. CRITIC đặt tên cho sự cố định  đường dẫn bước xác minh thông qua các công cụ bên ngoài (bảo sát, phiên dịch mã, máy tính toán, chạy thử nghiệm).

Cùng với hai bài báo này xác định mặc định 2026 cho cải tiến lặp đi lặp lại: tạo, xác minh (trên bên ngoài khi có thể), tinh chỉnh, dừng khi xác minh vượt qua.

## Khái niệm

### Tự tinh chỉnh (Madaan et al., NeurIPS 2023)

Một LLM, ba vai trò:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Chi tiết chính:`refine`thấy lịch sử đầy đủ  tất cả các kết quả và chỉ trích trước đây  vì vậy nó không lặp lại sai lầm.

Tiêu đề: +20 cải thiện tuyệt đối trung bình trong 7 nhiệm vụ ( toán học, mã, viết tắt, đối thoại) bao gồm GPT-4. Không có đào tạo, không có công cụ bên ngoài, mô hình đơn.

### CRITIC (Gou et al., arXiv:2305.11738, v4 Feb 2024)

Điểm yếu của Self-Refine: bước phản hồi là một LLM tự ghi điểm. Đối với các tuyên bố thực tế, điều này không đáng tin cậy (một ảo giác thường trông thuyết phục cho mô hình đã tạo ra nó). CRITIC thay thế `feedback(task, output)`với `verify(task, output, tools)`nơi `tools`bao gồm:

- Một công cụ tìm kiếm cho các tuyên bố thực tế.
- Một phiên dịch mã cho chính xác mã.
- Máy tính toán toán.
- Các bộ xác minh cụ thể về miền (thử nghiệm đơn vị, kiểm tra loại, lăng).

Người xác minh tạo ra một bài phê bình có cấu trúc dựa trên kết quả công cụ.

Tiêu đề: CRITIC vượt trội hơn Auto-Refine trong các nhiệm vụ thực tế vì sự chỉ trích được đặt nền.

### Điều kiện dừng

Hai hình dạng phổ biến:

1. **Verifier passes.**Thử nghiệm bên ngoài trả lại thành công. Tích thích khi có (thử nghiệm đơn vị, kiểm tra kiểu, khẳng định tháp).
2. **No feedback issued.**Mô hình nói "tạo ra tốt". Thô hơn nhưng không đáng tin cậy; cặp với một nắp lặp tối đa.

2026 mặc định: kết hợp chúng. "Hãy dừng nếu xác minh vượt qua OR mô hình nói OK AND lặp >= 2 hoặc lặp >= max_iterations".

### Tỷ lệ của các loại hình:

Bài đăng của Anthropic tháng 12 năm 2024 đề cập đến điều này như là một trong năm mô hình quy trình làm việc.

- Đánh giá: đánh giá kết quả và tạo ra một lời chỉ trích.
- Optimizer: sửa đổi sản xuất do sự chỉ trích.

Loop cho đến khi đánh giá vượt qua. Đây là tự tinh chỉnh / CRITIC trong khung Anthropic. Chi tiết kỹ thuật quan trọng Anthropic thêm: các yêu cầu đánh giá và tối ưu hóa nên khác nhau đáng kể để mô hình không chỉ được dán bằng cao su.

### Các cửa sổ bảo vệ đầu ra của OpenAI Agents SDK

OpenAI Agents SDK gửi mô hình này như là "các cửa sổ sản xuất".`OutputGuardrailTripwireTriggered`Các guardrails có thể gọi công cụ (như CRITIC) hoặc là các chức năng thuần túy (như tự tinh chế).

### 2026 bẫy

- **Rubber-stamp loops.**Một mô hình tương tự làm việc tạo ra và phê bình với cùng một kiểu cách nhanh nhẹn hội tụ với "có vẻ tốt với tôi". Sử dụng các mô hình khác nhau về cấu trúc, hoặc một mô hình rẻ hơn cho phê bình.
- **Over-refinement.**Mỗi lần thông qua tinh chỉnh thêm độ trễ và token. Ngân sách 1-3 thông qua; sau đó, leo thang đến đánh giá của con người.
- **CRITIC on trivial tasks.**Nếu không có xác minh bên ngoài, CRITIC biến mất thành tự tinh chỉnh; đừng trả thời gian trễ cho xác minh stub.

```figure
self-refine
```

## Hãy xây dựng nó

`code/main.py`thực hiện tự tinh chỉnh và CRITIC trên một nhiệm vụ đồ chơi: tạo ra một danh sách đạn ngắn cho một chủ đề.

Các thành phần:

- `generate` Nhà sản xuất kịch bản.
- `feedback` Tự phê bình theo kiểu LLM.
- `verify_external` Kiểm tra cơ bản theo kiểu CRITIC.
- `refine` viết lại đầu ra với lịch sử.
- Điều kiện dừng  kiểm chứng vượt qua hoặc tối đa 4 lần lặp lại.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

So sánh các tự tinh chỉnh so với CRITIC chạy. CRITIC bắt được một lỗi thực tế tự tinh chỉnh bị bỏ lỡ bởi vì kiểm tra bên ngoài đã đặt nền tự phê bình không.

## Sử dụng nó

Phân tích đánh giá của Anthropic là mô hình này trong ngôn ngữ thân thiện với Claude. Các cửa sổ bảo vệ đầu ra của OpenAI Agents SDK có hình CRITIC (bên bảo vệ có thể gọi công cụ). LangGraph gửi một nút phản xạ đọc như tự tinh chỉnh. Sử dụng máy tính Gemini 2.5 của Google thêm một đánh giá an toàn từng bước là một biến thể CRITIC: mọi hành động được xác minh trước khi tham gia.

## Chuyển nó

`outputs/skill-refine-loop.md`cấu hình một vòng lặp đánh giá-optimizer cho hình dạng nhiệm vụ, tính sẵn có của xác minh và ngân sách lặp lại. Phát ra yêu cầu cho máy phát điện, đánh giá/ xác minh và tối ưu hóa, cộng với chính sách dừng.

## Các bài tập

1. Cứ chạy đồ chơi với max_iterations=1. CRITIC vẫn giúp không?
2. Thay thế xác minh bên ngoài bằng một xác minh ồn ào (những kết quả sai 30% ngẫu nhiên).
3. Thực hiện một biến thể "tít xét máy phát trên các mô hình khác nhau": mô hình lớn tạo ra, mô hình nhỏ chỉ trích.
4. Đọc phần 3 CRITIC (arXiv:2305.11738 v4). Hãy nêu tên ba loại công cụ xác minh và đưa ra một ví dụ cho mỗi loại.
5. Bản đồ OpenAI Agents SDK `output_guardrails`Điều gì SDK sai và điều gì đúng?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## Đọc thêm

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) giấy phép
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) Kiểm tra dựa trên công cụ
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) mô hình lưu lượng công việc đánh giá- tối ưu hóa
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) Vệ chắn đầu ra như các bộ xác minh hình CRITIC
