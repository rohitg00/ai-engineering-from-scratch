# भावनाओं का विश्लेषण

> शास्त्रीय पाठ वर्गीकरण के बारे में आपको जो कुछ जानना चाहिए वह यहाँ दिखाया गया है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## समस्या

"भोजन अच्छा नहीं था" सकारात्मक या नकारात्मक?

भावना सरल लगती है. एक समीक्षक ने कहा कि उन्हें कुछ पसंद आया या पसंद नहीं आया। वाक्य को लेबल करें। यह एक नैदानिक एनएलपी कार्य बन गया क्योंकि हर आसान दिखने वाला मामला एक कठिन को छिपाता है। नकारण अर्थ को उलट देता है। व्यंग्य इसे उलट देता है। दो नकारात्मक कोडित शब्दों के बावजूद "बिल्कुल बुरा नहीं" सकारात्मक है। इमोजी आसपास के पाठ की तुलना में अधिक संकेत ले जाते हैं। डोमेन शब्दावली के मामले (जिसमें कुछ भी शामिल नहीं है)`tight`संगीत समीक्षा में बनाम `tight`फैशन समीक्षा में) ।

भावनाएं क्लासिकल एनएलपी के लिए एक काम करने वाली प्रयोगशाला हैं। यदि आप समझते हैं कि प्रत्येक साफ़ आधार रेखा का एक विशिष्ट विफलता मोड क्यों है, तो आप समझते हैं कि प्रत्येक समृद्ध मॉडल का आविष्कार क्यों किया गया था। यह सबक खरोंच से एक साफ़ बेयज़ आधार रेखा बनाता है, लॉजिस्टिक प्रतिगमन जोड़ता है, और उन जालों का नाम देता है जो उत्पादन भावना को एक अनुपालन-ग्रेड समस्या बनाते हैं।

## अवधारणा

शास्त्रीय भावना दो चरणों का नुस्खा है।

1. **Represent.**पाठ को एक विशेषता वेक्टर में परिवर्तित करें।
2. **Classify.**लेबल वाले उदाहरणों पर रैखिक मॉडल (नईव बेय, लॉजिस्टिक रेग्रिशन, एसवीएम) को फिट करें।

बेयज़ बेयज़ सबसे बेवकूफ मॉडल है जो काम करता है। मान लें कि प्रत्येक विशेषता स्वतंत्र है लेबल दिया गया है। अनुमान`P(word | positive)`और `P(word | negative)`"असत्य" की स्वतंत्रता परिकल्पना हास्यास्पद रूप से गलत है और फिर भी परिणाम आश्चर्यजनक रूप से मजबूत हैं। कारणः दुर्लभ पाठ सुविधाओं और मध्यम डेटा के साथ, वर्गीकरणकर्ता को इस बात की परवाह है कि प्रत्येक शब्द किस तरफ झुका है।

लॉजिस्टिक रेग्रिशन स्वतंत्रता परिकल्पना को ठीक करता है। यह नकारात्मक भार सहित प्रत्येक विशेषता के लिए एक वजन सीखता है। `not good`बेयज़ नेविगेट नहीं कर सकते हैं कि यह कभी लेबल नहीं किया है कि के लिए बड़े ग्राम सुविधाओं के लिए.

```figure
sentiment-logits
```

## इसे बनाओ

### चरण 1: एक असली मिनी-डेटासेट

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

वास्तविक काम में हजारों उदाहरण (IMDb, SST-2, Yelp ध्रुवीयता) का उपयोग किया जाता है। गणित समान है।

### चरण 2: मल्टीनोमियल शून्य से बेयज़

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

अतिरिक्त चिकनाई (अल्फा = 1.0) लैपलेस चिकनाई है। इसके बिना, एक वर्ग में अदृश्य शब्द की संभावना शून्य है और लॉग विस्फोट होता है। `alpha=0.01`यह व्यवहार में आम है। `alpha=1.0`है शिक्षण डिफ़ॉल्ट.

### चरण 3: शून्य से लॉजिस्टिक प्रतिगमन

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

L2 नियमितता यहाँ मायने रखता है। पाठ विशेषताएं दुर्लभ हैं; L2 के बिना मॉडल प्रशिक्षण उदाहरणों को याद करता है।`0.01`और गाने.

### चरण 4: संभाल अस्वीकरण (विफलता मोड)

"अच्छा नहीं" और "बुरा नहीं" पर विचार करें। एक BoW वर्गीकरण देखता है।`{not, good}`और `{not, bad}`और प्रशिक्षण में जो भी अधिक दिखाई से सीखता है। एक बिग्राम वर्गीकरण देखता है`not_good`और `not_bad`और उन्हें अलग-अलग लक्षणों के रूप में सीखता है। यह आमतौर पर पर्याप्त है।

एक क्रूडर फिक्स जो काम करता है जब आप बिग्राम नहीं हैः **negation scoping**. एक नकारण शब्द के बाद पूर्ववर्ती टोकन के साथ `NOT_`अगले अंक तक।

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

अब`good`और `NOT_good`वे अलग-अलग विशेषताएं हैं। वर्गीकरणकर्ता उन्हें विपरीत वजन कर सकता है। पूर्व प्रसंस्करण, मापने योग्य सटीकता की तीन पंक्तियों से संवेदना बेंचमार्क पर कूद।

### चरण 5: महत्वपूर्ण मूल्यांकन माप

यदि कक्षाएं असंतुलित हैं तो केवल सटीकता ही भ्रामक है। वास्तविक भावनात्मक निकाय आमतौर पर 70-80% सकारात्मक या 70-80% नकारात्मक होते हैं; एक निरंतर बहुमत वर्गीकरण 80% सटीकता प्राप्त करता है और मूल्यहीन होता है। निम्नलिखित में से प्रत्येक की रिपोर्ट करेंः

- **Per-class precision and recall.**एक जोड़ी प्रति वर्ग, उन्हें एक एकल संख्या प्राप्त करने के लिए मैक्रो औसत है कि वर्ग संतुलन का सम्मान करता है.
- **Macro-F1 (primary metric for imbalanced data).**वर्गों के लिए F1 स्कोर का औसत, समान रूप से वजन किया गया। कक्षाओं के असंतुलन में सटीकता के बजाय इसका उपयोग करें।
- **Weighted-F1 (alternative).**मैक्रो के समान लेकिन वर्ग आवृत्ति द्वारा वजन। जब असंतुलन स्वयं व्यापारिक अर्थ है तो मैक्रो-एफ 1 के साथ रिपोर्ट करें।
- **Confusion matrix.**किसी भी स्केलर मीट्रिक पर भरोसा करने से पहले हमेशा जांच करें; यह पता चलता है कि मॉडल किस वर्ग की जोड़ी को भ्रमित करता है।
- **Per-class error samples.**प्रत्येक कक्षा में 5 गलत भविष्यवाणियों को खींचें. उन्हें पढ़ें. कुछ भी वास्तविक त्रुटियों को पढ़ने की जगह नहीं लेता है.

गंभीर रूप से असंतुलित आंकड़ों के लिए (> 95-5 अनुपात) रिपोर्ट **AUROC**और **AUPRC**AUPRC अल्पसंख्यक वर्ग के प्रति अधिक संवेदनशील है, जो कि आप आमतौर पर पर परवाह (स्पैम, धोखाधड़ी, दुर्लभ भावना) के बारे में है।

**Common bug to avoid.**असंतुलित डेटा पर मैक्रो-एफ1 के बजाय माइक्रो-एफ1 की रिपोर्ट करना एक ऐसा संख्या देता है जो उच्च प्रतीत होता है क्योंकि इसमें बहुमत वर्ग का वर्चस्व है। मैक्रो-एफ1 आपको अल्पसंख्यक वर्ग के प्रदर्शन को देखने के लिए मजबूर करता है।

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## इसका प्रयोग करें

स्किट-लर्न इसे छह पंक्तियों में करता है, सही है।

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

तीन बातें ध्यान देने योग्य हैं।`stop_words=None`नकारता रहता है।`ngram_range=(1, 2)`bigrams जोड़ा है तो `not good`एक विशेषता बन जाती है (स्किट-लर्न दो शब्दों को एक स्थान के साथ जोड़ता है) । `sublinear_tf=True`इन तीनों संकेतों से एसएसटी-2 पर 75% सटीक आधार रेखा और 85% सटीक आधार रेखा के बीच अंतर होता है।

### ट्रांसफार्मर की तलाश कब की जाए

- सरकस का पता लगाने, क्लासिक मॉडल विफलता यहाँ.
- लंबी समीक्षाएं जहां भावना मध्य-दस्तावेज में बदल जाती है।
- "कैमरा शानदार था लेकिन बैटरी भयानक थी". आपको केवल ट्रांसफार्मर या संरचित आउटपुट मॉडल के लिए भावना को पहलुओं को जिम्मेदार ठहराने की आवश्यकता है।
- गैर-अंग्रेजी, कम संसाधन वाली भाषाएँ। बहुभाषी BERT आपको शून्य शॉट मूल रेखा मुफ्त में देता है।

यदि आपको उपरोक्त में से किसी की आवश्यकता है, तो चरण 7 (ट्रांसफॉर्मर गहरे गोता लगाने) पर आगे बढ़ें। अन्यथा, टीएफ-आईडीएफ प्लस बिग्राम प्लस नकारण हैंडलिंग पर नाइव बेय या लॉजिस्टिक रेग्रेसशन आपकी 2026 उत्पादन आधार रेखा है।

### पुनरुत्पादकता जाल (फिर से)

भावनात्मक मॉडल को फिर से प्रशिक्षित करना नियमित है। उनका पुनर्मूल्यांकन नहीं है। कागजातों में रिपोर्ट किए गए सटीकता संख्याओं में विशिष्ट विभाजन, विशिष्ट प्रीप्रोसेसिंग, विशिष्ट टोकन बनाने वाले होते हैं। यदि आप अपने नए मॉडल की तुलना एक मूल लाइन के साथ करते हैं, तो आप एक ही पाइपलाइन का उपयोग किए बिना, आपको भ्रामक डेल्टा प्राप्त होंगे। हमेशा अपनी पाइपलाइन पर मूल लाइन को पुनर्जीवित करें, न कि कागज का नंबर।

## इसे भेजें

`outputs/prompt-sentiment-baseline.md`:

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## व्यायाम

1. **Easy.**जोड़ें `apply_negation`scikit-लर्न पाइपलाइन में एक पूर्व प्रसंस्करण चरण के रूप में और एक छोटे से भावना डेटा सेट पर F1 डेल्टा मापने।
2. **Medium.**वर्ग-वजनित लॉजिस्टिक रेग्रिशन (पास) को लागू करें`class_weight="balanced"`90-10 वर्ग के सिंथेटिक असंतुलन पर प्रभाव मापें।
3. **Hard.**संवेदना मॉडल के अवशेषों पर दूसरे वर्गीकरणकर्ता को प्रशिक्षित करके व्यंग्य निवेदक बनाएं। अपनी प्रयोगात्मक सेटिंग पर दस्तावेज बनाएं। जब आपकी सटीकता मौका से नीचे हो तो पाठक को चेतावनी दें (दो वर्ग के व्यंग्य पर संभावना स्तर ~ 50% है, और अधिकांश पहले प्रयास वहां उतरते हैं) ।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## आगे पढ़ना

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) मौलिक सर्वेक्षण. लंबा, लेकिन पहले चार खंड शास्त्रीय सब कुछ कवर करते हैं।
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) कागज जो बिग्राम + नाईव बेयज़ दिखाता है, उसे लघु पाठ पर हराया जाना मुश्किल है।
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) संदर्भ के लिए `CountVectorizer`,`TfidfVectorizer`, और हर बटन आप tune होगा.
