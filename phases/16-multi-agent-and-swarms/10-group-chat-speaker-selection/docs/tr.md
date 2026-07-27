# Grup Sohbeti ve Konuşmacı Seçimi

> Paylaşılan sohbet düzenlemesi N agent'ı tek bir sohbete yerleştirir; bir seçici işlevi (LLM, hepsini bir kez deneme veya özel) bir sonraki konuşanı seçer. Bu, ortaya çıkan çoklu-agent konuşmanın arketipidir — agent'lar statik bir grafikteki rollerini bilmezler, sadece paylaşılan havuza tepki verirler. AutoGen GroupChat ve AG2 GroupChat referans uygulamalardır: AutoGen v0.2'nin GroupChat semantiği AG2 çatalında korunmuştur; AutoGen v0.4 bunu olay odaklı bir aktör modeli olarak yeniden yazdı. Microsoft, AutoGen'i Şubat 2026'da bakım moduna geçirdi ve Semantic Kernel ile Microsoft Agent Framework (RC Şubat 2026) ile birleştirdi. GroupChat ilkel özelliği hem AG2'de hem de Microsoft Agent Framework'da hayatta kalır; bir kez öğrenin, her yerde kullanın.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model)
**Süre:** ~60 dakika

## Sorun

Statik grafikler (LangGraph), iş akışı bilindiğinde harikadır. Gerçek konuşmalar statik değildir: Bazen kodlayıcı incelemeyi yapan kişiye, bazen araştırmacıya, bazen de yazara sorar. Mümkün olan her geçişin sabit kodlanması bir kenar patlaması yaratır. *agentpaylaşılan bir havuza tepki vermesini* ve bazı işlevlerin bir sonraki kimin konuşacağına karar vermesini istiyorsunuz.

AutoGen GroupChat'in yaptığı da tam olarak budur.

## Konsept

### Şekil

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Her agent her mesajı görür. Bir sonraki konuşacak kişiyi seçmek için her fırsatta bir seçici işlevi çağrılır.

### Üç seçici tat

**Round-robin.** Sabit çevrim. Deterministik. N'de doğrusal olarak ölçeklenir ancak bağlamı göz ardı eder; konu yasal inceleme olduğunda bile sıra kodlayıcıya verilir.

**LLM seçilmiş.** En son havuzu okuyan ve bir sonraki en iyi konuşmacıyı döndüren bir LLM'ye yapılan çağrı. Bağlama duyarlı ancak yavaş: Her fırsatta bir LLM çağrısı eklenir. AutoGen'in varsayılanı.

**Özel.** İstediğiniz mantığa sahip bir Python işlevi. Tipik: Geri dönüş kurallarıyla LLM seçilir (e.g., "kodlayıcıdan sonra sırayı her zaman doğrulayıcıya verir").

### DönüştürülebilirAgent API'si

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` seçiciyi tutar. Bir agent bir dönüşü tamamladığında yönetici seçiciyi çağırır ve seçici bir sonraki agent'ı döndürür. Döngü bir sonlandırma koşuluna kadar devam eder.

### Sonlandırma

Üç ortak kalıp:

- **Maksimum tur sayısı.** Toplam tur sayısı için sert üst sınır.
- **"SONLANDIR" token.** Agent'lar bir nöbetçi mesaj gönderebilir; yönetici biri göründüğünde durur.
- **Hedefe ulaşıldı kontrolü.** Hafif bir doğrulayıcı her turda çalışır ve bittiğinde sohbeti durdurur.

### Köken: çatallanmalar ve birleşmeler

2025'in başlarında Microsoft, olay odaklı aktör modeli etrafında AutoGen'i (v0.4) büyük ölçüde yeniden yazmaya başladı. Topluluk, AutoGen v0.2'nin GroupChat semantiğini AG2 olarak çatallayarak, ilk benimseyenlerin entegre ettiği API'yi korudu.

Şubat 2026'da Microsoft, olay odaklı aktör modelinin **Microsoft Agent Framework** (RC Şubat 2026, artık Semantic Kernel ile birleştirildi) ile birleştirilmesiyle AutoGen'in bakım moduna geçeceğini duyurdu. GroupChat konsepti her iki yolda da varlığını sürdürüyor; uygulama ayrıntıları farklılık gösterir. AG2, v0.2 uyumlu kod için tercih edilen yukarı akıştır.

### Grup Sohbeti uygun olduğunda

- **Acil konuşmalar.** Olası her bir sonraki konuşmacıya önceden telgraf çekmek istemezsiniz.
- **Rol karıştırma görevleri.** Kodlayıcı araştırmacıya sorar, araştırmacı arşivciye sorar, arşivci kodlayıcıya yanıt verir. Akış bir DAG değildir.
- **Keşif amaçlı problem çözme.** "Montaj hattını" değil, "beyin fırtınası toplantısını" düşünün.

### Başarısız olduğunda

- **Katı determinizm.** Yüksek Lisans seçicisi tutarsız olabilir. Aynı prompt, farklı koşular, farklı sonraki konuşmacılar.
- **dalkavukluk art arda gelir.** Agenten kendinden emin bir şekilde konuşan kişiye saygı duyarız. Counter-prompt açıkça.
- **Bağlam şişkinliği.** Her agent her mesajı okur; 10 turdan sonra bağlam çok büyük. Görünümlerin kapsamını belirlemek için projeksiyonları (Ders 15) kullanın.
- **Sıcak konuşmacılar.** Seçicinin uzmanlık alanlarını tercih etmesi nedeniyle bir agent sohbete hakim oluyor. Hoparlör dengesini seçici bir özellik olarak tanıtın.

### Grup sohbeti ve süpervizör

Aynı ilkeller, farklı varsayılanlar:

- Denetleyici: bir agent plan ve diğerleri yürütülür. Seçici "planlayıcıya ne yapacağını sor"dur.
- Grup sohbeti: tüm agent'lar akrandır; seçici, paylaşılan havuz üzerindeki bir işlevdir.

Her ikisi de Ders 04'teki dört temel öğeyi kullanır. Grup sohbeti varsayılan olarak LLM tarafından seçilen orkestrasyon ve tam havuz paylaşımlı durumudur.

## Build It — Kendin Geliştir

`code/main.py` , stdlib'de sıfırdan bir Grup Sohbeti uygular. Üç agent (kodlayıcı, gözden geçiren, yönetici), hepsini bir kez deneme ve LLM tarafından seçilmiş değişkenler ve bir `TERMINATE` token üzerinde bir sonlandırma.

Demo, her iki varyant için de konuşma metnini ve seçicinin karar izini yazdırır.

Koşmak:

```
python3 code/main.py
```

## Use It — Hazır Araçla Uygula

`outputs/skill-groupchat-selector.md` , belirli bir görev için bir Grup Sohbeti seçiciyi yapılandırır - tek seferlik, LLM seçilmiş ve özel ve hangi seçici girişlerinin (son mesajlar, agent uzmanlıklar, sıra sayıları) kullanılacağı.

## Ship It — Kullanıma Sun

Kontrol listesi:

- **Maksimum tur sayısı.** Her zaman. Tipik görevler için 10-20.
- **Hoparlör dengesi metriği.** agent başına dönüşleri takip edin; dengesizlik bir eşiği aştığında uyarı verir.
- **Sonlandırma token.** `TERMINATE` veya özel bir doğrulayıcı agent.
- **Projeksiyon veya kapsamlı bellek.** ~10 mesajdan sonra, bağlam şişkinliğini önlemek için her agent'a yalnızca kapsamlı bir görünüm vermeyi düşünün.
- **Seçici günlüğü.** LLM tarafından seçilen değişkenler için, hem seçicinin girişini hem de seçimini günlüğe kaydedin. Aksi halde hata ayıklama mümkün değildir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Round-robin ve LLM-selected arasındaki konuşmayı karşılaştırın. Her birinin altında hangi agent hakim?
2. Seçiciye bir "max-speaks-per-agent" kuralı ekleyin. Transkripti nasıl etkiler?
3. Hedefe ulaşılmış bir sonlandırma uygulayın: gözden geçiren kişi "onaylandı" yanıtını verdiğinde durun. Yuvarlak kapaktan önce ne sıklıkla tetikleniyor?
4. GroupChat'teki (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) AutoGen kararlı belgelerini okuyun. `GroupChatManager` tarafından kullanılan varsayılan seçiciyi tanımlayın.
5. AG2 deposunu (https://github.com/ag2ai/ag2) okuyun ve onun v0.2 Grup Sohbetini v0.4 olay odaklı sürümle karşılaştırın. v0.4 hangi somut özelliği (verim, hata toleransı, şekillendirilebilirlik) ekler?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Grup Sohbeti | "Agentbir sohbet odasında" | Paylaşılan mesaj havuzu + seçici işlevi. AutoGen / AG2 ilkel. |
| Hoparlör seçimi | "Sırada kim konuşacak" | Sonraki agent'ı seçen işlev. Round-robin, LLM seçilmiş veya özel. |
| GrupSohbet Yöneticisi | "Toplantı sahibi" | Seçicinin sahibi olan ve dönüşler arasında döngü yapan AutoGen bileşeni. |
| ÇevrilebilirAgent | "agent tabanı" | AutoGen temel sınıfı; mesaj gönderip alabilen bir agent. |
| Fesih token | "'Dur' kelimesi" | Sohbeti sonlandıran nöbetçi dize (genellikle `TERMINATE`) . |
| Sıcak hoparlör | "Bir agent hakimdir" | Seçicinin aynı agent'ı seçmeye devam ettiği arıza modu. |
| Bağlam şişkinliği | "Havuz sınırsız büyüyor" | Her agent önceki tüm mesajları okur; bağlam dönüşlerle birlikte büyür. |
| Projeksiyon | "Kapsamlı görünüm" | Bağlam şişmesini önlemek için paylaşılan havuza role özel görünüm. |

## Daha Fazla Okuma

- [AutoGen grup sohbet belgeleri](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — referans uygulaması
- [AG2 repo](https://github.com/ag2ai/ag2) — topluluk AutoGen v0.2 devamı
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) — birleştirilmiş halef, RC Şubat 2026
- [AutoGen v0.4 sürüm notları](https://microsoft.github.io/autogen/stable/) — olaya dayalı aktör modeli yeniden yazma ayrıntıları
