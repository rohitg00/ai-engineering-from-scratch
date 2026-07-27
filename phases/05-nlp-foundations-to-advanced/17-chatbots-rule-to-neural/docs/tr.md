# Chatbot'lar — Kural Tabanlıdan Nöral'e ve Yüksek Lisans'a Agent'lar

> ELIZA kalıp eşleşmeleriyle yanıt verdi. DialogFlow eşlenen amaçlar. GPT ağırlıklardan yanıt verdi. Claude araçları çalıştırır ve doğrular. Her çağ bir öncekinin en büyük başarısızlığını çözdü.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 5 · 13 (Soru Yanıtlama), Aşama 5 · 14 (Bilgi Erişimi)
**Süre:** ~75 dakika

## Sorun

Bir kullanıcı "Uçuşumu değiştirmek istiyorum" diyor. Sistemin ne istediğini, hangi bilgilerin eksik olduğunu, bu bilgilere nasıl ulaşılacağını ve işlemin nasıl tamamlanacağını bulması gerekir. Daha sonra kullanıcı "bekle, ya onun yerine iptal edersem?" der. ve sistemin bağlamı hatırlaması, görevleri değiştirmesi ve durumu koruması gerekir.

Bir ML sistemi için konuşma zordur. Giriş açık uçludur. Çıktının birçok dönüşte tutarlı olması gerekir. Sistemin dünyaya göre hareket etmesi gerekebilir (bir uçuşu değiştirin, bir karttan ücret alın). Her yanlış adım kullanıcı tarafından görülebilir.

Chatbot mimarileri, her biri bir öncekinin gözle görülür şekilde başarısız olması nedeniyle tanıtılan dört paradigma arasında geçiş yaptı. Bu ders bunları sırayla açıklamaktadır. 2026 üretim manzarası son ikisinin bir melezidir.

## Konsept

![Chatbot evrimi: kural tabanlı → erişim → sinirsel → agent](../assets/chatbot.svg)

### Senaryolu yarım yüzyıl, 1950-2001

İlk paradigma beş yıl sürmedi. Elli sürdü. Yayını bilmek önemlidir çünkü içindeki her sistem aynı makinedir - girdiyi eşleştirin, hazır bir yanıt yayınlayın, küçük bir durumu güncelleyin - ve bu makineye elli yıl boyunca kural eklemek hiçbir zaman genel durumu ortaya çıkarmadı. Bu tavan, ikiden dörde kadar olan paradigmaların var olmasının nedenidir.

**1950.** Turing yan adımlar "makineler düşünebilir mi?" operasyonel bir değişiklik önererek: Eğer bir sorgulayıcı makineyi teletip üzerinden bir kişiden ayırt edemiyorsa, felsefi soru tartışmalıdır. Alan bir isme sahip olmadan önce konuşma alanın benchmark olur.

**1956.** İsim geliyor - Dartmouth'ta bir yaz atölyesi, zekanın her özelliğinin "prensipte o kadar kesin bir şekilde tanımlanabileceği ve onu simüle edecek bir makinenin yapılabileceği" varsayımına dayanarak "yapay zeka"yı kullanıyor. Teklifte önemli ilerleme kaydedilmesi için iki aylık bir bütçe öngörülüyor.

**1966.** ELIZA, 1. Adımda oluşturduğunuz yansıma hilesini sunar: ayrıştırma kuralları girdiden parçalar çeker, yeniden birleştirme kuralları bunları soru olarak geri yansıtır. Toplamda yaklaşık 200 model, sıfır durum, sıfır anlayış ve kullanıcılar yine de buna güveniyor. Weizenbaum kariyerinin geri kalanını, ne kadar az makine gerektirdiğinden endişe duyarak geçirdi.

**1972.** Stanford'da paranoyayı modellemek için geliştirilen PARRY, ELIZA'da eksik olan parçayı ekliyor: içsel durum. Korku, öfke ve güvensizliğe ilişkin sayısal değişkenler her fırsatta ve sonraki senaryonun tetiklendiği kapıda güncellenir, böylece aynı girdiler o ana kadar yapılan konuşmaya bağlı olarak farklı yanıtlar üretir. Kör bir transkript testinde psikiyatristler PARRY'yi insan hastalardan tesadüfen ayırdı. Bu, üç değişkenli olarak uygulanan prompt bir sistem olan kişisel koşullandırmanın doğrudan atasıdır. Aynı yıl, iki bot ARPANET üzerinden birbirlerine yönlendirildi: bir paranoya durumu makinesiyle röportaj yapan bir terapist senaryosu, bir ağdaki ilk bottan bota konuşma.

**1995.** ALICE, ELIZA tarifini, model-şablon çiftleri için bir XML lehçesi olan AIML ile ölçeklendirir. Yaklaşık 40.000 elle yazılmış kategori, üç Loebner Ödülü kazandı. Kurala dayalı sistemlerin ölçeklendirme yasasını kanıtladı: Daha fazla kural kapsam satın alır, genelleme asla. Her kural, birisinin sürdürmesi gereken bir sorumluluktur.

**2001.** SmarterChild, tarifi 30 milyon anlık mesajlaşma kullanıcısının önüne koyuyor ve şablonlara eklenmiş arka uç aramaları (hava durumu, hisse senetleri, film saatleri) ekliyor. Şaşı ve 2001 kostümü giyen tool calling: niyeti ayrıştır, bir hizmeti çağır, sonucu cevaba dönüştür.

Elli yıl, tek mekanizma, artan kural sayımı. Bu paradigma, kimsenin onu çürütmesi nedeniyle değil, elle yazılmış durum makinelerinin bakım maliyetinin kapsama alanıyla birlikte doğrusal olarak artması ve kullanıcı beklentilerinin geçen hafta gördükleriyle birlikte artması nedeniyle sona erdi.

```figure
chatbot-lineage
```

**Kural tabanlı (ELIZA, AIML, DialogFlow).** Elle yazılan modeller, kullanıcı girdileriyle eşleşir ve yanıtlar üretir. Amaç sınıflandırıcıları önceden tanımlanmış akışlara yönlendirir. Slot doldurma durumu makineleri gerekli bilgileri toplar. Tasarlandığı dar kapsamda mükemmel şekilde çalışır. Hemen dışında başarısız olur. Hala halüsinasyonun tolere edilmediği güvenlik açısından kritik alanlarda (banka kimlik doğrulaması, havayolu rezervasyonu) gönderilmektedir.

**Geri alma tabanlı.** SSS tarzı bir sistem. Her çifti (söz, yanıt) kodlayın. Çalışma zamanında kullanıcının mesajını kodlayın ve en yakın depolanan yanıtı alın. Zendesk'in klasik "benzer makaleler" özelliğini düşünün. Açıklamaları kurallardan daha iyi ele alır. Nesil yok, dolayısıyla halüsinasyon da yok.

**Sinirsel (seq2seq).** Konuşma günlükleri üzerinde eğitilmiş kodlayıcı-kod çözücü. Sıfırdan yanıtlar üretir. Akıcı ama genel çıktılara ("Bilmiyorum") ve gerçeklere dayalı sapmalara eğilimli. Konuyla ilgili asla güvenilir bir şekilde. Google, Facebook ve Microsoft'un 2016-2019'da hayal kırıklığı yaratan sohbet robotlarına sahip olmasının nedeni.

**LLM agents.** Planlayan, araçları çağıran ve sonuçları doğrulayan bir döngüye sarılmış bir dil modeli. Uzun bir prompt'ye sahip bir chatbot değil. Bir agent loop: plan → aracı çağır → sonucu gözlemle → bir sonraki adıma karar ver. Alma öncelikli topraklama (RAG), halüsinasyon görmesini engeller. Araç çağrıları, bazı şeyleri gerçekten yapmasına olanak tanır. Bu 2026 mimarisi.

Dört paradigma ardışık ikameler değildir. Bir 2026 üretim sohbet robotu, dördünü de yönlendirir: kimlik doğrulama ve yıkıcı eylemler için kural tabanlı, SSS için erişim, doğal ifadeler için sinir oluşturma, belirsiz açık uçlu sorgular için LLM agent.

## İnşa Et

### Adım 1: kurala dayalı kalıp eşleştirme

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

20 satırda ELIZA. Düşünme hilesi ("Üzgün ​​hissediyorum" → "Neden üzgün hissediyorsun") Weizenbaum'un 1966 tarihli kanonik psikoterapist demosudur. Hala öğreticidir.

### Adım 2: erişime dayalı (SSS)

Bu açıklayıcı kod parçası `pip install sentence-transformers` gerektirir (meşaleyi çeker). Bu ders için çalıştırılabilir `code/main.py` bunun yerine stdlib Jaccard benzerliğini kullanır, böylece ders harici bağımlılıklar olmadan çalışır.

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

Eşiğe dayalı ret, anahtar tasarım tercihidir. En iyi eşleşme yeterince yakın değilse `None` değerini döndürün ve sistemin yükselmesine izin verin.

### Adım 3: sinir üretimi (temel)

Talimatlarla ayarlı küçük bir kodlayıcı-kod çözücü (FLAN-T5) veya ince ayarlı bir konuşma modeli kullanın. Üretim 2026'da tek başına kullanılamaz (çelişki, konu dışı sürüklenme, gerçeklere dayalı saçmalık), ancak doğal ifadeler için hibrit sistemler içinde gönderilir. DialoGPT tarzı yalnızca kod çözücü modelleri, tutarlı yanıtlar üretmek için açık dönüş ayırıcılara ve EOS işlemeye ihtiyaç duyar; FLAN-T5 text2text boru hattı, bir öğretim örneği için kutunun dışında çalışır.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Adım 4: Yüksek Lisans agent loop

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

Adlandırılacak üç şey. Araçlar, LLM'nin çağırabileceği çağrılabilir işlevlerdir. Döngü, Yüksek Lisans bir araç çağrısı yerine nihai bir yanıt verdiğinde sona erer. Adım bütçesi, belirsiz görevlerde sonsuz döngüleri önler.

Gerçek üretim şunu ekler: alma öncelikli temellendirme (ilgili belgeleri her LLM çağrısından önce enjekte edin), korkuluklar (onay olmadan yıkıcı eylemleri reddedin), observability (her adımı kaydedin) ve değerlendirmeler (agent davranışının spesifikasyona uygun kaldığını otomatik olarak kontrol edin).

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

Model: yıkıcı olan her şey için deterministik kurallar, hazır SSS'ler için erişim, diğer her şey için LLM agent'ler. 2026 müşteri destek sistemlerinde sunulan şey budur.

## Kullan onu

2026 yığını:

| Kullanım örneği | Mimarlık |
|---------|---------------|
| Rezervasyon, ödeme, kimlik doğrulama | Kural tabanlı durum makineleri + slot doldurma |
| Müşteri desteği SSS | Seçilmiş yanıtlara erişim |
| Açık uçlu yardım sohbeti | Yüksek Lisans agent ile RAG + araç çağrıları |
| Dahili araçlar / IDE yardımcıları | LLM agent araç çağrılarıyla (arama, okuma, yazma) |
| Yardımcı / karakter sohbet robotları | Kişisel sistem prompt ile ayarlanmış LLM, bilgiye erişim |

Üretimde her zaman hibrit yönlendirmeyi kullanın. Tek bir mimari her isteği iyi şekilde karşılayamaz. Yönlendirme katmanının kendisi genellikle küçük bir amaç sınıflandırıcıdır.

## Hala gönderilmekte olan arıza modları

- **Kendinden emin uydurma.** LLM agent, yapmadığı bir eylemi tamamladığını iddia ediyor. Azaltma: sonuçları doğrulayın, araç çağrılarını günlüğe kaydedin, LLM'nin başarılı bir araç iadesi olmadan bir şey yaptığını iddia etmesine asla izin vermeyin.
- **Prompt yerleştirme.** Kullanıcı, prompt sistemini geçersiz kılan metni ekler. LLM Uygulamaları 2025 için OWASP İlk 10'da LLM01 olarak derecelendirildi. İki çeşit: doğrudan enjeksiyon (sohbete yapıştırılır) ve dolaylı enjeksiyon (belgelerde, e-postalarda veya agent'nin okuduğu araç çıktılarında gizli).

Saldırı oranları senaryoya göre değişir. Ölçülen başarı oranları, genel araç kullanımı ve kodlama benchmark'larda sınır modellerinde ~%0,5-8,5 aralığındadır. Belirli yüksek riskli kurulumlar (AI kodlama agent'lara karşı uyarlanabilir saldırılar, savunmasız orkestrasyon) ~%84'e ulaştı. Üretim CVE'leri arasında Microsoft 365 Copilot'ta saldırgan tarafından kontrol edilen bir e-posta tarafından tetiklenen sıfır tıklamayla veri filtreleme kusuru olan EchoLeak (CVE-2025-32711, CVSS 9.3) bulunmaktadır.

Azaltıcı önlemler: kullanıcı girişini döngü boyunca güvenilmez olarak ele alın; alet çağrılmadan önce sterilize edin; takım çıktılarını ana prompt'dan izole edin; agent'nin önce plan yaptığı, ardından yürütmeden önce her eylemi bu plana göre doğruladığı Planla-Doğrula-Yürüt (PVE) modelini kullanın (bu, aracın yeni planlanmamış eylemlerin enjekte edilmesinden kaynaklanan sonuçları durdurur); yıkıcı eylemler için kullanıcı onayı gerektirmek; Araç kapsamlarına en az ayrıcalık uygulayın.

Hiçbir prompt mühendisliği bu riski tamamen ortadan kaldırmaz. Harici çalışma zamanı savunma katmanları (LLM Koruması, izin verilenler listesi doğrulama, anlamsal anormallik tespiti) gereklidir.
- **Kapsam kayması.** Agent, bir araç çağrısı teğetsel olarak ilgili bilgileri döndürdüğü için görev dışı kalıyor. Azaltma: dar araç sözleşmeleri; sistemi prompt odaklı tut; görev dışı oran için değerlendirmeler ekleyin.
- **Sonsuz döngüler.** Agent aynı aracı çağırmaya devam ediyor. Azaltma: adım bütçesi, araç çağrısı tekilleştirme, "ilerleme kaydediyor muyuz?" konusunda Yüksek Lisans değerlendirmesi.
- **Context window bitkinlik.** Uzun konuşmalar, ilk dönüşleri bağlamdan uzaklaştırır. Azaltma: eski dönüşleri özetleyin, benzerliğe göre ilgili geçmiş dönüşleri alın veya uzun bağlamlı bir model kullanın.

## Gönderin

`outputs/skill-chatbot-architect.md` olarak kaydet:

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

1. **Kolay.** Yukarıdaki kurala dayalı yanıtı, bir kahve dükkanı sipariş botu için 10 modelle uygulayın. Test uç durumları: çifte siparişler, değişiklikler, iptal, belirsiz niyet.
2. **Medium.** Karma bir SSS + LLM yedeklemesi oluşturun. Bir SaaS ürünü için 50 hazır SSS girişi, dokümanlar sitesi üzerinden erişim ile Yüksek Lisans geri dönüşü. 100 gerçek destek sorusunun reddedilme oranını ve doğruluğunu ölçün.
3. **Zor.** Yukarıdaki agent loop'yi üç araçla uygulayın (arama, kullanıcı verilerini okuma, e-posta gönderme). prompt enjeksiyon denemesini içeren 50 test senaryosuyla bir değerlendirme yapın. Görev dışı oranı, başarısız görev oranını ve tüm enjeksiyon başarısını raporlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Niyet | Kullanıcı ne istiyor | Kategorik etiket (book_flight, reset_password). Bir işleyiciye yönlendirildi. |
| Yuvası | Bir bilgi | Botun ihtiyaç duyduğu parametre (tarih, hedef). Slot doldurma, soru sırasıdır. |
| RAG | Alma artı nesil | İlgili belgeleri alın ve ardından Yüksek Lisans'ın yanıtını temelleyin. |
| Araç çağrısı | İşlev çağırma | LLM, ad + bağımsız değişkenler içeren yapılandırılmış bir çağrı yayınlar. Çalışma zamanı yürütülür ve sonucu döndürür. |
| Agent loop | Planlayın, harekete geçin, doğrulayın | LLM çağrılarını çalıştıran denetleyici, görev tamamlanana kadar araç çağrılarıyla birleştirilir. |
| Prompt enjeksiyon | Kullanıcı saldırıları prompt | prompt sistemini geçersiz kılmaya çalışan kötü amaçlı giriş. |

## Daha Fazla Okuma

-[Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) — konuşmayı alanın benchmark haline getiren makale.
-[Weizenbaum (1966). ELIZA — Doğal Dil İletişimi Çalışmalarına Yönelik Bir Bilgisayar Programı](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) — orijinal kural tabanlı chatbot makalesi.
- [Colby, Weber, Hilf (1971). Yapay Paranoya](https://doi.org/10.1016/0004-3702(71)90002-6) — PARRY'nin etki-değişken mimarisi, ilk durum bilgisi olan sohbet robotu.
- [Thoppilan ve ark. (2022). LaMDA: Diyalog Uygulamaları için Dil Modelleri](https://arxiv.org/abs/2201.08239) — Google'ın LLM agent'lerin devralınmasından hemen önceki son sinirsel sohbet robotu makalesi.
- [Yao ve ark. (2022). ReAct: Dil Modellerinde Akıl Yürütme ve Harekete Geçme](https://arxiv.org/abs/2210.03629) — agent loop modelini adlandıran makale.
- [Etkili agent'ler oluşturmaya ilişkin Antropik kılavuz](https://www.anthropic.com/research/building-effective-agents) — 2026'da hala geçerli olan 2024 üretim kılavuzu.
- [Greshake ve ark. (2023). Kaydolduğunuz şey bu değil: Dolaylı Prompt Enjeksiyon](https://arxiv.org/abs/2302.12173) ile Gerçek Dünya Yüksek Lisans-Entegre Uygulamalarından Ödün Vermek — prompt-enjeksiyon makalesi.
- [LLM Uygulamaları 2025 için OWASP İlk 10 — LLM01 Prompt Enjeksiyonu](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — prompt enjeksiyonunu en büyük güvenlik endişesi haline getiren sıralama.
- [AWS — Amazon Bedrock Agent'leri Dolaylı Prompt Enjeksiyonlara](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) karşı koruma — Planla-Doğrula-Yürüt ve kullanıcı onayı akışları dahil olmak üzere pratik düzenleme katmanı savunmaları.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) — dolaylı prompt enjeksiyonundan kanonik sıfır tıklamalı veri filtreleme CVE'si. Yazma erişimli agent'lerin neden çalışma zamanı savunmalarına ihtiyaç duyduğuna dair referans örnek olay.
