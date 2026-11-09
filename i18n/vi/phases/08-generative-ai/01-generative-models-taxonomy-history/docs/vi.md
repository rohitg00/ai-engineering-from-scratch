# Mô hình tạo ra  Thuế học & Lịch sử

> Mỗi mô hình hình ảnh, mô hình văn bản, mô hình video và mô hình 3D đều phù hợp với một trong năm cái thùng. Chọn cái thùng sai và bạn sẽ chiến đấu với toán học trong nhiều tuần. Chọn cái đúng và 12 năm tiến bộ của lĩnh vực này được xếp vào đầu bạn.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## Vấn đề

Một mô hình tạo ra làm một công việc: lấy mẫu đào tạo từ một số phân phối không rõ $p_{\text{data}}(x)$, xuất hiện các mẫu mới trông giống như chúng đến từ cùng một phân phối. khuôn mặt, câu, tệp MIDI, cấu trúc protein  tất cả đều là vấn đề tương tự nếu bạn nháy mắt.

Cái quái vật là thế.$p_{\text{data}}$sống trong một không gian có hàng triệu chiều kích (một hình ảnh RGB 512x512 là ~ 786k chiều kích), các mẫu nằm trên một bộ sợi mỏng bên trong không gian đó, và bạn chỉ có có thể 10M ví dụ.

Năm gia đình đã sống sót trong mười hai năm qua.

## Khái niệm

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**Hãy viết$\log p(x)$mô hình tự động (PixelCNN, WaveNet, GPT) tính toán$p(x) = \prod_i p(x_i \mid x_{<i})$. Tạo ra dòng chảy bình thường (RealNVP, Glow)$p(x)$Pro: xác suất chính xác, mất tập luyện sạch. Con: suy luận tự giảm là theo trình tự (nước chậm cho các chuỗi dài), dòng chảy cần kiến trúc đảo ngược (chỉ hạn chế về kiến trúc).

**2. Explicit density, approximate.**Bị buộc $\log p(x)$từ dưới (ELBO) và tối ưu hóa đường biên. VAE (Kingma 2013) sử dụng một bộ mã hóa-chế vị có một hậu biến. Các mô hình phân tán (DDPM, Ho 2020) đào tạo một mô hình biểu thị tối ưu hóa một ELBO cân nặng.

**3. Implicit density.**Trượt độ mật độ hoàn toàn; học máy phát điện $G(z)$sản xuất mẫu và phân biệt đối xử $D(x)$GAN (Goodfellow 2014). Nhanh chóng suy luận (một vượt qua phía trước) nhưng không ổn định trong quá trình đào tạo. StyleGAN 1/2/3 vẫn là hiện đại cho quang học miền cố định (người, phòng ngủ) ngay cả trong năm 2026.

**4. Score-based / continuous-time.**Tìm hiểu gradient của khối lượng gỗ $\nabla_x \log p(x)$Song & Ermon (2019) cho thấy kết quả kết hợp tổng hợp phân phối đến SDE. Kết hợp dòng chảy (Lipman 2023) là độ nóng 2024-2026: đào tạo không mô phỏng, các con đường thẳng hơn, lấy mẫu nhanh hơn DDPM 4-10 lần. Stable Diffusion 3, Flux, AudioCraft 2 tất cả sử dụng kết hợp dòng chảy.

**5. Token-based autoregressive over discrete codes.**Cấp dữ liệu độ sâu cao bằng VQ-VAE hoặc lượng tử dư thành một chuỗi nhỏ các token riêng biệt, sau đó sử dụng một Transformer để mô hình hóa chuỗi token. Parti, MuseNet, AudioLM, VALL-E, token patch của Sora đều sử dụng điều này. Đây là bucket 1 cộng với một token học.

## Một lịch sử ngắn gọn

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## Phân tích phân loại 5 câu hỏi

Khi một mẫu giấy tạo ra mới rơi xuống, hãy trả lời năm câu hỏi này trước khi đọc phần phương pháp.

1. **What is being modeled?**Pixel, laten, token riêng biệt, Gaussians 3D, lưới, hình dạng sóng?
2. **Is the density explicit or implicit?**Họ ghi lại $\log p(x)$- Không .
3. **Sampling: one-shot or iterative?**Iterative có nghĩa là suy luận chậm hơn; một lần bắn thường có nghĩa là đối kháng hoặc chưng cất.
4. **Conditioning: unconditional, class, text, image, pose?**Điều này xác định sự mất mát và kiến trúc bàn phẳng.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**Mỗi người đều có những chế độ thất bại (xem Bài học 14).

Bạn sẽ trả lời lại 5 câu này cho mỗi bài học trong giai đoạn này.

```figure
autoencoder-bottleneck
```

## Hãy xây dựng nó

Mã cho bài học này là một hình ảnh nhẹ: phù hợp với một hỗn hợp Gaussans 1-D từ các mẫu bằng cách sử dụng ba phương pháp chơi game (thấp độ hạt nhân, histogram phân biệt, và một máy phát điện "GAN-ish" mẫu gần nhất) để bạn có thể thấy sự khác biệt giữa mật độ rõ ràng vs âm tính trên một vấn đề bạn có thể in trên một màn hình.

Đi chạy`code/main.py`Nó lấy 2000 mẫu từ một hỗn hợp Gaussian hai chế độ, sau đó in:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Lưu ý: hai câu đầu tiên cho phép bạn hỏi "điều này có khả năng như thế nào?" thứ ba không thể. Đây là sự phân biệt * rõ ràng và ngầm * sẽ quan trọng cho mọi bài học trong tương lai.

## Sử dụng nó

Gia đình nào, nhiệm vụ nào, vào năm 2026?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## Chuyển nó

Cứ như `outputs/skill-model-chooser.md`- Tôi không biết.

Kỹ năng này có một mô tả nhiệm vụ và kết quả: (1) gia đình nào để sử dụng, (2) một danh sách xếp hạng của ba tùy chọn mở và ba lưu trữ, (3) chế độ thất bại có thể bạn nên xem xét, và (4) một ngân sách tính toán / thời gian.

## Các bài tập

1. **Easy.**Đối với mỗi năm sản phẩm này, xác định gia đình và xương sống: hình ảnh ChatGPT, Midjourney v7, Sora, Runway Gen-3, ElevenLabs. Bằng chứng nên là từ các báo cáo kỹ thuật công khai.
2. **Medium.**Bài báo bạn sắp đọc ngày mai tuyên bố lấy mẫu nhanh hơn 100 lần so với việc phân tán.
3. **Hard.**Hãy lấy một lĩnh vực bạn quan tâm (ví dụ: cấu trúc protein, CAD, phân tử, quỹ đạo). trả lời phân loại năm câu hỏi cho mô hình SOTA hiện tại trong lĩnh vực đó và phác thảo những gì mô hình tốt hơn sẽ thay đổi.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## Lưu ý sản xuất: năm gia đình, năm hình dạng suy luận

Mỗi gia đình lập bản đồ đến một đường cong chi phí inference-server khác nhau. Văn học sản xuất-inference khung inference LLM như prefill + decode; phân hủy tương tự áp dụng ở đây:

- **Autoregressive (bucket 1 and 5).**Việc giải mã theo trình tự thống trị thời gian trễ; KV-cache, batching liên tục và giải mã suy đoán đều áp dụng trực tiếp.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**Không có mã hóa trong ý nghĩa LLM.`num_steps × step_cost`, và `step_cost`là một biến thể hoặc U-Net phía trước với độ phân giải ẩn tình đầy đủ.
- **GAN (bucket 3).**Một lần đi trước, không có lịch trình, không có cache KV, TTFT ≈ thời gian trễ hoàn toàn, đó là lý do tại sao StyleGAN vẫn thắng trong UX miền hẹp.

Khi bạn thấy "quá hơn sự lan rộng" trong bản tóm tắt trên giấy, hãy dịch nó thành " ít bước x cùng chi phí bước" hoặc "những bước x chi phí bước rẻ hơn". Mọi thứ khác là tiếp thị.

## Đọc thêm

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) giấy GAN.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) tờ VAE.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) Báo cáo DDPM.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) phân tán như một SDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) giấy phù hợp với dòng chảy.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) Sự pha trộn ổn định 3.
