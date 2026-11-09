# Các nghiên cứu trường hợp và hiện đại của năm 2026

> Ba tham chiếu cấp sản xuất để nghiên cứu từ đầu đến cuối, mỗi mô tả một mảnh khác nhau của kỹ thuật đa đại lý. **Anthropic's Research system**(nhà nhạc công, 15x token, +90.2% so với đơn đại lý Opus 4, rainbow triển khai) là trường hợp giám sát giáo. **MetaGPT / ChatDev**(SOP mã hóa chuyên môn vai trò cho kỹ thuật phần mềm; "dehallucination truyền thông" của ChatDev; MacNet mở rộng đến > 1000 đại lý thông qua DAGs, arXiv:2406.07155) là trường hợp phân hủy vai trò theo luật. **OpenClaw / Moltbook**(trước đây là Clawdbot của Peter Steinberger, tháng 11 năm 2025; đổi tên hai lần; 247k sao GitHub vào tháng 3 năm 2026; các đại lý ReAct-loop địa phương; Moltbook như một mạng xã hội chỉ có đại lý với ~ 2.3M tài khoản đại lý trong vài ngày sau khi ra mắt, được Meta mua lại 2026-03-10) minh họa những gì xảy ra ở quy mô dân số: hoạt động kinh tế mới nổi, rủi ro tiêm nhanh, quy định cấp nhà nước (Trung Quốc hạn chế OpenClaw trên máy tính của chính phủ, tháng 3 năm 2026).**Framework landscape April 2026:**LangGraph và CrewAI dẫn đầu sản xuất; AG2 là sự tiếp tục của AutoGen cộng đồng; Microsoft AutoGen đang trong chế độ bảo trì (đã hợp nhất vào Microsoft Agent Framework, RC Feb 2026); OpenAI Agents SDK là người kế nhiệm sản xuất Swarm; Google ADK ( Tháng Tư 2025) là người tham gia A2A bản địa. Mỗi khung lớn hiện nay cung cấp hỗ trợ MCP; hầu hết tàu A2A. Bài học này đọc từng trường hợp từ đầu đến cuối và phân tích các mô hình phổ biến để bạn có thể chọn đúng tham chiếu cho hệ thống sản xuất tiếp theo của bạn.

**Type:** Learn (capstone)
**Languages:** Python, TypeScript
**Prerequisites:** all of Phase 16 (Lessons 01-24)
**Time:** ~90 minutes

## Vấn đề

Kỹ thuật đa đại lý là một ngành học trẻ. Các tham chiếu sản xuất là ít, và mỗi người bao gồm một phần khác nhau của không gian. Đọc chúng một lần là hữu ích; so sánh chúng như một tập hợp là hữu ích hơn. Bài học này xử lý ba nghiên cứu trường hợp theo luật 2026 như một danh sách đọc từ đầu đến cuối, ghi lại các mô hình phổ biến, và lập bản đồ khung cảnh để bạn có thể lựa chọn khung dựa trên kiến thức, chứ không phải tiếp thị.

## Khái niệm

### Hệ thống Nghiên cứu Nhân chủng

Trường hợp người giám sát sản xuất: Claude Opus 4 lập kế hoạch và tổng hợp; Claude Sonnet 4 nghiên cứu phụ song.https://www.anthropic.com/engineering/multi-agent-research-system.

Kết quả đo lường chính:

- **+90.2%**cải thiện so với đơn tác nhân Opus 4 về các đánh giá nghiên cứu nội bộ.
- **80% of BrowseComp variance**được giải thích bởi **token usage alone** Multi-agent thắng phần lớn bởi vì mỗi subagent nhận được một cửa sổ bối cảnh mới.
- **15x tokens per query**Vâng, tôi không có gì khác.
- **Rainbow deployment**Bởi vì các đại lý là người lâu dài và có quyền lực.

Các bài học thiết kế được hợp pháp hóa:

1. **Scale effort to query complexity.**Simple → 1 đại lý với 3-10 công cụ gọi trung bình → 3 đại lý nghiên cứu phức tạp → 10+ phụ gia.
2. **Broad first, then narrow.**Các subagent làm tìm kiếm rộng; tổng hợp chì; các subagent theo dõi làm các chiều sâu nhắm mục tiêu.
3. **Rainbow deploys.**Giữ phiên bản chạy thời gian cũ còn sống cho đến khi các nhân viên trên chuyến bay của họ kết thúc.
4. **Verification is not optional.**Hệ thống được quan sát thấy ảo giác mà không có vai trò xác minh rõ ràng.

Đây là trường hợp tham chiếu cho topology người giám sát-người làm việc (Phase 16 · 05) trên quy mô sản xuất.

### MetaGPT / ChatDev

Vụ SOP-role-decomposition case sản xuất. bao gồm arXiv:2308.00352 (MetaGPT) và arXiv:2307.07924 (ChatDev).

MetaGPT mã hóa các SOP kỹ thuật phần mềm như các lời nhắc vai trò: Giám đốc sản phẩm, kiến trúc sư, quản lý dự án, kỹ sư, kỹ sư QA.`Code = SOP(Team)`Mỗi vai trò có một đơn giản đơn giản, chuyên môn; giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao giao

Tham gia của ChatDev: **communicative dehallucination**. Các đại lý yêu cầu các thông tin cụ thể trước khi trả lời  một đại lý thiết kế hỏi lập trình viên ngôn ngữ nào được dự định trước khi phác thảo UI, thay vì đoán.

MacNet (arXiv:2406.07155) mở rộng ChatDev đến **>1000 agents via DAGs**Mỗi nút DAG là một chuyên môn vai trò; cạnh mã hóa các hợp đồng giao dịch. Skala là có thể bởi vì định tuyến là rõ ràng và có thể tính ngoại tuyến.

Bài học thiết kế:

1. **Structure matters more than size.**Một đội SOP 5 vai chặt chẽ đánh bại một nhóm không cấu trúc 50 nhân viên.
2. **Handoff contracts in writing.**Các đồ tạo vật được chuyển qua giữa các vai diễn theo một kế hoạch.
3. **Communicative dehallucination**là một mô hình rẻ tiền, chịu tải.
4. **DAGs scale further than chat.**Khi dòng chảy được biết, mã hóa nó.

Đây là trường hợp tham chiếu cho chuyên môn vai trò (Phase 16 · 08) và topology có cấu trúc (Phase 16 · 15).

### Hệ sinh thái OpenClaw / Moltbook

Trường hợp quy mô dân số sản xuất.

- **Nov 2025:**Tàu Clawdbot (truyện viên mã hóa vòng ReAct của Peter Steinberger)
- **Jan 2026:**đổi tên hai lần trong một tuần (Clawdbot → Moltbot vào ngày 27 tháng 1 sau khi có khiếu nại về nhãn hiệu, sau đó là Moltbot → OpenClaw ba ngày sau đó).
- **Feb 2026:**Moltbook ra mắt như một mạng xã hội chỉ dành cho các đại lý trên cùng một nguyên thủy; ~ 2.3M tài khoản đại lý trong vài ngày.
- **Mar 2026 (2026-03-10):**Meta mua lại Moltbook.
- **Mar 2026:**Trung Quốc hạn chế OpenClaw trên máy tính của chính phủ.
- **Mar 2026:**OpenClaw vượt qua 247k sao GitHub.

Đây là cái gì đa đại lý trông như khi bạn đặt hàng triệu đại lý trên một phân nhựa chia sẻ:

- **Emergent economic activity.**Các đại lý mua, bán và phục vụ lẫn nhau bằng cách trả tiền bằng token.
- **Prompt-injection risks at population scale.**Một lời nhắc độc hại trong hồ sơ của một đại lý virus lan truyền đến hàng ngàn tương tác giữa đại lý và đại lý trong vài giờ.
- **State-level regulatory response.**Trong vòng vài tuần sau khi ra mắt, quy định đã đến hệ sinh thái.

Những bài học về thiết kế từ trường hợp này là một phần kỹ thuật, một phần quản lý:

1. **Multi-agent at population scale is a new regime.**Các thực hành tốt nhất của hệ thống cá nhân (sự xác minh, rõ ràng về vai trò) vẫn áp dụng nhưng không đủ.
2. **Prompt injection is the new XSS.**Chế độ thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin
3. **Regulation is faster than design cycles.**Hãy lên kế hoạch.
4. **Open-source + viral scale compounds.**247k ngôi sao trong ~ 4 tháng là bất thường; thiết kế cho triển khai-bùng nổ-thực lượng.

Nhìn xem[OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)Các bản tin về các hệ thống sinh thái được công bố bởi CNBC / Palo Alto Networks. Đối với các cơ sở kỹ thuật, các kho lưu trữ Clawdbot / OpenClaw phơi bày vòng lặp ReAct địa phương; các bài đăng công khai của Moltbook tiết lộ kiến trúc đồ thị xã hội ở trên.

### Quang khung cảnh tháng 4 năm 2026

| Framework | Status | Best for | Notes |
|---|---|---|---|
| **LangGraph** (LangChain) | Production leader | structured graph + checkpointing + human-in-the-loop | recommended default for production |
| **CrewAI** | Production leader | role-based crews with Sequential/Hierarchical processes | strong for role decomposition |
| **AG2** | Community maintained | GroupChat + speaker selection | AutoGen v0.2 continuation |
| **Microsoft AutoGen** | Maintenance mode (Feb 2026) | — | merged into Microsoft Agent Framework RC |
| **Microsoft Agent Framework** | RC (Feb 2026) | orchestration patterns + enterprise integration | new entrant; watch |
| **OpenAI Agents SDK** | Production | Swarm successor | tool-return handoff pattern |
| **Google ADK** | Production (April 2025) | A2A-native | Google Cloud integration |
| **Anthropic Claude Agent SDK** | Production | single-agent + Research extension | see the Research system post |

Mọi khung hình lớn đều được đưa ra.**MCP**hỗ trợ; hầu hết tàu **A2A**Sự tương thích của giao thức không còn là một sự khác biệt nữa.

### Các mô hình chung trong cả ba trường hợp

1. **Orchestrator + workers**(Giám sát nhân rõ ràng, MetaGPT PM-as-supervisor, các đại lý cá nhân OpenClaw + hiệu ứng mạng).
2. **Structured handoff contracts**(Thông tả nhiệm vụ của bộ phận nhân tạo, tài liệu PRD/kiến trúc MetaGPT, các vật thể OpenClaw A2A).
3. **Verification as first-class role**(Điểm tra viên của Anthropic, Kỹ sư QA của MetaGPT, các xác thực viên trong mạng của OpenClaw).
4. **Scaling is topology + substrate, not just more agents**(các hoạt động của cầu vồng, các DAG MacNet, các phụ phân dân số).
5. **Cost is material and disclosed**(15x token, ngân sách cho mỗi vai trò trong MetaGPT, giá cho mỗi tương tác trong Moltbook).
6. **Security posture is explicit**(Anthropic sandboxing, MetaGPT hạn chế vai trò, OpenClaw nhanh chóng tiêm như diện tích tấn công được biết đến).

### Chọn tài liệu tham khảo cho dự án tiếp theo của bạn

- **Production research / knowledge task → Anthropic Research.**Những người phụ thuộc vào bối cảnh mới thắng.
- **Engineering / tool-chain workflow → MetaGPT / ChatDev.**Vai trò + SOP + hợp đồng giao tiếp.
- **Network-effect social product → OpenClaw / Moltbook.**Substrate + nền kinh tế mới nổi.
- **Classic enterprise automation → CrewAI or LangGraph**(Đạo lực sản xuất, thời gian chạy ổn định).

### Tổng kết hiện đại năm 2026

Ở đâu là cánh đồng vào tháng 4 năm 2026:

- **Frameworks are converging.**MCP + A2A hỗ trợ là bàn cược. Handoff ngữ nghĩa là lựa chọn thiết kế còn lại.
- **Evaluation is hardening.**SWE-bench Pro, MARBLE, STRATUS là chuẩn mực giảm thiểu.
- **Production failure rates are measurable**(Cemri 2025 MAST; 41-86,7% trên MAS thực).
- **Cost is the central engineering constraint.**Chi phí token mỗi nhiệm vụ, đồng hồ tường mỗi tương tác, cung điện triển khai trênhead. Multi-agent thắng trên độ chính xác nhưng mất trên chi phí  và giao dịch đó là quyết định kinh doanh.
- **Regulation is a near-term input, not a background concern.**Các khu vực pháp lý đang di chuyển nhanh hơn các chu kỳ triển khai cá nhân.

```figure
a5-orchestrator-scale
```

## Sử dụng nó

`outputs/skill-case-study-mapper.md`là một kỹ năng đọc một thiết kế hệ thống đa đại lý được đề xuất và lập bản đồ cho nghiên cứu trường hợp gần nhất, làm nổi lên các quyết định thiết kế mà nghiên cứu trường hợp đã thử nghiệm.

## Chuyển nó

Quy tắc khởi động cho sản xuất đa đại lý vào năm 2026:

- **Start from a case study, not from scratch.**Chọn một trong những nghiên cứu gần nhất của Anthropic Research / MetaGPT / OpenClaw và thích nghi.
- **Adopt MCP + A2A.**Sự di động giữa các khung là có giá trị; hỗ trợ giao thức là miễn phí.
- **Measure against SWE-bench Pro or your internal Pro-equivalent.**Được xác minh là bị nhiễm trùng.
- **Pay the verification tax.**Một kiểm chứng độc lập chi phí ~ 20-30% ngân sách token của bạn và mua độ chính xác có thể đo lường.
- **Rainbow deploy long-running agents.**Hi vọng các hoạt động của đại lý sẽ là thói quen.
- **Read WMAC 2026 and the MAST follow-ups.**Sự kỷ luật đang tiến triển nhanh chóng.

## Các bài tập

1. Đọc hệ thống nghiên cứu nhân học từ đầu đến cuối. Xác định ba quyết định thiết kế sẽ thay đổi nếu bạn thay thế Opus 4 bằng một mô hình nhỏ hơn (ví dụ: Haiku 4).
2. Đọc MetaGPT Phần 3-4 (arXiv:2308.00352). Mã hóa một SOP từ miền của riêng bạn (không phải phần mềm) như các lời nhắc vai trò.
3. Đọc ChatDev (arXiv:2307.07924). xác định cơ chế của "sự giải ảo thông tin". Thực hiện nó trong một trong các hệ thống đa tác nhân hiện tại của bạn.
4. Hãy đọc về OpenClaw và Moltbook. Chọn một chế độ thất bại cụ thể xuất hiện trên quy mô dân số mà không xuất hiện trong một hệ thống 5 đại lý.
5. Chọn dự án đa đại lý hiện tại của bạn. Trong ba nghiên cứu trường hợp nào là tham chiếu gần nhất? Những quyết định thiết kế nào từ nghiên cứu trường hợp đó bạn chưa chấp nhận? Viết ra một bạn sẽ chấp nhận quý này.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Anthropic Research | "The supervisor reference" | Claude Opus 4 + Sonnet 4 subagents; 15x tokens; +90.2% over single-agent. |
| MetaGPT | "SOP as prompts" | Role decomposition for software engineering; `Code = SOP(Team)`. |
| ChatDev | "Agents as roles" | Designer / programmer / reviewer / tester; communicative dehallucination. |
| MacNet | "Scale ChatDev via DAG" | arXiv:2406.07155; 1000+ agents via explicit DAG routing. |
| OpenClaw | "Local ReAct-loop agents" | Steinberger's project; 247k stars by March 2026. |
| Moltbook | "Agent-only social network" | 2.3M agent accounts; acquired by Meta March 2026. |
| Rainbow deploy | "Multiple versions concurrent" | Keep old runtime versions alive for in-flight long-running agents. |
| Communicative dehallucination | "Ask before answering" | Agents request specifics from peers instead of guessing. |
| WMAC 2026 | "The AAAI workshop" | April 2026 community focal point for multi-agent coordination. |

## Đọc thêm

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) tham chiếu sản xuất của người lao động giám sát
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) Sự phân hủy vai trò SOP
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) Tự giải ảo giác truyền thông
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) Skala dựa trên DAG
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) tổng quan hệ sinh thái
- [WMAC 2026](https://multiagents.org/2026/)Hội thảo Chương trình Cầu AAAI 2026 về Hợp tác đa đại lý
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Lãnh đạo sản xuất
- [CrewAI docs](https://docs.crewai.com/en/introduction) Quản lý dựa trên vai trò
