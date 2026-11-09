# Kế hoạch với HTN và Tìm kiếm tiến hóa

> Kế hoạch biểu tượng xử lý các trường hợp khi kế hoạch có thể chứng minh là chính xác. Tìm kiếm mã tiến hóa xử lý các trường hợp khi chức năng thể dục có thể kiểm tra bằng máy. ChatHTN (2025) và AlphaEvolve (2025) cho thấy mỗi khóa mở khi kết hợp với LLM.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích mạng lưới nhiệm vụ cấp bậc: nhiệm vụ, phương pháp, nhà khai thác, điều kiện tiên quyết, hiệu ứng.
- Mô tả vòng lặp lai của ChatHTN  tìm kiếm biểu tượng với phân hủy trở lại LLM.
- Giải thích vòng lặp tiến hóa của AlphaEvolve và tại sao nó chỉ hoạt động với một trình đánh giá chương trình.
- Thực hiện một máy tính lên kế hoạch đồ chơi HTN cộng với một trò chơi tìm kiếm tiến hóa trong stdlib.

## Vấn đề

ReWOO (Dạy 02), Plan-and-Execute, và ReAct bao gồm hầu hết các kế hoạch của các đại lý.

1. **Plans with provable correctness.**Lịch trình, đường bay, dòng công việc tuân thủ  kế hoạch phải được xây dựng đúng.
2. **Optimizations with a machine-checkable fitness function.**Sự nhân số tử liệu, lập trình tính toán học, biên dịch viên vượt qua  mục tiêu không phải là "một kế hoạch chính xác" mà là "kế hoạch tốt nhất".

HTN Planning và AlphaEvolve giải quyết hai vấn đề khác nhau. Cả hai đều sử dụng LLM như các bộ tăng cường, chứ không phải thay thế.

## Khái niệm

### Các mạng lưới nhiệm vụ cấp bậc

Một HTN là:

- **Tasks** hợp chất (để phân hủy) và nguyên thủy (được thực hiện trực tiếp).
- **Methods** cách phân hủy một nhiệm vụ hợp chất thành các nhiệm vụ phụ, với các điều kiện tiên quyết.
- **Operators** Các hành động ban đầu với các điều kiện và hiệu ứng.
- **State** một loạt các sự kiện.

Kế hoạch: với một nhiệm vụ mục tiêu và một trạng thái ban đầu, tìm ra sự phân hủy thành các nhà khai thác nguyên thủy mà các điều kiện tiên quyết được đáp ứng theo trình tự.

HTN là lâu đời hơn LLM và vẫn là tham chiếu cho các kế hoạch có thể chứng minh là chính xác.

### ChatHTN (Gopalakrishnan et al., 2025)

ChatHTN (arXiv:2505.11814) kết nối HTN biểu tượng với các câu hỏi LLM:

1. Cố gắng phân hủy nhiệm vụ hợp chất hiện tại bằng các phương pháp hiện có.
2. Nếu không có phương pháp áp dụng, hãy hỏi LLM: "chúng bạn sẽ phân hủy như thế nào `task`trong tiểu bang `s`"Điều gì?"
3. Dịch câu trả lời LLM thành các nhiệm vụ phụ ứng cử viên.
4. Thiết lập hợp lệ với các chương trình điều hành; từ chối phân hủy không hợp lệ.
5. Lại tiếp.

Lời tuyên bố chính của bài báo: mỗi kế hoạch được sản xuất đều có thể chứng minh là hợp lý bởi vì các đề xuất LLM chỉ được đưa vào như là phân hủy ứng cử viên, không bao giờ là chỉnh sửa kế hoạch trực tiếp.

Học phương pháp trực tuyến (OpenReview `gwYEDY9j2x`, 2025 theo dõi) thêm một học viên tổng quát hóa phân hủy sản xuất LLM bằng cách lùi lại giảm tần suất truy vấn LLM lên đến 75%.

### AlphaEvolve (Novikov et al., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, tháng 6 năm 2025) là một con quái vật khác: tìm kiếm mã tiến hóa do bộ phận Flash / Pro Gemini 2.0 tổ chức.

Lúp:

1. Bắt đầu với một chương trình hạt giống + một nhà đánh giá chương trình (giả lại điểm fitness).
2. Nhóm LLM đề xuất đột biến.
3. Thử các đột biến qua bộ đánh giá.
4. Hãy giữ những thứ tốt nhất, biến đổi lại.

Chiến thắng được công bố:

- Sự cải thiện đầu tiên so với Strassen cho nhân số tử liệu phức tạp 4x4 trong 56 năm (48 nhân số scalar).
- 0,7% đã phục hồi máy tính Google thông qua một hệ thống lập trình Borg.
- FlashAttention tăng tốc 32% trên khối lượng công việc biên giới.

Khá hạn chế: chức năng thể dục phải được máy kiểm tra.

### Khi nào sử dụng

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Khi mô hình này đi sai

- **HTN without operators.**Nếu không có các quy trình điều kiện trước/sự ảnh hưởng thì tuyên bố tính hợp lý sẽ sụp đổ.
- **AlphaEvolve without a real evaluator.**"Hãy hỏi LLM nếu mã là tốt hơn" không phải là một chức năng fitness.
- **Over-engineering.**Hầu hết các nhiệm vụ của đại lý đều không cần thiết.

```figure
htn-tree-expand
```

## Hãy xây dựng nó

`code/main.py`thực hiện hai đồ chơi:

- Một trình lập kế hoạch HTN có các nhà điều hành, phương pháp, điều kiện tiên quyết, hiệu ứng và một `LLMFallback`Làm này sẽ hoạt động khi không có phương pháp nào phù hợp với một nhiệm vụ hợp nhất.
- Một cuộc tìm kiếm tiến hóa trên các chương trình toán học: tăng biểu thức mà sản lượng giảm thiểu `|f(x) - target|`Thử nghiệm là xác định.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hướng dẫn cho thấy người lập kế hoạch HTN phân hủy một nhiệm vụ hợp chất (với một sự suy giảm LLM giữa kế hoạch) và vòng lặp tiến hóa hội tụ trên một biểu thức mục tiêu.

## Sử dụng nó

- **HTN planners** `pyhop`- `SHOP3`, hoặc xây dựng riêng của bạn cho việc thực thi chính sách cụ thể.
- **ChatHTN** mã nghiên cứu; mô hình (tình tượng + LLM fallback) được chuyển sang bất kỳ máy tính kế hoạch HTN nào.
- **AlphaEvolve** Tác phẩm DeepMind; mô hình (ensemble + evaluator) có thể tái tạo. OpenEvolve và các cổng mở nguồn tương tự đang xuất hiện.
- **Agent frameworks** không có tàu HTN hạng nhất hoặc AlphaEvolve.

## Chuyển nó

`outputs/skill-hybrid-planner.md`tạo ra một sàn lập kế hoạch lai (HTN hoặc tiến hóa) với vai trò LLM được quy định rõ ràng.

## Các bài tập

1. Tăng kế hoạch HTN với việc theo dõi ngược: khi điều kiện sau vận hành của một nhà điều hành thất bại trong thời gian chạy, quay lại và thử phương pháp tiếp theo.
2. Thêm một bộ nhớ cache của phương pháp LLM vào ChatHTN: khi LLM phân hủy nhiệm vụ `T`theo mô hình trạng thái `P`, lưu lại kết quả. kiểm tra lại thư viện phương pháp trước khi gọi tiếp theo.
3. Thay đổi trình đánh giá tìm kiếm tiến hóa thành một bộ thử nghiệm thực tế. Phát triển một chức năng sắp xếp vượt qua 20 trường hợp thử nghiệm; báo cáo các thế hệ cho sự hội tụ.
4. Đọc các ghi chú thiết kế đánh giá của AlphaEvolve. Thiết kế một đánh giá cho một miền bạn quan tâm (tăng cường truy vấn SQL, giảm thiểu các tập hợp thử nghiệm, triển khai YAML).
5. Kết hợp: sử dụng HTN để phân hủy một nhiệm vụ hợp chất thành các nhiệm vụ phụ, sau đó sử dụng tìm kiếm tiến hóa trên các nhà khai thác nguyên thủy của mỗi nhiệm vụ phụ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## Đọc thêm

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) biểu tượng + LLM lập kế hoạch lai
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) Tìm kiếm mã tiến hóa với đột biến LLM
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) khi nào để tìm kiếm một kế hoạch cho so với một vòng lặp đơn giản
