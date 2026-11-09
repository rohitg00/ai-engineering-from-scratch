# ReWOO và kế hoạch và thực hiện: Kế hoạch tách rời

> ReAct kết hợp suy nghĩ và hành động trong một dòng chảy. ReWOO tách chúng ra: một kế hoạch lớn trước, sau đó thực hiện. 5 lần ít hơn các token, độ chính xác +4% trên HotpotQA, và bạn có thể chưng cất kế hoạch thành một mô hình 7B. Plan-and-Execute tổng quát nó; Plan-and-Act quy mô nó đến định hướng web.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Mục tiêu học tập

- Giải thích tại sao chia kế hoạch / công nhân / giải pháp của ReWOO tiết kiệm token và cải thiện độ bền hơn vòng lặp liên kết của ReAct.
- Thực hiện một kế hoạch DAG, một trình thực hiện theo lệnh phụ thuộc, và một giải pháp tạo ra các sản xuất nhân viên  tất cả stdlib.
- Quyết định khi nào một nhiệm vụ nên chạy như kế hoạch sau đó thực hiện vs ReAct liên kết, sử dụng khung năm 2026 "lên tục luồng công việc" (Anthropic).
- Nhận ra khi nào dữ liệu kế hoạch tổng hợp của Plan-and-Act cần thiết cho các công việc web hoặc di động dài hạn.

## Vấn đề

Loop suy nghĩ-cách-bản lý quan sát của ReAct là đơn giản và linh hoạt, nhưng mỗi cuộc gọi công cụ phải mang theo toàn bộ bối cảnh trước đó bao gồm cả mọi suy nghĩ trước đó. Việc sử dụng token tăng lên theo hình vuông với độ sâu.

ReWOO (Xu et al., arXiv:2305.18323, tháng 5 năm 2023) nhận thấy điều này và đặt cược: lên kế hoạch toàn bộ việc trước, lấy bằng chứng song song, soạn câu trả lời ở cuối. Một LLM gọi để lập kế hoạch, N công cụ gọi cho bằng chứng (có thể song song), một LLM gọi để giải quyết. Thương mại là ít linh hoạt hơn (kế hoạch là tĩnh) cho hiệu quả mã thông báo tốt hơn nhiều và các chế độ thất bại rõ ràng hơn.

## Khái niệm

### Ba vai diễn

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner tạo ra một DAG. Mỗi nút đặt tên cho một công cụ, các lập luận của nó và các nút trước đó nó phụ thuộc vào (thông tin như `#E1`- `#E2`Người lao động thực hiện các nút theo thứ tự topological.

### Tại sao 5x ít hơn các token

ReAct tăng chiều dài nhanh theo đường thẳng với số bước. Ở bước 10, prompt chứa suy nghĩ 1 cộng với hành động 1 cộng với quan sát 1 cộng với suy nghĩ 2 cộng với hành động 2 cộng với quan sát 2, v.v. Mỗi bước trung gian cũng có chứa prompt ban đầu.

ReWOO trả một đơn giản lập kế hoạch (rất lớn), N đơn giản công nhân nhỏ (mỗi đơn giản là gọi công cụ, không có chuỗi), và một đơn giản giải quyết.

### Tại sao nó mạnh hơn

Nếu worker 3 thất bại trong ReAct, vòng lặp phải lý luận ra khỏi lỗi giữa dòng. Trong ReWOO, worker 3 trả lại một chuỗi lỗi; người giải quyết thấy nó trong bối cảnh với kế hoạch ban đầu và có thể hạ thấp một cách đẹp trai.

### Phân lọc máy kế hoạch

Kết quả thứ hai của bài báo: vì người lập kế hoạch không thấy quan sát, bạn có thể tinh chỉnh mô hình 7B trên các sản phẩm lập kế hoạch từ một giáo viên 175B. mô hình nhỏ xử lý lập kế hoạch; mô hình lớn không cần thiết khi suy luận.

### Kế hoạch và thực hiện (2023)

Bài đăng tháng 8 năm 2023 của nhóm LangChain đã tổng quát ReWOO thành một tên mẫu: Plan-and-Execute. Planner phía trước phát hành danh sách bước, trình thực hiện chạy mỗi bước, một nhà lập kế hoạch lại tùy chọn có thể sửa đổi sau khi quan sát kết quả. Điều này gần hơn với ReAct hơn ReWOO (những lập kế hoạch lại đưa quan sát trở lại kế hoạch) nhưng vẫn giữ lại tiết kiệm token.

### Kế hoạch và Đạo luật (Erdogan et al., arXiv:2503.09572, ICML 2025)

Plan-and-Act quy mô mô cho các đại lý web và di động tầm xa. Sự đóng góp chính là dữ liệu kế hoạch tổng hợp: một máy phát hành quỹ đạo có nhãn sản xuất dữ liệu đào tạo khi kế hoạch rõ ràng. Được sử dụng để điều chỉnh các mô hình lập kế hoạch tiếp tục làm việc sau 3050 bước trên các nhiệm vụ giống như WebArena nơi một quỹ đạo ReAct duy nhất mất tính nhất quán.

### Khi nào để chọn

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

Chỉ dẫn của Anthropic tháng 12 năm 2024: bắt đầu với đơn giản nhất. Nếu nhiệm vụ là một cuộc gọi công cụ cộng với một bản tóm tắt, đừng xây dựng ReWOO. Nếu nhiệm vụ là một nhiệm vụ nghiên cứu 40 bước, đừng làm ReAct một mình.

```figure
rewoo-plan
```

## Hãy xây dựng nó

`code/main.py`thực hiện một đồ chơi ReWOO:

- `Planner` một chính sách kịch bản phát hành một kế hoạch DAG từ một lời nhắc.
- `Worker` gửi các nút của các công cụ gọi qua registry.
- `Solver` thành phần kịch bản đọc bằng chứng và tạo ra câu trả lời cuối cùng.
- Giải quyết phụ thuộc  tham chiếu như `#E1`được thay thế bằng sản lượng lao động trước đó.

Phản ứng biểu diễn là "Thế số dân số của thủ đô Pháp là bao nhiêu, được tròn xuống hàng triệu?" bằng cách sử dụng một kế hoạch hai bước: (1) tìm ra thủ đô, (2) tìm kiếm dân số, sau đó giải quyết.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Các dấu vết cho thấy toàn bộ kế hoạch trước, sau đó kết quả công nhân, sau đó thành phần giải pháp. So sánh số lượng mã thông báo (chúng tôi in một số chữ xấp xỉ) với một kiểu ReAct chạy được giao nhau  ReWOO thắng trên loại nhiệm vụ có cấu trúc này.

## Sử dụng nó

LangGraph tàu kế hoạch và thực hiện như một công thức (`create_react_agent`cho ReAct, đồ thị tùy chỉnh cho thực hiện kế hoạch). dòng chảy của CrewAI mã hóa mô hình trực tiếp: bạn xác định các nhiệm vụ trước và Flow DAG thực hiện chúng. Phương pháp dữ liệu tổng hợp của Plan-and-Act vẫn chủ yếu là nghiên cứu; mô hình thời gian chạy (plan DAG rõ ràng) được sản xuất thông qua LangGraph và CrewAI Flow.

## Chuyển nó

`outputs/skill-rewoo-planner.md`tạo ra một kế hoạch ReWOO DAG từ yêu cầu của người dùng, được cung cấp một danh mục công cụ. Nó xác nhận kế hoạch (acyclic, mọi tham chiếu được giải quyết, mọi công cụ tồn tại) trước khi giao cho một người thực thi.

## Các bài tập

1. Lấy các nút kế hoạch độc lập để thực hiện công việc song song.
2. Thêm một nút tái lập kế hoạch sẽ khởi động nếu bất kỳ công nhân nào trả về một lỗi.
3. Thay thế `Planner`với mô hình nhỏ (tầng 7B) và giữ `Solver`So sánh chất lượng đầu đến cuối  nơi phân chia thất bại?
4. Đọc phần 4 của bài báo của ReWOO về chưng cất kế hoạch.
5. Đưa đồ chơi vào hình dạng quỹ đạo của Plan-and-Act: kế hoạch là một chuỗi, không phải là DAG. Những sự đổi thay nào?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## Đọc thêm

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) giấy phép
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) Kiểu kế hoạch-hành động viên có kế hoạch tổng hợp
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) Công thức khung
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) chọn mô hình đơn giản nhất có hiệu quả
