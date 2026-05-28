# トークナイザーをゼロから構築する

> Lesson 01 で作ったのはおもちゃでした。このレッスンでは、実戦で使える道具にします。

**種類:** Build
**言語:** Python
**前提条件:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**時間:** 約 90 分

## 学習目標

- Unicode、空白の正規化、特殊トークンを扱える本番品質の BPE トークナイザーを構築する
- バイトレベルのフォールバックを実装し、未知トークンなしで任意の入力 (絵文字、CJK、コードを含む) をエンコードできるようにする
- BPE マージを適用する前に単語境界でテキストを分割する、事前トークン化用の正規表現パターンを追加する
- コーパス上でカスタムトークナイザーを訓練し、多言語テキストでの圧縮率を tiktoken と比較して評価する

## 課題

Lesson 01 で作った BPE トークナイザーは英語テキストでは動きます。では、日本語を入れてみましょう。絵文字でも構いません。タブとスペースが混ざった Python コードでもいいでしょう。

壊れます。

BPE が間違っているからではありません。実装が不完全だからです。本番用トークナイザーは、任意のエンコーディングの生バイトを扱い、分割前に Unicode を正規化し、決してマージされない特殊トークンを管理し、事前トークン化とサブワード分割をつなげます。しかも、15 兆トークンを処理する訓練パイプラインのボトルネックにならない速度で、これらすべてを実行する必要があります。

GPT-2 のトークナイザーには 50,257 個のトークンがあります。Llama 3 は 128,256 個です。GPT-4 はおよそ 100,000 個です。これはおもちゃの数字ではありません。これらの語彙の背後にあるマージテーブルは、数百 GB のテキストで訓練されています。そして、その周囲の仕組み、つまり正規化、事前トークン化、特殊トークンの挿入、チャットテンプレートの整形こそが、「hello world」しか扱えないトークナイザーと、インターネット全体を扱えるトークナイザーを分けます。

このレッスンでは、その仕組みを構築します。

## 概念

### 全体のパイプライン

本番用トークナイザーは 1 つのアルゴリズムではありません。異なる問題を解く 5 段階のパイプラインです。

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

各段階には明確な役割があります。

| 段階 | 何をするか | なぜ重要か |
|-------|-------------|----------------|
| 正規化 | NFKC Unicode、任意で小文字化、任意でアクセント除去 | "fi" 合字 (U+FB01) が "fi" (2 文字) になります。これがないと、同じ単語が異なるトークンになります。 |
| 事前トークン化 | BPE の前にテキストをチャンクへ分割する | BPE が単語境界をまたいでマージするのを防ぎます。"the cat" から "e c" というトークンが作られてはいけません。 |
| BPE マージ | 学習済みのマージ規則をバイト列に適用する | 中核となる圧縮です。生バイトをサブワードトークンに変換します。 |
| 特殊トークン | [BOS]、[EOS]、[PAD]、チャットテンプレートのマーカーを挿入する | これらのトークンには固定 ID があります。BPE マージには参加しません。モデルは構造を理解するためにこれらを必要とします。 |
| ID マッピング | トークン文字列を整数 ID に変換する | モデルが見るのは文字列ではなく整数です。 |

### バイトレベル BPE

Lesson 01 のトークナイザーは UTF-8 バイト上で動いていました。これは正しい選択でした。ただし、重要なことを飛ばしていました。そのバイト列が有効な UTF-8 ではない場合、何が起きるのでしょうか。

バイトレベル BPE は、取り得るすべてのバイト値 (0-255) を有効なトークンとして扱うことでこの問題を解きます。基礎語彙は正確に 256 エントリです。テキスト、バイナリ、壊れたファイルを問わず、未知トークンを出さずにトークン化できます。

GPT-2 はここに工夫を加えました。各バイトを表示可能な Unicode 文字に対応させ、語彙を人間が読める形に保ったのです。Byte 0x20 (space) は、その対応表では文字 "G" になります。これは純粋に見た目のためです。アルゴリズムは気にしません。

本当の強みは、バイトレベル BPE が地球上のあらゆる言語を扱えることです。中国語の文字は 1 文字あたり 3 UTF-8 バイトです。日本語は 3-4 バイトになり得ます。アラビア文字、デーヴァナーガリー、絵文字も、すべて単なるバイト列です。BPE アルゴリズムは、英語 ASCII バイトのパターンを見つけるのとまったく同じ方法で、これらのバイト列にあるパターンを見つけます。

### 事前トークン化

BPE がテキストに触れる前に、テキストをチャンクに分割する必要があります。これにより、マージアルゴリズムが単語境界をまたぐトークンを作るのを防ぎます。

GPT-2 は正規表現パターンを使ってテキストを分割します。

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

このパターンは短縮形 ("don't" は "don" + "'t")、任意の先頭スペースを持つ単語、数字、句読点、空白で分割します。先頭のスペースは単語に付いたままになります。つまり "the cat" は [" the", " cat"] になり、["the", " ", "cat"] にはなりません。

Llama は SentencePiece を使います。これは正規表現を完全に省略します。生のバイトストリームを 1 つの長い系列として扱い、境界は BPE アルゴリズムに見つけさせます。こちらは単純ですが、BPE が単語をまたぐトークンを作る自由度が高くなります。

この選択は重要です。GPT-2 の正規表現は、ある単語の末尾にある "the" と次の単語の先頭にある "the" がマージされるのを防ぎます。SentencePiece はそれを許します。結果として圧縮効率が上がることもありますが、トークンの解釈性は下がります。

### 特殊トークン

すべての本番用トークナイザーは、構造を示すマーカー用にトークン ID を予約します。

| トークン | 目的 | 使うモデル |
|-------|---------|---------|
| `[BOS]` / `<s>` | 系列の開始 | Llama 3, GPT |
| `[EOS]` / `</s>` | 系列の終了 | すべてのモデル |
| `[PAD]` | バッチ整列のためのパディング | BERT, T5 |
| `[UNK]` | 未知トークン (バイトレベル BPE では不要) | BERT, WordPiece |
| `<\|im_start\|>` | チャットメッセージ境界の開始 | ChatGPT, Qwen |
| `<\|im_end\|>` | チャットメッセージ境界の終了 | ChatGPT, Qwen |
| `<\|user\|>` | ユーザー発話のマーカー | Llama 3 |
| `<\|assistant\|>` | アシスタント発話のマーカー | Llama 3 |

特殊トークンは BPE によって分割されません。マージアルゴリズムが走る前に完全一致で検出され、固定 ID に置き換えられます。周囲のテキストは通常どおりトークン化されます。

### チャットテンプレート

ここで多くの人が混乱し、多くの実装が壊れます。

チャットモデルにメッセージを送るとき、API はメッセージのリストを受け取ります。

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

モデルが JSON を見るわけではありません。モデルが見るのは平坦なトークン列です。チャットテンプレートは、特殊トークンを使ってメッセージをその平坦な列に変換します。モデルごとに形式は異なります。

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

テンプレートを間違えると、モデルはでたらめな出力をします。モデルは 1 つの正確な形式で訓練されています。改行が 1 つ足りない、トークンを入れ替える、余分なスペースを入れるといったどんなズレも、入力を訓練分布の外に出してしまいます。

### 速度

Python は本番用のトークン化には遅すぎます。

tiktoken (OpenAI) は Rust で書かれ、Python バインディングを持っています。HuggingFace tokenizers も Rust です。SentencePiece は C++ です。これらは純粋な Python より 10-100 倍高速です。

感覚をつかむために考えてみましょう。Llama 3 の事前訓練用に 15 兆トークンをトークン化するとします。1 秒あたり 100 万トークン (高速な Python) では 174 日かかります。1 秒あたり 1 億トークン (Rust) なら 1.7 日です。

ここではアルゴリズムを理解するために Python で構築します。本番では、コンパイル済み実装を使い、Python ラッパーだけを触ることになります。

## 作ってみる

### Step 1: バイトレベルエンコーディング

基礎です。任意の文字列をバイト列へ変換し、表示用に各バイトを表示可能な文字へ対応させ、逆変換できるようにします。

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

多言語テキストでテストし、バイト数を確認します。

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

"hello" は 5 バイトです。"你好" は 6 バイトです (1 文字あたり 3 バイト)。炎の絵文字は 4 バイトです。バイトレベルのトークナイザーは言語を気にしません。バイトはバイトです。

### Step 2: 正規表現による事前トークナイザー

GPT-2 の正規表現パターンを使ってテキストをチャンクに分割します。各チャンクは BPE によって独立にトークン化されます。

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

`regex` モジュールは Unicode プロパティエスケープ (`\p{L}` は文字、`\p{N}` は数字) をサポートします。標準ライブラリの `re` モジュールはサポートしないため、ASCII の文字クラスへフォールバックします。本番用の多言語トークナイザーでは `regex` をインストールしてください。

試してみましょう。

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

先頭スペースは単語に付いたままです。短縮形はアポストロフィで分割されます。句読点は独立したチャンクになります。BPE がこれらの境界をまたいでトークンをマージすることはありません。

### Step 3: バイト列上の BPE

Lesson 01 の中核アルゴリズムと同じですが、今回は事前トークン化されたチャンクごとに独立して動かします。

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

### Step 4: 特殊トークンの処理

特殊トークンには完全一致と固定 ID が必要です。BPE を完全に迂回します。

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

### Step 5: 完全なトークナイザークラス

すべてをつなげます。正規化、特殊トークンでの分割、事前トークン化、BPE マージ、ID へのマッピングです。

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

### Step 6: 多言語テスト

本当のテストです。英語、中国語、絵文字、コードを投げ込みます。

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

中国語の文字は 1 文字あたり 3 バイトになります。絵文字は 4 バイトです。どれもトークナイザーをクラッシュさせません。未知トークンも生成しません。これがバイトレベル BPE の力です。

## 使ってみる

### 実際のトークナイザーを比較する

Llama 3、GPT-4、Mistral の実際のトークナイザーを読み込みます。同じ多言語段落をそれぞれがどう扱うかを見ます。

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

同じテキストでもトークン数が異なることがわかります。128K 語彙を持つ Llama 3 は、一般的なパターンをより積極的にマージします。100K 語彙の GPT-4 は中間です。32K 語彙の Mistral はより多くのトークンを生成しますが、埋め込み層は小さくなります。

トレードオフは常に同じです。語彙が大きいほど系列は短くなりますが、パラメータ数は増えます。

## 提出物

このレッスンでは、本番用トークナイザーを構築、デバッグするためのプロンプトを作ります。`outputs/prompt-tokenizer-builder.md` を参照してください。

## 演習

1. **Easy:** 任意のトークン ID の生バイトを表示する `get_token_bytes(id)` メソッドを追加してください。最頻出のマージ済みトークンが実際に何を表しているかを調べるのに使います。
2. **Medium:** 空白と数字で分割しつつ先頭スペースを保持する、Llama 風の事前トークナイザーを実装してください。同じコーパスで、GPT-2 の正規表現アプローチと語彙を比較してください。
3. **Hard:** `{"role": ..., "content": ...}` メッセージのリストを受け取り、Llama 3 のチャット形式に合う正しいトークン列を生成するチャットテンプレートメソッドを追加してください。HuggingFace 実装と照合してテストしてください。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|----------------|----------------------|
| Byte-level BPE | 「バイト上で動くトークナイザー」 | 256 個のバイト値を基礎語彙に持つ BPE。未知トークンなしで任意の入力を扱えます |
| Pre-tokenization | 「BPE の前に分割すること」 | BPE が単語境界をまたいでマージするのを防ぐ、正規表現またはルールベースの分割 |
| NFKC normalization | 「Unicode の整理」 | 正準分解に続く互換合成。"fi" 合字は "fi" になり、全角の "A" は "A" になります |
| Chat template | 「メッセージがトークンになる方法」 | role/content メッセージのリストを平坦なトークン列に変換する正確な形式。モデル固有で、訓練時の形式と一致する必要があります |
| Special tokens | 「制御トークン」 | BPE を迂回する予約済みトークン ID。[BOS]、[EOS]、[PAD]、チャットマーカーなど。マージ前に完全一致で検出されます |
| Fertility | 「単語あたりのトークン数」 | 出力トークン数と入力単語数の比率。GPT-4 の英語では 1.3、韓国語では 2-3。高いほどコンテキストを浪費します |
| tiktoken | 「OpenAI のトークナイザー」 | Python バインディングを持つ Rust 製 BPE 実装。純粋な Python より 10-100 倍高速です |
| Merge table | 「語彙」 | 訓練中に学習されたバイトペアマージの順序付きリスト。これこそがトークナイザーの学習済み知識です |

## 参考文献

- [OpenAI tiktoken source](https://github.com/openai/tiktoken) -- GPT-3.5/4 で使われる Rust 製 BPE 実装
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers) -- BPE、WordPiece、Unigram をサポートする Rust 製トークナイザーライブラリ
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783) -- 128K 語彙とトークナイザー訓練の詳細
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226) -- 言語非依存のトークン化
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py) -- 元祖バイトから Unicode への対応表
