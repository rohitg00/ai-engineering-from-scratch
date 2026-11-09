# GloVe, FastText, và Subword Embeddings

> Word2Vec đào tạo một việc nhúng mỗi từ. GloVe đã tính toán các matrix co-occurrence. FastText nhúng các mảnh. BPE nối với các bộ chuyển đổi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## Vấn đề

Word2Vec đã để lại hai câu hỏi mở.

Đầu tiên, có một dòng nghiên cứu song song phân tích các matrix co-occurrence trực tiếp (LSA, HAL) thay vì làm cập nhật các biểu đồ bỏ qua trực tuyến. Phương pháp lặp lại của Word2Vec có cơ bản tốt hơn, hoặc sự khác biệt là một tác phẩm tạo ra cách xử lý hai phương pháp có tính? **GloVe**trả lời rằng: các yếu tố tử liệu với một lỗ được lựa chọn cẩn thận phù hợp hoặc đánh bại Word2Vec, và chi phí ít hơn để đào tạo.

Thứ hai, không có phương pháp nào có câu chuyện cho những từ mà nó chưa từng thấy.`Zoomer-approved`- `dogecoin`, bất kỳ từ chính xác được đặt ra tuần trước, mọi hình thức cong cong của một gốc hiếm.**FastText**Fixed this by embedding character n-grams: một từ là tổng của các phần của nó, bao gồm cả các morphemes, vì vậy ngay cả từ ngoài từ vựng cũng có một vector hợp lý.

Thứ ba, khi những người biến đổi đến, câu hỏi đã thay đổi một lần nữa.**Byte-pair encoding (BPE)**và họ hàng của nó giải quyết điều này bằng cách học một từ vựng của các đơn vị chữ phụ thường xuyên bao gồm mọi thứ.

Bài học này sẽ đi qua cả ba, sau đó giải thích nên tìm đến ai cho khi nào.

## Khái niệm

**GloVe (Global Vectors).**Xây dựng các từ từ co-occurrence matrix `X`nơi `X[i][j]`là bao nhiêu lần từ `j`xuất hiện trong ngữ cảnh của từ `i`- Đường dẫn tàu như vậy`v_i · v_j + b_i + b_j ≈ log(X[i][j])`- Chất cân, đôi đôi thường xuyên không chiếm ưu thế.

**FastText.**Một từ là tổng số n-gram của ký tự cộng với chính từ. `where`trở thành `<wh, whe, her, ere, re>, <where>`. Từ vector là tổng số các vector thành phần đó.`whereupon`) được tạo thành từ n-gram được biết đến.

**BPE (Byte-Pair Encoding).**Bắt đầu với một từ vựng của các byte (hoặc ký tự) riêng lẻ. Đếm từng cặp lân cận trong corpus. Thủy cặp thường xuyên nhất thành một token mới.`k`Kết quả: một từ vựng của các biểu tượng cơ bản cộng với `k`hợp nhất (`k + 256`token khi bạn bắt đầu từ byte) nơi các chuỗi thường xuyên (`ing`- `tion`- `the`(văn) là các biểu tượng đơn lẻ và các từ hiếm được chia thành các mảnh quen thuộc.

```figure
n5-subword-merge
```

## Hãy xây dựng nó

### GloVe: tính toán các matrix co-occurrence

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

Hai mảnh chuyển động đáng để đặt tên.`f(x) = (x/x_max)^alpha`trọng lượng thấp đôi rất thường xuyên (như `(the, and)`) để họ không thống trị tổn thất.`W`(trung tâm) và `W_tilde`(context) bảng. Kết hợp cả hai là một trò lừa được công bố mà có xu hướng vượt qua chỉ bằng một.

### FastText: các bản nhúng có ý thức về các từ phụ

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

Mỗi từ được đại diện bởi bộ n-gram của nó (thường là 3 đến 6 ký tự).

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Đối với một từ không nhìn thấy, bạn vẫn nhận được một vector miễn là một số n-gram của nó được biết. `whereupon`cổ phiếu `<wh`- `her`- `ere`, và`<where`với `where`, nên hai cánh đất gần nhau.

### BPE: từ vựng phụ học

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

Lần lặp đầu tiên kết hợp cặp lân cận phổ biến nhất.`low`- `est`- `tion`) trở thành các token đơn lẻ và các từ hiếm gặp phá vỡ sạch.

Các token GPT / BERT / T5 thực sự học được 30k-100k hợp nhất. Kết quả: bất kỳ văn bản nào được token hóa thành một chuỗi dài hạn hạn của các ID được biết đến, không có OOV bao giờ.

## Sử dụng nó

Thực tế, bạn hiếm khi tự huấn luyện những thứ này.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

Đối với token hóa các từ phụ theo kiểu BPE trong thời đại biến thể:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

- `Ġ`Prefix đánh dấu ranh giới từ (một quy ước GPT-2).

### Khi nào để chọn

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## Chuyển nó

Cứ như `outputs/skill-embeddings-picker.md`- Có thể là:

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

## Các bài tập

1. **Easy.**Đi chạy`char_ngrams("playing")`và `char_ngrams("played")`- tính toán sự chồng chéo Jaccard của hai bộ n-gram.`pla`- `lay`- `play`), đó là lý do tại sao FastText chuyển giao tốt qua các biến thể hình thái.
2. **Medium.**Tăng `learn_bpe`để theo dõi sự tăng trưởng từ vựng. ghi mã thông báo-per-corpus-character như là một hàm số hợp nhất. Bạn nên thấy nén nhanh ban đầu, như bắt đầu gần ~2-3 chars mỗi mã thông báo.
3. **Hard.**Hãy tập 1k-mích BPE trên toàn bộ tác phẩm của Shakespeare. So sánh các biểu tượng từ thông thường so với các danh từ hiếm. đo mức trung bình biểu tượng mỗi từ trước và sau. Viết ra những gì đã làm bạn ngạc nhiên.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## Đọc thêm

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) tờ GloVe, bảy trang, vẫn là nguồn gốc tốt nhất của sự mất mát.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) bài báo giới thiệu BPE cho NLP hiện đại.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) cách BPE, WordPiece và SentencePiece thực sự khác nhau trong thực tế.
