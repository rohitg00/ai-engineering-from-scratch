# Di sản của FIPA-ACL và các đạo luật nói chuyện

> Trước khi MCP, trước khi A2A, có FIPA-ACL. Năm 2000, Quỹ cho các đại lý vật lý thông minh (FIPA, trở thành ủy ban tiêu chuẩn của IEEE Computer Society vào năm 2005) phê chuẩn một ngôn ngữ giao tiếp đại lý với hai mươi biểu diễn, hai ngôn ngữ nội dung và một bộ giao thức tương tác  hợp đồng net, đăng ký / thông báo, yêu cầu khi nào. Nó đã biến mất khỏi ngành công nghiệp vì chi phí trên của ontology quá nặng cho web, nhưng sự hồi sinh LLM của các hệ thống đa đại lý đang lặng lẽ triển khai lại những ý tưởng tương tự mà không có ngữ nghĩa chính thức: Hợp đồng JSON đứng vào chỗ các biểu hiện, ngôn ngữ tự nhiên đứng vào chỗ các ontology. Bài học này đọc nghiêm túc FIPA-ACL để bạn có thể thấy những quyết định giao thức 2026 là tái phát minh, những gì là sự mới mẻ, và nơi sóng hiện tại sẽ khám phá lại các vấn đề mà những năm 2000 đã giải quyết.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Vấn đề

Tân cảnh của các ứng viên-bản thức năm 2026 đang bận rộn: MCP cho các công cụ, A2A cho các đại lý, ACP cho kiểm toán doanh nghiệp, ANP cho niềm tin phi tập trung, NLIP cho nội dung ngôn ngữ tự nhiên, cộng với CA-MCP và hai chục đề xuất nghiên cứu.

Sự thật là hầu hết họ đang khám phá lại một cây quyết định rất cụ thể, 20 năm tuổi. Lý thuyết diễn văn từ Austin (1962) và Searle (1969) cho chúng ta "những phát biểu là hành động". KQML (1993) biến điều đó thành một giao thức dây. FIPA-ACL (được phê chuẩn năm 2000) đã tạo ra tiêu chuẩn hóa tham chiếu: hai mươi biểu diễn, ngôn ngữ nội dung SL0/SL1, giao thức tương tác cho contract-net và subscribe-notify. JADE và JACK là nền tảng tham chiếu Java. Những nỗ lực này đã mờ dần vào khoảng năm 2010 bởi vì chi phí trên của ontology quá nặng và web đang chiến thắng.

Khi bạn nhìn vào MCP `tools/call`, chu kỳ cuộc sống nhiệm vụ của A2A, hoặc kho lưu trữ ngữ cảnh chia sẻ của CA-MCP, bạn đang xem xét một sự tái tạo mềm hơn, bản địa JSON của các quyết định FIPA.

## Khái niệm

### Các hành động diễn văn, trong một đoạn

Austin nhận thấy rằng một số câu không mô tả thế giới  chúng thay đổi nó. "Tôi hứa". "Tôi yêu cầu". "Tôi tuyên bố". Ông gọi những phát biểu biểu biểu diễn này là "đồ chơi". Searle đã chính thức hóa năm loại: khẳng định, hướng dẫn, ủy thác, biểu hiện, tuyên bố. KQML (Finin et al., 1993) đã làm cho điều này hoạt động cho các đại lý phần mềm: một tin nhắn là một hoạt động (các hành động) cộng với nội dung (các hành động là gì). FIPA-ACL đã dọn dẹp các khoảng trống của KQML và chuẩn hóa khoảng hai mươi biểu diễn.

### Hai mươi biểu diễn của FIPA (dân sách một phần)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

Danh sách đầy đủ đã được đưa vào `fipa00037.pdf`(FIPA ACL Message Structure) Điểm không phải là ghi nhớ nó  Điểm là mỗi một trong những điều này tương ứng với một nguyên thủy một giao thức LLM cuối cùng thêm lại.

### Thông điệp FIPA-ACL theo quy định

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

Bảy trường mang phong bì giao thức; một trường (`content`Các trường còn lại chính xác là những gì bạn phát minh lại mỗi khi bạn boult các thử nghiệm, threading và ontology vào một giao thức JSON.

### Hai nền tảng di sản

**JADE**(Java Agent DEvelopment framework, 19992020s) là thời gian chạy phù hợp với FIPA được sử dụng nhiều nhất. Các đại lý mở rộng lớp cơ sở, trao đổi tin nhắn ACL, chạy bên trong container và phối hợp bằng cách sử dụng "hành vi". Thư viện giao tiếp giao thức được gửi với contract-net, đăng ký- thông báo, yêu cầu-lần, và đề xuất- chấp nhận.

**JACK**(Software hướng đến đại lý, thương mại) nhấn mạnh lý luận BDI (Trái-Thiên-Thiên-Thiên) trên các thông điệp FIPA.

Cả hai đều giảm khi web stack ăn nhiều trường hợp sử dụng đại lý. MCP và A2A là "nhà chứa" chạy vào năm 2026.

### Tại sao FIPA bị xóa sổ

- **Ontology overhead.**FIPA yêu cầu một ontology chung để phân tích `content`. Thỏa thuận về các ontology là một quá trình tiêu chuẩn kéo dài nhiều năm.
- **Formal semantics nobody used.**SL (Ngôn ngữ ngữ ngữ nghĩa) đã đưa ra các điều kiện chân lý nghiêm ngặt, nhưng hầu hết các hệ thống sản xuất sử dụng nội dung dạng tự do và bỏ qua chủ nghĩa hình thức.
- **Tooling lock-in.**JADE chỉ dùng Java, JACK là thương mại, các nhóm đa ngôn ngữ đều đi xung quanh cả hai.
- **The internet won the stack.**REST, sau đó là JSON-RPC, sau đó là gRPC thay thế vận chuyển của ACL.

### Sự hồi sinh của LLM là FIPA-lite

So sánh FIPA `request`cho một MCP `tools/call`- Có thể là:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

cùng một phong bì, phân biệt tổng hợp. cả hai mang theo: ai, ai, ý định, tải trọng, liên quan ID. Cả hai không phải là một cuộc cách mạng trên người khác  họ là các thương mại khác nhau trên cùng một thiết kế.

Cuộc khảo sát năm 2025 của Liu et al. ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) làm rõ dòng dõi này: MCP tương ứng với các hành động ngôn ngữ sử dụng công cụ, A2A với các hành động ngôn ngữ đại lý-tương đương, ACP với các hành động ngôn ngữ kiểm tra, ANP với các tiện ích danh tính phi tập trung. Các thông số kỹ thuật mới là hậu duệ của ACL với tổng hợp JSON và ngữ nghĩa lỏng lẻo hơn.

### Sự thỏa hiệp, được nói rõ ràng

**What FIPA gave you and modern specs drop:**

- Hình thức ngữ nghĩa  bạn có thể chứng minh `inform`cho thấy người gửi tin vào nội dung.
- Một danh mục biểu diễn theo luật pháp  bạn không cần phải tranh luận lại "chẳng lẽ chúng ta nên có một `cancel`? "
- Nhiều thập kỷ các mô hình tương tác-bản thức giao dịch  hợp đồng-net, đăng ký- thông báo, đề xuất- chấp nhận  với các tính chất chính xác được biết đến.

**What modern specs give you and FIPA did not:**

- Các tải trọng hữu ích gốc JSON tương thích với mọi công cụ hiện đại.
- Nội dung ngôn ngữ tự nhiên mà LLM có thể giải thích mà không cần có một ontology mã hóa bằng tay.
- Giao thông web-stack (HTTP, SSE, WebSocket).
- Khám phá khả năng thông qua MCP trực tiếp `server/discover`và A2A Agent Cards.

Hỗn định nghĩa ý định thô lỗ hơn để dễ dàng thực hiện. Đó là giao dịch chính xác.

### Các giao thức tương tác đáng được chuyển

FIPA đã vận chuyển ~ 15 giao thức tương tác. Ba là đáng để chuyển tiếp vào các hệ thống đa đại lý LLM:

1. **Contract Net Protocol (CNP).**Các vấn đề của quản lý `cfp`(cần mời đề xuất); người đề nghị trả lời bằng cách:`propose`; người quản lý chấp nhận/rước đi. Đây là mô hình thị trường công việc theo quy định (Phase 16 · 16 đàm phán).
2. **Subscribe/Notify.**Người đăng ký gửi `subscribe`; nhà xuất bản gửi `inform`Đây là tất cả các sự kiện-băng trong năm 2026.
3. **Request-When.**"Do X khi điều kiện Y giữ". Hành động chậm với điều kiện trước. 2026 analog là các nhiệm vụ bị hoãn trong động cơ lưu lượng công việc bền (Phase 16 · 22 Scaling sản xuất).

Mỗi bản đồ được vẽ sạch sẽ vào hàng rào thông điệp hiện đại, thăm dò HTTP + hoặc phát trực tuyến SSE.

### Điều gì bị phá vỡ khi bạn bỏ ra ontology

Không có một ontology chung, các đại lý suy luận ý nghĩa từ nội dung ngôn ngữ tự nhiên.**semantic drift**: hai đại lý sử dụng cùng một từ (`"customer"`) đối với các khái niệm khác nhau tinh tế, đại lý của người nhận hành động trên giải thích sai lầm, không có người xác nhận sơ đồ nào bắt được nó.

Giảm thiểu mà không đi theo toàn bộ ontology:

- JSON Schema trên `content` từ chối các lỗi cấu trúc trên dây.
- Các đồ tạo tác kiểu (A2A)  từ chối phương thức sai lầm.
- Các biểu diễn rõ ràng trong phong bì  làm cho ý định không rõ ràng ngay cả khi nội dung là ngôn ngữ tự nhiên.

### Các thông số kỹ thuật năm 2026, được lập bản đồ theo di sản hành động nói

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

Đọc bảng từ trên xuống dưới, mô hình là: giữ nguyên chất cấu trúc, bỏ đi sự hình thức, để LLM ghi chép về sự mơ hồ.

```figure
sw-contract-net
```

## Hãy xây dựng nó

`code/main.py`thực hiện một trình dịch FIPA-ACL tự nhiên. Nó mã hóa và giải mã phong bì ACL theo quy định và cho thấy cách mỗi hình dạng thông điệp MCP / A2A giảm xuống đến cùng bảy trường.

- Mã hóa năm thông điệp kiểu MCP và kiểu A2A như FIPA-ACL.
- Đánh mã FIPA-ACL trở lại với tương đương hiện đại.
- Giao dịch giao dịch giữa một nhà quản lý và ba nhà đấu thầu sử dụng `cfp`- `propose`- `accept-proposal`- `reject-proposal`- Tôi không biết.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một dấu vết bên cạnh cho thấy mỗi tin nhắn hiện đại trong cả dạng JSON 2026 và dạng FIPA-ACL của nó, sau đó là một chuyến đi về của một lệnh hợp đồng-net.

## Sử dụng nó

`outputs/skill-fipa-mapper.md`là một kỹ năng đọc bất kỳ thông số đặc trưng của các nguyên tắc và tạo ra bản đồ FIPA-ACL. Sử dụng nó trước khi áp dụng một nguyên tắc mới để trả lời: "Đây có thực sự mới, hay nó là`inform`với ngữ pháp JSON?"

## Chuyển nó

Đừng mang lại FIPA-ACL.

- Ý định ban đầu (sản xuất) của mỗi tin nhắn là gì?
- Có một ID tương quan cho yêu cầu-phản ứng và hủy bỏ?
- Có một ngôn ngữ nội dung rõ ràng (JSON-RPC, văn bản đơn giản, tạo vật được đánh chữ có cấu trúc)?
- Các giao thức tương tác có hạng nhất không, hay bạn đang tái triển khai hợp đồng từ đầu?
- Điều gì xảy ra khi hai nhân viên không đồng ý về ý nghĩa nội dung (trái hướng ngữ nghĩa)?

Hãy ghi lại 5 câu hỏi này cho bất kỳ giao thức mới nào trước khi bạn đưa nó vào sản xuất.

## Các bài tập

1. Đi chạy`code/main.py`- Quan sát mã hóa đi về và đi. xác định các hiệu ứng FIPA tương ứng với `tools/call`- `resources/read`, và tạo nhiệm vụ A2A.
2. Cải tiến bản demo hợp đồng với một `cancel`- Điều gì xảy ra khi thất bại?`cancel`giải quyết những thử nghiệm này một mình, phải không?
3. Đọc FIPA ACL Message Structure (http://www.fipa.org/specs/fipa00037/) các phần 4.14.3. Chọn một biểu diễn không được đề cập trong bài học này và mô tả các tương tự JSON-RPC hiện đại của nó.
4. Đọc Liu et al., arXiv:2505.02279. Đối với mỗi MCP, A2A, ACP, ANP, liệt kê các gia đình hiệu suất FIPA họ giữ và thả.
5. Thiết kế một JSON-Schema tối thiểu cho `content`trường của a `request`Điều gì mà chương trình này cung cấp cho bạn mà ngôn ngữ tự nhiên không cung cấp, và nó tốn bao nhiêu tiền?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## Đọc thêm

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) khảo sát kinh điển năm 2025 kết nối các thông số kỹ thuật hiện đại với di sản của FIPA
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) định dạng gói 2000 được phê chuẩn
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) danh mục thực hiện đầy đủ
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) tương đương sử dụng công cụ hiện tại không có quốc tịch của `request`- Không.`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) tương đương đại lý-bạn đồng cấp hiện đại của hợp đồng-net và đăng ký- thông báo
