# Agent'lar için Aktör Modeli — Eşzamansız Mesajlar ve Yazılan Çalışma Zamanları

> Aktör olarak Agent'ler: eşzamansız mesaj alışverişi, olaya dayalı işleyiciler, hata izolasyonu, doğal eşzamanlılık. AutoGen v0.4 (Microsoft Research, Ocak 2025), agent orkestrasyonunu bu model etrafında yeniden tasarladı; framework artık bakım modunda ve onun üretim halefi olarak Microsoft Agent Framework (genel önizleme Ekim 2025).

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 12 (İş Akışı Modelleri)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Aktör modelini açıklayın: aktörler olarak agent'lar, tek IPC olarak mesajlar, aktör başına hata izolasyonu.
- AutoGen v0.4'nin üç API katmanını (Çekirdek, AgentSohbet, Uzantılar) adlandırın ve her birinin ne işe yaradığını belirtin.
- Mesaj tesliminin işlemden ayrılmasının neden hata izolasyonu ve doğal eşzamanlılık sağladığını açıklayın.
- Python'da bir stdlib aktör çalışma zamanı uygulayın ve üzerine iki-agent kod inceleme akışını aktarın.

## Sorun

Çoğu agent framework eşzamanlıdır: bir çağrı yığınında bir agent üretir, bir agent tüketir. Başarısızlıklar yığının çökmesine neden olur. Eşzamanlılık cıvatalanmıştır. Dağıtım yeniden yazmayı gerektirir.

AutoGen v0.4'nin cevabı: aktör modeli. Her agent, özel gelen kutusu olan bir aktördür. Tek etkileşim mesajlardır. Çalışma zamanı teslimatı işlemeden ayırır. Başarısızlıklar tek bir aktöre mahsustur. Eşzamanlılık yereldir. Dağıtım sadece farklı bir ulaşımdır.

## Konsept

### Aktörler

Bir aktörün sahip olduğu:

- Özel bir devlet (hiçbir zaman dışarıdan doğrudan dokunulmamıştır).
- Bir gelen kutusu (mesaj kuyruğu).
- Bir işleyici: `receive(message) -> effects` burada efektler "yanıtla", "diğer aktöre gönder", "yeni aktör oluştur", "durumu güncelle", "kendini durdur" olabilir.

İki aktör hafızayı paylaşamaz. Sadece mesaj gönderebilirler.

### Üç API katmanı

AutoGen v0.4 yüzeyini üçe ayırır:

1. **Çekirdek.** Düşük seviyeli aktör framework. `AgentRuntime`, `Agent`, {`Message`, `Topic`. Eşzamansız mesaj alışverişi, olaya dayalı.
2. **AgentSohbet.** Görev odaklı üst düzey API (v0.2'nin ConversableAgent'sinin yerine geçer). `AssistantAgent`, {`UserProxyAgent`, `RoundRobinGroupChat`, `SelectorGroupChat`.
3. **Uzantılar.** Entegrasyonlar — OpenAI, Antropik, Azure, araçlar, bellek.

### Ayrıştırma neden önemlidir?

v0.2 modelinde, `agent_a.chat(agent_b)` çağrılması, agent _a'yı agent _b dönene kadar eşzamanlı olarak engeller. {v0.4'de, `send(agent_b, msg)`, mesajı agent__b'nin gelen kutusuna koyar ve geri döner. Çalışma zamanı daha sonra yayınlanır. Üç sonuç:

- **Hata izolasyonu.** Agent B'nin çökmesi çökmez Agent A — çalışma zamanı, B'nin işleyicisindeki hatayı yakalar ve ne yapılacağına karar verir (günlük kaydı, yeniden deneme, geçersiz harf).
- **Doğal eşzamanlılık.** Aynı anda birçok mesaj yayında; aktörler gelen kutularını aynı anda işler.
- **Dağıtım için hazır.** Gelen kutusu + aktarım, aktörün işlemde veya başka bir ana bilgisayarda olup olmadığına bakılmaksızın aynı soyutlamadır.

### Topolojiler

- **RoundRobinGroupChat.** Agent'ler sabit bir rotasyonla sırayla yer alır.
- **SelectorGroupChat.** Seçici agent, konuşma bağlamına göre sıradaki kişiyi seçer.
- **Magentic-One.** Web'de gezinme, kod yürütme, dosya işleme için multi-agent referans ekibi. AgentSohbet üzerine kurulmuştur.

### Observability

OpenTelemetry desteği yerleşiktir. Her mesaj bir yayılma alanı yayar; araç çağrıları, 2026 OTel GenAI anlam kurallarına göre (Ders 23) `gen_ai.*` niteliklerini taşır.

### Durum: bakım modu

2026 Başı: AutoGen v0.7.x, araştırma ve prototip oluşturma için stabildir. Microsoft, aktif geliştirmeyi, üretimin halefi olan Microsoft Agent Framework'ye kaydırdı (genel önizleme 1 Ekim 2025; 1.0 GA, 2026'nın ilk çeyreğinin sonu için hedeflendi). AutoGen modelleri temiz bir şekilde ileriye doğru ilerliyor; aktör modeli dayanıklı bir fikir.

## İnşa Et

`code/main.py` bir stdlib aktör çalışma zamanını uygular:

- `Message` — `sender`, {`recipient`, `topic`, `body` ile yazılan yük.
- `Actor` — `receive(message, runtime)` ile özet.
- `Runtime` — paylaşılan kuyruk, teslimat, hata izolasyonu içeren olay döngüsü.
- İki aktörlü bir demo: `ReviewerAgent` kodu inceler, `ChecklistAgent` bir kontrol listesi çalıştırır; fikir birliğine varıncaya kadar mesaj alışverişinde bulunurlar.

Çalıştır:

```
python3 code/main.py
```

İz, mesajın iletilmesini, bir aktörde diğerini çökertmeyen simüle edilmiş bir başarısızlığı ve ortak bir karara varmayı gösteriyor.

## Kullan onu

- **AutoGen v0.4/v0.7** (bakım) — araştırma, prototip oluşturma, çoklu-agent kalıpları için kararlı.
- **Microsoft Agent Framework** — üretimin halefi (genel önizleme Ekim 2025); yenilenmiş bir API'de aynı aktör-model fikirleri.
- **LangGraph sürü topolojisi** (Ders 13) — paylaşılan araç aktarımıyla benzer model.
- **Özel aktör çalışma zamanı** — belirli bir aktarıma (NATS, RabbitMQ, gRPC) ihtiyaç duyduğunuzda.

## Gönderin

`outputs/skill-actor-runtime.md`, belirli bir çoklu-agent görevi için minimum aktör çalışma süresi artı bir ekip şablonu (RoundRobin veya Selector) oluşturur.

## Egzersizler

1. Teslim edilmeyen iletiler kuyruğu ekleyin: Bir işleyici ayağa kalktığında, başarısız olan mesajı insan incelemesi için park edin. DLQ oyuncağınıza ne sıklıkla darbe alıyor?
2. `SelectorGroupChat`'yi uygulayın: bir seçici aktör, konuşma durumuna göre bir sonraki mesajı kimin işleyeceğini seçer.
3. Dağıtılmış aktarım ekleyin: aktörlerin ayrı işlemlerde çalışabilmesi için işlem içi kuyruğu HTTP üzerinden JSON sunucusuyla değiştirin.
4. Mesaj başına bir OTel aralığı (veya işlem dışı bir vekil) bağlayın. Ders 23 başına `gen_ai.agent.name`, `gen_ai.operation.name` yayınlayın.
5. AutoGen v0.4'in mimari gönderisini okuyun. Oyuncağınızı gerçek `autogen_core` API'sine taşıyın. Üretimde önemli olan neyi atladınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Aktör | "Agent" | Özel durum + gelen kutusu + işleyici; paylaşılan hafıza yok |
| Mesaj | "Etkinlik" | Yazılan yük; aktörlerin etkileşim kurmasının tek yolu |
| Gelen Kutusu | "Posta Kutusu" | Bekleyen mesajların aktör başına kuyruğu |
| Çalışma zamanı | "Agent ana bilgisayar" | Mesajları yönlendiren ve arızaları izole eden olay döngüsü |
| Konu | "Kanal" | Aktörler arasında adlandırılmış yayınlama-abone olma rotası |
| Arıza izolasyonu | "Bırakın çöksün" | Bir oyuncunun başarısız olması diğerlerini çökertmez |
| RoundRobinGrupSohbeti | "Sabit rotasyonlu ekip" | Agent'lar sırayla alır |
| SeçiciGrupSohbet | "Bağlam odaklı ekip" | Seçici bir sonraki adımı seçer |
| Magentic-One | "Referans ekibi" | Web + kod + dosyalar için çokluagent takım |

## Daha Fazla Okuma

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — yeniden tasarım gönderisi
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — grafik şeklindeki alternatif
- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — AutoGen'in varsayılan olarak yaydığı yayılımları kapsar
