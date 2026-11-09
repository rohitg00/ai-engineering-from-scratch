# Các mô hình quy trình làm việc của Anthropic: đơn giản hơn phức tạp

> Schluntz và Zhang (Anthropic, Dec 2024) phân biệt các dòng công việc (các con đường được xác định trước) với các đại lý (phương tiện sử dụng động lực). Năm mô hình dòng công việc bao gồm hầu hết các trường hợp. Bắt đầu với các cuộc gọi API trực tiếp. Chỉ thêm các đại lý khi không thể dự đoán các bước.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Mục tiêu học tập

- Tên năm mô hình quy trình làm việc của Anthropic: chuỗi nhanh, định tuyến, song song, nhạc công-người làm việc, đánh giá-tích cực.
- Giải thích sự khác biệt giữa người đại lý và dòng công việc và chi phí kỹ thuật của mỗi người.
- Xác định khi nào nên chọn một dòng công việc thay vì một đại lý (và ngược lại).
- Thực hiện tất cả năm mô hình trong stdlib chống lại một LLM kịch bản.

## Vấn đề

Các nhóm tìm kiếm các khung đa đại lý cho các vấn đề cần một cuộc gọi chức năng duy nhất. Chi phí là thực: các khung thêm các lớp làm mờ các yêu cầu, che giấu dòng chảy kiểm soát và mời phức tạp sớm. Bài đăng của Schluntz và Zhang tháng 12 năm 2024 là sự đẩy lùi công nghiệp được trích dẫn nhiều nhất: bắt đầu đơn giản, thêm phức tạp chỉ khi nó kiếm được chi phí của nó.

## Khái niệm

### Phòng làm việc đối với các đại lý

- **Workflow.**LLM và công cụ được sắp xếp thông qua các con đường mã được xác định trước.
- **Agent.**LLM động hướng công cụ của riêng họ và thực hiện các bước của riêng họ.

Cả hai đều có vị trí của mình. Dòng công việc rẻ hơn, nhanh hơn và dễ dàng để gỡ lỗi.

### Các LLM tăng cường

Nền tảng cho tất cả năm mô hình: một LLM với ba khả năng được kết nối trong tìm kiếm (khám), công cụ (cách), bộ nhớ (căng cường).

### 5 mô hình

1. **Prompt chaining.**Khả năng phát ra của cuộc gọi 1 là đầu vào vào cuộc gọi 2. Sử dụng khi một nhiệm vụ có sự phân hủy tuyến tính sạch. Cổng lập trình tùy chọn giữa các bước.

2. **Routing.**Một LLM phân loại chọn LLM hoặc công cụ nào để sử dụng. Sử dụng khi các đầu vào khác nhau cần xử lý khác nhau (Tiêu 1 hỗ trợ vs hoàn trả vs lỗi vs bán hàng).

3. **Parallelization.**Run N LLM gọi đồng thời, kết quả tổng hợp. Hai hình dạng: phân đoạn (các mảnh khác nhau) và bỏ phiếu (những lần nhanh chóng, N chạy, đa số / tổng hợp).

4. **Orchestrator-workers.**Một tổ chức LLM động lực quyết định những người lao động (còn LLM) để chạy và tổng hợp sản lượng của họ.

5. **Evaluator-optimizer.**Một LLM đề xuất một câu trả lời, một LLM khác đánh giá nó. lặp lại cho đến khi người đánh giá vượt qua.

### Khi các dòng công việc đánh bại các nhân viên

- **Predictable tasks.**Nếu bạn có thể liệt kê các bước, bạn nên.
- **Cost-bound tasks.**Các dòng công việc có số bước giới hạn; các đại lý có thể xoay quanh.
- **Compliance-bound tasks.**Các kiểm toán viên muốn đọc biểu đồ, không suy luận nó từ quỹ đạo.

### Khi các nhân viên đánh bại các dòng công việc

- **Open-ended research.**Khi nào bước tiếp theo phụ thuộc vào bước cuối cùng trở lại.
- **Variable-length tasks.**Những phút đến giờ làm việc mà con số bước không được biết.
- **Novel domains.**Khi bạn chưa biết đúng quy trình làm việc  khám phá trước, lập mã sau đó.

### Các đồng hành kỹ thuật ngữ

"Kỹ thuật ngữ ngữ cảnh hiệu quả cho các đại lý AI" (Anthropic 2025) chính thức hóa ngành học liền kề: cửa sổ 200k là ngân sách, không phải là một thùng chứa. Những gì cần bao gồm, khi nào để nén, khi nào để để ngữ cảnh phát triển. Được bao gồm chi tiết trong bài học giai đoạn 14 về nén ngữ cảnh (Phase 14 bài học trước đây 06 trong chương trình giảng dạy này trước khi đổi số).

```figure
workflow-chain
```

## Hãy xây dựng nó

`code/main.py`thực hiện tất cả năm mô hình lưu lượng làm việc chống lại một `ScriptedLLM`- Có thể là:

- `prompt_chain(input, steps)` theo trình tự.
- `route(input, classifier, handlers)` Định dạng + vận chuyển.
- `parallel_vote(prompt, n, aggregator)` N chạy, tổng hợp.
- `orchestrator_workers(task, workers)` Nhà dàn nhạc chọn công nhân.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` vòng lặp cho đến khi vượt qua.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Mỗi mô hình in dấu vết của nó. Tổng số các dòng mã cho mỗi mô hình là ~ 10-15; chi phí của một khung được đo bằng hàng ngàn.

## Sử dụng nó

- API trực tiếp yêu cầu hầu hết các nhiệm vụ.
- Quadro chỉ khi mô hình thực sự cần trạng thái bền (LangGraph), đồng thời mô hình diễn viên (AutoGen v0.4), hoặc mô hình vai trò (CrewAI).
- Hãy tìm SDK của Claude Agent khi bạn muốn hình dạng của Claude Code mà không cần xây dựng lại nó.

## Chuyển nó

`outputs/skill-workflow-picker.md`chọn mô hình phù hợp cho mô tả nhiệm vụ nhất định, bao gồm lý do lý luận quyết định và con đường chuyển đổi đến một đại lý nếu các dòng công việc không đạt được kết quả.

## Các bài tập

1. Thực hiện định tuyến với ngưỡng độ tin cậy. dưới ngưỡng -> leo thang lên con người. Điểm ngưỡng cho trường hợp sử dụng hỗ trợ cấp 1 nằm ở đâu?
2. Thêm thời gian nghỉ `parallel_vote`Điều gì xảy ra khi một cuộc gọi bị treo? Làm thế nào để tổng hợp với số phiếu bị bỏ phiếu?
3. Chuyển đi`evaluator_optimizer`trong một tên cướp: giữ cho đầu 2 đầu ra trên các lần lặp lại để kết quả tốt muộn không bị ghi lại bởi một kết quả xấu muộn.
4. Kết hợp chuỗi nhanh với định tuyến: một router chọn một trong ba chuỗi. đo chi phí token so với một lựa chọn thay thế lớn.
5. Chọn một trong những tính năng sản xuất của bạn vẽ biểu đồ quy trình làm việc đếm bước liệu một đại lý thực sự tốt hơn ở đây?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | "Predefined flow" | Engineer-owned graph of LLM and tool calls |
| Agent | "Autonomous AI" | Model-owned graph; dynamic tool direction |
| Augmented LLM | "LLM with tools" | LLM + search + tools + memory; the atomic unit |
| Prompt chaining | "Sequential calls" | Output of call N is input to call N+1 |
| Routing | "Classifier dispatch" | Pick which chain/model handles the input |
| Parallelization | "Fan out" | N concurrent calls; aggregate by sectioning or voting |
| Orchestrator-workers | "Dispatcher agent" | Orchestrator LLM picks specialist LLMs dynamically |
| Evaluator-optimizer | "Proposer + judge" | Iterate until evaluator passes; Self-Refine generalized |

## Đọc thêm

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) 5 mô hình quy trình làm việc
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) kỷ luật đối tác
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) khi biểu đồ trạng thái kiếm được chi phí của họ
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) mô hình nhạc công-người lao động, sản xuất
