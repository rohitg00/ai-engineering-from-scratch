# Süpervizör / Orkestratör-Çalışan Kalıbı

> Bir lider agent plan ve delege; uzman çalışanlar paralel bağlamlarda çalışır ve rapor verir. Anthropic'in Araştırma sisteminin (Claude Opus 4 öncü olarak, Sonnet 4 altagent'lar olarak) arkasındaki model budur; dahili araştırma değerlendirmelerinde tekli-agent Opus 4'e göre +%90,2 olarak ölçülmüştür. Anthropic'in mühendislik gönderisi,BrowseComp'taki varyansın %80'inin yalnızca token kullanımıyla açıklandığını bildiriyor — çoklu-agent büyük ölçüde kazanıyor çünkü her bir altagent yeni bir context window alıyor. Bu ders, ilkellerden denetleyici modelini oluşturur ve üretim deployment'lerden 2026 mühendislik derslerini kapsar.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib, `threading`)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model)
**Süre:** ~75 dakika

## Sorun

Araştırma, single-agent sistemlerinin başarısız olduğu prototip görevdir. "2023 ile 2026 arasında çoklu-agent sistemlerde ne değişti?" diye soruyorsunuz. Tek bir agent beş makaleyi sırayla okur, içeriğinin yarısını metinlerle doldurur ve ardından hepsi hakkında birlikte akıl yürütmek zorundadır. Beşinciye ulaştığında ilk kağıdı unutur. Paralelleştirilemez.

Denetleyici modeli bunu düzeltir: bir lider agent aramayı planlar, her alt soruyu bir çalışana devreder ve sentez yapar. Her işçi, dar bir soru için kendi 200k-token aralığına sahip olur. Lider hiçbir zaman ham belgeleri görmez; yalnızca çalışanların özetlerini görür.

Anthropic'in üretim Araştırma sistemi, tek bir Opus 4'e kıyasla dahili araştırma değerlendirmelerinde +%90,2 rapor veriyor. Aynı gönderide,BrowseComp varyansının %80'inin yalnızca *token kullanımıyla* açıklandığı belirtiliyor. Altagent başına taze içerik ana mekanizmadır.

## Konsept

### Desen

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

Lider hiçbir zaman ham maddeleri okumaz. Kurşun sentezlenene kadar işçiler birbirlerinin çalışmalarını asla görmezler. Her ok dar bir artifact ile bir geçiştir.

### Neden kazanıyor?

Üç mekanizma:

1. **Abone başına yeni içerikagent.** "FIPA-ACL mirasını" keşfeden bir çalışan, planlama için harcanan 40 bin tokens'yi taşımıyor. Bir soru için 200k'lık bir pencere alır.
2. **prompt aracılığıyla uzmanlaşma.** Liderin prompt'si "araştırma" değil, "ayrıştırma ve sentezleme"dir. Her işçinin prompt'si dardır: "X'te neyin değiştiğini bulun." Odaklanmış prompt'lar odaklanmış çıktılar üretir.
3. **Paralellik.** İşçiler eşzamanlı olarak koşarlar. Duvar saati süresi kabaca `max(worker_times) + plan + synthesis`, `sum(worker_times)` değil.

### Mühendislik dersleri (Antropik 2025)

Antropik gönderide hâlâ 2026'yla ilgili olan birkaç üretim dersi listeleniyor:

- **Karmaşıklığı sorgulamak için çabayı ölçeklendirin.** Basit sorgular: bir agent, 3-10 araç çağrısı. Karmaşık sorgular: 10+ agents. Bunu arayanın değil, liderin tahmin etmesi gerekir.
- **Geniş, sonra dar.** Önce geniş alt sorulara ayrıştırın, ardından yanıtın derinlik gerektirmesi durumunda alt soru başına daha fazla çalışan oluşturun.
- **Gökkuşağı deployment'lar.** Agent'ler uzun sürelidir ve durum bilgisi içerir. Geleneksel mavi-yeşil çalışmıyor. Antropik gökkuşağını kullanır: eski sürümler tükenirken yeni sürümlerin kademeli olarak piyasaya sürülmesi.
- **Token kullanımı baskındır.** Çoklu-agent, tekli-agent'ın token'larinin ~15 katıdır. Yalnızca görev değeri maliyeti karşıladığında çalıştırın.

### Grafiğe özgü dönüş

LangGraph başlangıçta bir `langgraph-supervisor` kitaplığını üst düzey bir `create_supervisor` yardımcısıyla birlikte gönderdi. 2025 yılında LangChain, öneriyi doğrudan araç çağırma yoluyla süpervizör modelinin uygulanmasına kaydırdı çünkü araç çağrıları, süpervizörün gördükleri* (bağlam mühendisliği) üzerinde daha fazla kontrol sağlıyor. Kütüphane hâlâ çalışıyor; dokümanlar artık araç çağırma formunu öneriyor.

### Arıza modları

- **Kurşun planı halüsinasyona uğratır.** Eğer müşteri adayı asıl soruyu ayrıştırmayan alt sorular üretirse, işçiler yanlış hedef üzerinde hassas araştırma yaparlar.
- **Çalışanlar aşırı keşfeder.** Açık kapsam sınırları olmadığında, çalışanlar kendilerine atanan alt soruların ötesine geçer ve sentez adımını kirletir.
- **Sentez çatışmaları.** İki işçi çelişkili gerçekleri aktarıyor. Lider ya yeniden sormalı (bir tur eklemeli) ya da anlaşmazlığı açıkça belirtmelidir. Bir tarafın sessizce seçilmesi en büyük başarısızlıktır: Kullanıcı anlaşmazlığın olup olmadığını asla bilmez.

### Yönetici hatalı olduğunda

- **Sıralı görevler.** 2. adım tam anlamıyla 1. adımın çıktısına ihtiyaç duyuyorsa paralellik hiçbir şey satın almaz. Bir ardışık düzen kullanın (CrewAI Sıralı, LangGraph doğrusal grafiği).
- **Basit sorgular.** Single-agent bunları daha hızlı ve daha ucuz bir şekilde işler. İşçileri oluşturmadan önce liderin "ölçek çabası" kontrolünü kullanın.
- **Katı determinizm.** Süpervizör, LLM tarafından seçilen delegasyonu kullanır. Statik grafikler, denetim/tekrarlamanın uyarlanabilirlikten daha önemli olduğu durumlarda daha iyidir.

```figure
supervisor-hierarchy
```

## Build It — Kendin Geliştir

`code/main.py` , `threading` kullanan üç paralel çalışandan oluşan bir süpervizör uygular. Lider bir sorguyu alt sorulara ayrıştırır, çalışanlar her bir alt soru üzerinde aynı anda çalışır ve lider sentez yapar. Gerçek Yüksek Lisans yok; işçiler, getir ve özetlemeyi simüle edecek şekilde programlanmıştır.

Anahtar yapı:

- `Lead.plan(query)` bir sorguyu 3 alt soruya böler.
- `Worker.run(sub_q)` sahte bir özet döndürür (üretimde agent kullanan herhangi bir araç olabilir).
- `Lead.run(query)` iş parçacığı, birleştirme ve sentezlerdeki çalışanları başlatır.

Koşmak:

```
python3 code/main.py
```

Çıktı planı, başlangıç/bitiş zaman damgalarıyla birlikte paralel çalışan izlerini ve son sentezi gösterir. Duvar saatinin kazandığını görebilirsiniz: 0,3 saniyelik üç işçi 0,9 değil ~0,35 saniyede koşuyor.

## Use It — Hazır Araçla Uygula

`outputs/skill-supervisor-designer.md` bir kullanıcı sorgusunu alır ve bir denetçi modeli tasarımı üretir: öncü sistem prompt, çalışan rolleri, alt soru ayrıştırma kuralları ve sentez şablonu. Yeni bir araştırma tarzı agent sistemi oluşturmadan önce bunu kullanın.

## Ship It — Kullanıma Sun

Denetleyici modelini dağıtmadan önce kontrol listesi:

- **Model eşleştirme.** Akıl yürütme katmanı modeline öncülük edin (Opus sınıfı, `o3` sınıfı). Daha hızlı, daha ucuz bir model üzerinde çalışanlar (Sonnet, `o4-mini`).
- **Çalışan zaman aşımı.** Ortalama çalışma süresinin 2 katını aşan tüm çalışanlar öldürülür; Lider ya daha dar bir kapsamda yeniden doğar ya da bu olmadan devam eder.
- **Token işçi başına sınır.** Kesin sınır (beklenen sentez girdisinin 10 katı diyelim), kaçak bir işçinin bütçeyi boşa harcamasını önler.
- **Observability.** Liderin planının, her çalışanın araç çağrılarının ve sentezin izini sürün. Bu, herhangi bir post-hoc hata ayıklamanın temelidir.
- **Gökkuşağının kullanıma sunulması.** Uzun süre çalışan durum bilgili agent'lar çalışırken değiştirilmeye değil, kademeli sürüm geçişine ihtiyaç duyar.

## Egzersizler

1. `code/main.py` komutunu çalıştırın, ardından ipucunu 3 yerine 5 işçi oluşturacak şekilde değiştirin. Duvar saati etkisini gözlemleyin. Bu demoda hangi çalışan sayısında ortaya çıkan genel gider paralel tasarrufları aşıyor?
2. Çalışan molası uygulayın: 0,5 saniyeden uzun süre çalışan tüm çalışanları öldürün ve liderin kalan sonuçları sentezlemesini sağlayın. Bir işçinin işten çıkarıldığını bilmek için ne observability gerekir?
3. Liderin sentezine bir çatışma tespit adımı ekleyin: İki çalışan çelişkili yanıtlar verirse lider, birini seçmek yerine anlaşmazlığı not eder. Yüksek Lisans'ı çağırmadan çelişkiyi nasıl tespit edersiniz?
4. Anthropic'in Araştırma sistemi mühendisliği yazısını okuyun. Bu oyuncak demosunun üretimde çalışması için benimsemesi gereken üç uygulamayı listeleyin.
5. LangGraph'ın `create_supervisor` (eski) önerisi ile yeni araç çağırma önerisini karşılaştırın. Hangisi size süpervizörün gördükleri üzerinde daha iyi kontrol sağlar? Antropik neden ham işçi bağlamını değil de açıkça yalnızca alt cevapları senteze aktarıyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Süpervizör | "Öncü agent" | Planlayan, yetki veren ve sentezleyen bir orkestratör agent. İşi kendisi yapmaz. |
| İşçi | "Altagent" | Denetleyici tarafından dar kapsamlı ve kendi context window'si ile çağrılan odaklanmış bir agent. |
| Orkestratör-çalışan | "Denetleyici modeli" | Aynı şey, farklı isim. 2026 literatürü her ikisini de kullanır. |
| Yeni bağlam | "Pencereyi temizle" | Bir çalışanın bağlamı, müşteri adayının geçmişinden değil, kendi sisteminden prompt ve atanan sorudan başlar. |
| Gökkuşağı deployment | "Kademeli kullanıma sunma" | Uzun süre çalışan durum bilgisi olan agent'larin mavi-yeşil değil, sürümlendirilmiş tahliye ve değiştirmeye ihtiyacı vardır. |
| Token hakimiyeti | "Bağlam değişkendir" | Araştırma-değerlendirme varyansının %80'i, Anthropic'e göre model seçiminden değil, kullanılan toplam token sayısından kaynaklanmaktadır. |
| Çabayı ölçeklendirin | "agent sayısını karmaşıklıkla eşleştirin" | Lead, sorgu zorluğunu tahmin eder ve buna göre 1'e karşı 10'dan fazla çalışan üretir. |
| Sentez çatışması | "İşçiler aynı fikirde değil" | İki işçi çelişkili gerçekleri aktarıyor; Lider, anlaşmazlıkları su yüzüne çıkarmalı, sessizce birini seçmemelidir. |

## Daha Fazla Okuma

- [Antropik mühendislik — Çoklu-agent araştırma sistemimizi nasıl oluşturduk](https://www.anthropic.com/engineering/multi-agent-research-system) — denetleyici modeli için üretim referansı
- [LangGraph iş akışları ve agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — araç çağırma gözetmeni artık önerilen formdur
- [LangGraph yönetici referansı](https://reference.langchain.com/python/langgraph-supervisor) — eski yardımcı, 2026 üretiminde hâlâ kullanılıyor
- [OpenAI yemek kitabı — Agent'ları Düzenleme: Rutinler ve Aktarmalar](https://developers.openai.com/cookbook/examples/orchestrating_agents) — aktarım tabanlı gözetmen çeşidi
