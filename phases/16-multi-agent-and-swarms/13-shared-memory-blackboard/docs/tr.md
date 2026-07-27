# Paylaşılan Bellek ve Kara Tahta Desenleri

> 2026 çoklu-agent sistemlerinde iki yaklaşım bir arada mevcuttur: **mesaj havuzu** (herkes herkesin mesajlarını görür, AutoGen GroupChat veya MetaGPT'de olduğu gibi) ve **abonelikli karatahta** (agent'lar, Bağlama Duyarlı MCP veya Matris framework'de olduğu gibi ilgili etkinliklere abone olurlar). Her ikisi de çoklu-agent sisteminin durum bilgisi olan tek parçasıdır; bu da her ikisinin de ilginç hataların yaşadığı yer olduğu anlamına gelir. Referans hatası modu **bellek zehirlenmesidir**: bir agent bir "gerçeği" halüsinasyona uğratır, diğer agent'lar bunu doğrulanmış olarak ele alır ve doğruluk, hata ayıklamanın ani bir çökmeden çok daha zor olacağı şekilde yavaş yavaş azalır. Bu ders, stdlib'den her iki yapıyı da oluşturur, bir zehirlenme saldırısı enjekte eder ve üretimde gerçekten işe yarayan üç hafifletmeyi gösterir.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib, `threading`)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model), Aşama 16 · 09 (Paralel Sürü Ağları)
**Süre:** ~75 dakika

## Sorun

Çoklu-agent sistemleri, agent'larin gerçekleri paylaşabileceği bir yere ihtiyaç duyar. Kelimenin tam anlamıyla bir seçenek "mesajlardaki her şeyi iletmektir"; ancak bu, ekstra kopyalamayla paylaşılan durumu yeniden keşfeder. Bir diğeri ise "herkese küresel bir günlük verin"; ancak küresel günlükler sınırsızca büyür ve kolayca zehirlenir. Üçüncüsü "agent başına bir görünüm yansıtın"; ölçeklenebilir ancak şema ağırlıklıdır.

agent'lardan biri halüsinasyon görüp halüsinasyonu paylaşılan duruma yazdığında, bu durumu okuyan her alt agent halüsinasyonu gerçek olarak benimser. İnsan bunu fark ettiğinde, akıl yürütme zinciri beş adım derinliğe ulaşır ve temel neden şimdiye kadar yazılan üçüncü mesajdır. Çoklu-agent doğruluk azalmasında hata ayıklamak, bir kilitlenmede hata ayıklamaktan daha zordur.

Bu hafıza zehirlenmesidir. MAST taksonomisinde en çok belgelenen ikinci başarısızlık ailesidir (Cemri ve diğerleri, arXiv:2503.13657) ve yapısaldır: Kaynağı ve yazılamaz bir doğrulayıcısı olmayan herhangi bir paylaşılan bellek tasarımı eninde sonunda bunu sergileyecektir.

## Konsept

### İki ana topoloji

**Tam mesaj havuzu.** Her agent, her mesajı okur. AutoGen GroupChat ve MetaGPT bunu kullanır. Basit, şeffaf, incelenebilir, ancak ~10 agent saniyeyi aşacak şekilde ölçeklenmez çünkü her bir agent'ın içeriği diğer agent'larin çalışmalarıyla dolar.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Abonelikli Blackboard.** Agent'lar konulara ilgi duyduklarını beyan ederler; alt tabaka yalnızca ilgili mesajları yönlendirir. CA-MCP (arXiv:2601.11595) ve merkezi olmayan Matrix framework (arXiv:2511.21686) bunu kullanır. Daha da ölçeklenir ancak aboneliklerin anlamlı hale getirilmesi için önceden şema tasarımı gerekir.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Her biri kazandığında

- **Tam havuz**, agent'ların az olması (< 10), heterojen olması ve konuşmanın kısa ufuklu olması durumunda kazanır. Herkes her şeyi gördüğünde kimin önemsiz olduğunu söyleyenin akıl yürütmesi.
- **Blackboard**, agent'lar çok sayıda olduğunda, rol açısından homojen ancak örneklerde çok sayıda olduğunda (sürüler) ve konuşma uzun sürdüğünde kazanır. Yönlendirme, token maliyet ve bağlam kirliliğinden tasarruf sağlar.

Üretim sistemleri genellikle karışıktır: üstte küçük bir havuz (planlama katmanı), altta karatahtalar (çalışan katmanı).

### Bir senaryoda hafıza zehirlenmesi

Üç agent bir araştırma görevi üzerinde çalışıyor. Agent A, bir agent alımıdır. Agent B bir özetleyicidir. Agent C bir analisttir.

1. A bir sayfayı getirir ve paylaşılan duruma bir mesaj yazar: "Çalışma %42'lik bir doğruluk artışı bildiriyor."
2. Getirilen sayfada aslında "%4,2 iyileşme" yazıyordu. Bir ondalık sayı halüsinasyonu gördü.
3. Paylaşılan durumu okuyan B şöyle yazıyor: "%42'lik büyük bir doğruluk artışı bildirildi (kaynak: A)."
4. Paylaşılan durumu okuyan C şöyle yazıyor: "Evlat edinmeyi önerin — %42'lik artış dönüştürücüdür."
5. Nihai rapor hiçbir zaman var olmayan %42'lik bir rakamdan bahsediyor.

agent çökmedi. Hiçbir test başarısız olmadı. Sistem "çalıştı." Halüsinasyon, bir agent'ın bağlamından, paylaşılan durum aracılığıyla her alt agent'ın mantığına geçti.

### Bu neden yapısaldır?

Paylaşılan durum olmadan, agent A'nın halüsinasyonu A'nın bağlamında kalır. Aşağı yöndeki agent'lar yeniden getirir veya yeniden türetir ve hatayı yakalayabilir. Saf paylaşılan durumla, A'nın bağlamı herkesin bağlamı haline gelir ve halüsinasyon gerçeğe dönüştürülür.

Sorun, başlı başına paylaşılan durum değil; **kaynağı olmayan ve bağımsız bir doğrulayıcısı olmayan** paylaşılan durumdur. Üç azaltım bu konuyu ele alıyor:

1. **Her yazmada kaynağı belirtin.** Paylaşılan durumdaki her giriş, onu kimin, ne zaman, hangi prompt altında yazdığını ve (varsa) agent'ın hangi kaynaktan alıntı yaptığını kaydeder. Aşağı yöndeki agent'lar kökene bağlı şüphecilikle okunur.
2. **Sürüm yazar; bunları yalnızca ekleme olarak değerlendirin.** Düzeltme, yerinde güncelleme değil, eskisinin yerine geçen yeni bir giriştir. Denetim izi korunur.
3. **Paylaşılan duruma yazamayan en az bir agent bulundurun.** Salt okunur bir doğrulayıcı agent girişleri örnekler, kaynakları yeniden getirir ve tutarsızlıkları işaretler. Havuza yazamadığı için havuz tarafından zehirlenemez.

### Blackboard emsali (Hayes-Roth, 1985)

Karatahta deseni LLM agent'larden kırk yıl öncesine dayanıyor. Hayes-Roth (1985, "Kontrol İçin Bir Kara Tahta Mimarisi") küresel bir karatahtayı gözlemleyen, kısmi çözümlere katkıda bulunan ve diğer kaynakları tetikleyen uzman Bilgi Kaynaklarını tanımladı. 2026 karatahtası (CA-MCP, Matrix), Bilgi Kaynakları olarak LLM agent'lar ve kısmi çözümler olarak JSON blob'ları ile aynı modeldir. Eski literatür, modern sistemlerin yeniden keşfettiği çekişmeyi, fırsatçı kontrolü ve tutarlılığı yazmaya yönelik çözümleri belgelemiştir.

### Projeksiyon ve tam görünüm

Saf bir karatahta her aboneye aynı projeksiyonu (konu kapsamlı) verir. **agent projeksiyon başına** daha agresif bir tasarımdır: her agent, rolüne göre özelleştirilmiş bir görünüme sahiptir. LangGraph'ın durum azaltıcıları standart 2026 uygulamasıdır; düşürücü işlevi küresel durumu role özgü bir dilime katlar.

Per-agent projeksiyonu daha da ölçeklenir ancak bir şemaya ihtiyaç duyar. Biri olmadan, her agent'ın prompt'sinde geçici projeksiyonu yeniden oluşturursunuz.

### Yazma çekişme kalıpları

Birden fazla agent'ın aynı anda yazması yalnızca bir LLM sorunu değil, bir eşzamanlılık sorunudur. Üç model işe yarar:

- **Sıralı yazar (tek üretici).** Tüm yazma işlemleri, serileştiren bir agent koordinatöründen geçer. Basit ama bir darboğaz.
- **Sürüm oluşturmayla iyimser eşzamanlılık.** Her girişin bir sürümü vardır; yazarlar sürüm uyuşmazlığı konusunda başarısız oluyor ve yeniden deniyor. Klasik veritabanı tekniği.
- **Konu bölümlendirme.** Farklı agent'ların farklı konuları vardır. Konular arası çekişme yok. Tasarlanmış bölüm sınırları gerektirir.

Çoğu 2026 framework'nın varsayılanı sıralı yazardır çünkü LLM çağrıları, çekişmenin nadir olması ve darboğazın zarar vermemesi için yeterince yavaştır.

### Yazılamaz doğrulayıcı

Yük taşıyan en fazla azaltma, salt okunur doğrulayıcıdır. Uygulama kuralları:

- Doğrulayıcı durumu ekiple paylaşır (tahtayı veya havuzu okur).
- Doğrulayıcının paylaşılan duruma yazma tanıtıcısı yoktur; yalnızca ayrı bir doğrulama kanalına.
- Doğrulayıcı, yazılarda belirtilen kaynakları bağımsız olarak getirir. Anlaşmazlığı işaretler.
- Doğrulayıcının kendi çıktıları bir insana veya ayrı bir karara agent yönlendirilir, asla havuza geri beslenmez.

Bu ayırma olmadan, doğrulayıcının çıktıları havuzda yeni girişler haline gelir; bu da zehirlenmiş bir havuzun doğrulayıcıyı zehirlediği, bu da onun doğrulamalarını zehirlediği anlamına gelir.

## Build It — Kendin Geliştir

`code/main.py` , stdlib Python'da her iki topolojiyi, artı bir oyuncak zehirlenmesi saldırısını ve üç hafifletmeyi uygular.

- `MessagePool` — tam okumalı, iş parçacığı açısından güvenli, yalnızca eklemeli günlük.
- `Blackboard` — agent başına aboneliğe sahip konu anahtarlı pub/sub.
- `ProvenanceEntry` — her yazma kaydı (yazar, zaman damgası, {{T0}__hash, kaynak_uri).
- `PoisoningScenario` — agent A'nın ondalık sayı halüsinasyonu gördüğü üç-agent araştırma görevini yürütür. Nihai raporu yazdırır.
- `Verifier` — kaynakları yeniden getiren ve tutarsızlıkları işaretleyen salt okunur bir agent. Doğrulayıcı mevcutken aynı senaryoyu çalıştırır.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı:
- Çalıştırma 1 (doğrulayıcı yok): halüsinasyon gören %42 nihai rapora yayılır.
- Çalıştırma 2 (doğrulayıcı ile): doğrulayıcı tutarsızlığı işaretler, havuz "işaretlendi" olarak etiketlenir, nihai rapor bir geri çekilme içerir.

## Use It — Hazır Araçla Uygula

`outputs/skill-memory-auditor.md` , herhangi bir çoklu-agent sistemin paylaşılan bellek tasarımını kaynak, sürüm oluşturma ve doğrulayıcı ayrımı açısından denetleyen bir beceridir. Üretimden önce yeni çoklu-agent mimarilerde çalıştırın.

## Ship It — Kullanıma Sun

Herhangi bir paylaşılan bellek tasarımı için:

- Her yazmada kaynağı kaydedin: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`.
- Günlüğü yalnızca ek olarak yapın. Düzeltmeler, değiştirilen girişe referans veren yeni girişlerdir.
- Bağımsız kaynak erişimine sahip en az bir salt okunur doğrulayıcıyı agent dağıtın.
- Doğrulayıcı çıktısını tekrar paylaşılan havuza değil, ayrı bir kanala yönlendirin.
- Yerine gelen yazmaların oranını kaydedin — artan oran, halüsinasyon modellerinin erken kanıtıdır.

## Egzersizler

1. `code/main.py`'yı çalıştırın. 1. çalıştırmanın halüsinasyonu yaydığını ve 2. çalıştırmanın halüsinasyonu yakaladığını doğrulayın.
2. İkinci bir halüsinasyon ekleyin: agent B, dataset boyutunu icat eder. Doğrulayıcı, her ikisi için de elle ayar yapılmadan her ikisini de yakalamalıdır.
3. Havuzun tamamını konu bölümleri (`prices`, `summaries`, `analyses`) içeren bir kara tahtaya çevirin. Konu bölümlendirme hangi zehirlenme senaryolarının üstesinden gelmeyi zorlaştırıyor ve hangilerine yardımcı olmuyor?
4. Hayes-Roth'u okuyun (1985, "Kontrol İçin Bir Kara Tahta Mimarisi"). Bu derste ele alınmayan ve 2026 sistemlerinin yararlanabileceği iki kontrol modelini makaleden belirleyin.
5. CA-MCP'yi (arXiv:2601.11595) okuyun. Paylaşılan Bağlam Mağazasını `code/main.py` içindeki messagePool veya Blackboard sınıfıyla eşleyin. CA-MCP en üste hangi temel öğeleri ekler?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Mesaj havuzu | "Paylaşılan sohbet geçmişi" | Her agent'ın okuduğu yalnızca ekleme günlüğü. Tam şeffaflık, zayıf ölçeklendirme. |
| Karatahta | "Paylaşılan çalışma alanı" | Konu anahtarlı pub/sub. Agentalakalı konulara abone olurlar. Daha uzağa ölçeklenir. |
| Köken | "Kim ne yazdı" | Her yazma işlemindeki meta veriler: yazar, zaman damgası, prompt, kaynaklar. |
| Hafıza zehirlenmesi | "Halüsinasyonlar yayılıyor" | Bir agent'ın hatası paylaşılan duruma girer, aşağı yöndeki agent'lar bunu gerçek olarak benimser. |
| Yalnızca ekleme | "Yerinde güncelleme yok" | Düzeltmeler, yerini alan yeni girişlerdir. Denetim izini korur. |
| Yazılamaz doğrulayıcı | "Bağımsız denetçi" | Kaynakları yeniden getiren ve tutarsızlıkları işaretleyen salt okunur agent. |
| Projeksiyon | "Kapsamlı görünüm" | Her-agent görünüm küresel durumdan hesaplanmıştır. LangGraph redüktörleri kanonik durumdur. |
| Bilgi Kaynağı | "Uzman agent" | Hayes-Roth'un 1985'teki karatahta katılımcısı dönemi. |

## Daha Fazla Okuma

- [Cemri ve ark. — Çoklu-Agent Yüksek Lisans Sistemleri Neden Başarısız Olur?](https://arxiv.org/abs/2503.13657) — MAST taksonomisi; Bellek zehirlenmesi bir koordinasyon başarısızlığı alt ailesidir
- [CA-MCP — Bağlama Duyarlı Çoklu Sunucu MCP](https://arxiv.org/abs/2601.11595) — Koordineli MCP sunucuları için Paylaşılan Bağlam Deposu
- [Matrix — merkezi olmayan çoklu-agent framework](https://arxiv.org/abs/2511.21686) — merkezi bir orkestratör olmadan mesaj kuyruğu tabanlı yazı tahtası
- [LangGraph durumu ve azaltıcılar](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — üretimdeki her-agent projeksiyon modeli
- [Antropik — Çoklu-agent araştırma sistemimizi nasıl oluşturduk](https://www.anthropic.com/engineering/multi-agent-research-system) — bir deployment prodüksiyonundan kaynak ve doğrulama notları
