# Neden Çoklu-Agent?

> Bir agent duvara çarpıyor. Akıllı hamle daha büyük bir agent değil - daha fazla agents.

**Tür:** Öğren
**Diller:** TypeScript
**Önkoşullar:** Aşama 14 (Agent Mühendislik)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Tek-agent tavanını tanımlayın (bağlam taşması, karma uzmanlık, sıralı darboğaz) ve birden fazla agent'a bölmenin ne zaman doğru hareket olduğunu açıklayın
- Düzenleme modellerini (boru hattı, paralel yayma, denetleyici, hiyerarşik) karşılaştırın ve belirli bir görev yapısı için doğru olanı seçin
- Açık rol sınırlarına, paylaşılan duruma ve iletişim sözleşmesine sahip bir çoklu-agent sistemi tasarlayın
- Çoklu-agent karmaşıklığı (gecikme, maliyet, hata ayıklama zorluğu) ile tek-agent basitliği arasındaki dengeleri analiz edin

## Sorun

14. Aşamada tek bir agent inşa ettiniz. Çalışıyor. Dosyaları okuyabilir, komutları çalıştırabilir, API'leri arayabilir ve sonuçlarla ilgili nedenler belirleyebilir. Daha sonra bunu gerçek bir kod tabanına yönlendirirsiniz: 200 dosya, üç dil, altyapıya bağlı testler ve kod yazmadan önce harici API'leri araştırma zorunluluğu.

agent boğuluyor. LLM'nin aptal olması nedeniyle değil, görevin bir agent loop'in kaldırabileceğinden fazla olması nedeniyle. context window dosya içeriğiyle dolar. agent 40 araç çağrısı önce okuduğunu unutuyor. Aynı anda araştırmacı, kodlayıcı ve incelemeci olmaya çalışır ve üçünü de kötü bir şekilde yapar.

Bu tek-agent tavandır. Bir görevin gerektirdiği her zaman ona basarsınız:

- **Tek pencereye sığmayacak kadar fazla içerik** - 50 dosyayı okumak 200 bin token saniyeyi geçiyor
- **Farklı aşamalarda farklı uzmanlık** - araştırma, kod oluşturmadan farklı prompting gerektirir
- **Paralel olarak gerçekleşebilecek işler** - Üç dosyayı aynı anda okuyabilmek varken neden sırayla okuyasınız ki?

## Konsept

### Tek-Agent Tavan

Tek bir agent bir döngü, bir context window, bir sistem prompt'dir. Resim:

```
┌─────────────────────────────────────────┐
│            SINGLE AGENT                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Context Window            │  │
│  │                                   │  │
│  │  research notes                   │  │
│  │  + code files                     │  │
│  │  + test output                    │  │
│  │  + review feedback                │  │
│  │  + API docs                       │  │
│  │  + ...                            │  │
│  │                                   │  │
│  │  ██████████████████████ FULL ███  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  One system prompt tries to cover       │
│  research + coding + review + testing   │
│                                         │
│  Result: mediocre at everything         │
└─────────────────────────────────────────┘
```

Üç şey bozulur:

1. **Bağlam doygunluğu** - araç sonuçları birikiyor. 30. virajda, agent 150k tokens dosya içeriğini, komut çıktılarını ve önceki muhakemeyi tüketmiştir. 5. virajdaki kritik ayrıntılar kayboluyor.

2. **Rol karışıklığı** - "sen bir araştırmacı, kodlayıcı, gözden geçiren ve testçisin" diyen bir sistem prompt, yarı araştıran, yarı kodlayan ve incelemeyi asla bitirmeyen bir agent üretir.

3. **Sıralı darboğaz** - agent, A dosyasını, ardından B dosyasını, ardından C dosyasını okur. Üç seri LLM çağrısı. Üç seri takım uygulaması. Paralellik yok.

### Çoklu-Agent Çözümü

İşi bölün. Her agent'a bir iş, bir context window ve o iş için ayarlanmış bir sistem prompt verin:

```
┌──────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                          │
│                                                          │
│  "Build a REST API for user management"                  │
│                                                          │
│         ┌──────────┬──────────┬──────────┐               │
│         │          │          │          │               │
│         ▼          ▼          ▼          ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │RESEARCHER│ │  CODER   │ │ REVIEWER │ │  TESTER  │  │
│   │          │ │          │ │          │ │          │  │
│   │ Reads    │ │ Writes   │ │ Checks   │ │ Runs     │  │
│   │ docs,    │ │ code     │ │ code     │ │ tests,   │  │
│   │ finds    │ │ based on │ │ quality, │ │ reports  │  │
│   │ patterns │ │ research │ │ finds    │ │ results  │  │
│   │          │ │ + spec   │ │ bugs     │ │          │  │
│   └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│         │           │            │             │         │
│         └───────────┴────────────┴─────────────┘         │
│                          │                               │
│                     Merge results                        │
└──────────────────────────────────────────────────────────┘
```

Her agent şunları içerir:
- Odaklanmış bir sistem prompt ("Siz bir kod incelemecisisiniz. Tek göreviniz hataları bulmaktır.")
- Kendi context window'si (diğer agent'larin çalışmaları tarafından kirlenmemiş)
- Açık bir girdi/çıktı sözleşmesi (araştırma notlarını alır, çıktı kodunu alır)

### Bunu Yapan Gerçek Sistemler

**Claude Code subagents** - Claude Code, `Task` ile bir subagent oluşturduğunda, kapsamı belirlenmiş bir göreve sahip bir alt agent oluşturur. Ebeveyn bağlamını temiz tutar. Çocuk odaklanmış bir çalışma yapar ve bir özet verir.

**Devin** - bir planlayıcıyı agent, bir kodlayıcıyı agent ve bir tarayıcıyı agent çalıştırır. Planlayıcı işi adımlara ayırır. Kodlayıcı kodu yazar. Tarayıcı belgeleri araştırır. Her birinin ayrı bir bağlamı var.

**Çoklu-agent kodlama ekipleri (SWE-bench)** - SWE-bench'teki en iyi performansa sahip sistemler, kod tabanını okuyan bir araştırmacı, düzeltmeyi tasarlayan bir planlayıcı ve bunu uygulayan bir kodlayıcı kullanır. Tek-agent sistemleri daha düşük puan alır.

**ChatGPT Derin Araştırma** - her biri farklı bir açıyı araştıran birden fazla arama agent'yı paralel olarak üretir ve ardından sonuçları sentezler.

### Spektrum

Multi-agent ikili değildir. Bu bir spektrumdur:

```
SIMPLE ──────────────────────────────────────────── COMPLEX

 Single        Sub-         Pipeline      Team         Swarm
 Agent         agents

 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ │
 └───┘       └─┬─┘        └───┘─┬─┘    └─┬─┘─┬─┘    └┬┘└┬┘└┬┘
               │                │        │   │       ┌┴──┴──┴┐
             ┌─┴─┐          ┌───┘───┐    │   │       │shared │
             │ a │          │ C │ D │  ┌─┴───┴─┐    │ state │
             └───┘          └───┘───┘  │  msg   │    └───────┘
                                       │  bus   │
 1 loop      Parent +      Stage by    │       │    N peers,
 1 context   child tasks   stage       └───────┘    emergent
                                       Explicit      behavior
                                       roles
```

**Tek agent** - bir döngü, bir prompt. Basit görevler için iyidir.

**Altagent'lar** - bir ebeveyn, odaklanılan alt görevler için çocukları doğurur. Ebeveyn planı sürdürür. Çocuklar geri bildirimde bulunur. Claude Kodunun yaptığı budur.

**Ardışık düzen** - agent'lar sırayla çalışır. Agent A'nın çıkışı, Agent B'nin girişi olur. Aşamalı iş akışları için iyidir: araştırma -> kod -> inceleme -> test.

**Takım** - agent'lar paylaşılan bir mesaj veriyoluyla paralel olarak çalışır. Her birinin bir rolü var. Bir orkestratör koordine eder. Aynı anda farklı becerilere ihtiyaç duyulduğunda iyidir.

**Sürü** - paylaşılan duruma sahip birçok aynı veya neredeyse aynı agent'lar. Sabit bir orkestratör yok. Agentişleri kuyruktan alıyor. Yüksek verimli paralel görevler için iyidir.

### Dört Çoklu-Agent Desen

#### Desen 1: Boru Hattı

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

Her agent veriyi dönüştürür ve iletir. Mantık yürütmek basit. Bir aşamadaki başarısızlık geri kalanını engeller.

#### Desen 2: Fan çıkışı / Fan girişi

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

Çalışmayı paralel agent'lara bölün, ardından sonuçları birleştirin. Bağımsız alt görevlere ayrılan görevler için iyidir.

#### Desen 3: Orkestratör-Çalışan

```
                    ┌──────────┐
                    │  Orch.   │
                    └──┬───┬───┘
                  task │   │ task
                 ┌─────┘   └─────┐
                 ▼               ▼
           ┌──────────┐   ┌──────────┐
           │ Worker A │   │ Worker B │
           └──────────┘   └──────────┘
```

Akıllı bir orkestratör ne yapılacağına karar verir, çalışanlara yetki verir ve sonuçları sentezler. Orkestratörün kendisi, işçi yetiştirmeye yönelik araçlara sahip bir agent'tır.

#### Desen 4: Akran Sürüsü

```
         ┌───┐ ◄──── msg ────▶ ┌───┐
         │ A │                  │ B │
         └─┬─┘                  └─┬─┘
           │                      │
      msg  │    ┌───────────┐     │ msg
           └───▶│  Shared   │◄────┘
                │  State    │
           ┌───▶│  / Queue  │◄────┐
           │    └───────────┘     │
      msg  │                      │ msg
         ┌─┴─┐                  ┌─┴─┐
         │ C │ ◄──── msg ────▶ │ D │
         └───┘                  └───┘
```

Merkezi orkestratör yok. Agent'lar eşler arası iletişim kurar. Kararlar etkileşim sonucu ortaya çıkar. Hata ayıklamak daha zordur ancak birçok agent'a ölçeklenir.

### Çoklu-Agent Ne Zaman Kullanılmamalı?

Multi-agent karmaşıklığı artırır. agent'lar arasındaki her mesaj potansiyel bir başarısızlık noktasıdır. Hata ayıklama, "bir ileti dizisini okumaktan" "beş agent saniye boyunca iletileri izlemeye" doğru gider.

**Bekar kalın-agent şu durumlarda:**
- Görev bir context window içine sığar (~100k token çalışma verisinin altında)
- Farklı aşamalar için farklı sistem prompt'lare ihtiyacınız yok
- Sıralı yürütme yeterince hızlı
- Görev, bölmenin değerden daha fazla yük getireceği kadar basittir

**Karmaşıklık maliyeti:**
- Her agent sınırı, kayıplı bir sıkıştırma adımıdır: agent A'nın tam içeriği, agent B için bir mesajda özetlenir
- Koordinasyon mantığı (kimin neyi, ne zaman, hangi sırayla yaptığı) başlı başına hata kaynağıdır
- Gecikme artar: N agents, N seri LLM çağrılarının minimum olduğu anlamına gelir, ileri geri konuşmaları gerekiyorsa daha fazla
- Maliyet artar: her agent, token'lari bağımsız olarak yakar

Temel kural: Eğer bir görev 20'den az araç çağrısı gerektiriyorsa ve 100k tokens'ye sığıyorsa, onu tekli-agent tutun.

```figure
swarm-messages
```

## Build It — Kendin Geliştir

### Adım 1: Aşırı Yüklenmiş Tekli Agent

İşte her şeyi yapmaya çalışan tek bir agent. Araştırma, kod ve incelemeleri barındıran devasa bir prompt sistemi ve bir context window sistemi vardır:

```typescript
type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `You are a full-stack developer. You must:
1. Research the requirements
2. Write the code
3. Review the code for bugs
4. Write tests
Do ALL of these in a single conversation.`;

  const contextWindow: string[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const research = await fakeLLMCall(systemPrompt, `Research: ${task}`);
  contextWindow.push(research.output);
  totalTokens += research.tokens;
  totalToolCalls += research.calls;

  const code = await fakeLLMCall(
    systemPrompt,
    `Given this research:\n${contextWindow.join("\n")}\n\nNow write code for: ${task}`
  );
  contextWindow.push(code.output);
  totalTokens += code.tokens;
  totalToolCalls += code.calls;

  const review = await fakeLLMCall(
    systemPrompt,
    `Given all previous context:\n${contextWindow.join("\n")}\n\nReview the code.`
  );
  contextWindow.push(review.output);
  totalTokens += review.tokens;
  totalToolCalls += review.calls;

  return {
    content: contextWindow.join("\n---\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

Bu yaklaşımla ilgili sorunlar:
- context window her aşamada büyür. İnceleme adımı, araştırma notlarını, kodu VE önceki akıl yürütmeyi içerir.
- prompt sistemi geneldir. Her aşama için ayarlanamaz.
- Hiçbir şey paralel yürümez.

### Adım 2: Uzman Agent'lar

Şimdi böl. Her agent bir iş alır:

```typescript
type SpecialistAgent = {
  name: string;
  systemPrompt: string;
  run: (input: string) => Promise<AgentResult>;
};

function createSpecialist(name: string, systemPrompt: string): SpecialistAgent {
  return {
    name,
    systemPrompt,
    run: async (input: string) => {
      const result = await fakeLLMCall(systemPrompt, input);
      return {
        content: result.output,
        tokensUsed: result.tokens,
        toolCalls: result.calls,
      };
    },
  };
}

const researcher = createSpecialist(
  "researcher",
  "You are a technical researcher. Read documentation, find patterns, and summarize findings. Output only the facts needed for implementation."
);

const coder = createSpecialist(
  "coder",
  "You are a senior TypeScript developer. Given requirements and research notes, write clean, tested code. Nothing else."
);

const reviewer = createSpecialist(
  "reviewer",
  "You are a code reviewer. Find bugs, security issues, and logic errors. Be specific. Cite line numbers."
);
```

Her uzmanın odaklanmış bir prompt'si vardır. Her biri yalnızca ihtiyaç duyduğu girişi içeren temiz bir context window alır.

### 3. Adım: Mesajlarla Koordinasyon Sağlayın

Açık mesaj aktarımıyla uzmanları bir araya getirin:

```typescript
type AgentMessage = {
  from: string;
  to: string;
  content: string;
  timestamp: number;
};

async function multiAgentApproach(task: string): Promise<AgentResult> {
  const messages: AgentMessage[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const researchResult = await researcher.run(task);
  messages.push({
    from: "researcher",
    to: "coder",
    content: researchResult.content,
    timestamp: Date.now(),
  });
  totalTokens += researchResult.tokensUsed;
  totalToolCalls += researchResult.toolCalls;

  const coderInput = messages
    .filter((m) => m.to === "coder")
    .map((m) => `[From ${m.from}]: ${m.content}`)
    .join("\n");

  const codeResult = await coder.run(coderInput);
  messages.push({
    from: "coder",
    to: "reviewer",
    content: codeResult.content,
    timestamp: Date.now(),
  });
  totalTokens += codeResult.tokensUsed;
  totalToolCalls += codeResult.toolCalls;

  const reviewerInput = messages
    .filter((m) => m.to === "reviewer")
    .map((m) => `[From ${m.from}]: ${m.content}`)
    .join("\n");

  const reviewResult = await reviewer.run(reviewerInput);
  messages.push({
    from: "reviewer",
    to: "orchestrator",
    content: reviewResult.content,
    timestamp: Date.now(),
  });
  totalTokens += reviewResult.tokensUsed;
  totalToolCalls += reviewResult.toolCalls;

  return {
    content: messages.map((m) => `[${m.from} -> ${m.to}]: ${m.content}`).join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

Her agent yalnızca kendisine gönderilen mesajları alır. Bağlam kirliliği yok. Araştırmacının 50.000 tokens'lik belge okuması asla incelemecinin bağlamına girmez.

### 4. Adım: Karşılaştırın

```typescript
async function compare() {
  const task = "Build a rate limiter middleware for an Express.js API";

  console.log("=== Single Agent ===");
  const single = await singleAgentApproach(task);
  console.log(`Tokens: ${single.tokensUsed}`);
  console.log(`Tool calls: ${single.toolCalls}`);

  console.log("\n=== Multi-Agent ===");
  const multi = await multiAgentApproach(task);
  console.log(`Tokens: ${multi.tokensUsed}`);
  console.log(`Tool calls: ${multi.toolCalls}`);
}
```

Çoklu-agent sürümü daha fazla toplam token kullanır (üç agent, üç ayrı LLM çağrısı) ancak her agent'ın içeriği temiz kalır. prompt sistemi uzmanlaştığı için her aşamanın kalitesi artar.

## Use It — Hazır Araçla Uygula

Bu ders, ne zaman çoklu-agent'a gidileceğine karar vermek için yeniden kullanılabilir bir prompt üretir. Bkz. `outputs/prompt-multi-agent-decision.md`.

## Egzersizler

1. Dördüncü bir uzman ekleyin: Kodlayıcıdan kodu alan ve gözden geçirenin geri bildirimini inceleyen, ardından testleri yazan bir "test uzmanı" agent
2. İncelemecinin bir revizyon döngüsü için kodlayıcıya geri bildirim gönderebilmesi için ardışık düzeni değiştirin (maks. 2 tur)
3. Sıralı boru hattını bir yayılmaya dönüştürün: araştırmacıyı ve bir "gereksinim çözümleyicisini" agent paralel olarak çalıştırın, ardından kodlayıcıya geçmeden önce çıktılarını birleştirin

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| sürüsü | "Yapay zeka agent'lardan oluşan bir kovan zihni" | Paylaşılan duruma sahip ve sabit bir lideri olmayan bir eş agent kümesi. Davranış yerel etkileşimlerden ortaya çıkar. |
| Orkestratör | "Patron agent" | Araçları diğer agent'lari doğurmayı ve yönetmeyi içeren bir agent. Planlar ve yetki verir ancak asıl işi yapmayabilir. |
| Koordinatör | "Trafik polisi" | Kurallara göre mesajları agent'lar arasında yönlendiren, agent olmayan bir bileşen (çoğunlukla yalnızca kod, LLM değil). |
| Konsensüs | "agentlar katılıyor" | Devam etmeden önce birden fazla agent'ın anlaşmaya varması gereken bir protokol. Çakışan çıktıların çözümlenmesi gerektiğinde kullanılır. |
| Acil davranış | "agent'lar bunu kendileri çözdüler" | agent etkileşimlerinden ortaya çıkan ancak açıkça programlanmayan sistem düzeyindeki modeller. Yararlı veya zararlı olabilir. |
| Fan çıkışı / fan girişi | "agents için harita azaltımı" | Bir görevi paralel agent'lare bölmek (yayma çıkışı), ardından sonuçlarını birleştirmek (yayma girişi). |
| Mesaj geçiyor | "Agentbirbirleriyle konuşuyor" | agent'lar arasındaki iletişim mekanizması: paylaşılan context window'ların yerine bir agent'tan diğerine gönderilen yapısal veriler. |

## Daha Fazla Okuma

- [Gelişen Yapay Zeka Agent Mimarilerinin Görünümü](https://arxiv.org/abs/2409.02977) - çoklu-agent modellerinin incelenmesi
- [AutoGen: Yeni Nesil Yüksek Lisans Uygulamalarını Etkinleştirme](https://arxiv.org/abs/2308.08155) - Microsoft'un çoklu-agent görüşmesi framework
- [Claude Code altagentbelgeleri](https://docs.anthropic.com/en/docs/claude-code) - Claude Code Görev ile nasıl yetki verir
- [CrewAI belgeleri](https://docs.crewai.com/) - rol tabanlı çoklu-agent framework
