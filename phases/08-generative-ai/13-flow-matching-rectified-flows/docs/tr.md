# Akış Eşleştirme ve Düzeltilmiş Akışlar

> Difüzyon modelleri, gürültüden veriye doğru kavisli bir yol yürüdüklerinden 20-50 örnekleme adımı alır. Akış eşleştirme (Lipman ve diğerleri, 2023) ve düzeltilmiş akış (Liu ve diğerleri, 2022) eğitimli düz yollar. Daha düz yollar daha az adım anlamına gelir, daha hızlı demektir inference. Stable Diffusion 3, Flux.1 ve AudioCraft 2'nin tümü 2024'te akış eşleştirmeye geçti.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 8 · 06 (DDPM), Aşama 1 · Hesaplama
**Süre:** ~45 dakika

## Sorun

DDPM'nin ters süreci, `N(0, I)`'den veri dağıtımına kadar 1000 adımlık stokastik bir yürüyüştür. DDIM bunu 20-50 deterministik adıma indirdi. Daha az adım istiyorsunuz; ideal olarak bir adım. Engelleyici, ters işlemi çözen ODE'nin katı olmasıdır; yol kavislidir.

Modeli, gürültüden veriye giden yol *düz bir çizgi* olacak şekilde eğitebilirseniz, `t=1`'den `t=0`'ye tek bir Euler adımı işe yarayacaktır. Akış eşleştirme bunu doğrudan oluşturur: `x_1 ∼ N(0, I)`'den `x_0 ∼ data`'ye bir düz çizgi enterpolasyonu tanımlayın, zaman türeviyle eşleştirmek için bir `v_θ(x, t)` vektör alanını eğitin, inference'de entegre edin.

Düzeltilmiş akış (Liu 2022) daha da ileri gider: giderek doğrusala daha yakın bir ODE üreten bir yeniden akış prosedürüyle yolları yinelemeli olarak düzleştirir. İki yeniden akış yinelemesinden sonra 2 adımlı örnekleyici, 50 adımlı DDPM kalitesiyle eşleşir.

## Konsept

![Akış eşleştirme: gürültü ve veri arasında düz çizgi enterpolasyonu](../assets/flow-matching.svg)

### Düz çizgi akışı

Tanımla:

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

burada `x_0 ~ data` ve `x_1 ~ N(0, I)`. Bu düz çizgi boyunca zamana göre türev sabittir:

```
dx_t / dt = x_1 - x_0
```

`v_θ(x_t, t)` sinirsel vektör alanını tanımlayın ve onu bu türevle eşleşecek şekilde eğitin:

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

Bu **koşullu akış eşleştirme** kaybıdır (Lipman 2023). Eğitim simülasyon içermez: ODE'yi asla açamazsınız. Sadece `(x_0, x_1, t)`'yi örnekleyin ve gerileyin.

### Örnekleme

inference'de öğrenilen vektör alanını zamanda *geriye doğru* entegre edin:

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

`x_1 ~ N(0, I)`'den başlayın, Euler adımlarıyla `t=0`'ye inin.

### Düzeltilmiş akış (Liu 2022)

Düz çizgi akışı çalışır ancak öğrenilen yollar *aslında düz değildir*; birçok `x_0` aynı `x_1` ile eşlenebildiği için eğridirler. Düzeltilmiş akışın yeniden akış adımı:

1. Rastgele eşleştirmelerle akış modeli v_1'i eğitin.
2. `x_1`'den v_1'i iniş `x_0`'ye entegre ederek N çifti `(x_1, x_0)`'yi örnekleyin.
3. v_2'yi bu eşleştirilmiş örnekler üzerinde eğitin. Çiftler artık "ODE uyumlu" olduğundan, aralarındaki düz çizgi enterpolantı gerçekten daha düzdür.
4. Tekrar edin.

Uygulamada 2 yeniden akış yinelemesi sizi neredeyse doğrusal hale getirerek 2-4 adımlı inference'yi etkinleştirir. SDXL-Turbo, SD3-Turbo, LCM'nin tümü akış eşleştirme modellerinden damıtılmış modellerdir.

### Bu neden 2024'te görseller açısından kazandı?

Üç neden:

1. **Simülasyonsuz eğitim** — Eğitim sırasında ODE'nin açılması yok, uygulanması önemsiz.
2. **Daha iyi kayıp geometrisi** — düz yollarda tutarlı sinyal-gürültü oranı bulunurken DDPM ε kaybı, programın kenarlarında kötü SNR'ye sahiptir.
3. **Daha hızlı inference** — SDXL-Turbo kalitesinde 4-8 adım; Tutarlılık damıtma ile 1 adım.

## Akış eşleştirme ve DDPM — tam bağlantı

Gauss koşullu bir yolla akış eşleştirmesi, *belirli bir gürültü programıyla* yayılmadır. `x_t = α(t) x_0 + σ(t) x_1` programını seçin ve akış eşleştirme, `v = α'·x_0 - σ'·x_1` ile Stratonovich tarafından yeniden formüle edilmiş difüzyonu kurtarır. İkisi Gauss yolları için cebirsel olarak eşdeğerdir.

Akış eşleştirmenin eklenen özellikleri: hedefin *netliği* (düz hız), daha temiz bir kayıp ve Gaussian olmayan enterpolantlarla deneme yapma izni.

## İnşa Et

`code/main.py`, iki modlu bir Gauss karışımı üzerinde 1 boyutlu akış eşleştirmeyi uygular. `v_θ(x, t)` vektör alanı, düz çizgi hedefiyle eğitilmiş küçük bir MLP'dir. inference'de 1, 2, 4 ve 20 Euler adımını entegre edin ve örnek kalitesini karşılaştırın.

### Adım 1: eğitim kaybı

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### Adım 2: çok adımlı inference

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### 3. Adım: adım sayılarını karşılaştırın

4 adımlı örnekleyicinin zaten 20 adımlı kaliteyle eşleşmesini bekleyin; bu, gecikme açısından büyük bir sorundur.

## Tuzaklar

- **Zaman parametrelendirmesi.** Akış eşleştirme, verilerde `t=0` ile `t ∈ [0, 1]`'yi, gürültüde `t=1`'yi kullanır. DDPM, verilerde `t ∈ [0, T]` ile `t=0`'yi, gürültüde `t=T`'yi kullanır. Aynı yön, farklı ölçek. Gazeteler bunu sürekli yanlış anlıyor.
- **Planlama seçimi.** Düzeltilmiş akışın düz çizgisi, akış eşleştirme planının ""ıdır, ancak daha iyi ölçek kapsamı için kosinüs veya logit-normal t-örneklemeyi (SD3 bunu yapar) kullanabilirsiniz.
- **Yeniden akış maliyeti.** Yeniden akış için eşleştirilmiş dataset'nin oluşturulması, örnek başına tam bir inference geçişidir. Yalnızca gerçekten 1-2 adım inference'ye ihtiyacınız olduğunda yeniden akıtın.
- **Sınıflandırıcıdan bağımsız kılavuz hâlâ geçerlidir.** Doğrusal kombinasyonda ε'yı v ile değiştirin: `v_cfg = (1+w) v_cond - w v_uncond`.

## Kullan onu

| Kullanım örneği | 2026 yığını |
|----------|-----------|
| Metinden resme, en iyi kalite | Akış eşleştirme: SD3, Flux.1-dev |
| Metinden resme, 1-4 adım | Damıtılmış akış eşleştirme: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Gerçek zamanlı inference | Akış uyumlu bir bazdan (LCM, PCM) tutarlılık damıtma |
| Ses üretimi | Akış eşleştirme: Stabil Ses 2.5, AudioCraft 2 |
| Video oluşturma | Akış eşleştirme ve yayılma karışımı (Sora, Veo, Stabil Video) |
| Bilim / fizik (parçacık yörüngeleri, moleküller) | Akış eşleştirme + eşdeğer vektör alanı |

Ne zaman bir makale 2025-2026'da "yayılmadan daha hızlı" diyorsa, bu neredeyse her zaman akış eşleştirme + damıtmadır.

## Gönderin

`outputs/skill-fm-tuner.md`'yi kaydedin. Skill, difüzyon tarzı bir model spesifikasyonunu alır ve bunu akışla eşleşen bir eğitim yapılandırmasına dönüştürür: zamanlama seçimi, zaman örnekleme dağıtımı (tek tip / logit-normal), optimize edici, yeniden akış planı, hedef adım sayısı, değerlendirme protokolü.

## Egzersizler

1. **Kolay.** `code/main.py`'yi çalıştırın ve 1 adımlı ve 20 adımlı MSE ile gerçek veri dağılımını karşılaştırın.
2. **Orta.** Tek tip `t` örneklemeden logit-normal'e geçiş yapın (örneklemeyi t'nin ortasında yoğunlaştırın). Model kalitesi artıyor mu?
3. **Zor.** Bir yeniden akış yinelemesi uygulayın: ilk modeli entegre ederek eşleştirilmiş (x_0, x_1) oluşturun, çiftler üzerinde ikinci bir modeli eğitin ve 1 adımlı örnek kalitesini karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Akış eşleştirme | "Düz hatlı difüzyon" | `v_θ(x, t)`'yi bir enterpolant boyunca `x_1 - x_0` ile eşleştirecek şekilde eğitin. |
| Düzeltilmiş akış | "Yeniden Akıt" | Öğrenilen akışları düzelten yinelemeli prosedür. |
| Hız alanı | "v_θ" | Modelin çıktısı — `x_t` hareket yönü. |
| Düz çizgi enterpolantı | "Yol" | `x_t = (1-t)·x_0 + t·x_1`; önemsiz hedef türevi. |
| Euler örnekleyici | "1. dereceden ODE çözücü" | En basit entegratör; yollar düz olduğunda iyi çalışır. |
| Logit-normal t | "SD3 örnekleme" | `t` örneklemesini gradient'lerin en güçlü olduğu orta değerlere doğru yoğunlaştırın. |
| Tutarlılık damıtma | "1 adımlı örnekleyici" | Bir öğrenciye herhangi bir `x_t`'yi doğrudan `x_0` ile eşlemesi için eğitim verin. |
| Hızla CFG | "v-CFG" | `v_cfg = (1+w) v_cond - w v_uncond`; aynı numara, yeni değişken. |

## Üretim notu: Flux.1-schnell en hızlı şekilde akış eşleştirmesidir

Akış eşleştirmenin üretim kazancı Flux.1-schnell'dir; Flux geliştirme düzeyinde kaliteyi korurken 1-4 inference adıma damıtılmış akış uyumlu bir DiT. Niels'in "Run Flux'u 8 GB'lik bir makinede çalıştır" not defteri referans deployment tarifidir: T5 + CLIP kodlaması, nicemlenmiş MMDiT gürültü giderme (schnell için 4 adımda, geliştirme için 50 adımda), VAE kod çözme. Maliyet muhasebesi:

| Varyant | Adımlar | L4'te 1024² gecikme | Toplam FLOP'lar (göreceli) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (ham) | 50 | ~15 sn | 1,0× |
| Flux.1-schnell | 4 | ~1,2 sn | 0,08× (12× daha hızlı) |
| SDXL tabanı | 30 | ~4 sn | 0,25× |
| SDXL-Yıldırım 2 adımlı | 2 | ~0,3 sn | 0,03× |

Üretim kuralı: **akış uyumlu taban + damıtma = hızlı metinden görüntüye geçiş için 2026 varsayılanı.** Her büyük satıcı bu kombinasyonu gönderir: SD3-Turbo (SD3 + akış + damıtma), Flux-schnell (Flux-dev + düzeltilmiş akış düzleştirme), CogView-4-Flash. Saf yayılma tabanları yalnızca eski kontrol noktaları için mevcuttur.

## Daha Fazla Okuma

- [Liu, Gong, Liu (2022). Düz ve Hızlı Akış: Düzeltilmiş Akışla Veri Oluşturmayı ve Aktarmayı Öğrenmek](https://arxiv.org/abs/2209.03003) — düzeltilmiş akış.
- [Lipman ve ark. (2023). Üretken Modelleme için Akış Eşleştirme](https://arxiv.org/abs/2210.02747) — akış eşleştirme.
- [Esser ve ark. (2024). Yüksek Çözünürlüklü Görüntü Sentezi için Düzeltilmiş Akış Transformer'leri Ölçeklendirme](https://arxiv.org/abs/2403.03206) — SD3, ölçekte düzeltilmiş akış.
- [Albergo, Vanden-Eijnden (2023). Stokastik İnterpolantlar](https://arxiv.org/abs/2303.08797) — FM + difüzyonunu kapsayan genel framework.
- [Song ve ark. (2023). Tutarlılık Modelleri](https://arxiv.org/abs/2303.01469) — Difüzyon/akışın 1 adımlı damıtılması.
- [Sauer ve ark. (2023). Adversarial Difüzyon Damıtma (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) — turbo çeşidi.
- [Kara Orman Laboratuvarları (2024). Flux.1 modelleri](https://blackforestlabs.ai/announcing-black-forest-labs/) — üretimde akış eşleştirme.
