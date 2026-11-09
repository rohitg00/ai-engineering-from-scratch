# STAR, V-STAR, Quiet-STAR  Định lý tự học

> Loop tự cải thiện nhỏ nhất có thể nằm trong lý luận. Một mô hình tạo ra một chuỗi suy nghĩ, giữ những câu trả lời đúng, và tinh chỉnh những câu trả lời đó. Đó là STAR. V-STaR thêm một xác minh để lựa chọn thời gian suy luận là tốt hơn. Quiet-STaR đẩy lý do xuống mọi dấu hiệu. Cả ba đều làm việc. Không có một trong số đó là ma thuật  vòng lặp bảo tồn bất kỳ đường tắt nào xảy ra để đạt được câu trả lời đúng.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## Vấn đề

Cách đơn giản để dạy một mô hình suy luận là thu thập những dấu vết suy luận được viết bởi con người.

STaR (Self-Teught Reasoner, Zelikman et al., 2022) hỏi: nếu mô hình viết racional của riêng mình và xếp hạng chúng so với các câu trả lời đã biết?

1. Mô tả một câu trả lời lý luận cộng với.
2. Nếu câu trả lời cuối cùng là đúng, hãy giữ dấu vết.
3. Định nghĩa kỹ lưỡng về những dấu vết được giữ.
4. Lặp lại.

Nó hoạt động. GSM8K và CommonsenseQA đều được cải thiện mà không cần ghi chú của con người mới. Nhưng vòng lặp có một thiên vị tích hợp: bất kỳ lý luận nào tạo ra câu trả lời đúng đắn vẫn được giữ lại, bất kể lý luận đó có hay không. V-STaR (Hosseini et al., 2024) sửa chữa điều này với một xác minh học tập; Quiet-STaR (Zelikman et al., 2024) tổng quát ý tưởng để tính racional nội bộ.

## Khái niệm

### STaR: bootstrap trên những gì đã làm việc

Bắt đầu từ một mô hình cơ bản với một số khả năng suy luận yếu. Đối với mỗi vấn đề đào tạo, lấy mẫu lý luận cộng với câu trả lời. Nếu câu trả lời phù hợp với nhãn, giữ cho (vấn đề, lý luận, câu trả lời) ba. Hoàn chỉnh mô hình trên bộ được giữ. Lặp lại.

Một vòng quay quan trọng. Nếu mô hình không bao giờ có thể làm cho một vấn đề đúng, vòng lặp không thể học được trên nó.**rationalization**: cho các vấn đề mô hình thất bại, tiêm câu trả lời chính xác như một gợi ý và nhắc lại mô hình để tạo ra một lý luận dẫn đến nó.

Kết quả trong bài báo ban đầu (Zelikman et al., 2022): mô hình cơ sở GPT-J cải thiện trên GSM8K từ 5.8% lên 10.7% thông qua các vòng STaR lặp đi lặp lại với hợp lý hóa  khoảng 5 điểm phần trăm tuyệt đối. Trên CommonsenseQA, GPT-J 6B được đào tạo bằng STaR đạt 72,5%, tương đương với một mô hình GPT-3 175B được điều chỉnh tốt (~ 73%)  mô hình lớn hơn khoảng 30 lần được đào tạo trên các hợp lý ghi chép bằng tay.

### V-STaR: đào tạo một kiểm chứng với DPO

STaR ném ra những lý luận sai lầm. Hosseini et al. (2024) quan sát rằng đó cũng là dữ liệu: mỗi cặp (rationale, "có đúng không") có thể đào tạo một xác minh. Họ sử dụng tối ưu hóa ưu tiên trực tiếp trên cả các giải pháp đúng và sai để xây dựng một trình xếp hạng.

Delta được báo cáo: +4 đến +17 điểm phần trăm so với các đường cơ sở tự cải thiện trước đây trên GSM8K và MATH, với phần lớn lợi nhuận đến từ việc sử dụng xác minh cho việc lựa chọn thời gian suy luận thay vì cho việc điều chỉnh kỹ lưỡng thêm máy phát.

### Quiet-STaR: các tính toán nội bộ mỗi token

Zelikman et al. (2024) hỏi: nếu mô hình học được tạo ra một lý luận nội bộ ngắn ở mỗi vị trí token, không chỉ giữa vấn đề và câu trả lời? Quiet-STaR đào tạo mô hình để phát ra một "lời nghĩ" ẩn trước mỗi token dự đoán, sau đó trộn dự đoán ý thức với dự đoán đường cơ sở thông qua trọng lượng được học.

Kết quả: Mistral 7B đạt được cải thiện tuyệt đối bằng không chụp trên GSM8K từ 5,9% đến 10,9% và CommonsenseQA từ 36,3% đến 47,2% mà không có điều chỉnh cụ thể về nhiệm vụ. Mô hình học "lúc nào để suy nghĩ"  mã thông báo cứng có được các hợp lý nội bộ dài hơn; những cái dễ dàng nhận được hầu như không có.

### Tại sao cả ba đều có mối quan tâm chung về an toàn

Cả ba phương pháp đều sử dụng câu trả lời cuối cùng như tín hiệu gradient. Một lý luận đạt được câu trả lời đúng thông qua lý luận sai lầm  khai thác một đường tắt, đoán hoặc sử dụng một mô hình không tổng quát  được củng cố tích cực.

V-STaR xác minh giảm thiểu bằng cách học cách xếp hạng lý lẽ, nhưng xác minh được đào tạo trên cùng một bộ nhãn. Nó có thể học cách thích lý luận sai lầm định dạng tốt hơn sự không chắc chắn trung thực. Thiết kế an toàn hơn là kết hợp dữ liệu kiểu STaR với (a) mô hình phần thưởng được giám sát bởi quy trình (bồi thường các bước trung gian, không chỉ trả lời) và (b) đánh giá OOD được thực hiện để phá vỡ các đường tắt đơn giản.

### So sánh

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### Ở đâu đây nằm trong đống 2026

STAR đã già rồi. Nhưng mô hình này xuất hiện lại ở khắp mọi nơi trong năm 2025-2026. RL trên các vấn đề toán học có thể xác minh (DeepSeek-R1, Kimi-k1.5, o1) là tín hiệu gradient đáp ứng điều kiện của STaR, mở rộng quy mô. Các mô hình phần thưởng quy trình (Lightman et al., 2023; "Hãy xác minh từng bước") của OpenAI là lựa chọn thay thế được giám sát bởi quy trình. AlphaEvolve (Dạy 3) là STaR cho mã, với một trình đánh giá chương trình thay vì một nhãn. Máy Darwin Godel (Học 4) là STaR cho chính sàn nhà đại lý.

Hiểu STaR làm cho tất cả các nhấp chuột này. Đó là vòng tự cải thiện tối thiểu khả thi.

```figure
reflection-loop
```

## Sử dụng nó

`code/main.py`chạy một vòng lặp STaR mô phỏng trên một nhiệm vụ toán học đồ chơi.

- Sự chính xác vượt qua các đạn khởi động.
- Cách rút ngắn lẻn vào: máy mô phỏng bao gồm một lớp lý luận "lười biếng" có được câu trả lời đúng trong 40% thời gian nhưng tổng quát kém.
- Làm thế nào một người xác minh (tương tự V-STaR) giúp suy luận nhưng không thể cắt hoàn toàn các đường tắt được đưa ra trong quá trình đào tạo.

## Chuyển nó

`outputs/skill-star-loop-reviewer.md`giúp bạn kiểm tra một đường ống dẫn lý luận tự học được đề xuất trước khi bạn tập luyện trên nó.

## Các bài tập

1. Cứ chạy máy mô phỏng. Đặt tần số đường tắt là 0,4, sau đó là 0,4. Độ chính xác cuối cùng khác nhau giữa hai chạy, mặc dù cả hai đều đạt > 90% trên phân phối huấn luyện?

2. Thêm một thử nghiệm OOD kéo dài vào mô phỏng. Chụp các vấn đề từ một phân phối khác và đánh giá mô hình khởi động trên cả bộ phân phối và OOD.

3. Đọc bài báo Quiet-STaR (arXiv:2403.09629) Phần 3. Giải thích biểu tượng "sự kết thúc suy nghĩ" và đầu cân trộn trong ba câu mỗi câu.

4. So sánh bộ lọc giữ nếu STaR là đúng với một lựa chọn thay thế được giám sát bởi quy trình mà thưởng cho từng bước hợp lý độc lập.

5. Thiết kế một đánh giá sẽ bắt được các lý do tắt trong một mô hình được triển khai. Nó không phải là hoàn hảo  nó phải phá vỡ các đường tắt đơn giản nhất một vòng lặp STaR sẽ tăng cường.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Đọc thêm

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) giấy gốc.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) thêm một DPO xác minh cho việc lựa chọn thời gian suy luận.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) mỗi token racional nội bộ.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) mô hình phần thưởng quá trình, tín hiệu gradient thay thế.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) RL về các nhiệm vụ có thể kiểm tra, STaR mở rộng đến đào tạo biên giới.
