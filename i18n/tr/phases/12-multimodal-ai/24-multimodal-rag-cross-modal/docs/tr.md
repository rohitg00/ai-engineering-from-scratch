# Multimodal RAG ve Cross-Modal Retrieval

> Görüş-doğal belge RAG bir parça. Üretim multimodal RAG daha geniş bir alanı açar. Bu süreçte seyahat planlaması ("doğal ışıkla sakin bir vegan brunch bul") gibi iş akımları için metin, görüntü, ses ve video alınır. Üç 2025 anketleri  Abootorabi et al., Mei et al., Zhao et al.  alt sorunları kodlaştırdı: çapraz modal geri alım, geri alım birleşimi, üretim yerleştirme, multimodal değerlendirme. Bu ders, anketleri okur ve üretim borusunu tasarlar.

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator), TypeScript
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Modal çaplı çekim tasarımı: metin → resim, resim → metin, ses → video vb.
- Üç füzyon stratejisini karşılaştırın: puan füzyonu, dikkat tabanlı füzyon, MoE füzyonu.
- Nesil yerleştirmesini açıklayın: kaynaklar bir karışım modaliteler olduğunda "aykın kaynaklarınızı alıntılamak" nasıl görünüyor.
- 2025'te yapılan üç kanonik multimodal RAG anketinin ve alt sorun taksonomlarının adını verin.

## Sorun

Tek modal RAG çözülmüş bir örnektir: göm sorgu, göm parçalar, geri almak, LLM'ye eşyalar.

1. Çoklu çekim başları (her modalite uyumlu bir alanda yerleştirilmelidir).
2. Arama sonuçlarının modaletler arasında birleşmesi.
3. Modeller arasında kaynakları belirleyen nesil yerleşimi.
4. Modal çaplı sinyalleri kapsayacak değerlendirme ölçümleri.

2025 anketleri hepsi aynı taksonomide.

## Anlaşım

### Modal çaplı çekim

A. Modalite sorgulaması ile B modalite belgelerini alın. Üç örneği:

1. Paylaşılan yerleştirme alanı. CLIP ve CLAP paylaşılan bir alanda metin + görüntü / metin + ses yerleştirmeleri üretir. Modaliteler arasında kozine benzerliği doğrudan çalışır. CLIP eğitilmiş çiftlere sınırlıdır.

2. Per-modality kodlayıcı + çevirim. Metin kodlayıcı + görüntü kodlayıcı + küçük bir çevirmen modülü boşluklar arasında haritası. Sen2Sen by Gupta et al. ve diğer 2024 tasarımları. Eğlenceli ancak karmaşıklığı artırır.

3. VLM'nin desteklediği her modalite işe yarıyor. Daha yüksek kalite, daha pahalı.

Seçim: Metin + Resim için CLIP / SigLIP 2; Metin + Ses için CLAP; Sınır kalitesi ile çapraz modal için VLM-gizli durumlar.

### Füzyon stratejileri

10 sonuç aldınız: 5 görüntü, 3 metin pasajı, 2 ses klipi. Nasıl birleştiriyorsunuz?

Skor füzyonu (en ucuz). Her modalitetin kendi retriever'i vardır, her biri puanlar verir.

Dikkat tabanlı bir birleşim. Tüm alınan eşyaları birleştirin, küçük bir dikkat ağının ağırlığını almasına izin verin.

MoE birleşimi. Modalite-specifik uzmanlara ağ yollarını açmak. Farklı sorgu türleri farklı yönlendirir  görsel bir soru görüntülerin daha yüksek ağırlık taşıdığı bir sorgu.

Üretim standart: sorunun baskın modaliteye karşı hafif bir önyargı ile puan birleşimi. A / B alanınızda açık kazanç gösterirse MoE'ye yükseltin.

### Nesil yerleştirme

LLM, her bir talebi hangi alınmış maddeyle yönlendirdiğini belirtmelidir.

- Metin kaynağı: standart alıntı `[1]`- Evet .
- Resim kaynağı: `[img 3]`Kısa bir başlıklı.
- Ses: `[audio 2 at 0:34]`- Evet .

Yükleme bilgisi ile jeneratörü eğit: eğitim hedefinin her iddiası kaynak indeksle etiketlenir.

### 2025 anketleri

Abootorabi et al. (arXiv:2502.08826, "Herhangi bir Modalite'de Sorun"): multimodal RAG için taksonom. Geri alınma, füzyon, jenerasyon kapsamaktadır. En geniş kapsam.

Mei et al. (arXiv:2504.08748, "Multimodal RAG'nin Bir Anket"): alt görev referans değerlerine ve başarısızlık modlarına odaklanır.

Zhao et al. (arXiv:2503.18016): vizyon odaklı anket.

Üçünü de okuduktan sonra 2025 baharına kadar en son gelişmeleri göreceksiniz.

### MuRAG  temel kağıt

MuRAG (Chen et al., 2022) ilk multimodal RAG'di. Bir multimodal KB'den görüntü + metin alınarak cevaplar üretildi. VLM dalgasından önce uygulanabilirliği gösterdi. Modern sistemler (REACT, VisRAG, M3DocRAG) buna dayanıyor.

### Üretim seyahat planlaması örneği

Sorum: "Bana doğal ışıkla sessiz bir vegan kahvaltı bul".

Kök hattı:

1. Sorguyu parçala. "sessiz" → sesli / inceleme anahtar kelime; "veyan brunch" → menü öğesi; "doğal ışık" → görüntü özelliği.
2. Modalite başına geri alın:
   - Yorumlar için metin alınması: "Vegan brunch, sakin ortam".
   - Restoran fotoğraflarından görüntü alımı: "Doğal ışık, hava".
   - Çevre ses klipleri üzerinde ses çıkarma: "Uzun decibel, müzik yok".
3. Her restoranın bileşik puanları var.
4. Top-k restoranlar → VLM jeneratörü tüm kanıtlarla → cevap alıntılarla.

Bu, metin-RAG'den çok daha fazlasıdır. Her modalitenin tek başına metin kaçırdığı bir sinyal eklenir.

### Ajantik multimodal RAG

Multi-hop: ilk arama yüksek güvenle cevap vermezse, LLM yeniden formüle eder ve tekrar alır.

- İlk top-10'u geri alın → LLM "çok gürültülü, <40 dB'lik filtre" → yeniden alın.
- Resimleri geri alın → LLM bir menü var görüyor → menü metnini geri alın → cevap.

Karmaşıklık ekler ama tek çekimle geri alınamayan sorularla ilgilenir.

### Değerlendirme

Modal çaplı değerlendirme henüz olgunlaşmamış.

- Her modaliteye göre hatırlatma.
- Top-k doğruluğu.
- İnsan tarafından değerlendirilmiş son-son tatmin edici.
- Görev-özel (tüm rezervasyonlar tamamlandı, satın alınmıştır).

Standart bir referans değeri tüm yöntemleri kapsamamaktadır.

```figure
contrastive-matrix
```

## Kullan

`code/main.py`- ...

- Ortak restoranlar üzerinde çalışan üç sahte retriever (metin, görüntü, ses).
- Modalite puanlarını yapılandırılabilir ağırlıklar ile birleştiren puan birleşimi.
- Son cevabı alıntılarla yayınlayan bir jeneratör.
- Güven düşükse soruyu yeniden formüle eden basit bir ajanik döngü.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-multimodal-rag-designer.md`Multimodal sorgu akışı olan bir ürün özellikine göre, retriever, füzyon, jeneratör ve değerlendirme tasarımı.

## Egzersizler

1. Tıbbi-triage multimodal RAG önerin: sorgu = yaralanma fotoğrafı + metin semptomları. Hangi modaliteleri hangi KB'den elde etmek?

2. Skor füzyonu basit bir ağırlıklı toplamdır. MoE füzyonu kaçınılması için hangi başarısızlık moduna sahip?

3. Abootorabi et al.'ın taksonomisi (Bölüm 3) okuyun. Üç kanonik alt sorununun adı nedir ve seçtiğiniz ürüne nasıl haritası yapılır?

4. Trip-planner multimodal RAG için bir eval spesifikasyonu tasarlayın.

5. Agent Multi-Hop RAG'de geri dönüş için gecikme vergisi vardır. Hangi sorgu zorluğu doğruluk kazanımını gecikmeyi haklı çıkarır?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | Text query retrieves images; image query retrieves text; requires a shared space or translator |
| Score fusion | "Combine scores" | Weighted sum of per-modality retrieval scores; simplest fusion |
| MoE fusion | "Modality-routed experts" | Gating network picks which modality's scores to trust per query |
| Grounded generation | "Cite your sources" | Each claim in the answer tagged with the source index |
| MuRAG | "First multimodal RAG" | 2022 paper that established the multimodal RAG pattern |
| Agentic multi-hop | "Reformulate and retry" | LLM re-queries retrievers when first-pass confidence is low |

## Daha Fazla Okumak

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
