# Việc giám sát có thể mở rộng và tổng quát yếu đến mạnh

> Burns và các đồng nghiệp. (OpenAI Superalignment, "Thế độ chung yếu đến mạnh", 2023) đề xuất một thay thế cho vấn đề siêu phù hợp: chỉnh sửa một mô hình mạnh bằng cách sử dụng nhãn được sản xuất bởi một mô hình yếu hơn. Nếu mô hình mạnh phổ biến đúng từ giám sát yếu kém không hoàn hảo, các phương pháp sắp xếp quy mô con người hiện tại có thể mở rộng đến các hệ thống siêu nhân. Giám sát có thể mở rộng và W2SG là bổ sung. Việc giám sát có thể mở rộng (chương trình thảo luận, mô hình phần thưởng tái tạo, phân hủy nhiệm vụ) làm tăng khả năng hiệu quả của giám sát viên để nó có thể theo kịp mô hình dưới sự giám sát. W2SG đảm bảo mô hình mạnh mẽ tổng quát đúng cách từ bất kỳ giám sát không hoàn hảo nào mà giám sát viên cung cấp. Debate Helps W2SG (arXiv:2501.13124, tháng 1 năm 2025) kết hợp chúng.

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator), TypeScript
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## Mục tiêu học tập

- Định nghĩa giám sát có thể mở rộng và tổng quát yếu đến mạnh và giải thích cách chúng bổ sung nhau.
- Mô tả thiết lập thử nghiệm Burns et al. 2023: chỉnh sửa GPT-4 bằng cách sử dụng nhãn từ GPT-2.
- Giải thích số liệu về khoảng cách hiệu suất được phục hồi (PGR) và nó đo lường gì.
- Hãy nêu ra ba cơ chế giám sát có thể mở rộng quy mô (phản thảo, mô hình hóa phần thưởng tái tạo, phân hủy nhiệm vụ) và một điểm mạnh của mỗi cơ chế.

## Vấn đề

Mỗi kỹ thuật sắp xếp cho đến nay trong giai đoạn 18 cho rằng người giám sát có thể đánh giá hành vi của mô hình. Khi mô hình là siêu nhân, người giám sát là dây chằng yếu. Câu hỏi siêu sắp xếp: có thể một giám sát yếu hơn có thể tạo ra một mô hình mạnh mẽ hơn, sắp xếp đáng tin cậy hơn không?

Burns et al. giảm điều này thành một thiết lập kinh nghiệm hoạt động hóa: giám sát mạnh với yếu, đo mức độ khả năng của mô hình mạnh tồn tại trong giám sát yếu. Đây không phải là giải pháp cho sự siêu việt  nó là một đại diện cho phép chúng ta đo tiến bộ.

## Khái niệm

### W2SG: thiết lập Burns et al.

- Mô hình yếu: lớp GPT-2.
- Mô hình mạnh: lớp GPT-4.
- Mục tiêu: GPT-4 mạnh trên nhiệm vụ.

Quy trình:
1. Nhận được dự đoán không bắn của mô hình yếu về một nhiệm vụ.
2. Định chỉnh mô hình mạnh trên dữ liệu có nhãn yếu.
3. Đánh giá độ chính xác của mô hình tinh chỉnh mạnh mẽ.

Các điểm cơ bản: độ chính xác của mô hình yếu, mức tối đa giám sát của mô hình mạnh trên nhãn vàng.

Phân tích lỗ hổng: Hỗn hổng hiệu suất được phục hồi (PGR) = (được điều chỉnh tốt - yếu) / (trần - yếu). PGR của 1.0 có nghĩa là giám sát yếu hoàn toàn đóng lại khoảng cách; PGR của 0 có nghĩa là giám sát yếu không giúp đỡ.

### Burns et al. Kết quả kinh nghiệm

Trong các nhiệm vụ NLP, cờ vua và mô hình giải thưởng, PGR luôn tích cực: mô hình mạnh phổ biến vượt ra ngoài những sai lầm của người giám sát yếu. PGR cụ thể cho nhiệm vụ dao động từ ~20% đến ~80%. mô hình mạnh "nghiểu" nhiệm vụ dự định từ các nhãn bất toàn, bổ sung với những người trước tiên được đào tạo trước đó.

Các giới hạn Burns et al. lưu ý:
- Sự khác biệt giữa yếu và mạnh ở đây là khả năng, không phải sự sắp xếp. mô hình yếu là sắp xếp; mô hình siêu nhân thực sự có thể được sắp xếp bởi con người nhưng với một khoảng cách khả năng lớn hơn nhiều.
- Việc tổng quát mô hình mạnh có thể là nhiều hơn về nhiệm vụ trước hơn là về việc phục hồi ý định thực tại cơ bản.
- Việc tạo ra kiến thức ẩn trong mô hình mạnh là vấn đề thực sự; PGR đo lường một hoạt động cụ thể.

### Giám sát có thể mở rộng: ba cơ chế

- **Debate (Irving et al. 2018).**Hai trường hợp của U tranh luận về các bên đối lập; thẩm phán yếu có thể quyết định. Hiểu: tìm kiếm một câu trả lời đúng thuyết phục dễ hơn là tìm kiếm một câu trả lời sai thuyết phục. Nghiên cứu gần đây năm 2024-2025 (Khan et al., Michael et al.) cho thấy tranh luận đôi khi giúp ích và đôi khi không giúp ích, và liệu nó có giúp ích hay không phụ thuộc vào cấu trúc nhiệm vụ.
- **Recursive Reward Modeling (Leike et al. 2018).**U giúp người ta đào tạo mô hình phần thưởng cho U+1.
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018).**Phân hủy một nhiệm vụ khó thành các nhiệm vụ phụ mà con người có thể kiểm tra, lặp lại.

Mỗi cơ chế giả định một cái gì đó về cấu trúc của nhiệm vụ hoặc sự sắp xếp của các thành phần trung gian.

### Tại sao giám sát có thể mở rộng và W2SG là bổ sung

Việc giám sát có thể mở rộng sẽ giúp giám sát viên có hiệu quả hơn.
W2SG sẽ thu hẹp khoảng cách từ bất kỳ tín hiệu bất toàn nào mà giám sát viên có thể cung cấp.

Lang et al.  Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124) kết hợp chúng: một giao thức tranh luận cung cấp các nhãn yếu tốt hơn, và mô hình mạnh được đào tạo trên các nhãn đó.

### Phương pháp tổ chức

Nhóm Superalignment của OpenAI đã bị giải tán vào tháng 5 năm 2024 sau khi Jan Leike rời khỏi Anthropic. Chương trình nghị sự (chăm sóc có thể mở rộng, W2SG, nghiên cứu sắp xếp tự động) tiếp tục tại Anthropic và tại các phòng thí nghiệm học tập  MATS (Lớp 28), Redwood (Lớp 10), Apollo (Lớp 8), METR (Lớp 28).

### Khi điều này phù hợp với giai đoạn 18

Bài học 6-10 mô tả mối đe dọa và mô hình phòng thủ theo giả định U là không đáng tin cậy. Bài học 11 là mô hình tấn công: làm cho người giám sát đủ mạnh để xác minh sự phù hợp của U. Bài học 12-16 sau đó chuyển sang công cụ thực tế của đánh giá đối thủ.

```figure
scalable-oversight
```

## Sử dụng nó

`code/main.py`mô hình mạnh có 95% trần nhà trên nhãn vàng. Bạn tinh chỉnh mô hình mạnh trên nhãn yếu, đo PGR, và so sánh với mạnh trên vàng và yếu một mình.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-w2sg-pgr.md`. Với mô tả thiết lập giám sát, nó xác định người giám sát yếu, mô hình mạnh, chất lượng giám sát, và tính toán (hoặc yêu cầu) PGR. Nó đánh dấu liệu tuyên bố là " yếu có thể giám sát mạnh" hoặc " cơ chế giám sát yếu + có thể giám sát mạnh".

## Các bài tập

1. Đi chạy`code/main.py`. báo cáo PGR cho điểm yếu_sự chính xác = 0,60, 0,70, 0,80. Giải thích hình dạng đường cong PGR.

2. Thay đổi nhãn yếu để có lỗi cấu trúc (ví dụ, luôn sai trong một lớp đầu vào cụ thể). PGR tăng, giảm hoặc giữ nguyên như vậy? Giải thích.

3. Hãy đọc Burns et al. 2023 Phần 4.3 (các nhiệm vụ của NLP). Tái tạo lại trực giác "sự tin cậy phụ trợ": khi mô hình mạnh mẽ tự tin hơn các nhãn hiệu yếu, ai thắng?

4. Thiết kế một giao thức giám sát có thể mở rộng mà kết hợp tranh luận và phân hủy nhiệm vụ cho một nhiệm vụ kỹ thuật phần mềm. Chọn một chế độ thất bại của mỗi thành phần và giải thích cách kết hợp giải quyết hoặc không giải quyết từng thành phần.

5. Cần nói rõ những gì có thể làm sai lệch tuyên bố "sự tổng hợp yếu đến mạnh là một con đường khả thi để siêu phù hợp".

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "making the overseer stronger" | Mechanisms that increase an overseer's ability to evaluate a more-capable model |
| W2SG | "weak supervises strong" | Fine-tuning a strong model on weak labels and measuring the capability recovered |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = fully closed, 0 = no help |
| Debate | "two U instances argue" | Scalable oversight mechanism where a weak judge picks between two U defenders |
| RRM | "recursive reward modeling" | U helps train the reward model for U+1; overseer capability tracks U |
| Task decomposition | "sub-tasks the human checks" | Break a hard task into sub-tasks the human can verify, recursively |
| Superalignment | "aligning superhuman AI" | The research agenda concerned with aligning models the human cannot directly evaluate |

## Đọc thêm

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) giấy W2SG
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) cơ chế tranh luận
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) Mô hình hóa phần thưởng tái tạo
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) 2024 nghiên cứu kinh nghiệm về tranh luận với những người tranh luận mạnh mẽ hơn
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) 2025 kết hợp cuộc tranh luận + W2SG
