# Anthropic'in İş Akışları: Seder, Karmaşık

> Schluntz ve Zhang (Anthropic, Aralık 2024) iş akışlarını (önceden tanımlanmış yollar) ajanlardan (dinamik araç kullanımı) ayırt ediyorlar. Beş iş akışı örneği çoğu vakaları kapsar. Doğrudan API çağrılarıyla başlayın. Adımları tahmin edemeyeceğiniz zaman sadece ajanlar ekleyin.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Anthropic'in beş iş akışı örneğini isimlendirin: hızlı zincirleme, yönlendirme, paralelleştirme, orkestrasyoncı-işçiler, değerlendirici-optimallaştırıcı.
- Ajan ve iş akışı arasındaki farkı ve her birinin mühendislik maliyetini açıkla.
- Bir ajan yerine ne zaman iş akışı seçileceğini belirleyin (ve tam tersi).
- Stdlib'de tüm beş örneği bir yazılı LLM'ye karşı uygulayın.

## Sorun

Bir tek fonksiyon çağrısı isteyen sorunlar için takımlar çoklu ajan çerçevelerine ulaşır. Maliyet gerçek: çerçeveler, istekleri gizleyen katmanlar ekler, kontrol akışını gizler ve erken karmaşıklığı davet eder. Schluntz ve Zhang'ın Aralık 2024'te yayınladığı yayın en çok alıntılanan endüstri geri çekimi: basit başlayın, sadece maliyetini kazandığında karmaşıklığı ekleyin.

## Anlaşım

### İş akışları vs. ajanlar

- **Workflow.**LLM ve araçlar önceden belirlenmiş kod yolları ile düzenlenir.
- **Agent.**LLM'ler kendi araçlarını dinamik yönlendirir ve kendi adımlarını atarlar.

Her ikisi de kendi yerlerine sahiptir. İş akışları daha ucuz, daha hızlı ve hataları düzeltmek daha kolaydır. Ajanlar açık sorunları açarken başarısızlık modlarını akıl yürütmeyi zorlaştırır.

### Gelişmiş LLM

Beş örneğin temelini oluşturan:  arama (dahaç), araç (harekeler), bellek (durgunluk) ile kablolanmış üç yetenekle bir LLM.

### Beş model

1. **Prompt chaining.**1. çağrının çıkışı 2. çağrının girişidir. Bir görevin temiz bir doğrusal parçalanması olduğunda kullanılır. Adımlar arasında seçmeli programatik kapılar.

2. **Routing.**Bir sınıflandırıcı LLM, aşağıdaki LLM veya araçları seçer. kategorik olarak farklı girişlerin farklı bir şekilde işleme ihtiyacı olduğunda kullanılır (Tier-1 destek vs. geri ödeme vs. hata vs. satış).

3. **Parallelization.**N LLM çağrılarını eş zamanlı olarak çalıştırın, toplam sonuçlar. İki şekil: bölümleşme (farklı parçalar) ve oylama (aynı sürpriz, N çalışmalar, çoğunluk/sentez).

4. **Orchestrator-workers.**Bir orkestrasyoncu LLM hangi işçilerin (daha LLM) çalıştırılmasını dinamik olarak karar verir ve çıkışlarını sentezler.

5. **Evaluator-optimizer.**Bir LLM bir cevabı önerir, bir başka LLM değerlendirir. değerlendirici geçene kadar tekrarlayın. Bu Self-Refine (Desin 05) genelleştirilmiştir.

### İş akışlarının ajanları yendiği yer

- **Predictable tasks.**Eğer adımları sıralayabiliyorsan, yapmalısın.
- **Cost-bound tasks.**İş akışları sınırlı adım sayısına sahiptir; ajanlar spiral olabilir.
- **Compliance-bound tasks.**Denetçiler grafikleri okumak isterler, yoldaklardan çıkarmak değil.

### Ajanların iş akışlarını yendiği yer

- **Open-ended research.**Bir sonraki adım ne zaman döner, son adım ne döner.
- **Variable-length tasks.**Adım sayımı bilinmeyen saatler arası çalışma saatleri.
- **Novel domains.**Henüz doğru iş akışını bilmediğinizde önce keşif yapın, sonra kodlayın.

### Konekst mühendisliği eşliği

"İS ajanları için etkili bağlam mühendisliği" (Anthropic 2025) bitişik disiplinleri resmileştirir: 200k penceresi bir konteyner değil bir bütçe. Neyi içerir, ne zaman sıkıştırılır, ne zaman bağlamı büyütülmesine izin verir.

```figure
workflow-chain
```

## Yapın

`code/main.py`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `ScriptedLLM`- ...

- `prompt_chain(input, steps)` sıralı.
- `route(input, classifier, handlers)` sınıflandırma + gönderme.
- `parallel_vote(prompt, n, aggregator)` N koşuşturma, toplam.
- `orchestrator_workers(task, workers)`Orkestratör işçileri seçer.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` geçene kadar döngü.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Her desen izini basar. Bir desen için toplam kod satırı ~10-15; bir çerçevenin maliyeti binlerce olarak ölçülür.

## Kullan

- Doğrudan API çoğu görevi çağırır.
- Çerçeve sadece desenin gerçekten dayanıklı durum (LangGraph), aktör-model eşzamanlılığı (AutoGen v0.4) veya rol şablonlaması (CrewAI) gerektirdiğinde.
- Claude Code harman şeklini yeniden inşa etmeden istediğinizde Claude Agent SDK'ye ulaşın.

## Gönder

`outputs/skill-workflow-picker.md`verilen görev tanımlaması için doğru örneği, kararın mantıklılığını ve iş akışları eksik olursa bir ajan için refactor yolu da dahil olmak üzere seçer.

## Egzersizler

1. Güvenlik eşiği ile yönlendirmeyi uygulayın. Eşiği altında -> insan olarak yüksel. Bir seviye 1 destek kullanımı için eşiği nereye düşer?
2.  Bir süreliğine ekleyin`parallel_vote`Bir arama yapıldığında ne olur?
3. Dön .`evaluator_optimizer`Bir bandit'e: İterasyonlar boyunca en iyi 2 çıkışları tutun, böylece geç iyi bir sonuç geç kötü bir sonucuyla üstü yazılmasın.
4. Bir yönlendirme ile birleştirme: bir yönlendirici üç zincirden birini seçer.
5. Üretim özelliklerinden birini seç, iş akışını çiz, adımları say.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | "Predefined flow" | Engineer-owned graph of LLM and tool calls |
| Agent | "Autonomous AI" | Model-owned graph; dynamic tool direction |
| Augmented LLM | "LLM with tools" | LLM + search + tools + memory; the atomic unit |
| Prompt chaining | "Sequential calls" | Output of call N is input to call N+1 |
| Routing | "Classifier dispatch" | Pick which chain/model handles the input |
| Parallelization | "Fan out" | N concurrent calls; aggregate by sectioning or voting |
| Orchestrator-workers | "Dispatcher agent" | Orchestrator LLM picks specialist LLMs dynamically |
| Evaluator-optimizer | "Proposer + judge" | Iterate until evaluator passes; Self-Refine generalized |

## Daha Fazla Okumak

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) Beş iş akışı örneği
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) arkadaş terbiyesi
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) devlet grafikleri maliyetlerini kazanırken
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) orkestrasyoncu-işçi örneği, üretilmiş
