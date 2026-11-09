# कोरफेरेंस संकल्प

> "उसने उसे फोन किया, उसने जवाब नहीं दिया, डॉक्टर दोपहर के भोजन पर थे" तीन संदर्भ दो लोगों के लिए और कोई नाम नहीं है। कोरफ़ेरेंस रिज़ॉल्यूशन पता चलता है कि कौन कौन है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## समस्या

300 शब्दों के लेख से Apple Inc. का हर उल्लेख निकालें। लेख में "Apple" कहा जाता है तो यह आसान है। जब यह "कंपनी", "वे", "क्यूपर्टिनो का प्रौद्योगिकी दिग्गज", या "जॉब्स की फर्म" कहता है तो यह मुश्किल है। एक ही इकाई के लिए इन उल्लेखों को हल किए बिना, आपकी NER पाइपलाइन में 60-80% उल्लेखों को याद किया जाता है।

कोरफ़ेरेंस रिज़ॉल्यूशन एक ही वास्तविक दुनिया इकाई को संदर्भित करने वाले प्रत्येक अभिव्यक्ति को एक क्लस्टर में जोड़ता है। यह सतह-स्तर के एनएलपी (एनईआर, पार्सिंग) और डाउनस्ट्रीम सेमेटिक (आईई, क्यूए, सारांश, केजी) के बीच चिपकने वाला है।

2026 में यह क्यों मायने रखता हैः

- सारांशः "सीईओ ने घोषणा की ..." बनाम "टीम कुक ने घोषणा की ..."  सारांश में सीईओ का नाम होना चाहिए।
- "उसने किसको बुलाया? " प्रश्न का उत्तर देने के लिए "उसने" का समाधान करना आवश्यक है।
- सूचना निकासीः "PER1 ने Apple की स्थापना की" और "Jobs ने Apple की स्थापना की" के साथ एक ज्ञान ग्राफ अलग प्रविष्टियों के रूप में गलत है।
- बहु-दस्तावेज IE: एक ही घटना के बारे में लेखों में उल्लेखों को मिलाकर क्रॉस-दस्तावेज कोरफेरेंस है।

## अवधारणा

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**इनपुटः एक दस्तावेज़। आउटपुटः उल्लेखों (क्षेत्र) का एक समूह जिसमें प्रत्येक समूह एक इकाई को संदर्भित करता है।

**Mention types.**

- **Named entity.**"टीम कुक"
- **Nominal.**"सीईओ", "कंपनी"
- **Pronominal.**"वह", "वह", "वे", "यह"
- **Appositive.**"टाइम कुक, एप्पल के सीईओ,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**व्याकरण नियमों का उपयोग करके वाक्यविन्यास-आधारित विशेषण संकल्प। अच्छी आधार रेखा। आश्चर्यजनक रूप से मुश्किल है विशेषणों पर हराया।
2. **Mention-pair classifier.**हर एक जोड़ी के लिए उल्लेख $(m_i, m_j)$, पूर्वानुमान यदि वे कोरफियर. पारगमन बंद द्वारा क्लस्टर. 2016 से पहले मानक.
3. **Mention-ranking.**प्रत्येक उल्लेख के लिए, उम्मीदवार पूर्ववर्ती (सहित "कोई पूर्ववर्ती नहीं") रैंक करें। शीर्ष चुनें।
4. **Span-based end-to-end (Lee et al., 2017).**ट्रांसफार्मर एन्कोडर. एक लंबाई कैप तक सभी उम्मीदवारों को सूचीबद्ध करें. स्कोर का उल्लेख करें भविष्यवाणी करें. प्रत्येक अवधि के लिए पूर्वानुमान-संभावना का अनुमान लगाएं. लालच से समूह. आधुनिक डिफ़ॉल्ट।
5. **Generative (2024+).**LLM की तैयारी करें: "इस पाठ में प्रत्येक प्रत्यय और उसके पूर्ववर्ती को सूचीबद्ध करें।" सरल मामलों पर अच्छा काम करता है, लंबे दस्तावेजों और दुर्लभ संदर्भों पर संघर्ष करता है।

**The evaluation metrics.**पांच मानक माप (MUC, B3, CEAF, BLANC, LEA) क्योंकि कोई भी माप क्लस्टरिंग गुणवत्ता को कैप्चर नहीं करता है। पहले तीन के औसत को CoNLL F1 के रूप में रिपोर्ट करें। CoNLL-2012: ~83 F1 पर 2026 में अत्याधुनिकताः

**Known hard cases.**

- पहले पेश किए गए पृष्ठों में संस्थाओं को संदर्भित करने वाले निश्चित विवरण।
- ब्रिजिंग अनाफोरा ("चक्कों" → पहले उल्लेखित कार) ।
- चीनी और जापानी जैसे भाषाओं में शून्य अनाफोर।
- कैटाफोरा (प्रतीकार्थ से पहले प्रत्यय): "जब **she**अंदर आकर मैरी मुस्कुराई।

```figure
coref-links
```

## इसे बनाओ

### चरण 1: पूर्व प्रशिक्षित तंत्रिका कोरफेरेंस (एलेनएनएलपी / स्पेससाइ-एक्सपीरिएंटल)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

एक लंबे दस्तावेज पर, आपको कुछ ऐसा मिलता हैः
- क्लस्टर 1: [Apple, कंपनी, यह]
- समूह 2: [नए उत्पाद, वे]

### चरण 2: नियम आधारित प्रत्यय समाधान (शिक्षण)

देखो`code/main.py`केवल स्टडीलिब कार्यान्वयन के लिएः

1. निकालें उल्लेखः नामित संस्थाएं (पूंजीकृत अवधि), प्रत्यय (अर्थात् खोज), निश्चित विवरण ("एक्स") ।
2. प्रत्येक प्रत्यय के लिए, पिछले K उल्लेखों को देखें और उन्हें निम्नानुसार अंकित करेंः
   - लिंग/संख्या समझौता (हेवर्स्टिक)
   - हालिया (अधिकतर जीत)
   - वाक्यरचनात्मक भूमिका (उपयोगी विषय)
3. उच्चतम स्कोर करने वाले पूर्ववर्ती को लिंक करें।

तंत्रिका मॉडल के साथ प्रतिस्पर्धी नहीं है, लेकिन यह खोज स्थान और एक अंत-से-अंत मॉडल को लेने के लिए निर्णय दिखाता है।

### चरण 3: कोरफेरेंस के लिए LLM का उपयोग करना

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

दो विफलता मोड देखने के लिए। पहला, एलएलएम ओवर-फ्यूज ("वह" और "वह" दो अलग-अलग लोगों को संदर्भित करते हैं) । दूसरा, एलएलएम चुपचाप लंबे दस्तावेजों में उल्लेख छोड़ देते हैं। हमेशा स्पैन-ऑफसेट चेक के साथ सत्यापित करें।

### चरण 4: मूल्यांकन

मानक conll-2012 स्क्रिप्ट MUC, B3, CEAF-φ4 की गणना करता है और औसत रिपोर्ट करता है। आंतरिक मूल्यांकन के लिए, स्पैन-स्तर सटीकता के साथ शुरू करें और अपने टिप्पणी परीक्षण सेट को याद रखें, फिर उल्लेख-लिंक F1 जोड़ें।

## फंदे

- **Singleton explosion.**कुछ सिस्टम हर उल्लेख को अपने स्वयं के क्लस्टर के रूप में रिपोर्ट करते हैं। B3 सहानुभूतिपूर्ण है। MUC इस पर दंडित करता है। हमेशा तीनों मीट्रिकों की जांच करें।
- **Pronouns in long context.**2,000 टोकन से अधिक दस्तावेजों पर प्रदर्शन में लगभग 15 F1 गिरावट। सावधानी से टुकड़ा।
- **Gender assumptions.**कठोर कोडित लिंग नियम गैर-बाइनरी रेफरेंट, संगठनों, जानवरों पर उल्लंघन करते हैं। सीखे गए मॉडल या तटस्थ स्कोरिंग का उपयोग करें।
- **LLM drift on long docs.**एक एकल एपीआई कॉल 50+ पैराग्राफों में विश्वसनीय रूप से क्लस्टर उल्लेख नहीं कर सकता है। स्लाइडिंग विंडो + मर्ज का उपयोग करें।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

2026 में एकीकृत पैटर्नः पहले एनईआर चलाएं, कोरफ चलाएं, कोरफ क्लस्टर को एनईआर संस्थाओं में मिलाएं। डाउनस्ट्रीम कार्यों में प्रत्येक क्लस्टर पर एक इकाई होती है, प्रत्येक उल्लेख पर एक इकाई नहीं।

## इसे भेजें

`outputs/skill-coref-picker.md`:

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## व्यायाम

1. **Easy.**नियम आधारित रिज़ॉल्वर को चलाएँ `code/main.py`5 हस्तनिर्मित पैराग्राफों पर। जमीनी सत्य के साथ उल्लेख-लिंक सटीकता को मापें।
2. **Medium.**एक समाचार लेख पर एक पूर्व प्रशिक्षित तंत्रिका कोरफ मॉडल का उपयोग करें। अपने स्वयं के मैनुअल टिप्पणी के साथ क्लस्टर की तुलना करें। यह कहां विफल रहा?
3. **Hard.**एक कोर-बढ़ती हुई एनईआर पाइपलाइन का निर्माण करेंः पहले एनईआर, फिर कोर-बढ़ते क्लस्टर के माध्यम से विलय करें। 100 लेखों पर इकाई-कवरेज में सुधार बनाम केवल एनईआर-माप करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## आगे पढ़ना

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) कैनोनिक पाठ्यपुस्तक अध्याय।
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) स्पैन आधारित अंत-से-अंत।
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) पूर्व प्रशिक्षण जो कोरफ में सुधार करता है।
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) बेंचमार्क।
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) नियम आधारित क्लासिक।
