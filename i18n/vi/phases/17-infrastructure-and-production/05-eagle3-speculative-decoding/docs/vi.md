# EAGLE-3 Việc giải mã dự đoán trong sản xuất

> Việc giải mã giả định kết hợp mô hình dự thảo nhanh với mô hình mục tiêu. Dự thảo đề xuất các token K; mục tiêu xác minh bằng một forward duy nhất; các token được chấp nhận là miễn phí. Năm 2026, EAGLE-3 là biến thể cấp sản xuất  nó đào tạo một đầu dự thảo trên các trạng thái ẩn của mô hình mục tiêu thay vì trên mã thông báo thô, đẩy tỷ lệ chấp nhận alpha vào băng thông 0.6-0.8 trên trò chuyện chung. Câu hỏi đúng không phải là "mặt hước nhanh như thế nào" mà là " alpha là gì trên lưu lượng truy cập của tôi?" Nếu alpha giảm xuống dưới ~ 0.55, việc giải mã giả định là âm tính tại đồng thời cao bởi vì mỗi dự thảo bị từ chối chi phí một mục tiêu tiếp theo thứ hai. Bài học này dạy bạn phải đo alpha trước và xoay cờ sau.

**Type:** Learn
**Languages:** Python (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên ba thế hệ giải mã giả định và giải thích những gì EAGLE-3 thay đổi từ EAGLE-2 và từ mô hình dự thảo cổ điển.
- Định nghĩa tỷ lệ chấp nhận alpha, tính toán tốc độ dự kiến từ alpha và K (giờ dài), và xác định alpha chia bằng cho đồng thời mục tiêu của bạn.
- Giải thích tại sao việc giải mã giả định là chọn lựa (không phải mặc định) trong vLLM 2026 và tại sao bật nó mà không đo alpha là một mẫu chống sản xuất.
- Viết một kế hoạch đo lường: điểm chuẩn nào, phân phối nào, điểm đồng thời nào, số liệu nào để nhập vào.

## Vấn đề

Decode là kết nối bộ nhớ. trên một H100 chạy Llama 3.3 70B FP8, mỗi bước decode đọc tất cả ~ 70 GB trọng lượng từ HBM và phát ra một token mỗi chuỗi.

Việc giải mã giả định khai thác khoảng cách. Tạo các mã thông báo ứng cử viên K với mô hình dự thảo rẻ tiền, sau đó yêu cầu mô hình mục tiêu xác minh tất cả K trong một lần đi trước. Mỗi mã thông báo được xác minh thực sự miễn phí (được rút tiền thành một loạt các mã thông báo K mà mục tiêu đã phải làm bất cứ lúc nào).

Phương pháp mô hình dự thảo cổ điển sử dụng mô hình nhỏ hơn của cùng một gia đình (Llama 3.2 1B dự thảo cho Llama 3.3 70B). Nó hoạt động nhưng tỷ lệ chấp nhận là trung bình  phân phối mô hình nhỏ hơn khác với mục tiêu. Eagle, sau đó là Eagle-2, sau đó là Eagle-3 tập trung một đầu dự án nhẹ trực tiếp vào trạng thái bên trong của mô hình mục tiêu, do đó phân phối dự án theo dõi mục tiêu nhiều hơn. Đó là lý do tại sao alpha đi từ 0,4 với mô hình dự thảo đến 0,6-0,8 với EAGLE-3.

Vận động: EAGLE-3 sẽ chọn tham gia vào vLLM 2026. `speculative_config`Đội ngũ chuyển đổi nó mà không đo alpha trên lưu lượng truy cập thực của họ thường thấy độ trễ đuôi trở nên tồi tệ hơn, không tốt hơn.

## Khái niệm

### Điều gì tính toán giải mã thực sự mua

Nếu không có mã hóa đặc điểm, chi phí mỗi token là một mục tiêu tiến. Với mã hóa đặc điểm ở chiều dài dự thảo K và chấp nhận alpha, dự kiến các token cho mỗi mục tiêu tiến là `1 + K * alpha`- Tốc độ tăng tốc là`(1 + K * alpha) / (1 + epsilon)`nơi epsilon là draft-plus-verify overhead. cho K=5, alpha=0.7: `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`Số lượng trong thế giới thực tập hợp khoảng 2-3 lần vì alpha hiếm khi cao như vậy trên lưu lượng sản xuất và epsilon phát triển ở kích thước lô cao.

### Tại sao alpha là chỉ số duy nhất quan trọng

Các token bị từ chối không biến mất  họ buộc một mục tiêu thứ hai đi về phía trước cho token bị từ chối đầu tiên. Với khối lượng làm việc mà alpha giảm xuống 0,4, bạn phải trả chi phí tổng hợp cộng với xác minh cộng với việc tái đóng. Ở đồng thời cao (chẳng hạn 256 đồng thời), lô decode đã đủ lớn để khoảng cách băng thông bộ nhớ giữa "chỉ mục tiêu" và "chỉ mục tiêu với xác minh" giảm đi. Dưới alpha 0.55 trên hầu hết phần cứng 2026, mã giải mã đặc điểm là âm tính.

Alpha khác nhau theo khối lượng công việc. Trong cuộc trò chuyện chung kiểu ShareGPT, EAGLE-3 được đào tạo trên ShareGPT đạt 0,6-0,8. Đối với giao thông cụ thể về lĩnh vực (điều lệ, y tế, pháp lý) người dự thảo được đào tạo về dữ liệu chung giảm xuống 0,4-0,6. Trình luyện một bộ phận cụ thể về đầu dự thảo phục hồi alpha  nó là một công việc đào tạo nhẹ, nhanh chóng so với mục tiêu fine tuning. Giai đoạn 7 · 16 và Giai đoạn 10 · 15 trích dẫn các giá trị cao hơn (0,85 và trên). Đó là tỷ lệ cho mỗi token trên các tiêu chuẩn trò chuyện phù hợp với dữ liệu đào tạo dự thảo. Hãy lập kế hoạch với các băng nhóm trên trang này và đo alpha theo lưu lượng truy cập của riêng bạn.

### Những thế hệ của đại bàng một lần

- **Classic draft model**: mô hình nhỏ cùng gia đình. Alpha 0.3-0.5. cơ sở hạ tầng đơn giản  hai mô hình tải, dự thảo chạy K về phía trước cho mỗi mục tiêu về phía trước.
- **EAGLE-1 (2024)**: đầu đầu một đầu được huấn luyện trên các trạng thái ẩn mục tiêu (phần cuối). Alpha ~ 0,5-0,6.
- **EAGLE-2 (2025)**: chiều dài bản thảo thích ứng và bản thảo dựa trên cây (thêm vào nhiều nhánh trong một mục tiêu vượt qua). Alpha ~ 0,6-0,7.
- **EAGLE-3 (2025-2026)**: đầu dự án được đào tạo trên nhiều lớp mục tiêu (không chỉ là cuối cùng), sắp xếp tốt hơn. Alpha ~ 0,6-0,8 trên trò chuyện chung.

### Công thức sản xuất năm 2026

1. Mô hình mục tiêu tàu đơn giản. đo TTFT cơ sở, ITL, thông qua tại đồng thời mục tiêu.
2. Khả năng dự thảo EAGLE-3 thông qua vLLM `speculative_config`- Đổi lại điểm chuẩn.
3. Tỷ lệ chấp nhận nhật ký alpha. vLLM V1 báo cáo điều này như `spec_decode_metrics.accepted_tokens_per_request`Chia theo chiều dài dự thảo yêu cầu để có được alpha.
4. Nếu alpha < 0,55 về phân phối lưu lượng sản xuất, vô hiệu hóa mã thông số kỹ thuật hoặc đào tạo một bản thảo EAGLE-3 cụ thể cho lĩnh vực.
5. Khi đồng thời sản xuất, chạy lại.

### Hỗn hẹp sản xuất: đuôi P99

Phân tích thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin thông tin

### Khi EAGLE-3 đã được triển khai

Google triển khai mã hóa giả định trong AI Overviews vào năm 2025 (các chất lượng tương tự, phản ứng nhanh hơn). vLLM V1 tàu `speculative_config`SGLang hỗ trợ EAGLE-3 như là con đường dự thảo được khuyến cáo cho tải trọng công việc nặng tiền tố.

### Phá toán bằng nhau trong một dòng

Tốc độ tăng tốc dự kiến: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`- Đặt`S = 1`giải quyết cho alpha: `alpha_breakeven = verify_overhead / K`. Đối với tiêu chuẩn xác minh_overhead ~0.15 và K=5: `alpha_breakeven = 0.03`Nhưng đó là toán học giải mã nguyên thô. Khi đồng thời cao chi phí kiểm tra tăng lên và lô giải mã đã giảm giá đọc bộ nhớ qua các chuỗi, do đó hiệu quả alpha_breakeven leo lên ~ 0,45-0,55 trong thực tế.

### Khi nào không nên sử dụng mã hóa giả định

- Lập 1 offline generation mà thời gian trễ không quan trọng.
- Các sản phẩm đầu ra rất ngắn (dưới 50 token).
- Các tên miền chuyên nghiệp không có người huấn luyện tên miền.
- Giả sử mỗi cặp tính năng tạo thành. Kiểm tra vLLM tương thích matrix cho phiên bản của bạn: v0.18.0 đánh dấu giải mã giả định tương thích với prefill mảnh.

```figure
mx-speculative-tree
```

## Sử dụng nó

`code/main.py`mô phỏng một vòng giải mã với và không có giải mã đầu cơ trên một loạt các giá trị alpha và chiều dài dự thảo K. Nó in alpha break-even, đo tốc độ lên, và hành vi đuôi.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-eagle3-rollout.md`. Với mô hình mục tiêu, mô tả phân phối lưu lượng và mục tiêu đồng thời, nó tạo ra một kế hoạch triển khai EAGLE-3 từng giai đoạn  đường cơ sở tham chiếu, cho phép cấu hình, đo alpha, cổng trên alpha >= 0.55, xem P99 ITL.

## Các bài tập

1. Đi chạy`code/main.py`Ở K=5, bạn cần alpha nào để tăng tốc 2x? 3x?
2. Hãy tưởng tượng lưu lượng sản xuất chia sẻ 70% chat chung, 30% mã. chat chung đạt alpha 0.7 với EAGLE-3 được đào tạo trên ShareGPT; mã đạt alpha 0.4.
3. Đọc vLLM `speculative_config`Các mô hình (Mô hình bản, EAGLE, N-gram) và kiểm tra các tính năng nào trong mỗi phiên bản vLLM của bạn.
4. Bạn thấy mức ITL giảm 25% sau khi kích hoạt EAGLE-3 nhưng P99 ITL tăng 15%. Chẩn đoán và đề xuất giảm thiểu.
5. Xét chi phí bộ nhớ của đầu dự thảo EAGLE-3 cho Llama 3.3 70B. Nó so sánh như thế nào với chạy Llama 3.2 1B như một dự thảo cổ điển?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | Propose K tokens with a cheap model, verify all K in one target forward |
| Acceptance rate alpha | "spec accept rate" | Fraction of draft tokens accepted by the target; the only metric that matters |
| Draft length K | "spec k" | How many tokens the draft proposes per target forward; typical 4-8 |
| Verify overhead epsilon | "spec overhead" | Extra cost to verify-and-reroll vs a plain target forward; grows with batch |
| EAGLE-3 | "latest EAGLE" | 2025-2026 variant; trains draft head on multiple target layers; alpha 0.6-0.8 on general chat |
| `speculative_config` | "vLLM spec config" | The explicit opt-in in vLLM V1; no default means no acceleration |
| N-gram spec decode | "N-gram draft" | GPU-side draft using N-gram lookups in the prompt; chunked-prefill-compatible |
| Break-even alpha | "no-op alpha" | Alpha at which spec decode gives zero speedup; watch this at production concurrency |
| Rejected-draft two-pass | "reroll cost" | Two target forwards when drafts reject; drives P99 tail |

## Đọc thêm

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) nguồn tin có thẩm quyền trên `speculative_config`và tương thích với các bộ phận trước lấp trong V1.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) bộ trường chính xác.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) Nữ bản của đầu dự thảo của Eagle.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) Dự thảo và cây thích ứng.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) Hệ thống LLM hiệu quả với việc giải mã đầu cơ.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) Danh sách kiểm tra triển khai sản xuất.
