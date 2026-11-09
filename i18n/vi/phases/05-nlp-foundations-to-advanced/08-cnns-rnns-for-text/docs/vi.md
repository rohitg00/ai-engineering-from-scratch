# CNN và RNN cho Text

> Convolutions học n-gram, recidivities nhớ, cả hai đều bị thay thế bởi sự chú ý, cả hai vẫn quan trọng trên phần cứng bị hạn chế.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## Vấn đề

TF-IDF và Word2Vec tạo ra các vector phẳng mà bỏ qua thứ tự từ.`dog bites man`từ `man bites dog`Đôi khi, thứ tự từ ngữ là tín hiệu.

Hai gia đình kiến trúc đã lấp đầy khoảng trống đó trước khi các nhà biến đổi đến.

**Convolutional nets for text (TextCNN).**Sử dụng các biến dạng 1D trên các chuỗi các chữ nhúng. Một bộ lọc chiều rộng 3 là một bộ dò hình ba chữ được học: nó trải dài ba từ và đưa ra một điểm số. Lắp xếp chiều rộng khác nhau (2, 3, 4, 5) để phát hiện các mẫu đa quy mô. Max-pool đến một đại diện kích thước cố định. Dũng, song song, nhanh.

**Recurrent nets (RNN, LSTM, GRU).**xử lý token một lần, duy trì một trạng thái ẩn mang thông tin về phía trước. Dường độ đầu vào liên tục, ghi nhớ, linh hoạt. Mô hình hóa chuỗi thống trị từ năm 2014 đến năm 2017, sau đó sự chú ý xảy ra.

Bài học này xây dựng cả hai, sau đó đặt tên thất bại đã thúc đẩy sự chú ý.

## Khái niệm

**TextCNN**(Kim, 2014). Các token được nhúng.`k`1D convolution slide một bộ lọc trên liên tiếp `k`-gram của các nhúng, tạo ra một bản đồ tính năng. toàn cầu max-pooling trên bản đồ đó chọn kích hoạt mạnh nhất. Concatenate max-pooled đầu ra từ nhiều độ rộng bộ lọc. cung cấp cho một đầu phân loại.

Tại sao nó hoạt động. Một bộ lọc là một n-gram có thể học được. Max-pooling là không thay đổi vị trí, vì vậy "không tốt" bắn cùng một tính năng vào đầu hoặc giữa một đánh giá. Ba chiều rộng bộ lọc với mỗi bộ lọc 100 cho bạn 300 máy dò n-gram học.

**RNN.**Mỗi bước đi`t`, trạng thái ẩn`h_t = f(W * x_t + U * h_{t-1} + b)`- Chia sẻ`W`- `U`- `b`Trong thời gian, trong trạng thái ẩn trong thời gian.`T`là một bản tóm tắt của toàn bộ tiền tố.`h_1 ... h_T`(tối đa, trung bình hoặc cuối cùng).

Các RNN đơn giản bị biến mất gradient.**LSTM**thêm các cổng quyết định những gì để quên, những gì để lưu trữ, và những gì để ra, ổn định gradient thông qua chuỗi dài.**GRU**đơn giản hóa LSTM thành hai cổng; hoạt động tương tự với ít tham số hơn.

**Bidirectional RNNs**chạy một RNN về phía trước và một RNN trở lại, liên kết các trạng thái ẩn.

```figure
rnn-unroll
```

## Hãy xây dựng nó

### Bước 1: TextCNN bằng PyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

- `transpose(1, 2)`hình dạng lại `[batch, seq_len, embed_dim]`đến`[batch, embed_dim, seq_len]`Vì `nn.Conv1d`xử lý trục trung tâm như các kênh.

### Bước 2: Định dạng LSTM

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

Max-pool trên chuỗi, không phải là pool trạng thái cuối cùng. Đối với phân loại, max-pooling thường đánh bại việc lấy trạng thái ẩn cuối cùng vì thông tin ở cuối một chuỗi dài có xu hướng thống trị trạng thái cuối cùng.

### Bước 3: trình diễn gradient biến mất (thấu hiểu)

Một RNN đơn giản mà không có gài không thể học các phụ thuộc tầm xa.`A`xuất hiện ở bất cứ đâu trong một chuỗi.`A`Nếu các hàm này được chuyển đổi từ 0 đến 0, thì các hàm này sẽ được chuyển đổi từ 0 đến 0, nếu chúng ở vị trí 1 và chuỗi dài 100 token, độ lệch từ mất mát phải chảy trở lại thông qua 99 lần của trọng lượng tái phát.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTMs sửa chữa điều này với một **cell state**Các GRU làm điều tương tự với ít tham số hơn. Cả hai đều cung cấp cho bạn đào tạo ổn định thông qua 100+ chuỗi bước.

### Bước 4: tại sao điều này vẫn chưa đủ

Ba vấn đề vẫn tồn tại ngay cả với LSTM.

1. **Sequential bottleneck.**Việc đào tạo một RNN trên một chuỗi dài 1000 đòi hỏi 1000 bước tiến/lái lại hàng loạt. Không thể song song qua thời gian.
2. **Fixed-size context vector in encoder-decoder setups.**Các bộ giải mã chỉ nhìn thấy trạng thái ẩn cuối cùng của bộ mã hóa, được nén trên toàn bộ đầu vào.
3. **Distant-dependency accuracy ceiling.**LSTM vượt trội hơn RNN đơn giản nhưng vẫn gặp khó khăn trong việc truyền bá thông tin cụ thể qua hơn 200 bước.

Sự chú ý đã giải quyết cả ba, biến đổi đã giảm hoàn toàn sự tái phát, bài học 10 là trọng tâm.

## Sử dụng nó

PyTorch's `nn.LSTM`- `nn.GRU`, và`nn.Conv1d`Có thể làm việc với các nhà sản xuất.

Chuyển mặt tàu được đào tạo trước khi nhúng bạn cắm vào như là lớp đầu vào:

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

Danh sách kiểm tra khi nào phù hợp với giới hạn.

- **Edge / on-device inference.**TextCNN với nhúng GloVe nhỏ hơn 10-100 lần so với một biến thể. Nếu mục tiêu triển khai của bạn là điện thoại, đây là đống.
- **Streaming / online classification.**RNN xử lý một token một lúc; các bộ chuyển đổi cần toàn bộ chuỗi. Đối với văn bản nhập vào thời gian thực, LSTM vẫn thắng.
- **Tiny models for baselines.**Lập trình nhanh trên một nhiệm vụ mới.
- **Sequence labeling with limited data.**BiLSTM-CRF (câu 06), vẫn là một kiến trúc NER cấp sản xuất cho 1k-10k đánh dấu câu.

Mọi thứ khác đều đi đến một bộ biến đổi.

## Chuyển nó

Cứ như `outputs/prompt-text-encoder-picker.md`- Có thể là:

```markdown
---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "use a pretrained transformer as a frozen encoder + small head".
2. Embedding input: random init, GloVe / fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. For RNN/CNN models: attention mechanism absence means they miss long-range deps; check per-length accuracy. For transformers: fine-tuning collapse if LR too high; check train loss.

Refuse to recommend fine-tuning a transformer when data is under ~500 labeled examples without showing that a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment as needing architecture-before-everything.
```

## Các bài tập

1. **Easy.**Đào tạo một TextCNN trên một bộ dữ liệu đồ chơi 3 lớp (bạn phát minh ra dữ liệu).
2. **Medium.**Thực hiện tập hợp tối đa, trung bình và trạng thái cuối cùng cho trình phân loại LSTM. So sánh trên một tập dữ liệu nhỏ; tài liệu tập hợp nào thắng và giả định lý do tại sao.
3. **Hard.**Xây dựng thẻ BiLSTM-CRF NER (combination lesson 06 and this one). Trén trên CoNLL-2003. So sánh với CRF-Alone baseline từ lesson 06 và BERT fine-tune.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## Đọc thêm

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) tờ TextCNN. 8 trang.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) giấy LSTM.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) các sơ đồ làm cho LSTMs có thể tiếp cận với mọi người.
