# Các công cụ song song gọi và phát trực tuyến với các công cụ

> Ba lần tìm kiếm thời tiết độc lập được phân phối theo thứ tự là ba lần đi lại. Hãy chạy chúng song song và tổng thời gian sụp đổ đến cuộc gọi đơn giản chậm nhất. Mỗi nhà cung cấp biên giới bây giờ phát ra nhiều cuộc gọi công cụ trong một lượt.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Mục tiêu học tập

- Hãy giải thích lý do tại sao `parallel_tool_calls: true`tồn tại và khi nào để vô hiệu hóa nó.
- Kết hợp các đoạn tranh luận được phát trực tuyến với ID gọi công cụ phải trong thời gian phát fan song song.
- Lắp ráp lại phần `arguments`chuỗi thành JSON hoàn chỉnh mà không cần phân tích sớm.
- Thực hiện một điểm chuẩn thời tiết ba thành phố cho thấy độ trễ liên tục so với song song.

## Vấn đề

Không có cuộc gọi song song, một đại lý trả lời "thời tiết ở Bengaluru, Tokyo và Zurich" làm như sau:

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

Ba chuyến đi về LLM, mỗi chuyến đi cũng trả cho thời gian trễ của người thực thi.

Với các cuộc gọi song song:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

Một chuyến đi vòng về LLM. Thời gian thực hiện là tối đa của ba, không phải tổng số. Các tiêu chuẩn sản xuất trên OpenAI, Anthropic và Gemini cho thấy giảm 60 đến 70% đồng hồ tường trên tải trọng công việc máy bay.

Giá là sự phức tạp tương quan. Khi ba cuộc gọi hoàn thành không được sắp xếp, kết quả của bạn phải mang theo sự phù hợp `tool_call_id`Khi kết quả được phát, bạn phải tập hợp các mảnh đối số một phần thành JSON hoàn chỉnh trước khi thực hiện. Gemini 3 thêm ID độc đáo một phần để giải quyết một vấn đề trong thế giới thực nơi hai cuộc gọi song song với cùng một công cụ không thể phân biệt được.

## Khái niệm

### Cho phép song song

- **OpenAI.** `parallel_tool_calls: true`mặc định.`false`để buộc hàng loạt.
- **Anthropic.**Phía song song `disable_parallel_tool_use: false`(đặc định trên Claude 3.5 trở lên).`true`cho serial.
- **Gemini.**Luôn ngang ngang;`tool_config.function_calling_config.mode = "AUTO"`để người mẫu quyết định.

Thiết lập song song khi các công cụ có phụ thuộc sắp xếp (`create_file`Vậy thì`write_file`), khi đầu ra của một cuộc gọi thông báo đầu vào của một cuộc gọi khác, hoặc khi giới hạn tốc độ không thể xử lý máy hâm mộ.

### Tương quan ID

Mỗi cuộc gọi mà mô hình phát ra đều có một`id`. Mỗi kết quả mà máy chủ trả lại phải có cùng một ID. Nếu không có nó, kết quả là mơ hồ.

- **OpenAI.** `tool_call_id`trên mỗi thông điệp vai trò công cụ.
- **Anthropic.** `tool_use_id`trên mỗi `tool_result`- Quận.
- **Gemini.** `id`trên mỗi `functionResponse`(Them 3 trở lên; Gemini 2 phù hợp theo tên mà phá vỡ cho cùng tên gọi cuộc gọi song song).

### Tiếp tục gọi đồng thời

Người chủ chạy trình thực hiện mỗi cuộc gọi trên dây chuyền riêng, coroutine hoặc người làm việc từ xa.`asyncio.gather`hoặc cấu trúc đồng thời. Trật tự hoàn thành là không thể đoán trước  ID là nhận dạng.

Một lỗi phổ biến: trả lời với kết quả theo thứ tự danh sách gọi thay vì thứ tự hoàn thành.`tool_call_id`, nhưng nếu kết quả bị bỏ rơi hoặc sao chép, một danh sách trả lời được sắp xếp lại khỏi thứ tự kết quả đã đến làm cho khoảng cách khó tìm thấy trong nhật ký.

### Các cuộc gọi của công cụ streaming

Khi mô hình phát sóng,`arguments`3 dòng phân mảnh riêng biệt cho 3 cuộc gọi song song để liên lạc trên dây.

Hình dạng theo nhà cung cấp:

- **OpenAI.**Mỗi mảnh đều là`choices[0].delta.tool_calls[i].function.arguments`(câu phần) Phần này mang theo`index`(trọng điểm trong danh sách gọi). Bạn tích lũy cho mỗi chỉ số, đọc `id`khi nó xuất hiện lần đầu tiên, và phân tích JSON khi `finish_reason = "tool_calls"`- Tôi không biết.
- **Anthropic.**Các sự kiện phát sóng là `message_start`, sau đó là một `content_block_start`mỗi khối với loại `tool_use`(có chứa ID, tên, nhập trống). `content_block_delta`các sự kiện mang theo`input_json_delta`- Bọn nó.`content_block_stop`đóng cửa từng khu phố.
- **Gemini.** `streamFunctionCallArguments`(Thiêm tinh 3 trở lên) phát ra các mảnh với một `functionCallId`Trước khi Gemini 3, streaming trả lại một cuộc gọi hoàn chỉnh một lần.

### JSON một phần và bẫy phân tích sớm

Anh không thể phân tích được.`arguments`cho đến khi nó hoàn thành.`{"city": "Beng`là không hợp lệ và sẽ tăng. Cổng chính xác là tín hiệu kết thúc cuộc gọi của nhà cung cấp: OpenAI `finish_reason = "tool_calls"`, Anthropic's `content_block_stop`, hoặc sự kiện cuối dòng chảy của Gemini.`json.loads`Một cách tiếp cận mạnh hơn sử dụng một trình phân tích JSON tăng cường tạo ra các sự kiện khi cấu trúc hoàn thành; hướng dẫn phát trực tuyến của OpenAI khuyên dùng điều này cho UX hiển thị một chỉ số "thinking" trực tiếp. Brace-counting không đáng tin cậy như một bài kiểm tra tính hoàn chỉnh (những brace bên trong chuỗi trích dẫn hoặc nội dung thoát gây ra dương tính sai) và chỉ nên được sử dụng như một heuristic debug không chính thức.

### Việc hoàn thành ngoài trật tự

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

Câu trả lời chủ nhà vẫn phải trích dẫn các ID:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

Trật tự trong câu trả lời không quan trọng cho sự chính xác trên OpenAI hoặc Anthropic. Gemini chấp nhận bất kỳ lệnh nào miễn là ID phù hợp.

### Điểm chuẩn: theo trình tự đối với song song

Lăng trong `code/main.py`mô phỏng ba trình thực với độ trễ 400, 600 và 800 ms. Tiếp theo chạy nó trong tổng 1800 ms. song song chạy nó trong max ((400, 600, 800) = 800 ms. Sự khác biệt là không tương xứng, vì vậy tiết kiệm tăng lên với số lượng công cụ.

Cảnh báo trong thế giới thực: các cuộc gọi song song nhấn mạnh các API dòng chảy xuống. Một fan-out 10 chiều cho một dịch vụ giới hạn tốc độ sẽ thất bại. Giai đoạn 13 · 17 bao gồm áp lực ngược ở cấp cửa khẩu; thử lại ngữ nghĩa được lên kế hoạch cho một giai đoạn tương lai.

### Streaming fan-out tường đồng hồ

Nếu mô hình tự phát, bạn có thể bắt đầu thực hiện ngay khi các lập luận của một cuộc gọi hoàn thành, thay vì chờ đợi tất cả các cuộc gọi hoàn thành. Đây là một tối ưu hóa tài liệu OpenAI nhưng không phải tất cả SDK lộ ra.

```figure
tp-parallel-fanout
```

## Sử dụng nó

`code/main.py`có hai nửa. đầu tiên chạy ba cuộc gọi thời tiết mô phỏng theo trình tự và song song bằng cách sử dụng `concurrent.futures.ThreadPoolExecutor`Phần hai tái tạo phản ứng phát trực tuyến giả `arguments`cho ba cuộc gọi song song được giao tiếp trên một dòng  và lắp ráp lại chúng theo ID với `StreamAccumulator`Không có LLM, không có mạng, chỉ là logic tái lắp ráp.

Những gì cần xem:

- Thời gian theo trình tự đạt 1,8 giây. Thời gian song song đạt 0,8 giây với cùng một độ trễ giả.
- Bộ tích lũy xử lý các khối đến khỏi thứ tự bằng cách bơm per-id và phân tích chỉ khi JSON của mỗi cuộc gọi hoàn thành.
- Việc thực thi bắt đầu ngay khi các lập luận của một ID hoàn tất, không phải sau khi tất cả các dòng chảy kết thúc.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-parallel-call-safety-check.md`. Với một danh sách công cụ, kiểm toán kỹ năng các công cụ nào là an toàn để song song, có phụ thuộc đặt hàng, và sẽ áp đảo các giới hạn lãi suất tiếp theo  trả lại một danh sách sửa đổi với mỗi công cụ `parallel_safe`Đường cờ.

## Các bài tập

1. Đi chạy`code/main.py`và thay đổi độ trễ mô phỏng. xác nhận rằng tỷ lệ song song với theo trình là khoảng `max/sum`(các chạy thực sự khác biệt một chút với lý tưởng do lập trình chuỗi, chuỗi và chi phí trên cáp).

2. Lớn bộ tích trữ để xử lý một trường hợp "call đã bị hủy ở giữa dòng" bằng cách thả bộ đệm của nó và phát ra một `cancelled`Chuyện này được xác định rõ ràng bởi nhà cung cấp nào?`content_block_stop`ngữ nghĩa và OpenAI `finish_reason: "length"`hành vi.

3. Thay thế hồ chứa dây bằng `asyncio.gather`Bạn nên thấy những chiến thắng nhỏ trên async vì chi phí chuyển đổi ngữ cảnh thấp hơn, nhưng chỉ khi các trình thực hiện thực hiện thực tế I / O.

4. Chọn hai công cụ mà không nên song song (ví dụ: `create_file`Vậy thì`write_file`). Thêm một `ordering_dependency`là cơ chế tối thiểu cho lập trình biết đến sự phụ thuộc, mà một giai đoạn kỹ thuật đại lý trong tương lai chính thức hóa.

5. Đọc phần gọi hàm song song của OpenAI và Anthropic `disable_parallel_tool_use`Docs. Chọn loại công cụ thực tế mà Anthropic khuyên bạn nên vô hiệu hóa sự song song. (Nhận thức: đột biến hậu quả trên cùng một nguồn tài nguyên.)

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## Đọc thêm

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) Hành vi mặc định và cờ không chọn
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) `disable_parallel_tool_use`và kết quả đợt
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) Các cuộc gọi song song liên quan đến ID từ Gemini 3
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) Phục bộ lập luận lại cho các dòng OpenAI
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) `content_block_delta`với `input_json_delta`
