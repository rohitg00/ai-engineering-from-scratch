# ग्लोवे, फास्टटेक्स्ट और सबवर्ड एम्बेड

> Word2Vec ने प्रत्येक शब्द में एक एम्बेडिंग को प्रशिक्षित किया। ग्लोवे ने सह-अवसर मैट्रिक्स को कारक बनाया। फास्टटेक्स्ट ने टुकड़ों को एम्बेड किया। बीपीई ने ट्रांसफार्मरों से पुल बनाया।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## समस्या

Word2Vec ने दो खुले प्रश्न छोड़े।

सबसे पहले, एक समानांतर शोध लाइन थी जो ऑनलाइन स्किप-ग्राम अपडेट करने के बजाय सीधे सह-घटना मैट्रिक्स (एलएसए, एचएएल) को कारगर करती थी। क्या वर्ड 2 वीईसी का पुनरावर्ती दृष्टिकोण मौलिक रूप से बेहतर था, या क्या अंतर दो तरीकों को संभालने के तरीके का एक कलाकृत्य था?**GloVe**उत्तर दिया किः एक ध्यान से चुना हानि के साथ मैट्रिक्स कारक मिलान या Word2Vec से अधिक है, और प्रशिक्षण के लिए कम लागत है।

दूसरा, किसी भी विधि में शब्दों के लिए एक कहानी नहीं थी जिसे उसने कभी नहीं देखा था।`Zoomer-approved`,`dogecoin`, पिछले सप्ताह का आविष्कार किया गया किसी भी उचित संज्ञा, दुर्लभ जड़ के प्रत्येक घुमावदार रूप।**FastText**यह n-ग्राम वर्णों को एम्बेड करके तय किया गयाः एक शब्द अपने हिस्सों का योग है, जिसमें मॉर्फेम शामिल हैं, इसलिए यहां तक कि शब्द संग्रह से बाहर शब्द एक समझदार वेक्टर प्राप्त करते हैं।

तीसरा, जब ट्रांसफार्मर आए, तो सवाल फिर से बदल गया। शब्द स्तर की शब्दावली लगभग एक मिलियन प्रविष्टियों को कवर करती है; वास्तविक भाषा इससे अधिक खुली है। **Byte-pair encoding (BPE)**और उसके रिश्तेदारों ने अक्सर उपशब्द इकाइयों की एक शब्दावली को सीखकर यह हल किया जो सब कुछ कवर करता है। हर आधुनिक एलएलएम के लिए प्रत्येक आधुनिक टोकननाइज़र एक उपशब्द टोकननाइज़र है।

यह सबक तीनों को बताता है, फिर बताता है कि किसको कब तक पहुंचना है।

## अवधारणा

**GloVe (Global Vectors).**शब्द-शब्द सह-प्रकृति मैट्रिक्स का निर्माण करें `X`कहाँ`X[i][j]`कितनी बार शब्द है `j`शब्द के संदर्भ में दिखाई देता है `i`. रेल वेक्टर ऐसे कि `v_i · v_j + b_i + b_j ≈ log(X[i][j])`वजन कम करने के लिए इतनी बार जोड़े प्रभुत्व नहीं है.

**FastText.**एक शब्द अपने वर्ण n-ग्राम के योग है और शब्द स्वयं। `where`बन जाता है`<wh, whe, her, ere, re>, <where>`. शब्द वेक्टर उन घटक वेक्टरों का योग है. Word2Vec के रूप में प्रशिक्षित करें. लाभः अदृश्य शब्द (`whereupon`) ज्ञात n-ग्राम से बने होते हैं।

**BPE (Byte-Pair Encoding).**प्रत्येक बाइट (या वर्ण) की शब्दावली से शुरू करें। कॉर्पस में प्रत्येक आसन्न जोड़ी को गिनें। सबसे अधिक बार होने वाली जोड़ी को नए टोकन में मिलाएं।`k`परिणामः आधार प्रतीकों का शब्दावली प्लस `k`विलय (`k + 256`टोकन जब आप बाइट्स से शुरू) जहां लगातार अनुक्रम (`ing`,`tion`,`the`) एकल टोकन हैं और दुर्लभ शब्द परिचित टुकड़ों में टूट जाते हैं। प्रत्येक वाक्य कुछ टोकन में बदल जाता है।

```figure
n5-subword-merge
```

## इसे बनाओ

### ग्लोवेः सह-अवसर मैट्रिक्स को फैक्टरीज़ करें

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    pair_counts = Counter()
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    for doc in docs:
        indexed = [vocab[t] for t in doc]
        for i, center in enumerate(indexed):
            for j in range(max(0, i - window), min(len(indexed), i + window + 1)):
                if i != j:
                    distance = abs(i - j)
                    pair_counts[(center, indexed[j])] += 1.0 / distance
    return vocab, pair_counts


def glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0):
    n = len(vocab)
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(n, dim))
    W_tilde = rng.normal(0, 0.1, size=(n, dim))
    b = np.zeros(n)
    b_tilde = np.zeros(n)

    for epoch in range(epochs):
        for (i, j), x_ij in pair_counts.items():
            weight = (x_ij / x_max) ** alpha if x_ij < x_max else 1.0
            diff = W[i] @ W_tilde[j] + b[i] + b_tilde[j] - np.log(x_ij)
            coef = weight * diff

            grad_W_i = coef * W_tilde[j]
            grad_W_tilde_j = coef * W[i]
            W[i] -= lr * grad_W_i
            W_tilde[j] -= lr * grad_W_tilde_j
            b[i] -= lr * coef
            b_tilde[j] -= lr * coef

    return W + W_tilde
```

दो चलती टुकड़े नाम देने लायक। वजन समारोह`f(x) = (x/x_max)^alpha`बहुत अधिक बार घटता है जोड़े (जैसे `(the, and)`) इसलिए वे हानि पर हावी नहीं होते हैं। अंतिम सम्मिलन राशि है `W`(केंद्र) और `W_tilde`(संदर्भ) तालिकाओं. दोनों को जोड़ना एक प्रकाशित चाल है जो केवल एक का उपयोग करके बेहतर प्रदर्शन करने की प्रवृत्ति है.

### FastText: उपशब्दों के प्रति जागरूक एम्बेड

```python
def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams
```

```python
>>> char_ngrams("where")
{'<where>', '<wh', 'whe', 'her', 'ere', 're>', '<whe', 'wher', 'here', 'ere>', '<wher', 'where', 'here>'}
```

प्रत्येक शब्द को n-ग्राम (आमतौर पर 3 से 6 वर्ण) के सेट द्वारा दर्शाया जाता है। शब्द एम्बेडिंग इसके n-ग्राम एम्बेडिंग का योग है। स्किप-ग्राम प्रशिक्षण के लिए, इसे प्लग इन करें जहां Word2Vec ने एक एकल वेक्टर का उपयोग किया है।

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

एक अदृश्य शब्द के लिए, आप अभी भी एक वेक्टर मिलता है जब तक कुछ इसके n-ग्राम ज्ञात हैं। `whereupon`शेयर `<wh`,`her`,`ere`और `<where`के साथ`where`, तो दोनों एक दूसरे के करीब भूमि.

### बीपीईः उपशब्दों का सीखा हुआ शब्दावली

```python
def learn_bpe(corpus, k_merges):
    vocab = Counter()
    for word, freq in corpus.items():
        tokens = tuple(word) + ("</w>",)
        vocab[tokens] = freq

    merges = []
    for _ in range(k_merges):
        pair_freq = Counter()
        for tokens, freq in vocab.items():
            for a, b in zip(tokens, tokens[1:]):
                pair_freq[(a, b)] += freq
        if not pair_freq:
            break
        best = pair_freq.most_common(1)[0][0]
        merges.append(best)

        new_vocab = Counter()
        for tokens, freq in vocab.items():
            new_tokens = []
            i = 0
            while i < len(tokens):
                if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == best:
                    new_tokens.append(tokens[i] + tokens[i + 1])
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            new_vocab[tuple(new_tokens)] = freq
        vocab = new_vocab
    return merges


def apply_bpe(word, merges):
    tokens = list(word) + ["</w>"]
    for a, b in merges:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i + 1 < len(tokens) and tokens[i] == a and tokens[i + 1] == b:
                new_tokens.append(a + b)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        tokens = new_tokens
    return tokens
```

```python
>>> corpus = Counter({"low": 5, "lower": 2, "newest": 6, "widest": 3})
>>> merges = learn_bpe(corpus, k_merges=10)
>>> apply_bpe("lowest", merges)
['low', 'est</w>']
```

पहले पुनरावृत्ति सबसे आम आसन्न जोड़ी को मिलाता है। पर्याप्त पुनरावृत्ति के बाद, अक्सर उपशृंखला (`low`,`est`,`tion`) एकल टोकन बन जाते हैं और दुर्लभ शब्द साफ-साफ टूट जाते हैं।

वास्तविक GPT / BERT / T5 टोकन बनाने वाले 30k-100k विलय सीखते हैं। परिणामः कोई भी पाठ ज्ञात आईडी के सीमित लंबाई अनुक्रम में टोकन बनता है, कभी भी OOV नहीं।

## इसका प्रयोग करें

अभ्यास में, आप शायद ही कभी खुद इन में से किसी को प्रशिक्षित करते हैं. आप पूर्व-प्रशिक्षित चेकपोइंट लोड करते हैं।

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

ट्रांसफार्मर युग में बीपीई शैली के उपशब्द टोकनकरण के लिएः

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ`प्रत्येक आधुनिक टोकनराइज़र एक बीपीई संस्करण, वर्डपीस (बीईआरटी) या सैंटेंसपीस (टी 5, एलएएमए) है।

### कौन सी चुनना है

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## इसे भेजें

`outputs/skill-embeddings-picker.md`:

```markdown
---
name: tokenizer-picker
description: Pick a tokenization approach for a new language model or text pipeline.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Given a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level). One-sentence reason.
2. Vocabulary size target (e.g., 32k for an English-only LM, 64k-100k for multilingual).
3. Library call with the exact training command. Name the library. Quote the arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug; call out which pair must be used together.

Refuse to recommend training a custom tokenizer when the user is fine-tuning a pretrained LLM. Refuse to recommend word-level tokenization for any model targeting production inference. Flag non-English / multi-script corpora as needing SentencePiece with byte fallback.
```

## व्यायाम

1. **Easy.**दौड़ें`char_ngrams("playing")`और `char_ngrams("played")`. दो n-ग्राम सेटों के जैकार्ड ओवरलैप की गणना करें. आपको पर्याप्त साझा टुकड़े देखने चाहिए (`pla`,`lay`,`play`), यही कारण है कि फास्टटेक्सट मॉर्फोलॉजिकल वेरिएंट्स के बीच अच्छी तरह से स्थानांतरित करता है।
2. **Medium.**विस्तार `learn_bpe`शब्द संग्रह की वृद्धि को ट्रैक करने के लिए। संलयन की संख्या के अनुसार प्रति कर्पस वर्ण टोकन का प्लॉट करें। आपको पहले तेजी से संपीड़न देखना चाहिए, प्रति टोकन लगभग 2-3 वर्णों को समझना चाहिए।
3. **Hard.**शेक्सपियर के पूर्ण कार्यों पर 1k-फ्यूजन बीपीई को प्रशिक्षित करें. सामान्य शब्दों की टोकनाइज़ेशन की तुलना दुर्लभ विशेषणों के साथ करें. प्रत्येक शब्द के लिए औसत टोकन का माप करें। जो आपको आश्चर्यचकित करता है उसे लिखें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## आगे पढ़ना

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) ग्लोवे पेपर, सात पृष्ठ, अभी भी हानि का सबसे अच्छा व्युत्पन्न है।
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) फास्टटेक्स्ट।
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) पेपर जिसने आधुनिक एनएलपी में बीपीई का परिचय दिया।
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) कैसे BPE, WordPiece और SentencePiece वास्तव में व्यवहार में अलग हैं।
