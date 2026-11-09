# Gösterme ve Disket-Difüzyon Birleştirilmiş Modeller

> Transfüzyon sürekli ve ayrı temsilleri karıştırır. Show-o (Xie et al., Ağustos 2024) diğer tarafa gider: metin tokenleri sebepçi bir sonraki token tahminini kullanır, görüntü tokenleri MaskGIT ruhunda maskeli ayrı yayımı kullanır. İkisi de hibrit bir dikkat maskesine sahip bir transformatörün içinde oturuyor. Sonuç, bir omurgan, modalite başına bir tokenizer, bir kayıp formülasyonu (maskeli tahminlere uzanan bir sonraki token) üzerinde VQA, metin-resim, boyalama ve karışık modalite jenerasyonunu birleştirir. Bu ders, Show-o tasarımını  neden maskeli ayrı yayılma paralel, birkaç adımlı bir görüntü jeneratörü  ve Transfusion ve Emu3 ile karşıtlık gösterir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Maskeli ayrı yayımı açıklayın: simgelerinin bir şekilde maskelediği program, daha sonra transformatörden onları kurtarmasını ister.
- Hız ve kalite açısından paralel görüntü çözümü (Show-o, MaskGIT) ile autoregressive görüntü çözümü (Chameleon, Emu3) karşılaştırın.
- Show-o'nun tek kontrol noktasında yerine getirdiği dört görevi neyinleştirebilirsiniz: metin oluşturma, VQA, T2I, görüntü boyaması.
- Bir maskeleme programı seçin (kozin, doğrusal, kısaltılmış) ve örnek kalitesine etkisini düşünün.

## Sorun

Transfusion'un iki kaybı eğitim çalışması ancak daha karmaşık dinamiklere sahiptir.  Sürekli difüzyon kaybı ayrı NTP kaybından farklı bir sayısal ölçekte yaşar.

Show-o'nun cevabı: her iki modaliteti de ayrı tutun (Chameleon gibi), ancak sıradan değil maskeli ayrı yayılım yoluyla paralel olarak görüntüler oluşturun. Eğitim amacı, doğal olarak bir sonraki token-böyleceyi genelleştiren tek maskeli-token-böyleceye dönüşür.

## Anlaşım

### Maskeli diskre difüzyona (MaskGIT)

Orijinal Chang et al. (2022) MaskGIT hilesi zarif. Tamamen maskeli bir görüntüden başlayın (her token özel bir simge)`<MASK>`id). Her adımda, tüm maskeli jetonları paralel olarak tahmin edin, sonra en güvenli tahminleri top-K'ye tutun ve geri kalanı yeniden maskelize edin. ~ 8-16 iterasyondan sonra, tüm jetonlar doldurulur.

Eğitim basit: maskeli oranı [0, 1'den] eşit bir şekilde örnekleyin, resmin VQ simgelerine uygulayın, transformatörü maskeli simgelerden kurtarmak için eğitin. BERT'in metin için yaptığı şey, görüntü üretimi için ölçeklendirilmiştir.

### Gösterme: bir transformatör, hibrit maske

Gösterme MaskGIT'i bir nedenci dil model transformatörüne koyar.

- Metin işaretleri: sebepli (standart LLM).
- Resim jetonları: görüntü blokunun içinde tam iki yönlü (onlar maskeli jetonlar tahmin sırasında diğer tüm resim jetonlarını görebilir).
- Metin-resim: metin önceki görüntülere, görüntü önceki metine hizmet eder.

Eğitim değişimi:
1. Metin dizilerinde standart NTP.
2. T2I örnekleri: maskeli görüntü belirtileri olan metin → görüntü, maskeli belirtiler-böylece kaybı.
3. VQA örnekleri: maskeli metin işaretleri ile görüntü → metin (gerçekten sadece NTP).

Tek bir kayıp , çapraz entropi .`<MASK>`Tokens, hem metin NTP (sadece son token "maskelidir") hem de görüntü maskeli yayımı (hassasi alt kümesi maskelidir) kapsar.

### Dönüşteki örnekleme

Show-o, ~ 1000 (tekon başına otomatik gerileme) veya ~ 20 (haşlama) yerine ~ 16 adımla bir görüntü oluşturur. Her adımda, tüm maskeli jetonları paralel olarak tahmin edin; üst-K güvenini yükleyin; tekrarlayın.

Benzer şekilde:
- Chameleon / Emu3 (token üzerinde otomatik olarak geri dönük): N_tokens ileri geçişleri, tipik olarak 1024-4096 bir görüntü başına.
- Transfüzyon (daima yayılma): ~ 20 adım, her biri tam bir transformatör geçişi.
- Show-o (maskeli ayrı yayılma): ~16 adım, her biri tam bir transformatör geçişi.

Show-o benzer ölçekli modellerde Chameleon'dan daha hızlıdır ve Transfusion adım sayısına daha düşük adım maliyetleriyle (düşünçlü kelime logitleri vs sürekli MSE kaybı) yakışır.

### Tek kontrol noktasındaki görevler

Show-o, hızlı biçimle seçilen dört görevden söz eder:

- Metin oluşturma: standart autoregressive metin çıkışı.
- VQA: görüntü içeri, mesaj çıkart.
- T2I: metin içeri, görüntü maskeli ayrı yayılım yoluyla dışarı.
- Boyanma: maskeli bir görüntü, doldur.

VQ-token şebekesi bölgesini maske, geri kalanını besle ve bir metin istek, maske tokenlerini tahmin et.

### Maskeleme programı

Adım başına kaç tane simge açılması programı kaliteyi şekillendirir.

```math
\text{mask\_ratio}(t) = \cos\left(\frac{\pi t}{2T}\right) \qquad t = 0, \ldots, T
```

Adım 0, tüm simgeler maskeli (sare 1.0) Adım $T$Kosinus kütleyi orta aralığın oranlarında yoğunlaştırır ve tahminlerin en çok bilgilendirilebileceği yerlerde.

### Gösterme

Show-o2 (2025 takip, arXiv 2506.15564) ölçekleri Show-o: daha büyük LLM tabanı, daha iyi tokenizer, geliştirilmiş maske programı. Aynı mimari örneği.

### Show-o oturduğu yerde

2026 taksonomisi:

- Diskret tokenler + NTP: Kameleon, Emu3. Basit ama yavaş sonuç.
- Diskret tokenler + maskeli yayılma: Show-o, MaskGIT, LlamaGen, Muse.
- Sürekli + difüzyon: Transfüzyon, MMDiT, DiT. En yüksek kalitede, daha karmaşık eğitim.
- Bir VLM'de sürekli + akış eşleşimi: JanusFlow, InternVL-U. En yeni.

Görevler doğrultusunda seçin: T2I + boyamak + VQA'yı uygun bir hızla bir açık modelde istediğinizde gösterin; Kalite en önemli olduğunda ve iki kayıplı tesisat için para alabildiğinizde nakli.

```figure
masked-diffusion-unmask
```

## Kullan

`code/main.py`gösterme örneklemesini simüle eder:

- 16 VQ tokeni olan bir oyuncak şebekesi.
- Bir çağrı ve şu anda maskeli olmayan tokenlere dayanarak logitleri tahmin eden sahte bir "transformer".
- Paralel maskeli örnekleme 8 adım boyunca cosine programı ile.
- Orta durumları (mask örneği evrimi) ve son belirtileri yazdırır.

İndir, maskenin adım adım çözülmesini izle.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-unified-gen-model-picker.md`. Açık ağırlık kısıtlaması ile hem anlayış (VQA, başlık) hem de nesil (T2I, boyanma) gerektiren bir ürün göz önüne alındığında, Show-o ailesi, Transfusion/MMDiT ailesi ve Emu3/Chameleon ailesi arasında kesin bir pazarlık yaparak seçim yapılır.

## Egzersizler

1. 16 adımla maskeli ayrı difüzyon örnekleri. Neden 1 değil?

2. Show-o'nun boyası uzman bir modeli yendiği bir ürün kullanım durumunu (gerçek veya hipotetik) önerin.

3. Kosine planı vs. doğrusal plan: T=8 için adım başına maskeli olmayan token sayısını izleyin. Hangisi daha dengeli?

4. 512x512 gösterim görüntü 1024 simgelik.$K=16384$, model yayıyor $1024 \cdot \log_2(16384) = 14{,}336$Stabil Diffusion çıkışları 512*512*24 bit = 6.291.456 bit (~768 KiB) çiğ pikseli.

5. LlamaGen'in sınıf koşullu autoregressive görüntü modeli Show-o'nun maskeli yaklaşımından nasıl farklıdır?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Training to predict masked tokens; at inference, iteratively unmask the most-confident predictions |
| Cosine schedule | "Unmask schedule" | Decay of mask ratio over inference steps; concentrates confidence growth at mid-range |
| Parallel decoding | "All tokens at once" | Every step predicts the full sequence of masked tokens in one forward pass, then commits top-K |
| Hybrid attention | "Causal + bidirectional" | Mask that is causal over text tokens and bidirectional within image blocks |
| Inpainting | "Fill-in generation" | Condition on an image with some tokens masked, predict the missing ones; free from the training objective |
| Commitment rate | "Top-K per step" | How many tokens are declared "done" per iteration; controls inference vs quality trade-off |

## Daha Fazla Okumak

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
