# Mô hình giám sát viên / nhạc sĩ-người làm việc

> Một đại lý chính lập kế hoạch và đại diện; nhân viên chuyên môn thực hiện trong bối cảnh song song và báo cáo lại. Đây là mô hình đằng sau hệ thống nghiên cứu của Anthropic (Claude Opus 4 là chì, Sonnet 4 là chất phụ), được đo ở +90.2% so với Opus 4 đơn đại lý trên các đánh giá nghiên cứu nội bộ. Bài đăng kỹ thuật của Anthropic báo cáo rằng 80% sự khác biệt trên BrowseComp được giải thích bởi việc sử dụng mã chỉ riêng  đa đại lý thắng phần lớn bởi vì mỗi subagent nhận được một cửa sổ bối cảnh mới. Bài học này xây dựng mô hình giám sát từ nguyên thủy và bao gồm các bài học kỹ thuật năm 2026 từ triển khai sản xuất.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Vấn đề

Nghiên cứu là nhiệm vụ nguyên mẫu mà các hệ thống đơn tác nhân thất bại. Bạn hỏi "sự thay đổi trong các hệ thống đa tác nhân giữa năm 2023 và 2026 là gì?" Một tác nhân đơn độc đọc 5 bài báo theo trình tự, lấp đầy một nửa ngữ cảnh của nó với văn bản của chúng, và sau đó phải suy luận về tất cả chúng cùng nhau. Nó quên bài báo đầu tiên vào thời điểm đạt đến năm. Nó không thể song song.

Mô hình giám sát khắc phục điều này: một đại lý dẫn đầu lập kế hoạch tìm kiếm, ủy quyền mỗi phụ câu hỏi cho một nhân viên, và tổng hợp. Mỗi nhân viên nhận được cửa sổ mã thông báo 200k riêng cho một câu hỏi hẹp.

Hệ thống nghiên cứu sản xuất của Anthropic báo cáo +90.2% về các đánh giá nghiên cứu nội bộ so với một Opus 4. cùng một bài viết lưu ý rằng 80% sự khác biệt của BrowseComp được giải thích bởi * việc sử dụng mã chỉ riêng*.

## Khái niệm

### Mô hình

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

Các công nhân không bao giờ thấy công việc của nhau cho đến khi chì tổng hợp. Mỗi mũi tên là một giao tiếp với một đồ tạo vật hẹp.

### Tại sao nó thắng

Ba cơ chế:

1. **Fresh context per subagent.**Một công nhân khám phá "Di sản của FIPA-ACL" không mang theo 40k token đầu tư kế hoạch. Nó nhận được một cửa sổ 200k cho một câu hỏi.
2. **Specialization via prompt.**Lời nhắc của người dẫn đầu là "xử lý và tổng hợp", không phải "phát tích". Lời nhắc của mỗi người làm việc là hẹp: "để tìm ra những gì đã thay đổi trong X. " Các lời nhắc tập trung tạo ra kết quả tập trung.
3. **Parallelism.**Công nhân chạy cùng lúc.`max(worker_times) + plan + synthesis`Không .`sum(worker_times)`- Tôi không biết.

### Bài học kỹ thuật (Anthropic 2025)

Bài đăng Anthropic liệt kê một số bài học sản xuất vẫn có liên quan đến năm 2026:

- **Scale effort to query complexity.**Các câu hỏi đơn giản: một đại lý, 3-10 cuộc gọi công cụ. Các câu hỏi phức tạp: 10+ đại lý. Người dẫn đầu phải đánh giá điều này, không phải người gọi.
- **Broad then narrow.**Đầu tiên phân chia thành các câu hỏi phụ rộng, sau đó tạo ra nhiều người lao động hơn cho mỗi câu hỏi phụ nếu câu trả lời cho phép chiều sâu.
- **Rainbow deployments.**Các đại lý là lâu dài và có tính trạng thái. màu xanh lá cây truyền thống không hoạt động. Anthropic sử dụng cầu vồng: triển khai dần các phiên bản mới trong khi các phiên bản cũ cạn kiệt.
- **Token usage dominates.**Multi-agent là ~ 15x các token của single-agent. chỉ chạy nó khi giá trị nhiệm vụ biện minh cho chi phí.

### Lập trình bản địa quay

LangGraph ban đầu đã gửi một `langgraph-supervisor`thư viện có cấp cao `create_supervisor`trợ lý. Năm 2025, LangChain chuyển khuyến nghị để thực hiện mô hình giám sát thông qua gọi công cụ trực tiếp, bởi vì các cuộc gọi công cụ cung cấp nhiều quyền kiểm soát hơn về những gì giám sát thấy * (kỹ thuật ngữ). Thư viện vẫn hoạt động; các tài liệu bây giờ khuyên dùng hình thức gọi công cụ.

### Các chế độ thất bại

- **Lead hallucinates the plan.**Nếu dẫn tạo ra các câu hỏi phụ mà không phân hủy câu hỏi thực sự, nhân viên nghiên cứu chính xác về mục tiêu sai.
- **Workers over-explore.**Không có ranh giới phạm vi rõ ràng, công nhân trôi qua ngoài các phụ câu hỏi được giao cho họ và làm ô nhiễm bước tổng hợp.
- **Synthesis conflicts.**Hai công nhân trả lại những sự thật mâu thuẫn. Người dẫn đầu phải hỏi lại (chưa thêm một vòng) hoặc ghi nhận sự bất đồng rõ ràng.

### Khi người giám sát sai

- **Sequential tasks.**Nếu bước 2 thực sự cần đầu ra bước 1, song song không mua gì. Sử dụng một đường ống (CrewAI Sequential, LangGraph đồ thị tuyến tính).
- **Simple queries.**Một đại lý đơn xử lý chúng nhanh hơn và rẻ hơn.
- **Strict determinism.**Giám sát viên sử dụng ủy quyền được lựa chọn bởi LLM. Hình đồ tĩnh tốt hơn khi kiểm toán / phát lại quan trọng hơn khả năng thích nghi.

```figure
supervisor-hierarchy
```

## Hãy xây dựng nó

`code/main.py`thực hiện một giám sát viên gồm ba công nhân song song bằng cách sử dụng `threading`. Lead phân hủy một truy vấn thành các câu hỏi phụ, công nhân chạy đồng thời trên mỗi câu hỏi phụ, và lead tổng hợp. Không có LLM thực sự

Cấu trúc chính:

- `Lead.plan(query)`chia câu hỏi thành 3 câu hỏi phụ.
- `Worker.run(sub_q)`trả lại một bản tóm tắt giả (có thể là bất kỳ tác nhân sử dụng công cụ nào trong sản xuất).
- `Lead.run(query)`Thả người lao động ra trong các dây, kết hợp và tổng hợp.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả cho thấy kế hoạch, các công nhân song song theo dấu thời gian bắt đầu / kết thúc, và tổng hợp cuối cùng. Bạn có thể thấy đồng hồ tường thắng: ba công nhân 0,3 giây chạy trong ~ 0,35 giây, không phải 0,9.

## Sử dụng nó

`outputs/skill-supervisor-designer.md`thực hiện một truy vấn người dùng và tạo ra một thiết kế mô hình giám sát: prompt hệ thống dẫn đầu, vai trò của công nhân, các quy tắc phân hủy phụ câu hỏi và mẫu tổng hợp. Sử dụng điều này trước khi xây dựng một hệ thống đại lý kiểu nghiên cứu mới.

## Chuyển nó

Danh sách kiểm tra trước khi triển khai mô hình giám sát:

- **Model pairing.**Tạo nguyên tắc trên mô hình cấp độ lý luận ( lớp Opus, `o3`Các công nhân trên một mô hình nhanh hơn, rẻ hơn (Sonnet, `o4-mini`().
- **Worker timeout.**Bất kỳ công nhân nào vượt quá thời gian chạy trung bình 2x đều bị giết; người dẫn đầu hoặc tái tạo với phạm vi hạn chế hơn hoặc tiếp tục không có nó.
- **Token cap per worker.**Giới hạn cứng (chẳng hạn 10x đầu vào tổng hợp dự kiến) ngăn cản một công nhân chạy trốn khỏi phá vỡ ngân sách.
- **Observability.**Theo dõi kế hoạch của người dẫn đầu, các cuộc gọi công cụ của mỗi công nhân, và tổng hợp. Đây là cơ sở cho bất kỳ debugging hậu hoc.
- **Rainbow rollout.**Các đại lý lâu đời của tiểu bang cần chuyển đổi phiên bản dần dần, không phải đổi mới nóng.

## Các bài tập

1. Đi chạy`code/main.py`, sau đó thay đổi dẫn để sinh 5 công nhân thay vì 3. quan sát hiệu ứng đồng hồ tường.
2. Thực hiện thời gian nghỉ lao động: giết bất kỳ lao động nào chạy dài hơn 0,5 giây và cho người dẫn đầu tổng hợp kết quả còn lại.
3. Thêm một bước phát hiện xung đột vào tổng hợp của người dẫn đầu: nếu hai công nhân trả lời mâu thuẫn, người dẫn đầu ghi nhận sự bất đồng thay vì chọn một. Làm thế nào để phát hiện mâu thuẫn mà không gọi một LLM?
4. Đọc bài viết kỹ thuật hệ thống nghiên cứu của Anthropic.
5. So sánh LangGraph's `create_supervisor`(Legacy) vs. khuyến nghị gọi công cụ mới. Điều gì cho bạn kiểm soát tốt hơn những gì người giám sát thấy? Tại sao Anthropic rõ ràng chỉ chuyển các câu trả lời phụ và không phải bối cảnh người lao động thô vào tổng hợp?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Đọc thêm

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) tham chiếu sản xuất cho mô hình giám sát
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) giám sát gọi công cụ bây giờ là hình thức được khuyến cáo
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) trợ lý di sản, vẫn được sử dụng trong sản xuất năm 2026
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) Phân phiên giám sát dựa trên giao hàng
