# संवाद राज्य ट्रैकिंग

> "मैं उत्तर में एक सस्ता रेस्तरां चाहता हूँ ... वास्तव में इसे मध्यम ... और इतालवी जोड़ने के लिए. " तीन मोड़, तीन राज्य अद्यतन. डीएसटी स्लॉट मूल्य dict में सिंक्रनाइज़ रखा है ताकि बुकिंग काम करता है.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## समस्या

कार्य उन्मुख संवाद प्रणाली में, उपयोगकर्ता का लक्ष्य स्लॉट-मूल्य जोड़े के सेट के रूप में एन्कोड किया जाता हैः `{cuisine: italian, area: north, price: moderate}`. प्रत्येक उपयोगकर्ता बारी एक स्लॉट जोड़ सकते हैं, बदल सकते हैं, या हटा सकते हैं. सिस्टम को पूरी बातचीत पढ़नी चाहिए और वर्तमान स्थिति को सही ढंग से आउटपुट करना चाहिए.

एक ही स्लॉट गलत हो जाता है और सिस्टम गलत रेस्तरां बुक करता है, गलत उड़ान निर्धारित करता है, या गलत कार्ड चार्ज करता है। डीएसटी उपयोगकर्ता ने जो कहा और बैक-एंड ने क्या निष्पादित किया के बीच की पिंजरे है।

LLM के बावजूद 2026 में यह अभी भी महत्वपूर्ण क्यों हैः

- अनुपालन-संवेदनशील डोमेन (बैंकिंग, स्वास्थ्य सेवा, एयरलाइन बुकिंग) के लिए निर्धारक स्लॉट मानों की आवश्यकता होती है, मुक्त रूप के उत्पादन की नहीं।
- उपकरण उपयोग एजेंटों अभी भी एपीआई कॉल करने से पहले स्लॉट संकल्प की जरूरत है।
- मल्टी-टर्न सुधार करना जितना लगता है उससे कठिन हैः "वास्तव में नहीं, इसे गुरुवार बनाओ।"

आधुनिक पाइपलाइनः शास्त्रीय डीएसटी अवधारणाएं + एलएलएम एक्सट्रैक्टर + संरचित आउटपुट गार्डरेल।

## अवधारणा

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**एक योजना डोमेन (रेस्टोरेंट, होटल, टैक्सी) और उनके स्लॉट (खाद्य, क्षेत्र, मूल्य, लोग) को परिभाषित करती है। प्रत्येक स्लॉट खाली हो सकता है, एक बंद सेट से एक मूल्य (मूल्यः {सस्ते, मध्यम, महंगे}) के साथ भरा जा सकता है, या एक मुक्त-रूप मूल्य (नामः "द कॉपर केटल") ।

**Two DST formulations.**

- **Classification.**प्रत्येक (स्लॉट, उम्मीदवार_मूल्य) जोड़ी के लिए, हाँ / नहीं की भविष्यवाणी करें। बंद-वोकैबल स्लॉट के लिए काम करता है। 2020 से पहले मानक।
- **Generation.**संवाद को देखते हुए, मुक्त पाठ के रूप में स्लॉट मान उत्पन्न करें। खुले-शब्द स्लॉट के लिए काम करता है। आधुनिक डिफ़ॉल्ट।

**Metric.**संयुक्त लक्ष्य सटीकता (JGA)  मोड़ का अंश जहां * प्रत्येक * स्लॉट सही है। सभी या कुछ भी नहीं। MultiWOZ 2.4 2026 में 83% के आसपास रैंकिंग बोर्ड पर शीर्ष स्थान पर है।

**Architectures.**

1. **Rule-based (slot regex + keyword).**संकीर्ण डोमेन के लिए मजबूत आधार। डिबग करने योग्य.
2. **TripPy / BERT-DST.**BERT एन्कोडिंग के साथ कॉपी-आधारित पीढ़ी. पूर्व-LLM मानक.
3. **LDST (LLaMA + LoRA).**निर्देश-ट्यून LLM डोमेन-स्लॉट प्रलोभन के साथ। MultiWOZ 2.4 पर ChatGPT स्तर की गुणवत्ता तक पहुंचता है।
4. **Ontology-free (2024–26).**स्कीमा को छोड़ें; सीधे स्लॉट नाम और मान उत्पन्न करें. खुले डोमेन को संभालता है.
5. **Prompt + structured output (2024–26).**पीडैंटिक स्कीम + सीमित डिकोडिंग के साथ एलएलएम कोड की 5 पंक्तियां, उत्पादन के लिए तैयार।

### क्लासिक विफलता मोड

- **Co-reference across turns.**"चलो पहले विकल्प के साथ रहने दें. " किस विकल्प को हल करने की जरूरत है.
- **Over-write vs append.**उपयोगकर्ता कहता है "इतालवी जोड़ें।" क्या आप रसोई या जोड़ने की जगह लेते हैं?
- **Implicit confirmations.**"ठीक है अच्छा"  क्या यह प्रस्तावित बुकिंग को स्वीकार करता है?
- **Correction.**"वास्तव में यह 7 बजे बनाओ. " अन्य स्लॉट को साफ किए बिना समय को अपडेट करना चाहिए.
- **Coreference to previous system utterance.**"हाँ, वह एक। " कौन "वह"?

```figure
n5-slot-tracker
```

## इसे बनाओ

### चरण 1: नियम आधारित स्लॉट एक्सट्रैक्टर

देखो`code/main.py`. रेजेक्स + पर्यायवाची शब्दकोश संकीर्ण डोमेन में 70% कैनोनिक बयानों को कवर करते हैंः

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

कैनोनिक शब्दावली के बाहर भंगुर. निर्धारक स्लॉट पुष्टि के लिए काम करता है.

### चरण 2: राज्य अद्यतन लूप

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

तीन अपरिवर्तनीयः

- कभी भी उस स्लॉट को रीसेट न करें जिसे उपयोगकर्ता ने छुआ न हो।
- स्पष्ट इनकार ("खाद्य को मत छोड़ो") को स्पष्ट करना चाहिए।
- उपयोगकर्ता सुधार ("वास्तव में ...") को जोड़ने के बजाय ओवरराइट करना चाहिए।

### चरण 3: संरचित आउटपुट के साथ LLM-चालित DST

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

प्रशिक्षक + Pydantic एक मान्य राज्य वस्तु की गारंटी देता है. कोई regex, कोई योजना असंगतता, कोई पगड़ी स्लॉट नहीं.

### चरण 4: JGA मूल्यांकन

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Calibrate: सिस्टम में कितने मोड़ों का अंश है जो सभी स्लॉट सही बनाता है? MultiWOZ 2.4 के लिए, शीर्ष 2026 प्रणालियों के लिएः 80-83%. आपके डोमेन में सिस्टम को आपके संकीर्ण शब्दावली पर उस से अधिक होना चाहिए या LLM बेसलाइन आपको हराता है।

### चरण 5: संभाल सुधार

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

एक पता लगाया सुधार पर, जो अंतिम अद्यतन स्लॉट को जोड़ने के बजाय ओवरराइट करें। एलएलएम की मदद के बिना सही होना मुश्किल है। आधुनिक पैटर्नः हमेशा एलएलएम को इतिहास से पूरे राज्य को पुनर्जीवित करने दें बजाय क्रमिक रूप से अद्यतन करना  यह स्वाभाविक रूप से सुधारों को संभालता है।

## फंदे

- **Full-history regeneration cost.**LLM को हर मोड़ पर लागतों को पुनर्जीवित करने की अनुमति देना $O(n^2)$कुल टोकन. कैप इतिहास या पुराने मोड़ का सारांश.
- **Schema drift.**पोस्ट हॉक के बाद नए स्लॉट जोड़ने पुराने प्रशिक्षण डेटा तोड़ता है.
- **Case sensitivity.**"इतालवी" बनाम "इतालवी" बनाम "इतालवी"  हर जगह सामान्य हो जाते हैं।
- **Implicit inheritance.**यदि उपयोगकर्ता ने पहले "4 लोगों के लिए" निर्दिष्ट किया है, तो एक अलग समय के लिए एक नया अनुरोध लोगों को साफ नहीं करना चाहिए। हमेशा पूरा इतिहास पास करें।
- **Free-form vs closed-set.**नाम, समय और पते को मुक्त रूप से स्लॉट की आवश्यकता होती है; रसोई और क्षेत्र बंद हैं। दोनों को योजना में मिलाएं।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## इसे भेजें

`outputs/skill-dst-designer.md`:

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## व्यायाम

1. **Easy.**नियम आधारित राज्य ट्रैकर का निर्माण करें `code/main.py`3 स्लॉट (खाद्य, क्षेत्र, मूल्य) के लिए। 10 हस्तनिर्मित संवादों पर परीक्षण करें। JGA मापें।
2. **Medium.**उसी डेटासेट के साथ प्रशिक्षक + पायदान्टिक + एक छोटे LLM. JGA तुलना. सबसे कठिन मोड़ की जांच.
3. **Hard.**दोनों को लागू करें और मार्गः नियम आधारित प्राथमिक, नियम आधारित एलएलएम बैक जब <2 स्लॉट आत्मविश्वास से जारी करता है। प्रति वक्र संयुक्त जेजीए और निष्कर्ष लागत का माप करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## आगे पढ़ना

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) कैनोनिक बेंचमार्क।
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) DST के लिए LLaMA + LoRA निर्देशों को ट्यूनिंग करना।
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) कॉपी आधारित डीएसटी वर्कहॉर्स।
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) EM आधारित अनियंत्रित TOD।
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) कैनोनिक डीएसटी परिणाम।
