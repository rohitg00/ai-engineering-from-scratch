# Janus-Pro: Birleştirilmiş Multimodal Modeller için Çıkarılmış Kodlayıcılar

> Birleştirilmiş multimodal modeller kaçınılmaz bir gerginliğe sahiptir. Anlamak anlamlı özellikler ister  SigLIP veya DINOv2 konsept düzeyde bilgi zengin çıkış vektörleri. Genre yeniden inşa etmek için dostu kodlar istiyor. VQ tokenleri, tekrar net piksellere dönüştürülür. İki hedef tek bir kodlama ile uyumlu değil. Janus (DeepSeek, Ekim 2024) ve Janus-Pro (DeepSeek, Ocak 2025) çözümün denemeyi bırakmak olduğunu iddia ediyor: iki kodlayıcıyı kopartma. Transformer vücudu görevler arasında paylaşın, ancak SigLIP ile yol anlayışı ve VQ tokenizer aracılığıyla üretim. 7B'de, Janus-Pro, GenEval'de DALL-E 3'ü yenerken MMMU'da LLaVA'ya eşleşir. Bu ders, iki kodlamanın neden birinde başarısız olduğu konusunda açıklıyor.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Tek paylaşılmış kodlayıcı neden anlayışa veya üretim kalitesine zarar vereceğini açıklayın.
- Janus-Pro'nun yönlendirmeyi açıklayın: Anlama için giriş tarafında SigLIP özellikleri, giriş ve çıkış için VQ jetonları.
- Janus Pro'nun başarısız olduğu yerlerde, Janus'un başarısını sağlayan veri karışımının ölçeklenmesini izleyin.
- Kopyalaşmamış (Janus-Pro), kopyalı-daima (Transfusion) ve kopyalı-diskre (Show-o) mimarlıkları karşılaştırın.

## Sorun

Birleştirilmiş modeller, anlayış ve nesne boyunca bir transformatör vücudu paylaşır. Önceki girişimler (Chameleon, Show-o, Transfusion) her ikisi de iki yön için bir görsel tokenizer kullanır. Tokenizer bir uzlaşma:

- Yeniden inşa (genreasyon) için optimize edilmiş: VQ-VAE ince çekirdeği piksel ayrıntılarını yakalar, ancak zayıf semantik tutarlılıklı jetonlar üretir.
- Semantik için optimize edilmiş (anlama): SigLIP yerleştirmeler "cat" simgelerinin yakınında "cat" resimlerini gruplandırır, ancak iyi bir yeniden yapılandırmaya izin vermez.

Show-o ve Transfusion bunun için bir yönde görünür bir kalite vergisi ile ödeme yaparlar. Janus-Pro soruyor: görevlerin farklı ihtiyaçları olduğunda neden tek bir tokenizer gerektiren?

## Anlaşım

### Çıkarılmış görsel kodlama

Janus-Pro'nun mimarisi iki kodlayıcıyı ayırır:

- Yolu anlamak. Giriş görüntüsü → SigLIP-SO400m → 2 katlı MLP → transformatör vücudu.
- Üretim yolu. Giriş görüntü (var olan bir görüntü üzerinde koşullandırma yapılırsa) → VQ tokenizer → token IDs → transformatör vücudu.
- Çıktı jenerasyonu. Transformatör → VQ dekoder → piksel tarafından öngörülen görüntü belirtileri.

Transformer vücudu paylaşılan. Vücudun akıntı ve aşağı akımındaki her şey görev-özel.

Girdiler, hızlı biçimle belirsizleştirilmiştir: a `<understand>`SigLIP üzerinden rotaları işaretle .`<generate>`Ya da görevden dolayı yollama yapılır.

### Neden işe yarıyor?

Kayıp anlama, CLIP tarzı öncesi eğitiminin semantik benzerlik için ayarladığı SigLIP özelliklerini alır.

Genre kaybı, bir tokenizer tarafından yeniden oluşturulmak için ayarlanmış VQ jetonları alır.

Paylaşılan transformatör vücudu iki giriş dağıtımını görür (SigLIP ve VQ) ve her ikisiyle de çalışmayı öğrenir.

### Veri ölçeklendirme  Janus vs Janus-Pro

Janus (orjinal, arXiv 2410.13848) çözülmeyi başlattı ancak küçük ölçekte (1.3B parametreleri, sınırlı veri).

- 7B paramları (1.3B karşılığı).
- Etap 1 (ağırış) için 90M görüntü-metin çiftleri 72M'den yukarı.
- 72M'den 26M'ye kadar 2. aşama (birleştirilmiş) için.
- 3. aşama için 200k görüntü-gen talimat örneği eklendi.

Sonuç: Janus-Pro-7B MMMU'da LLaVA'ya (60.3 vs ~58) eşleşir ve GenEval'de DALL-E 3'yi (0.80 vs 0.67) yenir.

### JanusFlow  düzeltilmiş akış varianti

JanusFlow (arXiv 2411.07975) VQ üretim yolunu düzeltilmiş akış üretim yolu (daima) ile değiştirir. Bölüm anlama için SigLIP + düzeltilmiş akış için nesil olur. Kalite tavanları daha da yükselmektedir. Arsitekür kopyalanmış-kodlayıcı- paylaşılan vücut olarak kalır.

### Paylaşılan bir bedenin işi

Transformer vücudu, tek bir dizi işlemini yapar ancak iki giriş dağıtımıyla.

- Anlamak için: SigLIP özelliklerini tüket + metin işaretleri → metin autoregressively yayımlayın.
- Üretim için: metin jetonlarını tüket + (ayrıca görüntü VQ jetonları) → otomatik olarak görüntü VQ jetonlarını yayın.

Blok başına belirli ağırlıklara sahip değil. Bu, Qwen veya Llama'nın içinde bulduğunuz metin tarzında bir transformatör ve iki giriş adaptörü.

İlginçtir ki, bu Janus-Pro'nun vücudunun önceden eğitilmiş bir LLM'den initialize edilebileceği anlamına gelir. Janus-Pro DeepSeek-MoE-7B'den initialize eder. Bu seçim önemlidir: LLM, sıfırdan saf birleşik modellerin ulaşmak için mücadele ettiği mantık yeteneğine katkıda bulunur.

### InternVL-U ile karşılaştırıldığında

InternVL-U (Desin 12.10) 2026 takipidir.

- Doğal multimodal öncesi eğitim (InternVL3 omurgası).
- Çıkarılmış kodlayıcı yönlendirme (SigLIP içeri, VQ + yayılma çıkışları).
- Tek bir anlayış + jenerasyon + düzenleme.

InternVL-U, Janus-Pro'nun mimari seçimini daha büyük bir çerçeveye dahil eder.

### Sınırlamalar

Çıkarılmış kodlayıcılar mimari karmaşıklığı artırır. Eğitmek için iki tokenizör, korumak için iki giriş yolu, iki set başarısızlık modu. Yürütme gerektirmeyen ürünler için Janus-Pro aşırı mühendislik yapılmıştır.

Anlayış gerektirmeyen ürünler için Janus- Pro aşırı derecede nitelikli  Stable Diffusion 3 / Flux modeli seçin.

Her ikisine de ihtiyaç duyan ürünler için, Janus-Pro artık referans açık mimarlık.

```figure
l5-janus-decouple
```

## Kullan

`code/main.py`Janus-Pro yönlendirmeyi simüle eder:

- İki sahte kodlayıcı: SigLIP benzeri (256-dimensiyonlu semantik vektörler üretir) ve VQ benzeri (tam sayı kodları üretir).
- Bir görev etiketine göre kodlayıcıyı seçen bir kılavuz.
- Hangi kodlayıcı tarafından üretildiğine bakılmaksızın token dizilerini işleyen ortak bir vücut (stand-in).
- 1. aşamalı (ağırlama) ve 3. aşamalı (özet sesi) ağırlıklı örnek programından geçiş.

3 örneğe yönlendirilmiş yolları basın: görüntü QA, T2I, görüntü düzenleme.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-decoupled-encoder-picker.md`. Ürününün sınırlı kaliteye sahip bir jenerasyon + anlayış isteyen bir ürün olduğu için, Janus-Pro, JanusFlow veya InternVL-U'yu, belirli bir veri ölçeği önerisi ile seçer.

## Egzersizler

1. Janus-Pro-7B, GenEval'de DALL-E 3'ü yener. 7B açık modelinin neden nesil açısından sınırlı özel modelle eşleşebileceğini, ancak anlayış açısından neden eşleşebileceğini açıkla.

2. Bir yönlendirme işlevi uygulayın: verilen tescil metni,  olarak sınıflandırın`understand`veya `generate`"Böylece anlat ve sonra çiz" gibi belirsiz istekleri nasıl ele alırsın?

3. JanusFlow, VQ yolunun yerini düzeltilmiş akışla değiştirir. Transformatör vücudu şimdi ne çıkarır ve kayıpta ne değişiklikler olur?

4. Janus-Pro mimarisi bir daha kopyalanmış kodlayıcı ile halledebilecek dördüncü bir görevi önerin. Örnekler: görüntü segmentasyonu (DINO tarzı), derinlik (MiDaS tarzı).

5. Janus-Pro Bölümü 4.2'yi okuyun. Verilerin ölçeklenmesi. T2I kalitesi kazanımına en çok hangi verilerin katkı sağladığı Janus ile karşılaştırıldığında?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | Separate tokenizer or encoder per direction: semantic for understanding, reconstruction for generation |
| Shared body | "One transformer" | Single transformer processes either encoder's output; no modality-specific weights |
| SigLIP for understanding | "Semantic features" | CLIP-family vision tower providing rich conceptual features but poor reconstruction |
| VQ for generation | "Reconstruction codes" | Vector-quantized tokens that decode cleanly back to pixels |
| JanusFlow | "Rectified-flow variant" | Janus-Pro with a continuous flow-matching generation head instead of VQ |
| Routing tag | "Task tag" | Prompt marker (`<understand>` / `<generate>`) that picks the input encoder |

## Daha Fazla Okumak

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
