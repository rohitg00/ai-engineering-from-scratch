# संबंध निष्कर्षण और ज्ञान ग्राफ निर्माण

> एनईआर ने संस्थाओं को पाया। संस्था जोड़ने ने उन्हें एंकर किया। संबंध निष्कर्षण उनके बीच किनारों को ढूंढता है। एक ज्ञान ग्राफ नोड्स, किनारों और उनकी उत्पत्ति का योग है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## समस्या

एक विश्लेषक ने कहा, "टिम कुक 2011 में एप्पल के सीईओ बने।" चार तथ्यः

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

रिलेशन निष्कर्षण (RE) मुक्त पाठ को संरचित तिगुना में बदल देता है `(subject, relation, object)`एक corpus में संकलित करें और आपके पास एक ज्ञान ग्राफ है संकलित करें और पूछें और आपके पास RAG, विश्लेषण या अनुपालन लेखा परीक्षा के लिए तर्क आधार है।

2026 की समस्याः एलएलएम उत्साहपूर्वक संबंधों को निकालें। बहुत उत्साहपूर्वक। वे त्रिकोण को भंग करते हैं जो स्रोत पाठ समर्थन नहीं करता है। उत्पत्ति के बिना, आप यथार्थवादी कल्पना से वास्तविक त्रिकोण को नहीं बता सकते। 2026 का उत्तर एईवीएस शैली में एंकर-एंड-वेरिफिकेशन पाइपलाइन है।

## अवधारणा

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`. संबंध एक बंद ऑन्टोलॉजी (विकिडेटा गुण, FIBO, UMLS) या एक खुला सेट (OpenIE शैली, कुछ भी जाता है) से आते हैं।

**Three extraction approaches.**

1. **Rule / pattern-based.**हर्स्ट पैटर्नः "X जैसे Y" → `(Y, isA, X)`और हाथ से बना रेजेक्स, भंगुर, सटीक, स्पष्ट।
2. **Supervised classifier.**एक वाक्य में दो इकाई उल्लेखों को देखते हुए, एक निश्चित सेट से संबंध की भविष्यवाणी करें। TACRED, ACE, KBP पर प्रशिक्षित। मानक 20152022.
3. **Generative LLM.**मॉडल को तीनों को उत्सर्जित करने के लिए प्रेरित करें। यह बॉक्स से बाहर काम करता है। मूल की आवश्यकता है, या भ्रमों को सापेक्ष दिखने वाले कचरे।

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**वर्तमान भ्रम-शमन-शमन ढांचाः

- **Anchor.**प्रत्येक इकाई अवधि और संबंध-वक्तों अवधि को सटीक स्थानों के साथ पहचानें।
- **Extract.**एंकर स्पैन से जुड़े ट्रिपल उत्पन्न करें।
- **Verify.**प्रत्येक त्रिकोणीय तत्व को स्रोत पाठ के साथ मेल खाता है; असमर्थित किसी भी चीज़ को खारिज कर दें।
- **Supplement.**एक कवरेज पास यह सुनिश्चित करता है कि कोई लंगर span गिर नहीं जाता है।

भ्रामकता में तेजी से गिरावट आती है, अधिक गणना की आवश्यकता होती है, लेकिन यह लेखा परीक्षा योग्य है।

**The open-vs-closed tradeoff.**

- **Closed ontology.**फिक्स्ड प्रॉपर्टी लिस्ट (जैसे, विकिडाटा के 11,000+ प्रॉपर्टीज) । पूर्वानुमान योग्य। खोज योग्य। आविष्कार करना मुश्किल है।
- **Open IE.**किसी भी मौखिक वाक्यांश एक रिश्ते बन जाता है उच्च याददाश्त कम सटीकता, गड़बड़ पूछने के लिए.

उत्पादन केजी आमतौर पर मिश्रण करते हैंः खोज के लिए खुला आईई, फिर मुख्य ग्राफ में विलय से पहले एक बंद ऑंटोलॉजी पर संबंधों को कैनोनिकलाइज़ करें।

```figure
relation-triples
```

## इसे बनाओ

### चरण 1: पैटर्न आधारित निकासी

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

देखो`code/main.py`हर्स्ट पैटर्न अभी भी डोमेन विशिष्ट पाइपलाइन में जहाज क्योंकि वे डिबग करने योग्य हैं।

### चरण 2: पर्यवेक्षित अनुक्रमिक संबंध निकासी

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL एक BART आधारित seq2seq संबंध निकालनेः यह इकाई जोड़े वर्गीकृत करने के बजाय ट्रिपल उत्पन्न करता है। पाठ में, ट्रिपल आउट, संबंध नामों के साथ विकिडाटा गुणों से लिया गया है। डिकोड स्ट्रिंग अभी भी REBEL के साथ हैं `<triplet>`,`<subj>`और `<obj>`मार्कर, तो उन पर विभाजित (जैसा मॉडल कार्ड के पार्सर करता है) प्राप्त करने के लिए `(subject, relation, object)`रिकॉर्ड. दूर से निगरानी के डेटा पर ठीक से समायोजित. मानक खुला वजन आधार।

### चरण 3: एंकरिंग के साथ एलएलएम-प्रोम्प्ट निकासी

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

स्रोत के खिलाफ प्रत्येक लौटा स्पैन सत्यापित करें.`text[start:end] != triple_entity`यह एईवीएस "सत्यापित" कदम है अपने न्यूनतम रूप में.

### चरण 4: बंद ओंटोलॉजी पर कैनोनिकलाइज़ करें

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

कैनोनिकेशन अक्सर इंजीनियरिंग काम का 60-80% है। इसके लिए बजट।

### चरण 5: एक छोटे से ग्राफ और क्वेरी बनाएं

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

यह प्रत्येक आरएजी-ओवर-केजी प्रणाली का परमाणु है। इसे आरडीएफ ट्रिपल स्टोर (ब्लेजेग्राफ, वर्चुओसो), प्रॉपर्टी ग्राफ (नियो 4 जे) या वेक्टर-एगंस्ड ग्राफ स्टोर के साथ स्केल करें।

## फंदे

- **Coreference before RE.**"उसने एप्पल की स्थापना की"  RE को यह जानना होगा कि "उसने" कौन है। पहले कोरफ चलाएं (पाठ 24)
- **Entity canonicalization.**"Apple Inc" और "Apple" को एक ही नोड पर हल करना होगा। पहले इकाई को जोड़ना (पाठ 25) ।
- **Hallucinated triples.**एलएलएम तीन बार उत्सर्जन करता है पाठ समर्थन नहीं करता है। स्पैन सत्यापन लागू करें।
- **Relation canonicalization drift.**ओपन आईई संबंध असंगत हैं ("जन्म हुआ," "से आया," "निवासी है") । कैनोनिकल आईडी या ग्राफ में गिरावट अपरिहार्य है।
- **Temporal errors.**"टाइम कुक एप्पल के सीईओ हैं"  सच अब, झूठा 2005 में। कई रिश्ते समय सीमा के साथ हैं। योग्यता का उपयोग करें (`P580`प्रारंभ समय, `P582`विकिडाटा में अंत समय) ।
- **Domain mismatch.**रेबेल को विकिपीडिया पर प्रशिक्षित किया गया है। कानूनी, चिकित्सा और वैज्ञानिक पाठ को अक्सर डोमेन-अच्छी तरह से समायोजित RE मॉडल की आवश्यकता होती है।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

एकीकरण पैटर्नः NER → कोरफ → इकाई जोड़ने → संबंध निष्कर्षण → ओंटोलॉजी मैपिंग → ग्राफ लोड। प्रत्येक चरण एक संभावित गुणवत्ता गेट है।

## इसे भेजें

`outputs/skill-re-designer.md`:

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## व्यायाम

1. **Easy.**पैटर्न एक्सट्रैक्टर को चालू करें `code/main.py`5 समाचार लेख वाक्य पर. हाथ से जांच सटीकता.
2. **Medium.**एक ही वाक्य पर REBEL (या एक छोटा LLM) का उपयोग करें। तीन बार तुलना करें। कौन सा एक्सट्रैक्टर अधिक सटीक है? उच्च यादगार?
3. **Hard.**AEVS पाइपलाइन का निर्माण करेंः एलएलएम + के साथ निकालें स्रोत के खिलाफ स्पैन सत्यापित करें. 50 विकिपीडिया शैली के वाक्य पर सत्यापन चरण से पहले बनाम बाद में भ्रम दर मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## आगे पढ़ना

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) दूरस्थ निगरानी के लिए कागज।
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) अनुक्रम RE कार्य घोड़ा।
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) संयुक्त आईई।
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) 2026 में पगडंडी-मटाईकरण डिजाइन।
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) कैनोनिक ग्राफ क्वेरी।
