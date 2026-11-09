# Chatbots  Kurallara dayalı Neural ile LLM ajanları

> ELIZA, örneğe eşleşen bir cevap verdi. DialogFlow niyetleri haritası yaptı. GPT ağırlıklardan cevap verdi. Claude araçları çalıştı ve doğruladı. Her dönem önceki en kötü başarısızlığı çözdü.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## Sorun

Bir kullanıcı "Uçuşumu değiştirmek istiyorum" diyor. Sistem ne istediğini, hangi bilgileri eksik olduğunu, nasıl alacağını ve eylemini nasıl tamamlayacağını bulmalıdır.

Bir ML sistemi için konuşma zor. Giriş açık. Çıkış birçok dönüşte tutarlı olmalıdır. Sistemin dünyayı etkilemesi gerekebilir (uçuş değiştir, kart yükleme). Her yanlış adım kullanıcıya görünür.

Chatbot mimarlıkları dört paradigma ile döngüye girdi, her biri önceki birinin çok görünür bir şekilde başarısız olduğu için kuruldu. Bu ders onları sıraya getiriyor. 2026 üretim manzarası son ikiliğin bir hibrididir.

## Anlaşım

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### Yazılı yarım yüzyıl, 1950-2001

İlk paradigma beş yıl sürmedi. elli yıl sürdü. Onun arkını bilmek önemlidir çünkü içindeki her sistem aynı makine  eşleşen girişi, konserve bir yanıt yayıyor, küçük bir durum  güncelleştirir ve bu makineye kural eklemenin elli yılı genel durumun hiçbir zaman üretilmedi. Bu tavan paradigmaların iki ile dört arasında var olmasının nedeni budur.

**1950.**Turing, "makine düşünüyor mu?" sorusunu ameliyatçı bir değiştirme önerisiyle atlatıyor: Eğer bir sorgulayıcı, bir kişiyi makineden bir telefontep üzerinden ayırt edemezse, felsefi soru tartışmalıdır.

**1956.**İsim Dartmouth'da yazda yapılan bir atölyede "Yapay zeka" paraları üzerine gelir. Bu isim, "bilginliğin her özelliğinin, prensip olarak, onu simüle edecek bir makine yapabileceği kadar kesin olarak tanımlanabileceği" tahmininde yer alır.

**1966.**ELIZA, 1. Adımda oluşturduğunuz yansıma hilesini gönderir: Çürümesi kuralları girişten parçalar çeker, yeniden monte etme kuralları onları soru olarak geri yankılar. 200'e yakın kalıp toplam, sıfır durum, sıfır anlayış  ve kullanıcılar buna her şekilde güvendi. Weizenbaum kariyerinin geri kalanını ne kadar az makine aldığından endişelenerek geçirdi.

**1972.**PARRY, Stanford'da paranoya modelini oluşturmuş, ELIZA'nın eksik olduğu bir parça ekliyor: İç durum. Korku, öfke ve güvensizlik için sayısal değişkenler, senaryolar sonraki açılışta her dönüşte ve kapıda güncellenir. Böylece aynı girişler şimdiye kadarki konuşmaya bağlı olarak farklı tepkiler üretir. Kör bir transkript testiyle psikiyatristler PARRY'yi insan hastalarından rastgele ayırt ettiler. Kişiliği koşullandırmanın doğrudan atalarıdır  üç yüzen olarak uygulanan bir sistem uyarısı. Aynı yıl, iki bot ARPANET üzerinden birbirine işaret edildi: bir terapist senaryosu paranoya durum makinesi ile röportaj yaparken, bir ağdaki ilk bot-bot konuşması.

**1995.**ALICE, AIML ile ELIZA tarifini ölçeklendirir. Bu, örnektir-şablon çiftleri için XML diyalektidir. Yaklaşık 40.000 el yazılı kategoriler, üç Loebner Ödülü kazandı. Kurallara dayalı sistemlerin ölçeklendirme yasasını kanıtladı: daha fazla kural kapsamayı satın alır, asla genellik. Her kural birisinin koruması gereken bir yüktür.

**2001.**SmarterChild, 30 milyon anlık mesajlaşma kullanıcısının önüne girer ve arka plan bakışlarını  hava, stoklar, film zamanları  şablonlara ekler.

Paradigma, kimsenin onu reddetmesinden değil, el yazılı devlet makinelerinin bakım maliyetinin kapsamıyla doğrusal olarak büyüdüğünden ve kullanıcı beklentilerinin geçen hafta gördükleri ile büyüdüğünden sona erdi.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**El yazılı desenler kullanıcı girişleriyle eşleşir ve cevaplar üretir. İstek sınıflandırıcıları önceden tanımlanmış akışlara yönlendiriyor. Slot doldurma durum makineleri gerekli bilgileri toplar. tasarlanmış olan dar alan içinde parlak çalışır. Hemen dışarda başarısız olur. Hala halüsinasyonların hoşgörülmediği güvenlik kritik alanlarda (banking doğrulama, hava yolu rezervasyonu) gemi.

**Retrieval-based.**Bu, bir sıklık sorusu tarzı sistemidir. Her çiftini kodlayın (söz, cevap). Çalışma zamanında, kullanıcının mesajını kodlayın ve en yakın depolanan yanıtı alın. Zendesk'in klasik "böylece makaleler" özelliğini düşünün. Kurallardan daha iyi parafrase kullanır.

**Neural (seq2seq).**Çözümlü bir kodlama-dekoder, sohbet günlüğünde eğitimlidir. Baştan cevaplar üretir. Akıcı ancak genel çıkışlara eğilimli ("Bilmiyorum") ve gerçek sürükleme. Konuyla ilgili asla güvenilir değildir. Google, Facebook ve Microsoft'un 2016-2019 yıllarında hayal kırıklığına uğrayan chatbotları olması nedeni.

**LLM agents.**Bir dil modeli, sonuçları planlayan, araçları çağıran ve doğrulayan bir döngü içinde sarılmış bir dil modeli. Uzun bir istekle bir chatbot değil. Bir ajan döngüsü: plan → arama aracı → gözlem sonucu → bir sonraki adımı karar vermek. Arama-birinci yerleştirme (RAG) onu halüsinasyonlardan korur. Araç çağrıları aslında işleri yapmasına izin verir. Bu 2026 mimarisi.

Dört paradigma sıradan bir değiştirme değildir. 2026 üretim chatbotı dört yönüyle geçiyor: doğrulama ve yıkıcı eylemler için kural tabanlı, FAQ için geri alınma, doğal ifade için sinir jenerasyonu, belirsiz açık sorular için LLM ajanı.

## Yapın

### Adım 1: Kurallara dayalı örneğe eşleşme

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

ELIZA 20 satırda. "Üzülüyorum" ("Ben üzgün hissediyorum" → "Neden üzgün hissediyorsun") refleks hilesi 1966'da Weizenbaum'dan gelen kanonik psikoterapist demo'dur.

### Adım 2: Arama tabanlı (FAQ)

Bu örnek kısım için `pip install sentence-transformers`(Kahkahalar)`code/main.py`Bu dersin yerine bir stdlib Jaccard benzerliği kullanıldığı için dersi dış bağımlılıklardan uzak duruyor.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

Sınır tabanlı reddetme, en iyi eşleşmenin yeterince yakın olmadığı durumlarda, geri dön `None`ve sistemin tırmanmasına izin ver.

### Adım 3: Nöral jenerasyon (Başlam)

Küçük bir talimat ayarlı kodlayıcı-dekoder (FLAN-T5) veya ince ayarlı bir konuşma modeli kullanın. 2026'da kendi başına kullanılamaz (tüşünç, konu dışı sürükleme, gerçek saçmalık), ama doğal ifade için hibrit sistemler içinde gemiler. DialoGPT tarzı sadece dekodörlü modeller, tutarlı cevaplar üretmek için açık bir dönüş ayırıcıları ve EOS yönetimine ihtiyaç duyar; bir öğretim örneği için FLAN-T5 metin2 metin boru hattı kutudan dışarıda çalışır.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 4. Adım: LLM ajan döngüsü

2026 üretim şekli:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

Bu nedenle, bu işlemler, bir süre önce bir süre önce yapılan işlemlere ilişkin olarak, bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha

Gerçek üretim ekler: ilk olarak yerleştirme (her LLM çağrısı öncesi ilgili belgeler enjekte), koruma (tatsil olmadan yıkıcı eylemleri reddet), gözlemlenebilirlik (her adımı kaydetmek) ve değerlendirme (özel kontroller ajan davranışının spesifik durumda kalmasını sağlar).

### Adım 5: hibrit yönlendirme

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

Şekil: yıkıcı bir şey için belirleyici kurallar, konserveli Soru sorular için arama, diğer her şey için LLM ajanları. 2026 müşteri desteği sistemleri bu.

## Kullan

2026'da:

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

Her zaman üretimde hibrit yönlendirme kullanın. Tek bir mimarlık her talebi iyi yönetmez. Routing katmanı kendisi tipik olarak küçük bir niyet sınıflandırıcısıdır.

## Hâlâ gemiye giden başarısızlık modları

- **Confident fabrication.**Yumuşak başlılık: sonuçları doğrula, araç çağrılarını kaydet, LLM'nin başarılı bir araç dönüşü olmadan bir şey yaptığını iddia etmesine asla izin verme.
- **Prompt injection.**Kullanıcı, sistem istasyonunu geçersiz kılan metni ekler. LLM01 OWASP LLM Başvuruları 2025 için Top 10'da sıralamaktadır. İki tad: doğrudan enjeksiyon (çat'a yapıştırılmış) ve dolaylı enjeksiyon (evlatör okuyan belgelerde, e-postalarda veya araç çıkışlarında gizli).

  Scenariye göre saldırı oranları değişir. Ölçülen başarı oranları, genel araç kullanım ve kodlama referans değerlerinde sınır modellerinde %0,5-8,5 arasında değişmektedir. Özel yüksek riskli ayarlamalar (Sİ kodlama ajanlarına yönelik uyarlama saldırıları, savunmasız orkestrasyon) %84'e ulaştı. Üretim CVE'leri arasında EchoLeak (CVE-2025-32711, CVSS 9.3)  bir saldırgan tarafından kontrol edilen e-posta tarafından tetiklenen Microsoft 365 Copilot'ta sıfır tıklama ile veri sızdırma hatası bulunmaktadır.

  Yumuşaklıklar: Kullanıcı girişini döngü boyunca güvenilmez olarak ele alın; araç çağrılarından önce temizlenir; ana uyarıdan araç çıkışlarını izole eder; ajanın önce planladığı Plan-Tahmini-Etkinleştir (PVE) örneğini kullanır, ardından uygulamadan önce bu plana karşı her eylemini doğrulayır (bu, araç sonuçlarını yeni planlanmamış eylemler enjekte etmeden durdurur); yıkıcı eylemler için kullanıcı onayını gerektirir; araç alanlarına en az ayrıcalık uygulayın.

  Bu riskin tamamen ortadan kaldırılmasına hiçbir zaman gerek yoktur.
- **Scope creep.**Ajan, bir araç çağrısı ile ilgili bilgiyi geri döndüğünde görevden ayrılır.
- **Infinite loops.**Ajan aynı araçları arıyor, kısıtlama: adım bütçesi, araç çağrıları kopyalanması, LLM yargıçı "yöntemleri mi yapıyoruz?"
- **Context window exhaustion.**Uzun konuşmalar en erken dönüşleri bağlamdan dışarı çıkarır. Yumuşatma: eski dönüşleri özetlemek, benzerliklerle ilgili geçmiş dönüşleri almak veya uzun bağlamlı bir model kullanmak.

## Gönder

- Kaydet .`outputs/skill-chatbot-architect.md`- ...

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## Egzersizler

1. **Easy.**Bir kahve mağazası sipariş bot için yukarıdaki kural tabanlı cevap uygulamasını 10 model ile uygulayın. Test kenar vakaları: çift sipariş, değişiklikler, iptal, net olmayan niyet.
2. **Medium.**Bir hibrid FAQ + LLM fallback oluşturun. SaaS ürünü için 50 konserve FAQ giriş, doküman sitesi üzerinden geri alınma ile LLM fallback. 100 gerçek destek sorusu üzerinde reddetme oranını ve doğruluğunu ölçün.
3. **Hard.**Yukarıdaki ajan döngüsünü üç araçla uygulayın (arşiv, okuyucu verileri, e-posta gönder).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## Daha Fazla Okumak

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) Konuşmayı alanın referans noktası yapan makale.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) orijinal kural tabanlı chatbot kağıdı.
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  PARRY'nin etkisi değişken mimarisi, ilk devletli chatbot.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239)Google'ın geç neural chatbot makalesi, LLM ajanları devralmadan hemen önce.
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) ajan döngüsü örneğini belirleyen kağıt.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents)2024 üretim öngörü, 2026'da hala geçerli.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) hızlı enjeksiyon kağıdı.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) hızlı enjeksiyonu en büyük güvenlik endişesi yapan sıralama.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) Plan-Verify-Execute ve kullanıcı-tasdiklama akışları dahil olmak üzere pratik orkestrasyon katman savunmaları.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) indirek hızlı enjeksiyondan gelen sıfır tıklama ile veri eksfiltrasyonu CVE. Yazma erişim ajanlarının neden çalıştırma zamanının korunmasına ihtiyaç duyduğu için referans vaka.
