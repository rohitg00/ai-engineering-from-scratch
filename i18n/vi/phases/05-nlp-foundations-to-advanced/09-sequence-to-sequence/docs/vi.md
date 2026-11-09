# Mô hình theo trình tự

> Hai người RNN giả vờ là một người dịch, và cái nút thắt họ gặp là lý do sự chú ý tồn tại.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## Vấn đề

Việc phân loại lập bản đồ một chuỗi dài biến cho một nhãn duy nhất. Dịch bản đồ một chuỗi dài biến cho một chuỗi dài khác.

Kiến trúc seq2seq (Sutskever, Vinyals, Le, 2014) đã phá vỡ điều này bằng một công thức đơn giản cố ý. Hai RNN. Một đọc câu nguồn và tạo ra một vector ngữ cảnh kích thước cố định.

Điều này đáng để nghiên cứu vì hai lý do. Thứ nhất, nút bốc vắc-tơ ngữ cảnh là thất bại hữu ích nhất về mặt giáo dục trong NLP. Nó thúc đẩy mọi thứ sự chú ý và các bộ biến đổi đều giỏi. Thứ hai, công thức đào tạo (bắt buộc giáo viên, lấy mẫu theo lịch trình, tìm kiếm chùm khi suy luận) vẫn áp dụng cho mọi hệ thống thế hệ hiện đại bao gồm LLM.

## Khái niệm

**Encoder.**Một RNN đọc câu nguồn.**context vector** một bản tóm tắt quy mô cố định của toàn bộ đầu vào.

**Decoder.**Một RNN khác được khởi tạo từ vector ngữ cảnh. Tại mỗi bước nó lấy token được tạo trước đó như là đầu vào và tạo ra phân phối trên từ vựng mục tiêu. Sample hoặc argmax để chọn token tiếp theo. Đưa nó lại.`<EOS>`token được tạo ra hoặc chiều dài tối đa được đạt.

**Training:**Lỡ entropy chéo ở mỗi bước giải mã, tổng hợp qua chuỗi.

**Teacher forcing.**Trong quá trình đào tạo, đầu vào của máy giải mã theo từng bước `t`là biểu tượng thực tại tại vị trí`t-1`, không phải dự đoán trước của máy giải mã. Điều này ổn định đào tạo; nếu không có nó, sai lầm sớm rơi vào tình trạng ngập và mô hình không bao giờ học.**exposure bias**- Tôi không biết.

**The bottleneck.**Tất cả những gì mà bộ mã hóa đã học về nguồn phải được nén vào một vector ngữ cảnh. Các câu dài mất chi tiết. Các từ hiếm bị mờ. Việc sắp xếp lại (chat noir vs. black cat) phải được ghi nhớ, không phải tính toán.

Sự chú ý (câu 10) khắc phục điều này bằng cách cho phép máy giải mã xem * mỗi * trạng thái ẩn của bộ giải mã, không chỉ là trạng thái cuối cùng. Đó là toàn bộ độ.

```figure
lstm-gates
```

## Hãy xây dựng nó

### Bước 1: một bộ mã hóa

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs`có hình dạng`[batch, seq_len, hidden_dim]` một trạng thái ẩn cho mỗi vị trí đầu vào. `hidden`có hình dạng`[1, batch, hidden_dim]` bước cuối cùng. Bài học 08 nói "lập lại các đầu ra để phân loại". Ở đây chúng ta giữ trạng thái ẩn cuối cùng như là vector ngữ cảnh, và bỏ qua các đầu ra từng bước.

### Bước 2: một máy giải mã

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

Các mã hóa được gọi là một bước một lần. Nhập: một loạt các mã thông báo đơn lẻ và trạng thái ẩn hiện tại.

### Bước 3: vòng đào tạo với giáo viên buộc

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

Hai nút đáng để đặt tên.`ignore_index=0`bỏ qua lỗ trên mã đệm. `teacher_forcing_ratio`là xác suất sử dụng token thực so với dự đoán của mô hình tại mỗi bước. Bắt đầu từ 1.0 (bắt buộc giáo viên đầy đủ) và giảm xuống đến ~0.5 qua đào tạo để đóng cửa khoảng cách thiên vị tiếp xúc.

### Bước 4: vòng suy luận (cười tham)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

Việc giải mã tham lam chọn token có khả năng cao nhất ở mỗi bước. Nó có thể đi lang thang: một khi bạn cam kết với một token, bạn không thể giải quyết nó. **Beam search**giữ cho hàng đầu...`k`Dòng phân tích sống và chọn điểm số cao nhất hoàn chỉnh ở cuối.

### Bước 5: nút chai, được chứng minh

Trình luyện mô hình để làm việc sao chép đồ chơi: nguồn `[a, b, c, d, e]`, mục tiêu`[a, b, c, d, e]`- Tăng chiều dài chuỗi.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Một trạng thái ẩn GRU duy nhất không thể ghi nhớ một đầu vào 40 token mà không mất. Thông tin ở đó ở mỗi bước mã hóa, nhưng máy giải mã chỉ nhìn thấy trạng thái cuối cùng.

## Sử dụng nó

PyTorch đã có `nn.Transformer`và `nn.LSTM`- dựa trên các mẫu seq2seq.`transformers`các máy tính thư viện đầy đủ các mô hình mã hóa-chế vị (BART, T5, mBART, NLLB) được đào tạo trên hàng tỷ token.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Các bộ mã hóa-chế vị hiện đại đã loại bỏ RNN cho các bộ biến đổi. Hình dạng cấp cao (chế vị mã hóa, mã hóa, tạo mã thông báo theo mã thông báo) giống nhau với giấy seq2seq 2014. Cơ chế bên trong mỗi khối khác nhau.

### Khi nào vẫn cần tìm ra seq2seq dựa trên RNN

Hầu như không bao giờ, đối với các dự án mới.

- Truyền dịch trực tuyến nơi bạn tiêu thụ đầu vào một token một lúc với bộ nhớ bị giới hạn.
- Tạo văn bản trên thiết bị nơi chi phí bộ nhớ biến đổi là cấm kỵ.
- Nghĩ về rào cản mã hóa và giải mã là cách nhanh nhất để hiểu tại sao các bộ biến đổi thắng.

### Sự thiên vị phơi nhiễm và giảm thiểu của nó

- **Scheduled sampling.**Tỷ lệ buộc giáo viên trong quá trình đào tạo để mô hình học cách phục hồi khỏi những sai lầm của mình.
- **Minimum risk training.**Trén theo điểm số BLEU ở mức câu thay vì sự tham gia chéo ở mức token.
- **Reinforcement learning fine-tuning.**Hãy thưởng cho máy phát ra chuỗi bằng một số liệu được sử dụng trong LLM RLHF hiện đại.

Cả ba vẫn áp dụng cho thế hệ dựa trên biến thể.

## Chuyển nó

Cứ như `outputs/prompt-seq2seq-design.md`- Có thể là:

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Các bài tập

1. **Easy.**Thực hiện nhiệm vụ sao chép đồ chơi. Tập một GRU seq2seq trên các cặp đầu vào-kết ra nơi mục tiêu bằng với nguồn. đo độ chính xác ở độ dài 5, 10, 20.
2. **Medium.**Thêm mã hóa tìm kiếm chùm với chiều rộng chùm 3. đo BLEU trên một bộ phận song song nhỏ chống lại tham lam. Tài liệu nơi tìm kiếm chùm thắng (thường là token cuối cùng) và nơi nó không tạo ra sự khác biệt.
3. **Hard.**- Đúng rồi.`facebook/bart-base`trên một bộ dữ liệu phác thảo 10k-pair. So sánh đầu ra chùm-4 của mô hình được điều chỉnh tốt với đầu ra cơ bản của mô hình. báo cáo BLEU và chọn 10 ví dụ chất lượng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## Đọc thêm

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) giấy gốc của nó.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) giới thiệu GRU và khung mã hóa-chế vị mã hóa.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) giấy chú ý. Đọc ngay sau bài học này.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) buildable seq2seq + code chú ý.
