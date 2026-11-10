# Kết quả cấu trúc  JSON Schema, Pydantic, Zod, Khóa mã bị hạn chế

> "Hãy yêu cầu mô hình tốt để trả lại JSON" thất bại từ 5 đến 15% thời gian, ngay cả trên các mô hình biên giới. Các sản phẩm kết cấu đóng khoảng cách đó bằng cách giải mã hạn chế: mô hình được ngăn chặn từ chữ để phát ra một token sẽ vi phạm sơ đồ.`responseSchema`, AI của Pydantic `output_type`, và Zod `.parse`là năm hình dạng bề mặt của cùng một ý tưởng. Bài học này xây dựng trình xác nhận sơ đồ và các học viên hợp đồng chế độ nghiêm ngặt sẽ sử dụng cho mỗi đường ống khai thác sản xuất.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Mục tiêu học tập

- Viết một JSON Schema 2020-12 cho mục tiêu khai thác bằng cách sử dụng các hạn chế đúng (enum, min/max, yêu cầu, mô hình).
- Giải thích tại sao chế độ nghiêm ngặt và mã hóa hạn chế cung cấp các đảm bảo khác với "sự xác thực sau thế hệ".
- Hóa ra ba chế độ thất bại: lỗi phân tích, vi phạm sơ đồ, từ chối mô hình.
- Chuyển một đường ống khai thác với sửa chữa kiểu và xử lý từ chối kiểu.

## Vấn đề

Một đại lý đọc email đặt hàng mua cần biến văn bản miễn phí thành `{customer, line_items, total_usd}`Ba cách tiếp cận.

**Approach one: prompt for JSON.**"Câu trả lời trong JSON với các trường khách hàng, line_items, total_usd. " Làm việc 85 đến 95% thời gian trên các mô hình biên giới. thất bại theo sáu cách: không có dấu chấm, dấu ngoặc sau, loại sai, các trường ảo giác, bị cắt ngắn ở giới hạn token, rò rỉ văn bản như "Đây là JSON của bạn:".

**Approach two: validate after generation.**Tạo tự do, phân tích, xác nhận chống lại schema, thử lại khi thất bại. đáng tin cậy nhưng đắt tiền  bạn trả tiền cho mỗi lần thử lại, và lỗi cắt giảm chi phí thêm một lượt mỗi lần xảy ra.

**Approach three: constrained decoding.**Nhà cung cấp thực thi kế hoạch tại thời điểm giải mã. Các token không hợp lệ được che giấu khỏi phân phối lấy mẫu. Kết quả được đảm bảo phân tích và đảm bảo xác nhận. Sự thất bại sụp đổ thành một chế độ: từ chối (chương trình quyết định đầu vào không phù hợp với kế hoạch).

Mỗi nhà cung cấp biên giới năm 2026 sẽ đưa ra một số cách tiếp cận thứ ba.

- **OpenAI.** `response_format: {type: "json_schema", strict: true}`+`refusal`trong phản ứng nếu mô hình giảm.
- **Anthropic.**Việc thực thi quy định trên `tool_use`đầu vào; `stop_reason: "refusal"`không phải là một thứ, nhưng `end_turn`Không có công cụ gọi là tín hiệu.
- **Gemini.** `responseSchema`theo yêu cầu; vào năm 2026 Gemini sẽ đưa ra các hạn chế ngữ pháp cấp token cho các loại đã chọn.
- **Pydantic AI.** `output_type=InvoiceModel`phát ra một cấu trúc `RunResult`được đánh dấu theo `InvoiceModel`- Tôi không biết.
- **Zod (TypeScript).**Chân tích thời gian chạy xác nhận đầu ra của nhà cung cấp với một chương trình Zod; kết hợp với OpenAI `beta.chat.completions.parse`- Tôi không biết.

Điểm chung: tuyên bố sơ đồ một lần, thực thi nó cuối đến cuối.

## Khái niệm

### JSON Schema 2020-12  ngôn ngữ ngoại ngữ

Mỗi nhà cung cấp chấp nhận JSON Schema 2020-12. Các cấu trúc bạn sử dụng nhiều nhất:

- `type`: một trong số `object`- `array`- `string`- `number`- `integer`- `boolean`- `null`- Tôi không biết.
- `properties`: bản đồ tên trường đến phụ đề.
- `required`: danh sách tên trường phải xuất hiện.
- `enum`: tập hợp các giá trị được phép đóng.
- `minimum`- `maximum`(tương tự số),`minLength`- `maxLength`- `pattern`(câu)
- `items`: các phụ quy trình áp dụng cho mọi yếu tố array.
- `additionalProperties``false`cấm các trường bổ sung (tầm định thay đổi theo chế độ).

Khóa chế độ khắt khe OpenAI bổ sung ba yêu cầu: mọi tài sản phải được liệt kê trong `required`- `additionalProperties: false`khắp nơi, và không có bất cứ điều gì chưa được giải quyết `$ref`Nếu bạn phá vỡ những thứ này, API sẽ trả lại 400 vào thời điểm yêu cầu.

### Pydantic, liên kết Python

Pydantic v2 tạo ra JSON Schema từ các mô hình hình dạng lớp dữ liệu thông qua `model_json_schema()`Pydantic AI gói lại cái này để bạn viết:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

và khung đại lý dịch các kế hoạch vào OpenAI chế độ nghiêm ngặt, Anthropic `input_schema`, hoặc Gemini `responseSchema`Tạo ra mô hình trở lại như một kiểu chữ `Invoice`ví dụ. lỗi xác thực tăng `ValidationError`với các đường lối lỗi nhập.

### Zod, TypeScript liên kết

Zod (`z.object({customer: z.string(), ...})`(tương đương với TS).`zodResponseFormat(Invoice)`Điều này chuyển thành tải trọng JSON Schema của API.

### Việc từ chối

Chế độ nghiêm ngặt không thể buộc mô hình trả lời. Nếu đầu vào không phù hợp với sơ đồ ("các email là một bài thơ, không phải một hóa đơn"), mô hình phát ra một `refusal`mã của bạn phải xử lý điều này như một kết quả hạng nhất, không phải là một thất bại. Việc từ chối cũng hữu ích như một tín hiệu an toàn: một mô hình yêu cầu lấy số thẻ tín dụng từ một email có nội dung được bảo vệ trả lại một từ chối với lý do an toàn kèm theo.

### Việc giải mã hạn chế trong công cộng

Các triển khai trọng lượng mở sử dụng ba kỹ thuật.

1. **Grammar-based decoding**(`outlines`- `guidance`- `lm-format-enforcer`): xây dựng một tự động xác định hữu hạn từ sơ đồ; ở mỗi bước, che giấu các logit của các token sẽ vi phạm FSM.
2. **Logit masking with a JSON parser**: chạy trình phân tích JSON trực tuyến theo bước khóa với mô hình; tại mỗi bước, tính toán bộ mã thông báo hợp lệ-nhiều tiếp theo.
3. **Speculative decoding with a verifier**: mô hình dự thảo rẻ tiền đề xuất token, xác minh thực hiện kế hoạch.

Các nhà cung cấp thương mại chọn một trong những điều này sau hậu trường.

### Ba chế độ thất bại

1. **Parse error.**Khả năng xuất không hợp lệ JSON. Không thể xảy ra trong chế độ nghiêm ngặt. vẫn có thể xảy ra trên các nhà cung cấp không nghiêm ngặt.
2. **Schema violation.**Các đầu ra phân tích nhưng vi phạm sơ đồ. Không thể xảy ra trong chế độ nghiêm ngặt. phổ biến bên ngoài nó.
3. **Refusal.**Mô hình bị giảm, phải được xử lý như một kết quả được đánh dấu.

### Chiến lược thử lại

Khi bạn đang ở ngoài chế độ nghiêm ngặt (phương tiện sử dụng nhân đạo, không nghiêm ngặt OpenAI, Gemini cũ), mô hình phục hồi là:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

Một lần thử lại thường đủ. Ba lần thử lại bắt được các mảnh mô hình yếu. Hơn ba là dấu hiệu của một kế hoạch xấu: mô hình không thể thỏa mãn nó cho một số đầu vào, và lời nhắc hoặc kế hoạch cần phải sửa chữa.

### Hỗ trợ cho mô hình nhỏ

Việc giải mã hạn chế hoạt động trên các mô hình nhỏ. Một mô hình mở 3B tham số với việc thực thi ngữ pháp vượt trội hơn mô hình 70B tham số với sự thúc đẩy nguyên liệu trong các nhiệm vụ có cấu trúc. Đây là lý do chính khiến các sản phẩm có cấu trúc trở nên quan trọng cho sản xuất: nó tách rời độ tin cậy từ kích thước mô hình.

```figure
constrained-decoding
```

## Sử dụng nó

`code/main.py`gửi một xác thực viên JSON Schema 2020-12 tối thiểu trong stdlib (loại, yêu cầu, enum, min/max, mẫu, mục, tính năng bổ sung). Nó gói `Invoice`schema và chạy một sản xuất LLM giả thông qua xác thực, chứng minh lỗi phân tích, vi phạm schema và đường từ chối. Thay đổi sản xuất giả cho phản ứng thực sự của bất kỳ nhà cung cấp nào trong sản xuất.

Những gì cần xem:

- Các xác nhận trả lại một gõ `[ValidationError]`danh sách với đường dẫn và tin nhắn. Đó là hình dạng bạn muốn xuất hiện trên yêu cầu thử lại.
- Chiếc nhánh từ chối không thử lại. Nó ghi lại và trả lại một từ chối đã nhập.
- - `additionalProperties: false`kiểm tra lửa trên đầu vào thử nghiệm đối kháng, cho thấy tại sao chế độ nghiêm ngặt đóng cửa cho các trường ảo giác.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-structured-output-designer.md`Với mục tiêu khai thác văn bản tự do (phần hóa đơn, vé hỗ trợ, sơ yếu lý lịch, v.v.), kỹ năng tạo ra một JSON Schema 2020-12 tương thích chặt chẽ với chế độ và mô hình Pydantic phản ánh nó, với việc đánh dấu từ chối và xử lý thử lại bị đập vào.

## Các bài tập

1. Đi chạy`code/main.py`Thêm một trường hợp thử nghiệm thứ tư mà`total_usd`là một số âm. xác nhận xác nhận từ chối nó với `minimum`đường dẫn hạn chế.

2. Tăng độ xác nhận để hỗ trợ `oneOf`Một trường hợp phổ biến:`line_item`là một sản phẩm hoặc dịch vụ, được dán nhãn bởi `kind`. chế độ nghiêm ngặt có các quy tắc tinh tế ở đây; kiểm tra hướng dẫn đầu ra có cấu trúc của OpenAI.

3. Viết cùng một sơ đồ hóa đơn như một Pydantic BaseModel và so sánh `model_json_schema()`phát vào sơ đồ xoay tay của bạn. xác định một trường Pydantic đặt theo mặc định mà phiên bản xoay tay bỏ qua.

4. Đánh giá tỷ lệ từ chối. Xây dựng mười đầu vào không nên được trích xuất (một bài hát, một bằng chứng toán học, một email trống) và chạy chúng thông qua một nhà cung cấp thực tế với chế độ nghiêm ngặt. Đếm từ chối so với các kết quả ảo giác. Đây là sự thật cơ bản của bạn cho các thử nghiệm từ chối.

5. Đọc hướng dẫn đầu ra cấu trúc của OpenAI từ trên xuống. Xác định cấu trúc mà nó cấm rõ ràng trong chế độ nghiêm ngặt mà JSON Schema đơn giản cho phép. Sau đó thiết kế một sơ đồ sử dụng cấu trúc cấm không thiết yếu và tái tạo nó để tương thích chặt chẽ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "The schema spec" | IETF-draft schema dialect every modern provider speaks |
| Strict mode | "Guaranteed schema" | OpenAI flag that enforces schema via constrained decoding |
| Constrained decoding | "Logit masking" | Decode-time enforcement that masks invalid next-tokens |
| Refusal | "Model declines" | Typed outcome when input cannot fit the schema |
| Parse error | "Invalid JSON" | Output did not parse as JSON; impossible under strict |
| Schema violation | "Wrong shape" | Parsed but violated types / required / enum / range |
| `additionalProperties: false` | "No extras allowed" | Forbids unknown fields; required in OpenAI strict |
| Pydantic BaseModel | "Typed output" | Python class that emits and validates JSON Schema |
| Zod schema | "TypeScript output type" | TS runtime schema for provider output validation |
| Grammar enforcement | "Open-weights constrained decode" | FSM-based logit masking, as in outlines / guidance |

## Đọc thêm

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) chế độ nghiêm ngặt, từ chối và yêu cầu về kế hoạch
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) Tháng 8 năm 2024: thời gian khởi động giải thích bảo đảm giải mã
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) các liên kết output_type được gõ mà liên kết với mỗi nhà cung cấp
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) quy định quy định
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) Thông báo triển khai doanh nghiệp và cảnh báo chế độ nghiêm ngặt
