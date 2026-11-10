# Chức năng gọi Deep Dive  OpenAI, Anthropic, Gemini

> Ba nhà cung cấp biên giới hội tụ trên cùng một vòng gọi công cụ vào năm 2024 và sau đó khác nhau về mọi thứ khác.`tools`và `tool_calls`- Sử dụng nhân loại`tool_use`và `tool_result`Đứa sinh đôi sử dụng`functionDeclarations`Bài học này khác biệt ba bên cạnh nhau để mã được gửi trên một nhà cung cấp không bị phá vỡ khi bạn chuyển nó.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## Mục tiêu học tập

- Cụ thể ra ba sự khác biệt hình dạng giữa OpenAI, Anthropic và Gemini gọi hàm tải trọng hữu ích (sự tuyên bố, gọi, kết quả).
- Dịch một tuyên bố công cụ trên cả ba định dạng nhà cung cấp và dự đoán những hạn chế chế chế độ nghiêm ngặt sẽ khác nhau.
- Sử dụng `tool_choice`trong mỗi nhà cung cấp để buộc, cấm, hoặc tự động chọn công cụ gọi.
- Biết các giới hạn cứng mỗi nhà cung cấp (tương tự số công cụ, độ sâu sơ đồ, chiều dài lập luận) và các chữ ký lỗi mỗi người phát ra khi các giới hạn bị vi phạm.

## Vấn đề

Các hình thức của yêu cầu gọi chức năng khác nhau theo nhà cung cấp. ba ví dụ cụ thể từ các hàng sản xuất năm 2026:

**OpenAI Chat Completions / Responses API.**Anh qua đi.`tools: [{type: "function", function: {name, description, parameters, strict}}]`Phản ứng của mô hình chứa `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`nơi `arguments`là một chuỗi JSON bạn phải phân tích.`strict: true`) thực thi tuân thủ các kế hoạch thông qua mã hóa hạn chế.

**Anthropic Messages API.**Anh qua đi.`tools: [{name, description, input_schema}]`Câu trả lời là:`content: [{type: "text"}, {type: "tool_use", id, name, input}]`- `input`đã được phân tích (một đối tượng, không phải một chuỗi). Bạn trả lời với một `user`thông điệp chứa một `{type: "tool_result", tool_use_id, content}`- Quận.

**Google Gemini API.**Anh qua đi.`tools: [{functionDeclarations: [{name, description, parameters}]}]`(đồng dưới `functionDeclarations`) Câu trả lời đến như `candidates[0].content.parts: [{functionCall: {name, args, id}}]`nơi `id`là duy nhất trong Gemini 3 và lên cho tương quan liên quan đến cuộc gọi song song.`{functionResponse: {name, id, response}}`- Tôi không biết.

Một nhóm người viết một thông báo thời tiết trên OpenAI trả tiền hai ngày cho Anthropic và một ngày khác cho Gemini chỉ vì ống nước.

Bài học này xây dựng một trình dịch mà thống nhất ba định dạng thành một tuyên bố công cụ và các tuyến đường tại cạnh.

## Khái niệm

### Cơ cấu chung

Mỗi nhà cung cấp cần 5 điều:

1. **Tool list.**Tên, mô tả và sơ đồ đầu vào mỗi công cụ.
2. **Tool choice.**Bắt buộc một công cụ cụ thể, cấm công cụ, hoặc để mô hình quyết định.
3. **Call emission.**Kết quả kết cấu đặt tên công cụ và các lập luận.
4. **Call id.**Kết hợp phản ứng với cuộc gọi đúng (nhiều quan trọng cho song song).
5. **Result injection.**Một tin nhắn hoặc chặn liên kết kết quả trở lại với cuộc gọi.

### Sự khác biệt hình dạng, trường theo trường

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | `tool_calls[]` on assistant message | `content[]` of type `tool_use` | `parts[]` of type `functionCall` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI generates) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `user` with `tool_result`, `tool_use_id` | `functionResponse` with matching `id` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | `strict: true` per tool (opt-in) | `responseSchema` at request level |

### Những giới hạn mà bạn thực sự sẽ đạt được

- **OpenAI.**128 công cụ mỗi yêu cầu. Độ sâu sơ đồ 5. Dòng tranh luận <= 8192 byte.`$ref`Không .`oneOf`- Không.`anyOf`- Không.`allOf`với sự chồng chéo, mọi tài sản được liệt kê trong `required`- Tôi không biết.
- **Anthropic.**64 công cụ mỗi yêu cầu. Độ sâu của kế hoạch thực sự không giới hạn nhưng giới hạn thực tế 10. Sử dụng công cụ nghiêm ngặt là lựa chọn với `strict: true`Nếu không có nó, kế hoạch là một hợp đồng mà mô hình có xu hướng tuân theo, không phải là một bảo đảm.
- **Gemini.**64 chức năng mỗi yêu cầu. Các loại Schema là OpenAPI 3.0 (sự khác biệt nhẹ từ JSON Schema 2020-12).

### `tool_choice`hành vi

Ba chế độ mà mọi người đều hỗ trợ, có tên khác nhau.

- **Auto.**Mô hình chọn công cụ hoặc văn bản.
- **Required / Any.**Mô hình phải gọi ít nhất một công cụ.
- **None.**Mô hình không được gọi là công cụ.

Thêm một chế độ độc đáo cho mỗi nhà cung cấp:

- **OpenAI.**Cố gắng dùng một công cụ cụ thể bằng tên.
- **Anthropic.**Cần dùng một công cụ cụ thể bằng tên; `disable_parallel_tool_use`cờ phân biệt đơn với đa.
- **Gemini.** `mode: "VALIDATED"`định tuyến mọi phản ứng thông qua một trình xác nhận schema bất kể mục đích mô hình.

### Các cuộc gọi song song

OpenAI `parallel_tool_calls: true`(phụ mặc định) phát ra nhiều cuộc gọi trong một tin nhắn trợ lý. Bạn chạy tất cả chúng và trả lời bằng một tin nhắn vai trò công cụ bao gồm một mục mỗi `tool_call_id`. Anthropic lịch sử đã gọi một lần;`disable_parallel_tool_use: false`(tầm như Claude 3.5) cho phép nhiều. Gemini 2 cho phép gọi song song nhưng không cung cấp ID ổn định; Gemini 3 thêm UUID để các phản ứng ngoài trật tự tương quan sạch.

### Chuyển phát

Cả ba cuộc gọi hỗ trợ truyền thông thông qua công cụ.

- **OpenAI.**Các mảnh Delta của `tool_calls[i].function.arguments`đến từng bước.`finish_reason: "tool_calls"`- Tôi không biết.
- **Anthropic.**Các sự kiện bắt đầu khối / block-delta / block-stop. `input_json_delta`Các mảnh có những tranh luận một phần.
- **Gemini.** `streamFunctionCallArguments`(khởi đầu trong Gemini 3) phát ra các mảnh với một `functionCallId`để nhiều cuộc gọi song song có thể giao tiếp.

Giai đoạn 13 · 03 đi sâu vào việc lắp ráp lại song song và dòng phát. Bài học này tập trung vào các hình dạng tuyên bố và một cuộc gọi.

### Hầm lẫn và sửa chữa

Các lỗi lập luận không hợp lệ cũng trông khác nhau.

- **OpenAI (non-strict).**Phản hồi mô hình `arguments: "{bad json}"`, phân tích JSON của bạn thất bại, bạn tiêm một thông điệp lỗi và gọi lại.
- **OpenAI (strict).**Việc xác thực xảy ra trong quá trình giải mã; JSON không hợp lệ là không thể nhưng `refusal`có thể xuất hiện.
- **Anthropic (non-strict).** `input`có thể chứa các trường bất ngờ; sơ đồ là tư vấn.`strict: true`, lấy mẫu được hạn chế theo quy trình.
- **Gemini.**Khái niệm của OpenAPI 3.0: `enum`trên các trường đối tượng bị bỏ qua lặng lẽ; xác nhận bản thân.

### Mô hình dịch giả

Một tuyên bố công cụ theo quy định trong mã của bạn trông như thế này (bạn chọn hình dạng):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

Ba chức năng nhỏ chuyển nó sang ba hình dạng cung cấp.`code/main.py`làm chính xác điều này, sau đó đi vòng qua một cuộc gọi công cụ giả thông qua hình thức phản hồi của mỗi nhà cung cấp. Không cần mạng  bài học này dạy các hình dạng, không phải HTTP.

Các nhóm sản xuất đóng gói dịch giả này trong `AbstractToolset`(AI Pydantic),`UniversalToolNode`(LangGraph), hoặc `BaseTool`(LlamaIndex). Giai đoạn 13 · 17 đưa ra một cửa ngõ cho thấy một API hình dạng OpenAI trước bất kỳ ba.

```figure
function-call-args
```

## Sử dụng nó

`code/main.py`định nghĩa một canonical `Tool`Dataclass và ba trình dịch phát ra OpenAI, Anthropic và Gemini tuyên bố JSON. Nó sau đó phân tích một phản ứng của nhà cung cấp bằng tay của mỗi hình dạng vào cùng một đối tượng gọi theo quy luật, chứng minh rằng ngữ nghĩa là giống nhau dưới da.

Những gì cần xem:

- Ba khối tuyên bố chỉ khác nhau về phong bì và tên trường.
- Ba khối phản ứng khác nhau trong nơi cuộc gọi sống (bậc cao `tool_calls`- `content[]`khối,`parts[]`nhập).
- Một `canonical_call()`chiết xuất chức năng `{id, name, args}`từ cả ba hình thức phản ứng.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-provider-portability-audit.md`. Với sự tích hợp gọi chức năng với một nhà cung cấp, kỹ năng tạo ra một kiểm toán khả năng di chuyển: nhà cung cấp giới hạn mà nó dựa vào, những lĩnh vực cần đổi tên, và những gì phá vỡ khi di chuyển đến các nhà cung cấp khác.

## Các bài tập

1. Đi chạy`code/main.py`và xác minh rằng ba tuyên bố nhà cung cấp JSON tất cả các serialize cùng một cơ sở `Tool`sửa đổi công cụ Canonical để thêm một parameter enum và xác nhận chỉ cần phiên dịch viên Gemini để xử lý quirk OpenAPI.

2. Thêm một `ListToolsResponse`parser cho mỗi nhà cung cấp lấy danh sách công cụ một mô hình trả lại sau khi `list_tools`OpenAI không có một bản địa; lưu ý sự bất đối xứng này.

3. Thực hiện`tool_choice`chuyển đổi: bản đồ một canonical `ToolChoice(mode="force", tool_name="x")`trong cả ba hình dạng nhà cung cấp.`mode="any"`và `mode="none"`Hãy kiểm tra bảng điểm khác biệt của bài học.

4. Chọn một trong ba nhà cung cấp và đọc hướng dẫn gọi chức năng của nó từ đầu đến cuối. Tìm một trường trong mô hình sơ đồ của nó mà hai người khác không hỗ trợ.`strict`, Anthropic `disable_parallel_tool_use`, Gemini `function_calling_config.allowed_function_names`- Tôi không biết.

5. Viết một vector thử nghiệm: một cuộc gọi công cụ mà các lập luận vi phạm sơ đồ được tuyên bố. Đưa nó qua xác thực viên của mỗi nhà cung cấp (stdlib trong Bài học 01 sẽ làm như một đại diện) và ghi lại lỗi nào xảy ra. Tài liệu mà bạn sẽ sử dụng trong sản xuất để tính nghiêm ngặt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Function calling | "Tool use" | Provider-level API for structured tool-call emission |
| Tool declaration | "Tool spec" | Name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | OpenAI flag that constrains decoding to match schema |
| `tool_use` block | "Anthropic's call shape" | Inline content block with id, name, input |
| `functionCall` part | "Gemini's call shape" | A `parts[]` entry containing name, args, and id |
| Arguments-as-string | "Stringified JSON" | OpenAI returns args as a JSON string, not an object |
| Parallel tool calls | "Fan-out in one turn" | Multiple tool calls in one assistant message |
| Refusal | "Model declines" | Strict-mode-only refusal block instead of a call |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini uses a JSON-Schema-like dialect with minor differences |

## Đọc thêm

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) tham chiếu kinh điển bao gồm chế độ nghiêm ngặt và các cuộc gọi song song
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) `tool_use`và `tool_result`block semantics
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) Các cuộc gọi song song, ID độc đáo và bộ phận OpenAPI
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) bề mặt doanh nghiệp của Gemini
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) chi tiết về việc thực thi các quy trình chế độ nghiêm ngặt
