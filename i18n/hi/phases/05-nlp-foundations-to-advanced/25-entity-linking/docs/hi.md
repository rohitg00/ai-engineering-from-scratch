# इकाई लिंकिंग और असंगति

> एनईआर ने "पेरिस" पाया। "संबद्ध इकाई निर्णय लेता हैः पेरिस, फ्रांस? पेरिस हिल्टन? पेरिस, टेक्सास? पेरिस (ट्रोजन राजकुमार)? बिना लिंक किए, आपका ज्ञान ग्राफ अस्पष्ट रहता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## समस्या

एक वाक्य पढ़ता हैः "जॉर्डन प्रेस को हराया।" आपके NER "जॉर्डन" को व्यक्ति के रूप में टैग करता है। अच्छा। लेकिन *कौन* जॉर्डन?

- माइकल जॉर्डन (बास्केटबॉल)?
- माइकल बी. जॉर्डन (अभिनेता)?
- माइकल आई. जॉर्डन (बर्केली एमएल प्रोफेसर  हाँ, यह भ्रम एमएल पेपर में असली है)?
- जॉर्डन (देश)?
- जॉर्डन (इब्रानी प्रथम नाम)?

इकाई लिंकिंग (EL) ज्ञान आधार में एक अद्वितीय प्रविष्टि के लिए प्रत्येक उल्लेख को हल करता हैः विकिडाटा, विकिपीडिया, डीबीपीडिया, या आपका डोमेन KB। दो उप-कार्यः

1. **Candidate generation.**"जॉर्डन" को देखते हुए, कौन सी KB प्रविष्टियाँ प्रामाणिक हैं?
2. **Disambiguation.**संदर्भ को देखते हुए, कौन सा उम्मीदवार सही है?

दोनों चरण सीखने योग्य हैं। दोनों बेंचमार्क किए गए हैं। संयुक्त पाइपलाइन एक दशक से स्थिर है  जो परिवर्तन है वह है डिसाम्बिक्यूटर की गुणवत्ता।

## अवधारणा

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**उल्लेख सतह रूप ("जॉर्डन") को देखते हुए, एक उपनाम सूचकांक में उम्मीदवारों को खोजें। विकिपीडिया उपनाम शब्दकोशों में अधिकांश नामित संस्थाएं शामिल हैंः "जेएफके" → जॉन एफ. केनेडी, जैक्लिन केनेडी, जेएफके हवाई अड्डा, जेएफके (फिल्म) । सामान्य सूचकांक प्रति उल्लेख 10-30 उम्मीदवारों को लौटता है।

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`. अच्छी तरह से काम करता है, तेजी से, कोई प्रशिक्षण नहीं.
2. **Embedding-based (ESS / REL / Blink).**एनकोड उल्लेख + संदर्भ. प्रत्येक उम्मीदवार के विवरण को एनकोड. अधिकतम कॉसिन चुनें. 2020-2024 डिफ़ॉल्ट।
3. **Generative (GENRE, 2021; LLM-based, 2023+).**इकाई के कैनोनिक नाम टोकन-दर-टोकन को डिकोड करें। वैध इकाई नामों के एक त्रिज्या तक सीमित है ताकि आउटपुट एक वैध KB आईडी होने की गारंटी हो।

**End-to-end vs pipeline.**आधुनिक मॉडल (ELQ, BLINK, ExtEnD, GENRE) एक पास में NER + उम्मीदवार पीढ़ी + असंबद्धता चलाते हैं। पाइपलाइन सिस्टम अभी भी उत्पादन में हावी हैं क्योंकि आप घटकों को आदान-प्रदान कर सकते हैं।

### दो माप

- **Mention recall (candidate gen).**सोने का अंश जहां सही KB प्रविष्टि उम्मीदवार सूची में दिखाई देती है उल्लेख किया गया है। पूरे पाइपलाइन के लिए मंजिल।
- **Disambiguation accuracy / F1.**सही उम्मीदवारों को देखते हुए, शीर्ष 1 कितनी बार सही होता है।

80% उम्मीदवारों को वापस लेने पर 99% अस्पष्टता वाली प्रणाली 80% पाइपलाइन है।

```figure
gx-entity-linking
```

## इसे बनाओ

### चरण 1: विकिपीडिया रीडायरेक्ट्स से एक उपनाम सूचकांक बनाएं

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

विकिपीडिया उपनाम डेटाः ~18M (असमान, इकाई) जोड़े। विकिडाटा डंप से डाउनलोड करें। उल्टा सूचकांक के रूप में स्टोर करें।

### चरण 2: संदर्भ आधारित असमंजस्य

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

जैकार्ड ओवरलैप एक खिलौना है। एम्बेडमेंट पर कॉसिन समानता से प्रतिस्थापित करें (देखें `code/main.py`ट्रांस्फार्मर संस्करण के लिए चरण-2) ।

### चरण 3: एम्बेडिंग आधारित (BLINK शैली)

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

सूचकांक समय पर, प्रत्येक KB इकाई को एक बार एम्बेड करें। क्वेरी समय में, उल्लेख + संदर्भ को एक बार एम्बेड करें, उम्मीदवार पूल के खिलाफ डॉट-प्रोडक्ट, अधिकतम चुनें।

### चरण 4: जनरेटिव इकाई लिंकिंग (कन्सेप्ट)

GENRE इकाई के विकिपीडिया शीर्षक वर्ण-दर-वर्ण को डिक्रिप्ट करता है। प्रतिबंधित डिक्रिप्टिंग (पाठ 20 देखें) सुनिश्चित करता है कि केवल वैध शीर्षक आउटपुट किए जा सकते हैं। KB-समर्थित ट्राई के साथ तंग एकीकरण। आधुनिक वंशज REL-GEN और LLM-prompted EL है।

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

एक श्वेतसूची के साथ संयुक्त (आवरण `choice`), यह 2026 में जहाज करने के लिए सबसे सरल ईएल पाइपलाइन है।

### चरण 5: एआईडीए-कॉन्एलएल पर मूल्यांकन

AIDA-CoNLL मानक EL बेंचमार्क हैः 1,393 रॉयटर्स लेख, 34k उल्लेख, विकिपीडिया संस्थाएं।`P@1`) और केबी से बाहर की एनआईएल-डिटेक्शन दर।

## फंदे

- **NIL handling.**कुछ उल्लेख KB (उभरती हुई संस्थाएं, अस्पष्ट लोग) में नहीं हैं। सिस्टम को गलत इकाई की अनुमान लगाने के बजाय NIL की भविष्यवाणी करनी चाहिए। अलग से मापा गया।
- **Mention boundary errors.**अपस्ट्रीम एनईआर आंशिक स्पैन ("बैंक ऑफ अमेरिका" के रूप में टैग किया गया है) को याद करता है।
- **Popularity bias.**एमएल पेपर में "माइकल आई. जॉर्डन" का उल्लेख अक्सर बास्केटबॉल जॉर्डन से जुड़ा होता है।
- **Cross-lingual EL.**अंग्रेजी विकिपीडिया संस्थाओं के लिए चीनी पाठ में मैपिंग का उल्लेख करना। एक बहुभाषी एन्कोडर या अनुवाद चरण की आवश्यकता होती है।
- **KB staleness.**नई कंपनियां, घटनाएं, लोग पिछले साल के विकिपीडिया डंप में नहीं हैं। उत्पादन पाइपलाइनों को एक ताज़ा लूप की आवश्यकता है।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

2026 में उत्पादन पैटर्न जो जहाज करता हैः प्रत्येक उल्लेख पर NER → coref → EL → क्लस्टर को एक कैनोनिकल इकाई प्रति क्लस्टर में ढकना। आउटपुटः दस्तावेज़ में प्रति इकाई एक KB id, उल्लेख के लिए एक नहीं।

## इसे भेजें

`outputs/skill-entity-linker.md`:

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## व्यायाम

1. **Easy.** में पूर्व + संदर्भ भेदभाव को लागू करें`code/main.py`10 अस्पष्ट उल्लेखों पर (पेरिस, जॉर्डन, एप्पल) सही इकाई को हाथ से लेबल करें। सटीकता मापें।
2. **Medium.**एक वाक्य ट्रांसफार्मर के साथ 50 अस्पष्ट उल्लेखों को एन्कोड करें। प्रत्येक उम्मीदवार के विवरण को एम्बेड करें। एम्बेड-आधारित असंबद्धता की तुलना जैकार्ड संदर्भ ओवरलैप से करें।
3. **Hard.**1k इकाई डोमेन KB (जैसे आपकी कंपनी में कर्मचारी + उत्पाद) का निर्माण करें। एनईआर + ईएल को अंत-से-अंत लागू करें। 100 लंबे समय तक किए गए वाक्य पर सटीकता मापें और याद रखें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## आगे पढ़ना

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) मौलिक पूर्व + संदर्भ दृष्टिकोण।
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) एम्बेडिंग आधारित कार्यघोड़ा।
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) संकुचित डिकोडिंग के साथ जनरेटिव ईएल।
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) बेंचमार्क पेपर।
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) खुले उत्पादन स्टैक।
