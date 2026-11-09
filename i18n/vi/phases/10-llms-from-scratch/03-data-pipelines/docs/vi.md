# Các đường ống dữ liệu cho việc đào tạo trước

> Mô hình là một tấm gương phản ánh bất cứ dữ liệu nào bạn đưa vào nó.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 10, Lessons 01-02 (Tokenizers, Building a Tokenizer)
**Time:** ~90 minutes

## Mục tiêu học tập

- Xây dựng một đường ống dữ liệu trực tuyến mà token hóa, phân đoạn, trộn và đợt số lượng văn bản mà không cần tải tất cả vào bộ nhớ
- Thực hiện các bộ lọc chất lượng dữ liệu (sử dụng tính năng khử trùng, phát hiện ngôn ngữ, lọc nội dung) được sử dụng trong các đường ống đào tạo trước thực tế
- Tạo các chuỗi đào tạo dài cố định với mặt nạ chú ý thích hợp và xử lý biên giới tài liệu
- Tải thông qua đường ống hồ sơ để đảm bảo bộ tải dữ liệu theo kịp tốc độ đào tạo GPU

## Vấn đề

Anh có một token, giờ anh cần dữ liệu.

Không phải một tập dữ liệu, không phải một tệp CSV. Térabytes văn bản - được làm sạch, sao chép, lọc chất lượng, được mã hóa thành chuỗi dài cố định, và được phục vụ theo các lô ngẫu nhiên đủ nhanh để cluster 8 GPU của bạn không bao giờ chờ đợi cho lô tiếp theo.

Hầu hết mọi người nghĩ rằng đào tạo LLM là về kiến trúc mô hình. Nó không phải là. Llama 3 sử dụng 15,6 nghìn tỷ token. GPT-3 sử dụng 300 tỷ. DeepSeek-V2 sử dụng 8,1 nghìn tỷ. Kiến trúc trên cả ba đều tương tự: khối biến thể xếp chồng với sự chú ý và các lớp cấp dữ liệu. Sự khác biệt về chất lượng đầu ra xuất phát xuất từ dữ liệu.

Bài báo của Chinchilla từ DeepMind đã làm rõ điều này. Đối với một ngân sách tính toán nhất định, có một tỷ lệ tối ưu của các tham số mô hình với các token đào tạo. Chinchilla cho thấy hầu hết các mô hình vào năm 2022 đều bị thiếu đào tạo đáng kể -- họ có quá nhiều tham số cho lượng dữ liệu họ nhìn thấy. Một mô hình thông số 70B được đào tạo trên 1,4 nghìn tỷ token (Chinchilla-optimal) vượt trội hơn mô hình 280B được đào tạo trên 300 tỷ token (Gopher).

Đường dẫn dữ liệu của bạn xác định liệu mô hình của bạn có học ngôn ngữ hay học tiếng ồn.

## Khái niệm

### Dữ liệu đến từ đâu

Mỗi mô hình ngôn ngữ lớn được đào tạo dựa trên một sự pha trộn của các nguồn.

| Source | Size | Quality | Used By |
|--------|------|---------|---------|
| Common Crawl | ~250 TB raw | Low (needs heavy filtering) | GPT-3, Llama, most open models |
| Wikipedia | ~20 GB | High | Every major LLM |
| GitHub code | ~1 TB+ | Medium (lots of duplicates, dead code) | StarCoder, CodeLlama, DeepSeek-Coder |
| Books (BookCorpus, Pile) | ~100 GB | High | GPT-2, GPT-3, early models |
| Academic papers (arXiv, S2ORC) | ~100 GB | High for STEM | Llama, Galactica |
| StackOverflow, Reddit | ~100 GB | Medium | Llama, Falcon |
| Curated web (C4, RefinedWeb) | ~5 TB | Medium-High (pre-filtered) | T5, Falcon |

Llama 3 tiết lộ bộ sưu tập dữ liệu của mình: khoảng 50% dữ liệu web, 25% mã, 13% sách và bài báo học, 8% dữ liệu toán học và 4% dữ liệu web đa ngôn ngữ.

Tỷ lệ quan trọng cũng như kích thước tổng thể. Quá nhiều dữ liệu web và mô hình trở thành một con bọo Reddit. Quá ít mã và nó không thể lập trình. Quá ít toán học và nó không thể suy luận. Việc kết hợp đúng là một trong những phần khó khăn nhất trong việc đào tạo LLM, và không có công thức - nó đòi hỏi phải thử nghiệm và đánh giá.

### Việc làm sạch dữ liệu

Dữ liệu web nguyên liệu là bẩn. Một bãi rác thông thường chứa:

- Tags HTML và JavaScript
- Các tiêu đề, chân chân, menu điều hướng
- Các trang trùng lặp (tương tự và gần như trùng lặp)
- Spam được tạo bởi máy
- Thông tin nhận dạng cá nhân (PII)
- Văn bản chất lượng thấp (luhlu từ khóa, spam SEO)
- Nội dung không văn bản được mã hóa như văn bản

Việc làm sạch không phải là tùy chọn. Đó là sự khác biệt giữa một mô hình tạo ra các đoạn kết hợp và một mô hình xuất ra các thẻ HTML trộn với danh sách sản phẩm.

```mermaid
graph TD
    A[Raw Text] --> B[HTML Strip]
    B --> C[Language Detection]
    C --> D[Quality Filter]
    D --> E[Deduplication]
    E --> F[PII Removal]
    F --> G[Clean Text]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#e94560,color:#fff
```

Mỗi bước loại bỏ một loại tiếng ồn:

**HTML stripping:**Xóa tất cả các dấu hiệu. Giữ chỉ nội dung văn bản hiển thị. Thư viện như `trafilatura`hoặc `readability`trích xuất nội dung bài viết trong khi loại bỏ các hướng dẫn, quảng cáo và bảng ghi.

**Language detection:**Sử dụng mô hình xác định ngôn ngữ của fastText (lid.176.bin) để phân loại từng tài liệu. Trình vào ngôn ngữ mục tiêu của bạn. Một tài liệu được phân loại là tiếng Anh với độ tin cậy dưới 0,8 có thể không phải là tiếng Anh sạch.

**Quality filtering:**Đây là nơi nó trở nên thú vị. RefinedWeb (hội dữ liệu đằng sau Falcon) sử dụng một bộ lọc dựa trên sự phức tạp: đào tạo một mô hình ngôn ngữ nhỏ trên Wikipedia, sau đó đánh giá từng tài liệu. Sự phức tạp cao có nghĩa là tài liệu không giống như Wikipedia - có thể là spam, danh sách từ khóa hoặc nội dung được tạo bởi máy. Tài liệu có sự phức tạp trên ngưỡng được loại bỏ.

**Deduplication:**Bước làm sạch có tác động nhất. Common Crawl chứa một số lượng lớn các trang trùng lặp - từ chối pháp lý, thông báo cookie, điều khoản dịch vụ. Căn luyện về bản trùng lặp lãng phí tính toán và có thể khiến mô hình ghi nhớ và tái tạo các đoạn cụ thể theo nghĩa đen.

**PII removal:**Tên, địa chỉ email, số điện thoại, số an sinh xã hội, phát hiện dựa trên Regex cho PII có cấu trúc, mô hình NER cho tên trong bối cảnh.

### Thiết lập lần nhỏ với MinHash

Việc sao chép chính xác là dễ dàng: phân phối từng tài liệu, loại bỏ bản sao. Nhưng bản sao gần giống là vấn đề thực sự. Hai bản sao của cùng một bài báo tin tức với quảng cáo khác nhau xung quanh nó là bản sao gần giống nhau. Nội dung 95% giống nhau, nhưng chúng khác nhau về một byte.

MinHash + Hashing nhạy cảm với địa điểm (LSH) giải quyết vấn đề này hiệu quả.

```mermaid
graph LR
    A[Document] --> B[Shingling]
    B --> C[MinHash Signature]
    C --> D[LSH Buckets]
    D --> E[Candidate Pairs]
    E --> F[Jaccard Similarity]
    F --> G[Deduplicated Set]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#e94560,color:#fff
```

Ý tưởng:

1. **Shingling:**Chuyển đổi mỗi tài liệu thành một tập hợp n-gram (ví dụ, 5 gram từ hoặc ký tự). "rồi nâu nhanh" với 3 từ vải nâu trở thành {"rồi nâu nhanh", "rồi nâu nhanh"}.

2. **MinHash:**Đối với bộ vỏ bọc của mỗi tài liệu, tính toán các giá trị hash k. Mỗi giá trị hash là hash tối thiểu trên tất cả vỏ bọc dưới một chức năng hash khác nhau. Điều này tạo ra một "thỏa thuận" kích thước cố định gần như tương tự Jaccard giữa hai tài liệu.

3. **LSH:**Tập hợp các tài liệu thành vỏ dựa trên các băng của chữ ký MinHash của họ. Các tài liệu trong cùng một vỏ là ứng viên gần như trùng lặp. Điều này tránh so sánh từng cặp - bạn chỉ so sánh ứng viên.

4. **Verify:**Đối với mỗi cặp ứng cử viên, tính toán sự tương đồng chính xác của Jaccard.

Nhóm Llama báo cáo đã xóa khoảng 38% dữ liệu web của họ thông qua khử trùng lặp. Đó không phải là một con số nhỏ. Hơn một phần ba của Common Crawl là nội dung trùng lặp hoặc gần như trùng lặp.

### Sắp xếp theo trình tự

Mô hình của bạn mong đợi chuỗi đầu vào dài cố định. Tài liệu của bạn có chiều dài biến đổi. Một số là 50 token. Một số là 50.000 token.

Phương pháp ngây thơ: đệm mỗi tài liệu với chiều dài chuỗi tối đa. Điều này lãng phí tính toán khổng lồ trên các token đệm không đóng góp gì cho việc học.

Cách tiếp cận tốt hơn: gói nhiều tài liệu vào một chuỗi duy nhất, tách ra bởi các token cuối chuỗi. Một chuỗi 2048-token có thể chứa ba tài liệu ngắn liên kết với các token [EOS] giữa chúng.

```mermaid
graph TD
    subgraph Naive Packing
        A1["Doc A (200 tokens)"] --> P1["[PAD] x 1848"]
        A2["Doc B (500 tokens)"] --> P2["[PAD] x 1548"]
        A3["Doc C (100 tokens)"] --> P3["[PAD] x 1948"]
    end

    subgraph Efficient Packing
        B1["Doc A (200) | Doc B (500) | Doc C (100) | Doc D (400) | Doc E (848)"]
    end

    style A1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style A2 fill:#1a1a2e,stroke:#e94560,color:#fff
    style A3 fill:#1a1a2e,stroke:#e94560,color:#fff
    style P1 fill:#333,stroke:#666,color:#999
    style P2 fill:#333,stroke:#666,color:#999
    style P3 fill:#333,stroke:#666,color:#999
    style B1 fill:#1a1a2e,stroke:#16c784,color:#fff
```

Mặt nạ chú ý phải được đặt đúng. Các token từ Tài liệu A không nên tham gia vào các token từ Tài liệu B trong cùng một chuỗi đóng gói. Điều này đòi hỏi một mặt nạ chú ý đường chọc.

Các tài liệu dài bị cắt ngắn hoặc chia thành các mảnh ở ranh giới chuỗi. Điểm chia quan trọng: chia giữa câu buộc mô hình để thấy những suy nghĩ không đầy đủ. Một số đường ống dẫn sắp xếp các chia cắt đến ranh giới đoạn hoặc câu khi có thể.

### Luật quy mô của Chinchilla

Đối với ngân sách tính toán cố định $C$(được đo bằng FLOP), kích thước mô hình tối ưu $N$và kích thước bộ dữ liệu $D$tiếp theo:

```math
\begin{aligned}
N_{\text{opt}} &\sim C^{0.5} \\
D_{\text{opt}} &\sim C^{0.5}
\end{aligned}
```

Trong thực tế, điều này có nghĩa là bạn nên quy mô mô mô hình và kích thước tập dữ liệu tương đương. Một mô hình có nhiều tham số hơn 10 lần cần khoảng 10 lần nhiều token đào tạo để đạt được cùng một lỗ.

| Model | Parameters | Training Tokens | Chinchilla-Optimal? |
|-------|-----------|----------------|-------------------|
| GPT-3 | 175B | 300B | No (undertrained 3-4x) |
| Chinchilla | 70B | 1.4T | Yes (by design) |
| Llama 2 | 70B | 2T | Overtrained (intentionally) |
| Llama 3 | 70B | 15T | Heavily overtrained |

Llama 3 cố ý vi phạm luật Chinchilla. Meta phát hiện ra rằng quá trình đào tạo trên nhiều dữ liệu - vượt xa tỷ lệ tối ưu tính toán - tạo ra các mô hình tốt hơn cho suy luận. Chi phí đào tạo bổ sung được trả một lần, nhưng mô hình nhỏ hơn rẻ hơn để phục vụ mãi mãi. Điều này đôi khi được gọi là cách tiếp cận quy mô "sự suy luận tối ưu", và nó đã trở thành tiêu chuẩn ngành kể từ năm 2024.

```figure
l5-data-pipeline
```

## Hãy xây dựng nó

### Bước 1: Làm sạch văn bản

Xét HTML, bình thường hóa không gian trắng, loại bỏ nội dung không văn bản. Chúng tôi sẽ sử dụng một văn bản thuộc phạm vi công cộng (Project Gutenberg) như là bộ phận nhỏ của chúng tôi.

```python
import re

def clean_text(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()

def quality_filter(text, min_words=50, max_ratio_caps=0.3, max_ratio_special=0.1):
    words = text.split()
    if len(words) < min_words:
        return False
    caps_ratio = sum(1 for w in words if w.isupper()) / len(words)
    if caps_ratio > max_ratio_caps:
        return False
    special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
    if special_chars / max(len(text), 1) > max_ratio_special:
        return False
    return True
```

Bộ lọc chất lượng bắt được spam SEO (ALL CAPS), tiếng ồn do máy tạo (nhiều lượng đặc biệt đặc biệt cao) và các trang stub (quá ngắn).

### Bước 2: Khác nhân MinHash

Thực hiện MinHash từ đầu. Không cần thư viện bên ngoài - chỉ cần`hashlib`- Tôi không biết.

```python
import hashlib
from collections import defaultdict

def get_shingles(text, k=5):
    words = text.lower().split()
    if len(words) < k:
        return set()
    return {" ".join(words[i:i+k]) for i in range(len(words) - k + 1)}

def minhash_signature(shingles, num_hashes=128):
    signature = []
    for i in range(num_hashes):
        min_hash = float("inf")
        for shingle in shingles:
            h = int(hashlib.sha256(f"{i}:{shingle}".encode()).hexdigest(), 16)
            min_hash = min(min_hash, h)
        signature.append(min_hash)
    return signature

def lsh_buckets(signature, bands=16):
    rows_per_band = len(signature) // bands
    buckets = []
    for b in range(bands):
        start = b * rows_per_band
        band_data = tuple(signature[start:start + rows_per_band])
        bucket_hash = hashlib.md5(str(band_data).encode()).hexdigest()
        buckets.append((b, bucket_hash))
    return buckets

def deduplicate(documents, threshold=0.8, num_hashes=128, bands=16):
    signatures = []
    shingle_sets = []
    for doc in documents:
        shingles = get_shingles(doc)
        shingle_sets.append(shingles)
        signatures.append(minhash_signature(shingles, num_hashes))

    bucket_map = defaultdict(list)
    for doc_idx, sig in enumerate(signatures):
        for band_id, bucket_hash in lsh_buckets(sig, bands):
            bucket_map[(band_id, bucket_hash)].append(doc_idx)

    duplicate_pairs = set()
    for bucket_docs in bucket_map.values():
        if len(bucket_docs) < 2:
            continue
        for i in range(len(bucket_docs)):
            for j in range(i + 1, len(bucket_docs)):
                duplicate_pairs.add((bucket_docs[i], bucket_docs[j]))

    removed = set()
    for i, j in duplicate_pairs:
        if i in removed or j in removed:
            continue
        s1, s2 = shingle_sets[i], shingle_sets[j]
        if not s1 or not s2:
            continue
        jaccard = len(s1 & s2) / len(s1 | s2)
        if jaccard >= threshold:
            removed.add(j)

    return [doc for idx, doc in enumerate(documents) if idx not in removed], len(removed)
```

- `num_hashes=128`và `bands=16`Các tham số kiểm soát sự giao dịch nhớ chính xác. nhiều hash hơn cung cấp ước tính tương tự chính xác hơn. nhiều băng tần tăng nhớ (tự bắt nhiều bản trùng lặp hơn) với chi phí nhiều tích cực sai. Những giá trị này hoạt động tốt cho văn bản web điển hình.

### Bước 3: Đánh dấu và gói các chuỗi

Lấy văn bản sạch, được sao chép, mã hóa nó, và đóng gói vào các chuỗi dài cố định để đào tạo.

```python
def tokenize_corpus(documents, tokenizer):
    all_tokens = []
    for doc in documents:
        tokens = tokenizer.encode(doc)
        all_tokens.extend(tokens)
        all_tokens.append(tokenizer.eos_id)
    return all_tokens

def pack_sequences(token_ids, seq_length, pad_id=0):
    sequences = []
    attention_masks = []
    for i in range(0, len(token_ids), seq_length):
        seq = token_ids[i:i + seq_length]
        mask = [1] * len(seq)
        if len(seq) < seq_length:
            pad_count = seq_length - len(seq)
            seq = seq + [pad_id] * pad_count
            mask = mask + [0] * pad_count
        sequences.append(seq)
        attention_masks.append(mask)
    return sequences, attention_masks
```

### Bước 4: DataLoader cho đào tạo

Tạo ra các loạt chuỗi ngẫu nhiên.

```python
import random

class PreTrainingDataLoader:
    def __init__(self, sequences, attention_masks, batch_size, shuffle=True):
        self.sequences = sequences
        self.attention_masks = attention_masks
        self.batch_size = batch_size
        self.shuffle = shuffle

    def __len__(self):
        return (len(self.sequences) + self.batch_size - 1) // self.batch_size

    def __iter__(self):
        indices = list(range(len(self.sequences)))
        if self.shuffle:
            random.shuffle(indices)
        for start in range(0, len(indices), self.batch_size):
            batch_idx = indices[start:start + self.batch_size]
            batch_seqs = [self.sequences[i] for i in batch_idx]
            batch_masks = [self.attention_masks[i] for i in batch_idx]
            yield batch_seqs, batch_masks
```

### Bước 5: Thống kê dữ liệu

Xét số quan trọng: tổng token, token độc đáo, tỷ lệ nén, phân phối chiều dài tài liệu.

```python
from collections import Counter

def compute_statistics(documents, token_ids, sequences, tokenizer_vocab_size):
    total_chars = sum(len(d) for d in documents)
    total_tokens = len(token_ids)
    unique_tokens = len(set(token_ids))
    compression_ratio = total_chars / total_tokens

    doc_lengths = [len(d.split()) for d in documents]
    avg_doc_length = sum(doc_lengths) / max(len(doc_lengths), 1)
    max_doc_length = max(doc_lengths) if doc_lengths else 0
    min_doc_length = min(doc_lengths) if doc_lengths else 0

    token_counts = Counter(token_ids)
    top_tokens = token_counts.most_common(10)

    non_pad_tokens = sum(sum(1 for t in seq if t != 0) for seq in sequences)
    total_positions = sum(len(seq) for seq in sequences)
    utilization = non_pad_tokens / max(total_positions, 1)

    stats = {
        "total_documents": len(documents),
        "total_characters": total_chars,
        "total_tokens": total_tokens,
        "unique_tokens": unique_tokens,
        "vocab_utilization": unique_tokens / tokenizer_vocab_size,
        "compression_ratio": compression_ratio,
        "avg_doc_length_words": avg_doc_length,
        "max_doc_length_words": max_doc_length,
        "min_doc_length_words": min_doc_length,
        "num_sequences": len(sequences),
        "sequence_utilization": utilization,
        "top_10_tokens": top_tokens,
    }
    return stats
```

Tỷ lệ nén cho bạn biết token hiệu quả như thế nào trên corpus này. văn bản tiếng Anh thường nén đến khoảng 3-4 ký tự mỗi token. Nếu bạn thấy 1,5 ký tự mỗi token, token của bạn đang phân chia quá tích cực. Nếu bạn thấy 8+, nó đã học được sự hợp nhất rất cụ thể về miền.

Sử dụng chuỗi cho bạn biết bao nhiêu chuỗi đóng gói của bạn là dữ liệu thực so với đóng gói. dưới 90% có nghĩa là đóng gói của bạn là không hiệu quả - bạn đang lãng phí tính toán trên mã đóng gói.

## Sử dụng nó

### So sánh với huggingface dataset

Lắp cùng một bộ trong thư viện tập dữ liệu của HuggingFace và so sánh tốc độ đường ống.

```python
from datasets import load_dataset
from transformers import AutoTokenizer

ds = load_dataset("wikitext", "wikitext-2-raw-v1", split="train")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")

import time

start = time.time()
tokenized = ds.map(
    lambda x: tokenizer(x["text"], truncation=True, max_length=2048),
    batched=True,
    num_proc=4,
)
hf_time = time.time() - start
total_tokens = sum(len(t) for t in tokenized["input_ids"])
print(f"HuggingFace: {total_tokens:,} tokens in {hf_time:.2f}s ({total_tokens/hf_time:,.0f} tokens/sec)")
```

Tuyến ống HuggingFace sử dụng các token Rust dưới nắp và xử lý song song trên 4 lõi. Tuyến ống Python tinh khiết của bạn sẽ chậm hơn 10-50 lần. Đó là lý do tại sao các nhóm sản xuất sử dụng các token được biên soạn. thuật toán giống nhau. Ngôn ngữ thực hiện là sự khác biệt.

## Chuyển nó

Bài học này tạo ra một lời nhắc để xác nhận và debugging chất lượng dữ liệu trong LLM đào tạo ống dẫn.`outputs/prompt-data-quality-checker.md`- Tôi không biết.

## Các bài tập

1. **Easy:**Thêm phát hiện ngôn ngữ vào đường ống làm sạch bằng cách sử dụng một cách đơn giản (chân tích bộ ký tự).
2. **Medium:**Thực hiện tính sao chép chính xác bằng cách sử dụng sục hash SHA-256 cùng với sục sao chép gần MinHash. So sánh số lượng duplicate được bắt bởi mỗi phương pháp trên một bộ sục được thu thập trên web.
3. **Hard:**Xây dựng một bộ lọc chất lượng dựa trên sự bối rối. Cử lý một mô hình ngôn ngữ lớn nhỏ trên văn bản Wikipedia, đánh giá từng tài liệu theo sự bối rối, và loại bỏ phần dưới 20%. So sánh chất lượng đầu ra mô hình khi đào tạo trên dữ liệu lọc so với không lọc.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Common Crawl | "The internet" | A non-profit that crawls the web monthly -- ~250TB raw, the starting point for most LLM training data |
| MinHash | "Some hashing trick" | A technique to estimate Jaccard similarity between sets using fixed-size signatures -- enables near-duplicate detection at scale |
| LSH | "Locality-Sensitive Hashing" | A method to group similar items into the same bucket -- reduces pairwise comparisons from $O(n^2)$ to near-linear |
| Sequence packing | "Concatenating documents" | Fitting multiple documents into fixed-length sequences with proper attention masks -- eliminates padding waste |
| Chinchilla scaling | "Train on more data" | For a fixed compute budget, optimal performance requires scaling model size and training tokens roughly equally |
| Fertility | "Tokens per word" | Average number of tokens per word -- 1.3 for English in GPT-4, higher for non-Latin scripts |
| Data mixing | "Choosing training data" | The ratio of code vs text vs math vs multilingual data -- no formula, requires experimentation |
| Perplexity filter | "Quality scoring" | Use a small language model to score documents -- high perplexity means the text is unlike clean reference data |
| Deduplication | "Removing copies" | Eliminating exact and near-duplicate documents -- typically removes 30-40% of raw web data |
| Attention mask | "Which tokens to look at" | A binary mask that prevents attention across document boundaries in packed sequences |

## Đọc thêm

- [Hoffmann et al., 2022 -- Training Compute-Optimal Large Language Models (Chinchilla)](https://arxiv.org/abs/2203.15556)- bài báo đã thay đổi cách chúng ta nghĩ về quy mô dữ liệu
- [Penedo et al., 2023 -- The RefinedWeb Dataset for Falcon LLM](https://arxiv.org/abs/2306.01116)-- làm thế nào để lọc Common Crawl để chất lượng cao
- [Touvron et al., 2023 -- Llama 2: Open Foundation and Fine-Tuned Chat Models](https://arxiv.org/abs/2307.09288)-- chi tiết về đường ống dữ liệu cho Llama 2
- [Lee et al., 2022 -- Deduplicating Training Data Makes Language Models Better](https://arxiv.org/abs/2107.06499)- tại sao việc sao chép lại lại lại lại quan trọng hơn bạn nghĩ
- [Broder, 1997 -- On the Resemblance and Containment of Documents](https://ieeexplore.ieee.org/document/666900)- giấy MinHash gốc
- [Meta, 2024 -- Llama 3 Technical Report](https://arxiv.org/abs/2407.21783)-- 15,6T token, tỷ lệ trộn dữ liệu, lọc đường ống dẫn
