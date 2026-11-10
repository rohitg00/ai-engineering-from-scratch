# Xây dựng một Tokenizer từ đầu

> Bài học 01 cho bạn một đồ chơi. Bài học này cho bạn một vũ khí.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## Mục tiêu học tập

- Xây dựng một token BPE cấp sản xuất xử lý Unicode, chuẩn hóa không gian trắng và các token đặc biệt
- Thực hiện fallback cấp bayt để tokenizer có thể mã hóa bất kỳ đầu vào (bao gồm emoji, CJK và mã) mà không có token không rõ
- Thêm các mẫu regex trước khi kết hợp mã hóa để chia văn bản ở giới hạn từ trước khi áp dụng các sự kết hợp BPE
- Trình luyện một token custom trên một corpus và đánh giá tỷ lệ nén của nó so với tiktoken trên văn bản đa ngôn ngữ

## Vấn đề

BPE của bạn từ bài học 01 hoạt động trên văn bản tiếng Anh. Bây giờ ném tiếng Nhật vào nó hoặc emoji hoặc mã Python với các tab và không gian hỗn hợp.

Nó bị vỡ.

Không phải vì BPE sai, bởi vì việc thực hiện là không hoàn chỉnh. Một tokenizer sản xuất xử lý các byte thô trong bất kỳ mã hóa nào, bình thường hóa Unicode trước khi chia, quản lý các token đặc biệt không bao giờ được hợp nhất, chuỗi pre-tokenization với phân chia từ phụ, và làm tất cả những điều này đủ nhanh để không làm tắc nghẽn một đường ống đào tạo xử lý 15 nghìn tỷ token.

GPT-2 có 50.257 token. Llama 3 có 128.256. GPT-4 có khoảng 100.000. Đây không phải là những con số đồ chơi. Các bảng hợp tác đằng sau các từ vựng đó được đào tạo trên hàng trăm gigabytes văn bản, và các thiết bị xung quanh -- bình thường hóa, pre-tokenization, tiêm mã thông báo đặc biệt, định dạng mẫu trò chuyện -- là những gì tách biệt một tokenizer xử lý "hello world" từ một cái xử lý toàn bộ Internet.

Anh sẽ xây dựng máy móc đó.

## Khái niệm

### Lối ống dẫn đầy đủ

Một token sản xuất không phải là một thuật toán, nó là một đường ống của năm giai đoạn, mỗi giải quyết một vấn đề khác nhau.

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

Mỗi giai đoạn có một công việc cụ thể:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE cấp bằng byte

Bài học 01 của tokenizer hoạt động trên UTF-8 byte. Đó là lời gọi đúng. Nhưng chúng tôi bỏ qua một điều quan trọng: điều gì xảy ra khi các byte đó không hợp lệ UTF-8?

BPE cấp bayt giải quyết điều này bằng cách xử lý mọi giá trị byte có thể (0-255) như một token hợp lệ. Từ vựng cơ sở của bạn chính xác là 256 mục. Bất kỳ tập tin nào - văn bản, nhị phân, bị hư hỏng - có thể được token mà không tạo ra một token không rõ.

GPT-2 đã thêm một thủ thuật: lập bản đồ mỗi byte cho một ký tự Unicode in được để từ vựng vẫn có thể đọc được bởi con người. Byte 0x20 (không gian) trở thành ký tự "G" trong bản đồ của họ.

Nguồn thực sự: BPE cấp bayt xử lý mọi ngôn ngữ trên thế giới. Các ký tự Trung Quốc là 3 byte UTF-8 mỗi. tiếng Nhật có thể là 3-4 byte. Ả Rập, Devanagari, emoji - tất cả chỉ là chuỗi byte. thuật toán BPE tìm kiếm các mẫu trong các chuỗi byte chính xác giống như nó tìm thấy các mẫu trong các byte ASCII tiếng Anh.

### Pre-Tokenization

Trước khi BPE chạm vào văn bản của bạn, bạn cần chia nó thành các mảnh. Điều này ngăn chặn thuật toán kết hợp tạo ra các token trải dài ranh giới từ.

GPT-2 sử dụng mô hình regex để chia văn bản:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Mô hình này chia thành các ký tự (don't trở thành don + t), từ có không gian dẫn, số, dấu chấm và không gian trắng tùy chọn.

Llama sử dụng SentencePiece, mà bỏ qua regex hoàn toàn. Nó xử lý dòng byte thô như một chuỗi dài và cho phép thuật toán BPE tìm ra ranh giới. Điều này đơn giản hơn nhưng cho phép BPE tự do hơn để tạo các mã thông báo chữ chéo.

Sự lựa chọn quan trọng. Regex của GPT-2 ngăn chặn tokenizer học rằng "the" ở cuối một từ và "the" ở đầu của từ tiếp theo nên hợp nhất. SentencePiece cho phép điều này, đôi khi tạo ra nén hiệu quả hơn nhưng ít giải thích các token.

### Các token đặc biệt

Mỗi token sản xuất lưu trữ ID token cho các dấu hiệu cấu trúc:

| Token | Purpose | Used By |
|-------|---------|---------|
| `[BOS]` / `<s>` | Beginning of sequence | Llama 3, GPT |
| `[EOS]` / `</s>` | End of sequence | All models |
| `[PAD]` | Padding for batch alignment | BERT, T5 |
| `[UNK]` | Unknown token (byte-level BPE eliminates this) | BERT, WordPiece |
| `<\|im_start\|>` | Chat message boundary start | ChatGPT, Qwen |
| `<\|im_end\|>` | Chat message boundary end | ChatGPT, Qwen |
| `<\|user\|>` | User turn marker | Llama 3 |
| `<\|assistant\|>` | Assistant turn marker | Llama 3 |

Các mã thông báo đặc biệt không bao giờ được chia bởi BPE. Chúng được kết hợp chính xác trước khi thuật toán kết hợp chạy, thay thế bằng ID cố định của chúng, và văn bản xung quanh được mã thông báo bình thường.

### Các mẫu trò chuyện

Đây là nơi mà hầu hết mọi người bị nhầm lẫn và hầu hết các triển khai bị phá vỡ.

Khi bạn gửi tin nhắn đến mô hình trò chuyện, API chấp nhận một danh sách tin nhắn:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

Mô hình không thấy JSON. Nó thấy một chuỗi token phẳng. Mô hình trò chuyện chuyển đổi tin nhắn thành chuỗi phẳng đó bằng cách sử dụng các token đặc biệt. Mỗi mô hình làm điều này khác nhau:

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

Nếu bạn sai mô hình, mô hình sẽ tạo ra rác. Nó được đào tạo theo một định dạng chính xác. Bất kỳ sự lệch nào - một dòng mới bị thiếu, một token được trao đổi, một không gian bổ sung - sẽ đưa đầu vào ra ngoài phân phối đào tạo.

### Tốc độ

Python quá chậm để làm token sản xuất.

tiktoken (OpenAI) được viết bằng Rust với liên kết Python. HuggingFace tokenizers cũng là Rust. SentencePiece là C ++.

Đối với viễn cảnh: token hóa 15 nghìn tỷ token cho Llama 3 trước đào tạo với 1 triệu token mỗi giây (fast Python) sẽ mất 174 ngày.

Bạn đang xây dựng trong Python để hiểu thuật toán. Trong sản xuất, bạn sẽ sử dụng một thực hiện được biên soạn và chỉ chạm vào gói Python.

```figure
weight-tying
```

## Hãy xây dựng nó

### Bước 1: Mã hóa cấp độ byte

Các nền tảng. Chuyển đổi bất kỳ chuỗi nào thành một chuỗi các byte, lập bản đồ mỗi byte để hiển thị một ký tự in, và đảo ngược quá trình.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Kiểm tra trên văn bản đa ngôn ngữ để xem số lượng byte:

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

"hello" là 5 byte. "你好" là 6 byte (3 mỗi ký tự). Fire emoji là 4 byte.

### Bước 2: Pre- Tokenizer với Regex

Chia văn bản thành các mảnh bằng cách sử dụng mô hình GPT-2 regex. Mỗi mảnh được token hóa độc lập bởi BPE.

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[^\W\d_]+| ?\d+| ?(?:[^\s\w]|_)+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

- `regex`module hỗ trợ Unicode tính năng thoát (`\p{L}`cho thư, `\p{N}`cho các số). Thư viện tiêu chuẩn `re`module không, do đó fallback xây dựng các lớp tương tự từ `\w``[^\W\d_]`phù hợp với bất kỳ chữ cái Unicode nào và `\d`bất kỳ chữ số Unicode nào. Đối với các token sản xuất đa ngôn ngữ, cài đặt `regex`- Tôi không biết.

Hãy thử đi.

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

Không gian dẫn tiếp vẫn gắn liền với từ sau nó.`Hello`BPE sẽ không bao giờ hợp nhất các token qua những ranh giới này.

### Bước 3: BPE trên các chuỗi byte

Các thuật toán cốt lõi từ bài học 01, nhưng bây giờ hoạt động trên các khối tiền-tokenized độc lập.

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

### Bước 4: xử lý mã thông báo đặc biệt

Các token đặc biệt cần phải phù hợp chính xác và xác định danh tính.

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

### Bước 5: Kiểu Tokenizer đầy đủ

Kết nối mọi thứ với nhau: bình thường hóa, chia thành các token đặc biệt, pre-tokenize, BPE hợp nhất, bản đồ đến ID.

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

### Bước 6: Kiểm tra đa ngôn ngữ

Thử nghiệm thực sự là ném tiếng Anh, tiếng Trung, emoji và mã vào nó.

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

Chữ Trung Quốc tạo ra 3 byte mỗi. emoji tạo ra 4 byte. Không một trong số này bị hỏng tokenizer. Không một tạo ra token không rõ. Đó là sức mạnh của BPE cấp bằng byte.

## Sử dụng nó

### So sánh các token thực sự

Lắp các mã thông báo thực tế từ Llama 3, GPT-4 và Mistral. Xem cách mỗi đoạn xử lý cùng một đoạn văn đa ngôn ngữ.

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

Bạn sẽ thấy số lượng token khác nhau cho cùng một văn bản. Llama 3 với từ vựng 128K là tích cực hơn trong việc hợp nhất các mẫu phổ biến. GPT-4 với 100K nằm ở giữa. Mistral với 32K sản xuất nhiều token hơn nhưng có một lớp nhúng nhỏ hơn.

Sự thỏa hiệp luôn luôn giống nhau: từ vựng lớn hơn có nghĩa là các chuỗi ngắn hơn nhưng nhiều tham số hơn.

## Chuyển nó

Bài học này tạo ra một lời nhắc để xây dựng và debugging token sản xuất.`outputs/prompt-tokenizer-builder.md`- Tôi không biết.

## Các bài tập

1. **Easy:**Thêm một `get_token_bytes(id)`phương pháp cho thấy các byte nguyên liệu cho bất kỳ ID token. Sử dụng nó để kiểm tra những gì các token hợp nhất của bạn thực sự đại diện.
2. **Medium:**Thực hiện các pre-tokenizer kiểu Llama chia trên không gian trắng và chữ số nhưng giữ không gian dẫn đầu. So sánh từ vựng của nó với cách tiếp cận GPT-2 regex trên cùng một corpus.
3. **Hard:**Thêm một phương pháp mẫu trò chuyện có danh sách `{"role": ..., "content": ...}`và tạo ra chuỗi mã thông báo chính xác cho định dạng trò chuyện Llama 3. kiểm tra nó với thực hiện HuggingFace.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Byte-level BPE | "Tokenizer that works on bytes" | BPE with a base vocabulary of 256 byte values -- handles any input without unknown tokens |
| Pre-tokenization | "Splitting before BPE" | Regex or rule-based splitting that prevents BPE from merging across word boundaries |
| NFKC normalization | "Unicode cleanup" | Canonical decomposition followed by compatibility composition -- "fi" ligature becomes "fi", fullwidth "A" becomes "A" |
| Chat template | "How messages become tokens" | The exact format for converting a list of role/content messages into a flat token sequence -- model-specific and must match training format |
| Special tokens | "Control tokens" | Reserved token IDs that bypass BPE -- [BOS], [EOS], [PAD], chat markers -- matched exactly before merge |
| Fertility | "Tokens per word" | Ratio of output tokens to input words -- 1.3 for English in GPT-4, 2-3 for Korean, higher means wasted context |
| tiktoken | "OpenAI tokenizer" | Rust BPE implementation with Python bindings -- 10-100x faster than pure Python |
| Merge table | "The vocabulary" | Ordered list of byte-pair merges learned during training -- this IS the tokenizer's learned knowledge |

## Đọc thêm

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- Thực hiện BPE dung nhựa được sử dụng bởi GPT-3.5/4
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- Thư viện token hóa Rust hỗ trợ BPE, WordPiece, Unigram
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- chi tiết về 128K từ vựng và đào tạo tokeniser
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- token hóa ngôn ngữ-người hiểu biết
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- bản đồ ban đầu từ byte đến Unicode
