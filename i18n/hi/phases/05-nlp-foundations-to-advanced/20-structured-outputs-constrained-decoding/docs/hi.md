# संरचित आउटपुट और प्रतिबंधित डिकोडिंग

> JSON के लिए LLM पूछें. अधिकांश समय JSON प्राप्त करें। उत्पादन में, "अधिकतर" समस्या है। संकुचित डिकोडिंग "अधिकतर" को "हमेशा" में बदल देता है। नमूना लेने से पहले लॉजिट को संपादित करके।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## समस्या

एक वर्गीकरणकर्ता LLM को प्रेरित करता हैः " {सकारात्मक, नकारात्मक, तटस्थ} का एक लौटाएं।" मॉडल लौटाता है "भावना सकारात्मक है  यह समीक्षा जबरदस्त रूप से अनुकूल है क्योंकि ग्राहक स्पष्ट रूप से कहता है कि वे ...। आपका पार्सर दुर्घटनाग्रस्त हो जाता है। आपके वर्गीकरणकर्ता का F1 0.0 है।

मुक्त रूप उत्पादन एक अनुबंध नहीं है, यह एक सुझाव है। एक उत्पादन प्रणाली को अनुबंध की आवश्यकता है।

2026 में तीन परतें मौजूद हैं।

1. **Prompting.**अच्छा पूछें. "केवल JSON ऑब्जेक्ट लौटाएं. " सीमा मॉडल पर ~ 80% काम करता है, छोटे पर कम.
2. **Native structured output APIs.**ओपनएआई `response_format`, मानव उपकरण उपयोग, मिथुन JSON मोड. समर्थित योजनाओं पर विश्वसनीय. विक्रेता द्वारा लॉक.
3. **Constrained decoding.**प्रत्येक पीढ़ी के चरण में लॉगिट को संशोधित करें ताकि मॉडल *अमान्य टोकन जारी नहीं कर सके। निर्माण द्वारा 100% मान्य। किसी भी स्थानीय मॉडल पर काम करता है।

यह सबक तीनों के लिए अंतर्ज्ञान का निर्माण करता है और नाम देता है कि किसके लिए पहुंचना है।

## अवधारणा

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**प्रत्येक पीढ़ी के चरण में, एलएलएम पूरी शब्दावली (~100k टोकन) पर एक लॉजिट वेक्टर उत्पन्न करता है। एक *लॉजिट प्रोसेसर* मॉडल और नमूना लेने वाले के बीच स्थित है। यह गणना करता है कि लक्ष्य व्याकरण में वर्तमान स्थिति को देखते हुए कौन से टोकन मान्य हैं  JSON योजना, रेजेक्स, संदर्भ मुक्त व्याकरण  और सभी अमान्य टोकन के लॉजिट को नकारात्मक अनंत पर सेट करता है। शेष लॉजिटों पर सॉफ्टमैक्स केवल वैध निरंतरताओं पर संभावना द्रव्यमान रखता है।

2026 में कार्यान्वयनः

- **Outlines.**JSON योजना या regex एक अंत-राज्य मशीन में संकलित करता है. प्रत्येक टोकन एक प्राप्त करता है$O(1)$FSM आधारित, इसलिए पुनरावर्ती योजनाओं को सपाट करने की जरूरत है.
- **XGrammar / llguidance.**संदर्भ मुक्त व्याकरण इंजन। पुनरावर्ती JSON योजना को संभालें। लगभग शून्य डिकोडिंग ओवरहेड। OpenAI ने 2025 में अपने संरचित आउटपुट कार्यान्वयन में मार्गदर्शन का श्रेय दिया।
- **vLLM guided decoding.**अंतर्निहित`guided_json`,`guided_regex`,`guided_choice`,`guided_grammar`रूपरेखा, XGrammar, या lm प्रारूप-प्रवर्तन बैकेंड के माध्यम से।
- **Instructor.**किसी भी LLM पर Pydantic आधारित रैपर। सत्यापन विफलता पर पुनः प्रयास करता है। क्रॉस-प्रोवाइडर, लेकिन लॉजिट को संशोधित नहीं करता है  यह पुनः प्रयासों + संरचित-आउटपुट-जागरूक संकेतों पर निर्भर करता है।

### विपरीत परिणाम

प्रतिबंधित डिकोडिंग अक्सर * बिना प्रतिबंधित पीढ़ी की तुलना में * तेज़ * है। दो कारणों से। पहला, यह अगले टोकन खोज स्थान को छोटा करता है। दूसरा, स्मार्ट कार्यान्वयन मजबूर टोकन (जैसे स्केफोल्डिंग) के लिए टोकन पीढ़ी को पूरी तरह से छोड़ देते हैं।`{"name": "` प्रत्येक बाइट निर्धारित किया गया है) ।

### उस जाल में जो आपको खर्च करता है

क्षेत्र आदेश मायने रखता है।`answer`पहले`reasoning`JSON मान्य है। उत्तर गलत है। कोई सत्यापन इसे पकड़ता है।

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

स्कीमा क्षेत्र क्रम तर्क है, स्वरूपण नहीं।

```figure
constrained-decoder
```

## इसे बनाओ

### चरण 1: रेजेक्स-सीमित पीढ़ी खरोंच से

देखो`code/main.py`एक स्वतंत्र एफएसएम कार्यान्वयन के लिए।

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

एफएसएम यह पता चलता है कि हमने अभी तक व्याकरण के किन हिस्सों को पूरा किया है। `valid_tokens(state, tokenizer)`गणना करता है कि कौन से शब्दावली टोकन स्वीकार करने के रास्ते को छोड़ने के बिना एफएसएम को आगे बढ़ा सकते हैं।

### चरण 2: JSON योजना के लिए रूपरेखा

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

FSM अमान्य आउटपुट अछूता बनाता है।

### चरण 3: प्रदाता-अज्ञानी Pydantic के लिए प्रशिक्षक

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

अलग तंत्र. प्रशिक्षक लॉजिट को छूता नहीं है। यह स्कीमा को प्रॉम्प्ट में प्रारूपित करता है, आउटपुट को पार्स करता है, और सत्यापन विफलता पर पुनः प्रयास करता है (पूर्वनिर्धारित 3 बार) । किसी भी प्रदाता के साथ काम करता है। पुनः प्रयासों में देरी और लागत बढ़ जाती है। क्रॉस-प्रोवाइडर पोर्टेबिलिटी बिक्री बिंदु है।

### चरण 4: मूल विक्रेता एपीआई

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

सर्वर-साइड प्रतिबंधित डिकोडिंग समर्थित योजनाओं के लिए रूपरेखा के साथ विश्वसनीयता समानता कोई स्थानीय मॉडल प्रबंधन नहीं है। आप आपूर्तिकर्ता के लिए लॉक करता है।

## फंदे

- **Recursive schemas.**रेखाचित्र एक निश्चित गहराई तक पुनरावृत्ति को सपाट करता है। पेड़-संरचित आउटपुट (निस्ट्ड टिप्पणियाँ, एएसटी) को XGrammar या llguidance (CFG- आधारित) की आवश्यकता होती है।
- **Huge enums.**10,000-विकल्प एनयूएम धीमी गति से या समय से संकलित करता है। एक रिट्रीवर पर स्विच करेंः पहले शीर्ष-के उम्मीदवारों की भविष्यवाणी करें, उन पर प्रतिबंध लगाएं।
- **Grammar too strict.**बल`date: "YYYY-MM-DD"`regex और मॉडल आउटपुट नहीं कर सकते `"unknown"`एक तारीख का आविष्कार करके मॉडल मुआवजा देता है।`null`या एक प्रहरी.
- **Premature commitment.**ऊपर दिए गए फील्ड ऑर्डर फेल को देखें. हमेशा तर्क को पहले रखें.
- **Vendor JSON mode without schema.**शुद्ध JSON मोड केवल मान्य JSON की गारंटी देता है, आपके उपयोग के मामले के लिए मान्य नहीं है। हमेशा एक पूर्ण योजना प्रदान करें।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## इसे भेजें

`outputs/skill-structured-output-picker.md`:

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## व्यायाम

1. **Easy.** के लिए सीमित डिकोडिंग के बिना एक छोटे खुले-वजन मॉडल (जैसे, Llama-3.2-3B) को प्रयुक्त करें`Review(sentiment, confidence, evidence_span)`. 100 समीक्षाओं पर मान्य JSON के रूप में विश्लेषण करने वाले अंश को मापें।
2. **Medium.**JSON मोड के साथ एक ही corpus. अनुपालन दर, विलंबता, और अर्थशास्त्र सटीकता की तुलना करें.
3. **Hard.**फोन नंबरों के लिए एक regex-बंद डिकोडर को खरोंच से लागू करें (`\d{3}-\d{3}-\d{4}`) 1000 नमूनों पर 0 अमान्य आउटपुट की जांच करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## आगे पढ़ना

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) आउटलाइन पेपर।
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) सीएफजी आधारित त्वरित प्रतिबंधित डिकोडिंग।
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) इन्फेरेंस सर्वर इंटीग्रेशन।
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) एपीआई संदर्भ + गॉचस।
- [Instructor library](https://python.useinstructor.com/) Pydantic + प्रदाताओं के बीच पुनः प्रयास करता है।
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) बेंचमार्किंग 6 प्रतिबंधित डिकोडिंग फ्रेमवर्क।
