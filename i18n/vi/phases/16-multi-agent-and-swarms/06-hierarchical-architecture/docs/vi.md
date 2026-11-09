# Kiến trúc cấp bậc và cách thất bại của nó

> Các nhà quản lý là những người quản lý, các nhân viên quản lý là những người quản lý.`Process.hierarchical`là phiên bản sách giáo khoa: a `manager_llm`Động lực phân bổ nhiệm vụ và xác nhận đầu ra.`create_supervisor(create_supervisor(...))`. Đây là mô hình tự nhiên khi công việc là một biểu đồ cơ cấu thực tế. Nó cũng là mô hình có nhiều khả năng sụp đổ vào vòng lặp quản lý.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern)
**Time:** ~60 minutes

## Vấn đề

Khi mô hình giám sát viên được nhấp vào, bước tiếp theo là "vì những người lao động tự mình là giám sát viên?" Các nhóm có các nhóm phụ; các công ty có các bộ phận của các bộ phận. Các kiến trúc hàng đầu phản ánh điều đó.

Vấn đề: Các nhà quản lý LLM không giống như các nhà quản lý con người. Một nhà quản lý con người có tiền lệ ổn định về những gì báo cáo của họ biết. Một nhà quản lý LLM tái hợp lý luận về tổ chức mỗi lần từ bất cứ điều gì trong bối cảnh của nó. Sự trôi dạt nhỏ trong bối cảnh đó, và toàn bộ cây phân bổ sai trái công việc.

## Khái niệm

### Hình dạng

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

Mỗi nút nội bộ lập kế hoạch, đại diện và tổng hợp.

### Ở nơi nó tỏa sáng

- **Clear org mapping.**Nếu nhiệm vụ thực sự là bộ phận ("sự xem xét pháp lý tài liệu, tài chính xem xét tài liệu, kỹ thuật xem xét tài liệu, sau đó tóm tắt cho exec"), hệ thống phân cấp là rõ ràng.
- **Local summarization.**Mỗi người phụ quản lý tổng hợp sản lượng của nhóm trước khi người quản lý hàng đầu nhìn thấy nó. Người quản lý hàng đầu nhìn thấy ba bản tóm tắt của người phụ quản lý, chứ không phải mười lăm sản lượng của công nhân.

### Khi nó vỡ

Ba chế độ thất bại các bài kiểm tra sau năm 2026 tiếp tục tìm thấy:

1. **Task assignment error.**Người quản lý đọc mục tiêu, ảo giác phân hủy và ủy thác cho người quản lý phụ sai. Bởi vì người quản lý phụ tuân thủ làm việc trên những gì nó đã được trao, lỗi chỉ xuất hiện ở tổng hợp trên cùng một cấp độ xa nơi mà một con người có thể đã bắt được nó.
2. **Output misinterpretation.**Sub-manager trả lại "không thể xác minh yêu cầu X". Top manager tóm tắt như " yêu cầu X không được xác nhận. " Ý nghĩa biến động ở mọi cấp độ.
3. **Consensus loops.**Hai người phụ quản lý không đồng ý; người quản lý hàng đầu yêu cầu họ hòa giải; họ chuyển nhượng lại; nhân viên chạy lại; người phụ quản lý trả lời khác nhau một chút; vòng lặp.`Process.hierarchical`Có những biện pháp bảo vệ chống lại điều này với giới hạn bước, nhưng giới hạn chính nó bây giờ là một siêu tham số.

### Câu hỏi quyết định

Tiếp theo (hạch đường ống) vs bậc phân cấp: nhiệm vụ của bạn có thực sự có các nhóm phụ độc lập, hoặc nó là một dòng dòng tuyến tính giả vờ là một cây? Nếu thứ hai, sử dụng thứ tự. Nếu thứ nhất, sử dụng các quy tắc hòa giải bậc phân cấp nhưng ngân sách rõ ràng.

### Thực hiện khung vai trò

Đội ngũ của CrewAI `Process.hierarchical`Người quản lý:

- nhận nhiệm vụ cấp cao,
- Đề xuất các nhiệm vụ phụ cho các phi hành đoàn,
- đánh giá các sản phẩm của phi hành đoàn,
- quyết định xem phải chấp nhận, đại diện lại hay lặp lại.

Tài liệu: https://docs.crewai.com/en/introduction(đ tìm "Phương trình hàng bậc" trong các khái niệm cốt lõi).

### Thực hiện khung đồ thị

LangGraph sử dụng nested `create_supervisor`Người giám sát bên trong có biểu đồ riêng của mình; người giám sát bên ngoài xử lý biểu đồ bên trong như một nút không rõ ràng. Điều này sạch hơn CrewAI để gỡ lỗi (bạn có thể bước qua mỗi biểu đồ riêng biệt) nhưng khó khăn hơn để thể hiện sự tái định hình động của cây.

Đề xuất: https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## Hãy xây dựng nó

`code/main.py`chạy một hệ thống phân cấp 3 cấp:

- Giám đốc cấp cao: chia một nhiệm vụ thành các ngành "kỹ thuật" và "quyền",
- Phó quản lý kỹ thuật: chia thành công nhân "phát" và "phát",
- Phó giám đốc pháp lý: một nhân viên.

Demo tương phản happy path (tất cả mọi người đồng ý) với một **perturbed path**khi phân hủy của người quản lý hàng đầu ghi sai " hợp pháp" là " tài chính" và xem các lỗi hàng loạt  người phụ quản lý vâng lời làm việc tài chính, bộ tổng hợp hàng đầu báo cáo kết quả tài chính, câu hỏi pháp lý ban đầu không được trả lời.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả cho thấy cả hai con đường với một bên cạnh rõ ràng của "cái gì đã được yêu cầu" vs "cái gì đã được giao".

## Sử dụng nó

`outputs/skill-hierarchy-fitness.md`đánh giá liệu một nhiệm vụ nhất định có nên sử dụng trình tự phân cấp, trình tự hoặc giám sát phẳng không. Các đầu vào: mô tả nhiệm vụ, cấu trúc tổ chức, ngân sách hòa giải.

## Chuyển nó

Nếu bạn vận chuyển hàng bậc:

- **Cap tree depth at 2.**Ba cấp độ đã che giấu hầu hết các lỗi khỏi khả năng quan sát.
- **Explicit reconciliation budget.**Đặt tối đa các vòng trước khi người quản lý hàng đầu phải cam kết.
- **Provenance on every synthesis.**Kết luận của mỗi nút phải nêu ra các sản phẩm từ lá nào đã tạo ra nó.
- **Alert on decomposition drift.**Lập mục phân hủy của quản lý theo từng bước; khác với truy vấn của người dùng. Nếu phân hủy không còn bao gồm truy vấn, hãy kích hoạt cảnh báo.

## Các bài tập

1. Đi chạy`code/main.py`và so sánh happy vs disturbed. cần bao nhiêu cấp độ quản lý giao ra trước khi đầu ra hàng đầu hoàn toàn khác biệt với câu hỏi của người dùng?
2. Thêm một cấp độ thứ ba (trên → dưới → dưới → người lao động). đo đạc số lần con đường bị nhiễu loạn tự sửa chữa và hoàn toàn khác nhau khi độ sâu tăng lên.
3. Thực hiện một nhân viên "canary" tại mỗi người quản lý phụ luôn được hỏi câu hỏi người dùng ban đầu không thay đổi. Sử dụng câu trả lời canary để phát hiện sự trôi dạt phân hủy. Người quản lý nên phản ứng như thế nào khi canary không đồng ý với câu trả lời tổng hợp?
4. Đọc CrewAI `Process.hierarchical`Docs. xác định một màn chắn bê tông CrewAI áp dụng (khuyết hạn bước, quản lý_llm) và mô tả chế độ thất bại mà nó nhắm mục tiêu.
5. So sánh các giám sát viên LangGraph nhúng với hệ thống phân cấp CrewAI.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hierarchical | "Org chart pattern" | Supervisors over supervisors; only leaves do work. |
| Manager LLM | "The boss" | The LLM that decomposes, assigns, and validates at an internal node. |
| Decomposition drift | "The boss lost the plot" | Top manager's split no longer covers the original question. |
| Reconciliation loop | "Endless meetings" | Sub-managers disagree; top re-delegates; workers re-run; loop until budget exhausted. |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | Empirical guardrail: 3+ levels collapses observability. |
| Canary question | "Ground truth at every level" | A worker that is always asked the original query unchanged, to detect drift. |
| Provenance chain | "Who said what" | Trace from each synthesis back to the leaf outputs that produced it. |

## Đọc thêm

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) sách giáo khoa bậc bậc với một quản lý LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) giám sát viên tổ hợp qua `create_supervisor`
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system) tại sao Anthropic cố ý chọn giám sát viên phẳng hơn là cấp bậc
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Định dạng phân loại MAST; phần về các thất bại phối hợp tài liệu phân hủy
