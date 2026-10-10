# 子詞 tokenization——位元組對編碼（byte-pair encoding，BPE）、WordPiece、Unigram、SentencePiece

> 詞 tokenizer 會被沒看過的詞卡住。字元 tokenizer 把序列長度炸開。子詞 tokenizer 取中間。每個現代 LLM 都使用其中一種 tokenizer。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 5 · 04 (GloVe / FastText / Subword)
**Time:** ~60 minutes

## The Problem｜問題

你的詞彙表（vocabulary）有 5 萬個詞。使用者打了「untokenizable」。你的 tokenizer 回傳 `[UNK]`。模型對這個詞現在沒有任何訊號。更糟：語料庫（corpus）裡第 90 百分位的文件有 40 個罕見詞，也就是每份文件丟掉 40 位元的資訊。

子詞 tokenization 解決這件事。常見詞維持單一個 token。罕見詞拆成有意義的片段：`untokenizable` → `un`、`token`、`izable`。訓練資料什麼都蓋得到，因為任何字串最終都是位元組（byte）序列。

2026 年每個前沿大型語言模型都靠三種演算法（algorithm）之一交付（BPE、Unigram、WordPiece），包在三種函式庫（library）之一裡（tiktoken、SentencePiece、HF Tokenizers）。不挑一個，語言模型就交付不出去。

## The Concept｜核心概念

![BPE vs Unigram vs WordPiece, character-by-character](../assets/subword-tokenization.svg)

**BPE。** 從字元層級的詞彙表開始。統計每一組相鄰字元對的出現次數。把最常出現的那一對合併成新 token。重複到目標詞彙表大小。主導的演算法：GPT-2/3/4、Llama、Gemma、Qwen2、Mistral。

**位元組層級 BPE。** 同一套演算法，但跑在原始位元組上（256 個基底 token），不是 Unicode 字元。保證零個 `[UNK]`——任何位元組序列都能編碼。GPT-2 用 50,257 個 token（256 個位元組 + 5 萬次合併 + 1 個特殊 token）。

**Unigram。** 從一個巨大的詞彙表開始。每個 token 配一個一元機率。反覆剪掉拿掉之後、語料庫對數概似（log-likelihood）增加最少的 token。推論（inference）時是機率式的：可以抽樣（sampling）不同的切分（用子詞正則化（regularization）做資料增強很有用）。T5、mBART、ALBERT、XLNet、Gemma 用它。

**WordPiece。** 合併那些讓訓練語料庫概似（likelihood）最大的配對，而不是原始頻率。BERT、DistilBERT、ELECTRA 用它。

**SentencePiece 對上 tiktoken。** SentencePiece 是*訓練*詞彙表的函式庫（BPE 或 Unigram），直接在原始 Unicode 文本上，把空白編成 `▁`。tiktoken 是 OpenAI 很快的*編碼器*，對準已建好的詞彙表；它不訓練。

經驗法則：

- **訓練新詞彙表：** SentencePiece（多語、不需預先分詞）或 HF Tokenizers。
- **對 GPT 詞彙表做快速推論：** tiktoken（cl100k_base、o200k_base）。
- **兩者都要：** HF Tokenizers——同一個函式庫即可支援訓練與推論服務。

```figure
bpe-merge
```

## Build It｜動手實作

### 步驟 1：從零寫 BPE

見 `code/main.py`。迴圈是：

```python
def train_bpe(corpus, num_merges):
    vocab = {tuple(word) + ("</w>",): count for word, count in corpus.items()}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for symbols, freq in vocab.items():
            for a, b in zip(symbols, symbols[1:]):
                pairs[(a, b)] += freq
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        vocab = apply_merge(vocab, best)
    return merges
```

三件演算法編進去的事實。`</w>` 標出詞尾，所以「low」（後綴）和「lower」（前綴）保持不同。頻率加權讓高頻配對早贏。合併清單有順序——推論按訓練順序套用合併。

### 步驟 2：用學到的合併來編碼

```python
def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [a + b] + symbols[i + 2:]
            else:
                i += 1
    return symbols
```

單純的 O(n·|merges|)。正式環境（production）實作（tiktoken、HF Tokenizers）用合併順位查找加優先佇列，跑起來接近線性時間。

### 步驟 3：實務上的 SentencePiece

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # or "unigram"
    character_coverage=0.9995, # lower for CJK (e.g. 0.9995 for English, 0.995 for Japanese)
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

注意：不需要前 tokenization，空白編成 `▁`，`character_coverage` 控制罕見字元要多積極地保留，還是對到 `<unk>`。

### 步驟 4：給 OpenAI 相容詞彙表用的 tiktoken

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

只做編碼。快（Rust 後端）。和 GPT-4/5 的 tokenization 精確相符，用來做位元組計數、成本估計、脈絡視窗預算。

## 2026 年仍會交付出去的坑

- **tokenizer 漂移。** 用詞彙表 A 訓練，對詞彙表 B 部署（deployment）。token ID 不同；模型輸出垃圾。在 CI 裡檢查 `tokenizer.json` 的雜湊。
- **空白歧義。** BPE 的「hello」和「 hello」產出不同 token。永遠明確指定 `add_special_tokens` 和 `add_prefix_space`。
- **多語訓練不足。** 英文偏重的語料庫產出的詞彙表，把非拉丁文字切成 5 到 10 倍的 token。同一條 prompt 在 GPT-3.5 上的日文或阿拉伯文，成本是 5 到 10 倍。o200k_base 部分修了這件事。
- **表情符號被切開。** 一個表情符號可以吃掉 5 個 token。編脈絡預算時要核對表情符號怎麼被處理。

## Use It｜實際應用

2026 年的組合：

| 情況 | 選擇 |
|-----------|------|
| 從零訓練單語模型 | HF Tokenizers（BPE） |
| 訓練多語模型 | SentencePiece（Unigram，`character_coverage=0.9995`） |
| 服務 OpenAI 相容的 API | tiktoken（GPT-4 以後用 `o200k_base`） |
| 領域詞彙表（程式、數學、蛋白質） | 在領域語料庫上訓練自訂 BPE，再和基底詞彙表合併 |
| 邊緣（edge）推論、小模型 | Unigram（較小的詞彙表更好用） |

詞彙表大小是縮放上的決定，不是常數。粗略的經驗法則：參數不到 10 億用 3.2 萬，10 億到 100 億用 5 萬到 10 萬，多語或前沿用 20 萬以上。

## Ship It｜交付成果

存成 `outputs/skill-bpe-vs-wordpiece.md`：

```markdown
---
name: tokenizer-picker
description: Pick tokenizer algorithm, vocab size, library for a given corpus and deployment target.
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

Given a corpus (size, languages, domain) and deployment target (training from scratch / fine-tuning / API-compatible inference), output:

1. Algorithm. BPE, Unigram, or WordPiece. One-sentence reason.
2. Library. SentencePiece, HF Tokenizers, or tiktoken. Reason.
3. Vocab size. Rounded to nearest 1k. Reason tied to model size and language coverage.
4. Coverage settings. `character_coverage`, `byte_fallback`, special-token list.
5. Validation plan. Average tokens-per-word on held-out set, OOV rate, compression ratio, round-trip decode equality.

Refuse to train a character-coverage <0.995 tokenizer on corpora with rare-script content. Refuse to ship a vocab without a frozen `tokenizer.json` hash check in CI. Flag any monolingual tokenizer under 16k vocab as likely under-spec.
```

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 的小語料庫上訓練 500 次合併的 BPE。編碼三個留出的詞。有幾個正好是 1 個 token，有幾個超過 1 個？
2. **中等。** 在 100 句英文 Wikipedia 上，比較 `cl100k_base`、`o200k_base`、和你用詞彙表 3.2 萬訓練的 SentencePiece BPE 的 token 數。各報壓縮比。
3. **困難。** 用 BPE、Unigram、WordPiece 訓練同一個語料庫。量各自用在一個小情感分析（sentiment analysis）分類器（classifier）上的下游準確率（accuracy）。這個選擇會不會把 F1 移動超過 1 分？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| BPE | 位元組對編碼 | 貪婪地合併最常出現的字元對，直到達到目標詞彙表大小。 |
| 位元組層級 BPE | 永遠沒有未知 token | 在原始 256 個位元組上做 BPE；GPT-2／Llama 用這個。 |
| Unigram | 機率式 tokenizer | 用對數概似從大候選集合往下剪；T5、Gemma 用。 |
| SentencePiece | 處理空白的那個 | 在原始文本上訓練 BPE／Unigram 的函式庫；空白編成 `▁`。 |
| tiktoken | 快的那個 | OpenAI 用 Rust 做的 BPE 編碼器，對準已建好的詞彙表。不訓練。 |
| 合併清單 | 那些神奇數字 | 有順序的 `(a, b) → ab` 合併；推論按順序套用。 |
| 字元覆蓋 | 多罕見才算太罕見？ | tokenizer 必須覆蓋的訓練語料庫字元比例；典型約 0.9995。 |

## Further Reading｜延伸閱讀

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) ——BPE 論文。
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) ——Unigram 論文。
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) ——那個函式庫。
- [Hugging Face — Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) ——精簡的參考。
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) ——實務食譜加編碼清單。
