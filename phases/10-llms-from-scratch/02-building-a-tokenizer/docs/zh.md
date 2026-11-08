# 從零打造一個分詞器

> 第 01 課給了你一個玩具。這一課給你一把武器。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 10 · 01（分詞器：BPE、WordPiece、SentencePiece）
**時間：** 約 90 分鐘

## 學習目標

- 打造一個生產等級的 BPE 分詞器，能處理 Unicode、空白正規化與特殊詞元
- 實作位元組層級的退回機制，讓分詞器能編碼任何輸入（包含表情符號、CJK 與程式碼）而不產生未登錄詞
- 加入預分詞的正規表示式樣式，在套用 BPE 合併規則之前先在詞界處切分文字
- 在自己的語料上訓練分詞器，並在多語文字上與 tiktoken 比較壓縮率

## 問題所在

你在第 01 課寫的 BPE 分詞器能處理英文。現在丟日文給它。或表情符號。或是 tab 與空白混用的 Python 程式碼。

它壞了。

不是因為 BPE 有錯 —— 而是因為實作還不完整。生產級分詞器要能處理任何編碼的原始位元組、在切分前先做 Unicode 正規化、管好那些永遠不該被合併的特殊詞元、把預分詞和子詞切分串起來，而且這一切都得跑得夠快，才不會拖垮一條要處理 15 兆詞元的訓練管線。

GPT-2 的分詞器有 50,257 個詞元，Llama 3 有 128,256 個，GPT-4 大約 100,000 個。這些不是玩具數字。撐起這些詞彙表的合併表是在數百 GB 的文字上訓練出來的，而周邊的機制 —— 正規化、預分詞、特殊詞元注入、聊天模板格式化 —— 正是「只能處理 hello world 的分詞器」與「能處理整個網際網路的分詞器」之間的差別。

你要打造的就是這套機制。

## 核心概念

### 完整的管線

生產級分詞器不是單一演算法，而是一條五個階段的管線，每一段解決不同的問題。

```mermaid
graph LR
    A[Raw Text] --> B[Normalize]
    B --> C[Pre-Tokenize]
    C --> D[BPE Merge]
    D --> E[Special Tokens]
    E --> F[Token IDs]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

每個階段有各自明確的任務：

| 階段 | 做什麼 | 為什麼重要 |
|-------|-------------|----------------|
| 正規化 | NFKC Unicode，可選擇轉小寫、可選擇去除重音 | "fi" 連字（U+FB01）會變成 "fi"（兩個字元）。沒有這一步，同一個詞會拿到不同的詞元。 |
| 預分詞 | 在 BPE 之前把文字切成片段 | 避免 BPE 跨詞界合併。"the cat" 絕不該產生一個 "e c" 詞元。 |
| BPE 合併 | 把學到的合併規則套用到位元組序列上 | 核心的壓縮動作。把原始位元組變成子詞詞元。 |
| 特殊詞元 | 注入 [BOS]、[EOS]、[PAD]、聊天模板標記 | 這些詞元有固定 ID，永遠不參與 BPE 合併。模型需要它們來辨識結構。 |
| ID 映射 | 把詞元字串轉成整數 ID | 模型看到的是整數，不是字串。 |

### 位元組層級 BPE

第 01 課的分詞器跑在 UTF-8 位元組上，這個選擇是對的。但我們跳過了一件重要的事：如果那些位元組根本不是合法的 UTF-8 呢？

位元組層級 BPE 的解法是把每一個可能的位元組值（0-255）都當成合法詞元。基底詞彙表剛好 256 個項目。任何檔案 —— 文字、二進位、損毀的 —— 都能被詞元化而不產生未登錄詞。

GPT-2 加了一個小技巧：把每個位元組映射到一個可列印的 Unicode 字元，讓詞彙表保持人類可讀。在他們的映射裡，位元組 0x20（空白）會變成字元 "G"。這純粹是為了好看，演算法根本不在乎。

真正的威力在於：位元組層級 BPE 能處理地球上任何語言。中文字每個佔 3 個 UTF-8 位元組，日文可能是 3 到 4 個。阿拉伯文、天城文、表情符號 —— 全都只是位元組序列。BPE 演算法在這些位元組序列裡找樣式的方式，和它在英文 ASCII 位元組裡找樣式的方式完全一樣。

### 預分詞

在 BPE 碰到你的文字之前，你得先把它切成片段。這能避免合併演算法造出跨越詞界的詞元。

GPT-2 用一個正規表示式樣式來切分文字：

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

這個樣式會在縮寫（"don't" 變成 "don" + "'t"）、帶可選前導空白的單字、數字、標點與空白處切開。前導空白會留著跟單字黏在一起 —— 所以 "the cat" 變成 [" the", " cat"]，而不是 ["the", " ", "cat"]。

Llama 用的是 SentencePiece，完全跳過正規表示式。它把原始位元組串當成一整段長序列，讓 BPE 演算法自己去找邊界。這比較單純，但也給了 BPE 更多自由去造出跨詞的詞元。

這個選擇是有影響的。GPT-2 的正規表示式會阻止分詞器學到「一個詞結尾的 the 和下一個詞開頭的 the 應該合併」。SentencePiece 則允許這件事，有時壓縮效率更好，但詞元的可解讀性較差。

### 特殊詞元

每一個生產級分詞器都會保留一些詞元 ID 給結構性標記：

| 詞元 | 用途 | 誰在用 |
|-------|---------|---------|
| `[BOS]` / `<s>` | 序列起始 | Llama 3、GPT |
| `[EOS]` / `</s>` | 序列結束 | 所有模型 |
| `[PAD]` | 批次對齊用的填充 | BERT、T5 |
| `[UNK]` | 未登錄詞元（位元組層級 BPE 讓它消失） | BERT、WordPiece |
| `<\|im_start\|>` | 聊天訊息邊界起始 | ChatGPT、Qwen |
| `<\|im_end\|>` | 聊天訊息邊界結束 | ChatGPT、Qwen |
| `<\|user\|>` | 使用者回合標記 | Llama 3 |
| `<\|assistant\|>` | 助理回合標記 | Llama 3 |

特殊詞元永遠不會被 BPE 切開。它們會在合併演算法跑之前先被精確比對出來、換成固定 ID，周圍的文字則照常詞元化。

### 聊天模板

這是最多人搞混、也最多實作出錯的地方。

當你把訊息送給聊天模型時，API 接收的是一份訊息清單：

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

模型看不到 JSON。它看到的是一串扁平的詞元序列。聊天模板會用特殊詞元把訊息轉換成那串扁平序列。每個模型的做法都不一樣：

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

模板弄錯，模型就會吐垃圾。它是在某一個精確的格式上訓練出來的。任何偏差 —— 少一個換行、換掉一個詞元、多一個空白 —— 都會把輸入推到訓練分布之外。

### 速度

Python 對生產級詞元化來說太慢了。

tiktoken（OpenAI）用 Rust 寫成、附 Python 綁定。HuggingFace tokenizers 也是 Rust。SentencePiece 是 C++。這些實作比純 Python 快 10 到 100 倍。

給個概念：以每秒一百萬詞元（很快的 Python）替 Llama 3 預訓練詞元化 15 兆詞元，要花 174 天。以每秒一億詞元（Rust）來算，只要 1.7 天。

你用 Python 是為了搞懂演算法。在生產環境，你會用編譯過的實作，只碰 Python 包裝層。

```figure
weight-tying
```

## 動手實作

### 步驟 1：位元組層級編碼

打地基。把任意字串轉成位元組序列、把每個位元組映射成可列印字元以便顯示，再把整個過程反轉回來。

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

在多語文字上測試，看看位元組數：

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

"hello" 是 5 個位元組。"你好" 是 6 個位元組（每字 3 個）。火焰表情符號是 4 個位元組。位元組層級分詞器不在乎那是什麼語言。位元組就是位元組。

### 步驟 2：用正規表示式做預分詞

用 GPT-2 的正規表示式樣式把文字切成片段。每一片會由 BPE 各自獨立地詞元化。

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

`regex` 模組支援 Unicode 屬性跳脫（`\p{L}` 表示字母，`\p{N}` 表示數字）。標準函式庫的 `re` 模組不支援，所以我們退回到 ASCII 字元類別。要做生產級的多語分詞器，請安裝 `regex`。

試試看：

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

前導空白留著跟後面那個單字黏在一起。第一個單字前面沒有空白，所以它那一片就是 `Hello`。縮寫在撇號處切開。標點自成一片。BPE 永遠不會跨越這些邊界合併詞元。

### 步驟 3：在位元組序列上跑 BPE

第 01 課的核心演算法，但現在改成在預分詞後的片段上各自獨立運作。

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

### 步驟 4：特殊詞元的處理

特殊詞元需要精確比對和固定 ID。它們完全繞過 BPE。

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

### 步驟 5：完整的分詞器類別

把所有環節串起來：正規化、以特殊詞元切分、預分詞、BPE 合併、映射成 ID。

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

### 步驟 6：多語測試

真正的考驗。把英文、中文、表情符號和程式碼一起丟進去。

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

中文字每個會產生 3 個位元組，表情符號產生 4 個。這些都不會讓分詞器崩潰，也不會產生未登錄詞。這就是位元組層級 BPE 的威力。

## 框架應用

### 比較真實世界的分詞器

載入 Llama 3、GPT-4 與 Mistral 的實際分詞器，看看它們怎麼處理同一段多語段落。

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

同一段文字，你會看到不同的詞元數。Llama 3 有 128K 詞彙表，合併常見樣式時最積極。GPT-4 的 100K 位在中間。Mistral 只有 32K，切出來的詞元比較多，但嵌入層比較小。

取捨永遠是同一組：詞彙表越大，序列越短，但參數越多。

## 產出交付

這一課會產出一個用於建置與除錯生產級分詞器的提示詞。見 `outputs/prompt-tokenizer-builder.md`。

## 練習

1. **簡單：** 加一個 `get_token_bytes(id)` 方法，顯示任意詞元 ID 的原始位元組。用它檢視你最常見的合併詞元實際上代表什麼。
2. **中等：** 實作 Llama 風格的預分詞器：按空白和數字切分，但保留前導空白。在同一份語料上比較它與 GPT-2 正規表示式做法產生的詞彙表。
3. **困難：** 加一個聊天模板方法，接受一份 `{"role": ..., "content": ...}` 訊息清單，產生符合 Llama 3 聊天格式的正確詞元序列。拿它跟 HuggingFace 的實作對照測試。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 位元組層級 BPE | 「跑在位元組上的分詞器」 | 基底詞彙表為 256 個位元組值的 BPE —— 能處理任何輸入而不產生未登錄詞 |
| 預分詞 | 「BPE 之前先切開」 | 以正規表示式或規則為基礎的切分，避免 BPE 跨詞界合併 |
| NFKC 正規化 | 「Unicode 清理」 | 標準分解之後接相容組合 —— "fi" 連字變成 "fi"，全形 "A" 變成 "A" |
| 聊天模板 | 「訊息怎麼變成詞元」 | 把 role/content 訊息清單轉成扁平詞元序列的精確格式 —— 因模型而異，而且必須與訓練格式一致 |
| 特殊詞元 | 「控制用的詞元」 | 繞過 BPE 的保留詞元 ID —— [BOS]、[EOS]、[PAD]、聊天標記 —— 在合併之前先被精確比對出來 |
| 繁殖率（fertility） | 「每個詞幾個詞元」 | 輸出詞元數對輸入詞數的比值 —— GPT-4 處理英文是 1.3，韓文是 2 到 3，越高代表上下文被浪費得越多 |
| tiktoken | 「OpenAI 的分詞器」 | 以 Rust 實作、附 Python 綁定的 BPE —— 比純 Python 快 10 到 100 倍 |
| 合併表 | 「那個詞彙表」 | 訓練期間學到的位元組配對合併有序清單 —— 它本身「就是」分詞器學到的知識 |

## 延伸閱讀

- [OpenAI tiktoken source](https://github.com/openai/tiktoken) —— GPT-3.5/4 使用的 Rust BPE 實作
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers) —— 支援 BPE、WordPiece、Unigram 的 Rust 分詞器函式庫
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783) —— 128K 詞彙表與分詞器訓練的細節
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226) —— 與語言無關的詞元化
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py) —— 最初的位元組對 Unicode 映射
