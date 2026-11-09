# OpenAI Hazırlık Çerçeve ve DeepMind Sınır Güvenlik Çerçeve

> OpenAI Hazırlık Çerçeve v2 (Epril 2025) Araştırma Kategorilerini  Uzun mesafeli özerklik, Kum çantası, özerk kopyalama ve uyarlama, korumaları bozan  izlenen kategorilerden farklı olarak tanıttı. İzlenen Kategoriler, Güvenlik Danışmanlık Grubu tarafından incelenen yetenek Raporları ve Güvenlik Raporları ile tetiklenir. DeepMind'in FSF v3 (Eylül 2025, 17 Nisan 2026) kendiliğinden ML R&D ve Siber alanlarına katılır (ML R&D kendiliğindenliği seviyesinin 1 = rekabetçi maliyet vs. insan + AI araçları ile AI R&D borusunu tamamen otomatikleştirir). FSF v3, araçsal akıl yürütme yanlış kullanımını otomatik izleme yoluyla yanıltıcı bir ayarlama ile açıkça ilgilenir. Dürüst bir not: PF v2'deki Araştırma Kategorileri (Uzun Aralıklı Otonomisi dahil) otomatik olarak hafiflemeleri tetiklemez; politika dili "potansiyel".

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool), TypeScript
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## Sorun

Ders 19 Anthropic'in ölçeklendirme politikasını yakından okudu. Bu ders, OpenAI'nin ve DeepMind'in resimlerini okuyarak resmi tamamlıyor. Üç belge aynı soruyu ele alan kuzeni eserlerdir  bir sınır laboratuvarı ne zaman durmalı veya bir model kapısı olmalıdır  ve küçük bir kategoride bir araya gelerek ve önemli olan belirli yerlerde farklılık gösterirler.

Dönüşüm: Üçü de uzun mesafeli özerkliği takip edilmeye değer bir kapasite sınıfı olarak etiketlenmiştir. Üçü de yanıltıcı davranışları (eğlence sahteliği, kum çantası) belirli bir risk sınıfı olarak kabul ederler. Üçü de iç bir inceleme organına sahiptir. Ayrılık: OpenAI kategorileri "İzlenmiş" (mümkün hafifletme) ve "Araştırma" (otomatik tetikleme yapılmamış) olarak bölüyor. DeepMind, kendi kendine isim vermek yerine, iki alanı özerklikle birleştirir. Laboratuvarlar Tracked vs Research veya Critical vs Moderate veya Tier-1 vs Tier-2 isimlerini kullanır. Bir yetenekin içinde yaşadığı operasyonel sonuçlar laboratuvarlar arasında farklıdır.

Bu özellikler arasında, Anthropic'de "mümkün hafifleme", OpenAI'de "önerleme yapılması, ancak tetikleme yapılması" ve DeepMind'de "belirli bir alanda izlenmesi" de yer alabilir.

## Anlaşım

### OpenAI Hazırlık Çerçevi v2 (Epril 2025)

Yapı:

- **Tracked Categories**Bu, bir diğer önemli gelişme olarak görülüyor.
- **Research Categories**: laboratuvarın takip ettiği ancak henüz belirli azaltmalara bağlı olmayan model yetenekleri.

V2'de anahtar çerçeve: Araştırma Kategorileri otomatik olarak hafiflemeleri tetiklemez. Politika dili "potansiyel" hafiflemelerdir. Bu izlemek için özel bir delta: Takip edilen vs Araştırma'da bir kategorinin yeri "kapalı" ve "otardığı" arasındaki bir sarmalıktır.

### DeepMind Frontier Güvenlik Çerçevi v3 (Eylül 2025; 17 Nisan 2026'da izlenilen yetenek seviyeleri eklendi)

Yapı:

- **Critical Capability Levels (CCLs)**: yetenek eşiği üç gruba ayrılmıştır: kötüye kullanımı (CBRN, Siber, Zararlı Manipülasyon), ML Araştırma ve Geliştirme ve bir keşifsel yanlış uyumlulık yolu.
- **Tracked Capability Levels**Ek olarak Nisan 2026'da ek bir granularlık. Konkret örnek: ML R&D özerkliği seviye 1 = rekabetçi maliyet karşılığında AI R&D borusunu tamamen otomatikleştirme karşılığında insan + AI araçlar.
- **Deceptive alignment monitoring**: araçsal akıl kullanımı kötüye kullanılması için otomatik izleme konusunda açık bir taahhüt.

Özerklik çerçevesinin OpenAI'den farklı olması. DeepMind "Özerlik" i üst düzey bir alan olarak tutmaz; özerklik zarar verecek alanlara (ML R&D ve Cyber) katlanır.

### Üçün de birleştiği

- İç Güvenlik Danışman Grubu (Anthropic SAG, OpenAI SAG, DeepMind iç komitesi olarak adlandırılır). Yüksek kapasiteli modeller için kullanımdan önce inceleme yapılır.
- Yanlış bir ayarlama / ayarlama sahteliği risk sınıfı olarak açıkça belirtilmiştir.
- Açıklanan bir kadens üzerinde kalıcı eserler (Antropik: Sınır Güvenliği Yol Haritası, Risk Raporu; OpenAI: Yetenekler ve Koruma Raporları; DeepMind: FSF güncelleme döngüsü).
- Sadece izleme savunmalarının bir tavanın olduğunu kabul etmek. DeepMind açıkça: "otomatik izleme uzun vadede yeterli olmayacak".

### Farklı yerlerde

- **Anthropic**: v3.0'da duraklı yükümlülük kaldırıldı; AI R&D-4 eşiği, bir sonraki kapı olarak adlandırıldı.
- **OpenAI**: İzleyici vs Araştırma bölümü; Araştırma Kategorileri (Uzun Uzakluk Özerklikleri dahil) otomatik olarak geçit geçmez.
- **DeepMind**: özerklik diğer alanlara katıldı; takip edilen yetenek seviyeleri Nisan 2026'da granularlık ekliyor.

### Kum çantası: üçü de karmaşıklaştıran belirli bir yetenek

Sandbagging (değerlendirmelerde stratejik olarak düşük performans gösteren bir model) OpenAI'nin Araştırma Kategorilerinde bulunmaktadır. Anthropic'in RSP v3.0 değerlendirme- bağlam boşluğu (Desin 1). DeepMind FSF v3'te yanıltıcı bir uyum izleme yoluyla bu sorunları ele alır.

Eğer bir model değerlendirme üzerinde kum çantaları varsa, her çerçeve'nin kapasite eşiği küçümselir. Çerçeve yalnızca ölçümün işe yaraması durumunda çalışır. Bu nedenle laboratuvar kendiliğinden değerlendirilmesi dışında dış ölçüm (Denevi 21, METR) ve karşıt değerlendirme gereklidir.

### Politikayı okumak becerisi

- Bul: ilgilendiğiniz her yetenek poliçede bulunmalıdır.
- Sınıflandır: izlenmiş mi (dönüştürme azaltımı) yoksa araştırma mı (izlenmiş mi, tetiklemeci değil)? OpenAI buna isim verir; Anthropic ve DeepMind'in kendi eşdeğerleri vardır.
- Cadence: politika açıklanan bir zaman çizelgesinde güncelleştiriliyor mu, yoksa sadece belirli olaylardan sonra mı?
- Bağımsızlık: dış inceleme zorunlu mu yoksa seçmeli mi? Apollo ve ABD AI Güvenlik Enstitüsü ile antropik ortaklar; METR ile OpenAI; iç SAG ile öncelikle DeepMind.

```figure
a5-tracked-vs-research
```

## Kullan

`code/main.py`Bu, bir bilgi kaynağı olarak kullanılır ve bir bilgi kaynağı olarak kullanılır. bu bilgi kaynağı, bir bilgi kaynağı olarak kullanılır.

## Gönder

`outputs/skill-cross-policy-diff.md`Üç çerçeveyi referans olarak kullanarak belirli bir kapasite için politikalar arası bir karşılaştırma yapar.

## Egzersizler

1. Çık .`code/main.py`. Farklı araçların çıktısının kaynak belgelere karşı doğrulanabilecek en az iki özellik için politikalara uymasını onaylayın.

2. OpenAI Hazırlık Çerçeve v2'yi tamamıyla okuyun. Her Araştırma Kategori'sini tanımlayın. Her biri için, takip edilmektense neden Araştırmada olduğunu bir cümle yazın.

3. DeepMind FSF v3'i tamamıyla okuyun, ayrıca Nisan 2026'da takip edilen yetenek seviyeleri güncelleme. ML R&D özerklik seviyesinin özel değerlendirme kriterlerini belirleyin.

4. Sandbagging OpenAI'nin Araştırma Kategori'sindedir. Sandbagging modelinin gerçek yeteneğini ortaya çıkarmak için zorlayacak bir değerlendirme tasarlayın.

5. Özel bir yetenekle ilgili üç politikayı karşılaştırın (seçiminize göre). Hangi politikayı en sıkı ve en azını sınıflandırmayı bulduğunuzu belirleyin. Kaynak metni ile haklı gösterin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (CBRN, Cyber, Harmful Manipulation, ML R&D) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Daha Fazla Okumak

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/)V2 duyuru.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) Tam belge.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/)FSF v3 duyuru.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) İzlenen Yeteneklilik Doluları eklenmesi.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) FSF biçimindeki Risk Raporu örneği.
