# Đánh giá  FID, CLIP Score, Tích thích con người

> Mỗi bảng xếp hạng mô hình tạo ra chỉ trích FID, điểm CLIP và tỷ lệ thắng từ một lĩnh vực ưu tiên của con người. Mỗi số có chế độ thất bại mà một nhà nghiên cứu xác định có thể chơi. Nếu bạn không biết các chế độ thất bại, bạn không thể thấy sự cải thiện thực sự từ một cuộc chơi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## Vấn đề

Một mô hình tạo được đánh giá dựa trên * chất lượng mẫu * và * tuân thủ điều kiện *. Cả hai đều không có thước đo hình thức đóng. Mô hình của bạn phải hiển thị 10.000 hình ảnh; có gì đó phải gán cho chúng số; bạn phải tin vào số trên các gia đình mô hình, trên các độ phân giải, trên các kiến trúc. Ba métrics đã sống sót qua bàn tay 2014-2026:

- **FID (Fréchet Inception Distance).**Khoảng cách giữa hai phân phối  thực và tạo  trong không gian tính năng của mạng Inception.
- **CLIP score.**Sự tương đồng giữa việc nhúng hình ảnh CLIP của một hình ảnh được tạo và nhúng văn bản CLIP của một prompt. cao hơn là tốt hơn. đo lường sự tuân thủ nhanh chóng.
- **Human preference.**Đặt hai mô hình trực tiếp trên cùng một lời nhắc, để con người (hoặc mô hình lớp GPT-4) chọn tốt hơn, tổng hợp đến điểm Elo.

Bạn cũng sẽ thấy: IS (điểm khởi điểm, phần lớn nghỉ hưu), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Mỗi sửa chữa cho một thất bại của trước đó.

## Khái niệm

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID  chất lượng mẫu

Heusel et al. (2017).

1. Tạo các tính năng Inception-v3 (2048-D) cho N hình ảnh thực và N tạo.
2. Đưa một Gaussian vào mỗi hồ bơi: tính trung bình$\mu_r, \mu_g$và sự đồng hóa$\Sigma_r, \Sigma_g$- Tôi không biết.
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$- Tôi không biết.

Giải thích: Khoảng cách Fréchet giữa hai Gaussia đa biến trong không gian tính năng.

Các chế độ thất bại:
- **Biased on small N.**FID là trung bình vuông trên phân phối tính năng  nhỏ N đánh giá thấp sự khác nhau, cho FID thấp sai.$N \ge 10{,}000$- Tôi không biết.
- **Inception-dependent.**Inception-v3 được đào tạo trên ImageNet. Các miền xa khỏi ImageNet (những khuôn mặt, nghệ thuật, hình ảnh văn bản) tạo ra FID vô nghĩa. Sử dụng một bộ trích xuất tính năng cụ thể cho miền.
- **Gaming.**Việc trang bị quá mức cho Inception trước tạo ra FID thấp mà không cải thiện chất lượng thị giác.

### Điểm CLIP  tuân thủ nhanh chóng

Radford et al. (2021). Đối với hình ảnh được tạo + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

Trung bình trên 30k hình ảnh được tạo ra → một mô hình có thể so sánh giữa các mô hình.

Các chế độ thất bại:
- **CLIP's own blind spots.**CLIP có lý luận thành phần yếu ("một khối đỏ trên một quả cầu xanh" thường thất bại).
- **Short prompt bias.**Các lời nhắc ngắn có nhiều kết hợp hình ảnh CLIP hơn trong tự nhiên.
- **Prompt gaming.**Bao gồm "đất lượng cao, 4k, tác phẩm xuất sắc" trong lời nhắc thổi phồng điểm CLIP mà không cải thiện kết nối hình ảnh-môn văn bản.

CMMD (Jayasumana et al., 2024) khắc phục một số điều này: sử dụng các tính năng CLIP thay vì Inception, sự khác biệt trung bình tối đa thay vì Fréchet.

### Tích thích của con người  sự thật căn bản

Chọn một nhóm các lời nhắc. Tạo ra với mô hình A và mô hình B. Cho thấy cặp với con người (hoặc một thẩm phán LLM mạnh mẽ). tổng hợp chiến thắng thành điểm số Elo hoặc Bradley-Terry. Điểm chuẩn:

- **PartiPrompts (Google)**: 1.600 yêu cầu khác nhau, 12 loại.
- **HPSv2**: 107k chú thích của con người, được sử dụng rộng rãi như một đại diện tự động.
- **ImageReward**: 137k cặp ưu tiên hình ảnh nhanh, được MIT cấp phép.
- **PickScore**: được đào tạo về các sở thích Pick-a-Pic 2.6M.
- **Chatbot-Arena-style image arenas**https://imagearena.ai/và những người khác.

Các chế độ thất bại:
- **Judge variance.**Những người không chuyên môn có sở thích khác với các chuyên gia.
- **Prompt distribution.**Những lời khuyên được chọn từ một gia đình luôn là tài liệu.
- **LLM-judge reward hacking.**Thẩm phán GPT-4 bị lừa bởi những kết quả đẹp nhưng sai.

## Sử dụng cùng nhau

Một báo cáo đánh giá sản xuất nên bao gồm:

1. FID trên 10-30k mẫu đối với phân phối thực (chất lượng mẫu).
2. Điểm CLIP / CMMD trên cùng một mẫu so với các yêu cầu của họ (sự tuân thủ).
3. Tỷ lệ thắng trong một đấu trường bị mù so với mô hình trước (tổng ưu tiên).
4. Phân tích chế độ thất bại: 50 đầu ra được lấy mẫu ngẫu nhiên, được đánh dấu cho các vấn đề được biết (phân giải của tay, trình chiếu văn bản, con số đối tượng nhất quán).

Bất kỳ chỉ số nào cũng là dối trá. Ba chỉ số xác nhận + đánh giá chất lượng là một tuyên bố.

```figure
gx-fid-distributions
```

## Hãy xây dựng nó

`code/main.py`thực hiện FID, CLIP-score-like, và Elo tổng hợp trên tổng hợp "vector tính năng" (chúng tôi sử dụng vector 4-D như là stand-in cho tính năng Inception).

- Phân tính FID trên một N nhỏ và trên một N lớn  sự thiên vị.
- "Chit điểm CLIP" như sự tương đồng cosine giữa các bộ tích tính năng.
- Quy tắc cập nhật Elo từ một dòng ưu tiên tổng hợp.

### Bước 1: FID trong bốn dòng

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Bước 2: Sự tương tự cosine theo CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Bước 3: Lưu tập Elo

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Những bẫy

- **FID at N=1000.**Heuristic không đáng tin cậy dưới N=10k. Các báo cáo báo cáo FID thấp N đang chơi game.
- **Comparing FID across resolutions.**Sự thay đổi kích thước của Inception là 299 × 299 thay đổi phân phối tính năng. So sánh chỉ ở độ phân giải phù hợp.
- **Reporting one seed.**Đi 3 hạt tối thiểu.
- **CLIP score inflation via negative prompts.**Một số đường ống tăng CLIP bằng cách over-mở các prompt.
- **Elo bias from prompt overlap.**Nếu cả hai mô hình thấy một điểm chuẩn trong quá trình đào tạo, Elo là vô nghĩa. Sử dụng các bộ nhắc nhở kéo dài.
- **Human eval paid-crowd skew.**Những nhà ghi chú MTurk có nhiều sản phẩm, có xu hướng trẻ hơn / thân thiện với công nghệ.

## Sử dụng nó

Nghị định giá sản xuất vào năm 2026:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

Tất cả bốn trụ cột trong một báo cáo = yêu cầu.

## Chuyển nó

- Cứu lại`outputs/skill-eval-report.md`. Skill lấy một điểm kiểm soát mô hình mới + đường cơ sở và đưa ra một kế hoạch đánh giá đầy đủ: kích thước mẫu, số liệu, các thăm dò chế độ thất bại, tiêu chí ký kết.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`So sánh FID ở N=100 so với N=1000 trên cùng một phân phối tổng hợp.
2. **Medium.**Thực hiện CMMD từ các tính năng kiểu CLIP tổng hợp (xem Jayasumana et al., 2024 cho công thức). So sánh độ nhạy với sự khác biệt chất lượng so với FID.
3. **Hard.**Tái tạo thiết lập HPSv2: lấy 1000 cặp hình ảnh-quan nhanh từ một bộ phụ của Pick-a-Pic, chỉnh điểm nhỏ dựa trên CLIP trên sở thích, và đo sự phù hợp của nó với một bộ kéo dài.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## Lưu ý sản xuất: đánh giá cũng là một khối lượng công việc suy luận

Tiếp tục FID trên các mẫu 10k có nghĩa là tạo ra hình ảnh 10k. Đối với một cơ sở SDXL 50 bước ở 10242 trên một L4, đó là ~ 11 giờ suy luận đơn yêu cầu. Ngân sách đánh giá là thực, và khung chính xác là kịch bản suy luận ngoại tuyến (tăng cường thông qua, bỏ qua TTFT):

- **Batch hard, forget latency.**Offline eval = batching tĩnh ở kích thước lớn nhất phù hợp với bộ nhớ. `pipe(...).images`với `num_images_per_prompt=8`trên một chiếc 80GB H100 chạy nhanh hơn 4 đến 6 lần so với một lần yêu cầu.
- **Cache the real features.**Việc khai thác tính năng Inception (FID) hoặc CLIP (CLIP-score, CMMD) trên bộ tham chiếu thực được chạy * một lần*, được lưu trữ như một`.npz`Đừng tính lại cho mỗi đánh giá.

Đối với CI / cửa quay trở: chạy điểm FID + CLIP trên một bộ phụ 500 mẫu mỗi PR (~ 30 phút); chạy đầy đủ 10k FID + HPSv2 + Elo mỗi đêm.

## Đọc thêm

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) Bức giấy FID.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) CLIP.
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) Đánh giá chế độ thất bại.
