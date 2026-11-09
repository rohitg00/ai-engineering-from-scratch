# مکانیسم توجه  پیشرفت

> دیکودر به دنبال خلاصه ای فشرده می ماند و شروع به بررسی کل منبع می کند. بعد از این همه چیز توجه و مهندسی است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## مشکل

درس 09 با شکست اندازه گیری شده به پایان رسید. یک کدگر GRU کدگر-decoder آموزش دیده در یک کار کپی بازی از 89٪ دقت در طول 5 به نزدیک به شانس در طول 80 می رسد. دلیل ساختاری است، نه یک خطا آموزش: هر بیت اطلاعات کدگر جمع آوری شده باید در یک حالت پنهان اندازه ثابت قرار گیرد و کدگر هرگز چیزی دیگر را نمی بیند.

بهادناو، چو و بنگیو در سال 2014 یک اصلاح سه خط منتشر کردند. به جای اینکه به کدهایر تنها وضعیت کدگذاری نهایی را ارائه دهید، هر کدگذاری را در حالت کدگذاری نگه دارید. در هر مرحله کدهایر، یک متوسط وزن شده از حالت کدگذاری را محاسبه کنید که در آن وزن ها می گویند "کدام مقدار کدهایر باید به موقعیت کدگر نگاه کند.`i`این متوسط وزن شده، زمینه است، و هر مرحله ی دیکودر را تغییر می دهد.

این ایده است. ترانسفورمرها آن را گسترش دادند. خود توجه آن را به یک ردیف واحد اعمال کرد. توجه چند سر آن را به طور موازی اجرا کرد. اما نسخه 2014 قبلا گلو بطری را شکسته است، و هنگامی که شما آن را دارید، محور ترانسفورمرها مهندسی است، نه مفهومی.

## مفهوم

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

در هر مرحله از کد کنده`t`:

1. از حالت پنهان دیکودر قبلی استفاده کنید`s_{t-1}`به عنوان یک**query**. .
2. با هر حالت پنهان کدرها نمره بده`h_1, ..., h_T`. يک اسکالر در هر موقعیت کدرها
3. نرم کردن نمره ها تا وزن توجه رو بدست بيار`α_{t,1}, ..., α_{t,T}`این مقدار به 1 می رسد.
4. متور متن`c_t = Σ α_{t,i} * h_i`. متوسط وزن شده حالت های کدرها
5. ديكودر ميخواد`c_t`اضافه کردن توکن خروجی قبلی، توکن بعدی را تولید می کند.

متوسط وزن شده نقطه است. وقتی که دیکودر باید "Je" را به "I" ترجمه کند، حالت کدگر را بیش از "Je" بالا و بقیه را پایین تر می کند. وقتی نیاز به "نه" دارد، وزن "پاس" بالا را می کند. ویکتور زمینه هر مرحله را تغییر شکل می دهد.

## شکل ها (چیزی که همه را گاز می گیرد)

اينجوري هر اجرا توجه اولين بار اشتباه مي گيره. آهسته بخونيد.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`. .

- `s_{t-1}`شکل داره`(d_s,)`،`h_i`شکل داره`(d_h,)`. .
- `W_a`شکل داره`(d_attn, d_s)`.`U_a`شکل داره`(d_attn, d_h)`. .
- جمعشون داخل تانش شکل داره`(d_attn,)`. .
- `v_α`شکل داره`(d_attn,)`. محصول داخلي با`v_α`به يک سطح تراز سقوط ميکنه**This is what `v_α` does.**این جادویی نیست. این پروژکتور است که یک ویکتور توجه را به یک امتیاز اسکالر تبدیل می کند.

**Luong (multiplicative) score.**سه نوع:

- `dot`.`e_{t,i} = s_t^T * h_i`. نیاز داره`d_s == d_h`. محدودیت سخت . اگه کدگر دو طرفه باشه ردش کن
- `general`.`e_{t,i} = s_t^T * W * h_i`با`W`شکل`(d_s, d_h)`. محدودیت برابر رنگی را حذف می کند
- `concat`: اساساً فرم Bahdanau. به ندرت استفاده می شود زیرا دو نوع اول ارزان تر هستند.

**One Bahdanau / Luong gotcha worth naming.**بهادناو استفاده می کنه`s_{t-1}`(دستگاه رمزنگاري * قبل از* توليد کلمه فعلی)`s_t`(حالت * بعد*) مخلوط کردن آنها به gradients ظریف که بسیار سخت برای debug است تولید می کند. یک کاغذ را انتخاب کنید و به کنوانسیون خود را.

```figure
attention-heatmap
```

## آن را بسازید

### مرحله ی اول: توجه افزودنی (بهادناو)

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

شکلات رو با ميز بالا ببين`encoder_states`شکل داره`(T_enc, d_h)`.`projected_enc`شکل داره`(T_enc, d_attn)`.`projected_dec`شکل داره`(d_attn,)`و پخش.`combined`شکل داره`(T_enc, d_attn)`.`scores`شکل داره`(T_enc,)`.`weights`شکل داره`(T_enc,)`.`context`شکل داره`(d_h,)`-بذارش بره

### مرحله دوم: نقطه و عمومی لونگ

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

سه خط در هر، به همین خاطر کاغذ لونگ فرود آمد، درست بودن بیشتر کارها، کمی کم تر کد

### مرحله 3: یک مثال عددی کار شده

با توجه به سه حالت کدرها (تقریباً "cat", "sat", "mat") و یک حالت کدرها که بیشترین تعادل با اولین حالت را دارد، توزیع توجه به موقعیت 0 متمرکز می شود. اگر حالت کدرها برای تعادل با آخرین حالت تغییر کند، توجه به موقعیت 2 حرکت می کند.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

اولين خط برنده ميشه. بعد حالت کلاهبرداري را به حالت سوم کلاهبردار نزديک تر كنيد و تغيير وزن را تماشا كنيد.

### مرحله 4: چرا این پل به ترانسفورماتورهاست

زبان بالا را به Q/K/V ترجمه کنید:

- **Query**= حالت دیکوتر`s_{t-1}`
- **Key**= حالت های کدرها (که با آن امتیاز می دهیم)
- **Value**= حالت های کدرها (چه چیزی وزن و جمع می کنیم)

در توجه کلاسیک، کلید ها و ارزش ها یکسان هستند. توجه به خود آنها را جدا می کند: شما می توانید یک دنباله را در مقابل خود با طرح های مختلف آموخته برای K و V سوال کنید. توجه چند سر آن را به طور موازی با طرح های مختلف آموخته اجرا می کند. ترانسفورمرها تمام مرحله را چندین بار جمع می کنند و RNN ها را رها می کنند.

ریاضیات یکسان است. شکل ها یکسان هستند. پرتاب آموزشی از توجه به Bahdanau به توجه به نقطه محصول مقیاس بندی عمدتاً اشاره است.

## ازش استفاده کن

پي تورچ و تانسور فلو به طور مستقیم توجه رو به ما ميده

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

این یک لایه توجه ترانسفورماتور است. دسته سوال از 5 موقعیت، دسته کلید/قيمة از 10 موقعیت، هر یک 128 ابعاد، 8 سر.`output`این سوال های جدید و افزوده شده در زمینه است.`weights`این ماتریس 5×10 است که می توانید آن را تصور کنید.

### وقتي توجه کلاسیک هنوز مهمه

- آموزش. نسخه ی یک سر، یک لایه، مبتنی بر RNN هر مفهوم را قابل مشاهده می کند.
- وظایف ردیابی در دستگاه که ترانسفورماتورها مناسب نیستند.
- هر مقاله ای از سال 2014 تا 2017 که بدون دانستن کنوانسیون بهادناو درست نمی خواد
- تجزیه و تحلیل موازی با غلات نازک در MT. وزن های توجه خام یک ابزار تفسیر حتی در مدل های ترانسفورماتور هستند و خواندن آنها نیاز به دانستن آنها دارد.

### تله توجه وزن به عنوان توضیح

وزن توجه به نظر می رسد قابل تفسیر است. آنها وزن هایی هستند که به یک نفر در سراسر موقعیت ها اضافه می شوند؛ شما می توانید آنها را نقشه برداری کنید؛ بلند به معنای "به این نگاه کنید". منتقدان آنها را دوست دارند.

آنها به اندازه ای که به نظر می رسند تفسیر نمی شوند. جین و والاس (2019) نشان داد که توزیع توجه می تواند بدون تغییر پیش بینی های مدل برای برخی از وظایف تغییر داده و با گزینه های تعسفی جایگزین شود. هرگز وزن توجه را به عنوان شواهد استدلال بدون حذف یا چک معکوس گزارش ندهید.

## -باده

پس از`outputs/prompt-attention-shapes.md`:

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## تمرینات

1. **Easy.**اجرا`softmax`با استفاده از یک دسته با دنباله های طول متغیر، تست کنید.
2. **Medium.**به لونگ توجه چند سر اضافه کن`general`شکل. تقسیم شده`d_h`به`n_heads`گروه ها، توجه به هر سر، کنکاتنات، و بررسی کنید که پرونده ی تک سر با اجرای قبلی شما مطابقت دارد.
3. **Hard.**یک کدگر-دکودر GRU را با توجه به Bahdanau در کار کپی بازی از درس ۹ آموزش دهید. دقت نقشه در مقابل طول ردیف. با خط پایه عدم توجه مقایسه کنید. شما باید ببینید که شکاف با افزایش طول گسترش می یابد، تایید توجه گلو شکنی را بالا می برد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## خواندن بیشتر

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)روزنامه
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) سه نوع امتیاز و مقایسه آنها
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) احتیاط در مورد تفسیر
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) راه رفتن قابل اجرا با PyTorch
