# पीओएस टैगिंग और सिंटैक्टिक पार्सिंग

> व्याकरण कुछ समय के लिए फैशन से बाहर था, फिर हर LLM पाइपलाइन को संरचित निष्कर्षण को मान्य करने की आवश्यकता थी, और यह वापस आया।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## समस्या

पाठ 01 वादा किया कि lemmatization एक भाग-से-भाषण टैग की जरूरत है. बिना पता के.`running`एक क्रिया है, एक lemmatizer इसे कम नहीं कर सकते `run`. बिना जाने .`better`एक विशेषण है, यह कम नहीं किया जा सकता है`good`. .

इस वादे ने एक पूरा उपक्षेत्र छिपाया। भाषण के भाग टैगिंग व्याकरणिक श्रेणियों को सौंपता है। वाक्य की वृक्ष संरचना को पुनः प्राप्त करता है। कौन सा शब्द किस तर्क को संशोधित करता है, कौन सा क्रिया किस तर्क को नियंत्रित करता है। शास्त्रीय एनएलपी ने दोनों को परिष्कृत करने में बीस साल बिताए। फिर गहन सीखने ने उन्हें पूर्व-प्रशिक्षित ट्रांसफार्मर के शीर्ष पर एक टोकन वर्गीकरण कार्य में ढह दिया, और शोध समुदाय आगे बढ़ा।

लागू समुदाय नहीं। प्रत्येक संरचित निष्कर्षण पाइपलाइन अभी भी हुड के नीचे पीओएस और निर्भरता पेड़ों का उपयोग करती है। एलएलएम-जनरेट किए गए जेएसओएन व्याकरणिक बाधाओं के खिलाफ मान्य हो जाते हैं। प्रश्न-उत्तर प्रणाली निर्भरता पार्स का उपयोग करके क्वेरी को तोड़ती है। मशीन अनुवाद गुणवत्ता मूल्यांकनकर्ता पार्स पेड़ों की संरेखण की जांच करते हैं।

यह सबक टैगसेट, बेसलाइन और उस बिंदु को पेश करता है जहां आप खरोंच से लागू करना बंद कर देते हैं और स्पेससाइ कहते हैं।

## अवधारणा

**POS tagging**प्रत्येक टोकन को व्याकरणिक श्रेणी के साथ लेबल करता है।**Penn Treebank (PTB)**टैगसेट अंग्रेजी डिफ़ॉल्ट है। 36 अलग-अलग टैग के साथ आकस्मिक पाठक को परेशान लगता हैः `NN`एकल संज्ञा, `NNS`बहुवचन संज्ञा, `NNP`विशेष संज्ञा एकल, `VBD`क्रिया अतीत समय, `VBZ`क्रिया 3rd person singular present, और इसी तरह।**Universal Dependencies (UD)**टैगसेट अधिक कठोर (17 टैग) और भाषा-अज्ञानी है; यह क्रॉस-लिंग्वेज वर्क के लिए डिफ़ॉल्ट बन गया।

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**दो प्रमुख शैलीः

- **Constituency parsing.**संज्ञा वाक्यांश, क्रिया वाक्यांश, पूर्वावचन वाक्यांश एक दूसरे के अंदर घोंसले हैं। आउटपुट गैर-समायोजन श्रेणियों (NP, VP, PP) का एक पेड़ है जिसमें शब्द पत्तियों के रूप में होते हैं।
- **Dependency parsing.**प्रत्येक शब्द में एक ही शीर्षक शब्द होता है जिस पर यह निर्भर करता है, जिसे व्याकरणिक संबंध के साथ लेबल किया जाता है। आउटपुट एक ऐसा पेड़ है जहां प्रत्येक किनारा एक (मुख, निर्भर, संबंध) ट्रिपल है।

निर्भरता विश्लेषण 2010 के दशक में जीता क्योंकि यह भाषाओं में स्पष्ट रूप से सामान्यीकरण करता है, विशेष रूप से मुक्त शब्द क्रम वाले।

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## इसे बनाओ

### चरण 1: सबसे अधिक बार टैग की आधार रेखा

सबसे बेवकूफ POS टैगर जो काम करता है. प्रत्येक शब्द के लिए, यह टैग भविष्यवाणी यह प्रशिक्षण में सबसे अधिक बार था.

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

ब्राउन कॉर्पस पर, यह मूल रेखा लगभग 85% सटीकता तक पहुंचती है। अच्छा नहीं, लेकिन तल जिसके नीचे कोई गंभीर मॉडल नहीं गिरना चाहिए।

### चरण 2: बिग्राम एचएमएम टैगर

अनुक्रम की संयुक्त संभावना का मॉडलः

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

दो तालिकाएंः संक्रमण संभावनाएं (पूर्ववर्ती टैग दिए गए टैग) , उत्सर्जन संभावनाएं (शब्द दिए गए टैग) । लैपलेस चिकनाई के साथ गणना से दोनों का अनुमान लगाएं। विटरबी (टैग जाली पर गतिशील प्रोग्रामिंग) के साथ डिकोड करें।

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

ब्राउन पर बिग्राम एचएमएम ~93% सटीकता तक पहुंचता है। 85% से 93% की छलांग ज्यादातर संक्रमण संभावनाओं है  मॉडल सीखता है `DET NOUN`आम है और `NOUN DET`दुर्लभ है।

### चरण 3: क्यों आधुनिक टैगर्स इसे हरा

संक्रमण + उत्सर्जन संभावनाएं स्थानीय हैं। वे यह नहीं पकड़ सकते।`saw`"मैंने एक पीतल खरीदी" में एक संज्ञा है लेकिन "मैंने फिल्म देखी।" एक आरसीएफ जिसमें मनमाने ढंग से विशेषताएं (सफल, शब्द का आकार, शब्द से पहले और बाद में, शब्द स्वयं) होती हैं ~97%. एक बीएलएसटीएम-सीआरएफ या ट्रांसफार्मर ~98% + होती है।

इस कार्य पर सीमा नोटर मतभेद द्वारा निर्धारित की जाती है। मानव नोटर्स पेन ट्रीबैंक पर लगभग 97% समय पर सहमत होते हैं। 98% से अधिक मॉडल शायद परीक्षण सेट से अधिक फिट होते हैं।

### चरण 4: निर्भरता विश्लेषण स्केच

पूर्ण निर्भरता को खरोंच से विश्लेषण करने के लिए दायरे से बाहर है; कैनोनिक पाठ्यपुस्तक उपचार जुराफस्की और मार्टिन में है। दो शास्त्रीय परिवारों को जानने के लिएः

- **Transition-based**पार्सर (आर्क-आकांक्षी, आर्क-मानक) एक शिफ्ट-रिड्यूस पार्सर की तरह कार्य करते हैंः वे टोकन पढ़ते हैं, उन्हें एक स्टैक पर स्थानांतरित करते हैं, और कम करने वाली कार्रवाई लागू करते हैं जो आर्क बनाते हैं। लालची डिकोडिंग तेज है। क्लासिक कार्यान्वयन माल्ट पार्सर है। आधुनिक तंत्रिका संस्करणः चेन और मैनिंग का संक्रमण-आधारित पार्सर।
- **Graph-based**पारसर्स (एस्नर के एल्गोरिथ्म, डोज़ैट-मैनिंग बीएफिन) हर संभव सिर-निर्भर किनारे को स्कोर करते हैं और अधिकतम विस्तार वाले पेड़ का चयन करते हैं। धीमी लेकिन अधिक सटीक।

अधिकांश कार्य के लिए, spaCy पर कॉल करेंः

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

`dep`स्तंभ नीचे से ऊपर और वाक्य की व्याकरण संरचना गिर जाता है।

## इसका प्रयोग करें

प्रत्येक उत्पादन एनएलपी पुस्तकालय एक मानक पाइपलाइन के हिस्से के रूप में पीओएस और निर्भरता पार्सर भेजता है।

- **spaCy**(`en_core_web_sm`/`md`/`lg`/`trf`) तेजी से, सटीक, टोकनकरण + एनईआर + लेमिटाइजेशन के साथ एकीकृत। `token.tag_`(पिन), `token.pos_`(यूडी), `token.dep_`(निर्भरता संबंध) ।
- **Stanford NLP (stanza)**. स्टैनफोर्ड के उत्तराधिकारी कोरएनएलपी. 60 से अधिक भाषाओं पर अत्याधुनिक.
- **trankit**ट्रांसफार्मर आधारित, अच्छी UD सटीकता.
- **NLTK**. .`pos_tag`उपयोग करने योग्य, धीमी, पुरानी, शिक्षण के लिए अच्छा।

### जहां यह अभी भी 2026 में मायने रखता है

- **Lemmatization.**पाठ 01 को सही ढंग से लेमेटिज़ करने के लिए POS की आवश्यकता है. हमेशा.
- **Structured extraction from LLM outputs.**सत्यापित करें कि उत्पन्न वाक्य व्याकरणिक प्रतिबंधों का सम्मान करता है (जैसे, विषय-क्रिया अनुबंध, आवश्यक संशोधन) ।
- **Aspect-based sentiment.**निर्भरता पार्स आपको बताता है कि कौन सा विशेषण कौन सा संज्ञा बदलता है।
- **Query understanding.**"वेस एंडरसन द्वारा निर्देशित और बिल मरे के साथ फिल्में" विश्लेषण के माध्यम से संरचित प्रतिबंधों में विघटित हो जाती हैं।
- **Cross-lingual transfer.**यूडी टैग और निर्भरता संबंध भाषा-अज्ञानी हैं, जिससे नई भाषाओं का शून्य-शॉट संरचित विश्लेषण संभव होता है।
- **Low-compute pipelines.**यदि आप एक ट्रांसफार्मर नहीं भेज सकते हैं, तो POS + निर्भरता पार्स + गजटरेटर आपको आश्चर्यजनक रूप से दूर ले जाता है।

## इसे भेजें

`outputs/skill-grammar-pipeline.md`:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## व्यायाम

1. **Easy.**छोटे टैग किए गए कॉर्पस (जैसे, एनएलटीके का ब्राउन उपसमूह) पर सबसे अधिक बार टैग किए गए बेसलाइन का उपयोग करके, अटके हुए वाक्य पर सटीकता मापें। ~ 85% परिणाम की पुष्टि करें।
2. **Medium.**ऊपर दिए गए बिग्राम एचएमएम को प्रशिक्षित करें और प्रति टैग सटीकता/हवालात की रिपोर्ट करें। एचएमएम कौन से टैग को सबसे अधिक भ्रमित करता है?
3. **Hard.**1000 वाक्य के नमूने से विषय-क्रिया-वस्तु त्रिगुट निकालने के लिए spaCy के निर्भरता विश्लेषण का उपयोग करें। 50 मैन्युअल रूप से लेबल किए गए त्रिगुट पर मूल्यांकन करें। दस्तावेज जहां निष्कर्षण विफल होता है (अक्सर निष्क्रिय, समन्वय और हटाए गए विषय) ।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## आगे पढ़ना

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) POS और पार्सिंग के लिए कैनोनिक पाठ्यपुस्तक उपचार।
- [Universal Dependencies project](https://universaldependencies.org/) प्रत्येक बहुभाषी पार्सर द्वारा उपयोग किए जाने वाले बहुभाषी टैगसेट और ट्रीबैंक संग्रह।
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) प्रत्येक विशेषता के लिए व्यावहारिक संदर्भ जो `Token`. .
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) पेपर जो न्यूरल पार्सर को मुख्यधारा में लाया।
