# Theo hướng dẫn như tín hiệu sắp xếp

> Mỗi lời chỉ trích sau đó của RLHF tranh luận chống lại đường ống này. Trước khi bạn nghiên cứu cách áp lực tối ưu hóa làm sao biến dạng một proxy, bạn phải xem proxy. InstructGPT (Ouyang et al., 2022) đã xác định kiến trúc tham chiếu: điều chỉnh tinh tế được giám sát trên các cặp hướng dẫn-đáp ứng, mô hình phần thưởng được đào tạo trên bảng xếp hạng ưu tiên theo cặp, và PPO đối với mô hình phần thưởng với một hình phạt KL đối với chính sách SFT. Một 1.3B InstructGPT được ưa thích so với một 175B GPT-3. Kết quả duy nhất đó là lý do tại sao mỗi phòng thí nghiệm biên giới vào năm 2026 vẫn gửi một đường ống thuần đào tạo hình dạng RLHF.

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline), TypeScript
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## Mục tiêu học tập

- Hãy nêu tên ba giai đoạn của đường ống dẫn InstructGPT và lỗ được sử dụng trong mỗi giai đoạn.
- Giải thích lý do tại sao mô hình điều chỉnh theo hướng dẫn 1.3B vượt qua GPT-3 thô 175B khi đánh giá sở thích của con người.
- Cần phải giải thích điều gì về hình phạt KL ở giai đoạn 3 và tại sao việc loại bỏ nó lại rơi vào hành vi tìm kiếm chế độ.
- Mô tả thuế sắp xếp và giảm thiểu PPO-ptx Ouyang et al. được sử dụng chống lại nó.

## Vấn đề

Các mô hình ngôn ngữ được đào tạo trước hoàn thành văn bản. Chúng không trả lời câu hỏi. Hãy hỏi GPT-3 "tập một hàm Python đảo ngược một danh sách" và bạn thường nhận được một lời nhắc lại khác, bởi vì hầu hết các phân phối đào tạo là văn bản web tiếp tục với nhiều văn bản web hơn. Mô hình đang làm công việc của nó  công việc sai.

Các nhà nghiên cứu chuyên nghiệp sử dụng để sửa chữa điều này là sự thích của con người. Hai hoàn thành đi đến một rater; rater chọn tốt hơn; một mô hình phần thưởng học được rater. Sau đó một vòng lặp RL chuyển chính sách hướng đến các kết quả mô hình phần thưởng điểm cao. Đó là luận án InstructGPT đầy đủ trong ba câu. phần còn lại của bài báo là kỹ thuật.

## Khái niệm

### Giai đoạn 1: điều chỉnh tinh tế được giám sát (SFT)

Thu thập các cặp phản ứng nhanh chóng nơi phản ứng là những gì một con người có ý định tốt sẽ viết. Ouyang et al. sử dụng 13k yêu cầu từ các nhãn và OpenAI API. Định chỉnh mô hình cơ sở trên dữ liệu này với mất lượng entropy chéo tiêu chuẩn.

SFT cho bạn: mô hình bây giờ trả lời các câu hỏi thay vì tiếp tục chúng.

### Giai đoạn 2: Mô hình phần thưởng (RM)

Đối với mỗi prompt, lấy mẫu hoàn thành K từ mô hình SFT. Một labeler xếp hạng chúng. Tập một mô hình phần thưởng ghi điểm bất kỳ cặp phản ứng prompt nào để, cho các cặp nơi `y_w`được `y_l`- Có thể là:

```math
L_{\text{RM}} = -\log \sigma\big(r(x, y_w) - r(x, y_l)\big)
```

Đây là sự mất ưu tiên cặp Bradley-Terry. RM thường được khởi tạo từ mô hình SFT với đầu LM được thay thế bởi đầu scalar.

Các mô hình phần thưởng nhỏ: 6B là đủ cho 175B InstructGPT. Chúng cũng rất yếu  Phần 5 của bài báo chủ yếu là về hành vi tấn công phần thưởng xuất hiện ở quy mô nhỏ.

### Giai đoạn 3: PPO với hình phạt KL

Định nghĩa mục tiêu:

```math
J(\pi) = \mathbb{E}_{x \sim D,\, y \sim \pi(\cdot \mid x)} \big[ r(x, y) \big] - \beta \, \mathrm{KL}\big(\pi(\cdot \mid x) \,\|\, \pi_{\text{SFT}}(\cdot \mid x)\big)
```

Tăng tối đa bằng PPO.`pi`Nếu không có nó, người tối ưu hóa tìm thấy các ví dụ đối nghịch  chuỗi ghi điểm cao dưới RM vì RM chưa bao giờ thấy chúng, không phải vì con người thực sự thích chúng.

Tỷ lệ KL `beta`là siêu tham số RLHF quan trọng nhất. quá thấp: reward hacking. quá cao: không có cải thiện so với SFT.

### Thuế sắp xếp

Sau RLHF, mô hình được người thích nhưng giảm xuống trên các tiêu chuẩn chuẩn chuẩn (SQuAD, HellaSwag, DROP). Ouyang et al. gọi đây là thuế sắp xếp và sửa bằng PPO-ptx: trộn gradient trước đào tạo vào mục tiêu RL để mô hình không quên làm thế nào để thực hiện các nhiệm vụ dòng chảy sau đó nó không bao giờ được khen thưởng.

```math
J_{\text{ptx}}(\pi) = J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}} \big[ \log \pi(x) \big]
```

PPO-ptx trở thành tiêu chuẩn. Anthropic, DeepMind và Meta đều sử dụng một số biến thể.

### Kết quả

Một 1.3B InstructGPT (SFT + RM + PPO-ptx) được các nhà nhãn thích hơn là 175B cơ sở GPT-3 khoảng 70% thời gian.

1. Lòng xếp là một trục khác với khả năng. mô hình 175B có khả năng nhiều hơn; mô hình 1.3B có sự sắp xếp nhiều hơn; những người dán nhãn thích một loại sắp xếp.
2. Mức độ khả năng được thiết lập bởi mô hình cơ bản. Bạn không thể RLHF mô hình cơ bản để biết các sự kiện nó chưa từng thấy.

### Tại sao đây là điểm tham chiếu cho giai đoạn 18

Mỗi lời chỉ trích trong các bài học sau đó  tấn công phần thưởng (Lớp 2), DPO (Lớp 3), ly (Lớp 4), CAI (Lớp 5), các đại lý ngủ (Lớp 7), giả mạo sự sắp xếp (Lớp 9)  tranh luận chống lại một phần của đường ống này. Chiến dịch tấn công phần thưởng giai đoạn 2. DPO bị sụp đổ giai đoạn 2 và 3. CAI thay thế máy dán nhãn của con người. Sycophancy cho thấy nhãn là một tín hiệu thiên vị. Sự giả mạo liên kết cho thấy chính sách có thể đi vòng quanh giai đoạn 3 hoàn toàn. Bạn không thể theo dõi bất kỳ lời chỉ trích nào mà không cần đầu tiên đưa vào đầu bạn.

```figure
al-instruct-pipeline
```

## Sử dụng nó

`code/main.py`mô phỏng ba giai đoạn trên dữ liệu sở thích đồ chơi. Chính sách cơ bản là một đồng xu thiên vị về các hành động {A, B, C}. Giai đoạn 1 SFT bắt chước các hành động của label trên 200 lời nhắc. Giai đoạn 2 phù hợp với mô hình giải thưởng Bradley-Terry từ 500 bảng xếp hạng cặp. Giai đoạn 3 thực hiện một bản cập nhật đơn giản về PPO với một hình phạt KL đối với chính sách SFT. Bạn có thể xem sự tăng trưởng của phần thưởng, sự khác biệt KL tăng lên, và sự trôi dạt chính sách và bạn có thể tắt thời gian KL để thấy sự tấn công phần thưởng xuất hiện trong vòng 50 bước cập nhật.

Những gì cần xem:

- Đường quỹ đạo thưởng với `beta = 0.1`vs `beta = 0.0`- Tôi không biết.
- $\mathrm{KL}(\pi \Vert \pi_{\text{SFT}})$trên các bước huấn luyện.
- Phân phối hành động cuối cùng so với ưu tiên nhãn.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-instructgpt-explainer.md`. Với mô tả đường ống RLHF hoặc bản tóm tắt trên giấy, nó xác định được hai giai đoạn nào đang được sửa đổi, mất mát nào đang được sử dụng ở mỗi giai đoạn, và liệu có một hình phạt KL hoặc một chất điều chỉnh tương đương có mặt hay không.

## Các bài tập

1. Đi chạy`code/main.py`- Đặt`beta = 0.0`và báo cáo phân phối hành động sau 200 bước PPO. Giải thích hành vi tìm kiếm chế độ trong một đoạn.

2. Thay đổi mô hình phần thưởng để có một thiên vị +0,5 cho hành động B (một lỗi phần thưởng mô phỏng).`beta = 0.1`- Hình phạt KL có ngăn cản chính sách khai thác sự thiên vị không?`beta`việc khai thác trở nên rõ ràng?

3. Đọc Ouyang et al. (arXiv:2203.02155) Hình 1. Tạo lại đường cong ưu tiên nhãn bằng cách chạy PPO trong 1, 5, 20, 100 bước và đo ưu tiên so với mô hình SFT.

4. Phần 4.3 của báo cáo báo cáo một 1.3B InstructGPT vượt qua 175B GPT-3 khoảng 70% thời gian. Tại sao tỷ lệ này sẽ cao hơn trên các yêu cầu sản xuất ẩn hơn trên các yêu cầu của nhà dán nhãn?

5. Thay thế lỗ PPO bằng DPO (Phase 10 · 08) trên cùng dữ liệu ưu tiên. So sánh chi nhánh chính sách cuối cùng (KL đến SFT) và phần thưởng cuối cùng. Phương pháp nào chi nhánh hơn với phần thưởng phù hợp?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | "instruction tuning" | Stage 1: cross-entropy fine-tune on prompt-response pairs |
| Reward model | "the RM" | Scalar regressor over (prompt, response) trained with Bradley-Terry on pairwise labels |
| Bradley-Terry | "pairwise preference loss" | $-\log \sigma(r_w - r_l)$; reduces pairwise ranking to binary classification |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)` — keeps the RL policy near the SFT anchor |
| PPO-ptx | "PPO with pretraining mix" | Adds a fraction of pre-training log-likelihood to the PPO objective to offset the alignment tax |
| Alignment tax | "the RLHF regression" | Post-RLHF drop on standard benchmarks that RLHF did not target |
| Labeler preference | "the ground truth" | Sample of human rankings; the RM is a statistical proxy for this, not for "human values" |

## Đọc thêm

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) giấy InstructGPT, nền tảng cho mỗi đường ống RLHF sau đó
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) RLHF-for-summary tiền nhiệm
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) công thức RL dựa trên ưu tiên ban đầu
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) Việc mở rộng HH của đường ống dẫn đường InstructGPT của Anthropic
