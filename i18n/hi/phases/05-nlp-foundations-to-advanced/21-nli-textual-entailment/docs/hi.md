# प्राकृतिक भाषा का तर्क  पाठ संबंधी सम्मिलन

> "t entails h" का अर्थ है कि मानव रीडिंग t के अनुसार h सही है। NLI का उद्देश्य निष्कर्षण / विरोधाभास / तटस्थता की भविष्यवाणी करना है। सतह पर बोरिंग, उत्पादन में भार सहन करना।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## समस्या

आपने एक सारांशक बनाया, जिसने सारांश दिया. आप कैसे जानते हैं कि सारांश में कोई पगड़ी नहीं है?

आपने एक चैटबॉट बनाया. उसने "हाँ" कहा. आप कैसे जानते हैं कि उत्तर को प्राप्त हुए passage द्वारा समर्थित है?

आपको 10,000 समाचार लेखों को विषय के अनुसार वर्गीकृत करने की आवश्यकता है. आपके पास प्रशिक्षण लेबल नहीं हैं. क्या आप एक मॉडल का पुनः उपयोग कर सकते हैं?

तीनों समस्याएं प्राकृतिक भाषा के तर्क में ही आती हैं। एनएलआई पूछता हैः एक प्रमोशन दिया गया है `t`और एक परिकल्पना `h`, है `h``t`, विरोधाभासी या तटस्थ (गैर-संबंधित)?

- **Hallucination check:** `t`= स्रोत दस्तावेज, `h`संक्षेप में दावा नहीं, संक्षेप में = भ्रम।
- **Grounded QA:** `t`= प्राप्त मार्ग, `h`= उत्पन्न उत्तर. नहीं समापन = निर्माण.
- **Zero-shot classification:** `t`= दस्तावेज, `h`= शब्दबद्ध लेबल ("यह खेल के बारे में है") ।

एक कार्य, तीन उत्पादन उपयोग. यही कारण है कि प्रत्येक आरएजी मूल्यांकन ढांचे को हुड के नीचे एक एनएलआई मॉडल भेजता है।

## अवधारणा

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`→ `h`"मक्खी गद्दे पर है" का अर्थ है "एक बिल्ली है।
- **Contradiction.** `t`→`h`. "मक्खी मैट पर है" "कोई बिल्ली नहीं है" के विपरीत है.
- **Neutral.**"मक्खी मैट पर है" "मक्खी भूख लगी है" से तटस्थ है।

**Not logical entailment.**एनएलआई *प्राकृतिक* भाषा का निष्कर्ष है  जो एक विशिष्ट मानव पाठक का निष्कर्ष होगा, सख्त तर्क नहीं। "जॉन ने अपने कुत्ते को चलाया" का मतलब है "जॉन के पास एक कुत्ता है" एनएलआई में, लेकिन सख्त प्रथम श्रेणी तर्क केवल इसे स्वीकार करेगा यदि आप स्वामित्व को स्वार्थी बनाते हैं।

**Datasets.**

- **SNLI**(2015). 570k मानव-विवरण जोड़े, छवि कैप्शन के रूप में स्थान। संकीर्ण डोमेन।
- **MultiNLI**2026 में मानक प्रशिक्षण पाठ्यक्रम।
- **ANLI**(2019). प्रतिकूल एनएलआई। मनुष्य ने विशेष रूप से मौजूदा मॉडल को तोड़ने के लिए डिज़ाइन किए गए उदाहरण लिखे। कठिन।
- **DocNLI, ConTRoL**(202021). दस्तावेज-लंबाई के स्थान। बहु-हॉप और लंबी दूरी के निष्कर्ष का परीक्षण।

**The architecture.**एक ट्रांसफार्मर एन्कोडर (BERT, RoBERTa, DeBERTa) पढ़ता है `[CLS] premise [SEP] hypothesis [SEP]`. . .`[CLS]`एमएनएलआई पर ट्रेन करें, बनाए गए बेंचमार्क पर मूल्यांकन करें, वितरण जोड़े पर 90% से अधिक सटीकता प्राप्त करें।

**Zero-shot via NLI.**एक दस्तावेज़ और उम्मीदवार लेबल दिए जाने पर, प्रत्येक लेबल को एक परिकल्पना में बदल दें ("यह पाठ खेल के बारे में है") । प्रत्येक के लिए सम्मिलित होने की संभावना की गणना करें। अधिकतम चुनें। यह Hugging Face के पीछे तंत्र है `zero-shot-classification`पाइपलाइन।

```figure
nli-router
```

## इसे बनाओ

### चरण 1: पूर्व प्रशिक्षित एनएलआई मॉडल चलाएं

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

उत्पादन एनएलआई के लिए, `facebook/bart-large-mnli`और `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`DeBERTa-v3 शीर्ष रैंकिंग बोर्डों में है।

### चरण 2: शून्य शॉट वर्गीकरण

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

टेम्पलेट "यह उदाहरण के बारे में है {लेबल}." डिफ़ॉल्ट रूप से है।  के साथ अनुकूलित करें`hypothesis_template`कोई प्रशिक्षण डेटा की आवश्यकता नहीं है, कोई सूक्ष्म समायोजन नहीं है.

### चरण 3: RAG के लिए निष्ठा जांच

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

यह RAGAS वफादारी का मूल है. उत्पन्न उत्तर को परमाणु दावों में विभाजित करें. प्रत्येक दावों को प्राप्त संदर्भ के साथ जांचें. जो अंश शामिल है, रिपोर्ट करें।

### चरण 4: हाथ से रोल किया गया एनएलआई वर्गीकरण (संदर्भात्मक)

देखो`code/main.py`एक स्ट्डलिब-केवल खिलौना के लिएः प्रमेय और परिकल्पना की तुलना लेक्सिकल ओवरलैप + नकारण का पता लगाने के माध्यम से की जाती है। ट्रांसफार्मर मॉडल के साथ प्रतिस्पर्धी नहीं  लेकिन यह कार्य का आकार दिखाता हैः दो पाठ में, 3-तरफा लेबल बाहर, हानि = क्रॉस-एंट्रोपी ओवर `{entail, contradict, neutral}`. .

## फंदे

- **Hypothesis-only shortcuts.**मॉडल केवल परिकल्पना से एसएनएलआई पर लेबल की भविष्यवाणी कर सकते हैं क्योंकि "नहीं", "कोई नहीं", "कभी नहीं" विरोधाभास के साथ संबद्ध हैं। लेबल लीक का पता लगाने के लिए मजबूत आधार रेखा।
- **Lexical overlap heuristic.**उपक्रम हेरिस्टिक ("प्रत्येक उपक्रम शामिल है") SNLI को पास करता है लेकिन HANS/ANLI को विफल करता है। प्रतिकूल बेंचमार्क का उपयोग करें।
- **Document-length degradation.**एकल वाक्य NLI मॉडल दस्तावेज लंबाई के परिसरों पर 20+ F1 छोड़ देते हैं। लंबे संदर्भ के लिए DocNLI-प्रशिक्षित मॉडल का उपयोग करें।
- **Zero-shot template sensitivity.**"यह उदाहरण के बारे में है {लेबल}" बनाम "{लेबल}" बनाम "विषय है {लेबल}" सटीकता 10+ अंक स्विंग कर सकते हैं। टेम्पलेट ट्यून करें।
- **Domain mismatch.**एमएनएलआई सामान्य अंग्रेजी पर प्रशिक्षण देता है। कानूनी, चिकित्सा और वैज्ञानिक पाठ को डोमेन-विशिष्ट एनएलआई मॉडल (जैसे, SciNLI, MedNLI) की आवश्यकता होती है।

## इसका प्रयोग करें

2026 स्टैकः

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

2026 मेटा-पैटर्नः एनएलआई पाठ समझ का चिपकने वाला टेप है। जब भी आपको "क्या ए समर्थन बी करता है?" या "क्या ए बी का विरोध करता है?" की आवश्यकता होती है, तो आप एक और एलएलएम कॉल के लिए पहुंचने से पहले एनएलआई तक पहुंचें।

## इसे भेजें

`outputs/skill-nli-picker.md`:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## व्यायाम

1. **Easy.**दौड़ें`facebook/bart-large-mnli`20 हस्तनिर्मित (प्रिमिसेस, परिकल्पना, लेबल) ट्रिपल पर तीनों वर्गों को कवर करें। सटीकता मापें। प्रतिकूल "उपक्रम हेरिस्टिक" जाल ("मैंने केक नहीं खाया" बनाम "मैंने केक खाया") जोड़ें और देखें कि क्या यह टूटता है।
2. **Medium.**शून्य-शॉट टेम्पलेट की तुलना करें `"This text is about {label}"``"The topic is {label}"`और `"{label}"`100 एजी समाचार के शीर्षक पर रिपोर्ट सटीकता स्विंग.
3. **Hard.**एक RAG निष्ठा परीक्षक बनाएंः परमाणु दावा विघटन + प्रति दावा NLI। 50 RAG-उत्पन्न उत्तरों का मूल्यांकन करें। सोने के संदर्भ के साथ। गलत-सकारात्मक और गलत-नकारात्मक दरों को मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## आगे पढ़ना

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI।
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) बहुविध।
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) एएनएलआई बेंचमार्क।
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classifier।
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) 2026 NLI कार्यघोड़ा।
