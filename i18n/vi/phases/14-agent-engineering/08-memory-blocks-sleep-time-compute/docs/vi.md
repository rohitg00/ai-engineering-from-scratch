# Chế độ ghi nhớ và tính toán thời gian ngủ

> Các bộ nhớ chức năng khác nhau ngăn chặn mô hình có thể chỉnh sửa trực tiếp, và một đại lý thời gian ngủ hợp nhất bộ nhớ không đồng bộ trong khi đại lý chính là vô hiệu.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## Mục tiêu học tập

- Tên gọi ba cấp độ bộ nhớ Letta sử dụng (cốt lõi, nhớ lại, lưu trữ) và vai trò của mỗi.
- Giải thích mô hình khối bộ nhớ: khối người, khối Persona và khối được người dùng xác định như các đối tượng được đánh máy hạng nhất.
- Mô tả tính toán thời gian ngủ là gì, tại sao nó nằm ngoài con đường quan trọng, và tại sao nó có thể chạy một mô hình mạnh hơn so với tác nhân chính.
- Thực hiện một vòng lặp hai đại lý được kịch bản trong đó một đại lý chính phục vụ các phản ứng và một đại lý thời gian ngủ hợp nhất các khối giữa các lượt.

## Vấn đề

MemGPT (Dạy 07) đã giải quyết dòng chảy kiểm soát bộ nhớ ảo. Ba vấn đề sản xuất xuất xuất ra:

1. **Latency.**Mỗi hoạt động trong bộ nhớ nằm trên đường dẫn quan trọng. Nếu đại lý phải cắt, tóm tắt hoặc hòa giải trong khi người dùng chờ đợi, thời gian trễ đuôi sẽ nổ.
2. **Memory rot.**Những tài liệu được tích lũy, những sự thật trái ngược vẫn còn, việc tìm lại bị ngập trong nội dung cũ.
3. **Structure loss.**Một kho lưu trữ phẳng không thể thể hiện "hình khối người luôn luôn trong prompt; khối Persona luôn trong prompt; khối Task thay đổi mỗi phiên".

Letta (letta.com) là tên nền tảng dự án MemGPT ban đầu được thông qua vào năm 2024  mô hình của giấy giữ tên MemGPT  và viết lại Letta V1 năm 2026 là một bước sau, riêng biệt.

## Khái niệm

### Ba tầng

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

Core là lõi MemGPT. nhớ là bộ đệm trò chuyện với đuôi bị tẩy ra. lưu trữ là cửa hàng bên ngoài. chia tách làm sạch quá tải hai cấp của MemGPT.

### Các khối bộ nhớ

Một khối là một phần được gõ, bền vững, có thể chỉnh sửa của tầng cốt lõi.

- **Human block** những sự thật về người dùng (tên, vai trò, sở thích, mục tiêu).
- **Persona block** khái niệm về bản thân của đại lý (tình danh, giọng nói, hạn chế).

Letta tổng quát hóa thành các khối được người dùng định nghĩa tùy ý: a `Task`khối cho mục tiêu hiện tại, một `Project`khối cho các dữ liệu cơ sở mã, một `Safety`khối cho các hạn chế cứng. Mỗi khối có một`id`- `label`- `value`- `limit`(chế độ giới hạn), `description`(vì vậy mô hình biết khi nào để chỉnh sửa nó).

Các khối có thể chỉnh sửa thông qua bề mặt công cụ:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` ngưng tụ một khối gần giới hạn của nó.

### Lượng ngủ

Letta 2025 bổ sung: chạy một đại lý thứ hai trong nền, ra khỏi con đường quan trọng.`learned_context`thành các khối chung, và hợp nhất hoặc vô hiệu hóa hồ sơ lưu trữ.

Các tính năng bị phá vỡ:

- **No latency cost.**Các phản ứng chính không chờ đợi cho các hoạt động bộ nhớ.
- **Stronger model allowed.**Máy tác dụng thời gian ngủ có thể là một mô hình đắt hơn, chậm hơn vì nó không bị hạn chế bởi độ trễ.
- **Natural consolidation window.**Dedup, tóm tắt, vô hiệu hóa các sự kiện mâu thuẫn khi người dùng không chờ đợi.

Hình dạng phù hợp với cách con người làm việc: bạn làm nhiệm vụ, bạn ngủ trên nó, trí nhớ dài hạn ổn định qua đêm.

### Lý luận bản địa

Letta V1 (`letta_v1_agent`, 2026) đã bị phá vỡ `send_message`/những nhịp tim và đường thẳng `Thought:`Các mã thông báo ủng hộ lý luận bản địa. Các API phản ứng (OpenAI) và các API tin nhắn với tư duy mở rộng (Anthropic) phát ra lý luận trên một kênh riêng biệt, đi qua các lượt (được mã hóa trên các nhà cung cấp trong sản xuất).

### Khi mô hình này đi sai

- **Block bloat.**Không có tận`block_append`Đưa một đoạn tổng kết trước khi viết mà đẩy qua nắp.
- **Silent drift.**Thuốc ngủ viết lại một khối và đại lý chính không bao giờ nhận ra.
- **Poisoned consolidation.**Thuốc ngủ xử lý nội dung có thể tiếp cận được kẻ tấn công vào lõi. Bài học 27 cũng áp dụng cho bề mặt ngủ.

```figure
memory-blocks
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `Block` ID, nhãn, giá trị, giới hạn, mô tả.
- `BlockStore` CRUD + `near_limit(label)`- Thợ giúp.
- Hai nhân viên kịch bản  `PrimaryAgent`phục vụ một lượt, `SleepTimeAgent`kết hợp giữa các vòng.
- Một dấu vết cho thấy cuộc trò chuyện ba vòng với Block viết, cộng với một thẻ ngủ thời gian tóm tắt một block và vô hiệu hóa một sự thật cũ.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Bản ghi cho thấy sự chia rẽ: các lượt đầu tiên nhanh và tạo ra các bài viết thô; con đường ngủ nhỏ gọn và làm sạch.

## Sử dụng nó

- **Letta**(letta.com) cho việc thực hiện tham chiếu. tự lưu trữ hoặc đám mây quản lý.
- **Claude Agent SDK skills**như kiến thức hình khối  một kỹ năng là một tên, phiên bản, có thể lấy lại khối hướng dẫn mà đại lý tải theo yêu cầu.
- **Custom builds**cho các nhóm muốn kiểm soát backend lưu trữ. sử dụng hợp đồng Letta API để bạn có thể di chuyển sau đó.

## Chuyển nó

`outputs/skill-memory-blocks.md`tạo ra một hệ thống khối hình Letta với các cái nén thời gian ngủ cho bất kỳ thời gian chạy nào, bao gồm các quy tắc an toàn và dây dẫn dẫn.

## Các bài tập

1. Thêm một `block_summarize`công cụ thay thế giá trị khối bằng một bản tóm tắt được tạo bởi mô hình khi `near_limit`Thâm số kích hoạt nào giảm thiểu cả cuộc gọi tổng kết và quá tải khối?
2. Thực hiện thời gian ngủ giảm trên lưu trữ: hai ghi chép có văn bản có quá 90% token chồng chéo sụp đổ đến một.
3. Các khối phiên bản. trên mỗi ghi chép viết giá trị cũ và một sự khác biệt.`block_history(label)`để các nhà điều hành có thể gỡ lỗi "tại sao đại lý quên X".
4. Hãy đối xử với các nhân viên ngủ như những nhà văn không tin cậy. Khi họ chạm vào khối Persona hoặc an toàn, cần phải xem xét của nhân viên thứ hai trước khi thực hiện.
5. Port ví dụ để sử dụng Letta API (`letta_v1_agent`(v. 5). Những thay đổi nào trong khuôn mẫu khối, và lý luận bản địa thay đổi hình dạng dấu vết như thế nào?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## Đọc thêm

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) mô hình khối
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) Hợp nhất đồng thời
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) viết lại lý luận bản địa
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) nguồn gốc
