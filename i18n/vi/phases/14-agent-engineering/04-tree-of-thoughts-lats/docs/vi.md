# Cây của suy nghĩ và LATS: Tìm kiếm cố ý

> Một đường đi chuỗi suy nghĩ duy nhất không có chỗ để quay trở lại. ToT (Yao et al., 2023) biến suy luận thành một cây với đánh giá tự trị trên mỗi nút. LATS (Zhou et al., 2024) thống nhất ToT với ReAct và Reflexion trong Monte Carlo Tree Search. Game of 24 tăng từ 4% (CoT) lên 74% (ToT); LATS đạt 92,7% pass@1 trên HumanEval.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## Mục tiêu học tập

- Lý luận khung như tìm kiếm: nút là "lưu ý", cạnh là "lớn rộng", giá trị là "cảm ơn".
- Thực hiện tìm kiếm cây BFS kiểu stdlib ToT với điểm tự đánh giá.
- Tăng đến một vòng lặp LATS MCTS đồ chơi với chọn / mở rộng / mô phỏng / đẩy ngược.
- Quyết định khi nào tìm kiếm có giá trị nhân mã (Game of 24, code generation) và khi nào một quỹ đạo đơn giản là đủ (Question & Answer đơn giản).

## Vấn đề

Đường dây tư duy là một bước đi tuyến tính. Nếu bước đầu tiên sai, mỗi bước tiếp theo hoạt động trên một giả định xấu. Trong Game of 24 (tiêu dùng bốn chữ số với + − × ÷ để tạo ra 24), GPT-4 CoT đạt độ chính xác 4% . Mô hình chọn sự phản ánh sai sớm và không thể phục hồi.

Điều cần thiết để suy luận là khả năng đề xuất nhiều ứng cử viên, đánh giá họ, chọn những ứng cử viên hứa hẹn và quay lại khi những kết cục chốt xuất hiện.

## Khái niệm

### Cây của tư tưởng (Yao et al., NeurIPS 2023)

Mỗi nút là một bước trung gian liên kết ("một suy nghĩ"). Mỗi nút có thể mở rộng đến suy nghĩ của trẻ em K. LLM tự đánh giá mỗi nút với một lời nhắc điểm. Tìm kiếm khám phá cây  BFS, DFS hoặc chùm.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

Thử nghiệm tự đánh giá là một phần chịu tải.`sure / likely / impossible`phân loại, `1..10`Tất cả ba đều đánh bại CoT đáng kể trong Game of 24 (4% -> 74% với GPT-4).

### LATS (Zhou et al., ICML 2024)

LATS thống nhất ToT, ReAct và Reflexion dưới MCTS. LLM đóng ba vai trò:

- **Policy**: đề xuất ứng cử viên các hành động tiếp theo (tương tự như ReAct).
- **Value function**: ghi một quỹ đạo một phần (Tô-T tự-tỷ lệ).
- **Self-reflector**: khi thất bại, viết một phản ánh ngôn ngữ tự nhiên (tương tự như phản ánh) và sử dụng nó để xem xét lại các triển khai trong tương lai.

Phản hồi môi trường (sự quan sát) trộn vào hàm giá trị để tìm kiếm được thông báo bởi kết quả công cụ thực tế, không chỉ là ý kiến mô hình. Kết quả trong thời gian giấy: HumanEval pass@1 92.7% với GPT-4 (SOTA), WebShop trung bình 75.9 với GPT-3.5 (chấp cận điều chỉnh dựa trên gradient).

### MCTS, tối thiểu

Bốn giai đoạn cho mỗi lần lặp lại:

1. **Select** đi từ gốc đến lá bằng cách sử dụng UCT (tự tin trên kết nối với cây).
2. **Expand** sinh ra con K thông qua chính sách.
3. **Simulate** triển khai từ một đứa trẻ sử dụng chính sách, ghi điểm với hàm giá trị (hoặc phần thưởng môi trường).
4. **Backpropagate** cập nhật số lượng truy cập và ước tính giá trị trên con đường.

Công thức UCT: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`Từ đầu tiên là khai thác; từ thứ hai là khám phá.`c`cho mỗi nhiệm vụ.

### Thực tế chi phí

Tìm kiếm nổ token. ToT trên Game of 24 sử dụng 1001000x các token của CoT. LATS tương tự.

- Nhiệm vụ khi một quỹ đạo duy nhất là không đủ (Game of 24, mã phức tạp).
- Nhiệm vụ mà thời gian tường ít quan trọng hơn sự chính xác.
- Nhiệm vụ với hàm giá rẻ, đáng tin cậy (thử nghiệm đơn vị cho mã, mục tiêu rõ ràng cho toán học).

Nếu nhiệm vụ của bạn có một câu trả lời đúng và một đánh giá ồn ào, tìm kiếm thường làm cho mọi thứ tồi tệ hơn  nó tìm thấy một câu trả lời sai "được điểm tốt".

### Định vị 2026

Hầu hết các đại lý sản xuất không chạy LATS. Họ chạy ReAct bằng cách xác minh dựa trên công cụ (CRITIC, Bài học 05).

- Các tác nhân mã hóa chạy các thử nghiệm như hàm giá trị (HumanEval-style).
- Các đại lý nghiên cứu sâu khám phá nhiều con đường truy vấn.
- Các dòng công việc có tính kế hoạch nặng trong các phụ hình LangGraph.

AlphaEvolve (Dạy 11) là cực đoan năm 2025: tìm kiếm tiến hóa về mã, tính năng phù hợp có thể kiểm tra bằng máy, tăng trưởng hàng rào (sự cải thiện đầu tiên của 4x4 trong 56 năm).

```figure
tree-of-thoughts
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- Một ToT BFS nhỏ trên một nhiệm vụ "chọn toán học".
- Một vòng lặp LATS MCTS đồ chơi trên cùng một nhiệm vụ (Hãy chọn / mở rộng / mô phỏng / đẩy ngược) với lựa chọn UCT.
- Một hàm giá trị tạo thành điểm tượng trưng cộng với điểm tự bằng.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hướng dẫn cho thấy ToT mở rộng ba ứng cử viên cho mỗi nút với BFS, so với LATS hội tụ trên việc triển khai tốt nhất thông qua MCTS.

## Sử dụng nó

LangGraph cung cấp các mẫu mẫu ToT như các mẫu phụ; blog của nhóm LangChain trên LATS (Từ 2024) là hướng dẫn tham khảo. LlamaIndex cung cấp một `TreeOfThoughts`Đối với hầu hết các đại lý sản xuất năm 2026 mô hình này sống sau một`if task_complexity > threshold: use_search()`gate  xem mô hình đánh giá- tối ưu hóa trong Bài học 05.

## Chuyển nó

`outputs/skill-search-policy.md`chọn giữa ReAct tuyến tính, ToT, LATS và tìm kiếm tiến hóa do hình dạng nhiệm vụ, ngân sách và độ trung thành của người đánh giá.

## Các bài tập

1. Lên đồ chơi LATS với UCT c=0.1 so với c=2.0.
2. Thay đổi hàm giá trị cho một điểm số ồn ào hơn (đã thêm jitter ngẫu nhiên). MCTS vẫn tìm thấy lá tốt nhất?
3. Thực hiện ToT (giữ top-k ở mỗi cấp độ) và so sánh với BFS.
4. Đọc LATS Phần 5.1. Tái tạo lại con số quỹ đạo HumanEval: cần bao nhiêu lần triển khai để đạt được thông qua được báo cáo@1?
5. Đọc bài thảo luận của LATS về "lúc nào LATS giúp ít hơn".

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tree of Thoughts | "Branching CoT" | Yao et al. — tree of thought nodes with self-evaluation |
| LATS | "MCTS for LLMs" | Zhou et al. — unifies ToT + ReAct + Reflexion under MCTS |
| UCT | "Upper confidence bound" | Select formula balancing exploitation (Q) and exploration (ln N / n) |
| Value function | "How good is this state" | Prompted LLM score or environment reward; feeds backprop |
| Policy | "Action proposer" | ReAct-style generator; emits candidate next thoughts/actions |
| Rollout | "Simulated trajectory" | Walk from a node to a leaf using policy, score with value |
| Backpropagate | "Update ancestors" | Push the leaf's reward up the path, updating visit counts and Q |
| Search cost | "Token explosion" | 100-1000x CoT on Game of 24; budget before you adopt |

## Đọc thêm

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) giấy phép
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) MCTS với phản hồi phản xạ
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) mẫu phụ hình cho tìm kiếm
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) Tìm kiếm tiến hóa với các nhà đánh giá chương trình
