# नामित इकाई पहचान

> जब तक आप अस्पष्ट सीमाओं, घोंसले हुए संस्थाओं और डोमेन जार्गोन से निपट नहीं लेते तब तक नामों को बाहर निकालें।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## समस्या

"Apple ने Google को अपने iPhone खोज सौदे पर अमेरिका में मुकदमा दायर किया।" पांच संस्थाएंः Apple (ORG), Google (ORG), iPhone (PRODUCT), खोज सौदा (शायद), US (GPE) । एक अच्छी NER प्रणाली उन्हें सभी को सही प्रकार के साथ निकालती है। एक बुरा iPhone याद करता है, Apple को Apple कंपनी के साथ भ्रमित करता है, और "US" को PERSON के रूप में लेबल करता है।

एनईआर हर संरचित निष्कर्षण पाइपलाइन के नीचे काम का घोड़ा है. पुनरीक्षण विश्लेषण, अनुपालन लॉग स्कैन, चिकित्सा रिकॉर्ड अनामिकरण, खोज क्वेरी समझ, चैटबॉट प्रतिक्रियाओं के लिए ग्राउंडिंग, कानूनी अनुबंध निष्कर्षण। आप इसे कभी नहीं देखते हैं; आप हमेशा इस पर निर्भर करते हैं।

यह पाठ शास्त्रीय पथ (नियम आधारित, एचएमएम, सीआरएफ) को आधुनिक पथ (बीएलएसटीएम-सीआरएफ, फिर ट्रांसफार्मर) में ले जाता है। प्रत्येक चरण इससे पहले की एक विशिष्ट सीमा को हल करता है। पैटर्न सबक है।

## अवधारणा

**BIO tagging**(या BILOU) इकाई निकासी को एक अनुक्रम लेबलिंग समस्या में बदल देता है। प्रत्येक टोकन को `B-TYPE`(संस्था की शुरुआत), `I-TYPE`(आंतरिक इकाई), या `O`(किसी भी इकाई के बाहर) ।

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

बहु-टोकन संस्थाओं की श्रृंखलाः `New B-GPE`,`York I-GPE`,`City I-GPE`. एक मॉडल जो बायो को समझता है मनमानी स्पैन निकाल सकता है.

वास्तुकला प्रगति:

- **Rule-based.**रेजेक्स + गजटियर खोजें. ज्ञात संस्थाओं पर उच्च सटीकता, नए पर शून्य कवरेज।
- **HMM.**छिपे हुए मार्कोव मॉडल, दिए गए टोकन टैग की उत्सर्जन संभावना, टैग-टू-टैग संक्रमण संभावना, विटरबी डिकोड, लेबल किए गए डेटा पर प्रशिक्षित।
- **CRF.**सशर्त यादृच्छिक क्षेत्र। एचएमएम की तरह लेकिन भेदभावपूर्ण, ताकि आप मनमाने ढंग से सुविधाओं (शब्द आकार, पूंजीकरण, पड़ोसी शब्दों) को मिला सकते हैं। अभी भी 2026 में कम संसाधन तैनाती के लिए क्लासिक उत्पादन कार्यघोड़ा।
- **BiLSTM-CRF.**तंत्रिका सुविधाओं के बजाय हाथ से बनाई गई। LSTM वाक्य दोनों दिशाओं में पढ़ता है, CRF परत ऊपर लगातार टैग अनुक्रमों को लागू करता है।
- **Transformer-based.**एक टोकन वर्गीकरण सिर के साथ बारीक-ट्यूनिंग BERT. सबसे अच्छी सटीकता. सबसे गणना.

```figure
ner-bio-tagging
```

## इसे बनाओ

### चरण 1: बायो टैगिंग सहायक

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### चरण 2: हस्तनिर्मित विशेषताएं

क्लासिक (गैर-न्यूरल) एनईआर के लिए, विशेषताएं खेल हैं। उपयोगी हैंः

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`रिटर्न `xXxxxx`. .`word_shape("USA-2024")`रिटर्न `XXX-dddd`. पूँजीकरण पैटर्न उचित संज्ञाओं के लिए उच्च संकेत हैं.

### चरण 3: सरल नियम आधारित + शब्दकोश आधार

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

उत्पादन गजटर्स में विकिपीडिया और डीबीपीडिया से लाखों प्रविष्टियां स्क्रैप की गई हैं। कवरेज अच्छा है।`Apple`यह भयानक है। यही कारण है कि सांख्यिकीय मॉडल जीत गए।

### चरण 4: सीआरएफ चरण (स्केच, पूर्ण इंप्ल नहीं)

50 पंक्तियों में खरोंच से पूर्ण सीआरएफ संभावना सिद्धांत के आधार के बिना प्रकाश नहीं है। उपयोग `sklearn-crfsuite`इसके बजायः

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`और `c2`L1 और L2 नियमितता है। `all_possible_transitions=True`मॉडल अवैध अनुक्रमों को सीखने देता है (जैसे, `I-ORG`के बाद`O`) संभावना नहीं है, जो कि बिना आप प्रतिबंध लिखने के लिए एक CRF जैव स्थिरता लागू करता है।

### चरण 5: BiLSTM-CRF क्या जोड़ता है

विशेषताएं सीख जाती हैं। इनपुटः टोकन एम्बेडिंग (ग्लोवे या फास्टटेक्स) । LSTM बाएं से दाएं और दाएं से बाएं पढ़ता है। संकीर्ण छिपे हुए राज्य CRF आउटपुट परत के माध्यम से जाते हैं। CRF अभी भी टैग-अनुक्रम सुसंगतता को लागू करता है; LSTM सीखने वाले लोगों के साथ हस्तनिर्मित सुविधाओं को बदल देता है।

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

सीआरएफ परत के लिए प्रयोग करें `torchcrf.CRF`हाथ से बनाई गई सीआरएफ पर लाभ मापने योग्य है लेकिन आप उम्मीद से कम है जब तक आप दसियों हजार लेबल वाक्य है।

## इसका प्रयोग करें

spaCy उत्पादन-ग्रेड NER जहाजों को बॉक्स से बाहर निकालता है।

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

ध्यान दें `iPhone`लेबल`ORG``PRODUCT` spaCy के छोटे मॉडल में उत्पाद इकाई कवरेज कमजोर है।`en_core_web_lg`) बेहतर है। ट्रांसफार्मर मॉडल (`en_core_web_trf`) और भी बेहतर है।

BERT आधारित NER के लिए गले लगाना चेहराः

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`इसके बिना, आप टोकन स्तर लेबल मिलता है और खुद को मिलाया जाना है.

### LLM आधारित NER (2026 विकल्प)

शून्य-शॉट और कुछ-शॉट एलएलएम एनईआर अब कई डोमेन पर ठीक-ठीक मॉडल के साथ प्रतिस्पर्धी है, और जब लेबल डेटा दुर्लभ है तो नाटकीय रूप से बेहतर है।

- **Zero-shot prompting.**एमएलएम को इकाई प्रकारों की सूची और एक उदाहरण योजना दें। JSON आउटपुट के लिए पूछें। बॉक्स से बाहर काम करता है; नवीन डोमेन पर सटीकता मध्यम है।
- **ZeroTuneBio-style prompting.**एक बहु-चरण प्रम्प्ट (एक शॉट नहीं) जैव चिकित्सा एनईआर पर सटीकता को काफी बढ़ाता है। कानूनी, वित्तीय और वैज्ञानिक क्षेत्रों के लिए एक ही पैटर्न काम करता है।
- **Dynamic prompting with RAG.**प्रत्येक निष्कर्ष कॉल के लिए एक छोटे से टिप्पणी वाले बीज सेट से सबसे समान लेबल वाले उदाहरण प्राप्त करें; उड़ान में कुछ-शॉट प्रॉम्प्ट बनाएं। 2026 बेंचमार्क में, यह स्थैतिक प्रॉम्प्ट से 11-12% बढ़ जाता है।
- **Per-entity-type decomposition.**लंबे दस्तावेजों के लिए, एक एकल कॉल जो एक ही समय में सभी इकाई प्रकारों को निकालता है, लंबाई बढ़ने के साथ याद करना खो देता है। प्रति इकाई प्रकार एक निष्कर्षण पास चलाएं। उच्च निष्कर्ष लागत, काफी अधिक सटीकता। यह नैदानिक नोट्स और कानूनी अनुबंधों के लिए मानक पैटर्न है।

2026 से उत्पादन की सिफारिशः प्रशिक्षण डेटा एकत्र करने से पहले एलएलएम शून्य शॉट बेसलाइन से शुरू करें। अक्सर एफ 1 पर्याप्त अच्छा होता है कि आपको कभी भी ठीक करने की आवश्यकता नहीं होती है।

### जहां क्लासिकल एनईआर अभी भी जीतता है

यहां तक कि LLM उपलब्ध होने पर भी, क्लासिकल NER तब जीतता है जबः

- विलंबता बजट 50ms से नीचे है।
- आपके पास हजारों लेबल वाले उदाहरण हैं और आपको 98% + F1 की आवश्यकता है।
- डोमेन में एक स्थिर ओंटोलॉजी है जहां पूर्व प्रशिक्षित CRF या BiLSTM अच्छी तरह से स्थानांतरित होता है।
- नियामक प्रतिबंधों के लिए एक स्थानीय, गैर-जनकारी मॉडल की आवश्यकता होती है।

### जहां यह टूट जाता है

- **Domain shift.**कानूनी अनुबंधों पर CoNLL प्रशिक्षित NER एक राजपत्रकार से भी बदतर प्रदर्शन करता है.
- **Nested entities.**"बैंक ऑफ अमेरिका टॉवर" एक ही समय में एक ORG और एक सुविधा है। मानक बायो ओवरलैप स्पैन का प्रतिनिधित्व नहीं कर सकता है। आपको घोंसले हुए NER (मल्टी-पास या स्पैन-आधारित मॉडल) की आवश्यकता है।
- **Long entities.**"संयुक्त राज्य अमेरिका के संघीय जमा बीमा निगम. " टोकन स्तर के मॉडल कभी कभी इस विभाजित. उपयोग `aggregation_strategy`या प्रक्रिया के बाद।
- **Sparse types.**चिकित्सा NER लेबल जैसे DRUG_BRAND, ADVERSE_EVENT, DOSE. सामान्य प्रयोजन के मॉडल का कोई विचार नहीं है। Scispacy और BioBERT वहां प्रारंभिक बिंदु हैं।

## इसे भेजें

`outputs/skill-ner-picker.md`:

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## व्यायाम

1. **Easy.**कार्यान्वयन`bio_to_spans`(उपवर्जित `spans_to_bio`) और 10 वाक्य पर वापसी-यात्रा सुसंगतता की जांच करें।
2. **Medium.**CoNLL-2003 अंग्रेजी NER डेटासेट पर ऊपर के sklearn-crfsuite CRF को प्रशिक्षित करें।`seqeval`. सामान्य परिणाम: ~ 84 F1.
3. **Hard.**ठीक-ठीक `distilbert-base-cased`एक डोमेन-विशिष्ट एनईआर डेटासेट (चिकित्सा, कानूनी या वित्तीय) पर। spaCy छोटे मॉडल की तुलना करें। दस्तावेज़ डेटा रिसाव जांचें और आपको क्या आश्चर्यचकित किया है लिखें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## आगे पढ़ना

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) BiLSTM-CRF पेपर।
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) टोकन-वर्गीकरण पैटर्न को पेश करता है जो मानक बन गया।
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) प्रत्येक विशेषता के लिए व्यावहारिक संदर्भ `Doc.ents`और `Span`. .
- [seqeval](https://github.com/chakki-works/seqeval) सही मीट्रिक लाइब्रेरी। हमेशा इसका इस्तेमाल करें।
