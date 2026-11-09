# InternVL3: Yerli Multimodal Eğitim

> InternVL3'den önceki her açık VLM aynı üç adımlı tarifi izledi: trilyonlarca metin tokeni üzerinde eğitilmiş bir metin LLM alın, bir görme kodleyicisine bağlanın, sonra dikişleri ince ayarlayın. Bu işlevsel ama uyum borcudur  metin LLM tüm eğitim öncesi bütçesini saf metin için harcadı ve görsel tokenleri doğuştan anlamıyor. Görüş sonrası eklediğinizde, LLM'nin metni unutmadan görsel girişleri metin mantıklarına nasıl bağlayacağını yeniden öğrenmesi gerekir. InternVL3 (Zhu et al., Nisan 2025) post-hoc yaklaşımını reddediyor: bir antrenman öncesi koşusu, bir adımdan beri birbirine karışan metin ve multimodal. Sonuç, MMMU-Pro'da Gemini 2.5 Pro'yla 78B param açık. Bu ders, yerli önceden eğitim için olan durum ve bunu yaptığınızda neler değiştiğini anlatır.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Post-hoc VLM eğitiminin neden üç ölçülebilir semptomı (kazahatli unutma, cevap sürüşü, görsel-metin tutarlılığı) belirterek uyum borcunu biriktirdiğini açıklayın.
- InternVL3'ün yerel antrenman öncesi corpus karışımını ve metin oranının neden önemli olduğunu açıklayın.
- V2PE (değişken görsel pozisyon kodlaması) ile Qwen2-VL'nin M-RoPE'si karşılaştırın.
- Görsel Kararlılık Router (ViR) ve Çıkarılmış Görme-Dil (DvD) dağıtım optimizasyonlarını isimlendirin.

## Sorun

Post-hoc VLM eğitimleri varsayılan bir yöntemdir. LLaVA, BLIP-2, Qwen-VL, Idefics  hepsi önceden eğitilmiş bir LLM (Llama, Vicuna, Qwen, Mistral) alır ve görme ekler. Eğitim aşamaları tipik olarak şöyle görünür:

1. Dondurulmuş LLM + dondurulmuş görme kodlayıcısı + eğitimli projektor, gömülmeleri düzeltmek için başlık çiftlerinde eğitilmiştir.
2. LLM'yi dondurma, eğitim verileri üzerine eğitim (LLaVA-Instruct, ShareGPT4V).
3. Seçeneğe göre görev özel ince ayarlama.

Düzeltme borcunun üç semptomı ortaya çıkıyor:

- Katastrofal unutma. Post-hoc VLM sadece metin becerilerini unutur. GSM8K puanları 5-10 puan düşer. Hellaswag puanları düşer. Temiz metin ajanları geri döner.
- Aynı görsel sorunun küçük ifadeleri farklı cevaplar alır. Görsel kodlayıcı LLM'nin kendi tokenlerinden daha zayıf bağlarla LLM'ye bağlanır.
- VLM bir resmi doğru bir şekilde tanımlayabilir ve ardından kendi açıklamasına aykırı bir soruya cevap verebilir. Görsel jetonlar LLM'nin iç tutarlılık kontrollerine metin gibi katılmaz.

Bu semptomlar iyi belgelenmiştir. MM1.5 Bölüm 4 onları ölçüyor. LLaVA-OneVision'ın ablationları onlara işaret ediyor.

## Anlaşım

### Doğal multimodal öncesi eğitim

InternVL3 başlangıçtan itibaren bir korpus üzerinde çalışmaktadır.

- %40 tek metin verileri (FineWeb, Proof-Pile-2, vb.)
- %35 birbirine karışmış görüntü-metin verileri (OBELICS, MMC4 tarzı)
- % 20 çiftleştirilmiş görüntü başlıklı veriler
- %5 video metin verileri

Görme simgelerinin, metin simgelerinin ve modal çapraz etkileşimlerin hepsi ilk gradient adımından itibaren aynı kayıpta yer alıyor.

Eğitim temel model için tek bir aşamadır. Eğitim ayarlaması takip eder, ancak temel model zaten görsel jetonları birinci sınıf vatandaşlar olarak anlar.

### V2PE (değişken görsel pozisyon kodlaması)

Qwen2-VL, sabit eksel tahsisli M-RoPE kullanır. InternVL3 V2PE'yi tanıttı: pozisyon kodlaması, öğrenilebilir ölçeklendirme ile modalite türüne (metin, görüntü, video) göre değişir.

- Metin işaretleri 1 boyutlu konum alırlar (metin indeksleri).
- Resim yamaları 2 boyutlu konum elde eder (sır, sütun).
- Video çerçeveleri 3 boyutlu konum alırlar (zaman, satır, kol).

Üçü aynı RoPE frekans tabanını paylaşır, ancak her bant için gizli-dim tahsis edilmesi sabit bir bölünme yerine öğrenilmiş bir parametredir.

V2PE'nin ablasyon iddiası: Aynı hesaplama sırasında M-RoPE'ye göre video referansları için 1-2 puan.

### Görsel çözünürlük yönlendiricisi (ViR)

Uygulama optimizasyonu. Tüm görüntülerin tam çözünürlüklü kodlama gerektirmemesi gerekir. Düşük detaylı bir nesne ile bir fotoğraf, 1280px yerli kodlandığında jetonları atır. ViR, soruyu cevaplamak için gerekli olan en az çözünürlüğü kodlamadan önce tahmin eden küçük bir sınıflandırıcıdır.

Routing üç katı: düşük çözünürlüklü (256 token), orta (576), yüksek (2048+). Üretim trafiğinde sorguların %60'ı için düşük veya orta yeterlidir. Net etki: eşit kalitede 2-3x geçiş.

### İlişkilendirilen Görme-Dil (DvD) dağıtım

Büyük bir VLM'ye hizmet verdiğinizde, görüntü kodlayıcı bir görüntü başına bir kez çalışır ancak LLM her çıkış jetonu için autoregressively çalışır. İki bileşen farklı şişlik boynuzları vardır (görüş = GPU bellek bant genişliği için conv + dikkat; LLM = KV önbelleği).

8B + 400M kodlayıcı modeli için, DvD, düğüm başına çıkış oranı ile birlikte yerleşik oranı yaklaşık olarak ikiye katlanır.

### Tek aşamalı vs. çok aşamalı kalite

InternVL3'in ana referans iddiası: 78B paramlarda, Gemini 2.5 Pro'nun MMMU-Pro'yla eşleşir. 38B'de, GPT-4o ile eşleşir. 8B'de, açık-8B liderlik tabloyu liderlik et. Hepsi tek aşamalı bir tren öncesi + talimat-tune tarifi üzerine.

Düzeltme borcu hipotezi ölçülebilir: InternVL3-8B, görme-benchmark kazanç biriminden daha az metin değer puanı (MMLU, GSM8K) kaybeder.

### InternVL3.5 ve InternVL-U

InternVL3.5 (Avgust 2025) tarihini ölçeklendirir. Aynı yerel önceden eğitim yaklaşımı, daha fazla veri, daha fazla param. MMMU geliştirmeleri artışsaldır.

InternVL-U (2026) aynı omurganın üzerine MMDiT başlıkları üzerinden birleşik nesil  görüntü çıkışı ekler. "U" Transfusion tarzı birleşik modelleri kovalayan "Anlama + nesil" anlamına gelir (Denevi 12.13). Aynı yerel önceden eğitilmiş omurgan hem anlayış hem de nesil başlıklarını destekler.

### Doğal eğitim öncesi eğitimlerin karşılaştırılması

Doğal öncesi eğitim ücretsizdir:

- Bilgisayar. Yeni bir VLM'yi sıfırdan eğitmek, bir metin LLM'yi eğitmek ile aynı maliyeti taşır.
- Veriler. Ölçülü olarak birbirine karışan görüntü-metin korpusları nadirdir. OBELICS 141M belgeler; MMC4 571M. Tekest tek başına 15T jetonlarda gönderir. Multimodal önceden eğitim verileri kıtlığı zor bir zorunludur.
- Ürünler: Llama-3-1 ve Llama-4'e dönüştürülür.

InternVL3'ün yaptığı bahis: Düzeltme borcu yeniden kullanım kaybından daha kötüdür. Benchmarks iddiayı destekler. Üretim maliyeti gelecek laboratuvarları ucuz kopyalamaktan engeller. Post-hoc VLM'ler mevcut olmaya devam edecek çünkü çoğu proje için daha ucuz kalırlar.

```figure
l5-native-pretrain
```

## Kullan

`code/main.py`Eğitim-korpus karıştığı ve ViR yönlendirme simülatörüdür.

- Hedef korpus karışımı (% metin, %interleaved, %caption, %video) alır ve modalite başına beklenen adımları hesaplar.
- Bir parti sorgularda ViR yönlendirmeyi simüle eder (tütle: 50% düşük detaylı, 30% orta, 20% yüksek detaylı) ve ortalama token sayısını bildirir.
- Kodlayıcı ile LLM FLOP'lar arasındaki DvD throughput tahminlerini rapor eder.
- Param, hesaplama, veriler ve beklenen uyum- borç semptomları için post-hoc vs. yerli önceden eğitimlerin birbiriyle bir arada basılıyor.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-native-vs-posthoc-auditor.md`Önerilen VLM eğitim planı göz önünde bulundurularak, yerel veya post-hoc olup olmadığını denetlemektedir, uyumlulık- borç riskini belirler ve bir corpus karışımı önerir.

## Egzersizler

1. InternVL3-8B (doğal tren öncesi) ve LLaVA-OneVision-7B (post-hoc) arasındaki hesaplama delta'sını tahmin edin.

2. InternVL3 %40 metin / %35 birbirine karışık / %20 başlık / %5 video rapor ediyor. Eğer hedef göreviniz video ağırsa, yeni bir oran önerin ve temel modelin neden hala önemli metin ve başlık verilerine ihtiyacı olduğunu tartışın.

3. MM1.5 4. bölümünü okuyun unutma. Post-hoc eğitiminin en büyük gerileme gösterdiği tam referans değerini söyleyin. Gerileme maliyeti ne kadar?

4. ViR trafiğin %60'ını düşük çözünürlüklü kodlama yönlendirir. Hangi sorguları yanlış yönlendirir (yüksek çözünürlük gerekirse düşük çözünürlüklere gönderir)?

5. DvD görme ve LLM'yi ayrı GPU'lara ayırır. Hangi trafik kalıbı altında DvD, yardımı yerine geçiş hızını inceler?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## Daha Fazla Okumak

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
