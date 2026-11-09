# Tưởng thức chung và hình mẫu bảng đen

> Hai phương pháp tiếp cận tồn tại cùng nhau trong hệ thống đa tác nhân năm 2026:**message pool**(mọi người thấy tin nhắn của mọi người, như trong AutoGen GroupChat hoặc MetaGPT) và **blackboard with subscription**(các đại lý đăng ký các sự kiện liên quan, như trong MCP Context-Aware hoặc khung Matrix). Cả hai là phần trạng thái duy nhất của một hệ thống đa đại lý  nghĩa là cả hai đều là nơi các lỗi thú vị sống.**memory poisoning**Một đại lý ảo giác một "thực tế", các đại lý khác đối xử với nó như xác minh, và độ chính xác suy giảm dần theo cách khó khăn hơn nhiều để gỡ lỗi hơn một vụ tai nạn ngay lập tức. Bài học này xây dựng cả hai cấu trúc từ stdlib, tiêm một cuộc tấn công độc hại, và cho thấy ba giảm thiểu thực sự hoạt động trong sản xuất.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Vấn đề

Các hệ thống đa đại lý cần một nơi để các đại lý chia sẻ dữ liệu. Một tùy chọn theo nghĩa đen là "làm tất cả mọi thứ trong tin nhắn" nhưng lại phát minh lại trạng thái chia sẻ với việc sao chép thêm. Một khác là "cứu mọi người một nhật ký toàn cầu" nhưng các nhật ký toàn cầu phát triển không giới hạn và độc hại dễ dàng. Một thứ ba là "được dự án một cái nhìn cho mỗi đại lý"

Khi một trong những nhân viên ảo giác và viết ảo giác vào trạng thái chia sẻ, mỗi nhân viên tiếp theo đọc trạng thái đó chấp nhận ảo giác như là một sự thật. Đến khi con người nhận ra, chuỗi lý luận sâu năm bước và nguyên nhân gốc là thông điệp thứ ba từng được viết.

Đây là nhiễm độc trí nhớ. Đây là gia đình thất bại thứ hai được ghi nhận nhiều nhất trong phân loại MAST (Cemri et al., arXiv:2503.13657) và nó cấu trúc: bất kỳ thiết kế bộ nhớ chia sẻ nào mà không có nguồn gốc và một xác minh không thể viết sẽ hiển thị nó cuối cùng.

## Khái niệm

### Hai topology chính

**Full message pool.**Mỗi đại lý đọc mọi tin nhắn. AutoGen GroupChat và MetaGPT sử dụng điều này. đơn giản, minh bạch, kiểm tra, nhưng không mở rộng vượt quá ~ 10 đại lý bởi vì bối cảnh của mỗi đại lý chứa đầy công việc của các đại lý khác.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.**Các đại lý tuyên bố quan tâm đến các chủ đề; các tuyến đường phụ chỉ hướng các thông điệp liên quan. CA-MCP (arXiv:2601.11595) và khung phân cấp Matrix (arXiv:2511.21686) sử dụng điều này.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Khi mỗi người thắng

- **Full pool**chiến thắng khi các đại lý ít (< 10), đa dạng, và cuộc trò chuyện là ngắn hạn.
- **Blackboard**chiến thắng khi các đại lý là nhiều, đồng nhất trong vai trò nhưng rất nhiều trong trường hợp (swarms), và cuộc trò chuyện là dài hạn.

Các hệ thống sản xuất thường trộn lẫn: một hồ bơi đầy đủ nhỏ ở phía trên (phần lập kế hoạch), bảng đen dưới (phần công nhân).

### Mùi độc trí nhớ, trong một kịch bản

Ba đại lý đang làm việc trong một nhiệm vụ nghiên cứu, đại lý A là đại lý tìm kiếm, đại lý B là tổng hợp, đại lý C là nhà phân tích.

1. A lấy một trang và viết một thông điệp cho trạng thái chia sẻ: "Study báo cáo cải thiện độ chính xác 42%".
2. Trang được lấy lại nói "tăng 4,2%". Một ảo giác là một số thập phân.
3. B, đọc trạng thái chia sẻ, viết: "Tăng độ chính xác lớn 42% được báo cáo (nguồn: A). "
4. C, đọc trạng thái chia sẻ, viết: "Cố gắng chấp nhận  42% nâng là biến đổi".
5. Báo cáo cuối cùng đề cập đến một con số 42% chưa từng tồn tại.

Không có nhân viên nào bị hỏng, không có thử nghiệm nào thất bại, hệ thống "sự làm việc" ảo giác đã chuyển từ bối cảnh của một nhân viên sang tư duy của mỗi nhân viên qua trạng thái chia sẻ.

### Tại sao điều này là cấu trúc

Nếu không có trạng thái chia sẻ, ảo giác của nhân vật A vẫn ở trong bối cảnh của A. Các nhân vật dòng chảy xuống sẽ lấy lại hoặc dẫn lại và có thể bắt được lỗi. Với trạng thái chia sẻ ngây thơ, bối cảnh của A trở thành bối cảnh của mọi người, và ảo giác được rửa thành thực tế.

Vấn đề không phải là quốc gia chia sẻ bản thân nó là quốc gia chia sẻ**without provenance and without an independent verifier**Ba biện pháp giảm thiểu giải quyết vấn đề này:

1. **Attribute provenance on every write.**Mỗi mục trong hồ sơ nhà nước được chia sẻ là ai đã viết nó, khi nào, dưới thời nào, và (nếu có) nguồn nào mà đại lý trích dẫn.
2. **Version writes; treat them as append-only.**Một sửa đổi là một mục mới thay thế cho mục cũ, không phải là một bản cập nhật tại chỗ.
3. **Keep at least one agent that cannot write to shared state.**Một đại lý xác minh chỉ đọc lấy mẫu các mục nhập, lấy lại các nguồn và đánh dấu những bất đồng. Nó vẫn đọc hồ bơi, vì vậy nó có thể bị lừa bởi một mục nhập xấu, nhưng nó kiểm tra mỗi mục nhập so với nguồn gốc và không thể viết, vì vậy phán quyết của nó không bao giờ đưa một sự kiện độc vào trạng thái chia sẻ.

### Tỷ lệ tiền lệ của bảng đen (Hayes-Roth, 1985)

Mô hình bảng đen này đã có trước các đại lý LLM bốn thập kỷ. Hayes-Roth (1985, "A Blackboard Architecture for Control") mô tả các nguồn kiến thức chuyên môn quan sát một bảng đen toàn cầu, đóng góp các giải pháp một phần và kích hoạt các nguồn khác. Bảng đen 2026 (CA-MCP, Matrix) là mô hình tương tự với các đại lý LLM như Nguồn tri thức và các điểm JSON như các giải pháp một phần. Văn học cũ đã ghi lại các giải pháp để viết tranh chấp, kiểm soát cơ hội, và sự nhất quán mà các hệ thống hiện đại tái phát hiện.

### Dự án so với toàn bộ hình ảnh

Một bảng đen tinh khiết cho mỗi thuê bao cùng một dự án (chương diện chủ đề).**per-agent projection**Các nhà giảm trạng thái của LangGraph là thực hiện 2026  chức năng giảm tính gấp trạng thái toàn cầu thành một mảnh cụ thể về vai trò.

Dự án mỗi đại lý sẽ mở rộng hơn nhưng cần một kế hoạch.

### Các mô hình văn bản

Nhiều đại lý viết cùng một lúc là một vấn đề đồng thời, không chỉ là một vấn đề LLM. Ba mô hình hoạt động:

- **Sequential writer (single producer).**Tất cả những gì viết đều được thông qua một đại lý điều phối mà sẽ làm cho nó trở nên liên tục.
- **Optimistic concurrency with versioning.**Mỗi mục có một phiên bản; các nhà văn thất bại trong phiên bản không phù hợp và thử lại.
- **Topic partitioning.**Các đại lý khác nhau sở hữu các chủ đề khác nhau, không có tranh chấp liên quan đến chủ đề, đòi hỏi phải thiết kế ranh giới phân vùng.

Hầu hết các khung 2026 mặc định cho người viết theo trình tự bởi vì các cuộc gọi LLM là đủ chậm để tranh chấp hiếm và nút thắt không làm tổn thương.

### Chứng minh không thể viết

Việc giảm tải chịu tải nhất là trình xác minh chỉ đọc.

- Người xác minh chia sẻ trạng thái với nhóm (đọc bảng đen hoặc hồ bơi).
- Verifier không có tay ghi để chia sẻ trạng thái  chỉ cho một kênh xác minh riêng biệt.
- Người xác minh độc lập lấy nguồn được trích dẫn trong văn bản.
- Các kết quả của người xác minh được chuyển đến một người hoặc một đại lý quyết định riêng biệt, không bao giờ được đưa trở lại hồ bơi.

Nếu không có sự tách biệt này, các sản phẩm của người xác minh sẽ trở thành các mục nhập mới trong hồ bơi, có nghĩa là một hồ bơi độc hại đã làm độc người xác minh, làm độc các xác minh của nó.

```figure
swarm-blackboard
```

## Hãy xây dựng nó

`code/main.py`thực hiện cả hai topology trong stdlib Python cộng với một cuộc tấn công độc đồ chơi và ba giảm thiểu.

- `MessagePool` Nhập nhật ký chỉ có thêm dây an toàn với đọc đầy đủ.
- `Blackboard` Pub/sub có chủ đề khóa với thuê bao mỗi đại lý.
- `ProvenanceEntry` tất cả các ghi chép (tác giả, dấu thời gian, prompt_hash, source_uri).
- `PoisoningScenario` thực hiện một nhiệm vụ nghiên cứu ba đại lý trong đó đại lý A ảo giác một số thập phân.
- `Verifier` một đại lý chỉ đọc mà lấy lại các nguồn và đánh dấu sự không nhất quán.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Tạo sản lượng dự kiến:
- Tiếp tục 1 (không xác minh): 42% ảo giác được truyền lên báo cáo cuối cùng.
- Run 2 (với xác minh): người xác minh đánh dấu sự không phù hợp, hồ bơi được dán nhãn "được đánh dấu", báo cáo cuối cùng bao gồm một sự rút lại.

## Sử dụng nó

`outputs/skill-memory-auditor.md`là một kỹ năng kiểm tra thiết kế bộ nhớ chia sẻ của bất kỳ hệ thống đa đại lý nào cho nguồn gốc, phiên bản và phân tách xác minh.

## Chuyển nó

Đối với bất kỳ thiết kế bộ nhớ chung nào:

- ghi lại nguồn gốc trên mỗi bài viết: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`- Tôi không biết.
- Làm cho nhật ký chỉ thêm vào. Cửa chữa là các mục mới tham khảo thứ thay thế.
- Việc triển khai ít nhất một đại lý xác minh chỉ đọc với quyền truy cập nguồn độc lập.
- Khả năng xác minh đường đến một kênh riêng biệt, không trở lại hồ bơi chung.
- Lập tỷ lệ của những bài viết là sự thay thế  một tỷ lệ tăng là bằng chứng sớm về các mô hình ảo giác.

## Các bài tập

1. Đi chạy`code/main.py`- Đảm bảo chạy 1 truyền tải ảo giác và chạy 2 bắt được nó.
2. Thêm một ảo giác thứ hai: đại lý B phát minh ra một bộ dữ liệu kích thước.
3. Chuyển toàn bộ hồ bơi vào bảng màu với các phân vùng chủ đề (`prices`- `summaries`- `analyses`(văn số 1): Các tình huống nhiễm độc nào mà việc phân chia chủ đề làm khó khăn hơn để thực hiện, và điều gì không giúp ích?
4. Đọc Hayes-Roth (1985, "A Blackboard Architecture for Control"). Định danh hai mô hình điều khiển từ bài báo không được thảo luận trong bài học này mà hệ thống 2026 sẽ được hưởng lợi.
5. Đọc CA-MCP (arXiv:2601.11595). Khóa kho lưu trữ ngữ cảnh chia sẻ của nó vào lớp MessagePool hoặc Blackboard trong `code/main.py`CA-MCP thêm vào những thứ nguyên thủy nào?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | Append-only log that every agent reads. Full transparency, poor scaling. |
| Blackboard | "Shared workspace" | Topic-keyed pub/sub. Agents subscribe to relevant topics. Scales farther. |
| Provenance | "Who wrote what" | Metadata on each write: writer, timestamp, prompt, sources. |
| Memory poisoning | "Hallucinations spreading" | One agent's error enters shared state, downstream agents adopt it as fact. |
| Append-only | "No in-place updates" | Corrections are new entries that supersede. Preserves audit trail. |
| Unwritable verifier | "Independent auditor" | Read-only agent that re-fetches sources and flags inconsistencies. |
| Projection | "Scoped view" | Per-agent view computed from global state. LangGraph reducers are the canonical case. |
| Knowledge Source | "Specialist agent" | Hayes-Roth's 1985 term for a blackboard participant. |

## Đọc thêm

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Định dạng phân loại MAST; ngộ độc trí nhớ là một phụ gia đình thất bại phối hợp
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) Kho lưu trữ ngữ cảnh chung cho các máy chủ MCP phối hợp
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) bảng màu dựa trên dòng tin nhắn mà không có nhạc cụ trung tâm
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) mô hình chiếu mỗi đại lý trong sản xuất
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Các ghi chép về nguồn gốc và xác minh từ một hoạt động sản xuất
