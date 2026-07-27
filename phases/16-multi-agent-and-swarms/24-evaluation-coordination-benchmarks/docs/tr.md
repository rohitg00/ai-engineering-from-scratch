# Değerlendirme ve Koordinasyon Benchmark'lar

> Beş 2025-2026 benchmark, çoklu-agent değerlendirme alanını kapsıyor. **ÇokluAgentBench / MARBLE** (ACL 2025, arXiv:2503.01935), kilometre taşı KPI'larıyla yıldız/zincir/ağaç/grafik topolojilerini değerlendirir; **grafik araştırma için en iyisidir**, bilişsel planlama ~%3 dönüm noktası başarısı sağlar. **COMMA** çok modlu asimetrik bilgi koordinasyonunu değerlendirir; GPT-4o dahil en son teknolojiye sahip modeller, rastgele bir temel çizgiyi geçmekte zorlanıyor. **MedAgentBoard** (arXiv:2505.12371) dört tıbbi görev kategorisini kapsar ve çoğu zaman çoklu-agent'ın tek LLM'ye hakim olmadığını tespit eder. **AgentArch** (arXiv:2509.10769) benchmark'ın araç kullanımı + bellek + düzenlemeyi birleştiren kurumsal agent mimarileri. **SWE-bench Pro** ([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)) iş uygulamalarını, B2B hizmetlerini ve geliştirici araçlarını kapsayan 41 depoda 1865 soruna sahiptir; Sınır modelleri Pro'da ~%23, Verified'da ise %70+ puan alıyor; bu, kontaminasyon konusunda bir gerçeklik kontrolü. Claude Opus 4.7 (Nisan 2026), Pro'da **%64,3** olarak ve açık agent-ekip koordinasyonu ile rapor edilmiştir (henüz yayınlanmış Antropik birincil kaynak yoktur - ön hazırlık olarak ele alın); Verdent (agent iskele), Doğrulandı'da **%76,1 pass@1**'e ulaştı ([Verdent teknik raporu](https://www.verdent.ai/blog/swe-bench-verified-technical-report)). **AAAI 2026 Köprü Programı WMAC** (https://multiagents.org/2026/) , 2026 topluluğunun odak noktasıdır. Bu ders MARBLE'ın metriklerini temel alır, topoloji ve metrik taraması yapar ve "sadece SWE-bench Onaylı'yı geçmek genellemenin kanıtı değildir" kuralını sabitler.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 15 (Oylama ve Tartışma Topolojisi), Aşama 16 · 23 (Başarısızlık Modları)
**Süre:** ~75 dakika

## Sorun

Bir makale "bizim çoklu-agent sistemimiz daha iyi" iddiasında bulunduğunda soru şu: neye göre, neye göre, nasıl ölçüldü? 2023-2024 çoklu-agent değerlendirme dönemi tam bir kaostu; herkes kendi metriklerini, kendi temel çizgilerini ve kendi görev setlerini seçti. 2025-2026 benchmark'nın dayatılan yapısı.

Paylaşılan benchmark'lar olmadan, iki çoklu-agent sistemi anlamlı bir şekilde karşılaştıramazsınız. Daha da kötüsü, benchmark'lari geciktirmedikçe sınır modelleri kirlenebilir. SWE-bench Verified, 2025 ortalarında eğitim kurumlarında kısmen kirlenmiş hale geldi; sınır puanları şişirildi; Pro, kirlenmemiş bir gerçeklik kontrolü olarak tasarlandı.

Bu ders beş kanonik 2026 benchmark'ı sıralar, her birinin neyi ölçtüğünü belirtir ve size benchmark iddialarını şüpheci bir şekilde okumayı öğretir.

## Konsept

### ÇokluAgentTezgah (MERMER) — ACL 2025

arXiv:2503.01935. Araştırma, kodlama ve planlama görevlerinde dört koordinasyon topolojisini (yıldız, zincir, ağaç, grafik) değerlendirir. Kilometre taşına dayalı KPI'lar yalnızca nihai başarıyı değil kısmi ilerlemeyi izler.

Ölçülen sonuçlar:

- **Grafik** topolojisi araştırma senaryoları için en iyisidir; her türlü eleştiriyi destekler.
- **Zincir** adım adım iyileştirme kodlaması için en iyisidir.
- **Yıldız**, hızlı olgusal konsolidasyon için en iyisidir.
- **Koordinasyon vergisi** grafikte ~4 agent saniyeden sonra görünüyor.
- **Bilişsel planlama**, topolojilerde ~%3 dönüm noktası başarısı sağlar.

Şu durumlarda kullanın: koordinasyon topolojilerini elmalar ile elmalar arasında karşılaştırmak istediğinizde. MERMER deposu (https://github.com/ulab-uiuc/MARBLE) değerlendiriciyi sağlar.

### COMMA — çok modlu asimetrik bilgi

agent'ların farklı gözlem yöntemlerine sahip olduğu ve tam bilgi paylaşımı olmadan koordine edilmesi gereken görevleri kapsar. Bildirilen sonuç rahatsız edicidir: GPT-4o dahil olmak üzere öncü modeller, COMMA'da agent-agent işbirliğinde **rastgele temel çizgiyi** aşmak için mücadele ediyor. Sinyal, çoklu agent yöntemlerin yeterince eğitilmediği ve yeterince değerlendirilmediğidir — LLM'ler tek yöntemli işbirliğini makul bir şekilde ele alır; Çok modlu koordinasyon çöker.

Şu durumlarda kullanın: sisteminizde çok modlu veya asimetrik bilgi koordinasyonu varsa. COMMA'dan gelen null sonuç, talepte bulunmadan önce ölçülmesi gereken bir uyarıdır.

### MedAgentYönetim Kurulu — alan adı stres testi

arXiv:2505.12371. Dört tıbbi görev kategorisi: tanı, tedavi planlama, rapor oluşturma, hasta iletişimi. Çoklu-agent ile tek-LLM ve geleneksel kural tabanlı sistemleri karşılaştırır.

Bulgu: multi-agent çoğu kategoride tek LLM'ye hakim DEĞİLDİR. Çoklu-agent avantajı dar kapsamlıdır — alt görevler açıkça ayrılabilir olduğunda (teşhis + tedavi) görev ayrıştırması yardımcı olur; Koordinasyon yükü uzmanlık kazancını (rapor oluşturma) aştığında acı verir.

Şu durumlarda kullanın: Alan adınız net tek LLM taban çizgisine sahip. MedAgentBoard'ın dersi genellenirse, önerilen çoğu çoklu-agent sistem aşırı mühendislikten geçmiştir.

### AgentArch — kurumsal mimariler

arXiv:2509.10769. Araç kullanımı, bellek ve düzenlemenin bir arada yer aldığı kurumsal ayarlar. Benchmark her katmanın katkısını izole eder: araç eklemek ne kadar yardımcı olur? Bellek mi ekliyorsunuz? Çoklu-agent orkestrasyonu mu ekliyorsunuz?

Şu durumlarda kullanın: kurumsal bir agent yığını tasarlıyorsunuz ve her katmanı doğrulamanız gerekiyor. AgentArch, değerini ölçemediğiniz özellikleri satın almaktan kaçınmanıza yardımcı olur.

### SWE-bench Pro — gerçeklik kontrolü

arXiv:2509.16941. İş uygulamalarını, B2B hizmetlerini ve geliştirici araçlarını kapsayan 41 veri havuzunda 1865 sorun. Daha sonraki eğitim kesintilerinde **kirlenmeyecek** şekilde tasarlandı. Frontier modelleri Pro'da ~%23, Verified'da ise %70+ puan alıyor. Boşluk kirlenme sinyalidir.

Nisan 2026 puanları:
- Pro'da Claude Opus 4.7: **%64,3** (açıkça agent-ekip koordinasyonuyla rapor edilmiştir; henüz yayınlanmış Antropik birincil kaynak yoktur — ön değerlendirme olarak ele alın).
- Verdent (agent iskele) Doğrulandı: **%76,1 pass@1** ([teknik rapor](https://www.verdent.ai/blog/swe-bench-verified-technical-report)).
- agent iskelesi olmayan Pro'da sınır ham puanları: ~%23-35 ([SWE-bench Pro makalesi](https://arxiv.org/abs/2509.16941)).

Çıkarılan sonuç: "SWE-Bench Onaylı'yı yendik" artık yeteneğin kanıtı değil. Pro mevcut geçit testidir. Agent-ekip iskelesi, 2026'da çoklu-agent koordinasyonu için en güçlü ampirik argümanlardan biri olan Pro'da (~30-40 puan delta) ölçülebilir kazançlar üretir.

### AAAI 2026 WMAC

AAAI 2026 Köprü Programı — Çoklu-Agent Koordinasyonu (https://multiagents.org/2026/) Çalıştayı. Çokluagent yapay zeka araştırmaları için 2026 topluluğunun odak noktası. Kabul edilen makaleler ve çalıştay tutanakları, yeni yöntemlerin değerlendirilmesi için standart ortamlardır; üretim kararları için arXiv ön baskılarına ilişkin WMAC tarafından kabul edilen hak taleplerini erteleyin.

### benchmark iddiasını şüpheyle okuyun — 2026 kontrol listesi

Birisi multi-agent sonucunu talep ettiğinde:

1. **Hangi benchmark, hangi bölünme?** SWE-bench Verified vs Pro çok önemli. Yanlış bölünmeyle ilgili bildirilen bir sayının hiçbir değeri yoktur.
2. **Kirlenme kontrolü.** benchmark modelin eğitim kesintisinden sonra mı piyasaya sürüldü? Değilse, dikkatli davranın.
3. **Temel karşılaştırma.** Tek yüksek lisans temel çizgisine karşı, rastgele, önceki çoklu agent çalışmaya karşı. "Aynı sistemin ayarlanmamış versiyonuna karşı" değil.
4. **İstatistiksel anlamlılık.** N deneme, p değeri, güven aralığı. Sınır modelleri yüksek varyansa sahiptir; tek koşu yanıltıcıdır.
5. **Görev çeşitliliği.** Tek bir görev mi yoksa birçok görev mi? Genelleme üretim için önemlidir.
6. **Maliyet açıklaması.** Görev başına Tokens, duvar saati. 20 kat maliyetle %90'lık bir çözüm, bir yetenek iddiası değil, iş kararıdır.

### benchmark'lardan hiçbirinin iyi ölçemediği şey

- **Uzun ufuk koordinasyonu.** Günlerce duvar saati etkileşimi. Mevcut benchmark'ların tümü kısa sürüyor.
- **Düşmanca dayanıklılık.** Bir agent kötü niyetli olduğunda veya güvenliği ihlal edildiğinde ne olur?
- **deployment altında kayma.** Benchmark'ler statiktir; Üretim dağılımları değişiyor.
- **Maliyete göre normalleştirilmiş performans.** Çoğu benchmark dolar başına doğruluğu değil ham doğruluğu rapor eder.

Gerçekten önemsediğiniz eksen için kendi dahili benchmark'nizi oluşturmak çoğu zaman doğru harekettir.

## Build It — Kendin Geliştir

`code/main.py` etkileşimli olmayan bir incelemedir:

- Bir oyuncak görevinde 3 çoklu-agent sistemi simüle eder.
- Her biri için MARBLE tarzı dönüm noktası ölçümlerini hesaplar.
- Bir "eğitim" setindeki görevleri saklayarak bir kontaminasyon kontrolü gerçekleştirir.
- Rastgele bir temel çizgiyle açıkça karşılaştırır.
- benchmark-talep puan kartını yazdırır.

Koşmak:

```bash
python3 code/main.py
```

Beklenen çıktı: Ham doğruluk, kilometre taşı başarısı, görev başına maliyet, rastgele temel değer farkı ve kontaminasyon kontrol notu içeren sistem puan kartı.

## Use It — Hazır Araçla Uygula

`outputs/skill-benchmark-reader.md` herhangi bir çoklu-agent benchmark iddiasını okur ve inceleme kontrol listesini uygular. Çıktı: bir not ve uyarılar.

## Ship It — Kullanıma Sun

Üretim değerlendirme disiplini:

- **Gerçek üretim dağıtımınızı yansıtan dahili bir benchmark** oluşturun. Herkese açık benchmark'lar bilgi verir ancak değiştirmez.
- **Her karşılaştırmaya rastgele bir temel değer ekleyin**. Bir koordinasyon görevinde büyük bir farkla rastgele geçemezseniz, görev yanlış konumlanmış olabilir.
- **Doğruluğun yanı sıra maliyeti de bildirin.** Token maliyet ve duvar saati. Operasyon ekiplerinin her ikisine de ihtiyacı var.
- **benchmark'ı üç ayda bir yeniden oluşturun.** Üretim dağıtımı değişiklikleri; bayat benchmark'lar yanıltıyor.
- **Yayınlanan-benchmark aşırı uyumdan kaçının.** Ekibiniz özellikle SWE-bench Pro sayıları için optimizasyon yapıyorsa, üretimde gerileyeceksiniz.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Simüle edilen üç sistemden hangisinin en iyi kilometre taşı başına maliyete sahip olduğunu belirleyin. En yüksek ham doğruluk sistemiyle eşleşiyor mu?
2. ÇokluAgentBench'i (arXiv:2503.01935) okuyun. Kendi görev alanınız için MARBLE'ın dört topolojiden hangisini önereceğine karar verin. Makalenin sonuçlarını gerekçelendirin.
3. SWE-bench Pro makalesini okuyun. Onu özellikle kirlenmeye karşı dayanıklı kılan şey nedir? Aynı teknik önemsediğiniz diğer benchmark'lara da uygulanabilir mi?
4. COMMA'nın çok modlu koordinasyon bulgusunu okuyun. Dahili benchmark'ınıza ekleyebileceğiniz basit, çok modlu bir koordinasyon görevi tasarlayın. Yararlı bir sinyal olarak ne sayılır?
5. benchmark-iddialar kontrol listesini yeni bir çoklu-agent makalenin manşet sonucuna uygulayın. İddiaya hangi notu verirsiniz?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MERMER | "ÇokluAgentBank" | EKL 2025; Dönüm noktası KPI'larına sahip yıldız/zincir/ağaç/grafik topolojileri. |
| virgül | "Çok modlu benchmark" | Multimodal asimetrik bilgi koordinasyonu; sınır modelleri rastgele vs mücadele ediyor. |
| OrtaAgentYönetim Kurulu | "Etki alanı stres testi" | Dört tıbbi kategori; sıklıkla multi-agent'ın tek LLM'ye hakim olmadığını bulur. |
| AgentKemer | "Kurumsal benchmark" | Araçlar + bellek + düzenleme katmanlı. |
| SWE-tezgah Pro | "Kirlenmeye karşı dayanıklı" | 1865 problem, 41 depo; Doğrulanmış'ta ~%23'e karşı %70+ (kontaminasyon sinyali). |
| Dönüm noktası başarısı | "Kısmi kredi" | Benchmarkyalnızca nihai başarıyı değil ilerlemeyi de ödüllendirir. |
| Kirlenme | "Benchmark eğitime sızdı" | Yayınlandıktan sonra benchmark'lar eğitim külliyatına sürükleniyor; puanlar şişiyor. |
| WMAC | "AAAI 2026 Köprü Programı" | Çoklu-Agent Koordinasyonu Çalıştayı; topluluk odak noktası. |

## Daha Fazla Okuma

- [ÇokluAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — dönüm noktası KPI'ları ile topoloji benchmark
- [MARBLE deposu](https://github.com/ulab-uiuc/MARBLE) — referans uygulaması
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) — etki alanı stres testi; multi-agent genellikle baskın değildir
- [AgentArch](https://arxiv.org/abs/2509.10769) — kurumsal agent mimarileri
- [SWE sıralaması skor tabloları](https://www.swebench.com/) — Sınır modelleri için Doğrulanmış ve Profesyonel puanlar
- [AAAI 2026 WMAC](https://multiagents.org/2026/) — 2026 topluluğunun odak noktası
