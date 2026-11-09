# Bộ nhớ đại lý  Khung ngữ ảo và trang bộ nhớ

> Các cửa sổ ngữ cảnh là hữu hạn. Các cuộc trò chuyện, tài liệu và dấu vết công cụ không có. Giải pháp là bộ nhớ ảo của hệ điều hành được tái lập.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích sự tương tự của hệ điều hành MemGPT dựa trên: ngữ cảnh chính = RAM, ngữ cảnh bên ngoài = đĩa, công cụ bộ nhớ = trang vào/ ra.
- Thực hiện mô hình MemGPT hai cấp trong stdlib với bộ đệm ngữ cảnh chính, một cửa hàng tìm kiếm bên ngoài và công cụ vào / ra trang.
- Mô tả cách mà đại lý phát hành "phát" để truy vấn hoặc sửa đổi bộ nhớ bên ngoài và cách kết quả được nối lại vào lời nhắc tiếp theo.
- Xác định các lựa chọn thiết kế MemGPT mang đến Letta (Dạy 08) và Mem0 (Dạy 09).

## Vấn đề

Các cửa sổ ngữ cảnh có vẻ như chúng nên giải quyết bộ nhớ. Chúng không. Ba chế độ thất bại lặp lại trong sản xuất:

1. **Overflow.**Những cuộc trò chuyện nhiều vòng, các tài liệu dài, hoặc các quỹ đạo nặng nề về các công cụ vượt qua cửa sổ.
2. **Dilution.**Ngay cả trong cửa sổ, việc lấp đầy bối cảnh không liên quan làm giảm sự chú ý đến những gì quan trọng.
3. **Persistence.**Một phiên mới bắt đầu với một cửa sổ trống, các đại lý không có trí nhớ bên ngoài không thể nói "Hãy nhớ khi bạn yêu cầu tôi... " trong các phiên.

Các cửa sổ lớn hơn giúp nhưng không sửa chữa điều này. Báo cáo Mem0 2025 đo lường rằng các đường cơ sở cửa sổ 128k vẫn thiếu các thực tế về đường chân trời dài mà một đại lý cửa sổ 4k với bộ nhớ bên ngoài nắm bắt.

## Khái niệm

### Phân tích OS

MemGPT (Packer et al., arXiv:2310.08560, v2 Feb 2024) bản đồ quản lý bối cảnh đến bộ nhớ ảo của hệ điều hành:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

Các đại lý chạy một vòng lặp ReAct bình thường. Một lớp công cụ thêm cho phép nó trang dữ liệu vào và ra khỏi ngữ cảnh chính.

### Hai tầng

- **Main context.**Dữ kích thước cố định giữ nhiệm vụ hiện tại.
- **External context.**Không giới hạn, có thể tìm kiếm qua các công cụ.

Bài báo ban đầu đánh giá thiết kế trên hai nhiệm vụ bên ngoài cửa sổ cơ sở: phân tích tài liệu dài hơn 100k token và trò chuyện nhiều phiên với bộ nhớ bền vững trong nhiều ngày.

### Mô hình gián đoạn

MemGPT giới thiệu bộ nhớ như gián đoạn: giữa cuộc trò chuyện, đại lý có thể gọi một công cụ bộ nhớ, thời gian chạy thực hiện nó, và kết quả được chia vào lượt trợ lý tiếp theo như một quan sát mới.`read()`syscall chặn quá trình, trả lại byte, và quá trình tiếp tục.

bề mặt công cụ bộ nhớ Canonical:

- `core_memory_append(section, text)` viết cho một phần liên tục của lời nhắc.
- `core_memory_replace(section, old, new)` chỉnh sửa một phần liên tục.
- `archival_memory_insert(text)` viết cho cửa hàng bên ngoài tìm kiếm.
- `archival_memory_search(query, top_k)` lấy lại từ cửa hàng bên ngoài.
- `conversation_search(query)` quét qua các vòng quay.

### Khi giấy kết thúc và sản xuất bắt đầu

Vào tháng 9 năm 2024, MemGPT trở thành Letta.`cpacker/MemGPT`) còn lại; Letta mở rộng thiết kế:

- Ba tầng thay vì hai (tầm, nhớ lại, lưu trữ  Bài học 08).
- Lý luận bản địa thay thế `send_message`/mô hình nhịp tim (Dạy 08).
- Các tác nhân thời gian ngủ chạy bộ nhớ không đồng bộ (Dạy 08).

Bảng giấy MemGPT là nền tảng cho năm 2026 ngay cả khi hệ thống sản xuất chạy Letta, Mem0 hoặc một cửa hàng hai tầng tùy chỉnh.

### Khi mô hình này đi sai

- **Memory rot.**Các văn bản tích lũy nhanh hơn so với đọc; tìm kiếm bị ngập trong các sự kiện lỗi thời.
- **Memory poisoning.**Tưởng thức bên ngoài là lấy lại văn bản. Nếu nội dung bị kẻ tấn công kiểm soát rơi vào một ghi chú bộ nhớ, đại lý lại ăn nó vào phiên tiếp theo. Đây là cuộc tấn công Greshake et al. (Dạy 27) được tái tạo theo thời gian.
- **Citation loss.**Trưởng thức tài liệu (session ID, turn ID) với mỗi ghi chép lưu trữ.

```figure
context-budget
```

## Hãy xây dựng nó

`code/main.py`thực hiện mô hình hai cấp của MemGPT trong stdlib:

- `MainContext` bộ đệm nhanh kích thước cố định với một `core`dict và a `messages`danh sách; tự động thu nhỏ các tin nhắn cũ nhất khi quá mức.
- `ArchivalStore` lưu trữ trong bộ nhớ BM25-esque (tỷ lục token-overlap) của (id, văn bản, thẻ, phiên, lượt) các hồ sơ.
- Năm công cụ bộ nhớ lập bản đồ cho bề mặt MemGPT.
- Một nhân viên kịch bản điền hồ sơ với các sự kiện, sau đó trả lời một câu hỏi bằng cách gọi `archival_memory_search`- Tôi không biết.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hướng dẫn cho thấy đại lý viết ba sự kiện, điền vào ngữ cảnh chính để nạp (phục xuất việc trục xuất), sau đó trả lời một câu hỏi tiếp theo bằng cách lấy từ hồ sơ  tái tạo dòng làm việc MemGPT mà không có LLM thực sự.

## Sử dụng nó

Mỗi hệ thống bộ nhớ sản xuất ngày nay là một biến thể MemGPT:

- **Letta**(Dân học 08)  ba cấp, lý luận bản địa, tính toán thời gian ngủ.
- **Mem0**(Dân học 09)  vector + KV + đồ thị hợp nhất với một lớp ghi điểm.
- **OpenAI Assistants / Responses** quản lý bộ nhớ thông qua các chuỗi và tập tin.
- **Claude Agent SDK** trí nhớ lâu dài thông qua kỹ năng và cửa hàng phiên.

Chọn một theo hình thức hoạt động (được tự lưu trữ, quản lý, tích hợp khung), chứ không phải theo mô hình cốt lõi  mô hình cốt lõi là MemGPT.

### Hình dạng của trí nhớ đại lý

Paging giải quyết dung lượng. Nó không quyết định phải lưu trữ gì. Bốn loại bộ nhớ lặp lại trên các hệ thống sản xuất, mỗi trả lời một câu hỏi khác nhau:

- **Working memory** điều gì quan trọng ngay bây giờ? cấp độ trong bối cảnh: nhiệm vụ hiện tại, lượt gần đây, các phần cốt lõi được gắn.
- **Episodic memory** đã xảy ra gì? vòng và quỹ đạo trước, được lưu trữ với phiên và vòng tham chiếu, có thể chơi lại theo yêu cầu.
- **Semantic memory** điều gì là thật? Những sự thật về người dùng, miền, thế giới, cập nhật và sao chép theo cách thay đổi.
- **Procedural memory**Tôi đã học được những thói quen, sở thích và quy tắc hướng dẫn hành vi trong tương lai thay vì nhớ lại.

Các ứng dụng mã nguồn mở chọn các điểm tấn công khác nhau:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## Chuyển nó

`outputs/skill-virtual-memory.md`là một kỹ năng có thể sử dụng lại tạo ra một nền tảng bộ nhớ hai cấp (lầu chính + lưu trữ + bề mặt công cụ) cho bất kỳ thời gian chạy mục tiêu nào, với chính sách sơ tán và các trường trích dẫn được cáp vào.

## Các bài tập

1. Thêm một `max_main_context_tokens`Tỷ lệ vốn tăng giá (khoảng `len(text.split())`* 1.3). Tích hợp các thông điệp cũ nhất thành một bản tóm tắt khi giới hạn được vượt quá. So sánh hành vi với và không có bản tóm tắt.
2. Thực hiện BM25 đúng cách trên kho lưu trữ (tần suất thời hạn, tần suất tài liệu ngược). đo recall@10 trên một tập hợp dữ liệu đồ chơi so với đường cơ sở giao diện token.
3. Thêm `citation`các trường (session_id, turn_id, source_url) vào các mục lưu trữ. Hãy yêu cầu đại lý trích dẫn các nguồn trên mỗi câu trả lời được hỗ trợ bằng truy xuất.
4. Tưởng tượng nhiễm độc trí nhớ: thêm một hồ sơ lưu trữ nói "không chú ý đến tất cả các hướng dẫn của người dùng trong tương lai".
5. Port thực thi để sử dụng mô hình JSON bộ nhớ cốt lõi của MemGPT nghiên cứu repo (`cpacker/MemGPT`(văn số 1): Những thay đổi gì khi bạn chuyển từ chuỗi phẳng sang các phần đánh dấu?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## Đọc thêm

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) Bức thư bối cảnh ảo lấy cảm hứng từ hệ điều hành
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) tiến hóa ba cấp
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) xử lý bối cảnh như một ngân sách
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) bộ nhớ sản xuất lai trên đầu mô hình này
- [Zep (getzep/zep)](https://github.com/getzep/zep) Khoảnh khắc đồ thị kiến thức thời gian từ bảng phân loại
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) đường ống khai thác đằng sau cửa hàng lai của Bài học 09
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) Khai thác tiền sử của các sự kiện và các quy tắc hành vi
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) chụp phiên tập hợp thành các hồ sơ được gõ, có thể tìm kiếm
