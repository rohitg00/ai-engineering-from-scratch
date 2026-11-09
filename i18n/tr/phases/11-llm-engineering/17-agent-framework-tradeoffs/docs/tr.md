# Ajan Çerçeve İşlemleri  Grafi, Rol ve Oyuncu Orkestrasyonu

> Her çerçeve aynı demoyu satar ( Araştırma ajanı bir rapor oluşturur) ve aynı hataları saklar (devlet şeması orkestrasyon katmanı ile savaşır).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## Sorun

Bir LLM çağrısı gereken bir göreviniz var. Belki bir araştırma iş akışı (plan, arama, özet, alıntı) olabilir. Belki bir kod inceleme boru hattı (parse diff, critic, patch, validate) olabilir. Belki de uçuşları kitaplayan, e-postalar yazar ve harcama raporlarını dosyalayan bir çok dönüş asistanıdır. Bir çerçeve seçersiniz.

Üç gün sonra, çerçevenin soyutlama sızdırmalarını keşfedersiniz. CrewAI size roller verir ama " araştırmacı " ' yazıcı " 'ya yapılandırılmış bir plan vermek zorunda kaldığında size savaşır. AutoGen size ajanlar arasında sohbet verir ama birinci sınıf bir durum yoktur. LangGraph size bir devlet grafikini verir ama ajanın ne yapacağını bilmeden önce her geçişin adını vermenizi zorlar. Agno size üç eş zamanlı işçiye yaymaya çalıştığınızda çığlık atan tek ajan bir soyutlama yapar.

Bu çözüm "en iyi çerçeveyi seç" değil. Bu çerçevenin temel soyutlamasını sorunun şekliyle eşleştirmektir. Bu ders bu haritayı çizer.

## Anlaşım

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

2026 manzarasında dört çerçeve hakimdir. Temel soyutlamaları aynı değil.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### "Abstraksiyon"un anlamı ne?

Bir çerçevenin temel soyutlama, mimariyi ortaya çıkarırken tahtaya çizdiğiniz şeydir.

- **LangGraph**→ bir grafik çizersiniz. düğümler adımlardır, kenarlar geçişlerdir ve her noktada durum nesnesi yazılır.
- **CrewAI**→ bir organ tablosu çizersiniz. her rolün bir iş açıklaması vardır ve bir yöneticisi görevleri yönlendirir.
- **AutoGen**İki ajan birbirine mesaj gönderir, bir üçüncü moderatöre ihtiyacınız varsa katılır.
- **Agno**Bir takım için bir kenara kutular koyun. Zihinsel model "batarya dahil bir ajan"tır.

### Devlet sorusu

Çoğu çerçeve seçeneğinin üretimde bozulduğu yer devlet.

- **LangGraph.**Tiplenmiş durum (`TypedDict`Bu nedenle, bu süreçte, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre, bir süre sonra, bir süre, bir süre sonra, bir süre sonra, bir süre, bir süre, bir süre sonra, bir süre sonra, bir süre, bir süre, bir süre, bir süre sonra, bir süre, bir süre, bir süre sonra, bir süre, bir süre, bir süre, bir süre sonra, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir sürececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececece
- **CrewAI.**Devlet akışları görevler arasındaki bir dizi olarak `context`alanı veya `output_pydantic`- Ekibe başına dayanıklı bir depo yok, eğer eskizlerin yeniden başlatılmasını sağlayacaksa kendi başına gidersin.
- **AutoGen.**Durum sohbet geçmişi ve kullanıcı tarafından tanımlanan herhangi bir durumdur `context`. Konuşma transkriptleri kalır; adaptörler yazmadıkça keyfi çalışma akışı durumu olmaz.
- **Agno.**Bir    ile bağlanan yerleşik depolama sürücüleri (SQLite, Postgres, Mongo, Redis, DynamoDB)`Agent`-`storage=` sohbet seansları ve kullanıcı hatıraları otomatik olarak kalır.

### Şekil sorusu

Her küçük bir ajanın şubesi, şubenin meselelerini kim karar verir.

- **LangGraph** koşullu kenarlar üzerinden karar verirsiniz. Routing, isimli dallarla bir Python fonksiyonu. Şubeler oluşturulan grafikte birinci sınıf; kontrol noktası hangi şubenin alınmış olduğunu kaydeder.
- **CrewAI** yöneticinin hiyerarşik modunda karar vermesi; sıralı modda oluşturma zamanında karar vermesi. Routing görev listesinde içindir; yöneticinin isteklendirilmesinden başka birinci sınıf "eğer" yoktur.
- **AutoGen**-Agentler sohbet yoluyla karar verir.`GroupChatManager`bir sonraki konuşmacı seçer; bir `speaker_selection_method`Ama standart, LLM ile yönlendirilir.
- **Agno** ajan, hangi aracı kullanıp bir sonraki çağrıda bulunacağını belirler.

### Gözlemsellik sorusu

- **LangGraph** LangSmith veya herhangi bir OTel ihracatçısı üzerinden OpenTelemetry. Her düğüm geçimi bir iz uzadıdır; kontrol noktaları tekrarlanabilir izler olarak ikiye katlanır. LangSmith ilk taraf seçeneğidir; Langfuse / Phoenix'in de adaptörleri vardır.
- **CrewAI** 2025 sonlarından itibaren birinci sınıf OpenTelemetry; Langfuse, Phoenix, Opik, AgentOps ile entegrasyonlar.
- **AutoGen** OpenTelemetry'nin entegrasyonu üzerinden `autogen-core`AgentOps ve Opik'in bağlantıları var.
- **Agno** İçeriye yerleştirilmiş `monitoring=True`Bayrak ve OpenTelemetry ihracatçıları; seans izleri için Langfuse ile sıkı bir entegrasyon.

### Masraf ve gecikme

Tüm dört çerçeve, arama başına genel maliyet ( çerçeve mantığı, doğrulama, serileştirme) ekler. Genel maliyetin artması için kaba bir sırayla: Agno ≈ LangGraph < CrewAI ≈ AutoGen. Fark, çerçeveye ne kadar fazladan LLM yönlendirme yapması ile baskınlaşır. CrewAI'nin hiyerarşik yöneticisi, kimlerin sonraki olduğuna karar vermek için jetonlar harcar.`GroupChatManager`LangGraph'in de sadece yazıp verdiğin tokenleri harcayacağı yer.`llm.invoke`Agno'nun tek ajan yolu ince.

Bir koşu başına maliyet önemli olduğunda açık yönlendirmeyi tercih edin (LangGraph kenarları, AutoGen `speaker_selection_method`) ile LLM seçilen yönlendirme.

### İşbirliği

- **LangGraph** **LangChain**MCP sunucu olarak ithal edilen araçlar, retrievers, LLMs. Birinci sınıf MCP adaptörü.
- **CrewAI** araçlardan miras alınan araçlar `BaseTool`LangChain araçları, LlamaIndex araçları ve MCP araçları hepsi uyum sağlar.`allow_delegation=True`- Evet .
- **AutoGen**→ `FunctionTool`Python'un çağrılabilir tüm programlarını kapsıyor, MCP adaptörü mevcut.
- **Agno**→ `@tool`dekorasyon veya BaseTool alt sınıfı; MCP adaptörü; araçlar ajanlar ve ekipler arasında paylaşılabilir.

## Yetenek

> Bir cümleyle, belirli bir çerçeveyi belirli bir ajan sorunu için neden doğru olduğunu açıklayabilirsiniz.

Öntanımlı kontrol listesi:

1. **Draw the shape.**Bu bir grafik mi (tipileşmiş durum, isimlendirilmiş geçişler)? Rol oyunu (özeller işten vazgeçti)?
2. **Decide who branches.**Geliştiriciler tarafından belirlenen dalgalama → LangGraph. Yöneticiler tarafından belirlenen ajanlar tarafından belirlenen personeller → CrewAI hiyerarşik. Çat-yönemli → AutoGen. Araç-sağlama-verilen kararlar → Agno.
3. **Check the state budget.**Kontrol noktasından devam etmeniz gerekiyor mu? Zaman yolculuğu? İnsan çalışmanın ortasında keser mi? Evetse, LangGraph varsayılan; Agno seansları konuşma ölçekli durumları kapsar.
4. **Check the cost budget.**LLM'nin seçtiği yönlendirme, her turda ekstra token ödemektedir.
5. **Budget the framework overhead.**Her çerçeve başka bir bağımlılıktır. Eğer görev iki LLM çağrısı ve bir araç ise, basit Python'un 30 satırı yazın; hiçbir çerçeve hiçbir çerçeveden daha ucuz değildir.

Grafiği, organ grafikini, sohbet yapmayı ya da ajan kutusunu çizmeden önce bir çerçeveye ulaşmayı reddet.

## Karar Matrisi

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## Egzersizler

1. **Easy.**Aynı görevi  "Anthropic'in merkez merkezini araştırın, 200 kelimelik bir kısaca yazın, kaynakları alıntılayın"  ve LangGraph'te (dört düğüm: plan, arama, yazma, alıntı) ve CrewAI'de (üç rol: araştırmacı, yazar, editör) uygulayın.
2. **Medium.**Aynı görevi AutoGen'de oluşturun ( araştırmacı  yazar sohbet, editör üzerinden katılır `GroupChat`) ve Agno (tek bir ajanla birlikte)`search_tools`ve `write_tools`Dört uygulamayı a) her koşuşturma maliyetine, b) bir kaza sonrası yeniden başlatma yeteneğine, c) yazma aşamasından önce insan onayını enjekte etme yeteneğine göre sıralayın.
3. **Hard.**Karar ağacı metni oluştur `pick_framework.py`Bu kısa bir sorun açıklaması (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) ve bir cümleyle bir tavsiye ile bir tembih gönderir.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## Daha Fazla Okumak

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) StateGraph, kontrol noktaları, kesintiler, zaman yolculuğu.
- [CrewAI documentation](https://docs.crewai.com/) Ekipleri, Akışlar, Ajanlar, Görevler, İşlemler.
- [AutoGen documentation](https://microsoft.github.io/autogen/) KonuşılabilirAgent, Grup Çat, takımlar, araçlar.
- [Agno documentation](https://docs.agno.com/)- Ajan, takım, iş akışı, depolama, hafıza.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) Şablon kütüphanesi (sürekli zincirleme, yönlendirme, paralelleştirme, orkestrasyon-işçiler, değerlendirici-optimalisyen) çerçeve-agnostik.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) her çerçeve döngüye bürünür.
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) AutoGen'in tasarım kağıdı.
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442)CrewAI tarzı karakter yığınlarının üzerine kurduğu rol oynaması temelleri.
- Bu ders karşılaştırma çerçevesini 11 · 16 (LangGraph)
- 11 · 19 aşaması (Refleksiyon)  LangGraph'e temiz bir şekilde, ancak CrewAI'ye garip bir şekilde haritan bir desen.
- 11 · 22 aşama (İşlemenin gözlemlenebilirliği)  hangi çerçeveyi seçtiğinizden bağımsız olarak nasıl bir araç kullanacağınız.
