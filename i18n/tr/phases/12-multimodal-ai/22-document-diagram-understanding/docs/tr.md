# Belge ve Şekil Anlayışı

> Belgeler fotoğraf değil. PDF, bilimsel makale, fatura veya el yazılı bir form, basit bir görüntü anlayışının yakalayamayacağı bir düzen, tablolar, şkaflar, ayaknotlar, başlıklar ve anlamlı bir yapıya sahiptir. VLM öncesi yığın bir boru hattıydı: Tesseract OCR + LayoutLMv3 + masa çıkarma heuristikleri. VLM dalgası, doğrudan yapılandırılmış işaretleme yaydığı OCR-sizdir modelleri  Donut (2022), Nougat (2023), DocLLM (2023)  ile değiştirdi. 2026 yılına kadar sınır sadece "sayfa görüntüsünü Claude Opus 4.7'e 2576px doğal olarak besle" ve yapılandırılmış işaretleme çıkışı ücretsiz olarak gelir. Bu ders, belgeler AI'nin üç çağlı yayını okuyor.

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Belge AI'nin üç çağını açıklayın: OCR boru hattı, OCR-sizgisel, VLM-dev.
- LayoutLMv3'ün üç giriş akışını açıklayın: metin, düzen (bbox), görüntü yamaları, birleşik maskelendirme ile.
- Donut (OCR-free, image → markup), Nougat (bilimsel makale → LaTeX), DocLLM (layout-aware generative), PaliGemma 2 (VLM-native) ile karşılaştırın.
- Yeni bir görev için bir belge modeli seçin (faktürler, bilimsel makaleler, el yazılı formlar, Çin kviteleri).

## Sorun

"Bu PDF'yi anlamak" aldatıcı bir şekilde zor.

- Metin içeriği (sinyalın %90'ı).
- Düzenleme (başlıklar, ayaknotlar, yan çubuqlar, iki sütun biçimi).
- Tablolar (sır, sütunlar, birleşik hücreler).
- Resimler ve şablonlar.
- El yazılı notlar.
- Yazı tipi ve tipografi (başlık vs. vücut).

Faturayı önemseyen bir sistem, alt sağdan değil, alt sağdan "Total: $1,245" geldiğini bilmelidir.

## Anlaşım

### 1. dönem  OCR boru hattı (2021 yılına kadar)

Klasik bir yığın:

1. PDF → resim sayfası başına.
2. Tesseract (veya ticari OCR) kelimenin bir harfi sınırlama kutuları ile metni çıkarır.
3. Layout analizitörü blokları tanımlar (başlık, tablo, paragraf).
4. Masa yapısı tanıtıcısı masaları analiz eder.
5. Alan kuralları + regex çekim alanları.

Temiz basılı metin için çalışır. El yazısı, eğri tarama, karmaşık tablolar, İngilizce olmayan senaryolar için. Her başarısızlık modunda özel bir istisna yolu gerekir.

### TrOCR (2021)

TROCR (Li et al., arXiv:2109.10282) Tesseract'in klasik CNN-CTC'ini sentetik + gerçek metin görüntülerinde eğitilmiş bir transformatör kodlayıcı-dekoderle değiştirdi. El yazılı ve çok dilli metin üzerinde temiz kazanç. Hala bir boru hattı (detektor sonra TrOCR sonra düzen), ancak OCR adımları çarpıcı bir şekilde iyileşti.

### 2. Çağ  OCR-den uzak (2022-2023)

İlk OCR-siz modeller şöyle dedi: tespit tamamen atlatın, görüntü piksellerini doğrudan yapılandırılmış çıkışa haritasın.

Donut (Kim et al., arXiv:2111.15664):
- Kodlayıcı-dekoder transformatörü, kodlayıcı Swin-B.
- Çıktı, form anlayışı için JSON, özetleme için markdown veya herhangi bir görev-özel şema.
- OCR yok, düzen yok, tespit yok.

Nougat (Blecher et al., arXiv:2308.13418):
- Özellikle bilimsel makaleler üzerine eğitim almış.
- Çıktım, LaTeX / markdown.
- Eklentiler, çok sütunlu düzen, rakamlar.
- Arxiv-parser'ın her çağrısı olan model.

Bunlar uzmanlar, genelciler değil. Bilimsel bir makalede çörek başarısız olur.

### LayoutLMv3 (2022)

LayoutLMv3 (Huang et al., arXiv:2204.08387) OCR'yi korur ancak düzen anlayışını ekler:

- Üç giriş akışı: OCR metin işaretleri, her işaret için 2D sınırlama kutuları, görüntü yamaları.
- Üç modalitede de maskeli eğitim amacı (maskeli metin, maskeli yamalar, maskeli düzen).
- Aşağı akıntı: sınıflandırma, kurum çıkarımı, tablo QA.

LayoutLMv3 OCR tabanlı belge anlayışının zirvesidir. Formlar ve faturalarda güçlü. OCR'yi akıntılı bir şekilde gerektirir. Standartlaştırılmış belge referansları üzerinde en iyi VLM öncesi doğruluk.

### Doküman (2023)

DocLLM (Wang et al., arXiv:2401.00908, 31 Aralık 2023'te gönderilmiş, bu nedenle kimlik bir Ocak 2024 önlüğü taşıyor) LayoutLM'nin üretici kardeşidir.

### 3. dönem  VLM-devli (2024+)

2024'te VLM'ler tüm boru hattını değiştirmek için yeterince iyi hale geldi.

- LLaVA-NeXT 336-til AnyRes küçük belgeler için çalışır.
- Qwen2.5VL dinamik çözünürlük 2048+ piksel doğuştan ele alıyor.
- Claude Opus 4.7 2576px belgeleri destekler.
- PaliGemma 2 (Aralık 2024) özel olarak belgeler + el yazısı için trenler.

VLM-native ve OCR-pipeline arasındaki boşluk hızla kapatıldı. 2026 yılına kadar VLM-native:

- Sahne metni (el yazısı + basılı, karıştırılmış senaryolar).
- Birleştirilmiş hücrelerle karmaşık tablolar.
- Metinlere gömülü matematik denklemleri.
- Metin notları olan figürler.

OCR boru hattı hala kazanıyor:

- Sayfa başına gecikme önemli olduğu büyük ölçekte saf tarama iş yükleri.
- Pipeline güvenilirliği (deterministik başarısızlıklar vs. VLM halüsinasyonları).
- Denetim edilebilir OCR çıkışı gerektiren düzenlenmiş ortamlar.

### Claude 4.7 / GPT-5 sınır

2576 piksellik yerel giriş ile sınır VLM'leri, insan doğruluğuna yakın bir anlayışla belgeler yapmaktadır. 2026 yılının başından itibaren referans rakamları:

- DocVQA: Claude 4.7 ~ 95.1, PaliGemma 2 ~ 88.4, Nougat ~ 77.3, boru hattı LayoutLMv3 ~ 83.
- ÇartQA: Claude 4.7 ~ 92,2, GPT-4V ~ 78.
- VisualMRC: Claude 4.7 ~ 94.

Kapalı modelde boşluk çoğunlukla çözünürlük ve temel LLM ölçeğindedir. 7B'deki açık modeller birkaç puan geride ama yetişmektedir.

### Matematik denklemler ve LaTeX çıkışı

Bilimsel makaleler denklemler için tam LaTeX çıkışına ihtiyaç duyar. Nougat bu konuda eğitildi. LaTeX hedefleri ile eğitilmiş VLM'ler (Qwen2.5-VL-Math, Nougat türevleri) kullanılabilir LaTeX üretir. Açık bir LaTeX eğitimi olmadan, VLM'ler okuyabilir ancak net olmayan transkripsiyonlar üretir.

2026'da bilimsel kağıt boru hattı için: Nougat zinciri PDF'de, sonra da karmaşık sayfalarda VLM.

### El yazısı

Yine de en zor alt görev. Karışık basılı + el yazılı (doktor notları, doldurulmuş formlar) OCR boru hattının hala maliyet için VLM'leri yendiği yerdir. Sadece el yazılı VLM'ler iyileşmektedir (Klavü 4.7, PaliGemma 2).

### 2026 tarifi

Yeni bir belge-İS projesi için:

- Temiz basılmış faturalar ölçeğinde: LayoutLMv3 + kuralları, maliyet-efikas.
- Karışık belgeler (bilimsel + el yazılı + formlar): VLM-devde (PaliGemma 2 veya Qwen2.5-VL).
- Matematik için Nougat, rakamlar için VLM.
- Yönetimsel: OCR borusu + çapraz kontrol için VLM onaylayıcı.

```figure
mm-doc-layout
```

## Kullan

`code/main.py`- ...

- Oyuncak düzenini bilen bir tokenizer: verilen (metin, bbox) çiftler, LayoutLMv3 tarzında giriş üretir.
- Donut tarzı görev şeması jeneratörü: Formlar için JSON şablonu.
- OCR-pipeline, Donut, Nougat ve VLM-native üzerinden sayfa başına token bütçelerinin bir karşılaştırması.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-document-ai-stack-picker.md`. Bir belge-AI projesi (domain, ölçek, kalite, düzenlemeler) göz önüne alındığında, OCR boru hattı, OCR-den uzak uzman ve VLM-native arasında seçim yapılır.

## Egzersizler

1. Projenin günde 10 milyon fatura var. Hangi paket sayfaya maliyeti haksızlık etmeden en aza indirger?

2. LayoutLMv3 neden form QA'da saf CLIP-VLM'leri atlatır ama sahne metni için daha düşük performans gösterir?

3. Nougat LaTeX'i oluşturur. VLM-natif çıkışın Nougat'ı LaTeX sadakatinde yendiği bir test vakaını ve Nougat'ın kazandığı bir vaka önerin.

4. PaliGemma 2 makalesini okuyun (Google, 2024). Belge doğruluğunu PaliGemma 1 ile karşılaştırdığında önemli eğitim verileri eklenmesi neydi?

5. Yönetimsel güvenlikli bir hibrit tasarlayın: OCR boru hattı birincil olarak, VLM ikincil çapraz kontrol olarak.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | Stage-wise stack: detect -> OCR -> layout -> rules; deterministic, fragile |
| OCR-free | "Donut-style" | Image-to-output transformer that skips explicit OCR; single model |
| Layout-aware | "LayoutLM" | Input includes per-token bbox coordinates; unified masking across modalities |
| VLM-native | "Frontier VLM" | Feed page image directly to Claude/GPT/Qwen VLM at high resolution; no pipeline |
| DocVQA | "Doc benchmark" | Document VQA standard; most-cited score |
| Markup output | "LaTeX / MD" | Structured output format instead of free-form text; enables downstream automation |

## Daha Fazla Okumak

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
