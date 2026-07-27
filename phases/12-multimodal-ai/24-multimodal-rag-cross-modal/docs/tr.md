# Multimodal RAG ve Çapraz Mod Alma

> Vision-yerel belgesi RAG bir dilimdir. Üretim multimodal RAG daha da genişliyor; yolculuk planlaması ("bana doğal ışıklı sessiz bir vegan brunch bul"), tıbbi öncelik ("bu fotoğraf + bu notlarla eşleşen yaralanma hangisi"), e-ticaret ("benim bedenimde bu selfie'ye benzer kıyafetler") ve saha servisi ("bu motor sesini artı parçanın fotoğrafını teşhis edin") gibi iş akışları için metin, resim, ses ve video üzerinden erişim sağlıyor. Üç 2025 araştırması - Abootorabi ve diğerleri, Mei ve diğerleri, Zhao ve diğerleri. - alt problemleri kodladı: modlar arası erişim, geri alma füzyonu, nesil temellendirme, çok modlu değerlendirme. Bu derste anketler okunur ve bir üretim hattı tasarlanır.

**Tür:** Yapım
**Diller:** Python (stdlib, füzyon + topraklanmış jeneratörlü çapraz modlu alıcı)
**Önkoşullar:** Aşama 12 · 23 (ColPali), Aşama 11 (RAG temelleri)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Modallar arası erişim tasarımı: metin → resim, resim → metin, ses → video vb.
- Üç füzyon stratejisini karşılaştırın: puan füzyonu, dikkat temelli füzyon, MoE füzyonu.
- Üretim temellerini açıklayın: Kaynaklar çeşitli yöntemlerin bir karışımı olduğunda "kaynaklarınızdan alıntı yapın" nasıl görünür?
- 2025'in üç kanonik çok modlu RAG araştırmasını ve bunların alt problem sınıflandırmasını adlandırın.

## Sorun

Tek yöntemli RAG çözülmüş bir modeldir: sorguyu yerleştirme, parçaları yerleştirme, geri alma, LLM'ye malzeme ekleme. Çok modlu RAG şunları gerektirir:

1. Çoklu erişim başlıkları (her yöntemin uyumlu bir alanda embedding'lara ihtiyacı vardır).
2. Yöntemler arasında erişim sonuçlarının birleştirilmesi.
3. Modaliteler arasında kaynaklara atıfta bulunan nesil temellendirme.
4. Çapraz mod sinyalini kapsayan değerlendirme metrikleri.

2025 anketlerinin tümü aynı taksonomiye varıyor.

## Konsept

### Çapraz mod alımı

A yöntemi sorgusu verildiğinde B yönteminin belgelerini alın. Üç model:

1. Paylaşılan embedding alanı. CLIP ve CLAP, paylaşılan bir alanda metin + resim / metin + ses embedding'ler üretir. Modaliteler arasındaki kosinüs benzerliği doğrudan çalışır. CLIP eğitimli çiftlerle sınırlıdır.

2. Her modalite kodlayıcı + çeviri. Metin kodlayıcı + görüntü kodlayıcı + boşluklar arasında eşleme yapan küçük bir çevirmen modülü. Sen2Sen, Gupta ve ark. ve diğer 2024 tasarımları. Esnektir ancak karmaşıklığı artırır.

3. Kodlayıcı olarak VLM. Alma temsili olarak bir VLM'nin gizli durumlarını kullanın. VLM'nin desteklediği her yöntem işe yarar. Daha kaliteli, daha pahalı.

Seçim: Metin+resim için CLIP / SigLIP 2; metin+ses için CLAP; Sınır kalitesinde çapraz modlar için VLM gizli durumları.

### Füzyon stratejileri

10 sonuç aldınız: 5 resim, 3 metin pasajı, 2 ses klibi. Nasıl birleşirsiniz?

Puan füzyonu (en ucuz). Her yöntemin kendi alıcısı vardır ve her biri puan döndürür. Modalite içindeki puanları normalleştirin ve ardından toplayın. Basit, çoğu zaman işe yarıyor.

Dikkat temelli füzyon. Alınan tüm öğeleri birleştirin, küçük bir dikkat ağının onları ağırlıklandırmasına izin verin. Eğitime ihtiyacı var.

MoE füzyonu. Ağ yollarının modaliteye özel uzmanlara yönlendirilmesi. Farklı sorgu türleri farklı şekilde yönlendirilir; görsel bir soru, görsellere daha fazla ağırlık verir.

Üretim varsayılanı: sorgunun baskın yöntemine yönelik hafif bir önyargıyla puan füzyonu. A/B alan adınızda net kazançlar gösteriyorsa MoE'ye yükseltin.

### Nesil topraklaması

LLM, her bir hak talebine hangi öğenin geri getirildiğini belirtmelidir. Çok modlu için:

- Metin kaynağı: standart alıntı `[1]`.
- Resim kaynağı: Kısa bir başlıkla birlikte `[img 3]`.
- Ses: `[audio 2 at 0:34]`.

Jeneratörü temellendirmeye duyarlı verilerle eğitin: Eğitim hedefindeki her iddia, kaynak dizini ile etiketlenir. inference noktasında model doğal olarak alıntılar yayınlar.

### 2025 anketleri

Abootorabi ve ark. (arXiv:2502.08826, "Herhangi Bir Yöntemde Sor"): multimodal RAG için sınıflandırma. Geri alma, füzyon ve oluşturmayı kapsar. En geniş kapsama alanı.

Mei ve ark. (arXiv:2504.08748, "Çok Modlu RAG Araştırması"): alt görevlere (benchmark) ve hata modlarına odaklanır. Değerlendirme tasarımı için kullanışlıdır.

Zhao ve diğerleri. (arXiv:2503.18016): vizyon odaklı anket. ColPali ailesi çalışmalarında güçlü.

Üçünü de okumak size 2025 baharı itibarıyla en son teknolojiyi verir. Alt problemlerin çoğu hala açık durumdadır.

### MuRAG — temel makale

MuRAG (Chen ve diğerleri, 2022) ilk multimodal RAG'dı. Çok modlu bir KB'den resim + metin alındı, yanıtlar oluşturuldu. VLM dalgasından önce fizibilite gösterildi. Modern sistemler (REACT, VisRAG, M3DocRAG) bunun üzerine kuruludur.

### Bir üretim gezisi planlayıcı örneği

Sorgu: "bana doğal ışık alan sessiz bir vegan brunch bul."

Boru hattı:

1. Sorguyu ayrıştırın. "sessiz" → ses/inceleme anahtar sözcüğü; "vegan brunch" → menü öğesi; "doğal ışık" → görüntü özelliği.
2. Modaliteye göre alma:
- İncelemelerden metin alma: "vegan brunch, sessiz ortam."
- Restoran fotoğraflarından görüntü alma: "doğal ışık, havadar."
- Ortam sesi kliplerinde ses alımı: "düşük desibel, müzik yok."
3. Sigorta puanları. Her restoranın bileşik puanı vardır.
4. En iyi restoranlar → Tüm kanıtları içeren VLM oluşturucu → alıntılarla yanıtlayın.

Bu, text-RAG'ın çok ötesindedir. Her yöntem, metnin tek başına gözden kaçırdığı sinyali ekler.

### Agentic çok modlu RAG

Çoklu atlama: İlk erişim yüksek güvenirliğe sahip yanıtlar getirmezse LLM yeniden formüle eder ve tekrar alır. AgentFaz 14'teki RAG kalıpları burada geçerlidir. Örnekler:

- İlk 10'u alın → Yüksek Lisans "çok gürültülü, <40 dB için filtreleyin" diye sorar → yeniden alın.
- Görüntüleri alın → LLM, bir menüye sahip olduğunu görür → menü metnini alın → yanıtlayın.

Karmaşıklık katar ancak tek seferde almanın yapamayacağı sorguları işler.

### Değerlendirme

Çapraz-modal değerlendirme henüz olgunlaşmamıştır. Ortak proxy'ler:

- Modalite başına @k'yi geri çağırın.
- Sigortalı üst k doğruluğu.
- İnsan tarafından değerlendirilen uçtan uca memnuniyet.
- Göreve özel (tamamlanan rezervasyonlar, yapılan satın almalar).

Hiçbir standart benchmark tüm yöntemleri kapsamaz. Çoğu makale, alana özgü görevleri değerlendirir.

## Kullan onu

`code/main.py`:

- Ortak bir restoran topluluğu üzerinde çalışan üç sahte alıcı (metin, resim, ses).
- Modalite puanlarını yapılandırılabilir ağırlıklarla birleştiren puan füzyonu.
- Alıntılarla birlikte son yanıtı veren bir jeneratör koçanı.
- Güvenin düşük olması durumunda sorguyu yeniden formüle eden basit bir agentic döngüsü.

## Gönderin

Bu ders `outputs/skill-multimodal-rag-designer.md` üretir. Çok modlu bir sorgu akışına sahip bir ürün spesifikasyonu verildiğinde, alıcıları, füzyonu, oluşturucuyu ve değerlendirmeyi tasarlar.

## Egzersizler

1. Tıbbi triyaj multimodal RAG önerin: sorgu = yaralanmanın fotoğrafı + semptomların metni. Hangi yöntemler hangi KB'den alınır?

2. Skor füzyonu basit ağırlıklı bir toplamdır. MoE füzyonunun önlediği hangi arıza modu var?

3. Abootorabi ve arkadaşlarının taksonomisini okuyun (Bölüm 3). Üç kanonik alt problem nedir ve bunlar seçtiğiniz ürünle nasıl eşleşir?

4. Seyahat planlayıcı multimodal RAG için bir değerlendirme spesifikasyonu tasarlayın. Hangi ölçümler görüntü hatırlamayı, ses hatırlamayı ve bileşik doğruluğunu kapsar?

5. Agentic çok atlamalı RAG'nin gidiş-dönüş başına gecikme vergisi vardır. Hangi sorgu zorluğunda doğruluk artışı gecikmeyi haklı çıkarır?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Çapraz modlu erişim | "Bir yöntemi sorgulayın, diğerini alın" | Metin sorgusu görüntüleri alır; resim sorgusu metni alır; paylaşılan bir alan veya çevirmen gerektirir |
| Skor füzyonu | "Puanları birleştir" | Her modaliteye ait erişim puanlarının ağırlıklı toplamı; en basit füzyon |
| MoE füzyonu | "Modalite odaklı uzmanlar" | Gating ağı, sorgu başına hangi yöntemin puanlarına güvenileceğini seçer |
| Topraklanmış nesil | "Kaynaklarınızdan alıntı yapın" | Yanıttaki her iddia kaynak dizini ile etiketlendi |
| MuRAG | "İlk çok modlu RAG" | Çok modlu RAG modelini oluşturan 2022 makalesi |
| Agentçoklu atlama | "Yeniden formüle edin ve yeniden deneyin" | Yüksek Lisans, ilk geçiş güveni düşük olduğunda toplayıcıları yeniden sorguluyor |

## Daha Fazla Okuma

- [Abootorabi ve ark. — Herhangi Bir Yöntemle Sor (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei ve ark. — Çok Modlu RAG Araştırması (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao ve ark. — Vision RAG Anketi (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen ve ark. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu ve ark. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
