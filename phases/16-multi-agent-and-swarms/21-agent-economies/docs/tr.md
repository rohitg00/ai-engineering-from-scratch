# Agent Ekonomi, Token Teşvik, İtibar

> Uzun ufuklu özerk agent'lar (METR'nin 1 saatten 8 saate kadar çalışma eğrisi) ekonomik aracılığa ihtiyaç duyar. Ortaya çıkan **5 katmanlı yığın** şu şekildedir: **DePIN** (fiziksel bilgi işlem) → **Kimlik** (W3C DID'ler + itibar sermayesi) → **Biliş** (RAG + MCP) → **Yerleştirme** (hesap soyutlama) → **Yönetim** (Agentic DAO'lar). Üretim agent-teşvik ağları arasında **Bittensor** (TAO alt ağları göreve özel modelleri ödüllendirir), **Fetch.ai / ASI Alliance** (ASI-1 Mini LLM + FET token) ve **Gonka** (bilgi işlemi verimli AI görevlerine yeniden tahsis eden transformer tabanlı PoW) bulunur. Akademik çalışma: AAMAS 2025'in merkezi olmayan LaMAS'ı, katkıda bulunan agent'lari adil bir şekilde ödüllendirmek için **Shapley değeri kredi ilişkilendirmesini** kullanır; Google Araştırması "Büyük dil modelleri için mekanizma tasarımı", monoton toplama altında ikinci fiyat ödemeli **token açık artırma** önermektedir. Bu ders, minimum agent pazar yeri oluşturur, çoklu agent boru hattına Shapley değerinde kredi ilişkilendirmesi uygular ve oyun teorisi mekanizmasının somut bir şekilde devreye girmesi için ikinci fiyatlı bir token açık artırması yürütür.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 16 (Müzakere ve Pazarlık), Aşama 16 · 09 (Paralel Sürü Ağları)
**Süre:** ~75 dakika

## Sorun

Çoklu-agent sistemleri, agent'lar ortaklaşa değer ürettiğinde ancak bireysel olarak ödüllendirilmeleri gerektiğinde karmaşıklaşır. Klasik mekanizmalar (eşit bölünme, son katkıda bulunan her şeyi alır) adil değildir veya oynanabilir niteliktedir. Shapley değerleri aracılığıyla koalisyona dayalı ödüllendirme, yapı itibarıyla adildir ancak hesaplanması pahalıdır. 2025-2026 literatürü yararlı yaklaşımlar öne sürüyor: Shapley örneklemesi, monoton toplama açık artırmaları ve onaylanmış katkılardan elde edilen zincir içi itibar.

Kredi ilişkilendirmenin ötesinde, alan gerçek ekonomik agent'lare yöneldi: Bittensor TAO, alt ağa özel modellere ince ayar yapmak için madencilik hesaplamasını ödüllendiriyor, Fetch.ai/ASI, ASI-1 Mini LLM kullanımını FET token'larle ödüllendiriyor, Gonka, transformer iş kanıtını verimli yapay zeka görevlerine yeniden tahsis ediyor. Bağımsız olarak işlem yapan Agent'ler bugün mevcuttur; sorun teşviklerin nasıl hizalanacağıdır.

Bu ders, agent ekonomilerini belirli bir sorun ailesi olarak ele alır (kredi ilişkilendirmesi, mekanizma tasarımı ve itibar) ve fikirlerin kalıcı olması için her birini minimum matematikle oluşturur.

## Konsept

### 5 katmanlı agent-ekonomi yığını

1. **DePIN (fiziksel bilgi işlem).** GPU, depolama alanı ve bant genişliği kiralayan merkezi olmayan altyapı. Bittensor alt ağları, Render Ağı, Akash. agent'a özgü değil; agent'lar bunu kullanıyor.
2. **Kimlik.** W3C Merkezi Olmayan Tanımlayıcılar (DID'ler), her agent'a herhangi bir platformdan bağımsız, dayanıklı bir kimlik verir. İtibar DID'ye tahakkuk eder. Agent Ağ Protokolü (ANP), keşif katmanı olarak DID'yi kullanır.
3. **Biliş.** agent'ın akıl yürütme döngüsü: LLM + RAG + MCP. Diğer aşamaların inşa ettiği şey budur.
4. **Ödeme.** Hesap soyutlama (ERC-4337), agent'ların ETH tutmadan kendi bakiyelerinden gaz ödemesine olanak tanır. Agent'ler hizmetler, birbirleri veya bilgi işlem için ödeme yapabilir.
5. **Yönetim.** Agentic DAO'lar: insanların *ve* agent'larin protokol değişiklikleri üzerinde oy kullandığı, oylama gücünün itibara bağlı olduğu yönetim yapıları.

Her üretim sistemi beşinin tamamını kullanmaz. Bittensor 1, 2, kısmen 3, kısmen 4, 5'ten hiçbirini kullanmaz. OpenAI agent'lar 3 dışında hiçbirini kullanmaz. Yığın bir referans haritasıdır, bir gereklilik değil.

### Bittensor, Fetch.ai, Gonka — ne koşuyor

**Bittensor (TAO).** Alt ağlar uzmanlaşmış görevlerdir (dil modelleme, görüntü oluşturma, tahmin). Madenciler model çıktılarını sunar. Doğrulayıcılar onları sıralar; Bahis ağırlıklı puanlama TAO ödüllerini dağıtır. Her alt ağın kendi değerlendirmesi vardır. Ekonomik ders: kullanılan bilgi işlem için değil, göreve özgü çıktı kalitesi için ödeme yapın.

**Fetch.ai / ASI Alliance.** ASI-1 Mini LLM, Fetch.ai ağında çalışır; kullanıcılar inference için FET tokens öderler. agenteş-as-akran anlatımı burada daha güçlü: Fetch'teki bir agent, bir görev için başka birini arayabilir ve FET olarak ödeme yapabilir.

**Gonka.** Transformer işin kanıtı: "iş", bir transformer'nin ileri geçişleridir. Madenciler, doğru çıktıları (eğitim verilerinden) bilinen inference görevi çalıştırarak kazanırlar. Hash tabanlı PoW yerine kaynak üreten PoW.

Üçü de Nisan 2026 itibarıyla üretim düzeyindedir. Kazanç dağılımı farklıdır. Bittensor, alt ağ doğrulayıcılarına göre kaliteyi ödüllendirir; Ödeme yapan kullanıcılar tarafından ölçülen ödül alma faydası; Gonka, doğrulanabilir inference çalışmayı ödüllendiriyor.

### Shapley değeri kredi ilişkilendirmesi

Üç agent bir görev üzerinde işbirliği yapıyor. Çıktı puanı 0,8. Kim ne katkıda bulundu?

Shapley değeri: Dört aksiyomu (verimlilik, simetri, doğrusallık, sıfır) karşılayan benzersiz kredi tahsisi. agent `i` için:

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

burada `S_i_O` , `O` sıralamasında `i` öncesindeki agent'larin kümesidir. Uygulamada: tüm permütasyonları numaralandırın, her permütasyondaki her agent'ın marjinal katkısını kaydedin, ortalama.

N=3 agents için 6 permütasyon vardır. N=10, 3,6M için — pratikte sıralamaları sıralamak yerine örnek alırsınız.

### Toplama için ikinci fiyat açık artırması

Google Araştırması ("Büyük dil modelleri için mekanizma tasarımı") LLM çıktılarının toplanması için ikinci fiyatlı token açık artırmaları önermektedir. Kurulum: N agent'ın her biri bir tamamlama önerir; her birinin seçilmek için özel bir değeri vardır. Açık artırmacı en yüksek değerli teklifi seçer ve *ikinci en yüksek* değeri öder. Monoton toplama altında (değer, kaç teklif verildiğine değil, hangi teklifin seçildiğine bağlıdır), bu doğrudur - agent'lar gerçek değerlerini teklif ederler.

Bu, LLM sistemleri için neden önemlidir: tamamlama görevlerini farklı fiyatlandırmalarla birden fazla agent'a dış kaynak olarak sağlayabilirsiniz; açık artırma en iyiyi seçer + adil bir şekilde ödeme yapar ve agent'ların yanlış bildirimde bulunma teşviki yoktur.

### İtibar sermayesi

DID'ye bağlı itibar puanı, onaylanmış katkılardan toplanır. Basit bir güncelleme kuralı:

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

Bozunma faktörü `alpha` 1'e yakın.

- Yönlendirme kararları için okunması ucuzdur ("zor görevleri yüksek temsilcili agent'lara gönderin").
- Biçimlendirilmesi pahalıdır (zamanla birikir ve DID'ye bağlanır).
- Kesilebilir: doğrulamayı geçemeyen katkılar çıkarılır.

### AAMAS 2025 merkezi olmayan LaMAS

LaMAS teklifi (AAMAS 2025) şunları birleştirir: DID kimliği, Shapley değeri kredi ilişkilendirmesi ve basit bir açık artırma mekanizması. Temel iddia: Kredi ilişkilendirme adımının merkezi olmayan hale getirilmesi, sistemi denetlenebilir ve tek nokta manipülasyonuna karşı bağışık hale getirir.

### Ekonominin çöktüğü yer

- **Fiyat kehaneti manipülasyonu.** Eğer kredi fonksiyonu oynanabiliyorsa, agent'lar onu oynayacaktır. Her mekanizmanın çekişmeli bir teste ihtiyacı vardır.
- **Sybil saldırıları.** Bir operatör, kendi katkısını artırmak için N sahte agent'ı döndürür. DID'ler yavaşlar ama bunu durdurmaz; itibar yaratma maliyetinin azaltılmasıdır.
- **Doğrulama maliyeti.** Kredi ilişkilendirmesi yalnızca doğrulayıcı kadar adildir. Doğrulama ucuzsa (küçük LLM), oyun oynanabilir; pahalıysa (insan paneli), sistem ölçeklenmez.
- **Düzenleme sarkması.** Agent ekonomileri finansal düzenlemeyle kesişiyor. Bittensor, Fetch ve Gonka'nın tümü, 2026 itibarıyla bazı yargı bölgelerinde yasal olarak gri alanlarda faaliyet göstermektedir.

### agent ekonomi mantıklı olduğunda

- **Heterojen operatörlere sahip açık ağlar.** Tüm agent'ları tek bir ekip kontrol etmez.
- **Doğrulanabilir çıktılar.** Doğrulama olmadan kredi ilişkilendirmesi bir tahmindir.
- **Uzun vadeli iş akışları.** Tek seferlik görevler itibar birikiminden fayda sağlamaz.
- **Tokenözelleştirilmiş ödemeler sizin yargı alanınızda yasal olarak geçerlidir**.

Kapalı kurumsal sistemlerde ekonomi, yerini daha basit tahsise bırakır (yöneticiler işi atar, ölçütler dahilidir). Ekonomi literatürü çoğunlukla açık ağlara uygulanır.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `shapley(value_fn, agents)` — küçük N için numaralandırma yoluyla tam Shapley hesaplaması.
- `second_price_auction(bids)` — doğru mekanizma; kazanan ikinci en yüksek parayı öder.
- `Reputation` — Üstel azalma ve kesinti ile DID'ye bağlı itibar.
- Demo 1: Üç agent işbirliği yapıyor, Shapley'in nitelikleri tam olarak takdir ediliyor.
- Demo 2: bir görev yuvası için beş agent teklif; ikinci fiyat açık artırması kazananı + ödemeyi seçer.
- Demo 3: Heterojen temsilcilerle agent'lara 100 tur görev ataması; tekrar ağırlıklı yönlendirme rastgele atıyor.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: Her agent için Shapley değerleri; doğru teklif dengesini gösteren açık artırma sonucu; Isınmadan sonra rastgele üzerinden %10-20 kalite kazancı gösteren tekrar ağırlıklı yönlendirme.

## Use It — Hazır Araçla Uygula

`outputs/skill-economy-designer.md` minimal bir agent ekonomisi tasarlar: kimlik katmanı seçimi, kredi ilişkilendirme mekanizması, ödeme mekanizması, itibar kuralı.

## Ship It — Kullanıma Sun

2026'da agent ekonomisini yönetmek:

- **token'larla değil itibarla başlayın.** İtibarın uygulanması ucuzdur ve tek başına değerlidir; token'lar yasal ve ekonomik karmaşıklığı artırır.
- **Ödül vermeden önce doğrulayın.** Bağımsız bir doğrulama adımı olmadan asla kredi dağıtmayın. Kendi bildirdiği kalite Sybil Games'e yansır.
- **Shapley örneği, tam Shapley değil.** Örnek 100-1000 sıralaması; kesin numaralandırma ölçeklenmez.
- **Sınır kaybı faktörü ve taban itibarı.** Sınırsız bozulma meşru katkıda bulunanları siler; çok yavaş zayıflama, bayatlamış yüksek tekrarlı agent'ları ödüllendirir.
- **Mekanizmaları rakip olarak denetleyin.** Ağı açmadan önce kırmızı takım senaryolarını çalıştırın. Her mekanizmanın bir oyun teorisi vardır; Saldırganları değil, delikleri bulmak istiyorsunuz.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Shapley değerlerinin toplamının toplam değere eşit olduğunu doğrulayın (verimlilik aksiyomu). Değer fonksiyonunu değiştirin; Shapley tahsisleri beklenen yönde değişiyor mu?
2. Shapley *örneklemeyi* (K sıralaması üzerinden Monte Carlo) uygulayın. K yaklaşım doğruluğunu nasıl etkiler? N=4 için kesin değerle karşılaştırın.
3. Açık artırmadan önce koalisyon oluşturucu bir adım uygulayın: agent'lar ekipler halinde birleşebilir ve birim olarak teklif verebilir. Hangi koalisyonlar kuruluyor? Sonuç Pareto açısından bireysel tekliften daha mı iyi?
4. Google Araştırma mekanizma tasarımı yazısını okuyun. İhlal edilmesi durumunda doğruluğu bozan bir varsayım belirleyin. Bir LLM ortamında bu başarısızlık modu nasıl görünüyor?
5. AAMAS 2025 merkezi olmayan LaMAS makalesini okuyun. Sentetik bir görev üzerinde Shapley adımlarını 10 agents boyunca uygulayın. Kesin hesaplama ne kadar sürer? Örnekleme 100 çekilişle ne kadar yaklaşıyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| DePIN | "Merkezi olmayan fiziksel altyapı" | Token-teşvik edilen bilgi işlem/depolama/bant genişliği. Bittensor, Akash, Render. |
| YAPTIM | "Merkezi olmayan tanımlayıcı" | Taşınabilir kimlikler için W3C spesifikasyonu. Agent itibarı bir platforma değil DID'ye bağlıdır. |
| ERC-4337 | "Hesap soyutlama" | Gaz sponsorluğu yapabilen, agent ödemelerine olanak tanıyan sözleşme hesapları. |
| Shapley değeri | "Adil kredi tahsisi" | Verimliliği, simetriyi, doğrusallığı karşılayan benzersiz tahsis, sıfır. |
| İkinci fiyat açık artırması | "Vickrey müzayedesi" | Doğru mekanizma: Kazanan ikinci en yüksek teklifi öder. Monoton toplama uyumlu. |
| İtibar sermayesi | "Birikmiş kalite puanı" | Onaylanmış katkılardan DID'ye bağlı puan; zamanla çürür. |
| Agentic DAO | "Agents + insanlar yönetir" | Birinci sınıf agent seçmenli DAO, oy verme gücü itibara bağlı. |
| TAO / FET / GPU kredileri | "Token mezhep" | Bittensor TAO, Fetch.ai FET, çeşitli DePIN token'lar. |

## Daha Fazla Okuma

- [Agent Ekonomi](https://arxiv.org/abs/2602.14219) — 5 katmanlı agent ekonomi yığınının 2026 anketi
- [Google Araştırması — Büyük dil modelleri için mekanizma tasarımı](https://research.google/blog/mechanism-design-for-large-language-models/) — Monoton toplamalı token açık artırmaları
- [AAMAS 2025 — merkezi olmayan LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — Shapley değeri kredi ilişkilendirmesi
- [Bittensor TAO belgeleri](https://docs.bittensor.com/) — alt ağ yapısı ve ödül dağıtımı
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — ASI-1 Mini Yüksek Lisans ve FET token
- [W3C Merkezi Olmayan Tanımlayıcılar (DID'ler) spesifikasyonu](https://www.w3.org/TR/did-core/) — kimlik temeli
