# दीर्घ संदर्भ मूल्यांकन  NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro संदर्भ के 10M टोकन का विज्ञापन करता है। 1M टोकन पर, 8-नाल MRCR 26.3% तक गिर जाता है। विज्ञापन ≠ उपयोग करने योग्य। लंबे संदर्भ मूल्यांकन आपको बताता है कि आप जिस मॉडल पर शिपिंग कर रहे हैं उसकी वास्तविक क्षमता क्या है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## समस्या

आपके पास 200 पृष्ठों का अनुबंध है। मॉडल 1M टोकन संदर्भ का दावा करता है। आप अनुबंध को पेस्ट करते हैं और पूछते हैंः "समाप्ति खंड क्या है?" मॉडल जवाब देता है  लेकिन कवर पेज से जवाब देता है क्योंकि समापन खंड 120k टोकन की गहराई पर बैठता है, जहां मॉडल वास्तव में भाग लेता है।

यह 2026 संदर्भ क्षमता अंतर है। स्पेसिफिकेशन शीट में 1M या 10M कहते हैं। वास्तविकता कहती है कि 60-70% उपयोग योग्य है, और "उपयोग योग्य" कार्य पर निर्भर करता है।

- **Retrieval (single needle in haystack):**सीमा मॉडल पर विज्ञापनित अधिकतम तक लगभग सही।
- **Multi-hop / aggregation:**अधिकांश मॉडल पर ~ 128k से अधिक तेजी से गिरावट आती है।
- **Reasoning over dispersed facts:**असफल होने वाला पहला कार्य।

दीर्घ संदर्भ मूल्यांकन इन अक्षों को मापता है। इस पाठ में बेंचमार्क का नाम दिया गया है, प्रत्येक वास्तव में क्या मापता है, और कैसे अपने डोमेन के लिए एक कस्टम सुई परीक्षण का निर्माण करें।

## अवधारणा

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**एक तथ्य ("जादू शब्द अनानास है") को एक लंबी संदर्भ में नियंत्रित गहराई पर रखें। मॉडल से इसे प्राप्त करने के लिए कहें। गहराई × लंबाई को झाड़ें। मूल लंबे संदर्भ बेंचमार्क। सीमा मॉडल अब इसे संतृप्त करते हैं; यह एक आवश्यक है लेकिन पर्याप्त आधार रेखा नहीं है।

**RULER (Nvidia, 2024).**4 श्रेणियों में 13 कार्य प्रकारः पुनर्प्राप्ति (एकल / बहु-कुंजी / बहु-मूल्य), मल्टी-हॉप ट्रैकिंग (भेरिएबल ट्रैकिंग), एग्रीगेशन (सामान्य शब्द आवृत्ति), क्यूए। कॉन्फ़िगरेबल संदर्भ लंबाई (4k से 128k+) । यह उन मॉडल का खुलासा करता है जो NIAH को संतृप्त करते हैं लेकिन मल्टी-हॉप पर विफल रहते हैं। 2024 रिलीज में, 32k+ संदर्भ का दावा करने वाले 17 मॉडल में से केवल आधे ने 32k+ गुणवत्ता बनाए रखी।

**LongBench v2 (2024).**503 बहुविकल्पीय प्रश्न, 8k-2M शब्द संदर्भ, छह कार्य श्रेणियांः एकल-डॉक्स क्यूए, मल्टी-डॉक्स क्यूए, लंबे समय तक संदर्भ में सीखने, लंबे संवाद, कोड रेपो, लंबे समय तक संरचित डेटा। वास्तविक दुनिया में लंबे संदर्भ व्यवहार के लिए उत्पादन बेंचमार्क।

**MRCR (Multi-Round Coreference Resolution).**स्केल में बहु-टर्न कोरफेरेंस. 8 सुई, 24 सुई, 100 सुई संस्करण. एक मॉडल ध्यान गिरावट से पहले कितने तथ्यों को प्रकट कर सकते हैं.

**NoLiMa.**"गैर-लक्सिकल सुई". सुई और क्वेरी में कोई शाब्दिक ओवरलैप नहीं है; पुनर्प्राप्त करने के लिए एक कदम की अर्थशास्त्र तर्क की आवश्यकता होती है। NIAH से कठिन।

**HELMET.**कई दस्तावेजों को जोड़ता है, किसी से भी सवाल पूछता है, चुनिंदा ध्यान का परीक्षण करता है।

**BABILong.**यह अनावश्यक सीन स्टैक के अंदर तर्क श्रृंखलाओं को एम्बेड करता है।

### क्या रिपोर्ट करना है

- **Advertised context window.**स्पेसिफिकेशन शीट नंबर।
- **Effective retrieval length.**NIAH कुछ सीमा पर गुजरता है (उदाहरण के लिए, 90%) ।
- **Effective reasoning length.**उस सीमा पर मल्टी-हॉप या एग्रीगेशन पास।
- **Degradation curve.**परिप्रेक्ष्य लंबाई के साथ सटीकता, प्रत्येक कार्य प्रकार के अनुसार चित्रित।

आपके विनिर्देश पत्र के लिए दो संख्याएंः पुनः प्राप्ति-प्रभावी और तर्क-प्रभावी। आमतौर पर तर्क-प्रभावी विज्ञापन विंडो का 25-50% है।

```figure
gx-niah-decay
```

## इसे बनाओ

### चरण 1: अपने डोमेन के लिए एक कस्टम NIAH

देखो`code/main.py`. . कंकाल:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

पोंछें`depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`∈ {1k, 4k, 16k, 64k}. हीटमैप का पता लगाएं. यह आपके लक्ष्य मॉडल के लिए NIAH कार्ड है।

### चरण 2: बहु-नाल संस्करण

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

"तीन जादू के शब्द क्या हैं?" जैसे प्रश्नों के लिए तीनों को निकालना आवश्यक है। एक ही सुई की सफलता कई सुई की सफलता की भविष्यवाणी नहीं करती है।

### चरण 3: मल्टी-हॉप चर ट्रैकिंग (RULER शैली)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

उत्तर के लिए तीन कार्यों को जोड़ना आवश्यक है। 128k पर फ्रंटियर मॉडल अक्सर 50-70% सटीकता तक गिर जाते हैं।

### चरण 4: अपने ढेर पर LongBench v2

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

प्रति श्रेणी सटीकता रिपोर्ट करें. समग्र स्कोर कार्य स्तर में बड़े अंतर छिपाता है।

## फंदे

- **NIAH-only evaluation.**1M टोकन पर NIAH पास करने से मल्टी-हॉप के बारे में कुछ नहीं होता है। हमेशा RULER या कस्टम मल्टी-हॉप परीक्षण चलाएं।
- **Uniform depth sampling.**कई कार्यान्वयन केवल परीक्षण गहराई=0.5। परीक्षण गहराई=0, 0.25, 0.5, 0.75, 1.0  "मध्य में खोया" प्रभाव वास्तविक है।
- **Lexical overlap with filler.**यदि सुई ने फिलर के साथ कीवर्ड साझा किए हैं, तो निकालना तुच्छ हो जाता है। नोलिमा शैली की गैर-ओवरलैपिंग सुइयों का उपयोग करें।
- **Ignoring latency.**1M टोकन संकेतों को पूर्व भरने में 30-120 सेकंड लगते हैं। सटीकता के साथ समय से पहले टोकन को मापें।
- **Vendor-self-reported numbers.**OpenAI, Google, मानव सभी अपने स्वयं के स्कोर प्रकाशित करते हैं। हमेशा अपने उपयोग के मामले पर स्वतंत्र रूप से फिर से चलाएं।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

उत्पादन के लिए अंगूठे का नियमः जब तक आप अपनी इच्छित लंबाई पर NIAH + 1 तर्क कार्य नहीं करते तब तक किसी संदर्भ विंडो पर भरोसा न करें।

## इसे भेजें

`outputs/skill-long-context-eval.md`:

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## व्यायाम

1. **Easy.**3 गहराई (0.25, 0.5, 0.75) × 3 लंबाई (1k, 4k, 16k) के साथ एक NIAH बनाएं। किसी भी मॉडल पर चलाएं। 3 × 3 हीटमैप के रूप में प्लॉट पास दर।
2. **Medium.**एक 3 सुई संस्करण जोड़ें. प्रत्येक लंबाई पर सभी 3 का माप लें. समान लंबाई पर एकल सुई पास दर की तुलना करें.
3. **Hard.**64k फिलर में एम्बेडेड एक चर-ट्रैकिंग कार्य (X1 → X2 → X3, 3 हॉप्स के साथ) का निर्माण करें। 3 सीमा मॉडल में सटीकता मापें। प्रति मॉडल प्रभावी तर्क लंबाई रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## आगे पढ़ना

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) मूल NIAH रेपो।
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) बहु-कार्य बेंचमार्क।
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) वास्तविक दुनिया में दीर्घ संदर्भ मूल्यांकन।
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) कठिन सुइयों।
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) तर्क-नार-नार में।
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) गहराई पूर्वाग्रह कागज।
