# Những thiết kế tự cải thiện giới hạn

> Nghiên cứu đã hội tụ về bốn nguyên thủy để giới hạn vòng tự cải thiện. Các biến số chính thức phải được giữ qua mọi chỉnh sửa. Các neo sắp xếp không thể thay đổi. Các hạn chế đa mục tiêu mà mọi chiều kích (sự an toàn, công bằng, độ bền) phải có, không chỉ hiệu suất. Khám phá sự lùi lại làm dừng vòng lặp khi các số liệu lịch sử cho thấy mất khả năng. Không một trong số đó là bằng chứng về an toàn  kết quả lý thuyết thông tin (độ phức tạp Kolmogorov, định lý Lob) ràng buộc những gì bất kỳ hệ thống nào có thể chứng minh về những người kế nhiệm của nó. Chúng là những biện pháp giảm thiểu làm tăng chi phí thất bại im lặng.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Vấn đề

Các mô phỏng đua của bài học 7 cho thấy sự khác biệt tốc độ nhỏ kết hợp thành khoảng cách lớn. Nghiên cứu trường hợp DGM của bài học 4 cho thấy các vòng lặp có thể tích cực chơi các nhà đánh giá của riêng họ. Cả hai kết quả đều chỉ ra câu hỏi kỹ thuật tương tự: bạn có thể đặt những hạn chế nào trên một vòng lặp tự cải thiện để các hạn chế không thể bị làm suy yếu lặng lẽ bởi vòng lặp chính nó?

ICLR 2026 RSI Workshop summary (openreview.net/pdf?id=OsPQ6zTQXV) xác định bốn nguyên thủy như vậy. RSP v3.0 (Dạy 19) của Anthropic và FSF v3 (Dạy 20) của DeepMind đều đề cập đến chúng trong ngưỡng khả năng.

Các kết quả lý thuyết thông tin kết nối những gì bất kỳ hệ thống nào có thể chứng minh về người kế nhiệm của nó, và không có thiết kế hiện tại nào đóng lại vấn đề một cách chính thức. Một vòng lặp có giới hạn tốt là an toàn hơn một vòng lặp không giới hạn, không an toàn trong các thuật ngữ tuyệt đối.

## Khái niệm

### Primitive 1: Invariants chính thức

Một tính không biến đổi là một thuộc tính phải giữ trước và sau mỗi tự sửa đổi. Ví dụ:

- Phân phối sản lượng được điều kiện theo một tiêu đề cấu trúc cố định (Học 17).
- Không có cuộc gọi công cụ nào đến một điểm cuối không được phép.
- Tưởng thức viết đi qua một con đường được ghi chép, ký kết.
- Hash module của người đánh giá phù hợp với phiên bản được phê duyệt.

Các biến thể được kiểm tra bởi mã bên ngoài vòng lặp không thể chỉnh sửa. Nếu một sửa đổi được đề xuất vi phạm một biến thể, nó sẽ bị từ chối. Điều này bắt được chế độ đánh giá-phản trị kiểu DGM (Dạy học 4).

Phần khó khăn là chọn các biến số cần thiết cho an toàn và tính toán trong thời gian hợp lý.

### Primitive 2: Anchor đường thẳng

Một neo sắp xếp là một sự đại diện không thay đổi của mục tiêu cốt lõi của vòng lặp, được gắn bên ngoài bề mặt chỉnh sửa của vòng lặp. Ví dụ:

- Một văn bản hiến pháp (Dạy 17) được tải từ một vị trí chỉ đọc trên mỗi lời kêu gọi.
- Một nhà đánh giá trong một kho lưu trữ riêng với kiểm soát truy cập độc lập.
- Một bản ghi giấy phép công cụ được ký bởi con người và được xác minh lại mỗi chu kỳ.

Vai trò của neo là ngăn chặn sự trôi dạt khách quan.

Chế độ thất bại tinh tế: một vòng xoắn mà vòng lặp không thể chỉnh sửa vẫn có thể được giải thích lại bởi một vòng xoắn mà di chuyển theo cách nó đọc bộ xoắn. AI hiến pháp (Dạy học 17) được dựa trên lý do rõ ràng để xử lý các tình huống mới; lớp lý luận đó là nơi mà sự dẫn dắt giải thích sống.

### Primitive 3: các hạn chế đa mục tiêu

Một vòng lặp tối ưu hóa một điểm số thang đo sẽ tìm ra các đường tắt. Một vòng lặp phải đáp ứng nhiều hạn chế cứng cùng lúc có ít đường tắt hơn.

- Hiệu suất (chỉ số chuẩn cấp nhiệm vụ)
- An toàn (bản đánh giá nhóm đỏ, tỷ lệ từ chối trên xấu được biết đến)
- Sự công bằng (chỉ giới tác động khác nhau đối với các nhóm phụ nhạy cảm)
- Độ bền (các bộ thử OOD, xử lý đầu vào đối kháng)

Một sửa đổi chỉ được chấp nhận nếu mọi hạn chế vẫn tồn tại. Thống đốc chi phí của Bài 13 xếp lại với các hạn chế tài chính. Llama Guard của Bài 18 được kết nối với như một trục an toàn.

### Primitive 4: Khám phá sự lùi

Điểm số của mỗi chu kỳ được so sánh với phân phối lịch sử. Một sự sụt giảm vượt qua dung lượng được cấu hình dừng vòng lặp. Điều này bắt mất khả năng im lặng mà nếu không sẽ được hấp thụ vào trung bình chạy khi vòng lặp "bắt đầu" nó.

Một thực tế thực hiện: lưu trữ điểm số mỗi nhiệm vụ của các chu kỳ N cuối cùng. Mỗi chu kỳ mới tính toán một delta mỗi nhiệm vụ. Nếu bất kỳ delta nào giảm xuống dưới ngưỡng, chu kỳ bị từ chối và một cuộc đánh giá của con người.

### Các giới hạn lý thuyết thông tin

Sự phức tạp của Kolmogorov và định lý Lob đặt ra ranh giới trên những gì một hệ thống có thể chứng minh về bản thân. Máy Godel chính thức của Schmidhuber (Dạy học 4) nhắm đến giới hạn cao nhất như vậy; không ai đã hoàn thành một bằng chứng không tầm thường. Kết quả của Lob nói: nếu một hệ thống có thể chứng minh rằng "Tôi sẽ làm X nếu tôi chứng minh tôi nên làm X", nó sẽ làm X mà không chứng minh nó nên, một thất bại tham chiếu tự thân nổi tiếng.

Điều này có nghĩa là chúng ta không thể giải quyết được vấn đề an toàn, chúng làm cho sự thất bại im lặng trở nên tốn kém hơn, một vòng lặp độc hại hoặc bị trôi qua để tránh một kiểm tra bị mất đi, giờ đây sẽ làm suy yếu một cái rõ ràng, đó là một chữ ký dễ phát hiện hơn.

### Một ví dụ đã được thực hiện

Giả sử một đại lý đề xuất một chỉnh sửa.

1. Kiểm tra không thay đổi: module hashes, biểu đồ giấy phép công cụ, tiêu đề hiến pháp.
2. Kiểm tra neo: tuyên bố khách quan phù hợp với phiên bản được phê duyệt (từ về cácbyte hoặc ngữ nghĩa).
3. Đánh giá đa mục tiêu: hiệu suất, an toàn, công bằng, độ bền.
4. Khám phá sự lùi: không có trục giảm nhiều hơn dung nạp.

Tất cả bốn phải vượt qua để chỉnh sửa hạ cánh.

```figure
bounded-gates
```

## Sử dụng nó

`code/main.py`chạy một vòng lặp tự cải thiện được giới hạn trên đồ chơi kiểu DGM từ Bài học 4, nhưng với bốn nguyên thủy được xếp lớp trên. Mỗi nguyên thủy có thể được bật hoặc vô hiệu hóa riêng biệt.

## Chuyển nó

`outputs/skill-bounded-loop-review.md`kiểm tra một vòng lặp giới hạn được đề xuất và ghi điểm nào trong bốn nguyên thủy thực sự thực hiện so với yêu cầu.

## Các bài tập

1. Đi chạy`code/main.py`xác nhận vòng lặp vẫn cải thiện trên số liệu chính mà không để hack thắng.

2. Thiết lập đầu vào khi điều này dẫn đến việc mất khả năng im lặng được chấp nhận.

3. Thiết lập giới hạn đa mục tiêu. Hình bày vòng lặp hội tụ trên trục hiệu suất trong khi trục an toàn giảm.

4. Thiết kế một bộ neo sắp xếp cho một nhân viên mã hóa.

5. Đọc bản tóm tắt của Hội thảo RSI ICLR 2026 chọn một trong bốn nguyên thủy và đề xuất một cải tiến cụ thể cho hiện tại của nghệ thuật.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## Đọc thêm

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) sự hội tụ bốn nguyên thủy.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Các ngưỡng khả năng đa mục tiêu.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) giám sát sự sắp xếp lừa đảo như một nguyên thủy không thay đổi.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) tổ tiên chính thức-bằng chứng của những nguyên thủy này.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) cơ sở lập trình dựa trên lý do.
