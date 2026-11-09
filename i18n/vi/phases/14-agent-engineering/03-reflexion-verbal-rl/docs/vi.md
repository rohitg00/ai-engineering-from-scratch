# Xem xét: Học cách tăng cường bằng lời nói

> RL dựa trên gradient cần hàng ngàn thử nghiệm và một cluster GPU để sửa đổi chế độ thất bại. Reflection (Shinn et al., NeurIPS 2023) làm điều đó bằng ngôn ngữ tự nhiên: sau mỗi thử nghiệm thất bại, đại lý viết một phản xạ, lưu trữ nó trong bộ nhớ tập thể, và điều kiện thử nghiệm tiếp theo trên bộ nhớ đó. Đây là mô hình đằng sau tính toán thời gian ngủ của Letta, học tập của Claude Code về CLAUDE.md, và quy tắc học tập của Pro-workflow.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên ba thành phần của Nhận thức (Nhân viên, Thử nghiệm, Tự Nhận thức) và vai trò của trí nhớ tập thể.
- Thực hiện một vòng lặp phản xạ stdlib với đánh giá nhị phân, bộ đệm phản xạ và các nỗ lực tái tạo mới.
- Chọn giữa các nguồn phản hồi quy mô, heuristic và tự đánh giá cho một nhiệm vụ nhất định.
- Giải thích tại sao việc tăng cường bằng lời nói bắt được những lỗi mà RL dựa trên gradient cần hàng ngàn thử nghiệm để sửa chữa.

## Vấn đề

Một đại lý thất bại trong một nhiệm vụ. Trong RL tiêu chuẩn bạn sẽ chạy hàng ngàn thử nghiệm hơn, tính toán gradient, cập nhật trọng lượng.

Nhắc nhã (Shinn et al., arXiv:2303.11366) đặt ra một câu hỏi khác: nếu đại lý chỉ nghĩ về lý do tại sao nó thất bại và thử lại với ý tưởng đó trong lời nhắc nhở của nó? Không cập nhật trọng lượng. Không gradient. Chỉ là ngôn ngữ tự nhiên được lưu trữ giữa các thử nghiệm.

Kết quả: trên ALFWorld nó đánh bại ReAct và các đường cơ sở không được điều chỉnh tốt khác. trên HotpotQA nó cải thiện so với ReAct. Trên việc tạo mã (HumanEval / MBPP) nó thiết lập trạng thái nghệ thuật tại thời điểm đó. Tất cả mà không có một bước nghiêng duy nhất.

## Khái niệm

### Ba thành phần

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

Thêm một cấu trúc dữ liệu:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

Một thử nghiệm chạy cho diễn viên. Thử nghiệm đánh giá nó. Nếu điểm số thấp, Self-Reflector tạo ra một phản xạ ("Tôi chọn công cụ sai vì tôi đọc sai câu hỏi như hỏi về X khi nó hỏi về Y").

### Ba loại đánh giá

1. **Scalar** tín hiệu nhị phân bên ngoài. ALFWorld thành công hoặc thất bại. HumanEval thử nghiệm vượt qua hoặc thất bại. đơn giản nhất, tín hiệu cao nhất.
2. **Heuristic** dấu hiệu thất bại được xác định trước. "Nếu tác nhân tạo ra hành động tương tự hai lần liên tiếp, đánh dấu là bị mắc kẹt". "Nếu quỹ đạo vượt quá 50 bước, đánh dấu là không hiệu quả".
3. **Self-evaluated** LLM ghi điểm quỹ đạo của riêng mình. Cần khi không có sự thật cơ bản có sẵn. tín hiệu yếu hơn; kết hợp tốt với xác minh cơ bản bằng công cụ (Dạy 05  CRITIC).

Dự định 2026 là một hỗn hợp: scalar khi có sẵn, tự-eval khi không có, heuristics như đường ray an toàn.

### Tại sao điều này nói chung

Reflection không phải là một thuật toán mới mà là một mô hình có tên.

- Letta's sleep-time computation (Lớp 08): một đại lý riêng tư suy nghĩ về các cuộc trò chuyện trong quá khứ và viết cho các khối bộ nhớ.
- Claude Code `CLAUDE.md`/ " lưu trí nhớ" mô hình: phản ánh được ghi lại như những bài học, prepended cho các buổi tiếp theo.
- Pro-workflow `/learn-rule`lệnh: các sửa đổi được ghi lại như là các quy tắc rõ ràng.
- Các nút phản xạ của LangGraph: một nút ghi điểm đầu ra và đường dẫn để tinh chỉnh nếu cần thiết.

Tất cả đều bắt nguồn từ cùng một cái nhìn sâu sắc: ngôn ngữ tự nhiên là một phương tiện đủ phong phú để mang "những gì tôi đã học từ thất bại" giữa các cuộc chạy.

### Khi nó hoạt động và khi nó không hoạt động

Nhận thức hoạt động khi:

- Có một tín hiệu thất bại rõ ràng (trình thử thất bại, lỗi công cụ, câu trả lời sai).
- Nhóm nhiệm vụ có thể tái tạo (những câu hỏi tương tự có thể được đặt lại).
- Sự suy nghĩ có chỗ để cải thiện quỹ đạo (khuế hoạch hành động đủ).

Nhắc nhã không giúp ích khi:

- Đặc vụ đã thành công trong lần thử đầu tiên.
- Sự cố là bên ngoài (mạng không hoạt động, công cụ bị hỏng)  phản ánh về "mạng đã bị hỏng" không giúp chạy trong tương lai.
- Sự phản ánh biến thành mê tín  lưu trữ một câu chuyện về một lần chạy ván.

2026: mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ mớ m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m m

```figure
react-trace
```

## Hãy xây dựng nó

`code/main.py`thực hiện Nhận thức trên một trò chơi: tạo ra một danh sách 3 yếu tố tổng cộng đến một mục tiêu.

Các thành phần:

- `Actor` một chính sách được viết kịch bản cải thiện khi nó thấy phản ánh.
- `Evaluator.binary()` vượt qua/không đạt được số tiền mục tiêu.
- `SelfReflector` tạo ra một chẩn đoán một dòng của sự thất bại.
- `EpisodicMemory` một danh sách giới hạn với ngữ nghĩa TTL.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Các dấu vết cho thấy ba thử nghiệm. thử nghiệm 1 thất bại, một phản xạ được lưu trữ, thử nghiệm 2 thấy phản xạ và cải thiện nhưng vẫn thất bại, thử nghiệm 3 thành công. So sánh với một chạy cơ bản (không phản xạ)  nó vẫn bị mắc kẹt trong câu trả lời thử nghiệm 1.

## Sử dụng nó

LangGraph đưa phản xạ như một mô hình nút.`/memory`lệnh và pro-workflow của `/learn-rule`Letta tính toán thời gian ngủ chạy Self-Reflector trong thời gian ngừng hoạt động để đại lý chính vẫn bị ràng buộc bởi độ trễ. OpenAI Agents SDK không gửi Reflexion trực tiếp; bạn xây dựng nó bằng Guardrail tùy chỉnh từ chối quỹ đạo theo điểm số và bộ nhớ`Session`là tồn tại qua các đường đua.

## Chuyển nó

`outputs/skill-reflexion-buffer.md`tạo và duy trì một bộ đệm tập thể với chụp phản xạ, TTL và giảm trùng lặp. Với một lớp công việc và thất bại, nó phát ra một phản xạ thực sự giúp thử nghiệm tiếp theo (không phải là một khái quát "sự cẩn thận hơn").

## Các bài tập

1. Chuyển từ đánh giá nhị phân sang đánh giá thang đo trả lại một số lượng đường cách (cách nào xa từ mục tiêu).
2. Thêm một TTL 10 thử nghiệm vào những suy nghĩ.
3. Thực hiện đánh giá học học: đánh dấu thử nghiệm như bị mắc kẹt nếu cùng một hành động lặp lại.
4. Chạy Reflection với một diễn viên đối thủ mà bỏ qua phản xạ.
5. Đọc phần 4 của bài báo Reflexon trên AlfWorld. Tái tạo lại sự cải thiện tỷ lệ thành công 130% theo khái niệm: điểm chính là delta vs vanilla ReAct?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Reflexion | "Self-correction" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector plus episodic memory |
| Verbal reinforcement | "Learning without gradients" | Natural-language reflection prepended to the next trial's prompt |
| Episodic memory | "Per-task reflections" | Bounded buffer of prior reflections for one task class |
| Scalar evaluator | "Binary success signal" | Pass/fail or numeric score from ground truth |
| Heuristic evaluator | "Pattern-based detector" | Predefined failure signatures (e.g. stuck-loop, too-many-steps) |
| Self-evaluator | "LLM-as-judge on own trace" | Lower-signal fallback when no ground truth — pair with tool-grounded verification |
| Memory rot | "Stale reflections" | Episodic buffer fills with obsolete entries; fix with compaction/TTL |
| Sleep-time reflection | "Async self-reflection" | Run Self-Reflector off the hot path so primary agent stays fast |

## Đọc thêm

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) giấy phép
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) phản xạ không đồng bộ trong sản xuất
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) quản lý bộ đệm tập thể trong bối cảnh
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) mô hình nút phản xạ
