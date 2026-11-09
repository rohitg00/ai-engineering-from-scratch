# Prefix-Cache Serving  RadixAttention và KV Reuse

> Chế độ dự trữ KV như một tài nguyên có thể sử dụng lại được lưu trữ trong một cây gốc, và thay đổi lịch trình với nó: thay vì FCFS (lần đầu tiên đến, lần đầu tiên phục vụ) như các lịch trình vLLM, một lập trình viên có ý thức về cache ưu tiên các yêu cầu với các phụ đề chia sẻ dài hơn  hiệu quả là một chiều sâu đầu tiên xuyên qua gốc để các nhánh nóng vẫn ở trong HBM. SGLang là động cơ đã xây dựng phục vụ cho ý tưởng này. Trên Llama 3.1 8B với các lời nhắc 1K giống như ShareGPT, SGLang đạt ~ 16.200 tok/s đến ~ 12.500 vLLM, một cạnh ~ 29%. Với khối lượng công việc RAG nặng tiền tố, lợi thế đạt 6,4x. Trên các khối lượng công việc hình dạng nhượng bộ giọng nói, tỷ lệ truy cập cache đã được xóa 86%. Được triển khai trên 400.000+ GPU vào năm 2026 trên xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS. Vấn đề là số 6.4x bị biến mất khi lệnh tiền tố không phù hợp.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Mục tiêu học tập

- Chụp đồ họa RadixAttention: cách các tiền tố được lưu trữ trong một cây radix và cách các khối KV được chia sẻ qua các chuỗi có gốc cùng một nhánh.
- Giải thích lập trình biết cache và tại sao FCFS là sai đối với giao thông cao tiền tố.
- Xét tốc độ dự kiến cho khối lượng công việc với tốc độ hit prefix-cache và phân phối chiều dài nhanh chóng.
- Hãy cho tên kỷ luật đặt hàng nhanh cho số 6.4x thực với một lợi thế bị mất.

## Vấn đề

Các ứng dụng truyền thống xử lý mỗi yêu cầu như là không minh bạch. Ngay cả khi 5.000 yêu cầu RAG tất cả bắt đầu với cùng một yêu cầu hệ thống 2.000 token cộng với nguyên tắc lấy lại tương tự, vLLM điền trước 2000 token tiền tố 5.000 lần. GPU làm việc tương tự nhiều lần.

Quan sát: các yêu cầu trong tải công việc của agentc và RAG hầu như luôn chia sẻ các tiền đề dài. Các yêu cầu hệ thống, các sơ đồ công cụ, vài lần chụp ví dụ, tiêu đề truy xuất, lịch sử cuộc trò chuyện  tất cả lặp lại qua các yêu cầu. Nếu bạn lưu trữ bộ nhớ cache KV cho tiền đề đó một lần và sử dụng lại, bạn sẽ không phải điền lại nó một lần nữa.

RadixAttention thực hiện chính xác điều này. Các mã thông báo được lập chỉ mục trong một cây gốc; mỗi nút sở hữu các khối KV cho chuỗi mã thông báo trên con đường của nó từ gốc. Một yêu cầu mới đi qua cây: bất kỳ nút nào có mã thông báo phù hợp lại sử dụng các khối KV của nút đó. Chi phí điền trước trở nên tương xứng với hậu tố "mới", chứ không phải yêu cầu đầy đủ.

Thách thức là lập lịch. Nếu hai yêu cầu chia sẻ 2000 mã thông báo trước và một thứ ba chia sẻ chỉ 200 mã thông báo của cùng một mã thông báo trước, bạn muốn phục vụ hai yêu cầu chia sẻ dài cùng nhau để các mã thông báo trước dài vẫn ở trong HBM. FCFS làm ngược lại  nó phục vụ ai đến đầu tiên, có khả năng trục xuất chi nhánh nóng trước khi yêu cầu dài tiếp theo đạt được.

## Khái niệm

### Cây gốc như một chỉ số KV

Một cây gốc (trie nhỏ gọn) lưu trữ chuỗi token. Mỗi nút sở hữu một phạm vi token và các khối KV được tính toán cho phạm vi đó. Trẻ em mở rộng chuỗi một hoặc nhiều token.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

Một yêu cầu mới được gửi với hệ thống prompt + "Context: <doc A>" + "Question: Carol". Scheduler chạy: hệ thống prefix phù hợp (124 khối được sử dụng lại), doc-A nhánh phù hợp (31 khối được sử dụng lại), sau đó chỉ phân bổ các khối mới cho "Question: Carol" (4 khối). Chi phí prefill: 4 khối mã thông báo mới. Không cây: 160 khối. ~40x tiết kiệm trên prefill.

### Lịch trình lưu trữ

Việc tái sử dụng được hỗ trợ bởi Radix Tree là vô ích nếu bộ nhớ cache bị hỏng.

1. **Depth-first dispatch**Khi chọn yêu cầu tiếp theo từ hàng, hãy chọn yêu cầu được gốc ở cùng một nhánh với bộ chạy hiện tại. Điều này giữ cho nhánh nóng bị gắn.
2. **LRU at branch level, not block level**. Tránh ra toàn bộ nhánh (bắt đầu từ lá ngắn nhất sử dụng) thay vì các khối riêng lẻ, do đó hình dạng cache phù hợp với hình dạng gốc.

FCFS vi phạm cả hai, một yêu cầu chia sẻ 2.000 token nằm phía sau một yêu cầu chia sẻ 50, sau đó chi nhánh 2.000 token bị đuổi để chấp nhận một token 50.

### Số điểm chuẩn bạn nên ghi nhớ

- Llama 3.1 8B, H100, ShareGPT 1K yêu cầu: SGLang ~ 16,200 tok/s so với vLLM ~ 12,500 (~ 29% cạnh).
- RAG nặng tiền tố (hình thức tương tự + tài liệu tương tự, câu hỏi khác nhau): lên đến 6,4x trên SGLang.
- Nồng độ công việc nhân bản giọng nói: 86,4% tỷ lệ hit prefix-cache.
- Tỷ lệ sản xuất đạt được trên khách hàng SGLang: 50-99% tùy thuộc vào kỷ luật nhanh chóng.
- Được triển khai trên 400.000+ GPU vào năm 2026.

### Việc đặt hàng đã làm cho anh

Số 6.4x dựa trên đơn đặt hàng mẫu đơn giản nhất quán. Nếu khách hàng của bạn xây dựng các đơn giản như `[system, tools, context, history, question]`trong một số yêu cầu và `[system, context, tools, history, question]`Trong những người khác, cây không thể tìm thấy tiền tố được chia sẻ.

Chế độ đầu tư của kỹ sư: mẫu yêu cầu của bạn là một khóa cache. Dũng chỉnh thứ tự. Đặt mọi thứ không thay đổi (hệ thống, công cụ, sơ đồ) trước. Đặt ngữ cảnh tìm kiếm tiếp theo. Đặt câu hỏi người dùng cuối cùng. Đừng để nội dung động vào tiền tố.

Trường hợp thực tế từ nghiên cứu: di chuyển nội dung động ra khỏi tiền tố có thể lưu trữ trong cache đã mất một triển khai từ 7% đến 74% tỷ lệ hit cache trong một thay đổi.

### Ở đâu RadixAttention thắng và thua

Chiến thắng:
- RAG (chương tự thu thập cùng một câu hỏi khác nhau).
- Các đại lý (chương trình công cụ tương tự, truy vấn khác nhau).
- Nói chuyện với hệ thống nhanh chóng.
- Lượng công việc bằng giọng nói / thị giác với các đoạn văn lặp đi lặp lại.

Thiệt (tái trở lại mức độ thông qua vLLM):
- Sản xuất một lần với các yêu cầu độc đáo (sự hoàn thành mã, trò chuyện mở không cần yêu cầu hệ thống).
- Các lệnh động động nơi mỗi yêu cầu liên kết nội dung độc đáo vào tiền tố.

### Tại sao đây là một vấn đề lập trình, không chỉ là một vấn đề hạt nhân

Bạn có thể thực hiện KV tái sử dụng như một thủ thuật hạt nhân. Nhìn sâu của SGLang là việc tái sử dụng chỉ trả tiền nếu lập trình viên giữ cho chi nhánh nóng cư trú. Chính sách " tái sử dụng nếu có sẵn" ngây thơ sẽ làm tăng bộ nhớ cache dưới tải hỗn hợp.

### Sự tương tác với vLLM

Hai hệ thống này không phải là đối thủ cạnh tranh nghiêm ngặt.`--enable-prefix-caching`Vỗng trống đã đóng nhưng không biến mất hoàn toàn  toàn bộ hàng SGLang là radix-first; vLLM ghép nó vào. Đối với tải trọng công việc bị chi phối bởi việc tái sử dụng tiền tố, SGLang vẫn là mặc định. Đối với các mục đích chung không có mô hình tiền tố mạnh mẽ, vLLM vẫn bằng hoặc tốt hơn.

```figure
roofline
```

## Sử dụng nó

`code/main.py`thực hiện một bộ nhớ cache KV toy radix-tree cộng với một trình lập lịch với hai chính sách: FCFS và cache-aware. chạy tải trọng công việc tương tự qua cả hai, báo cáo tỷ lệ hit prefix-cache và thông suất delta. Sau đó chạy một tải trọng công việc "scrambled ordering" để hiển thị sự sụp đổ 6.4x.

- [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=4096)máy hiển thị bộ nhớ cache radix trên một chạy thực tế L4. Bốn nhóm mỗi có hệ thống nhắc 4.096 token riêng của họ. yêu cầu đầu tiên của một nhóm tính toán lời nhắc của mình. Trong khi lời nhắc đó vẫn ở trong bộ nhớ cache, yêu cầu sau đó của nhóm tính toán chỉ câu hỏi 128 token. tắt bộ nhớ cache radix để xem trung bình token đầu tiên đi từ 479 ms đến 14.706 ms.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-radix-scheduler-advisor.md`. Với mô tả khối lượng công việc (phương dạng mẫu đơn giản, mô hình thu hồi, số lượng người thuê cùng lúc), nó tạo ra một đơn đặt hàng đơn giản và một đi/không đi cho việc chấp nhận SGLang.

## Các bài tập

1. Đi chạy`code/main.py`. So sánh FCFS và cache-aware trên cùng tải trọng công việc.
2. Thay đổi tải trọng để các yêu cầu chuyển đổi ngẫu nhiên `[system, tools, context]`- Chuyện gì xảy ra với tốc độ?
3. Xét chi phí HBM của việc giữ một hệ thống lập tức 2.000 token cư trú như một nhánh radix trên Llama 3.1 8B. So sánh với chi phí của một lô 16 chuỗi mà không sử dụng lại tiền đề.
4. Đọc bài báo SGLang RadixAttention. Giải thích bằng ba câu tại sao việc xả lôi lôi lôi lôi lôi hình cây hơn việc xả lôi lôi lôi lôi lôi lôi lôi lôi lôi lôi lôi lôi lôi dưới khối lượng nặng.
5. Một khách hàng báo cáo chỉ 8% tỷ lệ cache hit.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## Đọc thêm

- [SGLang GitHub](https://github.com/sgl-project/sglang) nguồn và tài liệu.
- [SGLang documentation](https://sgl-project.github.io/) RadixCông tâm và chi tiết lịch trình.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) tham chiếu thiết kế.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) Số điểm tham chiếu và lý do lập trình viên.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) Thực hiện giống như rễ của vLLM, để so sánh.
