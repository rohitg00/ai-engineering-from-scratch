# Uzun Zaman Çalışan Arka Tarım Ajanları: Sürekli İdam

> Üretim uzun uzayda bulunan ajanlar çalışmıyor `while True`. Her LLM çağrısı kontrol noktası, tekrar deneme ve tekrarlama ile bir aktivite haline gelir. Temporal'ın OpenAI Ajanlar SDK entegrasyonu Mart 2026'da GA'ya geçti. Claude Code Routines (Anthropic) sürekli yerel bir süreç olmadan programlı Claude Code hesaba çekmelerini yürütür. Sessiyonlar insan girişleri üzerinde durur, kurtulma dağıtımları sürdürür ve en son kontrol noktasından devam eder.`thread_id`Yeni ergonomiğin arkasında eski bir model yer alır  iş akışının orkestrasyonu  yeni bir giriş ile: LLM, iyileşme sırasında belirsizce tekrarlanması gereken belirsiz faaliyetler olarak çağrılar.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## Sorun

Bir ajanın dört saat çalışmasını düşünün. Üç alet çağırır, kullanıcıya iki kez uyarır ve kırk LLM çağrısı yapar. Yarım yolda, ev sahibi yeniden başlatılır. Ne olur?

- Saf bir şekilde .`while True`Loop: her şey kayboldu. Çalışma sıfırdan yeniden başlıyor. Üç araç çağrısı (gerçek yan etkileri ile) tekrar yürütülüyor. Kullanıcı zaten onayladığı şeyler için tekrar uyarılıyor.
- Sürdürülebilir yürütme ile: yürütme en son kontrol noktasından devam eder. Daha önce tamamlanmış faaliyetler yeniden yürütülmez; sonuçları sürdürülebilir günlükten tekrar oynanır. Kullanıcı zaten onayladığı şeyleri yeniden onaylamaz. Daha önce yapılan LLM aramaları yeniden fatura edilmez.

Bu, çalışma akış motorlarının on yıldır gönderdiği aynı model (Temporal, Cadence, Uber'in Cherami) yeni olan şey, LLM çağrılarının artık bir tür etkinlik olmasıdır  belirsiz, pahalı, yan etkileri  ve bu modelle temiz bir şekilde uyumlu.

Dersin devam eden teması: uzun uzayda güvenilirlik düşüşü (METR "35 dakikalık bir bozulmayı" gözlemler  başarının oranı ufukta yaklaşık olarak dörtlü olarak düşer). Dayanıklı yürütme güvenilirlik profili desteklediğinden daha uzun süren çalışmalar sağlar. Bu, tasarım doğruysa güvenli bir şekilde başarısız olma ve tasarım yanlışsa güvensiz bir şekilde başarısız olma yeni bir yoludur.

## Anlaşım

### Aktiviteler, iş akışları ve tekrar oynatma

- **Workflow**Bu, etkinlik logundan şaşırtıcı bir farklılık olmadan tekrar oynanabilmesi için belirleyici olmalıdır.
- **Activity**Bu uygulama, bir çalışma birimi olarak kullanılır. LLM çağrısı, araç çağrısı, dosya yazısı, HTTP talebi. Her etkinlik girişleri ve (bir kez tamamlandığında) çıkışlarıyla kaydedilmiştir.
- **Event log**: dayanıklı destek mağazası. Her etkinlik başlatılır, tamamlanır, başarısız olur, tekrar dener ve her iş akışı karar kaydedilir.
- **Replay**: kurtarma sırasında, iş akışı kodu başlangıçtan itibaren tekrar çalıştırılır; zaten tamamlanan her etkinlik yeniden çalıştırılmadan kaydedilen sonuçlarını gönderir. Sadece tamamlanmamış etkinlikler gerçekte çalıştırılır.

Bu, React'ın sanal DOM'e karşı yeniden göstermesi veya Git'in commit'lerden bir iş ağacını yeniden inşa etmesiyle aynı şekildir.

### Neden LLM çağrıları bu örneğe uymaktadır

LLM çağrıları:
- Deterministik olmayan (temperatür > 0; hatta 0 sıcaklık model sürümleri arasında hareket eder).
- Pahalı (para ve gecikme).
- Potansiyel başarısızlık (sır limitleri, zaman kesintileri).
- Yan etkileri (gerçeleri kullanırlarsa).

Bu tam olarak etkinlik profili. LLM'nin her çağrısını bir etkinlik olarak kapatmak, eksponensel geri dönüş, yeniden başlatma üzerinden kontrol noktası ve debugging için tekrarlanabilir bir iz sağlar.

### Kontrol noktaları `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects ve Claude Code Routines hepsi aynı API şeklinde birleşmiştir: a `thread_id`(veya eşdeğer) oturum tanımlanır; her durum geçimi bir arka uçta kalır (PostgreSQL varsayılan, dev için SQLite, önbelleğe Redis); devam, en son kontrol noktasını okuyor.

Arka taraf seçimi önemlidir:

- **PostgreSQL**LangGraph için öntanımlı.
- **SQLite**: sadece yerel dev; sunucular arasında verileri kaybeder.
- **Redis**: hızlı ama geçici, AOF/snapshot yapılandırılmadıkça.
- **Cloudflare Durable Objects**: şeffaf bir şekilde dağıtılmış; eşsiz bir anahtarla kapsamlı; saatler veya haftalar boyunca hayatta kalır.

### İnsan girişleri birinci sınıf bir devlet olarak

Teklif-sonra-yürüme (Deneyim 15) dayanıklı bir "insan bekleme" durumunu gerektirir. İş akışı duraklar, dış kuyruk bekleyen talebi tutar ve onay tam olarak o noktadan devam eder. Süreklilik olmadan bu en iyi çaba; onunla, bir gece onay gelir ve iş akışı sabah başlar.

### 35 dakikalık çöküş

METR, ölçülen her ajan sınıfının, sürekli çalışmanın ~35 dakikasından fazla güvenilirlik kaybını gösterdiğini gözlemledi. Görev süresini ikiye katlamak başarısızlık oranını yaklaşık olarak dört katına çıkarır. Kalıcı yürütme bunu düzeltmez; güvenilirlik profili desteklediğinden daha uzun sürmesine izin verir. Güvenli bir yöntem, tekrar giriş sırasında taze HITL gerektiren kontrol noktaları ile dayanıklılığı ve bütçeyi öldürme anahtarları (Desin 13) ile birlikte duvar saati zamanından bağımsız olarak toplam hesaplama sınırını oluşturmaktır.

### Sürekli işlenme yanlış cevap olduğunda

- İnsan girişsiz birkaç dakikadan kısa sürer.
- Sadece okunur bilgi alımı.
- Doğru olması için tek bir bağlam penceresinde son-son işlemleri gerektiren görevler (bazı akıl yürütme görevleri; bazı tek çekim nesilleri).

```figure
memory-consolidation
```

## Kullan

`code/main.py`stdlib Python'da minimal dayanıklı bir yürütme motorunu uyguluyor.

- `@activity`JSON olay günlüğüne girdiler ve çıkışları kaydeden dekorator.
- İş akışı işlevi, etkinlikleri sıralar.
- A.`run_or_replay(workflow, event_log)`Başarılı etkinlikleri yeniden gerçekleştirmeden tekrarlayan bir işlev.

Sürücü üç etkinlik iş akışını simüle eder, yarıda çökür ve (a) tümü yeniden gerçekleştirmek için bir naif tekrar deneme gösterir.

## Gönder

`outputs/skill-durable-execution-review.md`uzun süreli ajanların kullanılması için önerilen bir düzenlemeyi doğru süren uygulama biçimi için değerlendirir: faaliyetler, belirleme, kontrol noktalarının arka planı, insan giriş durumu ve HITL-on-resume politikası.

## Egzersizler

1. Çık .`code/main.py`.Sırırırma noktasını değiştirin ve tekrar sayısının değişmesini gösterin.

2. Oyuncak motorunu kullanmak için dönüştür .`thread_id`Motor paylaştığı iki eşzamanlı seansı simüle edin ve olay kayıtlarının çarpışmadığını doğrulayın.

3. Oyuncak motorunda bir etkinlik alın. Bir belirsizlik (iş akışının bir kararında bir duvar saat zaman damgası) getirin. Tekrar oynatmada farklılığı gösterin. Gerçek motorların bunu nasıl hallediğini açıklayın ( yan etkisi kaydesi, `Workflow.now()`API'ler).

4. LangChain'in "Prodüksiyon derinlikleri ajanlarının arkasındaki çalıştırma zamanı" yazısını okuyun.

5. 6 saatlik özerk kodlama görevi için kontrol noktası politikası tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Daha Fazla Okumak

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) bütçe, dönüm ve semantik devam.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) RequestInfoEvent şekli.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) Konkret çalışma süresi gereksinimleri.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) LLM görüşmeleri için etkinlik şekli.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) 35 dakikalık çöküş referansı.
