# Orkestralama Şekilleri: Gözetmen, Swarm, Hierarşik

> 2026 çerçevelerinde dört orkestrasyon kalıbı tekrarlanır: denetçi-işçi, sürüm / eşeğen, hiyerarşik, tartışma. Anthropic'in rehberliği: "Bu ihtiyaçlarınız için doğru sistemi oluşturmakla ilgilidir". Basit bir şekilde başlayın; tek bir ajan artı beş iş akışı kalıbı yetersiz olduğunda topoloji ekleyin.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Dört tekrarlanan orkestrasyon modelini ve her birinin ne zaman uygun olduğunu söyleyin.
- 2026 LangChain önerisini açıklayın: Araç-sağlama tabanlı denetim vs. denetim kütüphaneleri.
- Anthropic'in "doğru sistemi oluştur" kuralını ve topoloji seçimini nasıl kapatacağını açıklayın.
- Dörtünü de ortak bir yazılı LLM'ye karşı uygula.

## Sorun

Ekipler, ihtiyaçları olmadan önce "çoklu ajan"a ulaşırlar. Dört örneği çerçevelerde tekrarlanır; bir kez isimlendirilebildikten sonra doğru olanı  seçebilir veya topolojiyi tamamen atlayabilirsiniz.

## Anlaşım

### Gözetmen işçi

- Merkez yönlendirme LLM uzman ajanlara gönderir.
- Karar verir: kendine dön, uzmanına teslim, sonlandır.
- Uzmanlar birbirleriyle konuşmazlar; tüm yönlendirmeler gözetmenden geçiyor.

Çerçeve: LangGraph `create_supervisor`, Anthropic orkestrator-işçiler, CrewAI Hierarşik süreç.

**2026 LangChain recommendation:**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `create_supervisor`- Daha iyi bağlam mühendisliği kontrolü sağlar.

### Swarm / peer-to-peer

- Ajanlar doğrudan ortak bir alet yüzeyi üzerinden teslim.
- Merkez yönlendirici yok.
- Gözetmenden daha düşük gecikme (çıkışlar daha az).
- (Tek kontrol noktası yok)

Çerçeve: LangGraph sürüm topolojisi, OpenAI Ajanlar SDK teslimatları (bütün ajanlar diğerlerine teslim edebilecekleri zaman).

### Yerarşik

- İşçilerin yönetimi yapan denetçiler, işçilerin yönetimi yapan alt denetçiler.
- LangGraph'de yuva altgrafları olarak uygulanır; CrewAI'de yuva ekipleri olarak uygulanır.
- İşlem karmaşıklığı karşılığında büyük ajan popülasyonlarına ölçekler.

İhtiyacınız olduğunda: tek bir denetim yöneticisinin bağlam bütçesinde tüm uzmanların tanımları bulunamadığında.

### Tartışma

- Paralel öneriler + tekrarlı çapraz eleştiriler (Denevi 25).
- Aslında orkestrasyon değil  daha fazla doğrulama  ama çerçevelerde topoloji seçimi olarak ortaya çıkar.

### Otonom ekipler vs. Deterministik akışlar

CrewAI iki dağıtım modunu resmileştirdi:

- **Flow**Deterministik olaylara dayalı otomasyon için (önlendirilen üretim başlangıç noktası).
- **Crew**özerk rol tabanlı işbirliği için.

Bu yukarıdaki dört örneğe ortogonal ancak topoloji haritasıdır: Flow tipik olarak bir yönetici veya hiyerarşiktir; Crew tipik olarak bir LLM yönlendiricisi ile bir yönetici.

### Antropik'in rehberliği

"LLM alanında başarı en gelişmiş sistemi oluşturmakla değil, ihtiyaçlarınız için doğru sistemi oluşturmakla ilgilidir".

Kararlı karar:

1. Tek ajan + iş akışı örneği (Desin 12)  buradan başlıyor.
2. Gözetmen-işçi  2-4 uzmanınız varsa.
3. Zatenlik, akıl açısından netlikten daha önemli olduğunda 
4. Yerarşik  yalnızca denetim bağlamı bütçesi başarısız olduğunda.
5. Tartışma , maliyetten daha önemli olan doğruluk olduğunda.

### Bu kalıp yanlış gittiğinde

- **Topology-first thinking.**"Bir çok ajanın ne sorunu çözdüğünü belirlemeden önce çok ajanın ihtiyacımız var".
- **Bouncing handoffs in swarm.**A -> B -> A -> B. Hop sayıcıları kullanın.
- **Fake hierarchy.**Üç katman "işletme" için, iki takım yıkılır.

```figure
orchestration-pattern
```

## Yapın

`code/main.py`stdlib'de, bir yazılı LLM'ye karşı dört örneği de uyguluyor:

- `Supervisor`- Merkez yönlendirici.
- `Swarm` Doğrudan elverilerle eş-bir.
- `Hierarchical` denetim kurumlarının denetçileri.
- `Debate` paralel öneriler + eleştiriler.

Her desen aynı üç niyetle görev (iç geri ödeme / hata / satış) ile çalışır.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktı: örneğe göre iz + çalışma sayısı. Gözetmen en temiz; sürüm en kısa; hiyerarşik en derin; tartışma en pahalı.

## Kullan

- **LangGraph**Gözetmenlik ve hiyerarşik (bir yuva olarak yerleştirilmiş alt grafikler) için.
- **OpenAI Agents SDK**Yönetim kurulu görevlileri için.
- **CrewAI Flow**üretim belirleyici için.
- **Custom**Tartışma için veya tam kontrol istediğinizde.

## Gönder

`outputs/skill-orchestration-picker.md`Topolojiyi seçip uyguluyor.

## Egzersizler

1. Bir yönlendiriciyi çıkararak bir işçiyi bir sürüye dönüştürün.
2. 3 kez atladıktan sonra atlamak için bir hop counter ekleyin.
3. 12 uzman alanı için iki seviye hiyerarşik bir sistem oluşturmak.
4. Üretim şeklinde bir iş yükü üzerinde dört örneği profil edin. Hangisi hangi ölçüm üzerinde kazanır (keniklilik, maliyet, doğruluk, hata çözülebilirlik)?
5. Anthropic'in "Efek Bir Ajan Oluşturma" yazısını okuyun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor-worker | "Router + specialists" | Central LLM dispatches to specialists; they don't talk to each other |
| Swarm | "Peer-to-peer" | Direct handoffs via shared tools; no central router |
| Hierarchical | "Supervisors of supervisors" | Nested subgraphs for large populations |
| Debate | "Proposer + critique" | Parallel proposers, cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | Implement supervisor as direct tool calls for context control |
| Crew | "Autonomous team" | CrewAI's role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI's event-driven production mode |

## Daha Fazla Okumak

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) beş model + ajan vs iş akışı
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Gözetmen, sürüm, hiyerarşik
- [CrewAI docs](https://docs.crewai.com/en/introduction) Ekip vs Akış
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) Tartışma modeli
