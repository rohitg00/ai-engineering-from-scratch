# Genreatif Modeller  Taksonomi & Tarih

> Her görüntü modeli, metin modeli, video modeli ve 3 boyutlu modeli beş kova içinden birine sığar. Yanlış kova seçin ve haftalarca matematikle mücadele edeceksiniz. Doğru olanı seçin ve alanın son on iki yıllık ilerlemesi kafanızda temiz bir şekilde toplanır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## Sorun

Bir üreticik model bir iş yapar: Bilinmeyen bir dağıtımdan alınan eğitim örnekleri.$p_{\text{data}}(x)$Yüzler, cümleler, MIDI dosyaları, protein yapıları  göz kırpırsanız hepsi aynı sorun.

- Sorun şu ki .$p_{\text{data}}$Bu örnekler, milyonlarca boyutlu bir alanda yaşıyor (bir 512x512 RGB görüntü yaklaşık 786k boyutlu), ve bu alanın içinde ince bir çeşitlilik üzerinde oturur ve sadece 10M örnekler vardır.

Son on iki yılda beş aile hayatta kaldı. Her aile hangi ödüller verdiğini bilmek, bazı görevlerde neden kazanıyor ve diğerlerinde neden çöküyor, anlatabilir.

## Anlaşım

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**Yazmın .$\log p(x)$Bu, bir değerlendirme yapabilmek için bir toplam olarak kullanılır.$p(x) = \prod_i p(x_i \mid x_{<i})$Normalleşen akışlar (RealNVP, Glow) oluşturulur.$p(x)$Pro: tam olasılık, temiz eğitim kaybı. Con: autoregressive sonuçlandırma sıralı (uzun sırada yavaş), akışlar dönüştürülebilir mimarlıklara ihtiyaç duyar (memarlık açısından kısıtlayıcı).

**2. Explicit density, approximate.**Bağlı$\log p(x)$VAE'ler (Kingma 2013) bir varyasyon arka taraflı bir kodlayıcı-dekodör kullanır. Diffusion modelleri (DDPM, Ho 2020) bir denoiser eğitmek ve dolaylı olarak ağırlanmış ELBO'yu optimize eder.

**3. Implicit density.**Denetliği tamamen atlayın; bir jeneratör öğrenin $G(z)$Örnekler üreten ve ayrımcı olan bir grup.$D(x)$Bu, gerçekten sahteye anlatır. GAN'lar (Goodfellow 2014). Tahminde hızlı (bir ileri geçiş) ancak eğitim sırasında belirsiz olarak dengesiz. StyleGAN 1/2/3 2026'da bile sabit alan fotorealizmi için sanatın en son durumunu sürdürüyor.

**4. Score-based / continuous-time.**Çubuk yoğunluğunun eğilimi öğrenin $\nabla_x \log p(x)$(score) doğrudan. Song & Ermon (2019) skor eşleşmesi, SDE'ye yayılmayı genelleştirdiğini gösterdi. Akış eşleşmesi (Lipman 2023) 2024-2026 sıcaklığıdır: simülasyonsuz eğitim, daha düz yollar, DDPM'den 4-10 kat daha hızlı örnekleme.

**5. Token-based autoregressive over discrete codes.**Yüksek-dim verileri bir VQ-VAE veya kalan kuantitör ile kısa bir ayrı jeton sekansına sıkıştırın, sonra jeton sekansını modellemek için bir Transformer kullanın. Parti, MuseNet, AudioLM, VALL-E, Sora'nın yama jetonçısı hepsinin bunu kullanması. Bu sep 1 artı öğrenilmiş jetonçudur.

## Kısa bir tarih

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

## Beş sorudan oluşan seçim

Yeni bir üreticik model kağıdı düştüğünde, yöntem bölümünü okumadan önce bu beş soruya cevap verin.

1. **What is being modeled?**Pikseller, gizli, ayrı simgeler, 3 boyutlu Gaussians, ağlar, dalga şekilleri?
2. **Is the density explicit or implicit?**- Yazdılar mı ?$\log p(x)$- Ne ?
3. **Sampling: one-shot or iterative?**İteratif, daha yavaş bir sonucu çıkarmak anlamına gelir; tek atış genellikle karşıtlık veya destilli anlamına gelir.
4. **Conditioning: unconditional, class, text, image, pose?**Bu, kayıp ve mimarlık asfaltlamasını belirler.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**Her biri başarısızlık modlarını biliyor (Düşünme 14).

Bu aşamada her ders için bu beşin cevabını tekrar vereceksin.

```figure
autoencoder-bottleneck
```

## Yapın

Bu dersin kodu hafif bir vizüalizasyon: üç oyuncak yaklaşımı (yürekli yoğunluk, ayrı histogram ve en yakın örnek "GAN-ish" jeneratörü) kullanarak örneklerden 1 boyutlu Gaussian karışımı uygulayın, böylece bir ekranda yazdırabileceğiniz bir sorunda açık vs. içeren yoğunluk arasındaki farkı görebilirsiniz.

Çık .`code/main.py`İki modlu Gaussian karışımından 2000 numune çıkarır ve sonra yazdırır:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Dikkat edin: İlk iki bölümde "Bu nokta ne kadar olası?" diye sormak için izin verilir. Üçüncü bölümde "Bu nokta ne kadar olası?" diye sormak için izin verilir.

## Kullan

Hangi aile, 2026'da hangi görev için?

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

## Gönder

- Kaydet .`outputs/skill-model-chooser.md`- Evet .

Bu beceride görevlerin tanımlanması ve çıkışları bulunur: (1) hangi aileyi kullanmak, (2) üç açık ve üç barındırılmış seçeneklerin sıralamalı bir listesi, (3) dikkat etmeniz gereken olası başarısızlık modu ve (4) hesaplama/zaman bütçesi.

## Egzersizler

1. **Easy.**Bu beş ürün için, aile ve omurganı belirleyin: ChatGPT görüntü, Midjourney v7, Sora, Runway Gen-3, ElevenLabs. Kanıtlar kamu teknik raporlarından olmalıdır.
2. **Medium.**Yarın okuyacağınız makale, yayılmaktan 100 kat daha hızlı örnek almayı iddia ediyor.
3. **Hard.**İlgilendiğiniz bir alanı alın (örneğin protein yapısı, CAD, moleküller, yoldurma). Şu anki SOTA modeli için beş sorunun seçimini yanıtlayın ve daha iyi bir modelin neyi değiştirdiğini çizin.

## Anahtar Terimler

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

## Üretim notu: beş aile, beş sonuç şekli

Her aile farklı bir sonuç-server maliyet eğriyi haritası yapar. üretim-sonuculu literatür LLM sonuçlarını önceden doldur + çözme olarak çerçevelemektedir; aynı parçalanma burada geçerlidir:

- **Autoregressive (bucket 1 and 5).**Sequential decoding latency'yi yönetiyor; KV-cache, sürekli serileme ve spekülasyonsal dekodlama hepsi doğrudan uygulanmaktadır.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**LLM anlamında bir dekod yok.`num_steps × step_cost`, ve `step_cost`Üretim düğmeleri adım sayımı (DDIM / DPM-Solver / destillasyon), parti boyutu ve hassaslığı (bf16 / fp8 / int4) ile oluşur.
- **GAN (bucket 3).**Bir ileri geçiş, program yok, KV-cache yok, TTFT ≈ toplam gecikme. Bu yüzden StyleGAN hala dar alan UX'de kazanıyor.

Kağıt özetinde "aşırı yayılmaktan daha hızlı" gördüğünüzde, "çık adımlar × aynı adım maliyeti" veya "aynı adımlar × daha ucuz adım maliyeti" olarak çevirin.

## Daha Fazla Okumak

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) GAN kağıdı.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) VAE kağıdı.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM makalesi.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) SDE olarak yayılma.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) akış eşleşen kağıt.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) Dönüştürülme 3.
