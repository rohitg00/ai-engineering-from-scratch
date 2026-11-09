# Kontrol Net, LoRA & Kondisyonlama

> Tekrar metin çilekli bir kontrol sinyali. ControlNet, önceden eğitilmiş bir difüzyon modelini klonlamanıza ve onu derinlik haritası, iskelet, kazık veya kenar görüntüsü ile yönlendirmenize olanak tanır. LoRA, 10 milyon parametreyi eğiterek 2B parametresi modeli ince ayarlamanıza olanak tanır. Birlikte, Stabil Diffusion'u bir oyuncaktan 2026 görüntü borusuna dönüştürdüler.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## Sorun

"Kırmızı elbise giyen bir kadın, yoğun bir sokakta köpek yürütüyor" gibi bir ipucu, modelin köpeğin nerede olduğunu, kadın hangi pozda olduğunu veya sokak perspektifini bilmesine izin vermez.

Her sinyal için yeni bir koşullu model eğitmek (tıp, derinlik, zekice, segmentasyon) yasaktır. 2.6B-param SDXL omurgasını dondurmak, koşullamayı okuyan küçük bir yan ağ bağlamak ve omurgasının orta özelliklerini itmek istiyorsunuz. Bu ControlNet.

Ayrıca, modelin tamamını yeniden eğitmeden yeni kavramlar (yüzünüz, ürününüz, stiliniz) öğretmek istiyorsunuz. 100 kat daha küçük bir delta istiyorsunuz. Bu, mevcut dikkat ağırlıklarına bağlanan düşük rütbeli LoRA  adaptörler.

ControlNet + LoRA + metin = 2026 uygulayıcısının araç kümesi. Çoğu üretim görüntü boru hattı 2-5 LoRA, 1-3 ControlNets ve SDXL / SD3 / Flux tabanının üstünde bir IP-Adapter katıyor.

## Anlaşım

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

*Klon * U-Net'in kodlayıcı yarısını. Orijinalı dondur. Ekstra şartlandırma girişini kabul etmek için klonu eğit. * sıfır konvulsiyon* sıfır bağlantıları ile klonu orijinalin dekodör yarısına tekrar bağlayın (1×1 konvis sıfır  olarak başlatılır  no-op olarak başlayın, delta öğrenin).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Zero-conv init, ControlNet'in eğitimden önce bile kimlik olarak başlaması  zarar vermemesi anlamına gelir. 1M'de tren (sürekli, durum, görüntü) standart difüzyon kaybı ile üç katına çıkar.

Per-modality ControlNets küçük yan modeller olarak (SDXL için ~ 360M, SD 1.5 için ~ 70M) gönderir.

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

Herhangi bir doğrusal katman için $W \in \mathbb{R}^{d \times d}$Modelde, dondurma $W$ve aşağı derecede bir delta ekle:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

- Evet .$r \ll d$4-16 sıra dikkat için standart, 64-128 sıra ağır ince tonlar için.$2 \cdot d \cdot r$yerine$d^2$. SDXL dikkat için $d=640$- Evet .$r=16$Adaptör başına 20k param 410k yerine  20x azaltma. Tüm model boyunca: bir LoRA genellikle 20-200MB vs. temel 5GB.

Sonuç olarak , LoRA ' yı ölçebilirsiniz:$W' = W + \alpha \cdot B A$- Evet .$\alpha = 0.5\text{-}1.5$Bir çok LoRA'nın ek olarak yığılması (doğru uyarı ile, doğrusal olmayan şekillerde etkileşime girmeleri) normaldir.

### IP-Adapter (Ye et al., 2023)

* resim * bir şartlama olarak kabul eden küçük bir adaptör (metin yanında). Görüntü jetonları üretmek için CLIP görüntü kodlayıcısını kullanır, onları metin jetonları yanında çapraz dikkat içine enjekte eder. ~ 20 MB baz model başına.

## Dönüşümsellik matrisi

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

Kontrol Ağı, uzaylı, LoRA, semantik.

```figure
v4-controlnet-zero
```

## Yapın

`code/main.py`1-D'de iki mekanizmayı simüle eder:

1. **LoRA.**Önceden eğitilmiş bir çizgi katman .$W$- Dondur. Düşük bir sınıfı eğit.$BA$Bu kadar .$W + BA$Hedef çizgisi katmanına eşleşir.$r = 1$Birinci seviye düzeltmesini mükemmel öğrenmek için yeterli.

2. **ControlNet-lite.**Bir "dondurulmuş taban" tahmincisi ve bir " yan ağ " ek bir sinyal okuyor. yan ağın çıkışı sıfır olarak başlatılmış bir öğrenilebilir skalar tarafından kapalıdır (sıfır-conv versiyonumuz).

### Adım 1: LoRA matematik

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Adım 2: sıfır-bit yan ağ

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

0'da çıkış, tabanla aynıdır.`gate`Yavaşça  felaketli bir sürükleme yok.

## Tuzaklar

- **Over-scaling LoRAs.** $\alpha = 2$veya $\alpha = 3$Bu, "güçlü yap" hack'in yaygın bir yöntemidir.$\alpha \le 1.5$- Evet .
- **ControlNet weight conflict.**Pose ControlNet'in 1.0 ağırlıklı ve 1.0 ağırlıklı derinlik kontrol ağının kullanılması genellikle aşırı atışlar yapar.
- **LoRA on the wrong base.**SDXL LoRA'sı sessizce SD 1.5'de çalışmıyor çünkü dikkat boyutları eşleşmiyor.
- **Textual Inversion drift.**Bir kontrol noktasında eğitilen tokenler diğerinde kötü hareket eder.
- **LoRA weight-merging and storage.**Daha hızlı sonuçlar için temel model ağırlıklarına bir LoRA pişirebilirsiniz (kurut zamanının eklenmesi yok), ancak ölçekleme yeteneğini kaybediyorsunuz $\alpha$İkisi de kalsın.

## Kullan

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## Gönder

- Kaydet .`outputs/skill-sd-toolkit-composer.md`. Yetenek bir görev alır (geleneksel varlıklar: hızlı, seçeneği referans görüntü, seçeneği poz, seçeneği derinlik, seçeneği kazıklama) ve araç yığın, ağırlıklar ve yeniden üretilebilir bir tohum protokolü çıkarır.

## Egzersizler

1. **Easy.**İçeri`code/main.py`, LoRA sıralarını değiştirir .`r`1 ile 4 arasında, LoRA tam olarak 2. sırada bir hedef delta ile aynıdır.
2. **Medium.**İki ayrı LoRA'yı iki hedef dönüşümüne çalıştırın. Onları bir araya getirin ve katılımcı etkileşimlerini gösterin.
3. **Hard.**Dökme için difüzerler kullanın: SDXL-base + Canny-ControlNet (kolem 0,8) + bir stil LoRA ($\alpha$0.8) + IP-Adapter (vezi 0.6).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## Üretim notu: LoRA değişimi, ControlNet yolları, çoklu kiracı hizmetleri

Gerçek bir metin-yazar SaaS aynı temel kontrol noktasında yüzlerce LoRA ve bir düzine ControlNets'e hizmet verir. Servis sorunu LLM çok kiracılığına çok benziyor (prodüksiyon literatürü sürekli batching ve LoRAX / S-LoRA altında LLM durumunu kapsar):

- **Hot-swap LoRAs, do not merge.**Birleştirme$W' = W + \alpha \cdot B \cdot A$Üstelik bu aşamada ~ 3-5% daha hızlı bir sonuç çıkarır ama dondurulur.$\alpha$LRA'ları VRAM'da r sıra delta olarak sıcak tutun; difüzerler açığa çıkarır.`pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`Arama başına etkinleştirme için.`2 · d · r · num_layers`ağırlıklar  MB ölçeği, alt ikinci.
- **ControlNet as a second attention lane.**Klonlanmış kodlayıcı tabanla paralel olarak çalışır. Her biri 1.0 ağırlığında iki ControlNet = her adım için iki ekstra ileri geçiş, bir birleşik geçiş değil.
- **Quantized LoRAs too.**Temelini kuantleştirirseniz (Desin 07, 8GB'de akış) LoRA delta da temiz bir şekilde 8 bit veya 4 bit olarak kuantleştirir. QLoRA tarzında yükleme, hafızayı patlatmadan 4 bitlik bir Flux tabanının üzerine 5-10 LoRA'yı yığmanıza olanak sağlar.

Fluks-Specifik: Niels'in Flux-on-8GB bilgisayarı tabanı 4 bit olarak kvantize eder; LoRA (`pipe.load_lora_weights("user/style-lora")`) bu kuantitasyon tabanında `weight_name="pytorch_lora_weights.safetensors"`Bu, 2026'da çoğu SaaS ajansının gönderdiği reçete.

## Daha Fazla Okumak

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543)Kontrol ağı.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (aslen LLM için; difüzyon için limanlar).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) IP Adaptörü.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) Kontrol Net'e daha hafif alternatif.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242)- Hayal sandalyesi.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) Referans boru hattı.
