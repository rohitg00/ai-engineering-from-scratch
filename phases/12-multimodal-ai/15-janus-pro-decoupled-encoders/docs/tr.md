# Janus-Pro: Birleşik Multimodal Modeller için Ayrılmış Kodlayıcılar

> Birleşik multimodal modellerin kaçınılmaz bir gerilimi vardır. Anlamak, anlamsal özellikler gerektirir - kavram düzeyinde bilgiler açısından zengin SigLIP veya DINOv2 çıktı vektörleri. Nesil, yeniden yapılandırma dostu kodlar istiyor; yeniden net piksellere dönüşen VQ token'ler. İki hedef tek bir kodlayıcıda uyumlu değildir. Janus (DeepSeek, Ekim 2024) ve Janus-Pro (DeepSeek, Ocak 2025), çözümün denemeyi bırakmak olduğunu savunuyor: iki kodlayıcıyı ayırın. transformer gövdesini görevler arasında paylaşın, ancak anlayışı SigLIP aracılığıyla ve oluşturmayı bir VQ tokenizer aracılığıyla yönlendirin. Janus-Pro, 7B'de GenEval'de DALL-E 3'ü yenerken, MMMU'da LLaVA ile eşleşiyor. Bu derste, biri başarısız olduğunda iki kodlayıcının neden çalıştığı anlatılmaktadır.

**Tür:** Yapım
**Diller:** Python (stdlib, çift kodlayıcılı yönlendirme + paylaşılan gövde sinyali)
**Önkoşullar:** Aşama 12 · 13 (Transfüzyon), Aşama 12 · 14 (Gösteri)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Tek bir paylaşılan kodlayıcının neden anlama veya üretim kalitesinden ödün verdiğini açıklayın.
- Janus-Pro'nun yönlendirmesini açıklayın: Anlamak için giriş tarafında SigLIP özellikleri, üretim için hem giriş hem de çıkışta VQ token'ler.
- Janus'un başaramadığı yerde Janus-Pro'nun başarılı olmasını sağlayan veri karışımı ölçeklendirmesinin izini sürün.
- Ayrılmış (Janus-Pro), birleşik-sürekli (Transfüzyon) ve birleşik-ayrık (Show-o) mimarileri karşılaştırın.

## Sorun

Birleşik modeller, anlama ve oluşturma açısından bir transformer gövdesini paylaşır. Önceki denemelerin (Bukalemun, Show-o, Transfüzyon) tümü her iki yön için tek bir görsel tokenizer kullanıyor. tokenizer bir uzlaşmadır:

- Yeniden yapılandırma (oluşturma) için optimize edilmiştir: VQ-VAE, ince taneli piksel ayrıntılarını yakalar ancak zayıf anlamsal tutarlılığa sahip token'ler üretir.
- Anlambilim (anlama) için optimize edilmiştir: SigLIP embedding'ler "kedi" görüntülerini "kedi" token'lerin yakınında gruplandırır ancak iyi bir yeniden yapılanmaya izin vermez.

Show-o ve Transfusion bunun bedelini tek yönde gözle görülür bir kalite vergisiyle ödüyor. Janus-Pro şunu soruyor: Görevlerin farklı ihtiyaçları varken neden bir tokenizer'ye ihtiyaç duyasınız ki?

## Konsept

### Ayrıştırılmış görsel kodlama

Janus-Pro'nun mimarisi iki kodlayıcıyı ayırır:

- Yolu anlamak. Giriş görüntüsü → SigLIP-SO400m → 2 katmanlı MLP → transformer gövdesi.
- Nesil yolu. Giriş görüntüsü (mevcut bir görüntü üzerinde koşullandırılıyorsa) → VQ tokenizer → token Kimlikleri → transformer gövdesi.
- Çıkış üretimi. transformer → VQ kod çözücü → pikseller tarafından tahmin edilen görüntü token'ler.

transformer gövdesi paylaşılıyor. Vücudun yukarı ve aşağı yönündeki her şey göreve özeldir.

Girişler prompt formatıyla netleştirilir: bir `<understand>` etiketi SigLIP aracılığıyla yönlendirilir; `<generate>`, VQ üzerinden yönlendirilir. Veya yönlendirme görevden örtülüdür.

### Bu neden işe yarıyor?

Kaybı anlamak, CLIP tarzı ön eğitimin anlamsal benzerlik için ayarladığı SigLIP özelliklerini alır. Modelin benchmark algısı Show-o / Transfusion'a göre daha iyi çünkü giriş özellikleri görev için daha iyi.

Nesil kaybı, bir tokenizer'nin yeniden yapılandırma için ayarladığı VQ token'leri alır. VQ kodları pikselleri temiz bir şekilde oluşturduğundan görüntü kalitesi Show-o'ya göre daha iyi olur.

Paylaşılan transformer gövdesi iki giriş dağılımını (SigLIP ve VQ) görür ve her ikisiyle de çalışmayı öğrenir. İddia: yeterli veri + yeterli parametre, vücut değişimi emer.

### Veri ölçeklendirme — Janus ve Janus-Pro

Janus (orijinal, arXiv 2410.13848) ayrıştırmayı tanıttı ancak küçük ölçekte (1.3B parametreleri, sınırlı veriler). Janus-Pro (arXiv 2501.17811) ölçekli:

- 7B parametreleri (1.3B'ye kıyasla).
- Aşama 1 (hizalama) için 72M'den 90M görüntü-metin çifti.
- Aşama 2 için (birleşik) 26M'den 72M'ye yükseldi.
- 3. aşama için 200 bin görüntü oluşturma talimat örneği eklendi.

Sonuç: Janus-Pro-7B, MMMU'da LLaVA ile eşleşiyor (60,3'e karşı ~58) ve GenEval'de DALL-E 3'ü geçiyor (0,80'e karşı 0,67). Birleşik yelpazenin her iki tarafında da rekabetçi, açık bir model.

### JanusFlow — düzeltilmiş akış çeşidi

JanusFlow (arXiv 2411.07975), VQ oluşturma yolunu düzeltilmiş akış oluşturma yolu (sürekli) ile değiştirir. Bölünme, anlama için SigLIP + nesil için düzeltilmiş akış haline gelir. Kaliteli tavanlar daha da yükselir. Mimari, ayrıştırılmış kodlayıcılar-paylaşılan gövde olarak kalır.

### Paylaşılan vücudun görevi

transformer gövdesi birleşik bir diziyi ancak iki giriş dağıtımıyla işler. Görevi şudur:

- Anlamak için: SigLIP özelliklerini kullanın + token metinlerini kullanın → metni otomatik regresif olarak yayınlayın.
- Oluşturma için: token metinlerini tüketin + (isteğe bağlı görüntü VQ token'ler) → VQ token görüntülerini otomatik regresif olarak yayınlayın.

Gövdenin blok başına modaliteye özgü ağırlığı yoktur. Bu, Qwen veya Llama'da bulmayı beklediğiniz metin stili transformer ve ayrıca iki giriş bağdaştırıcısıdır.

İlginç bir şekilde bu, Janus-Pro'nun gövdesinin önceden eğitilmiş bir LLM'den başlatılabileceği anlamına geliyor. Janus-Pro, DeepSeek-MoE-7B'den başlatılır. Bu seçim önemlidir: Yüksek Lisans, sıfırdan bütünleşik modellerin ulaşmaya çalıştığı muhakeme yeteneğine katkıda bulunur.

### InternVL-U ile karşılaştırıldığında

InternVL-U (Ders 12.10) 2026'nın devamıdır. Şunları birleştirir:

- Yerel multimodal ön eğitim (InternVL3 omurgası).
- Ayrılmış kodlayıcı yönlendirme (SigLIP giriş, VQ + difüzyon çıkışları).
- Birleşik anlayış + oluşturma + düzenleme.

InternVL-U, Janus-Pro'nun mimari seçimini daha büyük bir framework'de birleştirir. Ayrıştırılmış kodlayıcı fikri artık geniş ölçekte birleştirilmiş modeller için varsayılandır.

### Sınırlamalar

Ayrılmış kodlayıcılar mimari karmaşıklığı artırır. Eğitilecek iki tokenizer, bakımı yapılacak iki giriş yolu, iki arıza modu seti. Üretime ihtiyaç duymayan ürünler için Janus-Pro aşırı mühendislik ürünüdür; LLaVA ailesi anlayış modelini seçin.

Anlaşılması gerekmeyen ürünler için Janus-Pro fazla niteliklidir; Stabil Difüzyon 3 / Flux modelini seçin.

Her ikisine de ihtiyaç duyan ürünler için Janus-Pro artık referans açık mimaridir.

## Kullan onu

`code/main.py`, Janus-Pro yönlendirmesini simüle eder:

- İki sahte kodlayıcı: SigLIP benzeri (256-dim anlamsal vektörler üretir) ve VQ benzeri (tam sayı kodları üretir).
- Kodlayıcıyı görev etiketine göre seçen bir prompt yönlendirici.
- token dizilerini hangi kodlayıcının ürettiğine bakılmaksızın işleyen, paylaşılan bir gövde (yedek).
- Aşama 1'den (hizalama) aşama 3'e (talimat melodisi) ağırlıklı örnek çizelgesine geçiş.

3 örnek için yönlendirilmiş yolları yazdırın: görüntü QA, T2I, görüntü düzenleme.

## Gönderin

Bu ders `outputs/skill-decoupled-encoder-picker.md`'yi üretir. Sınır ötesi kalitede birleşik üretim + anlayış isteyen bir ürün göz önüne alındığında, somut bir veri ölçeği önerisiyle Janus-Pro, JanusFlow veya InternVL-U'yu seçer.

## Egzersizler

1. Janus-Pro-7B, GenEval'de DALL-E 3'ü yendi. Bir 7B açık modelinin neden üretim açısından öncü bir özel modelle eşleşebildiğini, ancak anlama açısından eşleşemediğini açıklayın.

2. Bir yönlendirici işlevi uygulayın: prompt metni verildiğinde, `understand` veya `generate` olarak sınıflandırın. "Açıkla ve sonra çiz" gibi belirsiz prompt'leri nasıl ele alırsınız?

3. JanusFlow, VQ yolunu düzeltilmiş akışla değiştirir. transformer gövdesi şimdi ne çıktı veriyor ve kayıpta ne gibi değişiklikler oluyor?

4. Janus-Pro mimarisinin bir tane daha ayrıştırılmış kodlayıcıyla yerine getirebileceği dördüncü bir görev önerin. Örnekler: görüntü segmentasyonu (DINO tarzı), derinlik (MiDaS tarzı).

5. Veri ölçeklendirmeyle ilgili Janus-Pro Bölüm 4.2'yi okuyun. Janus'a kıyasla T2I kalite kazanımına en çok hangi veri aşaması katkıda bulunuyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Ayrılmış kodlama | "İki görsel kodlayıcı" | Yön başına ayrı tokenizer veya kodlayıcı: anlama için semantik, oluşturma için yeniden yapılandırma |
| Paylaşılan gövde | "Bir transformer" | Tek transformer her iki kodlayıcının çıkışını işler; modaliteye özel ağırlık yok |
| Anlamak için SigLIP | "Anlamsal özellikler" | CLIP ailesi görüş kulesi, zengin kavramsal özellikler sağlar ancak kötü yeniden yapılanma sağlar |
| Nesil için VQ | "Yeniden yapılanma kodları" | Temiz bir şekilde piksellere geri dönüş yapan vektör nicemli token'ler |
| JanusFlow | "Düzeltilmiş akışlı varyant" | VQ yerine sürekli akış uyumlu üretim kafasına sahip Janus-Pro |
| Yönlendirme etiketi | "Görev etiketi" | Giriş kodlayıcısını seçen Prompt işaretçisi (`<understand>` / `<generate>`) |

## Daha Fazla Okuma

- [Wu ve ark. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen ve ark. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma ve ark. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong ve diğerleri. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
