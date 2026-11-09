# سی ان ان و آر ان ان برای متن

> کنولوش ها n-گرام یاد می گیرند. تکرار ها به یاد می آورند. هر دو توسط توجه جایگزین می شوند. هر دو هنوز هم در سخت افزار محدود اهمیت دارند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## مشکل

TF-IDF و Word2Vec متری های صاف تولید کردند که ترتیب کلمات را نادیده می گرفتند.`dog bites man`از`man bites dog`.در نظم کلمات بعضی وقتا سیگنال میبرسه

دو خانواده از معماری قبل از ورود ترانسفورماتورها این شکاف را پر کردند.

**Convolutional nets for text (TextCNN).**یک فیلتر با عرض 3 یک آشکارگر تریگرام قابل یادگیری است: سه کلمه را پوشش می دهد و یک امتیاز را تولید می کند. برای تشخیص الگوهای چند مقیاس، عرض های مختلف (2، 3، 4، 5) را جمع آوری کنید. حداکثر مجموعه به یک نمایش اندازه ثابت. صاف، موازی، سریع.

**Recurrent nets (RNN, LSTM, GRU).**توکن های پردازش یک به یک زمان، حفظ یک حالت پنهان که اطلاعات را به جلو حمل می کند. طول ورودی انعطاف پذیر و قابل توجه. مدل سازی تسلط از سال 2014 تا 2017، پس از توجه اتفاق افتاد.

این درس هر دو را می سازد، سپس شکست را که توجه را تحریک می کند نام می دهد.

## مفهوم

**TextCNN**(کیم، 2014) توکن ها وارد می شوند.`k`یک پیچ 1D یک فیلتر را در یک سری سری حرکت می دهد `k`-گرام های گنجانده شده، تولید یک نقشه ویژگی. جمع بندی حداکثر جهانی بر روی آن نقشه قوی ترین فعال سازی را انتخاب می کند. تولیدات جمع بندی حداکثر از چندین عرض فیلتر را ترکیب می کند. به یک سر طبقه بندی کننده تغذیه می کند.

چرا کار می کند؟ فیلتر یک n-گرام قابل یادگیری است. مکس-پولینگ تغییر موقعیت دارد، بنابراین "خوب نیست" در شروع یا وسط یک بررسی ویژگی مشابهی را می گیرد. سه عرض فیلتر با 100 فیلتر هر کدام به شما 300 آشکارساز n-گرام آموخته می شود. آموزش موازی است؛ هیچ وابستگی دنباله دار نیست.

**RNN.**در هر مرحله`t`، حالت پنهان`h_t = f(W * x_t + U * h_{t-1} + b)`. اشتراک گذاری`W`،`U`،`b`در طول زمان، حالت پنهان در زمان`T`برای طبقه بندی، جمع بندی در سراسر`h_1 ... h_T`(زیاد، متوسط یا آخر)

RNN های ساده دچار انحدار های ناپدید می شوند.**LSTM**دروازه هایی را اضافه می کند که تصمیم می گیرند چه چیزی را فراموش کنند، چه چیزی را ذخیره کنند و چه چیزی را تولید کنند، که گرادینت ها را از طریق دنباله های طولانی پایدار می کند.**GRU**LSTM را به دو دروازه ساده می کند؛ عملکرد مشابهی با پارامترهای کمتر دارد.

**Bidirectional RNNs**یک RNN را به جلو و دیگری به عقب اجرا کنید، حالت های پنهان را به هم متصل کنید. نمایش هر توکن هم زمینه چپ و هم راست را می بیند. برای تگ کردن وظایف ضروری است.

```figure
rnn-unroll
```

## آن را بسازید

### مرحله ی اول: متنCNN در PyTorch

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

.`transpose(1, 2)`شکل مجدد`[batch, seq_len, embed_dim]`به`[batch, embed_dim, seq_len]`چون`nn.Conv1d`محور وسط را به عنوان کانال ها در نظر می گیرد. تولید جمع شده بدون توجه به طول ورودی اندازه ثابت است.

### مرحله دوم: طبقه بندی LSTM

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

برای طبقه بندی، جمع بندی حداکثر معمولاً آخرین حالت پنهان را می گیرد زیرا اطلاعات در پایان یک دنباله طولانی تمایل به تسلط بر آخرین حالت دارد.

### مرحله 3: نمایش گرادینتی ناپدید (دستشویی)

یک RNN ساده بدون گاتینگ نمی تواند وابستگی های بلند مدت را یاد بگیرد.`A`هر جايي در يک دنباله ظاهر شد`A`در حالت 1 و دنباله 100 توکن طول دارد، گرادینت از از دست دادن باید از طریق 99 ضرب وزن تکراری جریان کند. اگر وزن کمتر از 1 باشد، گرادینت ناپدید می شود. اگر بیش از 1 باشد، انفجار می کند.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM ها با يه**cell state**این سیستم در حال انجام کار مشابهی با پارامترهای کمتر است. هر دو به شما آموزش پایدار از طریق 100+ ردیف مرحله ای می دهند.

### مرحله چهارم: چرا هنوز این کافی نبود

سه مشکل حتی با LSTM ها همچنان باقی مانده است.

1. **Sequential bottleneck.**آموزش یک RNN در یک دنباله طول 1000 نیاز به 1000 مرحله متوالی پیش / عقب دارد. نمی تواند در طول زمان موازی شود.
2. **Fixed-size context vector in encoder-decoder setups.**کدگر تنها حالت پنهان نهایی کدگر را می بیند که در کل ورودی فشرده شده است. ورودی های طولانی جزئیات را از دست می دهند. درس 09 این را مستقیما پوشش می دهد.
3. **Distant-dependency accuracy ceiling.**LSTM ها عملکرد ساده RNN ها را از دست می دهند اما هنوز برای گسترش اطلاعات خاص در بیش از 200 مرحله تلاش می کنند.

توجه سه تا رو حل کرد. ترانسفورمرها تکرار رو کاملاً کاهش دادند. درس 10 محور است.

## ازش استفاده کن

"پایتورچ"`nn.LSTM`،`nn.GRU`و`nn.Conv1d`آماده تولید هستند. کد آموزش استاندارد است.

چشمان کشتی ها قبل از آموزش دربندی شما به عنوان لایه ورودی وصل می شود:

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

لیست چک محدودیت استفاده از زمانی که مناسب باشد

- **Edge / on-device inference.**TextCNN با GloVe گنجانده شده 10-100 برابر کوچکتر از یک ترانسفورماتور است. اگر هدف انتشار شما یک تلفن است، این استک است.
- **Streaming / online classification.**RNN یک توکن را در یک زمان پردازش می کند؛ ترانسفورماتورها به دنباله کامل نیاز دارند. برای متن ورودی در زمان واقعی، LSTM ها هنوز برنده می شوند.
- **Tiny models for baselines.**تکرار سریع در یک کار جدید، آموزش یک متن CNN در 5 دقیقه با یک CPU.
- **Sequence labeling with limited data.**BiLSTM-CRF (درسی 06) هنوز یک معماری NER درجه تولید برای جمله های برچسب شده 1k-10k است.

همه چيز ديگه به يه ترانسفورماتور ميره

## -باده

پس از`outputs/prompt-text-encoder-picker.md`:

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

## تمرینات

1. **Easy.**آموزش یک TextCNN در یک مجموعه داده های ۳ کلاس اسباب بازی (شما داده ها را اختراع می کنید). بررسی کنید که عرض فیلتر (2، 3, 4) در میانگین F1 از عرض واحد (3) بهتر است.
2. **Medium.**برای طبقه بندی کننده LSTM جمع بندی حداکثر، میانگین و آخرین حالت را پیاده سازی کنید. در یک مجموعه داده کوچک مقایسه کنید؛ سندی که جمع بندی برنده است و فرضیه ای را برای اینکه چرا.
3. **Hard.**یک برچسب NER BiLSTM-CRF بسازید (درسی 06 و این را ترکیب کنید). آموزش در CoNLL-2003. با خط اصلی CRF- تنها از درس 06 و با یک تنظیم دقیق BERT مقایسه کنید. زمان آموزش، حافظه و F1 را گزارش کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## خواندن بیشتر

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)روزنامه متن CNN هشت صفحه قابل خواندن
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf)کاغذ LSTM. به طرز غیر منتظره روشن
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) نمودار هایی که LSTM ها را برای همه قابل دسترسی ساختند.
