# Các chế độ thất bại  MAST, tư duy nhóm, Monoculture, lỗi lồng

> Định dạng phân loại tham chiếu cho năm 2026 là **MAST**(Cemri et al., NeurIPS 2025, arXiv:2503.13657), được lấy từ 1642 dấu vết thực hiện trên 7 MAS mã nguồn mở hiện đại cho thấy **41–86.7% failure rate**. Ba loại gốc: **Specification Problems**(41,77%)  vai trò không rõ ràng, định nghĩa nhiệm vụ không rõ ràng; **Coordination Failures**(36,94%)  sự cố liên lạc, sự mất đồng bộ trạng thái; **Verification Gaps**(21.30%)  thiếu xác nhận, không có kiểm tra chất lượng.**Groupthink**gia đình (arXiv:2508.05687) thêm: sự sụp đổ của đơn văn hóa (những mô hình cơ bản tương tự → thất bại tương quan), sự thiên vị về sự phù hợp (những đại lý tăng cường các lỗi của nhau), lý thuyết suy nghĩ thiếu sót, động cơ hỗn hợp, thất bại độ tin cậy hàng loạt. Ví dụ: bão thử lại khi một lỗi thanh toán kích hoạt các lần thử lại đơn đặt hàng, gây ra các lần thử lại hàng tồn kho, khiến dịch vụ hàng tồn kho bị áp đảo (10 lần tải trong giây  cần máy cắt mạch). Mùi độc trí nhớ: ảo giác của một nhân vật vào bộ nhớ chia sẻ, nhân vật tiếp theo xử lý nó như là sự thật; độ chính xác dần suy giảm, làm cho chẩn đoán gốc rễ đau đớn.**STRATUS**(NeurIPS 2025) báo cáo cải thiện thành công giảm nhẹ 1,5 lần thông qua các đại lý phát hiện / chẩn đoán / xác thực chuyên dụng. Bài học này xử lý các chế độ thất bại như các mục tiêu kỹ thuật hạng nhất.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## Vấn đề

Các hệ thống đa đại lý thất bại trong 41-86,7% thời gian trên các nhiệm vụ thực (Cemri et al. 2025 đo này trên 7 MAS nguồn mở). Điều đó không thể gỡ lỗi bằng cách "chỉ thêm thêm thêm các đại lý. " Các thất bại có nguyên nhân cấu trúc.

Thực hành sản xuất năm 2026 là đối xử với các chế độ thất bại như là đầu vào thiết kế. Kiến trúc của bạn không đủ tốt cho đến khi bạn có thể chỉ ra từng loại MAST và đặt tên cho sự giảm thiểu mà bạn triển khai.

## Khái niệm

### Các loại MAST

**Specification Problems (41.77% of failures).**Nhiệm vụ của đại lý không được định nghĩa đủ chặt chẽ.

- Sự mơ hồ về vai trò: hai đại lý đều nghĩ rằng họ là nhà phê bình.
- Nhiệm vụ được xác định rõ ràng: "đánh summarize this" khi người dùng muốn một góc độ cụ thể.
- Các tiêu chí thành công ngầm: đại lý không thể nói liệu nó có thành công hay không.

Giảm thiểu:
- Viết hợp đồng vai trò rõ ràng.
- Trước khi bắt đầu, hãy xác định "được hoàn thành giống như X".
- Kiểm tra kỹ thuật trước chuyến bay: một nhân viên riêng xem xét định nghĩa nhiệm vụ trước khi vận chuyển.

**Coordination Failures (36.94%).**Truyền thông hoặc tình trạng suy giảm.

Ví dụ:
- Hai đại lý cập nhật trạng thái chia sẻ mà không đồng bộ.
- Thông điệp bị mất giữa các đại lý (trận xếp hàng không, thời gian nghỉ).
- State drift: Agent A nghĩ rằng nhiệm vụ đã hoàn thành; Agent B vẫn đang thực hiện.

Giảm thiểu:
- Phiên bản chia sẻ trạng thái với đồng thời lạc quan.
- Sự thừa nhận rõ ràng cho các thông điệp quan trọng (được thử lại cho đến khi được bấm).
- Các điểm kiểm soát đồng bộ định kỳ; phát hiện sự lở hở sớm.

**Verification Gaps (21.30%).**Không kiểm tra độc lập về các kết quả.

Ví dụ:
- Một nhân viên tuyên bố thành công; không ai xác minh.
- Dòng đại lý đều tin vào sự ra đi của tiền nhiệm.
- Các bài kiểm tra không có trong hành vi hợp tác mới nổi.

Giảm thiểu:
- Trình kiểm tra độc lập (Học 13). Chỉ đọc, truy cập nguồn độc lập.
- Hợp đồng giao dịch rõ ràng: "Sản lượng của A phải vượt qua kiểm tra C trước khi B bắt đầu".
- Lập nhật kết quả cho phân tích hậu hoc.

### Gia đình tư duy nhóm (arXiv:2508.05687)

Năm thất bại liên quan khi các chất homogenize hoặc bắt chước nhau:

**Monoculture collapse.**Một mô hình cơ bản hoặc dữ liệu đào tạo tương quan. khi ba đại lý chia sẻ một LLM, họ chia sẻ ảo giác của nó.

**Conformity bias.**Các đại lý thích nghi với người đồng nghiệp lớn tiếng nhất hoặc tự tin nhất, ngay cả khi sai.

**Deficient ToM.**Các đại lý không thể mô hình hóa niềm tin của nhau; sự phối hợp bị phá vỡ (Dạy học 18).

**Mixed-motive dynamics.**Các đại lý có những động lực tương thích một phần sẽ hướng về trung tâm thỏa hiệp, điều này không thỏa mãn ai.

**Cascading reliability failures.**Mô hình lỗi của một thành phần kích hoạt mô hình lỗi trong các thành phần phụ thuộc.

### Ví dụ:  cơn bão tái thử

Một mô hình tai nạn cổ điển năm 2026:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

Phong cách là cổ điển:**circuit breakers**Khi tỷ lệ lỗi dòng chảy sau vượt quá ngưỡng, mạch ngắn với kết quả được lưu trữ trong cache hoặc mặc định.

Các bộ cắt mạch là một trong số ít các biện pháp giảm lỗi đa tác nhân mà bạn vay trực tiếp từ các hệ thống phân tán mà không cần sửa đổi.

### Mùi độc trí nhớ (được xem xét lại)

Từ Bài học 13: ảo giác của một nhân viên trở thành thực tế ký ức chung; các nhân viên dòng chảy sau suy luận về thực tế độc.

Sự suy giảm độ chính xác dần dần là triệu chứng: bạn không bị tai nạn; bạn bị lôi kéo chậm mà khó để bắt nguồn.

Giảm thiểu: chỉ có bản ghi, nguồn gốc, xác minh không thể viết.

### STRATUS  Các chất đặc biệt cho việc phát hiện lỗi

STRATUS (NeurIPS 2025) báo cáo cải thiện hiệu quả giảm nhẹ 1,5 lần khi bạn triển khai:

- **Detection agent.**Đồng hồ cho các mô hình triệu chứng (sự bất đồng cao, thử lại, độ phân trần chính xác).
- **Diagnosis agent.**Với các triệu chứng, suy luận nguyên nhân gốc có thể từ phân loại MAST.
- **Validation agent.**Sau khi áp dụng thuốc giảm bớt, kiểm tra các triệu chứng rõ ràng.

Đây là phản ứng tai nạn kiểu SRE, được áp dụng cho các hệ thống đại lý. Ba vai trò đều có thể là đại lý LLM với các lời nhắc chuyên môn.

### Việc kiểm toán trong chế độ thất bại

Một thực tiễn tốt nhất năm 2026 là một kiểm toán triệt để (và mỗi bản phát hành lớn) về chế độ thất bại:

1. **Trace sample.**Thu thập khoảng 1000 dấu vết thực hành.
2. **Categorize.**Đối với các lỗi của mỗi dấu vết, hãy lập bản đồ đến các danh mục MAST + Groupthink.
3. **Compute failure-by-category rate.**Những loại nào thống trị hệ thống của bạn?
4. **Rank mitigations.**Phong cách nào sẽ loại bỏ nhiều thất bại nhất?
5. **Pick 2-3 mitigations.**Thực hiện; kiểm toán lại quý tới.

Sự kỷ luật quan trọng hơn những lựa chọn cụ thể.

### Khi hệ thống thất bại lặng lẽ

Loại lỗi nguy hiểm nhất là lỗi chính xác im lặng. Một hệ thống thất bại lớn (sự cố, ngoại lệ, cảnh báo) có thể được giám sát. Một hệ thống tạo ra các kết quả có thể chấp nhận được nhưng không đúng không thể được phát hiện bằng nhật ký ngoại lệ. Đây là lý do tại sao lỗ hổng xác minh là loại lỗi đắt nhất mặc dù chỉ là 21,30% theo số.

Đầu tư vào:
- Phân tích con người dựa trên mẫu.
- Các xét nghiệm hồi quy của bộ dữ liệu vàng.
- Các nhân viên liên quan kiểm tra các kết quả quan trọng.

### Thất bại so với thất bại chậm

Một số thất bại là ngay lập tức; một số là chậm. Các thất bại ngay lập tức (sự mất thời gian, không phù hợp với schema, lỗi tác giả) là rẻ để phát hiện.

Động thái kỹ thuật năm 2026: các trình thay thế thất bại chậm của công cụ để bạn có thể bắt kịp khi nó trở thành một lỗi hiển thị. Tốc độ thỏa thuận, tốc độ thử lại, phân phối chiều dài đầu ra và khoảng cách chỉnh sửa giữa các phiên bản đại lý liên tiếp đều là các trình thay thế hữu ích.

```figure
a5-retry-cascade
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `FailureTaxonomy` phân loại các sự cố mô phỏng thành các loại MAST + Groupthink.
- `CircuitBreaker` mô hình cổ điển; mở khi tỷ lệ lỗi vượt quá ngưỡng.
- `RetryStormSimulator` cho thấy sự cố hàng loạt; bật / tắt bộ cắt mạch.
- `DetectionAgent` Scripts STRATUS kiểu phù hợp triệu chứng.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Tạo sản lượng dự kiến:
- thử lại bão không có bộ cắt mạch: lỗi hàng tồn kho nổ (được mô phỏng).
- Với bộ cắt mạch: nắp ở ngưỡng; phản ứng chế độ suy giảm được phục vụ.
- Máy phát hiện đánh dấu mô hình và đặt tên cho danh mục MAST.

## Sử dụng nó

`outputs/skill-mast-auditor.md`thực hiện một kiểm toán chế độ thất bại theo kiểu MAST trên một hệ thống đa đại lý.

## Chuyển nó

Phân tích chế độ thất bại trong sản xuất:

- **MAST audit per quarter.**Không phải là hàng năm, các loại thay đổi khi hệ thống của bạn phát triển.
- **Circuit breakers everywhere.**Mỗi cuộc gọi ra ngoài đến bất kỳ dịch vụ phụ thuộc nào.
- **Golden datasets.**Kiểu, chất lượng cao, kiểm tra tay, kiểm tra hồi phục với chúng hàng tuần.
- **STRATUS trio.**Các chất phát hiện + Chẩn đoán + Thiết lập kiểm tra sản xuất. Bắt đầu với chất phát hiện chỉ; thêm chẩn đoán khi các triệu chứng ồn ào.
- **Failure budget.**SLO rõ ràng cho tỷ lệ thất bại theo hạng mục.

## Các bài tập

1. Đi chạy`code/main.py`- Đảm bảo máy cắt mạch đóng cửa cơn bão, thay đổi ngưỡng thất bại và quan sát sự đổi giá.
2. Thực hiện một**slow-failure proxy**: tỷ lệ đồng thuận trên 3 đại lý song song. Khi nó giảm mạnh, kích hoạt một cảnh báo. Chơi mô phỏng một trôi động monoculture bằng cách liên kết dần các sản lượng đại lý.
3. Xem Cemri et al. (arXiv:2503.13657). Chọn một trong 7 hệ thống MAS của họ và lập bản đồ 3 loại thất bại hàng đầu của nó.
4. Đọc bài báo Groupthink (arXiv:2508.05687). xác định ra mô hình nào trong năm mô hình khó phát hiện nhất trong sản xuất.
5. Thiết kế một bộ ba phát hiện-hình dung-tính xác định kiểu STRATUS cho một hệ thống đa tác nhân cụ thể mà bạn biết. Các triệu chứng nào mà phát hiện theo dõi?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | "The 2026 taxonomy" | Cemri 2025; 3 root categories + 14 sub-types of failures. |
| Specification Problem | "Role ambiguity" | Task or role under-defined; agents do not know what to do. |
| Coordination Failure | "State drift" | Communication or sync breakdown between agents. |
| Verification Gap | "No one checked" | Outputs accepted without independent validation. |
| Groupthink family | "Homogeneity failures" | Monoculture, conformity, deficient ToM, mixed-motive, cascading. |
| Monoculture collapse | "Same model, same hallucinations" | Correlated errors from shared base model or training data. |
| Retry storm | "Cascading error amplification" | One failure triggers retries which amplify load downstream. |
| Circuit breaker | "Fail fast on error rate" | Open when error rate exceeds threshold; short-circuit with default. |
| STRATUS | "Incident response trio" | Detection + diagnosis + validation agents. 1.5x mitigation success. |
| Memory poisoning | "Hallucinations propagate" | Shared-memory fact tainted; downstream agents reason on poison. |

## Đọc thêm

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Định dạng phân loại MAST, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) Monoculture, conformity, và phân loại năm gia đình
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) Việc đăng nhập thủ tục NeurIPS 2025 (phát hiện + chẩn đoán + xác nhận)
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) tham chiếu mạch cắt đường truyền
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) ghi chú về chế độ thất bại sản xuất
