# Durum Bilgili Grafik Düzenleme — Dayanıklı Yürütme ve Kontrol Noktaları

> Agent bir durum makinesidir; düğümler işlevlerdir; kenarlar geçişlerdir; durum her düğümden sonra kontrol noktasıyla işaretlenir. Son başarılı kontrol noktasındaki herhangi bir başarısızlıktan devam edin. LangGraph, bu düşük düzeyli durum bilgisi olan orkestrasyon modelinin 2026 referansıdır.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 12 (İş Akışı Modelleri)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- LangGraph'ın temel modelini açıklayın: yazılan durum, işlev düğümleri, koşullu kenarlar ve düğüm sonrası kontrol noktalarına sahip durum makinesi.
- Dokümanların öne çıkardığı dört özelliği adlandırın: dayanıklı yürütme, akış, döngüdeki insan, kapsamlı bellek.
- LangGraph'ın desteklediği üç orkestrasyon topolojisini açıklayın: süpervizör, eşler arası (sürü), hiyerarşik (iç içe alt grafikler).
- Yazılan durum, koşullu kenarlar ve denetim noktası/devam döngüsü ile bir stdlib durum grafiği uygulayın.

## Sorun

Agent'ler ve iş akışları aynı sorunu paylaşıyor: 40 adımlık bir çalıştırma 38. adımda başarısız olduğunda, baştan başlamak yerine 38. adımdan devam etmek istersiniz. İkinci sınıf durum modelleri, operatörlerin yeni çalıştırmaları varsayan bir kitaplık çevresinde yeniden denemeler yapmasına neden olur.

LangGraph'ın tasarım cevabı: durum birinci sınıf bir nesnedir, mutasyonlar açıktır ve her düğümden sonra kontrol noktaları devam eder. Devam ettirmek bir `load_state(session_id)` çağrısıdır.

## Konsept

### Grafik

Bir grafik şu şekilde tanımlanır:

- **Durum türü.** Her düğümün okuyup değiştirdiği, yazılan bir dikte (veya Pydantic modeli).
- **Düğümler.** Saf işlevler `(state) -> state_update`. Güncellemeler geri döndükten sonra durumla birleştirilir.
- **Kenarlar.** Düğümler arasında koşullu veya doğrudan geçişler.
- **Giriş ve çıkış.** `START` ve `END` nöbetçi düğümleri sınırı işaretler.

Örnek: `classify`, `refund`, {`bug`, `sales`, `done` düğümlerine sahip bir agent — grafik olarak bir yönlendirme iş akışı.

### Dayanıklı yürütme

Her düğüm geri döndükten sonra çalışma zamanı durumu serileştirir ve bunu bir kontrol noktasına (SQLite, Postgres, Redis, özel) yazar. N adımındaki başarısızlık durumunda, çalışma zamanı `resume(session_id)` yapabilir ve N+1 adımından kesin durumla başlayabilir.

LangGraph dokümanları, bunun önemli olduğu üretim kullanıcılarını açıkça vurgulamaktadır: Klarna, Uber, J.P. Morgan. İddia grafik şekli değil; grafik şekli artı kontrol noktasının kurtarmayı ucuz hale getirmesidir.

### Akış

Her düğüm kısmi çıktı sağlayabilir. Grafik, düğüm başına delta olaylarını arayan kişiye aktarır, böylece kullanıcı arayüzleri grafik çalışırken güncellenir.

### Döngüdeki insan

Düğümler arasındaki durumu inceleyin ve değiştirin. Uygulamalar: kritik bir düğümden önce duraklatın, durumu bir insana gösterin, değişiklikleri kabul edin, devam ettirin. Durum zaten serileştirilmiş olduğundan denetim işaretçisi bunu kolaylaştırır.

### Hafıza

Kısa vadeli (bir çalıştırma içinde - durumdaki konuşma geçmişi) ve uzun vadeli (çalışmalar arasında - denetim noktası artı ayrı bir uzun vadeli depo aracılığıyla kalıcı). LangGraph, araçlar aracılığıyla harici bellek sistemleriyle (Mem0, özel) entegre olur.

### Üç topoloji

1. **Süpervizör.** ​​Merkezi yönlendirici LLM, uzman altagent'lara gönderim yapar. `langgraph-supervisor` içinde `create_supervisor()` (yine de 2026'da LangChain ekibi daha fazla içerik kontrolü için bunun doğrudan araç çağrıları yoluyla yapılmasını önermektedir).
2. **Sürü / eşler arası.** Agent'ler doğrudan paylaşılan bir araç yüzeyi aracılığıyla dağıtılır. Merkezi yönlendirici yok.
3. **Hiyerarşik.** Alt denetçileri yöneten denetçiler, iç içe alt grafikler olarak uygulanır.

### Bu modelin yanlış gittiği yer

- **Denetim noktaları çok küçük.** Yalnızca denetim noktası konuşması dönüşleri araç durumunu bırakır ve bellek yazmaları kurtarılamaz. Tam durum serileştirilmelidir.
- **Belirleyici olmayan düğümler.** Devam etme, düğüm girişlerinin aynı durum güncellemesini ürettiğini varsayar. Rastgele tohumlar, duvar saati, harici API'ler yakalanmalıdır.
- **Koşullu kenarların aşırı kullanımı.** Her kenarı koşullu olan bir grafik, gerekçelendirilemeyen bir durum makinesidir. Ara sıra dallanan doğrusal zincirleri tercih edin.

## İnşa Et

`code/main.py` bir stdlib durum bilgisi grafiği uygular:

- `State` — `messages`, {`step`, `route`, `output`, `human_approval` ile yazılan bir söz.
- `Node` — çağrılabilir durum alma ve bir güncelleme diktesi döndürme.
- `StateGraph` — düğümler + kenarlar + koşullu kenarlar + çalıştır + devam ettir.
- `SQLiteCheckpointer` (bellek içi sahte) — her düğümden sonra durumu serileştirir; `load(session_id)` geri yüklenir.
- Bir demo grafiği: sınıflandırma -> şube (geri ödeme / hata / satış) -> insan kapısı -> gönder.

Çalıştır:

```
python3 code/main.py
```

İz, ilk çalıştırmanın insan kapısında başarısız olduğunu, ısrar ettiğini ve ardından nihai çıktıyı üretmeye devam ettiğini gösterir.

## Kullan onu

- **LangGraph** — referans, üretime hazır. `create_react_agent`, `create_supervisor` kullanın veya kendi grafiğinizi oluşturun.
- **AutoGen v0.4** (Ders 14) — yüksek eşzamanlılık senaryoları için aktör modeli alternatifi.
- **Claude Agent SDK** (Ders 17) — yerleşik oturum deposuna sahip yönetilen koşum takımı.
- **Özel** — durum şekli veya denetim noktası arka ucu üzerinde tam kontrole ihtiyaç duyduğunuzda.

## Gönderin

`outputs/skill-state-graph.md`, herhangi bir hedef çalışma zamanında, kontrol noktası oluşturma ve devam etme özelliğinin bağlı olduğu LangGraph şeklinde bir durum grafiği oluşturur.

## Egzersizler

1. Sınıflandırma güveni bir eşiğin altında olduğunda `classify`'dan `end`'ya koşullu bir kenar ekleyin. Bir insan {`route`'yi manuel olarak ayarladıktan sonra koşuya devam edin.
2. SQLite benzeri sahteyi gerçek bir SQLite kontrol noktasıyla değiştirin. Adım başına serileştirme yükünü ölçün.
3. Paralel kenarlar uygulayın: iki düğüm aynı anda çalışır, özel bir redüktörle birleştirilir. Değişmez devlet burada ne satın alıyor?
4. `langgraph-supervisor` referansını okuyun. Oyuncağı `create_supervisor`'ya taşı. İz şekillerini karşılaştırın.
5. Akış ekleyin: her düğüm, çalışırken kısmi durum sağlar. Deltaları geldiklerinde yazdırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Durum grafiği | "Agent durum makinesi olarak" | Yazılan durum + düğümler + kenarlar + azaltıcılar |
| Kontrol Noktası | "Kalıcılık arka ucu" | Her düğümden sonra durumu serileştirir; özgeçmişi etkinleştirir |
| Redüktör | "Devlet birleşmesi" | Mevcut durumu bir düğümün güncellemesiyle birleştiren işlev |
| Koşullu kenar | "Şube" | Durum fonksiyonu tarafından seçilen kenar |
| Altyazı | "İç içe grafik" | Başka bir grafiğin içinde düğüm olarak kullanılan bir grafik |
| Dayanıklı uygulama | "Başarısızlıktan devam et" | Son başarılı düğümde tam durumla yeniden başlatın |
| Süpervizör | "Yönlendirici Yüksek Lisans" | Uzman altagent'lar için merkezi dağıtıcı |
| sürüsü | "P2P agent'lar" | Agentpaylaşımlı araçlar aracılığıyla dağıtılır; merkezi yönlendirici yok |

## Daha Fazla Okuma

- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — referans dokümanları
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) — denetleyici modeli API'si
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — aktör-model alternatifi
- [Claude Agent SDK'ya genel bakış](https://platform.claude.com/docs/en/agent-sdk/overview) — oturum deposu ve altagent'lar
