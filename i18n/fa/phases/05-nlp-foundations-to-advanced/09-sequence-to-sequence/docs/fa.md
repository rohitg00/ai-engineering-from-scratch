# مدل های تسلسل به تسلسل

> دو نفر از RNN که تظاهر به ترجمه کردن، شکاف که بهشون رسيده، دلیل وجود توجه است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## مشکل

طبقه بندی یک ردیف طول متغیر را به یک برچسب واحد نقشه می زند. ترجمه یک ردیف طول متغیر را به یک ردیف طول متغیر دیگر نقشه می زند. ورودی و خروجی در لغات مختلف، احتمالاً زبان های مختلف زندگی می کنند، بدون هیچ تضمینی از برابر طول.

معماری seq2seq (Sutskever, Vinyals, Le, 2014) این را با یک دستور ساده عمداً حل کرد. دو RNN. یکی عبارت منبع را می خواند و یک ویکتور زمینه با اندازه ثابت تولید می کند. دیگری آن ویکتور را می خواند و نشانه های جمله هدف را به صورت نشانه تولید می کند. همان کد که برای درس 08, به طور متفاوت به هم پیوند داده شده است.

این موضوع به دو دلیل ارزش مطالعه دارد. اول، گلو بطن وکتور زمینه از نظر آموزشی مفید ترین شکست در NLP است. این انگیزه هر چیزی را که توجه و ترانسفورماتورها خوب هستند. دوم، دستور آموزش (معلمان مجبور، نمونه گیری برنامه ریزی شده، جستجوی شعاع در نتیجه گیری) هنوز هم برای هر سیستم نسل مدرن از جمله LLM اعمال می شود.

## مفهوم

**Encoder.**يک RNN که جمله منبع رو ميخواد.**context vector** خلاصه ی اندازه ی ثابت از کل ورودی. چیزی جز منبع را از دست ندهید.

**Decoder.**RNN دیگری که از متری که در زمینه است شروع می شود. در هر مرحله، توکن تولید شده قبلی را به عنوان ورودی می گیرد و توزیع در لغات هدف را تولید می کند. نمونه یا argmax برای انتخاب توکن بعدی. آن را دوباره وارد کنید. تا یک `<EOS>`توکن تولید شده یا حداکثر طول ضربه خورده است.

**Training:**از دست دادن کراس انترپی در هر مرحله از دیکوتر، به ترتیب، پشت سرپوش استاندارد در طول زمان از طریق هر دو شبکه

**Teacher forcing.**در طول آموزش، ورودی دیکودر در مرحله ای`t`نشاني * اصل حقیقت* در موقعیت است`t-1`در نتیجه، شما باید از پیش بینی های مدل خود استفاده کنید، بنابراین همیشه شکاف توزیع قطار/انفرنس وجود دارد. این شکاف به نام**exposure bias**. .

**The bottleneck.**هر چیزی که کدگر در مورد منبع یاد گرفته است باید به آن یک ویکتور زمینه فشرده شود. جمله های طولانی جزئیات را از دست می دهند. کلمات نادر محو می شوند. تنظیم مجدد (چات نویر در مقابل گربه سیاه) باید به یاد گرفته شود، نه محاسبه شود.

توجه (درسه 10) این را با اجازه دادن به کدهای بازبینی به *هر * کدهای پنهان حالت را، نه فقط آخرین حالت را، حل می کند. این کل صدای است.

```figure
lstm-gates
```

## آن را بسازید

### مرحله اول: یک کدگر

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

`outputs`شکل داره`[batch, seq_len, hidden_dim]` یک حالت پنهان در هر موقعیت ورودی. `hidden`شکل داره`[1, batch, hidden_dim]`در درس 08 گفته شده است "با هم جمع آوری درجات برای طبقه بندی". در اینجا ما آخرین حالت پنهان را به عنوان متری زمینه نگه می داریم و در نتیجه درجات هر مرحله را نادیده می گیریم.

### مرحله دوم: یک دیکوتر

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

کد کدگر به عنوان یک مرحله در یک زمان نامیده می شود. ورودی: یک دسته از توکن های واحد و حالت پنهان فعلی. خروجی: ثبت لغت برای توکن بعدی و حالت پنهان به روز شده.

### مرحله سوم: حلقه آموزش با آموزش معلم

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

دو تا دکمه که ارزش نام دادن رو داره`ignore_index=0`از دست دادن توکن های پر کردن استفاده می کنه`teacher_forcing_ratio`احتمال استفاده از توکن واقعی در مقابل پیش بینی مدل در هر مرحله است. از 1.0 (جبر کامل معلم) شروع کنید و تا ~0.5 در طول آموزش کاهش دهید تا شکاف تعصب در معرض را ببندید.

### مرحله 4: حلقه نتیجه گیری (طمع)

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

طمع رمزگذاری، هر قدم احتمال بالا را انتخاب می کند. می تواند دور برود: وقتی به یک رمز متعهد می شوید، نمی توانید آن را رد کنید.**Beam search**...بندهاي بالا رو نگه داره`k`قطعات جزئی زنده و بالاترین امتیاز را در پایان انتخاب می کند. عرض شعاع 3-5 استاندارد است.

### مرحله 5: گلو بطری، نشان داده شده

مدل را در یک کار کپی بازی آموزش دهید: منبع `[a, b, c, d, e]`، هدف`[a, b, c, d, e]`طول دنباله رو افزایش بده دقت رو مشاهده کن

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

یک حالت پنهان GRU نمی تواند یک ورودی 40 توکن را بدون ضرر حفظ کند. اطلاعات در هر مرحله کدگذاری وجود دارد، اما کدگذاری کننده تنها آخرین حالت را می بیند. توجه این را مستقیماً تصحیح می کند.

## ازش استفاده کن

پيتورچ داره`nn.Transformer`و`nn.LSTM`-بنياد بر قالب هاي "ساقي"`transformers`کتابخانه ها مدل های کامل کدگذاری و کدگذاری (BART، T5، mBART، NLLB) را بر روی میلیارد ها توکن آموزش می دهند.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

کدرهای مدرن RNN ها را برای ترانسفورماتورها حذف کردند. شکل سطح بالا (اینکودر، دیکودر، تولید نماد از طریق نماد) با کاغذ seq2seq 2014 یکسان است. مکانیسم درون هر بلوک متفاوت است.

### چه زمانی باید هنوز به دنبال دنباله های مبتنی بر RNN باشید

تقریباً هرگز، برای پروژه های جدید استثنایی خاص:

- ترجمه پخش شده که شما یک توکن در یک زمان با حافظه محدود وارد می کنید.
- تولید متن در دستگاه که هزینه حافظه ترانسفورماتور ممنوع است.
- آموزش. درک گلوچه ی کدر و کادر سریع ترین راه برای درک اینکه چرا ترانسفورماتورها برنده شدند.

### تعصب در معرض قرار گرفتن و کاهش آن

- **Scheduled sampling.**نسبت اجباری معلم در طول آموزش به طوری که مدل یاد بگیرد از اشتباهات خودش بهبود پیدا کند.
- **Minimum risk training.**به جای توکن های متقابل در سطح جمله، به نمره BLEU تمرین کنید.
- **Reinforcement learning fine-tuning.**ژنراتور دنباله رو با یک متریک پاداش بده

سه تا از این موارد هنوز هم برای تولید مبتنی بر ترانسفورماتور اعمال می شوند.

## -باده

پس از`outputs/prompt-seq2seq-design.md`:

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

## تمرینات

1. **Easy.**انجام کار کپی بازی. تمرین یک GRU seq2seq در جفت های ورودی و خروجی که هدف برابر با منبع است. دقت را در طول 5, 10, 20 اندازه گیری کنید.
2. **Medium.**کدگذاری جستجوی شعاع با عرض شعاع 3. BLEU را در یک کورپوس موازی کوچک در برابر طمع اندازه گیری کنید. سندی که جستجوی شعاع برنده می شود (معمولا آخرین توکن) و جایی که هیچ تفاوت ای ندارد.
3. **Hard.**- خوب -`facebook/bart-base`در یک مجموعه داده های 10k-pair paraphrase مقایسه کنید. محصول بیام-4 مدل خوب با محصول پایه مدل های ذخیره شده. گزارش BLEU و 10 مثال کوالیتی را انتخاب کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## خواندن بیشتر

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) کاغذ اصلی seq2seq. چهار صفحه
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) GRU و فریمگذاری کدرها و کدرها را معرفی کرد.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- کاغذ توجه. بلافاصله بعد از این درس بخونید.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) کد قابل ساخت seq2seq + توجه
