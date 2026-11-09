# Değerlendirme  FID, CLIP puanı, insan tercihleri

> Her jeneratif model lider tablosu, insan tercih alanından FID, CLIP puanı ve kazanım oranını belirtir. Her sayı, belirlenmiş bir araştırmacı oynayabilecek bir başarısızlık moduna sahiptir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## Sorun

Bir jeneratif model * örnek kalitesi * ve * koşullama yapısı * üzerine değerlendirilir. Her ikisi de kapalı bir ölçümüne sahip değildir. Modeliniz 10.000 görüntüyi göstermelidir; bir şey onlara sayı ataması gerekir; model aileleri, çözünürlükler, mimarlıklar boyunca sayılara güvenmeniz gerekir. 2014-2026 eldiveninden üç ölçüm sağ kaldı:

- **FID (Fréchet Inception Distance).**Bir başlangıç ağının özellik alanında iki dağıtım  gerçek ve üretilen  arasındaki mesafe.
- **CLIP score.**Yaratılan bir görüntüde CLIP-resim yerleştirme ile bir istekle CLIP-metin yerleştirme arasında benzerlik. Daha yüksek daha iyidir.
- **Human preference.**İki modelin aynı sorguya karşı karşıya kalmasını sağlayın, insanların (veya GPT-4 sınıfı bir model) daha iyi olanı seçmesini sağlayın, bir Elo puanına toplamlayın.

Ayrıca şunları göreceksiniz: IS (başlangıç puanı, büyük ölçüde emekli), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Her biri önceki başarısızlıklardan birinde düzeltir.

## Anlaşım

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID  örnek kalitesi

Heusel et al. (2017). Adımlar:

1. N gerçek görüntüler ve N oluşturulan görüntüler için Inception-v3 özelliklerini (2048-D) çıkarın.
2. Her havuz için bir Gaussian ayarlayın: hesap ortalaması$\mu_r, \mu_g$ve kovarians $\Sigma_r, \Sigma_g$- Evet .
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$- Evet .

Anlatma: Özellik alanındaki iki çok değişken Gaussyan arasındaki Fréchet mesafe.

Başarısızlık modları:
- **Biased on small N.**FID, özellik dağılımının ortalaması karesidir  küçük N, kovaransı küçümser, yanlış düşük FID verir.$N \ge 10{,}000$- Evet .
- **Inception-dependent.**ImageNet'ten uzak alanlar (yüzler, sanat, metin görüntüler) anlamsız FID üretir.
- **Gaming.**Başlangıç öncesiye fazla uyum sağlayarak görsel kalitede iyileşme olmadan düşük FID sağlar.

### CLIP puanı  hızlı bir şekilde takip edilmek

Radford et al. (2021). Yaratılan bir görüntü için + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

30k'da üretilen görüntülerin ortalaması → modeller arasında karşılaştırılabilir bir ölçek.

Başarısızlık modları:
- **CLIP's own blind spots.**CLIP'in zayıf bir kompozisyon mantığı vardır ("mavi bir kürede kırmızı bir küp" genellikle başarısız olur).
- **Short prompt bias.**Kısa çağrılar, daha fazla CLIP görüntü eşleşmesini sağlarken, daha uzun çağrılar mekanik olarak daha düşük CLIP puanlara sahiptir.
- **Prompt gaming.**"Yüksek kalite, 4k, şaheser" içeren istek, görüntü-metin bağlanmasını geliştirmeden CLIP puanını yükseltir.

CMMD (Jayasumana et al., 2024) bunlardan bazılarını düzeltir: Başlangıç yerine CLIP özelliklerini kullanır, Fréchet yerine maksimum ortalama çelişki.

### İnsan tercihi  temel gerçek

Bir dizi ipucu seçin. Model A ve model B ile oluşturun. İnsanlara çiftler gösterin (veya güçlü bir LLM yargıç).

- **PartiPrompts (Google)**: 1600 farklı sorgu, 12 kategori.
- **HPSv2**: 107k insan notları, geniş çapta otomatik temsilci olarak kullanılır.
- **ImageReward**: 137k çabuk görüntü tercih çiftleri, MIT lisanslı.
- **PickScore**Bu nedenle, bu programın en iyi yönleri,
- **Chatbot-Arena-style image arenas**- Evet .https://imagearena.ai/Ve diğerleri.

Başarısızlık modları:
- **Judge variance.**Uzmanlar olmayanların tercihleri uzmanlardan farklıdır.
- **Prompt distribution.**Bir aile için iyi bir tavsiye.
- **LLM-judge reward hacking.**GPT-4 yargıçı güzel ama yanlış sonuçlarla kandırılır.

## Birlikte kullanın

Üretim değerlendirme raporu şunları içermelidir:

1. 10-30k örnekle gerçek bir dağıtım ( örnek kalitesi) karşılaştırıldığında FID.
2. Aynı örnekler karşısında CLIP puanı / CMMD (aitlik).
3. Kör bir arenada önceki modelle karşı kazanç oranı (toplam tercih).
4. Başarısızlık modunun analizi: Bilinen sorunlar için işaretlenen 50 rastgele örneklenmiş çıkış (el anatomisi, metin gösterimi, tutarlı nesne sayısı).

Her tek metrik yalan. Üç doğrulucu metrik + kaliteli inceleme bir iddiadır.

```figure
gx-fid-distributions
```

## Yapın

`code/main.py`FID, CLIP skor benzeri ve Elo toplamını sentetik "karakter vektörleri" üzerinde uyguluyor.

- Küçük bir N'de ve büyük bir N'de FID hesaplama  önyargısı.
- "CLIP puanı" özellik havuzları arasındaki kozine benzerlik olarak.
- Sintez tercih akışından Elo güncelleme kuralı.

### Adım 1: Dört satırda FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Adım 2: CLIP tarzı cosine benzerliği

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Adım 3: Elo toplama

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Tuzaklar

- **FID at N=1000.**Heuristik, N=10k'de güvenilir değil.
- **Comparing FID across resolutions.**Başlangıç'ın 299×299 boyutları özellik dağılımını değiştirir.
- **Reporting one seed.**En az 3 tane tohum çalıştırın.
- **CLIP score inflation via negative prompts.**Bazı boru hattları, işaretleme cihazını fazla ayarlayarak CLIP'i artırıyor.
- **Elo bias from prompt overlap.**Eğer her iki model de eğitim sırasında bir referans işaretini gördüyse Elo anlamsızdır.
- **Human eval paid-crowd skew.**Verimli, MTurk notatörleri genç / teknoloji dostu eğilimi.

## Kullan

2026 yılında üretim değerlendirme protokolü:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

Tek rapordaki dört sütun = iddia.

## Gönder

- Kaydet .`outputs/skill-eval-report.md`. Skill yeni bir model kontrol noktasını + temel çizgiyi alır ve tam bir değerlendirme planını çıkarır: örnek boyutları, ölçümler, başarısızlık modundaki araştırmalar, onay kriterleri.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Aynı sentetik dağılımlarda N=100 vs N=1000'de FID'yi karşılaştırın.
2. **Medium.**CMMD'yi sentetik CLIP tarzı özelliklerden uygulayın (formül için Jayasumana et al., 2024'e bakın).
3. **Hard.**HPSv2 ayarını tekrarlayın: Pick-a-Pic alt kümesinden 1000 görüntü-sürekli çift alın, küçük bir CLIP tabanlı puanlayıcıyı tercihlere göre ince ayarlayın ve uyumunu bir tutulan kümle ile ölçün.

## Anahtar Terimler

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

## Üretim notu: değerlendirme de bir sonuç iş yüküdür

10k örnekler üzerinde FID çalıştırmak 10k görüntü üretmek anlamına gelir. Tek L4'te 10242'de 50 adımlı SDXL tabanı için, bu ~11 saat tek istek sonucu anlamına gelir. Değerlendirme bütçeleri gerçek, ve çerçeve tam olarak çevrimdışı sonucu senaryoya (maksimum çıkışlılık, TTFT'yi ihmal et):

- **Batch hard, forget latency.**Offline eval = hafızaya uygun en büyük boyutta statik seri. `pipe(...).images`- Evet .`num_images_per_prompt=8`80GB H100'de, tek istekten 4-6 kat daha hızlı bir duvar saati kullanılır.
- **Cache the real features.**Gerçek referans kümesi üzerinde başlatma (FID) veya CLIP (CLIP-score, CMMD) özelliği çıkarımı *once* olarak çalıştırılır.`.npz`- Değerlendirme başına yeniden hesaplama.

CI / regresyon kapıları için: PR başına 500 örnek alt kümesi üzerinde FID + CLIP puanı çalıştırın (~ 30 dakika); gecelik 10k FID + HPSv2 + Elo çalıştırın.

## Daha Fazla Okumak

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500)- FID kağıdı.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020)- Klip.
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789)PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) Başarısız mod anket.
