# Nhóm trò chuyện và lựa chọn người nói

> Phong phối trò chuyện chia sẻ đặt N đại lý vào một cuộc trò chuyện; một chức năng chọn (LLM, round-robin, hoặc tùy chỉnh) chọn ai nói tiếp theo. Đây là kiểu nguyên mẫu của cuộc trò chuyện đa đại lý nổi lên  đại lý không biết vai trò của họ trong biểu đồ tĩnh, họ chỉ phản ứng với hồ bơi chung. AutoGen GroupChat và AG2 GroupChat là các thực hiện tham chiếu: ngữ nghĩa GroupChat của AutoGen v0.2 được bảo tồn trong ga AG2; AutoGen v0.4 viết lại nó như một mô hình diễn viên do sự kiện thúc đẩy. Microsoft đưa AutoGen vào chế độ bảo trì vào tháng 2 năm 2026 và sáp nhập nó với Semantic Kernel vào Microsoft Agent Framework (RC tháng 2 năm 2026). GroupChat nguyên thủy tồn tại trong cả AG2 và Microsoft Agent Framework  học nó một lần, sử dụng nó ở mọi nơi.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Vấn đề

Các biểu đồ tĩnh (LangGraph) rất tốt khi workflow được biết. Các cuộc trò chuyện thực sự không phải là tĩnh: đôi khi người lập trình hỏi người xem, đôi khi người nghiên cứu, đôi khi người viết. Hardcoding mỗi lần giao hàng có thể tạo ra một vụ nổ cạnh. Bạn muốn * đại lý phản ứng với một bể chia sẻ*, với một số chức năng quyết định ai nói tiếp theo.

Đó chính xác là những gì AutoGen GroupChat làm.

## Khái niệm

### Hình dạng

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Mỗi đại lý đều thấy mọi thông điệp, và mỗi lượt họ gọi một chức năng chọn để chọn ai nói tiếp theo.

### Ba hương vị chọn lọc

**Round-robin.**Chuyện cố định. Định nghĩa. Scales linearly in N nhưng bỏ qua ngữ cảnh  một coder nhận được lượt ngay cả khi chủ đề là đánh giá pháp lý.

**LLM-selected.**Một cuộc gọi đến một LLM đọc hồ sơ gần đây và trả lại người phát biểu tiếp theo tốt nhất. Biết bối cảnh nhưng chậm: mỗi lượt thêm một cuộc gọi LLM.

**Custom.**Một chức năng Python với bất kỳ logic nào bạn muốn. điển hình: LLM được chọn với các quy tắc trở lại (ví dụ, "luôn cho người xác minh sự xoay sau người lập trình").

### ConversableAgent API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`khi một đại lý hoàn thành một lượt, người quản lý gọi cho người chọn, người đó trả lại đại lý tiếp theo. vòng lặp tiếp tục cho đến khi một điều kiện chấm dứt.

### Tháo dỡ

Ba mô hình phổ biến:

- **Max rounds.**Tấm bốc cứng trên vòng hoàn toàn.
- **"TERMINATE" token.**Các đại lý có thể phát ra một thông điệp của một người lính canh; người quản lý dừng lại khi một người xuất hiện.
- **Goal-reached check.**Một bộ xác minh nhẹ chạy mỗi lượt và dừng cuộc trò chuyện khi hoàn thành.

### Hạt gốc: các cành và hợp nhất

Đầu năm 2025, Microsoft bắt đầu viết lại AutoGen (v0.4) lớn xung quanh mô hình diễn viên dựa trên sự kiện. Cộng đồng đã chia rẽ GroupChat của AutoGen v0.2 thành AG2, bảo tồn API mà người dùng đầu tiên đã tích hợp.

Vào tháng 2 năm 2026, Microsoft đã thông báo AutoGen sẽ chuyển sang chế độ bảo trì, với mô hình diễn viên dựa trên sự kiện được sáp nhập vào **Microsoft Agent Framework**(RC tháng 2 năm 2026, bây giờ hợp nhất với Semantic Kernel). Khái niệm GroupChat tồn tại trong cả hai đường ray; chi tiết thực hiện khác nhau. AG2 là phương thức ưu tiên trên dòng cho mã tương thích v0.2.

### Khi GroupChat phù hợp

- **Emergent conversations.**Bạn không muốn pre-thường dây tất cả các khả năng tiếp theo loa.
- **Role-mixing tasks.**Coder hỏi nhà nghiên cứu, nhà nghiên cứu hỏi lưu trữ viên, lưu trữ viên hỏi coder trở lại.
- **Exploratory problem-solving.**Hãy nghĩ "cuộc họp đột phá" chứ không phải "các đường dây tập hợp".

### Khi nó thất bại

- **Strict determinism.**Các lựa chọn của LLM có thể không phù hợp, cùng một prompt, chạy khác nhau, diễn giả tiếp theo khác nhau.
- **Sycophancy cascades.**Các đặc vụ sẽ tiếp cận những người nói với sự tự tin nhất.
- **Context bloat.**Mỗi đại lý đọc mọi tin nhắn; sau 10 lượt ngữ cảnh là rất lớn. Sử dụng dự đoán (Dạy học 15) để phạm vi xem.
- **Hot speakers.**Một đại lý thống trị cuộc trò chuyện vì người chọn ưu tiên đặc biệt của mình.

### Nhóm trò chuyện với người giám sát

Tương tự nguyên thủy, mặc định khác nhau:

- Giám đốc: một đại lý lập kế hoạch và những người khác thực hiện.
- Group chat: tất cả các đại lý đều là đồng nghiệp; chọn là một chức năng trên hồ bơi chung.

Cả hai đều sử dụng bốn nguyên thủy từ Bài học 04. Các trò chuyện nhóm mặc định đến dàn nhạc LLM được chọn và trạng thái chia sẻ toàn bộ.

```figure
swarm-speaker
```

## Hãy xây dựng nó

`code/main.py`thực hiện một GroupChat từ đầu trong stdlib. ba đại lý (coder, kiểm tra viên, quản lý), round-robin và LLM lựa chọn biến thể, và một chấm dứt trên một `TERMINATE`- Đồ tín hiệu.

Demo in bản ghi lại cuộc trò chuyện cộng với dấu vết quyết định của người chọn cho cả hai biến thể.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

## Sử dụng nó

`outputs/skill-groupchat-selector.md`cấu hình một bộ chọn GroupChat cho một nhiệm vụ nhất định  round-robin vs LLM-selected vs custom, và các đầu vào của bộ chọn (tin nhắn gần đây, đặc biệt của đại lý, đếm lượt) để sử dụng.

## Chuyển nó

Danh sách kiểm tra:

- **Max rounds cap.**Luôn luôn. 10-20 cho các nhiệm vụ điển hình.
- **Speaker-balance metric.**Đường quay mỗi đại lý; cảnh báo khi mất cân bằng vượt quá ngưỡng.
- **Termination token.** `TERMINATE`hoặc một đại lý xác minh chuyên dụng.
- **Projection or scoped memory.**Sau ~ 10 tin nhắn, hãy xem xét cung cấp cho mỗi đại lý chỉ một khung cảnh để ngăn chặn bùng phát ngữ cảnh.
- **Selector logging.**Đối với các biến thể được chọn LLM, ghi lại cả đầu vào của người chọn và sự lựa chọn của nó. Nếu không, việc gỡ lỗi là không thể.

## Các bài tập

1. Đi chạy`code/main.py`So sánh cuộc trò chuyện trong vòng tròn-robin với LLM-chọn-được.
2. Thêm một quy tắc "tối đa nói trên mỗi đại lý" vào bộ chọn.
3. Thực hiện một kết thúc đạt mục tiêu: dừng khi người xem trả lại "được chấp thuận".
4. Đọc các tài liệu ổn định AutoGen trên GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html). Định dạng chọn mặc định được sử dụng bởi `GroupChatManager`- Tôi không biết.
5. Đọc repo AG2 (https://github.com/ag2ai/ag2(v0.2) và so sánh GroupChat của nó với phiên bản v0.4.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Đọc thêm

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) thực hiện tham chiếu
- [AG2 repo](https://github.com/ag2ai/ag2) cộng đồng AutoGen v0.2 tiếp tục
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) người kế nhiệm hợp nhất, RC tháng 2 năm 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) chi tiết viết lại mô hình diễn viên dựa trên sự kiện
