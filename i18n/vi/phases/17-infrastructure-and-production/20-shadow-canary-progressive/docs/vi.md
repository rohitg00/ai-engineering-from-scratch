# Truyển chuyển bóng, triển khai Canary và triển khai tiến bộ cho LLM

> Các triển khai LLM kết hợp các phần khó khăn nhất của việc triển khai phần mềm: không thử nghiệm đơn vị, chế độ thất bại pha trộn, tín hiệu chậm. Dòng là (1) chế độ bóng  yêu cầu lặp lại cho mô hình ứng viên, đăng ký, so sánh với không tác động người dùng; bắt được các vấn đề phân phối rõ ràng nhưng không phải là một đảm bảo chất lượng; (2) triển khai canary  chuyển lưu lượng tiến bộ 10% → 25% → 50% → 75% → 100% với cổng tại mỗi bước; theo dõi phần trăm độ trễ, chi phí / yêu cầu, tỷ lệ sai lầm / từ chối, phân phối chiều dài đầu ra, tỷ lệ phản hồi người dùng; (3) thử nghiệm A / B cho các lựa chọn khác nhau sau khi ổn định được xác nhận. Không xác định là không thể giảm  lên đến 15% sự khác biệt chính xác trên các chạy với đầu vào giống nhau do GPU FP không liên quan cộng với sự khác biệt kích thước lô. Chi phí là một biến, không phải là liên tục  mô hình tốt hơn 20% có thể đắt hơn 3 lần mỗi cuộc gọi. Tốc độ quay trở lại là quyết định: nếu quay trở lại đòi hỏi phải tái triển khai, bạn quá chậm. Chính sách sống trong cấu hình/ cờ; mô hình sống trong registry với các bản ghi đấm; rollback = chính sách đảo ngược + ngưỡng đảo ngược + pin mô hình cũ trong vài giây.

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hóa độ bóng (sự so sánh không tác động), canary (sự so sánh giao thông trực tiếp tiến bộ) và A/B (sự so sánh được xác nhận ổn định).
- Đặt ra danh sách năm chỉ số canary cụ thể của LLM (trễ, chi phí/ yêu cầu, lỗi/thiếu nại, phân phối chiều dài đầu ra, phản hồi của người dùng).
- Giải thích lý do tại sao việc không quyết định LLM (tối đa 15%) thay đổi ý nghĩa "thường ổn định" trong một triển khai.
- Thiết kế một con đường quay trở lại mất vài giây (phác thảo chính sách) chứ không phải vài giờ (phân bố lại).

## Vấn đề

Bạn gửi một mô hình mới. đánh giá ngoại tuyến cho thấy tăng độ chính xác 3% bạn biến nó vào trong sản xuất trong vòng 24 giờ, chi phí tăng 40%, người dùng ngón tay xuống tăng 8%, ba vé khách hàng báo cáo "câu trả lời kỳ lạ". Bạn quay lại. tái triển khai mất 3 giờ. cuối tuần của bạn bị phá hủy.

Mỗi phần của điều đó có thể tránh được. chế độ bóng sẽ bắt được 40% tăng giá trước khi bất kỳ người dùng nào thấy nó. Canary sẽ dừng ở 10% khi ngón tay xuống di chuyển. Phục hồi cờ chính sách sẽ mất 30 giây. Phân khúc là điều gì điền vào khoảng cách giữa "đánh giá ngoại tuyến trông tốt" và "người dùng thực sự hạnh phúc".

## Khái niệm

### Chế độ bóng

Người ứng cử nhận được cùng các yêu cầu như sản xuất; đầu ra được ghi lại, không được trả lại cho người dùng. Không tác động của người dùng.

- Nội dung sản lượng (các biệt so với sản xuất).
- Số lượng token (cost delta).
- - Trễ.
- Sự từ chối và sai lầm.

Các lần bắt: tăng chi phí, giảm chiều dài, thay đổi từ chối rõ ràng, sai lầm khó khăn. Không bắt: người dùng delta chất lượng sẽ nhận ra. bóng là một bài kiểm tra khói, không phải là một bài kiểm tra chất lượng.

### Việc triển khai Canary

Sự chuyển đổi giao thông tiến bộ với các cửa. Tiêu chuẩn tiến bộ: 1% → 10% → 25% → 50% → 75% → 100%.

1. **Latency percentiles** P50, P95, P99. Vi phạm: con cá voi có P99 > 1,5x điểm cơ sở.
2. **Cost per request** hỗn hợp. Vi phạm: > 20% trên đường cơ sở.
3. **Error / refusal rate**5xx cộng với việc từ chối rõ ràng.
4. **Output length distribution** trung bình + P99. Vi phạm: chuyển đổi phân phối.
5. **User-feedback rate** Thumbs down / ticket fileings. Vi phạm: 1,5x đường cơ bản.

### Không quyết định là sự khác biệt mới

Các đầu vào giống nhau tạo ra các đầu ra không giống nhau.

- Không liên quan đến GPU FP (sự sắp xếp giảm điểm nổi khác nhau theo lô).
- Sự khác biệt kích thước lô (những lần cùng nhau trong lô 128 so với lô 16).
- Tiêu chuẩn:

Đường: biến số chính xác lên đến 15% chạy-to-run trên các bộ đánh giá giống nhau. "Thường" trong một bản triển khai có nghĩa là các métrics nằm trong sự khác biệt dự kiến, không giống với đường cơ sở. Đặt cửa trên sàn tiếng ồn.

### Chi phí là một biến

Một mô hình tốt hơn 20% có thể đắt hơn 3 lần mỗi cuộc gọi. Chi phí / yêu cầu là một trong năm cổng. Việc vận chuyển một mô hình "bất kỳ" phá vỡ nền kinh tế đơn vị là một trường hợp trở lại.

### Rollback là vũ khí.

- Lập khẩu chính sách (chương trình cờ tính năng): tỷ lệ đảo ngược trong cấu hình; mất vài giây.
- Model pinning (registry digest): mô hình pin không tự động nâng cấp.
- Rollback = đảo ngược cờ + đặt bản ghi đính vào trước.

Nếu đống của bạn cần phải tái triển khai để quay trở lại, sửa chữa trước khi quay.

### Thiết bị công cụ

**Argo Rollouts**- **Flagger** Kubernetes bộ điều khiển giao hàng tiến bộ.

**Istio weighted routing** phân chia giao thông cấp độ dịch vụ- lưới.

**KServe / Seldon Core** mô hình phục vụ với canary tích hợp.

**Feature flags** LaunchDarkly, Flagsmith, Unleash.

### Tỷ lệ thời gian

Canary gate kiểm tra mỗi 5-15 phút tùy thuộc vào khối lượng giao thông. 1% trong 1.000 req / min (10 req / min cho canary) cung cấp 50-150 điểm dữ liệu mỗi cửa sổ 5-15 phút  đủ để trì hoãn nhưng ồn ào cho phản hồi của người dùng. 10% cung cấp ~ 10x nhiều hơn.

### Bước A/B là tùy chọn

Nếu mô hình mới khác rõ ràng (hành vi khác nhau, đường cong chi phí khác nhau, âm thanh khác nhau), A / B kiểm tra nó ở 50% sau khi canary vượt qua. Nếu nó chỉ là một phiên bản cải thiện của hành vi tương tự, hãy bỏ qua 100% khi canary gate vượt qua.

### Những con số mà bạn nên nhớ

- Tăng tiến của loài cá: 1% → 10% → 25% → 50% → 75% → 100%.
- Tối thượng không xác định: lên đến 15% sự khác biệt chạy đến chạy trên các đầu vào giống nhau.
- Năm métrics canary: độ trễ, chi phí, lỗi/thiếu nại, thời gian đầu ra, phản hồi của người dùng.
- Cổng chi phí: > 20% trên đường cơ sở là vi phạm.
- Lần quay lại: giây, không phải giờ.

```figure
i4-canary-ramp
```

## Sử dụng nó

`code/main.py`mô phỏng một canary rollout với sự lùi hốc. báo cáo các giai đoạn rollout dừng lại tại và cổng nào kích hoạt.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-rollout-runbook.md`. Với mô hình ứng cử viên, đường cơ sở và dung nạp rủi ro, thiết kế kế shadow→canary→100% kế hoạch.

## Các bài tập

1. Đi chạy`code/main.py`- Đưa lại 25% chi phí.
2. Mô hình mới của bạn có mức độ chính xác tăng 3% ngoài khơi nhưng chi phí / yêu cầu là +18%.
3. Thiết kế một lần quay lại trong vòng 60 giây.
4. Không xác định nghĩa cho thấy ±7% trong đánh giá của bạn.
5. Chế độ bóng sẽ tăng giá 40% trước canary.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## Đọc thêm

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
