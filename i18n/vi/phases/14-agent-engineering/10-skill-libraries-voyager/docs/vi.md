# Các thư viện kỹ năng và học tập suốt đời (Voyager)

> Voyager (Wang et al., TMLR 2024) coi mã thực thi như một kỹ năng. Kỹ năng được đặt tên, có thể lấy lại, hợp tác và tinh chỉnh bằng phản hồi môi trường. Đây là kiến trúc tham chiếu cho kỹ năng SDK của Claude Agent, bộ kỹ năng và mô hình thư viện kỹ năng 2026.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Mục tiêu học tập

- Tên gọi ba thành phần của Voyager  chương trình giảng dạy tự động, thư viện kỹ năng, nhắc nhở lặp đi lặp lại  và vai trò của mỗi.
- Hãy giải thích tại sao Voyager lại tạo ra mã không gian hành động chứ không phải lệnh nguyên thủy.
- Thực hiện thư viện kỹ năng stdlib với đăng ký, tìm kiếm, thành phần và tinh chỉnh dựa trên thất bại.
- Bản đồ mẫu của Voyager về kỹ năng SDK của Agent Claude năm 2026 và hệ sinh thái của skillkit.

## Vấn đề

Các đại lý xây dựng lại mọi khả năng từ đầu trong mỗi phiên làm ba điều sai:

1. **Waste tokens.**Mỗi nhiệm vụ lại tạo ra cùng một lý luận.
2. **Lose progress.**Một sự sửa đổi được học trong phiên A không chuyển sang phiên B.
3. **Fail on long-horizon composition.**Các nhiệm vụ phức tạp cần sự phân cấp khả năng; các lời nhắc đơn giản không thể thể diễn tả chúng.

Câu trả lời của Voyager: coi mỗi khả năng tái sử dụng như một phần mã được đặt tên trong thư viện, có thể lấy lại bằng sự tương đồng, có thể kết hợp với các kỹ năng khác, và được tinh chỉnh bằng phản hồi thực hiện.

## Khái niệm

### Ba thành phần

Voyager (arXiv:2305.16291) cấu trúc một đại lý xung quanh:

1. **Automatic curriculum.**Một người đề nghị do tò mò chọn nhiệm vụ tiếp theo dựa trên kỹ năng hiện tại của đại lý và tình trạng môi trường.
2. **Skill library.**Mỗi kỹ năng là mã có thể thực hiện. Các kỹ năng mới được thêm vào khi một nhiệm vụ thành công.
3. **Iterative prompting mechanism.**Khi thất bại, đại lý nhận được lỗi thực thi, phản hồi môi trường, và đầu ra tự xác minh, sau đó tinh chỉnh kỹ năng.

Phân tích Minecraft (Wang et al., 2024): 3.3x các mặt hàng độc đáo hơn, 8.5x nhanh hơn công cụ đá, 6.4x nhanh hơn công cụ sắt, 2,3x dài hơn đường băng bản đồ so với đường cơ sở.

### Không gian hành động = mã

Hầu hết các đại lý phát ra lệnh nguyên thủy. Voyager phát ra các chức năng JavaScript.

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Được tạo thành từ các kỹ năng phụ, được lưu trữ bằng khóa mô tả và nhúng, được lấy lại như một chương trình, không phải là một lời nhắc.

Đây là kỹ năng SDK của Claude Agent 2026: một phần mã có tên và có thể lấy lại cộng với các hướng dẫn mà đại lý tải theo yêu cầu.

### Thu thập kỹ năng

Nhiệm vụ mới là "làm một cái đũa kim cương".

1. Nhúng mô tả nhiệm vụ.
2. Tìm kiếm các kỹ năng tương tự từ thư viện kỹ năng.
3. Lấy lại `craftIronPickaxe`- `mineDiamond`- `placeCraftingTable`v.v.
4. Sắp xếp kỹ năng mới từ nguyên thủy thu hồi + logic mới.

Đây là mô hình thực hiện các nguồn lực MCP (Phase 13) và kỹ năng SDK của Agent: lấy lại trên một bề mặt kiến thức / mã, được quy mô cho nhiệm vụ hiện tại.

### Phong lọc lặp đi lặp lại

Chuyện phản hồi của Voyager:

1. Trưởng văn viết một kỹ năng.
2. Kỹ năng chạy chống lại môi trường.
3. Một trong ba tín hiệu trở lại:`success`- `error`(với dấu vết đống),`self-verification failure`- Tôi không biết.
4. Trưởng văn sẽ viết lại kỹ năng bằng cách sử dụng tín hiệu như là ngữ cảnh.
5. Lòng cho đến khi thành công hoặc vòng tối đa.

Đây là tự tinh chỉnh (Dạy 05) được áp dụng cho việc tạo mã với xác minh dựa trên môi trường. CRITIC (Dạy 05) là mô hình tương tự với các công cụ bên ngoài như xác minh.

### Chương trình giảng dạy và khám phá

Các module chương trình giảng dạy của Voyager đề xuất các nhiệm vụ như "tạo một nơi trú ẩn gần hồ" dựa trên những gì mà người đại diện có và những gì nó chưa làm. Người đề xuất sử dụng tình trạng môi trường + hàng tồn kho kỹ năng để chọn một nhiệm vụ ngay trên khả năng hiện tại

Đối với các đại lý sản xuất điều này được dịch thành một nhà điều hành "điều gì thiếu": với thư viện kỹ năng hiện tại và một miền, chúng ta vẫn chưa bao gồm những kỹ năng nào?

### Khi mô hình này đi sai

- **Skill library rot.**Một kỹ năng tương tự được thêm 10 lần với các mô tả khác nhau một chút.
- **Composed-skill drift.**Nghệ năng của cha mẹ phụ thuộc vào một đứa trẻ được tinh chỉnh. Nghệ năng phiên bản; một cha mẹ bị gắn vào v1 không phép thuật nhận ra v3.
- **Retrieval quality.**Việc lấy các vector trên mô tả kỹ năng giảm khi thư viện tăng lên hơn vài trăm.`category=tooling`").

```figure
voyager-skills
```

## Hãy xây dựng nó

`code/main.py`thực hiện thư viện kỹ năng stdlib:

- `Skill` tên, mô tả, mã (như chuỗi), phiên bản, thẻ, phụ thuộc.
- `SkillLibrary` đăng ký, tìm kiếm (tốc hiệu chồng chéo), soạn (tốc độ topological) và tinh chỉnh (tiếng đập phiên bản khi cập nhật).
- Một nhân viên kịch bản ghi nhận ba kỹ năng nguyên thủy, sáng tác một thứ tư, đánh bại và tinh chỉnh.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hình ảnh cho thấy thư viện viết, tìm kiếm, sáng tác, một sự thực hiện thất bại, và một v2 tinh chỉnh vòng lặp cuối cùng của Voyager.

## Sử dụng nó

- **Claude Agent SDK skills**(Anthropic)  tài liệu tham khảo năm 2026: mỗi kỹ năng có mô tả, mã và hướng dẫn; được tải theo yêu cầu trong một phiên đại lý.
- **skillkit**(npm: skillkit)  Quản lý kỹ năng liên quan đến các nhân viên cho 32+ nhân viên mã hóa AI.
- **Custom skill libraries** cụ thể về miền (nghệ năng SQL cho các đại lý dữ liệu, kỹ năng Terraform cho các đại lý ngoại tuyến).
- **OpenAI Agents SDK `tools`** ở cuối thấp; mỗi công cụ là một kỹ năng nhẹ.

## Chuyển nó

`outputs/skill-skill-library.md`tạo ra một thư viện kỹ năng hình Voyager với đăng ký, lấy lại, phiên bản và tinh chỉnh được kết nối với bất kỳ thời gian chạy mục tiêu nào.

## Các bài tập

1. Thêm một bộ dò chu kỳ phụ thuộc vào `compose()`Điều gì xảy ra khi kỹ năng A phụ thuộc vào B phụ thuộc vào A?
2. Thực hiện bản bản ghi kỹ năng mỗi khi một kỹ năng của cha mẹ tạo ra con`crafting@1`, một sự tinh tế cho `crafting@2`không được nâng cấp một cách im lặng.
3. Thay thế lấy token-overlap bằng các embedment-transformers (hoặc một BM25 stdlib impl). đo lấy@5 trên một thư viện đồ chơi 50 kỹ năng.
4. Thêm một đại lý "các chương trình học": với thư viện hiện tại và mô tả miền, đề xuất 5 kỹ năng thiếu.
5. Đọc tài liệu kỹ năng SDK của Claude Agent của Anthropic, chuyển thư viện đồ chơi sang kế hoạch kỹ năng SDK.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## Đọc thêm

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) giấy sách thư viện kỹ năng gốc
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) các kỹ năng như sản xuất năm 2026
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) kỹ năng và các yếu tố phụ trong thực tế
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) vòng lọc bên dưới Voyager
