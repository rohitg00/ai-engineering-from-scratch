# Çok Ajanlı İlkel Model

> Dört primitif, daha fazlası  ajan, teslimat, paylaşılan durum, orkestratör  dört boyutlu bir tasarım alanını kapsar ve 2026'da gönderilen büyük çoklu ajan çerçeveleri (AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework) noktalardır. Bu ders onları sıfırdan inşa eder, dörtte bir oyuncak sistemi çalışır, sonra her ana çerçeveyi aynı ekselere haritası yapar böylece yeni bir versiyonu bir paragraf içinde okuyabilirsiniz.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Sorun

Her altı ayda bir yeni çok ajan çerçeve gemileri. AutoGen 2023. CrewAI 2024. LangGraph ve OpenAI Swarm 2024. Google ADK Nisan 2025. Microsoft Agent Framework RC Şubat 2026. Her basın açıklaması "doğru soyutlama" olduğunu iddia ediyor.

Eğer bunları birbiriyle öğrenmeye çalışarsanız, biter. API'ler farklı görünüyor. Dokümanlar "ajan" nedir konusunda anlaşmazlık yaşıyor. Bir çerçeve paylaşılmış hafızasını "blackboard" olarak adlandırır, bir diğeri "eğitim havuzu" olarak adlandırır, bir diğeri "StateGraph" olarak adlandırır.

Bu değil. pazarlama altında, dört ilkel sabit. Bir kez öğrenin, her yeni çerçeveyi bir paragrafda okuyun.

## Anlam

### Dört ilkel

1. **Agent** bir sistem prompt ve bir araç listesi. İletiksel; her çalıştırma sistem prompt'undan ve mevcut mesaj geçmişinden başlar.
2. **Handoff** bir ajanın diğerine yönlendirilmiş bir kontrol transferü.
3. **Shared state** birden fazla ajanın okuyabileceği (bazen yazabileceği) herhangi bir veri yapısı. Mesaj havuzu, kara tahtası, anahtar değerleri depolama, vektör belleği.
4. **Orchestrator** kim sonraki konuşmayı seçebilir. Seçenekler: açık bir grafik (deterministik), bir LLM konuşmacı seçicisi (yumuşak), son konuşmacı'nın el eleme çağrısı (OpenAI Swarm), veya bir kuyruk üzerinde bir programlayıcı (swarm mimarisi).

Bu tüm tasarım alanı. Her çerçeve her eksesi için öntanımlı seçenekler seçer.

### 2026 çerçevesinin nasıl haritası

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

Yüzey farkları büyük görünüyor.

### Bu neden önemli?

İlkselleri gördüğünüzde, çerçeve karşılaştırması kısa bir kontrol listesi haline gelir:

- Orkestratör LLM'ye yönlendirmeyi (Swarm) güveniyor mu yoksa yönlendirmeyi kodla (LangGraph) belirliyor mu?
- Paylaşılan devlet tam tarihi (GroupChat) mi yoksa projelendirilen (StateGraph reducer) mi?
- Ajanlar birbirlerinin isteklerini değiştirebilir mi (CrewAI yöneticisi) yoksa sadece elden mi (Swarm)?

Bu üç sorunun cevabı, hangi çerçeveyi belirtilen bir soruya uygun buluyor. "En iyi çok ajan çerçevesini" satın almaktan vazgeçip aslında önem verdiğiniz ekseni tasarlamaya başlarsınız.

### Ülkesiz bir anlayış

Ortak durum hariç her primitif devletsizdir. Ajan bir fonksiyon (sürekli, araçlar). Elde etmek bir fonksiyon çağrısı. Orkestratör bir programcıdır. **The only stateful thing in the system is shared state.**Tüm ilginç hatalar burada yaşar: hafıza zehirlenmesi (Denevi 15), mesaj düzenleme, versiyonlama, yazma tartışmaları.

Paylaşılan durumunu gizleyen çerçeveler (Swarm) sorunu çağıran kişiye yönlendirir. Onu merkezileştiren çerçeveler (LangGraph kontrol noktası, AutoGen havuzu) onu denetleyici yapar ancak koordinasyon maliyetini paylaşılan durum uygulamasına aktarır.

### Tek bir ilkelin anatomisi

#### Ajan .

```
Agent = (system_prompt, tools, model, optional_name)
```

Aynı sistemde iki ajanın mesajı ve araçları değiştirilebilir.

#### Elverme

```
Handoff = (from_agent, to_agent, reason, payload)
```

Üç uygulama baskın:

- **Function return**Bu OpenAI Swarm modelidir. Ajanlar araç şemelerinde yönlendirme taşır.
- **Graph edge** LangGraph. Kenarlar deklaratifdir. LLM bir değer üretir; bir koşul bir sonraki düğmeyi seçer.
- **Speaker selection** AutoGen GroupChat. Seçim fonksiyonu (bazen kendisi bir LLM çağrısı) havuzu okuyor ve sonraki konuşmayı seçer.

#### Paylaşılan devlet

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

En az bir mesaj listesini oluşturmak. Genellikle daha fazla: yapılandırılmış eserler (CrewAI Görev çıkışları), tipize edilmiş bağlam (LangGraph azaltıcıları), dış bellek (MCP, vektör DB).

İki topoloji: **full pool**(her ajan her mesajı görür) ve **projected**(Agentler rol ölçeği görünümünü görüyor). Tam havuzlar basit ve kötü ölçeklendirilir.

#### Orkestratör

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Dört tat:

- **Static** grafik inşaat zamanında sabitlenir (LangGraph deterministic, CrewAI Sequential).
- **LLM-selected** Bir LLM havuzu okuyor ve bir sonraki konuşmayı seçer (AutoGen, CrewAI Hierarşik).
- **Handoff-driven** mevcut ajan bir teslimat aracı (Swarm) çağırarak karar verir.
- **Queue-driven** İşçiler ortak bir kuyruktan çekilir; açık bir sonraki hoparlör yok (swarm mimarileri, Matrix).

### Çerçeve arasındaki değişiklikler

İlkeler sabitlendikten sonra, kalan tasarım kararları şunlardır:

- **Memory strategy** geçici vs. dayanıklı kontrol noktası (LangGraph kontrol noktası).
- **Safety boundary** bir teslimat (işlemi yapan insan) onaylayabilir.
- **Cost accounting** Bir ajan başına token bütçeleri.
- **Observability** Elveriler izlemek, tekrar oynamak için devamlı durum.

Hepsi ilk önce uygulanabilir.

```figure
a5-primitive-radar
```

## Yapın

`code/main.py`Python'un 150 satırında dört ilksel uygulamasını uyguluyor.

Dosya ihracatı:

- `Agent` isim, sistem prompt, araç, politika işlevi ile ilgili bir veri sınıfı.
- `Handoff` yeni bir ajanı geri veren bir fonksiyon.
- `SharedState` bir iplik güvenli mesaj havuzu.
- `Orchestrator` Üç çeşit: `StaticOrchestrator`- Evet .`HandoffOrchestrator`- Evet .`LLMSelectorOrchestrator`(sümüle edilmiş).

Demo, üç orkestratör türü boyunca aynı üç ajan borusunu ( araştırma → yaz → inceleme) yürütür ve sonunda mesaj havuzunu yazdırır.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: üç orkestratör çalışması, bir örneğe göre. Her biri son mesaj havuzunu basar. Yükümle yönlendirilmiş çalışmalar araştırmacı erken yapılması karar verirse daha az ajanlara ulaşır.

## Kullan

`outputs/skill-primitive-mapper.md`Bu, bir dizi ajan kod tabanını veya çerçeve belgesini okuyan ve dört temel haritasını geri veren bir beceri.

## Gönder

Yeni bir çerçeveyi kabul etmeden önce, bunun için ilk önce haritasını yazın. Eğer yapamazsanız, belgeleri eksik veya çerçeve beşinci ilkciyi icat ediyor (görmediğiniz ortak durum tatı için nadir  kontrol edin).

Yapılandırmayı mimari belgesine bağlayın. Yeni bir ekip üyesi katıldığında, API belgeleri öncesine harita gönderin. Çerçeve sürümleri değiştiğinde, haritalama değişir, değişim logu değil.

## Egzersizler

1. Çık .`code/main.py`Orkestör seçiminin hangi ajanları yöneteceğini gözlemleyin.
2. Dördüncü orkestrasyon türünü uygulayın: ajanların iş için durumunu paylaştığı kuyruklu bir tür.
3. LangGraph hızlı başlangıcı (https://docs.langchain.com/oss/python/langgraph/workflows-agentsLangGraph'in soyutlama haritasından hangisi 1:1 ve hangisi rahatlık kaplamalarıdır?
4. OpenAI Swarm yemek kitabı okuyun (https://developers.openai.com/cookbook/examples/orchestrating_agents). Swarm'ın dört ilkelden hangisini en ergonomik hale getirdiğini ve hangisini çağıran kişiye itirdiğini belirleyin.
5. Bu tabloda paylaşılmış durumu tamamen gizleyen bir çerçeve bul ve ajanların geçmişi yeniden okumadan teslimatları koordine etmeleri gerektiğinde neyin kırıldığını açıkla.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Daha Fazla Okumak

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) el ele yönlendirilmiş orkestrasyonun en net ifade edilmesi
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) GroupChat + konuşmacı seçimi LLM seçilen orkestrasyon için referanstır
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Grafik kenarında orkestrasyon ve azaltıcı tabanlı ortak durum
- [CrewAI introduction](https://docs.crewai.com/en/introduction) Rol-hedef-geçmişli ajanlar, Sequential / Hierarchical processes
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) Microsoft'un v0.4'i bakıma geçirdiğinden sonra canlı AutoGen v0.2 hattı
