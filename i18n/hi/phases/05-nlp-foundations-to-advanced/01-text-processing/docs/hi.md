# पाठ प्रसंस्करण  टोकनकरण, स्टemming, लेमिटाइजेशन

> भाषा निरंतर है, मॉडल अलग हैं, पूर्व प्रसंस्करण पुल है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## समस्या

एक मॉडल " बिल्लियों दौड़ रहे थे" नहीं पढ़ सकता है. यह पूर्णांक पढ़ता है.

हर एनएलपी प्रणाली एक ही तीन प्रश्नों के साथ शुरू होती है. एक शब्द कहाँ से शुरू होता है. शब्द की जड़ क्या है. हम "चलने", "चलने", "चलने" को एक ही चीज के रूप में कैसे मानते हैं जब यह मदद करता है, और अलग चीजें जब यह नहीं करता है।

यदि आप गलत टोकनकरण करते हैं और मॉडल कचरे से सीखता है।`don't`एक टोकन के रूप में लेकिन `do n't`यदि आपके मतदाता गिर जाते हैं तो प्रशिक्षण वितरण विभाजित हो जाता है।`organization`और `organ`यदि आपका लेमिटायजर भाषण के संदर्भ का हिस्सा चाहता है लेकिन आप इसे पारित नहीं करते हैं, क्रियाओं को संज्ञाओं के रूप में माना जाता है।

यह सबक तीन पूर्व प्रसंस्करण चरणों को खरोंच से बनाता है, फिर दिखाता है कि NLTK और spaCy एक ही काम कैसे करते हैं ताकि आप व्यापार को देख सकें।

## अवधारणा

तीन ऑपरेशन, प्रत्येक में एक काम और एक विफलता मोड है।

**Tokenization**"टोकन" जानबूझकर अस्पष्ट है क्योंकि सही क्षुद्रता कार्य पर निर्भर करती है। क्लासिकल एनएलपी के लिए शब्द स्तर। ट्रांसफार्मर के लिए उपशब्द। सफेद स्थान के बिना भाषाओं के लिए चरित्र।

**Stemming**नियम के साथ प्रत्ययों को काटता है।`running -> run`. .`organization -> organ`. . दूसरा है विफलता मोड.

**Lemmatization**एक शब्द को व्याकरण ज्ञान का उपयोग करके अपने शब्दकोश के रूप में कम करता है। धीमी, सटीक, एक खोज तालिका या मॉर्फोलॉजिकल विश्लेषक की आवश्यकता होती है। `ran -> run`(जानने की जरूरत है "रन" "रन" के अतीत समय है।) `better -> good`(समान रूपों को जानने की आवश्यकता है) ।

अंगूठे का नियम. जब गति महत्वपूर्ण हो और आप शोर को सहन कर सकते हैं (खोज सूचकांक, कच्चे वर्गीकरण) । जब अर्थ महत्वपूर्ण हो (प्रश्न का उत्तर, अर्थपूर्ण खोज, उपयोगकर्ता जो कुछ भी पढ़ता है) ।

```figure
edit-distance
```

## इसे बनाओ

### चरण 1: एक रेजेक्स शब्द टोकनराइज़र

सबसे सरल उपयोगी टोकनराइज़र अपने टोकन के रूप में अंकन को बनाए रखते हुए गैर-अल्फान्यूमेरिक वर्णों पर विभाजित होता है। यह सही नहीं है, अंतिम नहीं है, लेकिन यह एक पंक्ति में चलता है।

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

तीन पैटर्न क्रमशः शब्द`don't`,`it's`) शुद्ध संख्याएँ। किसी भी एकल गैर-सफेद स्थान गैर-अल्फान्यूमेरिक वर्ण एक स्वतंत्र टोकन (बिन्दु) के रूप में।

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

विफलता मोड को नोटिस करने के लिए। `3pm` में विभाजित`['3', 'pm']`क्योंकि हम अक्षरों और अंकों के बीच बारी बारी। अधिकांश कार्यों के लिए पर्याप्त अच्छा है. URL, ईमेल, हैशटैग सभी टूट जाते हैं. उत्पादन के लिए, सामान्य से पहले पैटर्न जोड़ें.

### चरण 2: एक पोर्टर stemmer (केवल चरण 1a)

पूर्ण पोर्टर एल्गोरिथ्म में पांच चरणों के नियम हैं। केवल चरण 1 ए में सबसे अधिक अंग्रेजी प्रत्यय शामिल हैं और पैटर्न सिखाया जाता है।

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

नियमों को ऊपर से नीचे पढ़ें।`ies -> i`नियम है क्यों`ponies -> poni`नहीं`pony`असली पोर्टर के पास कदम 1 बी है जो इसे ठीक करेगा नियम प्रतिस्पर्धा करते हैं पहले के नियम जीतते हैं आदेश किसी भी नियम से अधिक मायने रखता है

### चरण 3: खोज आधारित लेमेटाइज़र

लम्माकरण के लिए एक प्रकार की संरचना आवश्यक है। एक व्यवहार्य शिक्षण संस्करण में एक छोटी लम्मा तालिका और एक पतन का उपयोग किया जाता है।

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

अंतिम मामला महत्वपूर्ण शिक्षण क्षण है।`watched`हमारे मेज पर नहीं है और हमारे पतन केवल संभालता है `ing`. वास्तविक लमटाइजेशन कवर करता है `ed`, अनियमित क्रिया, तुलनात्मक विशेषण, ध्वनि परिवर्तन वाले बहुवचन (`children -> child`) इसीलिए उत्पादन प्रणालियों में WordNet, spaCy का मॉर्फोलॉजिज़र या पूर्ण मॉर्फोलॉजिकल एनालिज़र का उपयोग किया जाता है।

### चरण 4: उन्हें एक साथ पाइप करें

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

यह एक पीओएस टैगर है। चरण 5 · 07 (पीओएस टैगिंग) एक बनाता है। अभी के लिए, डिफ़ॉल्ट रूप से सब कुछ करने के लिए `NOUN`और सीमाओं को स्वीकार करें।

## इसका प्रयोग करें

NLTK और spaCy उत्पादन संस्करणों जहाज. कुछ लाइनों प्रत्येक.

### एनएलटीके

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize`संकुचन, यूनिकोड, किनारे मामलों को संभालने के लिए अपने Regex याद आती है। `PorterStemmer`सभी पांच चरणों में चलाता है।`WordNetLemmatizer`NLTK के Penn Treebank योजना से WordNet के संक्षिप्त संक्षिप्त सेट में अनुवादित POS टैग की आवश्यकता है। ऊपर अनुवाद तारों अधिकांश ट्यूटोरियल छोड़ने के लिए थोड़ा है।

### स्पाइसी

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

spaCy पूरे पाइपलाइन के पीछे छिपाता है `nlp(text)`. टोकन, पीओएस टैगिंग, और लेमिटाइजेशन सभी चल रहे हैं. NLTK से तेज पैमाने पर. बॉक्स से अधिक सटीक. समझौता यह है कि आप आसानी से व्यक्तिगत घटकों को आदान-प्रदान नहीं कर सकते हैं.

### कौन सी चुनना है

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### दो विफलता मोड कोई भी आपको चेतावनी नहीं देता

अधिकांश ट्यूटोरियल एल्गोरिदम को सिखाते हैं और रुकते हैं. दो चीजें एक वास्तविक प्रीप्रोसेसिंग पाइपलाइन काटती हैं, और वे लगभग कभी कवर नहीं होते हैं।

**Reproducibility drift.**NLTK और spaCy संस्करणों के बीच टोकनकरण और lemmatizer व्यवहार को बदलते हैं।`['do', "n't"]`spaCy 2.x में उत्पादन कर सकता है `["don't"]`3.x में. आपका मॉडल एक वितरण पर प्रशिक्षित किया गया था. इन्फेरेंस अब एक अलग पर चल रहा है. सटीकता चुपचाप गिरावट और कोई नहीं जानता क्यों.`requirements.txt`. एक पूर्व प्रसंस्करण regression परीक्षण लिखें जो 20 नमूना वाक्य की अपेक्षित टोकनकरण को फ्रीज करता है. इसे प्रत्येक उन्नयन पर चलाएं.

**Training / inference mismatch.**आक्रामक पूर्व-संसाधित (कम अक्षर, स्टॉपवर्ड हटाने, स्टemming) के साथ प्रशिक्षित करें, कच्चे उपयोगकर्ता इनपुट पर तैनात करें, घड़ी प्रदर्शन क्रेटर। यह सबसे आम उत्पादन एनएलपी विफलता है। यदि आप प्रशिक्षण के दौरान पूर्व-संसाधित करते हैं, तो आपको निष्कर्ष के दौरान समान कार्य करना चाहिए। मॉडल पैकेज के अंदर एक कार्य के रूप में पूर्व-संसाधित जहाज, न कि एक नोटबुक सेल के रूप में सेवा टीम को फिर से लिखता है।

## इसे भेजें

एक पुनः प्रयोज्य संकेत जो इंजीनियरों को तीन पाठ्यपुस्तकों को पढ़ने के बिना एक पूर्व-प्रक्रिया रणनीति चुनने में मदद करता है।

`outputs/prompt-preprocessing-advisor.md`:

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## व्यायाम

1. **Easy.**विस्तार `tokenize`यूआरएल को एकल टोकन के रूप में रखने के लिए।`tokenize("Visit https://example.com today.")`एक URL टोकन उत्पन्न करना चाहिए।
2. **Medium.**Porter चरण 1b को लागू करें यदि किसी शब्द में स्वर होता है और अंत में `ed`या `ing`दोहरे व्यंजन नियम को संभाल (`hopping -> hop`नहीं`hopp`) ।
3. **Hard.**एक lemmatizer बनाएँ जो WordNet का उपयोग करता है एक खोज तालिका के रूप में लेकिन आपके Porter voters पर वापस गिर जाता है जब WordNet कोई प्रविष्टि नहीं है. सादे WordNet और सादे Porter के खिलाफ टैग किए गए corpus पर सटीकता मापें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## आगे पढ़ना

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) मूल पेपर, पांच पृष्ठ, अभी भी सबसे स्पष्ट स्पष्टीकरण।
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) कैसे एक वास्तविक पाइपलाइन के तारों है।
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) टोकनकरण किनारे मामलों आप अभी तक नहीं सोचा है.
