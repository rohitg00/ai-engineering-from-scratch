# Video Yükleme

> Bir görüntü 2 boyutlu bir tensördür. Bir video 3 boyutlu bir tenzordur. Teorisi aynıdır; hesaplama 10-100 kat daha zordur. OpenAI'nin Sora (Feb 2024) bunun mümkün olduğunu kanıtladı. 2026 yılına kadar Veo 2, Kling 1.5, Runway Gen-3, Pika 2.0, ve WAN 2.2 gemisi üretim videoları 1080p 'de metin ve açık ağırlıklı yığın (CogVideoX, HunyuanVideo, Mochi-1, WAN 2.2) 12 ay geri.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## Sorun

10 saniyelik 1080p video 24fps'de 240 çerez 1920×1080×3 piksel. Bu, her klip için yaklaşık 1,5 GB ham veri. Piksel alanı yayılması mümkün değildir.

1. **Spatiotemporal compression.**Çerçeve değil, videoları uzay-zamanlı yamalar dizisine kodlayan bir VAE.
2. **Temporal coherence.**Çerçeve, içeriği, aydınlatmayı ve nesne kimliğini saniyeler içinde paylaşmalıdır.
3. **Compute budget.**Video eğitimi aynı model boyutunda görüntüden 10-100 kat daha pahalıdır.
4. **Conditioning.**Metin, görüntü (birinci çerçeve), ses veya başka bir video.

Bunu çözen mimarlık **Diffusion Transformer (DiT)**Bu, uzay-zamanlı patchlere uygulanmış, büyük (sürekli, başlıklı, video) veri kümeleri üzerinde eğitilmiştir.

## Anlaşım

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### Çekil

Videoyu 3D VAE ile kodlayın.`[T_latent, H_latent, W_latent, C_latent]`- Büyüklükteki parçalara bölünmüş .`[t_p, h_p, w_p]`Sora tarzında modeller için.`t_p = 1`(kadre başına yapıştırmalar) veya `t_p = 2`10 saniyelik 1080p video yaklaşık 20.000-100.000 yama olarak sıkıştırılır.

### Uzay-zamanlı DiT

Bir transformatör, düz düzlemli yama dizisini işlemelidir. Her yama 3 boyutlu bir konumlandırma (zaman + y + x) sahiptir. Dikkat genellikle faktörlüdür:

- **Spatial attention**Her çerçeve patçası içinde.
- **Temporal attention**Aynı mekanın çerçeveleri üzerinde.
- **Full 3D attention**16-100 kat daha pahalı; sadece düşük çözünürlükte veya araştırmalarda kullanılır.

### Metin koşullandırması

Büyük bir metin kodlayıcısı ile çapraz dikkat (T5-XXL Sora için, CogVideoX-5B T5-XXL kullanır). Uzun çağrılar önemli  Sora'nın eğitim kümesi, her klip için ortalama 200 token ile GPT üretilen yoğun başlıklara sahipti.

### Eğitim

Uzay-zamanlı latenler üzerinde standart difüzyon kaybı (ε veya v tahmin). Veriler: web video + ~ 100M kurate edilmiş klipler + sentetik metin başlıkları. Hesaplama: 10.000+ GPU saatleri küçük bir araştırma çalışması için bile; Sora ölçeği 100.000+

## 2026 üretim manzarası

| Model | Date | Max duration | Max res | Open weights? | Notable |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | No | First model to show world simulator properties at scale |
| Sora Turbo | 2024-12 | 20s | 1080p | No | Production Sora at 5x faster inference |
| Veo 2 (Google) | 2024-12 | 8s | 4K | No | Highest quality + physics in 2025 |
| Veo 3 | 2025 Q3 | 15s | 4K | No | Native audio and stronger camera control |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | No | Best human motion in 2025 Q1 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | No | Professional video tools on top |
| Pika 2.0 | 2024-10 | 5s | 1080p | No | Strongest character consistency |
| CogVideoX (THUDM) | 2024 | 10s | 720p | Yes (2B, 5B) | First open 5B-scale video |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Yes (13B) | Open SOTA late 2024 |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | Yes (10B) | Most permissively licensed |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Yes | Strongest open model mid-2025 |

Açık ağırlıklar, görüntü alanındaki farkı daha hızlı kapatıyor: HunyuanVideo + WAN 2.2 LoRA'lar 2026'ın ortalarına kadar çoğu açık kaynaklı iş akışını güçlendiriyor.

```figure
video-diffusion-denoise
```

## Yapın

`code/main.py`Bu, küçük bir sentetik videoyi patchify, her patch pozisyonu yerleştirme eklemek ve tüm dizini patches üzerinde transformatör tarzında dikkatle denoze.

### Adım 1: sentetik 1D "video" yapıştır

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### Adım 2: Çerçeve başına yerleştirme

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### Adım 3: Denoiser tüm dizini görür

Her çerçeveyi bağımsız olarak tanımlamak yerine, küçük ağımız tüm çerçeve değerlerini + konum yerleşimlerini birleştirir ve tüm çerçeveler için gürültüyü birlikte tahmin eder.

### Adım 4: Zamanlı tutarlılık testi

Eğitimden sonra bir video örneği alın. Çerçeve-çerçeve delta ölçün. Eğer model zamansal yapıyı öğrenmişse, deltalar her çerçeveyi bağımsız olarak örneğe almaktan daha küçük kalır.

## Tuzaklar

- **Independent per-frame sampling = flicker.**Her çerçeve üzerinde görüntü difüzyonu ayrı ayrı çalıştırırsanız, çıkış gürültüsü her çerçeve'nin gürültüsü bağımsız olduğundan parlıyor.
- **Naive 3D attention = OOM.**10 saniyelik 1080p latenti üzerinde tam 3 boyutlu dikkat yüz milyarlarca işlemdir.
- **Data captioning matters more than size.**Sora'nın önceki çalışmalara göre en önemli yükseltmesi, yaklaşık 10 kat daha detaylı başlıkları (GPT-4 yeniden etiketlenen klipler) üzerinde eğitimdi.
- **First-frame conditioning.**Çoğu üretim modeli de ilk çerçeve olarak bir görüntü kabul eder. Bu "resim-video" modudur; eğitim bu variansı içerir.
- **Physics drift.**Uzun klipler (> 10s) ince uyumsuzluklar biriktirir.

## Kullan

| Use case | 2026 pick |
|----------|-----------|
| Highest-quality text-to-video, hosted | Veo 3 or Sora |
| Camera-controlled cinematic | Runway Gen-3 with motion brushes |
| Character consistency across clips | Pika 2.0 or Kling 2.1 |
| Open weights, fast fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V, or Runway |
| Audio-to-video lip sync | Veo 3 (native audio) or a dedicated lip-sync model |
| Video editing | Runway Act-Two, Kling Motion Brush, Flux-Kontext (still-frame) |

Kalite eşitliği ile videoların saniyede maliyeti 2024 ile 2026 arasında 20 kat düştü.

## Gönder

- Kaydet .`outputs/skill-video-brief.md`. Skill, bir video kısa (zaman, boyut oranı, stil, kamera planı, konu tutarlılığı, ses) ve çıkışları alır: model + hosting, hızlı asfaltlama (kamera dili, konu açıklaması, hareket tanımlayıcıları), tohum + yeniden üretilebilirlik protokolü ve çerçeve düzeyinde bir QA kontrol listesi.

## Egzersizler

1. **Easy.**İçeri`code/main.py`, (a) bağımsız çerçeve örneklemesi için çerçeveye delta karşılaştırın, (b) ortak dizi örneklemesi için.
2. **Medium.**Birinci çerçeve koşulunu ekleyin: pin çerçeve 0 belirli bir değere ve geri kalanı örnekleyin.
3. **Hard.**HuggingFace difüzerlerini kullanarak CogVideoX-2B'yi yerel bir GPU'da çalıştırın. 6 saniyelik bir klip için 720p'de zaman 20 sonucu adımları.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | Encoder that compresses `(T, H, W, C)` → spatiotemporal latent. |
| Patches | "The tokens" | Fixed-size 3-D blocks of the latent; input to the DiT. |
| Factorized attention | "Spatial + temporal" | Run attention over space, then over time; skip full 3-D attention. |
| Image-to-video (I2V) | "Animate this photo" | Model takes an image + text, outputs a video that starts from it. |
| Keyframe conditioning | "Anchor frames" | Pin specific frames to control the video's arc. |
| Motion brush | "Directional hint" | UI input where the user paints motion vectors onto the image. |
| Re-captioning | "Dense captions" | Using an LLM to re-label training clips with detailed prompts. |
| Flicker | "Temporal artifact" | Frame-to-frame inconsistency; fixed with coupled denoising. |

## Üretim notu: Video latenları hafıza bant genişliği sorunu

10 saniyelik 1080p clip 24 fps'de 240 çorap × 1920 × 1080 × 3 ≈ 1.5 GB çiğ pikseli.`2 × spatial × 2 × temporal`Bu, bir dilimde 30 adım boyunca bir uzay-zaman DiT üzerinden çalıştırılır ve HBM  hafıza bant genişliği ile 3 GB/adım geçirilir.

Üç üretim düğmesi, hepsi doğrudan üretim-sözü literatürü sonucu bölümünden:

- **TP across the DiT.**Metin-video modelleri rutin olarak ≥10B parametreleridir. TP=4 4 H100'de standarttır; PP=2 × TP=2 405B sınıfı modeller için.
- **Frame batching = continuous batching.**Video, üretim sırasında kavramsal olarak dikkat ile bağlantılı bir çerçeve seri.`t+1`çerçeve yaparken`t-1`model mimarisi sürükleyici pencere üretimini sağlıyorsa geri veriliyor.
- **Clip-level prefill cache.**Resim-video için, ilk çerçeve koşullaması bir LLM'nin hızlı önceden doldurması ile benzer: bir kez hesaplayın, temporal dekoder geçişleri boyunca tekrar kullanın. Bu aslında video için bir KV-cache.

## Daha Fazla Okumak

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) Sora teknik raporu.
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) CogVideoX.
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) HunyuanVideo.
- [Genmo (2024). Mochi 1 preview model card](https://huggingface.co/genmo/mochi-1-preview)Mochi-1.
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) SOTA'yı 2025'in ortalarında açmak.
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) video yayım kağıdı.
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) Stable Video Diffusion'un ataları.
