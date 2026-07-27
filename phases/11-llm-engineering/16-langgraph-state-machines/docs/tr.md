# Agent Durum Makineleri — Grafikler, Düğümler, Kontrol Noktaları

> Elle yazılmış bir ReAct döngüsü bir `while True`'dır. Açık bir grafik olarak yazılan aynı döngü, kontrol noktası oluşturabileceğiniz, kesebileceğiniz, dallara ayırabileceğiniz ve zamanda yolculuk yapabileceğiniz bir şeydir. agent değişmedi. Etrafında koşum takımı var.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 11 · 09 (İşlev Çağrısı), Aşama 11 · 14 (Model Bağlam Protokolü)
**Süre:** ~75 dakika

## Sorun

İşlev çağıran bir agent gönderiyorsunuz. Üç tur boyunca çalışır, sonra bir şeyler ters gider: Model 500 değerini döndüren bir aracı dener, kullanıcı görevin ortasında fikrini değiştirir veya agent, bir insan tarafından imzalanmadan bir siparişin parasını iade etmeye karar verir. `while True:` döngüsünün kancaları yoktur. Duraklatamazsınız, geri saramazsınız ve "Ya model diğer aracı seçseydi" diye dallara ayrılamazsınız. Bunu bir demodan sonra gönderdiğiniz anda, agent çalışan ya da çalışmayan bir kara kutuya dönüşür.

Bir sonraki adım onu ​​gördüğünüzde açıktır. agent zaten bir durum makinesidir — sistem prompt artı mesaj geçmişi artı bekleyen araç çağrıları artı bir sonraki eylem. Durum makinesini açık hale getirin: "model düşünüyor", "bir araç çalışıyor", "bir insan onaylıyor" için düğümler ve bunlar arasındaki koşullu geçişler için kenarlar. Grafik açık hale geldiğinde, koşum dört şeyi ücretsiz olarak alır: kontrol noktası oluşturma (adımlar arasında durumu kaydetme), kesintiler (bir insan için duraklama), akış (akış token'lar ve ara olaylar) ve zaman yolculuğu (önceki bir duruma geri sarma ve farklı bir dal deneme).

Bu soyutlamanın referans uygulaması LangGraph'tır. LangChain anlamında bir agent framework değildir ("işte bir AgentYönetici, iyi şanslar"). Birinci sınıf durum, birinci sınıf kalıcılık ve birinci sınıf kesintilere sahip bir grafik çalışma zamanıdır. agent loop elle yazdığınız bir şey değil, çizdiğiniz bir şeydir.

## Konsept

![LangGraph StateGraph: düğümler, kenarlar ve kontrol işaretçisi](../assets/langgraph-stategraph.svg)

Bir `StateGraph`'nin üç şeyi vardır.

1. **Durum.** Grafik boyunca akan, yazılan bir dikte (TypedDict veya Pydantic modeli). Her düğüm tam durumu alır ve kısmi bir güncelleme döndürür; LangGraph bu güncellemeyi alan başına bir *redüktör* kullanarak birleştirir - birikmesi gereken listeler için varsayılan olarak üzerine yazılan `operator.add`.
2. **Düğümler.** Python işlevleri `state -> partial_state`. Her biri ayrı bir adımdır: "modeli çağırma", "araçları çalıştırma", "özetleme".
3. **Kenarlar.** Düğümler arasındaki geçişler. Statik kenarlar tek bir yere gider. Koşullu kenarlar, `state -> next_node_name` yönlendirici fonksiyonunu alır, böylece grafik, model çıkışında dallanabilir.

Grafiği derlersiniz. Derleme topolojiyi bağlar, bir denetim noktası ekler (isteğe bağlı ancak üretim için gereklidir) ve çalıştırılabilir bir öğe döndürür. Bunu bir başlangıç ​​durumu ve bir `thread_id` ile çağırırsınız. Yürütmenin her adımında `(thread_id, checkpoint_id)` anahtarlı bir kontrol noktası bulunur.

### Dört süper güç

**Kontrol noktası oluşturma.** Her düğüm geçişi yeni durumu bir depoya yazar (testler için bellek içi, üretim için Postgres/Redis/SQLite). Grafiği aynı `thread_id` ile tekrar çağırarak devam edin. Grafik duraklatıldığı yerden devam eder.

**Kesintiler.** Bir düğümü `interrupt_before=["human_review"]` ile işaretleyin ve bu düğüm çalıştırılmadan önce yürütme durdurulur. Devlet varlığını sürdürüyor. API'niz kullanıcıya "onay bekleniyor" şeklinde yanıt verir. Aynı `thread_id`'ye `Command(resume=...)` ile yapılan daha sonraki bir istek yürütmeyi sürdürür.

**Akış.** `graph.stream(state, mode="updates")`, durum deltalarını gerçekleştiği anda verir. `mode="messages"`, LLM token'leri model düğümlerinin içine aktarır. `mode="values"` tam anlık görüntüler sağlar. Kullanıcı arayüzünüzde neyin ortaya çıkacağını siz seçersiniz.

**Zaman yolculuğu.** `graph.get_state_history(thread_id)` tam kontrol noktası günlüğünü döndürür. Herhangi bir önceki `checkpoint_id`'yi `graph.invoke`'ye iletin ve o noktadan itibaren çatallayın. Hata ayıklama ("model bunun yerine B takımını seçmiş olsaydı?") ve üretim izlerini tekrarlayan regresyon testleri için idealdir.

### Redüktörler önemli

Her durum alanının bir redüktörü vardır. Varsayılanların çoğu uygundur; yeni bir değer eskisinin üzerine yazar. Ancak mesaj listelerinin `operator.add`'ye ihtiyacı vardır, dolayısıyla yeni mesajlar değiştirilmek yerine eklenir. Paralel kenarlar güncellemelerini redüktör aracılığıyla birleştirir. Eğer iki düğüm de `messages`'yi güncellerse ve siz `Annotated[list, add_messages]`'yi unutursanız, ikinci sessizce kazanır ve turun yarısını kaybedersiniz. Redüktör, kütüphanedeki tek incelikli şeydir; doğru yapın ve gerisini oluşturun.

### Dört düğümdeki ReAct grafiği

Bir üretim ReAct agent dört düğüm ve iki kenardan oluşur:

1. `agent` — geçerli mesaj geçmişiyle LLM'yi arar. Asistan mesajını döndürür (tool_calls içerebilir).
2. `tools` — son asistan mesajındaki herhangi bir araç_çağrısını yürütür, araç sonuçlarını araç mesajları olarak ekler.
3. Son mesajda tool_call'lar varsa `tools`'ye, aksi halde `END`'ye yönlendiren, `agent`'dan koşullu bir kenar.
4. `tools`'dan `agent`'ye doğru statik bir kenar.

İşte bu. Yaklaşık 40 satır kodla tam ReAct döngüsünü (Düşünce → Eylem → Gözlem → Düşünce →…) kontrol noktası oluşturma, kesintiler ve akışla elde edersiniz.

### StateGraph ve Gönderme (genişleme)

`Send(node_name, state)`, bir düğümün paralel alt grafikler göndermesine izin verir. Örnek: agent aynı anda üç alıcıyı sorgulamaya karar verir. Her `Send`, hedef düğümün paralel yürütülmesini sağlar; çıktıları durum düşürücü aracılığıyla birleşir. LangGraph, orkestratör-işçi modelini, ilkelleri iş parçacığına ayırmadan bu şekilde ifade eder.

### Alt grafikler

Derlenmiş bir grafik başka bir grafikteki düğüm olabilir. Dış grafikte tek bir düğüm görülüyor; iç grafiğin kendi durumu ve kendi kontrol noktaları vardır. Ekipler, gözetmen-çalışan agent'larını bu şekilde oluşturur: gözetmen grafiği, kullanıcı amacını alan başına çalışan alt grafiğine yönlendirir.

## İnşa Et

### Adım 1: durum ve düğümler

```python
from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

def agent_node(state: State) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: State) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END

tool_node = ToolNode(tools=[search_web, read_file])

graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")

app = graph.compile(checkpointer=MemorySaver())
```

`add_messages`, mesaj listesinin üzerine yazmak yerine birikmesini sağlayan azaltıcıdır. Bunu unutmak en yaygın LangGraph hatasıdır.

### Adım 2: bir iş parçacığıyla çalıştırın

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

Her güncelleme bir deyimdir `{node_name: state_delta}`. Kullanıcı arabiriminiz bunları kullanıcı arayüzüne aktarabilir, böylece kullanıcılar "agent düşünüyor... search_web'i çağırıyor... sonuç aldı... yanıt veriyor."

### Adım 3: döngüdeki insan kesintisini ekleyin

Bir düğümü, yürütmenin çalıştırılmadan önce duraklatılacağı şekilde işaretleyin.

```python
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["tools"],  # pause before every tool call
)

state = app.invoke({"messages": [HumanMessage("delete the production database")]}, config)
# state["__interrupt__"] is set. Inspect proposed tool calls.
# If approved:
from langgraph.types import Command
app.invoke(Command(resume=True), config)
# If denied: write a rejection message and resume
app.update_state(config, {"messages": [AIMessage("Blocked by human reviewer.")]})
```

Durum, kontrol noktası ve iş parçacığının tümü kesme boyunca devam eder. Yürütme dışında hiçbir şey hafızada değildir.

### Adım 4: hata ayıklama için zaman yolculuğu

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# Fork from a prior checkpoint
target = history[3].config  # three steps back
for event in app.stream(None, target, stream_mode="values"):
    pass  # replay from that point forward
```

Verilen kontrol noktasından giriş tekrar oynatılırken `None`'nin iletilmesi; bir değerin iletilmesi, devam etmeden önce onu söz konusu denetim noktasının durumuna bir güncelleme olarak ekler. Bu, tüm konuşmayı yeniden çalıştırmadan kötü bir agent çalıştırmayı bu şekilde yeniden üretirsiniz.

### Adım 5: üretim için kontrol işaretçisini değiştirin

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

SQLite, Redis ve Postgres gönderilir. `MemorySaver` testler içindir. Yeniden başlatmalarda devam eden her şey gerçek bir mağaza ister.

## Beceri

> agent'ları `while True` döngüleri olarak değil, grafikler olarak oluşturursunuz.

LangGraph'a ulaşmadan önce 60 saniyelik bir tasarım yapın:

1. **Düğümleri adlandırın.** Her ayrık karar veya yan etkili eylem bir düğümdür. "Agent düşünüyor", "araç çalıştırılıyor", "inceleyen onaylıyor", "yanıt akışları." Bunları listeleyemiyorsanız görev henüz agent şeklinde değildir.
2. **Durumu bildirin.** Her liste alanı için azaltıcı içeren Minimal TypedDict. Her şeyi `messages` içine doldurmayın; göreve özgü alanları (çalışan bir `plan`, bir `budget` sayacı, bir `retrieved_docs` listesi) en üst seviyeye kaldırın.
3. **Kenarları çizin.** Bir sonraki adım model çıktısına bağlı olmadığı sürece statiktir. Her koşullu kenarın, adlandırılmış dallara sahip bir yönlendirici işlevine ihtiyacı vardır.
4. **Önceden bir kontrol noktası seçin.** Testler için `MemorySaver`, diğer her şey için Postgres/Redis/SQLite. Kontrol noktası olmadan gönderim yapmayın; kontrol noktasının olmaması, özgeçmişin olmaması, kesinti olmaması, zaman yolculuğunun olmaması anlamına gelir.
5. **Kesintilere, araçlar çalıştırıldıktan sonra değil, önce karar verin.** Onaylar, yan etkili bir düğüme doğru ilerler, böylece zarar vermeden önce iptal edebilirsiniz; Doğrulama modelin sonuna kadar devam eder, böylece kötü aramaları ucuza reddedebilirsiniz.
6. **Varsayılan olarak akış.** Kullanıcı arayüzü için `mode="updates"`, model düğümleri içindeki token düzeyindeki akış için `mode="messages"`, değerlendirme sırasında tam anlık görüntüler için `mode="values"`.

Kontrol noktası olmayan bir LangGraph agent göndermeyi reddedin. Yan etkiden *sonra* kesintiye uğrayan bir ürünü göndermeyi reddedin. Redüktörü `add_messages` olmadan bir `messages` alanını göndermeyi reddedin.

## Egzersizler

1. **Kolay.** Yukarıdaki dört düğümlü ReAct grafiğini bir hesap makinesi aracı ve bir web arama aracıyla uygulayın. `list(app.get_state_history(config))`'nin iki turluk bir konuşma için en az dört kontrol noktası döndürdüğünü doğrulayın.
2. **Orta.** `agent`'den önce çalışan ve yapılandırılmış bir `plan: list[str]`'yi duruma yazan bir `planner` düğümü ekleyin. `agent` plan adımlarını tamamlandı olarak işaretlesin. `plan` bir kontrol noktası özgeçmişinde kaybolursa (yanlış azaltıcı) testte başarısız olun.
3. **Zor.** `Send` kullanarak üç alt grafik (`researcher`, `writer`, `reviewer`) arasında yönlendirme yapan bir denetleyici grafiği oluşturun. Her alt grafiğin kendi durumu ve kontrol noktası vardır. Bir kişinin araştırma özetini onaylayabilmesi için dış grafiğe bir `interrupt_before=["writer"]` ekleyin. Önceki bir kontrol noktasından zaman yolculuğunun yalnızca çatallı dalı yeniden çalıştırdığını doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Durum Grafiği | "LangGraph grafiği" | Derlemeden önce düğümleri ve kenarları eklediğiniz oluşturucu nesnesi. |
| Redüktör | "Alan nasıl birleşir" | Bir düğüm o alan için bir güncelleme döndürdüğünde uygulanan bir `(old, new) -> merged` işlevi; varsayılan üzerine yazmadır, `add_messages` eklenir. |
| Konu | "Bir görüşme kimliği" | Bir oturum için tüm kontrol noktalarını kapsayan bir `thread_id` dizesi. |
| Kontrol noktası | "Duraklatılmış durum" | `(thread_id, checkpoint_id)` ile anahtarlanmış, bir düğüm geçişinden sonra tam grafik durumunun kalıcı anlık görüntüsü. |
| Kesinti | "Bir insan için duraklama" | `interrupt_before` / `interrupt_after` düğüm sınırında yürütmeyi durdurur; `Command(resume=...)` ile devam et. |
| Zaman yolculuğu | "Önceki adımdan çatal" | `graph.invoke(None, config_with_old_checkpoint_id)` bu kontrol noktasından itibaren tekrar oynatıyor. |
| Gönder | "Paralel alt grafik gönderimi" | Bir düğümün yapıcısı, hedef düğümün N paralel yürütmesini oluşturmak için geri dönebilir. |
| Altyazı | "Düğüm olarak derlenmiş bir grafik" | Başka bir grafikte düğüm olarak kullanılan derlenmiş bir StateGraph; kendi devlet kapsamını korur. |

## Daha Fazla Okuma

- [LangGraph belgeleri](https://langchain-ai.github.io/langgraph/) — StateGraph, düşürücüler, denetim noktaları ve kesmeler için kurallı referans.
- [LangGraph kavramları: durum, indirgeyiciler, kontrol noktaları](https://langchain-ai.github.io/langgraph/concepts/low_level/) — bu dersin kullandığı zihinsel model, doğrudan kaynaktan.
- [LangGraph Persistence and Checkpoints](https://langchain-ai.github.io/langgraph/concepts/persistence/) — Postgres/SQLite/Redis depoları, kontrol noktası ad alanları ve iş parçacığı kimlikleriyle ilgili ayrıntılar.
- [LangGraph Döngüdeki İnsan](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) — `interrupt_before`, `interrupt_after`, `Command(resume=...)` ve düzenleme durumu modeli.
- [Yao ve diğerleri, "ReAct: Dil Modellerinde Akıl Yürütme ve Harekete Geçme" (ICLR 2023)](https://arxiv.org/abs/2210.03629) — her LangGraph agent'nin uyguladığı model; muhakeme izleme gerekçesi için okuyun.
- [Anthropic — Etkili agent'ler oluşturmak (Aralık 2024)](https://www.anthropic.com/research/building-effective-agents) — hangi grafik şekillerinin (zincir, yönlendirici, orkestratör-çalışanlar, değerlendirici-optimizer) ve ne zaman tercih edileceği.
- Aşama 11 · 09 (İşlev Çağrısı) — her LangGraph agent düğümünün yeniden kullandığı araç çağrısı ilkel öğesi.
- Aşama 11 · 14 (Model Bağlam Protokolü) — MCP adaptörü aracılığıyla LangGraph `ToolNode`'ye bağlanan harici araç keşfi.
- Aşama 11 · 17 (Agent framework değiş tokuş) — CrewAI, AutoGen veya Agno yerine LangGraph'ın ne zaman seçileceği.
