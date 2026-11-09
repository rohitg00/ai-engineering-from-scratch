# ट्रांसफार्मर से पहले पाठ पीढ़ी  N-ग्राम भाषा मॉडल

> यदि कोई शब्द आश्चर्यजनक है, तो मॉडल बुरा है. भ्रम एक संख्या को आश्चर्यचकित करता है. चिकनाई इसे अंतहीन रखती है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## समस्या

ट्रांसफार्मर से पहले, आरएनएन से पहले, शब्द एम्बेडिंग से पहले, एक भाषा मॉडल ने अगले शब्द की भविष्यवाणी की, यह गिनकर कि यह पिछले शब्द के बाद कितनी बार होता है `n-1`शब्द. "मक्खी" → "बैठा" 47 बार गिनें, "मक्खी" → "उड़ गया" 12 बार, "मक्खी" → "फ्रिजरेटर" 0 बार. एक संभावना वितरण प्राप्त करने के लिए सामान्यीकरण.

यह एक n-ग्राम भाषा मॉडल है. यह 1980 से 2015 तक हर भाषण पहचानकर्ता, हर वर्तनी जांचकर्ता और हर वाक्यांश आधारित मशीन अनुवाद प्रणाली चलाता है. यह अभी भी तब चलता है जब आपको सस्ते डिवाइस पर भाषा मॉडलिंग की आवश्यकता होती है.

दिलचस्प समस्या यह है कि अदृश्य n-ग्राम के बारे में क्या करना है। एक कच्चे गिनती-आधारित मॉडल किसी भी चीज़ को शून्य संभावना देता है जिसे उसने नहीं देखा है, जो विनाशकारी है क्योंकि वाक्य लंबे हैं और लगभग हर लंबे वाक्य में कम से कम एक अदृश्य अनुक्रम होता है। पचास साल के चिकनाई अनुसंधान ने इसे तय किया। Kneser-Ney चिकनाई इसका परिणाम है, और आधुनिक गहरी शिक्षा ने अपनी अनुभवजन्य परंपरा को विरासत में दिया।

## अवधारणा

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### भविष्यवाणी खेल

इस तरह की कोई भी मशीन मौजूद होने से पहले, एक प्रयोग में भाषा मॉडल क्या है, यह परिभाषित किया गया था। अंग्रेजी वाक्य के अगले अक्षर को कवर करें। किसी से यह अनुमान लगाने के लिए कहें, एक समय में एक अनुमान, जब तक वे इसे सही नहीं करते। अनुमान संख्या लिखें। कुछ सौ अक्षरों के लिए दोहराएं।

अनुमान गणना कोई मामूली बात नहीं है. वे पाठ का एक निर्दोष पुनः एन्कोडिंग हैं: गणना अनुक्रम को दूसरे, समान अनुमानकर्ता को सौंपें और वे प्रत्येक अक्षर को पुनः निर्माण कर सकते हैं, क्योंकि प्रत्येक स्थिति में वे ठीक से जानते हैं कि कौन से अनुमान पहले आते हैं। एक संदेश जिसे आप कम प्रतीकों में पुनः एन्कोड कर सकते हैं, प्रति प्रतीक कम जानकारी ले जाता है, इसलिए अनुमान संख्या सांख्यिकी अंग्रेजी के एंट्रॉपिया पर एक छत डालती है।

शैनन ने 1951 में यह किया और एक संख्या प्राप्त की जो अभी भी क्षेत्र को नियंत्रित करती है। एक 27 प्रतीक वर्णमाला (26 अक्षर प्लस स्पेस) ले जा सकता है।`log2(27) ≈ 4.75`एक मॉडल को सीखने के लिए आवश्यक संरचना को किसी भी मॉडल को सीखने से पहले मापा जाता है।

इस खेल का प्रत्येक भाषा मॉडल एक यांत्रिक खिलाड़ी है, और इस पाठ में प्रत्येक मूल्यांकन संख्या स्कोर किया गया खेल हैः

- **Cross-entropy loss**एक LM को प्रशिक्षित करने से अनुमान लगाने के खेल में उसके स्कोर को कम किया जा रहा है।
- **Perplexity**है `2^bits`(या `e^nats`): मॉडल के अनुमान के बाद भी शाखा कारक का सामना करना पड़ता है। 27 प्रतीकों पर एक समान अनुमानित है; एक 1-बिट प्रति अक्षर खिलाड़ी में 2 है।
- **Context length is the player's memory.**एक त्रिकोण मॉडल दो मेमोरी टोकन के साथ खेलता है. एक ट्रांसफार्मर 100K टोकन के साथ एक ही खेल खेलता है. नियम कभी नहीं बदला; खिलाड़ी बेहतर हो गया।

ट्रैक पर एक इकाई स्विचः प्रति अक्षर बिट्स में खेल स्कोर (`log2`), जबकि नीचे दिए गए n-ग्राम सूत्रों में प्रति शब्द टोकन में nats (प्राकृतिक लॉग)  और चूंकि उलझन `e^H`नाट्स में बराबर `2^H`बिट्स में, दो दृश्य अलग अलग इकाइयों में एक ही माप हैं।

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`. ठीक करें `n`(आमतौर पर त्रिकोण के लिए 3 और चार ग्राम के लिए 4) गणना से करेंः

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**प्रशिक्षण में न देखे गए किसी भी n-ग्राम को शून्य संभावना मिलती है। ब्राउन कॉर्पस पर 2007 के एक अध्ययन में पाया गया कि 4 ग्राम मॉडल में भी प्रशिक्षण में न देखे गए 4 ग्राम का 30% था। आप बिना चिकनाई के किसी भी वास्तविक पाठ पर मूल्यांकन नहीं कर सकते।

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**प्रत्येक गिनती में 1 जोड़ें. दुर्लभ घटनाओं पर सरल, भयानक।
2. **Good-Turing.**आवृत्ति-आवृत्ति के आधार पर उच्च आवृत्ति घटनाओं से अप्रत्याशित घटनाओं के लिए संभावना द्रव्यमान को पुनः आवंटित करें।
3. **Interpolation.**n-ग्राम, (n-1)-ग्राम, आदि अनुमानों को ट्यून करने योग्य वजनों के साथ मिलाएं।
4. **Backoff.**यदि n-ग्राम शून्य गिनती है, (n-1)-ग्राम पर वापस गिर. Katz बैकॉफ यह सामान्य बनाता है.
5. **Absolute discounting.**एक निश्चित छूट घटाएँ `D`हर गिनती से, अदृश्य में पुनः वितरण।
6. **Kneser-Ney.**पूर्ण छूट प्लस निम्न क्रम मॉडल के लिए एक स्मार्ट विकल्पः कच्चे आवृत्ति के बजाय *अंतिम संभावना* (एक शब्द कितने संदर्भों में दिखाई देता है) का उपयोग करें।

Kneser-Ney अंतर्दृष्टि गहरी है। "सैन फ्रांसिस्को" एक आम बिग्राम है। "सैन" के बाद यूनिग्राम "फ्रांसिस्को" ज्यादातर दिखाई देता है। "सैन" के बाद "फ्रांसिस्को" की उच्च संभावना (क्योंकि गणना उच्च है) देता है। केनेसर-नी नोटिस करता है कि "फ्रांसिस्को" केवल एक संदर्भ में दिखाई देता है और तदनुसार इसके निरंतरता की संभावना को कम करता है। परिणाम: "फ्रांसिस्को" से समाप्त होने वाले एक उपन्यास बिग्राम को उचित कम संभावना मिलती है।

**Evaluation: perplexity.**एक लंबे समय तक चलने वाले परीक्षण सेट पर प्रति शब्द औसत नकारात्मक लॉग-संभाव्यता का एक्सपोनेंट। कम बेहतर है। 100 की उलझन का मतलब है कि मॉडल 100 शब्दों के बीच समान रूप से चुनता है।

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## इसे बनाओ

### चरण 1: त्रिकोण गणना

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

इनपुट टोकन वाक्यों की एक सूची है। आउटपुट n-ग्राम गिनती और संदर्भ गिनती है। `<s>`और `</s>`वाक्य सीमाएं हैं।

### चरण 2: लैप्लेस चिकनाई

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

हर गिनती में 1 जोड़ें, जो कि दुर्लभ ज्ञात घटनाओं को भी नुकसान पहुंचाता है।

### चरण 3: Kneser-Ney (बिग्राम, इंटरपोलाटेड)

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

तीन चल भागों।`continuation_prob`"यह शब्द कितने अलग-अलग संदर्भों में दिखाई देता है? " (केनेसर-नी नवाचार) ।`lambda_prev`छूट द्वारा मुक्त द्रव्यमान है, जो बैकऑफ के वजन के लिए उपयोग किया जाता है। अंतिम संभावना छूट मुख्य अवधि प्लस वजन निरंतरता अवधि है।

### चरण 4: नमूनाकरण के साथ पाठ उत्पन्न करना

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

नमूनाकरण संभावना के अनुपात में होता है। हमेशा प्रति बीज अलग-अलग आउटपुट देता है। बीम-खोज-जैसे आउटपुट के लिए, प्रत्येक चरण (लाभकारी) पर argmax चुनें और एक छोटा यादृच्छिकता बटन (तापमान) जोड़ें।

### चरण 5: उलझन

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

ब्राउन कॉर्पस के लिए, एक अच्छी तरह से ट्यून 4-ग्राम केएन मॉडल 140 के आसपास की जटिलता को हिट करता है। एक ट्रांसफार्मर एलएम एक ही परीक्षण सेट पर 15-30 हिट करता है। अंतर लगभग 10 गुना है। यह अंतर है कि क्षेत्र आगे बढ़ गया है।

## इसका प्रयोग करें

- **Classical NLP teaching.**सबसे स्पष्ट रूप से चिकनाई, एमएलई, और भ्रम के संपर्क में आप प्राप्त कर सकते हैं.
- **KenLM.**उत्पादन n-ग्राम पुस्तकालय. भाषण और एमटी प्रणालियों में एक रेस्कोर के रूप में उपयोग किया जाता है जहां कम विलंबता मायने रखता है।
- **On-device autocomplete.**कीबोर्ड में ट्रिग्राम मॉडल।
- **Baselines.**यदि आपका ट्रांसफार्मर KN को एक बड़े मार्जिन से नहीं हराता है, तो कुछ गलत है।

## इसे भेजें

`outputs/prompt-lm-baseline.md`:

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## व्यायाम

1. **Easy.**एक 1000 वाक्य शेक्सपियर कॉर्पस पर एक त्रिकोण LM को प्रशिक्षित करें। 20 वाक्य उत्पन्न करें। वे स्थानीय रूप से मान्य होंगे लेकिन वैश्विक रूप से असंगत होंगे। यह कैनोनिक डेमो है।
2. **Medium.**अपने KN मॉडल के लिए एक लंबे समय तक चले शेक्सपियर विभाजन पर उलझन लागू करें। लैपलेस के साथ तुलना करें। आपको KN उलझन 30-50% कम देखना चाहिए।
3. **Hard.**एक त्रिकोण वर्तनी सुधारक बनाएंः एक गलत वर्तनी शब्द और उसके संदर्भ को देखते हुए, संदर्भ संभावना के अनुसार सुधार उत्पन्न करें और LM के तहत रैंक करें। Birkbeck वर्तनी corpus (सार्वजनिक) पर मूल्यांकन करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## आगे पढ़ना

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) अनुमान-खेल प्रयोग जो लक्ष्य को परिभाषित करता है प्रत्येक भाषा मॉडल अभी भी अनुकूलित करता है।
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) n ग्राम एलएम का कैनोनिक उपचार और चिकनाई।
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) कागज जो Kneser-Ney को सबसे अच्छा n-ग्राम चिकनी के रूप में तय किया।
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) मूल KN कागज।
- [KenLM](https://kheafield.com/code/kenlm/) तेजी से उत्पादन n-ग्राम LM, जो 2026 में भी लटेंसी-संवेदनशील अनुप्रयोगों के लिए उपयोग किया जाता है।
