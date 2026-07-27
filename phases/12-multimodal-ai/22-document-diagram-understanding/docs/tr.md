# Belge ve Diyagram Anlayışı

> Belgeler fotoğraf değildir. Bir PDF, bilimsel makale, fatura veya el yazısı form, düz görsel anlayışın yakalayamayacağı düzen, tablolar, diyagramlar, dipnotlar, başlıklar ve anlamsal yapıya sahiptir. VLM öncesi yığın bir ardışık düzendi: Tesseract OCR + LayoutLMv3 + tablo çıkarma buluşsal yöntemi. VLM dalgası, bunu doğrudan yapılandırılmış işaretlemeyi yayan OCR içermeyen modellerle (Donut (2022), Nougat (2023), DocLLM (2023)) değiştirdi. 2026'ya gelindiğinde sınır yalnızca "sayfa görüntüsünü 2576 piksel native resolutionte Claude Opus 4.7'ye besliyor" ve yapılandırılmış işaretleme çıktısı ücretsiz olarak geliyor. Bu ders, belge yapay zekasının üç dönemlik seyrini ele alıyor.

**Tür:** Yapım
**Diller:** Python (stdlib, düzene duyarlı belge ayrıştırıcı iskeleti)
**Önkoşullar:** Aşama 12 · 05 (LLaVA), Aşama 5 (NLP)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Belge yapay zekasının üç dönemini açıklayın: OCR ardışık düzeni, OCR'siz, VLM'de yerel.
- LayoutLMv3'ün üç giriş akışını açıklayın: metin, düzen (bbox), görüntü yamaları ve birleştirilmiş maskeleme.
- Donut (OCR içermeyen, görüntü → işaretleme), Nougat (bilimsel makale → LaTeX), DocLLM (düzene duyarlı üretken), PaliGemma 2'yi (VLM yerel) karşılaştırın.
- Yeni bir görev için bir belge modeli seçin (faturalar, bilimsel makaleler, el yazısı formlar, Çince makbuzlar).

## Sorun

"Bu PDF'yi anlayın" yanıltıcı derecede zordur. Bilgiler şurada:

- Metin içeriği (sinyalin %90'ı).
- Düzen (başlıklar, dipnotlar, kenar çubukları, iki sütunlu format).
- Tablolar (satırlar, sütunlar, birleştirilmiş hücreler).
- Şekiller ve diyagramlar.
- El yazısıyla yazılan açıklamalar.
- Yazı tipleri ve tipografi (başlık ve gövde).

Ham OCR metni atar ve geri kalanını kaybeder. Faturaları önemseyen bir sistemin "Toplam: 1.245 $" ifadesinin dipnottan değil, sağ alttan geldiğini bilmesi gerekir.

## Konsept

### Era 1 — OCR hattı (2021 öncesi)

Klasik yığın:

1. PDF → sayfa başına resim.
2. Tesseract (veya ticari OCR), kelime başına sınırlayıcı kutularla metni çıkarır.
3. Düzen analizörü blokları tanımlar (başlık, tablo, paragraf).
4. Tablo yapısı tanıyıcı tabloları ayrıştırır.
5. Etki alanı kuralları + normal ifade çıkarma alanları.

Temiz basılı metinler için çalışır. El yazısında kesintiler, çarpık taramalar, karmaşık tablolar, İngilizce olmayan alfabeler. Her arıza modu özel bir istisna yolu gerektirir.

### TroCR (2021)

TrOCR (Li ve diğerleri, arXiv:2109.10282), Tesseract'ın klasik CNN-CTC'sini sentetik + gerçek metin görüntüleri üzerinde eğitilmiş bir transformer kodlayıcı-kod çözücüyle değiştirdi. El yazısı ve çok dilli metinlerde temiz kazanç. Hâlâ bir boru hattı (dedektör, ardından TrOCR, ardından düzen), ancak OCR adımı önemli ölçüde gelişti.

### Era 2 — OCR içermez (2022-2023)

İlk OCR içermeyen modeller şunu söylüyordu: Algılamayı tamamen atlayın, görüntü piksellerini doğrudan yapılandırılmış çıktıya eşleyin.

Donut (Kim ve diğerleri, arXiv:2111.15664):
- Kodlayıcı-kod çözücü transformer, kodlayıcı Swin-B'dir.
- Çıktı, formu anlama, özetleme için işaretleme veya göreve özgü herhangi bir şema için JSON'dur.
- OCR yok, düzen yok, algılama yok.

Nuga (Blecher ve diğerleri, arXiv:2308.13418):
- Özellikle bilimsel makaleler üzerine eğitilmiştir.
- Çıktı LaTeX / markdown'dur.
- Denklemleri, çok sütunlu düzeni ve şekilleri yönetir.
- Her arXiv ayrıştırıcısının çağırdığı model.

Bunlar uzmandır, genelci değil. Bilimsel bir makaledeki çörek başarısız olur; Faturadaki nuga başarısız oluyor.

### DüzenLMv3 (2022)

Farklı bir parça. LayoutLMv3 (Huang ve diğerleri, arXiv:2204.08387) OCR'yi korur ancak düzen anlayışını ekler:

- Üç giriş akışı: OCR metni tokens, her-token 2D sınırlayıcı kutu, görüntü yamaları.
- Üç yöntemin tamamında maskelenmiş eğitim hedefi (maskeli metin, maskeli yamalar, maskeli düzen).
- Downstream: sınıflandırma, varlık çıkarma, QA tablosu.

LayoutLMv3, OCR tabanlı belge anlayışının zirvesidir. Formlar ve faturalar konusunda güçlü. OCR yukarı akış gerektirir. Standartlaştırılmış belge benchmark'lerde en iyi VLM öncesi doğruluk.

### BelgeLLM (2023)

DocLLM (Wang ve diğerleri, arXiv:2401.00908), LayoutLM'nin üretken kardeşidir. token düzenine göre koşullandırılmış serbest biçimli yanıtlar üretir. Belgelerde QA için daha iyi; hala OCR girişine bağlıdır.

### Çağ 3 — VLM'de yerel (2024+)

2024 VLM'ler üretim hattını tamamen değiştirecek kadar iyi hale geldi. Tam sayfa görüntüsünü yüksek çözünürlükte bir VLM'ye gönderin, soruyu sorun, yanıt alın.

- LLaVA-NeXT 336-tile AnyRes küçük belgeler için çalışır.
- Qwen2.5-VL dinamik çözünürlük, 2048+ pikseli yerel olarak işler.
- Claude Opus 4.7 2576 piksellik belgeleri destekler.
- PaliGemma 2 (Nisan 2025) özellikle belgeler ve el yazısı için eğitim veriyor.

VLM-yerel ve OCR-boru hattı arasındaki boşluk hızla kapandı. 2026 yılına kadar VLM yerlisi şu konularda kazanır:

- Sahne metni (elle yazılmış + basılı, karışık senaryolar).
- Birleştirilmiş hücrelere sahip karmaşık tablolar.
- Metne gömülü matematik denklemleri.
- Metin açıklamaları içeren şekiller.

OCR hatları hala şu konularda kazanıyor:

- Sayfa başına gecikmenin önemli olduğu büyük ölçekte saf tarama iş yükleri.
- Boru hattı güvenilirliği (deterministik arızalar ve VLM halüsinasyonları).
- Denetlenebilir OCR çıktısı gerektiren düzenlenmiş ortamlar.

### Claude 4.7 / GPT-5 sınırı

2576 piksellik yerel girişte, sınır VLM'leri insana yakın doğrulukla belge anlayışını gerçekleştirir. 2026 yılının başındaki benchmark sayıları:

- DocVQA: Claude 4.7 ~95.1, PaliGemma 2 ~88.4, Nougat ~77.3, ardışık düzen LayoutLMv3 ~83.
- TabloQA: Claude 4.7 ~92.2, GPT-4V ~78.
- VisualMRC: Claude 4.7 ~94.

Kapalı model farkı çoğunlukla çözünürlük ve temel LLM ölçeğidir. 7B'deki açık modeller birkaç puan geride ama yetişiyor.

### Matematik denklemleri ve LaTeX çıktısı

Bilimsel makalelerin denklemler için tam LaTeX çıktısına ihtiyacı vardır. Nougat bu konuda eğitildi. LaTeX hedefleriyle eğitilen VLM'ler (Qwen2.5-VL-Math, Nougat türevleri) kullanılabilir LaTeX üretir. Açık LaTeX eğitimi olmadan VLM'ler okunabilir ancak kesin olmayan transkripsiyonlar üretir.

2026'daki bilimsel makale hatları için: PDF'de Nougat'ı zincirleyin, ardından zorlu sayfalarda bir VLM.

### El yazısı

Hala en zor alt görev. Basılı + el yazısı karışık (doktor notları, doldurulmuş formlar), OCR işlem hatlarının maliyet açısından hala VLM'leri geride bıraktığı yerdir. Yalnızca elle yazılan VLM'ler gelişiyor (Claude 4.7, PaliGemma 2).

### 2026 tarifi

Yeni bir belge yapay zeka projesi için:

- Uygun ölçekte saf basılmış faturalar: LayoutLMv3 + kuralları, uygun maliyetli.
- Karışık belgeler (bilimsel + el yazısı + formlar): VLM-yerel (PaliGemma 2 veya Qwen2.5-VL).
- Tam arXiv alımı: Matematik için Nougat, rakamlar için VLM.
- Düzenleyici: Çapraz kontrol için OCR boru hattı + VLM doğrulayıcı.

## Kullan onu

`code/main.py`:

- Bir oyuncak düzenine duyarlı tokenizer: verilen (metin, bbox) çiftleri, LayoutLMv3 tarzı girdi üretir.
- Donut tarzı bir görev şeması oluşturucu: formlar için JSON şablonu.
- OCR kanalı, Donut, Nougat ve VLM yerelinde sayfa başına token bütçenin karşılaştırması.

## Gönderin

Bu ders `outputs/skill-document-ai-stack-picker.md` üretir. Bir belge yapay zeka projesi (etki alanı, ölçek, kalite, düzenleyici) göz önüne alındığında, OCR işlem hattı, OCR içermeyen uzman ve VLM yerel arasında seçim yapar.

## Egzersizler

1. Projeniz günde 10 milyon faturadır. Hangi yığın, doğruluğu kaybetmeden sayfa başına maliyeti en aza indirir?

2. LayoutLMv3 neden form QA'da saf CLIP-VLM'lerden daha iyi performans gösterirken sahne metninde daha düşük performans gösteriyor? Bbox akışı nelerden vazgeçiyor?

3. Nougat, LaTeX'i oluşturur. VLM yerel çıktısının LaTeX kalitesinde Nougat'ı geride bıraktığı ve Nougat'ın kazandığı bir test senaryosu önerin.

4. PaliGemma 2 makalesini okuyun (Google, 2024). PaliGemma 1'e kıyasla belge doğruluğunu artıran temel eğitim verisi eklemesi neydi?

5. Mevzuat açısından güvenli bir hibrit tasarlayın: Birincil olarak OCR işlem hattı, ikincil çapraz kontrol olarak VLM. Anlaşmazlığı nasıl çözersiniz?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| OCR boru hattı | "Tesseract tarzı" | Aşama bazında yığın: algılama -> OCR -> düzen -> kurallar; deterministik, kırılgan |
| OCR içermez | "Çörek tarzı" | Açık OCR'yi atlayan görüntüden çıktıya transformer; tek model |
| Düzene duyarlı | "DüzenLM" | Giriş, her-token bbox koordinatını içerir; yöntemler arasında birleşik maskeleme |
| VLM'de yerel | "Sınır VLM" | Sayfa görüntüsünü yüksek çözünürlükte doğrudan Claude/GPT/Qwen VLM'ye aktarın; boru hattı yok |
| BelgeVQA | "Belge benchmark" | Belge MYK standardı; en çok alıntı yapılan puan |
| İşaretleme çıktısı | "LaTeX / MD" | Serbest biçimli metin yerine yapılandırılmış çıktı biçimi; aşağı yönde otomasyona olanak sağlar |

## Daha Fazla Okuma

- [Li ve ark. — TroCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher ve ark. — Nuga (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang ve ark. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim ve ark. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang ve ark. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
