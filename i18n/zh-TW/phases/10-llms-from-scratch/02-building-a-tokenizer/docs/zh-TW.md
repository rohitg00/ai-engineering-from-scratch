# 從零打造 Tokenizer

> 第 1 課給了你一個玩具。這一課給你一把實戰武器。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 打造一個生產級的 BPE tokenizer，能處理 Unicode、空白字元正規化（normalization）與特殊 token
- 實作位元組（byte）層級回退（byte-level fallback），使 tokenizer 能編碼任何輸入（包含 emoji、中日韓字元與程式碼）且不產生未知 token
- 新增預先 tokenization 正規表示式模式，在套用 BPE 合併之前先在詞界處切分文字
- 在語料庫上訓練自訂 tokenizer，並在多語言文字上評估其相對於 tiktoken 的壓縮率

## The Problem｜問題

你在第 1 課打造的 BPE tokenizer 在英文文字上運作良好。但現在對它輸入日文試試看。或者輸入 emoji。或是混合了 Tab 與空格的 Python 程式碼。

它就失效了。

不是因為 BPE 本身有錯——而是因為實作並不完整。生產級的 tokenizer 必須能處理任何編碼的原始位元組（byte）、在切分前先對 Unicode 進行正規化（normalization）、管理絕對不會被合併的特殊 token、將把預先切分與子詞切分串成一條管線，而且這一切都要跑得夠快，不能成為處理 15 兆 token 訓練管線的效能瓶頸（bottleneck）。

GPT-2 的 tokenizer 有 50,257 個 token。Llama 3 有 128,256 個。GPT-4 大約有 10 萬個。這些不是玩具級的數字。背後支撐這些詞彙表的合併表是在數百 GB 的文字上訓練出來的，而圍繞在核心之外的整套機制——正規化（normalization）、預先 tokenization、特殊 token 注入、聊天範本（chat template）格式化——才是區分「只能處理 hello world」與「能處理整個網際網路」的關鍵差異。

你將要親手打造這套機制。

## The Concept｜核心概念

### 完整的處理管線

生產級的 tokenizer 不是單一演算法。它是一條由五個階段組成的管線，每個階段各為了解決不同的問題。

```mermaid
graph LR
    A[原始文字] --> B[正規化（normalization）]
    B --> C[預先 tokenization]
    C --> D[BPE 合併]
    D --> E[特殊 Token]
    E --> F[Token ID]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

每個階段都有其具體任務：

| 階段 | 作用 | 為什麼重要 |
|-------|-------------|----------------|
| 正規化（normalization）（Normalize） | NFKC Unicode、可選轉小寫、可選移除重音 | 「fi」連字（U+FB01）會變成「fi」（兩個字元）。如果沒有這一步，同一個詞會拿到不同的 token。 |
| 預先切分（Pre-Tokenize） | 在 BPE 之前先將文字切分成片段 | 防止 BPE 跨越詞界進行合併。「the cat」絕對不應該產生「e c」這樣的 token。 |
| BPE 合併（BPE Merge） | 對位元組（byte）序列套用已學會的合併規則 | 核心壓縮步驟。將原始位元組（byte）轉化為子詞 token。 |
| 特殊 Token（Special Tokens） | 注入 [BOS]、[EOS]、[PAD]、聊天範本標記 | 這些 token 具有固定 ID。它們絕不參與 BPE 合併。模型需要它們來維持結構。 |
| ID 映射（ID Mapping） | 將 token 字串轉換為整數 ID | 模型看到的是整數，不是字串。 |

### 位元組（byte）層級 BPE

第 1 課的 tokenizer 是在 UTF-8 位元組（byte）上操作。方向正確。但我們跳過了一件要緊的事：當那些位元組（byte）不是合法的 UTF-8 時會發生什麼事？

位元組（byte）層級 BPE 透過將每個可能的位元組（byte）值（0-255）視為合法 token 來解決這個問題。你的基礎詞彙表剛好就是 256 個位元組值。任何檔案——純文字、二進位檔案、損毀資料——都可以被 tokenization，而且完全不會產生未知 token。

GPT-2 加了一個技巧：將每個位元組（byte）映射到可列印的 Unicode 字元，使詞彙表保持人類可讀。位元組（byte） 0x20（空格）在他們的映射中變成字元「G」。這純粹是為了外觀好看。演算法本身並不在意。

真正的威力在於：位元組（byte）層級 BPE 能處理地球上的每一種語言。中文字元每個佔 3 個 UTF-8 位元組（byte）。日文字元可能是 3 到 4 個位元組（byte）。阿拉伯文、天城文、emoji——全都是位元組（byte）序列。BPE 演算法在這些位元組（byte）序列中尋找規律的方式，與在英文 ASCII 位元組（byte）中尋找規律完全一模一樣。

### 預先 Tokenization

在 BPE 接觸你的文字之前，你需要先將其切分成區塊。這能防止合併演算法建立出跨越詞界的 token。

GPT-2 使用正規表示式模式來切分文字：

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

這個模式會針對縮寫進行切分（「don't」變成「don」+「't」）、開頭可帶空格的字詞、數字、標點符號以及空白。開頭的空格會保持附著在該詞上——因此「the cat」會變成 [" the", " cat"]，而不是 ["the", " ", "cat"]。

Llama 使用 SentencePiece，完全跳過了正規表示式。它將原始位元組（byte）串流視為單一長序列，並讓 BPE 演算法自行判斷邊界。這更簡單，但也給了 BPE 更多自由度去建立跨詞的 token。

這個選擇至關重要。GPT-2 的正規表示式防止了 tokenizer 學會將一個詞結尾的「the」與下一個詞開頭的「the」進行合併。SentencePiece 則允許這種行為，有時能產生更高效的壓縮率，但 token 的可解釋性較低。

### 特殊 Token

每個生產級 tokenizer 都會為結構性標記保留 token ID：

| Token | 用途 | 使用的模型 |
|-------|---------|---------|
| `[BOS]` / `<s>` | 序列開頭 | Llama 3、GPT |
| `[EOS]` / `</s>` | 序列結尾 | 所有模型 |
| `[PAD]` | 批次對齊填充 | BERT、T5 |
| `[UNK]` | 未知 token（位元組（byte）層級 BPE 消除了此需求） | BERT、WordPiece |
| `<\|im_start\|>` | 聊天訊息邊界起點 | ChatGPT、Qwen |
| `<\|im_end\|>` | 聊天訊息邊界終點 | ChatGPT、Qwen |
| `<\|user\|>` | 使用者回合標記 | Llama 3 |
| `<\|assistant\|>` | 助理回合標記 | Llama 3 |

特殊 token 絕不會被 BPE 拆分。它們在合併演算法執行前就會被精確比對，替換為固定 ID，而周圍的文字則進行正常的 tokenization。

### 聊天範本（Chat Templates）

這是大多數人感到困惑、也是最多實作會出錯的地方。

當你向對話模型發送訊息時，API 接收的是訊息列表：

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

模型看到的不是 JSON。它看到的是平坦的 token 序列。聊天範本使用特殊 token 將訊息轉換為該平坦序列。每種模型的做法都不同：

```
Llama 3:
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are helpful.<|eot_id|><|start_header_id|>user<|end_header_id|>

Hello<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Hi there!<|eot_id|>

ChatGPT:
<|im_start|>system
You are helpful.<|im_end|>
<|im_start|>user
Hello<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

如果範本搞錯了，模型就會輸出垃圾。它是針對一種精確格式進行訓練的。任何偏差——漏掉換行、對調 token、多一個空格——都會讓輸入落在訓練分布（distribution）之外。

### 速度

純 Python 在正式環境進行 tokenization 速度太慢。

tiktoken（OpenAI）是以 Rust 撰寫並提供 Python 綁定。HuggingFace tokenizers 同樣是 Rust。SentencePiece 則是 C++。這些實作比純 Python 帶來 10 到 100 倍的速度提升。

具體來看：以每秒 100 萬個 token（快速 Python）為 Llama 3 預訓練進行 15 兆 token 的 tokenization 需要 174 天。以每秒 1 億個 token（Rust）則只需 1.7 天。

你用 Python 建構是為了理解演算法。在正式環境中，你會使用編譯型語言的實作，只接觸 Python 包裝層。

```figure
weight-tying
```

## Build It｜動手實作

### 步驟 1：位元組（byte）層級編碼

基石所在。將任何字串轉換為位元組（byte）序列，將每個位元組（byte）映射到可列印字元以供顯示，並反向還原該過程。

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

在多語言文字上進行測試，觀察位元組（byte）數量：

```python
texts = [
    ("English", "hello"),
    ("Chinese", "你好"),
    ("Emoji", "🔥"),
    ("Mixed", "hello你好🔥"),
]

for label, text in texts:
    b = bytes_to_tokens(text)
    print(f"{label}: {len(text)} chars -> {len(b)} bytes -> {b}")
```

「hello」是 5 個位元組（byte）。「你好」是 6 個位元組（byte）（每個字元 3 個位元組（byte））。火焰 emoji 是 4 個位元組（byte）。位元組（byte）層級 tokenizer 不在乎它是什麼語言。位元組（byte）就是位元組（byte）。

### 步驟 2：使用正規表示式的預先 Tokenizer

使用 GPT-2 正規表示式模式將文字切分成片段。每個片段由 BPE 獨立進行 tokenization。

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\w]+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

`regex` 模組支援 Unicode 屬性跳脫（`\p{L}` 表示字母，`\p{N}` 表示數字）。標準函式庫的 `re` 模組不支援，因此我們會回退到 ASCII 字元類別。對於正式環境的多語言 tokenizer，請安裝 `regex`。

試試看：

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

開頭的空格會保持附著在該詞上。縮寫在撇號處切開。標點符號自成一個片段。BPE 永遠不會跨越這些邊界合併 token。

### 步驟 3：在位元組（byte）序列上執行 BPE

第 1 課的核心演算法，但現在是在預先切分的片段上獨立操作。

```python
from collections import Counter

def get_byte_pairs(chunks):
    pairs = Counter()
    for chunk in chunks:
        byte_seq = list(chunk.encode("utf-8"))
        for i in range(len(byte_seq) - 1):
            pairs[(byte_seq[i], byte_seq[i + 1])] += 1
    return pairs

def apply_merge(byte_seq, pair, new_id):
    merged = []
    i = 0
    while i < len(byte_seq):
        if i < len(byte_seq) - 1 and byte_seq[i] == pair[0] and byte_seq[i + 1] == pair[1]:
            merged.append(new_id)
            i += 2
        else:
            merged.append(byte_seq[i])
            i += 1
    return merged
```

### 步驟 4：特殊 Token 處理

特殊 token 需要精確比對與固定 ID。它們完全繞過 BPE。

```python
class SpecialTokenHandler:
    def __init__(self):
        self.special_tokens = {}
        self.pattern = None

    def add_token(self, token_str, token_id):
        self.special_tokens[token_str] = token_id
        escaped = [re.escape(t) for t in sorted(self.special_tokens.keys(), key=len, reverse=True)]
        self.pattern = re.compile("|".join(escaped))

    def split_with_specials(self, text):
        if not self.pattern:
            return [(text, False)]
        parts = []
        last_end = 0
        for match in self.pattern.finditer(text):
            if match.start() > last_end:
                parts.append((text[last_end:match.start()], False))
            parts.append((match.group(), True))
            last_end = match.end()
        if last_end < len(text):
            parts.append((text[last_end:], False))
        return parts
```

### 步驟 5：完整 Tokenizer 類別

將所有環節串聯在一起：正規化（normalization）、切分特殊 token、預先切分、BPE 合併、映射到 ID。

```python
import unicodedata

class ProductionTokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.special_handler = SpecialTokenHandler()
        self.next_id = 256

    def normalize(self, text):
        return unicodedata.normalize("NFKC", text)

    def train(self, text, num_merges):
        text = self.normalize(text)
        chunks = pre_tokenize(text)
        chunk_bytes = [list(chunk.encode("utf-8")) for chunk in chunks]

        for i in range(num_merges):
            pairs = Counter()
            for seq in chunk_bytes:
                for j in range(len(seq) - 1):
                    pairs[(seq[j], seq[j + 1])] += 1
            if not pairs:
                break
            best = max(pairs, key=pairs.get)
            new_id = self.next_id
            self.next_id += 1
            self.merges[best] = new_id
            self.vocab[new_id] = self.vocab[best[0]] + self.vocab[best[1]]
            chunk_bytes = [apply_merge(seq, best, new_id) for seq in chunk_bytes]

    def add_special_token(self, token_str):
        token_id = self.next_id
        self.next_id += 1
        self.special_handler.add_token(token_str, token_id)
        self.vocab[token_id] = token_str.encode("utf-8")
        return token_id

    def encode(self, text):
        text = self.normalize(text)
        parts = self.special_handler.split_with_specials(text)
        all_ids = []
        for part_text, is_special in parts:
            if is_special:
                all_ids.append(self.special_handler.special_tokens[part_text])
            else:
                for chunk in pre_tokenize(part_text):
                    byte_seq = list(chunk.encode("utf-8"))
                    for pair, new_id in self.merges.items():
                        byte_seq = apply_merge(byte_seq, pair, new_id)
                    all_ids.extend(byte_seq)
        return all_ids

    def decode(self, ids):
        byte_parts = []
        for token_id in ids:
            if token_id in self.vocab:
                byte_parts.append(self.vocab[token_id])
        return b"".join(byte_parts).decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)
```

### 步驟 6：多語言測試

實戰測試。對它輸入英文、中文、emoji 與程式碼。

```python
corpus = (
    "The quick brown fox jumps over the lazy dog. "
    "The quick brown fox runs through the forest. "
    "Machine learning models process natural language. "
    "Deep learning transforms how we build software. "
    "def train(model, data): return model.fit(data) "
    "def predict(model, x): return model(x) "
)

tok = ProductionTokenizer()
tok.train(corpus, num_merges=50)

bos = tok.add_special_token("<|begin|>")
eos = tok.add_special_token("<|end|>")

test_texts = [
    "The quick brown fox.",
    "你好世界",
    "Hello 🌍 World",
    "def foo(x): return x + 1",
    f"<|begin|>Hello<|end|>",
]

for text in test_texts:
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    print(f"Input:   {text}")
    print(f"Tokens:  {len(ids)} ids")
    print(f"Decoded: {decoded}")
    print()
```

中文字元每個產生 3 個位元組（byte）。emoji 產生 4 個位元組（byte）。這些都不會讓 tokenizer 崩潰。沒有任何一個會產生未知 token。這就是位元組（byte）層級 BPE 的威力。

## Use It｜實際應用

### 比較真實世界的 Tokenizer

載入來自 Llama 3、GPT-4 與 Mistral 的真實 tokenizer。觀察它們各自如何處理同一段多語言段落。

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding("cl100k_base")

test_paragraph = "Machine learning is powerful. 机器学习很强大。 L'apprentissage automatique est puissant. 🤖💪"

tokens = gpt4_enc.encode(test_paragraph)
pieces = [gpt4_enc.decode([t]) for t in tokens]
print(f"GPT-4 ({len(tokens)} tokens): {pieces}")
```

```python
from transformers import AutoTokenizer

llama_tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
mistral_tok = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

for name, tok in [("Llama 3", llama_tok), ("Mistral", mistral_tok)]:
    tokens = tok.encode(test_paragraph)
    pieces = tok.convert_ids_to_tokens(tokens)
    print(f"{name} ({len(tokens)} tokens): {pieces[:20]}...")
```

你會看到同一段文字在不同 tokenizer 下產生不同的 token 數量。擁有 12.8 萬詞彙表的 Llama 3 在合併常見模式上更為積極。擁有 10 萬詞彙表的 GPT-4 居中。擁有 3.2 萬詞彙表的 Mistral 產生更多 token，但擁有較小的 embedding 層。

權衡取捨永遠是一致的：較大的詞彙表意味著更短的序列長度，但需要更多參數。

## Ship It｜交付成果

本課產出用於建構與除錯生產級 tokenizer 的 prompt。請參閱 `outputs/prompt-tokenizer-builder.md`。

## Exercises｜練習

1. **簡單：** 新增一個 `get_token_bytes(id)` 方法，顯示任何 token ID 對應的原始位元組（byte）。用它來檢查你最常合併的 token 實際代表什麼內容。
2. **中等：** 實作 Llama 風格的預先 tokenizer，依空格與數字切分但保留開頭空格。在同一個語料庫上將其詞彙表與 GPT-2 正規表示式方法進行比較。
3. **困難：** 新增一個聊天範本方法，接收 `{"role": ..., "content": ...}` 訊息列表，並產生符合 Llama 3 聊天格式的正確 token 序列。與 HuggingFace 的實作進行比對驗證。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 位元組（byte）層級 BPE | 「在位元組（byte）上操作的 tokenizer」 | 基礎詞彙表為 256 個位元組（byte）值的 BPE——能處理任何輸入且不產生未知 token |
| 預先 tokenization | 「在 BPE 之前先切分」 | 基於正規表示式或規則的切分，防止 BPE 跨越詞界進行合併 |
| NFKC 正規化（normalization） | 「Unicode 清理」 | 標準等價分解後進行相容等價合成——「fi」連字變成「fi」，全形「Ａ」變成半形「A」 |
| 聊天範本（Chat template） | 「訊息如何變成 token」 | 將角色／內容訊息列表轉換為平坦 token 序列的精確格式——因模型而異且必須與訓練格式完全相符 |
| 特殊 token | 「控制用 token」 | 繞過 BPE 的保留 token ID——[BOS]、[EOS]、[PAD]、對話標記——在合併前進行精確比對 |
| Fertility | 「每個詞的 token 數」 | 輸出 token 數與輸入詞數的比例——GPT-4 英文約 1.3，韓文約 2-3，數值越高意味著脈絡被浪費得越多 |
| tiktoken | 「OpenAI 的 tokenizer」 | 具備 Python 綁定的 Rust BPE 實作——比純 Python 快 10 到 100 倍 |
| 合併表 | 「詞彙表」 | 訓練過程中學習到的位元組（byte）對合併有序列表——這就是 tokenizer 所學到的核心知識 |

## Further Reading｜延伸閱讀

- [OpenAI tiktoken 原始碼](https://github.com/openai/tiktoken) ——GPT-3.5/4 所採用的 Rust BPE 實作
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers) ——支援 BPE、WordPiece、Unigram 的 Rust tokenizer 函式庫
- [Llama 3 論文 (Meta, 2024)](https://arxiv.org/abs/2407.21783) ——關於 12.8 萬詞彙表與 tokenizer 訓練的詳細細節
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226) ——與語言無關的 tokenization
- [GPT-2 tokenizer 原始碼](https://github.com/openai/gpt-2/blob/master/src/encoder.py) ——最初的位元組（byte）至 Unicode 映射實作
