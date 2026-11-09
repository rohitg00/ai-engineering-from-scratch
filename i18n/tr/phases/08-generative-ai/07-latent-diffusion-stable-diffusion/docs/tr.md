# Latent Diffusion ve Stable Diffusion

> Rombach ve diğerleri (2022) bir görüntü oluşturmak için tüm 786k boyutlarına ihtiyacınız olmadığını fark etti.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## Sorun

5122 ' de piksel-uzayda yayılma U-Net ' in şekil tensörleri üzerinde çalışmasını sağlar .`[B, 3, 512, 512]`Her örnekleme adımı 500M-param U-Net için ~100 GFLOPS. 50 adım bir görüntü başına 5 TFLOPS. Bir milyar görüntü üzerinde çalıştırın ve hesaplama faturu saçmalık.

Bu FLOP'lerin çoğu, kaybeden bir VAE'nin sıkıştırdığı yüksek frekanslı dokuyu ağ üzerinden algılamaca önemsiz detayları itmeye gider. Rombach'un fikri: bir VAE'yi bir kez (* birinci aşama*) eğitmek, dondurmak ve tamamen 4 kanal 64×64 gizli alanında (* ikinci aşama*) yayılmayı çalıştırmak. Aynı U-Net.

Bu, Stable Diffusion tarifi. SD 1.x / 2.x 860M U-Net kullanıyor.`64×64×4`SDXL'de 2.6B U-Net kullanıldı.`128×128×4`, SD3 U-Net'i akış eşleşmesi ile bir Diffusion Transformer (DiT) ile değiştirdi. Flux.1-dev (Black Forest Labs, 2024) 12B-param DiT-MMDiT'yi gönderir. Hepsi aynı iki aşamalı altyapıda çalışır.

## Anlaşım

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**Kodlayıcı$E(x) \to z$, dekodör$D(z) \to x$. Hedef sıkıştırma: her alan eksisinde 8× aşağı örnek + kanalları ayarlayın böylece toplam gizli boyut piksel sayısının 1/16'sidir. Kayıp = yeniden yapılandırma (L1 + LPIPS algılama) + KL (küçük ağırlık böylece $z$Bu çok Gaussian zorunlu değil, çünkü tam örnekleme ihtiyacımız yok.$z$Genellikle bir düşmana karşı bir kayıpla eğitilmiştir. Bu yüzden kodlanmış görüntüler keskin.

2. **Stage 2 — diffusion on $z$.**Tedavi et .$z = E(x_{\text{real}})$Bir U-Net (veya DiT) 'yi denetlemeyi eğit.$z_t$Sonuçta: örnek$z_0$O zaman difüzyondan.$x = D(z_0)$- Evet .

**Text conditioning.**İki ek bileşen. Dondurulmuş bir metin kodlayıcısı (SD 1.x için CLIP-L, SD 2/XL için CLIP-L+OpenCLIP-G, SD3 ve Flux için T5-XXL).`[Q = image features, K = V = text tokens]`Tek yol metin görüntüyü etkilemektir.

**The loss function is identical to Lesson 06.**Aynı DDPM / akış eşleşen MSE gürültü. Sadece veri alanı değiştirmek.

## Mimarlık çeşitleri

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

Eğilim: U-Net'i DiT (lakent yamalar üzerinde transformatör) ile değiştirin, metin kodlayıcısını ölçeklendirin (T5 hızlı bir şekilde takip için CLIP'i yener), latent kanalları artırın (4 → 16 daha fazla ayrıntılı bir yer verir).

```figure
noise-schedule
```

## Yapın

`code/main.py`Öğrenci 06-dan DDPM'nin üstüne bir oyuncak 1-D "VAE" (sıkı bir ölçekle 0.5 kodlayıcı ve tam tersine dekodör olarak gösterim için; gerçek bir VAE bir konfor ağı olurdu) yığar ve sınıflandırıcı-sağ rehberliği ile sınıf koşullandırmasını ekler.

### Adım 1: Kodlayıcı/Kodlayıcı

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

Gerçek bir VAE'nin eğitimli ağırlıkları vardır.$z$Orijinal veri alanını önemsemeden.

### İkinci adım: `z`- Uzay

DDPM'nin 06. dersiyle aynı.$z = E(x)$Örnek alınca$z_0$,  ile çözülür .$D(z_0)$- Evet .

### Adım 3: sınıflandırıcı dışı rehberlik

Eğitim sırasında sınıf etiketini %10'da bırakın (sürekli bir simge ile değiştirin).$\epsilon_{\text{cond}}$ve $\epsilon_{\text{uncond}}$O zaman:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= rehberlik yok (tam çeşitlilik),$w = 3$= default, $w = 7+$= doymuş / aşırı keskin.

### Adım 4: Metin koşullandırması (konsept, kod değil)

Sınıf etiketini dondurulmuş bir metin kodlayıcı çıkışı ile değiştirin. U-Net'e gömülü metni çapraz dikkat yoluyla besleyin:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

Bu, sınıf koşullı bir difüzyon modeli ile sabit difüzyon arasındaki tek önemli fark.

## Tuzaklar

- **VAE-scale mismatch.**SD 1.x VAE'ler ölçekleme sabitine sahiptir (`scaling_factor ≈ 0.18215`Bu, U-Net'in çok yanlış bir değişim ile gizli bir şekilde çalışmasını sağlar.
- **Text encoder silently wrong.**SD3'nin T5-XXL'ye ihtiyacı var ve T5 = 128 tokeni vardır.`use_t5=True`Ya da hızlı sadakat kraterleri.
- **Mixing latent spaces.**SDXL, SD3, Flux hepsi farklı VAE'ler kullanır. SDXL latenti üzerinde eğitilmiş bir LoRA SD3 üzerinde çalışmaz.
- **CFG too high.** `w > 10`Doymuş, yağlı görüntüler üretir ve çeşitlilik masrafına karşı uyarıyı aşırı uyarır.`w = 3-7`- Evet .
- **Negative prompts leaking.**Boş negatif istek sıfır simge olur; doldurulmuş negatif istek $\epsilon_{\text{uncond}}$Bunlar aynı değil; bazı boru hattları sessizce sıfır açılır.

## Kullan

2026'da üretim aşamaları:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## Gönder

- Kaydet .`outputs/skill-sd-prompter.md`. Skill bir metin uyarısı + hedef stil ve çıkışları alır: model + kontrol noktası, CFG ölçeği, örnekleme, negatif uyarı, çözünürlük, seçmeli ControlNet/IP-Adapter kombinasyonu ve adım başına bir kalite kontrol listesi.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Yönlendirmelerle$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$Sınıflara göre ortalama örnek kaydet.$w$sınıf anlamları gerçek verilerin anlamlarından daha uzak mı?
2. **Medium.**Oyuncak çizgisi kodlayıcıyı yeniden yapılandırma kaybı olan tanh-MLP kodlayıcı/dekoder çiftine değiştirin. Yeni latentlerde yayılımı yeniden eğit. Örnek kalitesi değişiyor mu?
3. **Hard.**Düzenleyici ile gerçek Stable Diffusion inference ayarlayın: yük `sdxl-base`CFG=7 ile 30 Euler adımı at.`sdxl-turbo`Aynı konu, farklı kalite  neyin değiştiğini ve neden değiştiğini açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## Üretim notu: 8GB tüketici GPU'da Flux-12B çalıştırılıyor

Referans Flux entegrasyonu kanonik "Benim tüketici bir GPU var, bunu gönderebilir miyim?" tarifi.

1. **Staggered loading.**Flux, VRAM'da birlikte yaşamaya gerekmeyen dört ağ vardır: T5-XXL metin kodleyicisi (fp32'de ~ 10 GB), CLIP-L (küçük), 12B MMDiT ve VAE. Önce istekle kodlayın, * kodlayıcıları silin, DiT yükleyin, denoise, * delete* DiT, VAE yükleyin, dekode edin.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`T5 kodlayıcı ve DiT'de. 8× hafıza keser, Aritra'nın referans değerleri (notbukta bağlantılı) için metin-resim oranında kalitede düşüş algılanamaz.
3. **CPU offload.** `pipe.enable_model_cpu_offload()`CPU ve GPU arasında otomatik olarak modül değiştirir. Her ileri geçiş ilerlerken, %10-20 gecikme artırır.

Hatıra muhasebe: `10 GB T5 / 8 = 1.25 GB`Kvantistik olarak`12 B params × 0.5 bytes = ~6 GB`TP=1 sonucu  model paralelliği, maksimum kuantitasyon. üretim için H100'lerde TP=2 veya TP=4 çalıştırırsınız; tek bir dev dizüstü bilgisayar için, bu tarif.

## Daha Fazla Okumak

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Dönüştürülme.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL.
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748)- DiT.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598)CFG.
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) Flux.1 ailesi.
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) yukarıdaki her kontrol noktası için referans uygulanması.
