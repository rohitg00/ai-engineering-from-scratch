# Đặc biệt về vai trò  Kế hoạch, Nhận xét, Thực thi, Kiểm tra

> Sự phân hủy đa đại lý phổ biến nhất vào năm 2026: một đại lý lập kế hoạch, một thực hiện, một chỉ trích hoặc xác minh. MetaGPT (arXiv:2308.00352) chính thức hóa điều này như SOP được mã hóa thành lời nhắc vai trò  Giám đốc sản phẩm, kiến trúc sư, quản lý dự án, kỹ sư, kỹ sư QA  sau `Code = SOP(Team)`- Tôi không biết. ChatDev (arXiv:2307.07924) liên kết thiết kế, lập trình viên, nhà đánh giá, kiểm tra thông qua một "chỉa khóa trò chuyện" với "sự giải ảo thông tin" (chấp hành khách rõ ràng yêu cầu các chi tiết thiếu sót). Máy xác minh có thể chịu tải: Cemri et al. (MAST, arXiv:2503.13657) cho thấy mỗi sự thất bại đa đại lý có thể được theo dõi để xác minh bị mất hoặc bị hỏng. PwC báo cáo tăng độ chính xác 7x (10% → 70%) từ vòng xác thực cấu trúc trong CrewAI.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## Vấn đề

Các hệ thống đa đại lý chung tạo ra đầu ra chung. Ba bộ lập trình trong một cuộc trò chuyện nhóm viết ba hương vị của cùng một mã trung bình. Bạn có thể thêm nhiều đại lý, thêm nhiều vòng, và vẫn không vượt qua ngưỡng chất lượng.

Việc sửa chữa không phải là các đại lý hơn  nó là các đại lý khác nhau. Đề xuất các vai trò khác nhau. Cung cấp các công cụ phê bình mà người lập kế hoạch không có. Cung cấp cho người xác minh một bộ thử nghiệm khách quan. Bây giờ hệ thống có sự bất đồng nội bộ với sự sửa chữa có căn cứ, không chỉ là đoán song song.

## Khái niệm

### Bốn vai trò của các giáo pháp

**Planner.**Đọc mục tiêu, tạo ra một danh sách bước hoặc một thông số kỹ thuật Công cụ: lấy lại kiến thức, tài liệu.

**Executor.**Đọc một kế hoạch từng bước, tạo ra vật liệu. Công cụ: các công cụ thực tế làm việc (compiler mã, shell, API client).

**Critic.**Đọc kết quả của người thực hiện chống lại ý định của người lập kế hoạch. Công cụ: truy cập chỉ đọc vào vật tạo, phân tích tĩnh.

**Verifier.**Đọc các tác phẩm và chạy kiểm tra xác định. Công cụ: test runner, type checker, schema validator. Output: pass/fail với bằng chứng.

Người phê bình là chủ quan, có ý kiến, thường dựa trên LLM. Người xác minh là khách quan, xác định, thường dựa trên mã.

### Mô hình SOP của MetaGPT

MetaGPT (arXiv:2308.00352) mã hóa các SOP kỹ thuật phần mềm như các lời nhắc vai trò:

- **Product Manager**- Ông nói.
- **Architect**tạo ra thiết kế hệ thống.
- **Project Manager**chia các nhiệm vụ.
- **Engineer**các thiết bị.
- **QA Engineer**chạy các xét nghiệm.

Mỗi vai trò có một kế hoạch đầu vào/phục xuất nghiêm ngặt.`Code = SOP(Team)`Các SOP xác định biến một nhóm LLM thành một đường ống dự đoán.

### Sự khước từ của ChatDev

ChatDev thêm một bước quan trọng: khi một người thực thi cần một chi tiết cụ thể không nằm trong kế hoạch, nó rõ ràng hỏi nhà thiết kế trước khi tiếp tục. Điều này ngăn chặn thất bại LLM cổ điển của phát minh chi tiết.

Thực hiện: lời nhắc vai trò bao gồm "Khi bạn cần thông tin cụ thể mà bạn không được cung cấp, hãy hỏi vai trò liên quan bằng tên trước khi tạo ra kết quả".

### Tại sao người xác minh quan trọng nhất

Cemri et al. (MAST) đã theo dõi 1642 thất bại thực hiện đa đại lý. 21,3% là lỗ hổng xác minh  hệ thống gửi một câu trả lời không ai kiểm tra. 79% còn lại thường theo dõi trở lại "có một kiểm tra đã thất bại lặng lẽ hoặc không bao giờ được chạy. "

PwC báo cáo (CrewAI triển khai, 2025) rằng việc thêm một vòng xác thực cấu trúc đã di chuyển độ chính xác từ 10% lên 70%.

### Đánh giá đối với xác minh

- Một nhà phê bình là một thạc sĩ pháp lý xem xét một đồ tạo vật cho chất lượng.
- Một xác minh là một chương trình xác định chạy trên vật thể. mục tiêu. Cho phép vượt qua / thất bại với bằng chứng.

Sử dụng cả hai. Nhận xét nhận được các vấn đề về hương vị mà người xác minh không thể diễn tả.

### Phản ứng phản mẫu

Mỗi vai trò trong hệ thống của bạn là một LLM và mỗi vai trò xuất hiện là "có vẻ tốt với tôi".

### Bản đồ khung

- **CrewAI** `Agent(role, goal, backstory)`là bề mặt chuyên môn sách giáo khoa.
- **LangGraph** các nút có thể có các lời nhắc chuyên dụng; cạnh bắt buộc đường ống.
- **AutoGen** Các nhân viên được trò chuyện cụ thể với một từ trong một GroupChat.
- **OpenAI Agents SDK** Các công cụ giao tiếp giữa các đại lý chuyên về vai trò.

```figure
swarm-roles
```

## Hãy xây dựng nó

`code/main.py`thực hiện một đường ống 4 vai tạo ra một hàm Python đơn giản:

- **Planner**tạo ra một spec.
- **Executor**tạo ra một chuỗi mã.
- **Critic**(LLM-simulated) cờ các vấn đề rõ ràng.
- **Verifier**chạy mã được tạo trong một hộp cát (`exec`) chống lại một trường hợp thử nghiệm.

Demo chạy hai lần: một lần khi người thực thi tạo ra mã chính xác (các trình kiểm tra + phê duyệt cả hai đều vượt qua), một lần khi người thực thi tạo ra mã ngoài thông số (các trình kiểm tra bỏ lỡ lỗi vì nó trông có thể tin cậy, kiểm tra nhận nó vì thử nghiệm thất bại).

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

## Sử dụng nó

`outputs/skill-role-designer.md`thực hiện một nhiệm vụ và tạo ra danh sách vai trò (3-5 vai), sơ đồ đầu vào / ra ngoài cho mỗi vai trò và kiểm tra xác minh.

## Chuyển nó

Danh sách kiểm tra:

- **At least one deterministic verifier.**Không bao giờ là toàn bộ.
- **Explicit I/O schema per role.**Người lập kế hoạch trả lại một spec, không phải prose; người thực thi đọc sơ đồ đó.
- **Communicative dehallucination.**Người thực thi phải hỏi người lập kế hoạch khi nào thông tin bị thiếu; không bao giờ phát minh ra nó.
- **Critic/verifier ordering.**Đánh giá đầu tiên (cô rẻ, bắt được các vấn đề thiết kế), xác minh thứ hai (rút, bắt được lỗi).
- **Loop budget.**Max 2 round review trước khi leo thang lên con người.

## Các bài tập

1. Đi chạy`code/main.py`và quan sát cách xác minh nhận lỗi mà nhà phê bình bỏ qua.`return`(v) như một chất kiểm chứng bổ sung.
2. Thêm một vai trò thứ 5: "nhà phân tích yêu cầu" chuyển đổi mong muốn của người dùng thành thông số sẵn sàng cho lập kế hoạch.
3. Đọc phần 3 của MetaGPT ("Các đại lý"). Đăng ra các sơ đồ đầu vào/ ra khỏi mỗi 5 vai trò của MetaGPT.
4. Đọc biểu đồ chuỗi trò chuyện của ChatDev (arXiv:2307.07924 Hình 3). Xác định nơi mà sự khống chế ảo giác truyền thông phá vỡ một vòng lặp mà nếu không là vô hạn.
5. Sự tăng cường độ chính xác 7 lần của PwC đến từ vòng lặp xác minh. giả định ba nhiệm vụ mà việc thêm một người xác minh sẽ không giúp  nơi kiểm tra xác định tính chính xác là không thể hoặc quá tốn kém.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Đọc thêm

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) giấy tham chiếu SOP-as-role-prompt
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) chuỗi trò chuyện + sự giải ảo thông tin
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Định dạng phân loại MAST; khoảng cách xác minh là 21,3% các thất bại
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) bề mặt đặc điểm vai trò sản xuất
