# Müzakere ve pazarlık

> Agent kaynakları, fiyatları, görev tahsislerini ve şartları müzakere eder. 2026 benchmark seti açık: NegotiationArena (arXiv:2402.05863), Yüksek Lisans'ların kişisel manipülasyon ("çaresizlik") yoluyla kazançları ~%20 artırabildiğini gösteriyor; "Pazarlık Yeteneklerini Ölçme" (arXiv:2402.15813), alıcının satıcıdan daha zor olduğunu ve ölçeğin yardımcı olmadığını gösteriyor — **OG-Anlatıcı** (deterministik teklif oluşturucu + LLM anlatıcı) anlaşma oranını %26,67'den %88,88'e yükseltti; Büyük Ölçekli Otonom Müzakere Yarışması (arXiv:2503.06416) yaklaşık 180 bin müzakere yürüttü ve **düşünce zincirini gizlemenin** agent'ın muhakemeyi muadillerinden gizleyerek kazandığını buldu; Bhattacharya ve ark. Harvard Müzakere Projesi ölçümlerine göre 2025, Llama-3'ü en etkili, Claude-3 agresif, GPT-4'ü en adil olarak sıraladı. Bu ders, Sözleşme Net Protokolünü (FIPA'nın atası, Ders 02) uygular, LLM tarzı bir alıcı/satıcıyla bağlantı kurar, OG-Anlatıcı tarzı bir ayrıştırma gerçekleştirir ve her yapısal seçimle anlaşma oranının nasıl değiştiğini ölçer.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 02 (FIPA-ACL Mirası), Aşama 16 · 09 (Paralel Swarm Ağları)
**Süre:** ~75 dakika

## Sorun

İki agent'ın bir fiyat üzerinde anlaşması gerekiyor. Saf dille kendi başlarına bırakılan prompt'lar, 2024-2026 LLM'ler şaşırtıcı derecede düşük oranlarda anlaşmalar kapatıyor (arXiv:2402.15813'te sıkı şekilde parametrelendirilmiş pazarlıklarda ~%27). Ölçek sorunu çözmüyor: GPT-4 yapısal olarak pazarlık konusunda GPT-3.5'ten daha iyi değil; pazarlık *dilinde* daha iyidir.

Temel sorun, Yüksek Lisans'ların iki işi birleştirmesidir: teklife karar vermek ve teklifi anlatmak. OG-Anlatıcı bunları ayırdı: deterministik bir teklif oluşturucu sayısal hareketleri hesaplar; Yüksek Lisans yalnızca anlatır. Anlaşma oranı ~%89'a yükseldi.

Bu, klasik bir çoklu-agent bulgusunu yansıtır: mekanizmayı iletişim katmanından ayırmak kazanır. Sözleşme Ağı Protokolü (FIPA, 1996; Smith, 1980) referans görev pazarı mekanizmasıdır. Anlatım yuvasına bir Yüksek Lisans Diploması taktığınızda, yüksek lisans destekli modern bir görev pazarına sahip olursunuz.

## Konsept

### Sözleşme Ağı, tek paragrafta

Smith'in 1980 Sözleşme Net Protokolü: bir **yönetici** bir **teklif çağrısı (cfp)** yayınlar; **teklif verenler** tekliflerini içeren **teklif** mesajlarıyla yanıt verir; yönetici bir kazanan seçer ve kazanana **teklifi kabul et**, kaybedenlere ise **teklifi reddet** gönderir. Kazanan işi gerçekleştirir. İsteğe bağlı mesaj: **reddet** (teklif sahibi teklif vermeyi reddeder). FIPA bunu `fipa-contract-net` etkileşim protokolü olarak kodladı.

### OG-Anlatıcı neden kazanıyor?

"Dil Modellerinin Pazarlık Yeteneklerini Ölçme" (arXiv:2402.15813) şunu gözlemledi:

- LLM'ler sıklıkla pazarlık kurallarını çiğnerler (saçma fiyatlar teklif edin, karşı tarafın ZOPA'sını göz ardı edin).
- Zayıf bir şekilde demir atarlar (kötü ilk teklifleri kabul ederler; stratejik miktarlardan ziyade sembolik miktarlarda karşı teklifler yaparlar).
- Ölçek tek başına bunları düzeltmez. Daha büyük modeller, benzer stratejik hatalarla daha makul bir dil sağlar.

OG-Anlatıcı ayrıştırması:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

Teklif oluşturucu klasik bir müzakere stratejisidir: Rubinstein pazarlık modeli, Zeuthen stratejisi veya fiyat üzerinden basit bir kısasa kısas. LLM anlatıyor. Mesaj deterministik fiyatı ve doğal dil çerçevesini içerir.

Anlaşma oranı yükseliyor çünkü:
- Fiyatlar pazarlık bölgesinde kalıyor.
- Çapalar stratejiktir, duygusal değil.
- Yüksek Lisans iyi olduğu şeyi yapıyor: yazmak.

### MüzakereArena bulguları

arXiv:2402.05863 kanonik benchmark değerini sağlar. Başlık bulguları:

- Yüksek Lisans'lar, kişilikleri benimseyerek getirilerini ~%20 artırabilir ("Bunu Cuma'ya kadar satmak için sabırsızlanıyorum") - kişi manipülasyonu gerçek bir taktiktir.
- Adil/işbirlikçi agent'lar düşman olanlar tarafından istismar edilir; Savunma açık bir karşı duruş gerektirir.
- Simetrik eşleşmeler, benchmark senaryolarının yaklaşık %40'ında adaletsiz sonuçlara yaklaşmaktadır.

Bu "LLM'ler kötü müzakerecilerdir" değil. "LLM'ler, sömürülebilir kısımlar da dahil olmak üzere, insanlar gibi çok fazla pazarlık yapıyor."

### Düşünce zincirini gizleme

Büyük Ölçekli Otonom Müzakere Yarışması (arXiv:2503.06416), birçok Yüksek Lisans stratejisinde ~180 bin müzakere gerçekleştirdi. Kazananlar gerekçelerini muadillerinden gizlediler:

- Eğer bir agent herkesin görebileceği bir karalama defterine "Sadece $75; my reservation price is $70'e gideceğim" yazarsa, rakip bunu okur.
- Kazananlar stratejiyi özel olarak hesaplar; çıkış kanalı yalnızca teklifi ve gereken minimum anlatımı içerir.

Bu, klasik oyun teorisinin (rasyonellik ve bilgi üzerine 1976 Aumann 1976) 2026'daki bir yankısıdır: özel değerleme maliyetlerinizin getirisini açığa çıkarır. Yüksek Lisans'lar bunu sezmezler ve karşı tarafın görebileceği akıl yürütme izlerine çekincelerini memnuniyetle yazarlar.

Mühendislik çıkarımı: özel not defteri bağlamını genel mesaj bağlamından ayırın. İsteğe bağlı değil.

### Bhattacharya ve ark. 2025 — model sıralamaları

Harvard Müzakere Projesi ölçümlerine ilişkin (ilkeli müzakere, BATNA saygısı, karşılıklı çıkarlar):

- **Llama-3** pazarlık yapmada (anlaşma oranı + getiri) en etkili olanıydı.
- **Claude-3** en agresif müzakereciydi (yüksek çıpalar, geç tavizler).
- **GPT-4** en adil olanıydı (eşleşmeler arasında getiride en küçük fark).

Bu 2025 yılına ait bir anlık görüntü. Önemli olan Nisan 2026'da hangi modelin kazanacağı değil; farklı temel modellerin kalıcı müzakere tarzlarına sahip olmasıdır. Heterojen topluluklar (Ders 15) bunu bir çeşitlilik kaynağı olarak içerir.

### Contract Net + LLM aracılığıyla görev tahsisi

LLM multi-agent için Contract Net'in modern yeniden kullanımı:

1. Yönetici agent bir görevi birimlere ayırır.
2. `cfp` 'yi görev açıklamasıyla birlikte çalışan agent'lara yayınlar.
3. Her çalışan bir teklif döndürür: `(price, eta, confidence)` ; burada fiyat tokens, hesaplama birimleri veya dolar olabilir.
4. Yönetici kazananları (göreve bağlı olarak tek veya birden fazla) ve ödülleri seçer.
5. Reddedilen işçiler diğer görevler için teklif vermekte özgürdür.

Bu, 100 çalışanın çok ötesine geçen bir ölçektir çünkü koordinasyon eşzamanlı sohbet değil, yayınla ve yanıtla şeklindedir. Üretimde kullanılır: Microsoft Agent Framework'nin düzenleme kalıpları, bazı LangGraph uygulamaları.

### Yüksek Lisans-Paydaşlar İnteraktif Müzakere

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) , **gizli puanlara** ve **minimum kabul eşiklerine** sahip çok taraflı puanlanabilir oyunlar sunuyor. Her paydaşın özel hizmetleri vardır; Yüksek Lisans bunları mesajlardan çıkarmalıdır. Bu, iki partili pazarlığın N partili koalisyon oluşumuna genelleştirilmesidir. Heterojen işçi yeteneklerine sahip üretim görev pazarlarıyla ilgilidir.

### Anlatım-mekanizma kuralı

Tüm 2024-2026 müzakere benchmark'larinde tutarlı mühendislik kuralı şöyledir:

> Yüksek Lisans'ın anlatmasına izin verin. LLM'nin teklifi hesaplamasına izin vermeyin.

Teklifin bir sayı olması gerekiyorsa (fiyat, ETA, miktar), bunu pazarlık durumundan belirleyici bir şekilde oluşturun ve LLM'nin çerçeveyi üretmesini sağlayın. Teklifin bir teklif yapısı olması gerekiyorsa (görev ayrıştırma, rol atama), LLM'nin taslağını hazırlamasına izin verin, ancak bunu bir şemaya göre doğrulayın ve göndermeden önce kısıtlama kontrolü yapın.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `ContractNetManager`, `ContractNetTask`, `Bid` — yönetici + teklif verenler, CFP yayını, teklif toplama, ödüllendirme.
- `og_narrator_bargain(state, rng)` — OG-Anlatıcı alıcısı: orta noktaya doğru deterministik Zeuthen tarzı imtiyaz.
- `seller_response(state, rng)` — deterministik satıcı karşı teklif politikası (her iki stil için de yapısal temel gerçek).
- `naive_llm_bargain(state, rng)` — tamamı LLM pazarlığını simüle eder: genellikle ZOPA dışında, yüksek değişkenliğe sahip fiyatları seçer.
- Ölçüm: deneme başına örneklenen yeni rezervasyon fiyatlarıyla 1000 denemenin üzerindeki anlaşma oranı.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: saf LLM anlaşma oranı ~%65-75; OG-Anlatıcı anlaşma oranı ~%85-95; 15-25 puanlık fark, teklif üretmeyi anlatımdan ayrıştırmanın yapısal avantajıdır. Ayrıca üç teklif sahibi ve bir görevden oluşan bir Sözleşme Net görev pazarı tahsis örneği.

## Use It — Hazır Araçla Uygula

`outputs/skill-bargainer-designer.md` bir pazarlık protokolü tasarlar: teklifleri kim üretir (deterministik veya LLM), kim anlatır, özel karalama defterlerinin genel mesajlardan nasıl ayrıldığını ve anlaşma oranının nasıl izlendiğini.

## Ship It — Kullanıma Sun

Üretim pazarlığı kontrol listesi:

- **Ayrı karalama defteri.** Özel durum hiçbir zaman karşı tarafın bağlamına ulaşmaz. Bu tartışılamaz.
- **Deterministik teklif oluşturma.** Fiyatlar, miktarlar, ETA'lar: hesaplama, yapma prompt.
- **Gelen tüm teklifleri bir şemaya göre doğrulayın**. ZOPA dışı teklifleri protokol sınırında reddedin.
- **Bağlantılı turlar.** Maksimum 3-5 tur; Kilitlenme durumunda arabulucuya ilerleyin.
- **Anlaşma oranını ve getiri farkını sürekli olarak ölçün**. Düşen anlaşma oranı bir semptomdur; genellikle bir prompt kayması veya karşı tarafın saldırısıdır.
- **Reddedilen tüm teklifleri deterministik gerekçeyle günlüğe kaydedin**. Contract Net yöneticileri için, kaybeden teklif sahiplerinin bunun nedenini anlaması gerekir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. OG-Anlatıcı'nın anlaşma oranında saf-LLM'yi geride bıraktığını doğrulayın. Ne kadar?
2. **kişiye dayalı getiri iyileştirmesi** (arXiv:2402.05863) uygulayın — alıcı, yalnızca anlatımda "bu hafta satın almak için çaresiz" kişiliğini benimser, teklif oluşturucu değişmez. Anlaşma oranı veya getirisi değişir mi?
3. Düşünce zincirini uygulayın **gizleme**: karşı tarafa aktarılmayan özel bir karalama defteri dizisi tutun. Yanlışlıkla sızdırırsanız ne olur (kanalları değiştirerek simüle edin)?
4. Sözleşme Net'ini rezerv fiyatıyla N teklifli açık artırmasına kadar uzatın. Tekliflerin tümü rezervi aştığında yönetici en düşük fiyat ile en yüksek kalite arasında nasıl karar verecektir? Hangi ödül kuralını seçiyorsunuz ve neden?
5. Bhattacharya ve ark.'yı okuyun. Harvard Müzakere Projesi ölçümlerine ilişkin 2025. Farklı tarzlara sahip iki pazarlıkçı uygulayın (agresif ve adil). Simetrik ve asimetrik eşleştirmeler altında getiri farkını ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Sözleşme Ağı | "Görev pazarı" | Smith 1980, FIPA 1996. cfp + öner + kabul et/ret. Kanonik görev pazarı. |
| ZOPA | "Muhtemel anlaşma bölgesi" | Alıcının maksimum değeri ile satıcının minimum değeri arasındaki örtüşme. Bunun dışındaki teklifler kapatılamaz. |
| BATNA | "Müzakere edilmiş bir anlaşmaya en iyi alternatif" | Bu anlaşma başarısız olursa geri dönüşünüz. Rezervasyon fiyatınızı belirler. |
| OG-Anlatıcı | "Teklif oluşturucu + anlatıcı" | Ayrıştırma: deterministik teklif, Yüksek Lisans anlatımı. |
| Zeuthen stratejisi | "Riski en aza indiren taviz" | Risk limitlerine göre taviz veren klasik teklif oluşturucu. |
| Rubinstein pazarlığı | "Alternatif teklif dengesi" | İndirimli sonsuz ufuklu pazarlık için oyun teorik modeli. |
| CoT gizleme | "Mantığınızı gizleyin" | arXiv:2503.06416 kazananları özel not defterlerini muhafaza etti; yalnızca herkese açık kanal şovları teklifi. |
| Kişilik manipülasyonu | "Duygusal duruş" | arXiv:2402.05863: Çaresizlik/aciliyet kişiliklerinden ~%20 getiri kazancı. |

## Daha Fazla Okuma

- [NegotiationArena](https://arxiv.org/abs/2402.05863) — benchmark; kişisel manipülasyon ve istismar bulguları
- [Dil Modellerinin Pazarlık Yeteneklerini Ölçme](https://arxiv.org/abs/2402.15813) — OG-Anlatıcı ve satıcıdan daha zor alıcı sonucu
- [Büyük Ölçekli Otonom Müzakere Yarışması](https://arxiv.org/abs/2503.06416) — ~180 bin müzakere; düşünce zincirini gizleme kazanır
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) — gizli yardımcı programlara sahip çok taraflı puanlanabilir oyunlar
- [Smith 1980 — Sözleşme Ağı Protokolü](https://ieeexplore.ieee.org/document/1675516) — klasik mekanizma, Bilgisayarlarda IEEE İşlemleri
