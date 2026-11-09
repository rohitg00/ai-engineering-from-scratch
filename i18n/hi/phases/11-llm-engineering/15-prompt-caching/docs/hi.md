# त्वरित कैशिंग और संदर्भ कैशिंग

> आपके सिस्टम प्रॉम्प्ट में 4,000 टोकन हैं। आपका RAG संदर्भ 20,000 टोकन है। आप प्रत्येक अनुरोध के साथ दोनों भेजते हैं। आप हर बार दोनों के लिए भी भुगतान करते हैं। प्रॉम्प्ट कैशिंग प्रदाता को उस प्रीफिक्स को अपने पक्ष पर गर्म रखने और आपको पुनः उपयोग पर सामान्य दर का 10% बिल करने की अनुमति देता है। सही तरीके से उपयोग किया जाता है, यह अनुमान लागत को 5090% और पहले टोकन विलंबता को 4085% तक कम करता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## समस्या

एक कोडिंग एजेंट एक ही 15,000 टोकन प्रणाली सूचित क्लाउड को एक बातचीत के हर मोड़ पर भेजता है।$3/M input tokens is $उपयोगकर्ता के किसी भी वास्तविक संदेश से पहले केवल 0.90 इनपुट लागत । 10,000 दैनिक वार्तालापों से गुणा करें और बिल $9,000 / दिन के लिए मिलता है जो कभी नहीं बदलता है।

आप गुणवत्ता को नुकसान पहुंचाए बिना प्रॉम्प्ट को छोटा नहीं कर सकते। आप इसे भेजने से बच नहीं सकते। मॉडल को हर मोड़ पर इसकी आवश्यकता होती है। एकमात्र कदम यह है कि प्रदाता पहले से ही देखे गए एक पूर्वावलोकन के लिए पूर्ण मूल्य का भुगतान करना बंद कर दें।

यह कदम त्वरित कैशिंग है। मानव ने इसे अगस्त 2024 में (2025 में 1 घंटे के विस्तारित-टीटीएल संस्करण के साथ) लॉन्च किया, ओपनएआई ने उसी वर्ष के अंत में इसे स्वचालित किया, गूगल ने जेमिनी 1.5 के साथ स्पष्ट संदर्भ कैशिंग लॉन्च की, और अब तीनों इसे अपने फ्रंटियर मॉडल पर प्रथम श्रेणी की सुविधा के रूप में पेश करते हैं।

## अवधारणा

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**जब किसी अनुरोध का पूर्वावलोकन हाल के अनुरोध से मेल खाता है, तो प्रदाता टोकन को फिर से एन्कोडिंग के बजाय पिछले रन से KV-कैश की सेवा करता है। आप पहली बार एक छोटा लेखन प्रीमियम और हर बार एक बड़ी रीड डिस्काउंट का भुगतान करते हैं।

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**केवल तीनों कैश प्रीफिक्स। यदि किसी भी टोकन के बीच अनुरोधों में अंतर है, तो पहले भिन्न टोकन के बाद सब कुछ एक चूक है। शीर्ष पर * स्थिर * भागों, * चर * भागों को नीचे रखें।

### कैश अनुकूल लेआउट

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

आदेश का उल्लंघन करें  सिस्टम प्रॉम्प्ट के ऊपर उपयोगकर्ता संदेश रखें, कुछ शॉट्स के बीच गतिशील पुनर्प्राप्ति को छोड़ दें  और कैश कभी हिट नहीं करता है।

### ब्रेक-ईवेंस गणना

एंथ्रोपिक का 25% लेखन प्रीमियम (5 मिनट का टीटीएल) पहली बार पढ़ने पर खुद के लिए भुगतान करता है, क्योंकि एक कैश रीड की लागत 0.1x है। 1 लेखन + 1 पढ़ने का औसत प्रति अनुरोध 0.675x लागत (बचत 32%); 1 लेखन + 10 पढ़ने का औसत 0.205x (बचत 80%) है। 1 घंटे TTL लिखने के लिए 2x चार्ज, तो उस ब्लॉक को आगे आने के लिए दो पढ़ने की जरूरत है. अंगूठे का नियमः TTL के भीतर कम से कम 3 बार फिर से उपयोग करने की उम्मीद करने वाली किसी भी चीज़ को कैश करें; जो किसी भी TTL पर ब्रेक-ईव को साफ करता है।

```figure
prompt-cache-hit
```

## इसे बनाओ

### चरण 1: स्पष्ट मार्करों के साथ मानव संकेत कैशिंग

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

`cache_control`मार्कर एंथ्रोपिक को 5 मिनट के लिए ब्लॉक को स्टोर करने के लिए कहता है। उस विंडो के भीतर पुनः उपयोग हिट; समाप्त होने के बाद पुनः उपयोग और फिर से लिखता है।

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

यदि  में दोनों फ़ील्डों की जाँच करें`cache_read_input_tokens`अनुरोधों के बीच शून्य पर रहता है, अपने कैश कुंजी बहाव कर रहे हैं.

### चरण 2: एक घंटे का विस्तारित टीटीएल

लंबे समय तक चलने वाली बैच नौकरियों के लिए, 5 मिनट का डिफ़ॉल्ट कार्य कार्य के बीच समाप्त होता है।`ttl`:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 घंटे का टीटीएल लेखन प्रीमियम (50% की तुलना में 25%) का 2 गुना है, लेकिन 5 से अधिक बार उपसर्ग का पुनः उपयोग करने वाले किसी भी बैच पर तेजी से भुगतान करता है।

### चरण 3: ओपनएआई स्वचालित कैशिंग

OpenAI आपको कॉन्फ़िगर करने के लिए कुछ भी नहीं देता है. 1,024 टोकन से अधिक कोई भी पूर्वावलोकन जो हाल ही में अनुरोध से मेल खाता है स्वचालित रूप से 50% छूट प्राप्त करता है।

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

वही कैश-अनुकूल लेआउट नियम लागू होता है. दो चीजें OpenAI के कैश को मारती हैं जो Anthropic को नहीं मारती हैंः बदलना `user`क्षेत्र (कैश कुंजी घटक के रूप में उपयोग किया जाता है) और पुनर्गठन उपकरण।

### चरण 4: मिथुन स्पष्ट संदर्भ कैशिंग

मिथुन कैश को एक प्रथम श्रेणी के वस्तु के रूप में व्यवहार करता है जिसे आप बनाते हैं और नाम देते हैंः

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

मिथुन प्रति टोकन·घंटे के लिए भंडारण चार्ज करता है जब तक कैश रहता है, और सामान्य इनपुट दर के ~ 25% पर पढ़ता है। यह सही आकार है जब आप कई सत्रों में कई दिनों के दौरान एक ही विशाल प्रॉम्प्ट का पुनः उपयोग करते हैं।

### चरण 5: उत्पादन में हिट दर का माप

देखो`code/main.py`एक अनुकरण तीन प्रदाता लेखाकार के लिए जो लिखता है / पढ़ता है / याद करता है गणना और 1K अनुरोधों के प्रति मिश्रित लागत की गणना करता है। गेट एक लक्ष्य हिट दर पर तैनात करता है  अधिकांश उत्पादन मानव सेटअप को गर्म होने के बाद > 80% पढ़ने का अंश देखना चाहिए।

## 2026 में भी फंसे हुए जाल

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`सिस्टम प्रॉम्प्ट के शीर्ष पर. हर अनुरोध चूक जाता है. समय टिकट कैश ब्रेकपॉइंट से नीचे ले जाएं.
- **Tool reordering.**स्थिर क्रम में उपकरण को क्रमबद्ध करें  तैनाती के बीच एक निर्दिष्ट पुनर्व्यवस्थापन हर हिट को तोड़ता है।
- **Free-text near-duplicates.**"आप सहायक हैं" बनाम "आप सहायक हैं"  एक बाइट अंतर = पूर्ण चूक।
- **Too-small blocks.**एंथ्रोपिक 1,024 टोकन (2,048 हैकू के लिए) की मंजिल लागू करता है। छोटे ब्लॉक चुपचाप कैश नहीं करते हैं।
- **Blind cost dashboards.**"इनपुट टोकन" को कैश बनाम अनकैश में विभाजित करें अन्यथा ट्रैफ़िक में गिरावट कैश जीत की तरह दिखती है।

## इसका प्रयोग करें

2026 कैशिंग स्टैकः

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

उपयोगकर्ता-संदेश परत के लिए अर्थिक कैशिंग (चरण 11 · 11) के साथ संयोजनः शीघ्र कैशिंग हैंडल *टोकन-समान* पुनः उपयोग, अर्थिक कैशिंग हैंडल *मतलब-समान* पुनः उपयोग।

## इसे भेजें

सहेजें`outputs/skill-prompt-caching-planner.md`:

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## व्यायाम

1. **Easy.**एक 10 टर्न बातचीत के साथ एक 5,000 टोकन प्रणाली संकेत क्लाउड के खिलाफ.`cache_control`और फिर साथ. प्रत्येक के लिए इनपुट टोकन बिल रिपोर्ट.
2. **Medium.**एक परीक्षण हर्नस लिखें जो एक शीघ्र टेम्पलेट और एक अनुरोध लॉग को देखते हुए, प्रति प्रदाता (एंट्रोपिक 5m, एंट्रोपिक 1h, ओपनएआई स्वचालित, जुड़वां स्पष्ट) के अपेक्षित हिट दर और डॉलर की बचत की गणना करता है।
3. **Hard.**एक लेआउट अनुकूलक बनाएंः एक प्रॉम्प्ट और चिह्नित क्षेत्रों की सूची दी गई `stable=True/False`, एक वास्तविक मानव अंत बिंदु पर सत्यापित करें जानकारी खोने के बिना अधिकतम कैश-अनुकूल स्थिति पर एक एकल कैश ब्रेकपॉइंट रखने के लिए प्रम्प्ट को फिर से लिखें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## आगे पढ़ना

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`, 1 घंटे TTL, तोड़ समतल टेबल.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) स्वचालित उपसर्ग मिलान।
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`एपीआई और भंडारण मूल्य निर्धारण।
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) विलंबता संख्याओं के साथ मूल लॉन्च पोस्ट।
- चरण 11 · 05 (सामग्री इंजीनियरिंग)  जहां प्रॉम्प्ट को स्लाइड करने के लिए ताकि कैश लैंड कर सके।
- चरण 11 · 11 (कैशिंग और लागत)  उपयोगकर्ता संदेशों पर एक अर्थपूर्ण कैश के साथ कस्टिंग कस्टिंग जोड़ी।
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) KV-कैश मेमोरी मॉडल जो कैशिंग को उपयोगकर्ताओं के लिए उजागर करता है; यह बताता है कि कैश किए गए प्रीफिक्स को फिर से पढ़ने के लिए पुनः गणना करने की तुलना में ~ 10 गुना सस्ता क्यों है।
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill चरण शीघ्र कैशिंग शॉर्टकट है; यह पेपर बताता है कि TTFT कैश हिट पर नाटकीय रूप से गिरता है जबकि TPOT अप्रभावित है।
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) शीघ्र कैशिंग अनुमानित डिकोडिंग, फ्लैश ध्यान, और MQA/GQA के साथ बैठता है जो अनुमान लागत वक्र को मोड़ते हैं; अन्य तीनों के लिए इसे पढ़ें।
