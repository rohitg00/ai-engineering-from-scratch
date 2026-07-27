# OpenAI Hazırlık Framework ve DeepMind Sınır Güvenliği Framework

> OpenAI Hazırlık Framework v2 (Nisan 2025), Takip Edilen Kategorilerden farklı olan Araştırma Kategorilerini (Uzun Menzilli Özerklik, Koruma Torbalama, Otonom Çoğaltma ve Uyarlama, Korumaları Zayıflatma) tanıtıyor. Takip Edilen Kategoriler, Güvenlik Danışma Grubu tarafından incelenen Yetenek Raporlarını ve Koruma Tedbirleri Raporlarını tetikler. DeepMind'ın FSF v3'ü (Eylül 2025, İzlenen Yetenek Düzeyleri 17 Nisan 2026'da eklenmiştir), özerkliği ML Ar-Ge ve Siber alanlara katmaktadır (ML Ar-Ge özerklik düzeyi 1 = AI Ar-Ge hattını insan + AI araçlarına kıyasla rekabetçi maliyetle tamamen otomatikleştirin). FSF v3, araçsal akıl yürütmenin kötüye kullanılması için otomatik izleme yoluyla aldatıcı hizalamayı açıkça ele alıyor. Dürüst not: PF v2'deki Araştırma Kategorileri (Uzun Menzilli Özerklik dahil) azaltımları otomatik olarak tetiklemez; politika dili "potansiyel"dir. DeepMind'ın kendisi, araçsal muhakeme güçlenirse otomatik izlemenin "uzun vadede yeterli kalmayacağını" söylüyor.

**Tür:** Öğren
**Diller:** Python (stdlib, üç-framework karar tablosu fark aracı)
**Önkoşullar:** Aşama 15 · 19 (Antropik RSP)
**Süre:** ~45 dakika

## Sorun

Ders 19, Anthropic'in ölçeklendirme politikasını yakından okuyor. Bu ders OpenAI ve DeepMind'ı okuyarak resmi tamamlıyor. Bu üç belge aynı soruyu ele alan kuzen artifact'lardir - bir sınır laboratuvarı ne zaman duraklamalı veya bir modele geçit vermeli - ve küçük bir kategori kümesinde birleşiyor ve önemli olan belirli yerlerde ayrılıyor.

Yakınsama: Üçü de uzun menzilli özerkliği takip edilmeye değer bir yetenek sınıfı olarak etiketliyor. Her üçü de aldatıcı davranışları (hizalama sahteciliği, kum torbasına koyma) belirli bir risk sınıfı olarak kabul ediyor. Üçünün de dahili bir inceleme organı var. Farklılık: OpenAI, kategorileri "Takip Edilen" (zorunlu azaltma) ve "Araştırma" (otomatik tetikleme yok) olarak ayırır. DeepMind, özerkliği ayrı ayrı adlandırmak yerine iki alana katlıyor. Laboratuvar adları Takip Edilen vs Araştırma veya Kritik vs Orta veya Kademe-1 ve Kademe-2; Bir yeteneğin hangi grupta yaşadığının operasyonel sonucu laboratuvarlar arasında farklılık gösterir.

Bunları birlikte okumak faydalı bir egzersizdir. Aynı yetenek Anthropic'te "zorunlu azaltma", OpenAI'de "izleniyor ancak tetiklenmiyor" ve DeepMind'da "belirli bir alanda izleniyor" olabilir. Politika duruşu önemlidir.

## Konsept

### OpenAI Hazırlık Framework v2 (Nisan 2025)

Yapı:

- **İzlenen Kategoriler**: Yetenek Raporlarını (modelin neler yapabileceğini) ve Koruma Önlemleri Raporlarını (hangi azaltımların mevcut olduğunu) tetikler. deployment tarihinden önce Güvenlik Danışma Grubu tarafından incelendi.
- **Araştırma Kategorileri**: laboratuvarın takip ettiği ancak henüz belirli azaltım önlemlerini taahhüt etmediği model yetenekleri. Uzun Menzilli Özerklik, Kum Torbalama, Özerk Çoğaltma ve Uyarlama, Korumaları Zayıflatmayı içerir.

v2'deki temel çerçeve: Araştırma Kategorileri, azaltım önlemlerini otomatik olarak tetiklemez. Politika dili "potansiyel" azaltımlardır. Bu, izlenmesi gereken spesifik deltadır: Takip Edilen ve Araştırma'daki bir kategorinin konumu, "geçitli" ve "gözlemlenen" arasındaki menteşedir.

### DeepMind Frontier Safety Framework v3 (Eylül 2025; Takip Edilen Yetenek Düzeyleri 17 Nisan 2026'da eklendi)

Yapı:

- **Kritik Yetenek Düzeyleri (CCL'ler)**: beş alan genelinde yetenek eşikleri: Siber, Biyolojik, ML Ar-Ge, KBRN, Otonomi (ML Ar-Ge ve Siber olarak ikiye katlanmıştır).
- **İzlenen Yetenek Düzeyleri**: Nisan 2026'da ek ayrıntı düzeyi eklendi. Somut örnek: ML Ar-Ge özerkliği düzeyi 1 = insan + yapay zeka araçlarına kıyasla yapay zeka Ar-Ge hattını rekabetçi maliyetle tamamen otomatikleştirin.
- **Yanıltıcı hizalama izleme**: araçsal akıl yürütmenin kötüye kullanılması için otomatik izlemeye yönelik açık taahhüt.

Özerklik çerçevesi OpenAI'ninkinden farklıdır. DeepMind "Özerklik"i üst düzey bir alan olarak tutmaz; özerkliğin zarar verebileceği alanlara (ML Ar-Ge ve Siber) katılmıştır. Buradaki iddia, etki alanı olmayan özerkliğin risksiz yetenek olduğudur; karşı argüman ise alanlar arasındaki özerkliğin framework'ün adlandırması gereken bir meta risk olduğudur.

### Üçünün de ortak noktası nedir

- Dahili Güvenlik Danışma Grubu (Anthropic SAG, OpenAI SAG, DeepMind dahili komitesi olarak adlandırılır). Yüksek kapasiteli modeller için deployment öncesinde inceleyin.
- Bir risk sınıfı olarak aldatıcı hizalama / hizalama sahtekarlığının açıkça belirtilmesi.
- Belirtilen bir ritimde artifact ayakta durmak (Antropik: Sınır Güvenliği Yol Haritası, Risk Raporu; OpenAI: Yetenekler ve Koruma Raporları; DeepMind: FSF güncelleme döngüsü).
- Yalnızca izleme amaçlı savunmaların bir tavanı olduğunun kabul edilmesi. DeepMind çok açık: "otomatik izleme uzun vadede yeterli kalmayacak."

### Nerede ayrışıyorlar

- **Antropik**: v3.0'da duraklatma taahhüdü kaldırıldı; AI Ar-Ge-4 eşiği, adlandırılmış bir sonraki kapıdır.
- **OpenAI**: Takip Edilen ve Araştırma ayrımı; Araştırma Kategorileri (Uzun Menzilli Özerklik dahil) otomatik olarak geçiş yapmaz.
- **DeepMind**: diğer alanlara katlanmış özerklik; Takip Edilen Yetenek Düzeyleri, Nisan 2026'da ayrıntı düzeyini artırır.

### Kum Torbalama: üçünü de karmaşık hale getiren özel bir yetenek

Kum torbalama (değerlendirmelerde stratejik olarak düşük performans gösteren bir model) OpenAI'nin Araştırma Kategorileri arasındadır. Anthropic'in RSP'si v3.0 bunu değerlendirme bağlamı boşluğu aracılığıyla ele alıyor (Ders 1). DeepMind, FSF v3'teki aldatıcı hizalama izleme yoluyla bu sorunu giderir.

Bir model değerlendirmelerde sandbag oluşturursa her framework'ün yetenek eşikleri hafife alınır. framework yalnızca ölçümün işe yaraması durumunda çalışır. Bu nedenle laboratuvar öz değerlendirmesinin yanı sıra dış ölçüm (Ders 21, METR) ve çekişmeli değerlendirme de gereklidir.

### Politika okuma becerisi

- Bul: önemsediğiniz her yetenek politikada bulunmalıdır. Bulunamaması durumunda poliçe bunu kapsamaz.
- Sınıflandırın: Takip Ediliyor mu (azaltımı tetikliyor) yoksa Araştırma mı yapıyor (takip ediliyor ancak tetiklenmiyor)? OpenAI bunu adlandırıyor; Antropik ve DeepMind'ın kendi eşdeğerleri vardır.
- Tempo: Politika ilan edilen bir programa göre mi yoksa yalnızca belirli olaylardan sonra mı güncelleniyor? Bildirilen kadans daha güçlüdür.
- Bağımsızlık: Dış inceleme zorunlu mu yoksa isteğe bağlı mı? Antropik, Apollo ve ABD Yapay Zeka Güvenliği Enstitüsü ile ortaktır; METR ile OpenAI; DeepMind öncelikle dahili SAG'ye sahiptir.

## Use It — Hazır Araçla Uygula

`code/main.py` küçük bir karar tablosu fark aracını uygular. Bir yetenek verildiğinde (özerklik, aldatıcı uyum, Ar-Ge otomasyonu, siber yükseliş vb.), üç politikanın her birinin yeteneği nasıl sınıflandırdığını ve hangi azaltımların tetiklediğini ortaya koyar. Bu bir politika aracı değil, okumaya yardımcı bir araç.

## Ship It — Kullanıma Sun

`outputs/skill-cross-policy-diff.md` , üç framework'yu referans olarak kullanarak belirli bir yetenek için politikalar arası bir karşılaştırma üretir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Diff aracının çıktısının, kaynak belgelere göre doğrulayabileceğiniz en az iki yeteneğe ilişkin politikalarla eşleştiğini doğrulayın.

2. OpenAI Hazırlık Framework v2'nin tamamını okuyun. Her Araştırma Kategorisini tanımlayın. Her biri için neden Takip Edilen yerine Araştırma'da yer aldığına dair bir cümle yazın.

3. DeepMind FSF v3'ün tamamını ve ayrıca Nisan 2026 Takip Edilen Yetenek Düzeyleri güncellemesini okuyun. Makine öğrenimi Ar-Ge özerkliği düzey 1'in özel değerlendirme kriterlerini tanımlayın. Bunu dışarıdan nasıl ölçersiniz?

4. Kum Torbalama, OpenAI'nin Araştırma Kategorileri arasındadır. Bir kum torbası modelini gerçek kapasitesini ortaya çıkarmaya zorlayacak bir değerlendirme tasarlayın. Ders 1 değerlendirme-bağlam-oyun tartışmasına bakın.

5. Belirli bir yeteneğe (seçiminiz) ilişkin üç politikayı karşılaştırın. Hangi politikanın sınıflandırmasını en katı, hangisini en az bulduğunuz belirtin. Kaynak metinle gerekçelendirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Hazırlık Framework | "OpenAI'nin ölçeklendirme politikası" | PF v2 (Nisan 2025); Takip Edilen ve Araştırma kategorileri |
| Takip Edilen Kategori | "Zorunlu azaltım" | Yetenekleri Tetikler + Raporları Korur; SAG incelemesi |
| Araştırma Kategorisi | "Yalnızca izlenen" | Takip ediliyor ancak otomatik azaltma yok; Uzun Menzilli Özerkliği içerir |
| Sınır Güvenliği Framework | "DeepMind'in ölçeklendirme politikası" | FSF v3 (Eylül 2025) + Takip Edilen Yetenek Düzeyleri (Nisan 2026) |
| CCL | "Kritik Yetenek Düzeyi" | Alan başına DeepMind eşiği (Siber, Biyo, ML Ar-Ge, KBRN) |
| ML Ar-Ge özerkliği seviye 1 | "Ar-Ge otomasyonu" | AI Ar-Ge hattını rekabetçi maliyetle tamamen otomatikleştirin |
| Kum torbalama | "Stratejik düşük performans" | Model, değerlendirmelerde düşük performans gösteriyor; OpenAI Araştırma Kategorilerinde |
| Araçsal akıl yürütme | "Araç-sonuç muhakemesi" | Hedeflere nasıl ulaşılacağı konusunda akıl yürütme; DeepMind izlemenin hedefi |

## Daha Fazla Okuma

- [OpenAI — Hazırlık Durumumuzu Güncelliyoruz Framework](https://openai.com/index/updating-our-preparedness-framework/) — v2 duyurusu.
- [OpenAI — Hazırlık Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) — tam belge.
- [DeepMind — Sınır Güvenliğimizi Güçlendiriyoruz Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — FSF v3 duyurusu.
- [DeepMind — Sınır Güvenliğinin Güncellenmesi Framework (Nisan 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) — Takip Edilen Yetenek Seviyeleri ilavesi.
- [Gemini 3 Pro FSF Raporu](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) — FSF formatındaki Risk Raporu örneği.
