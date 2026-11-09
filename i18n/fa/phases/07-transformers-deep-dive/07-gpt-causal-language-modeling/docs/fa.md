# GPT  مدل سازی زبان علت

> BERT هر دو طرف را می بیند. GPT فقط گذشته را می بیند. ماسک مثلث مهمترین خط کد در هوش مصنوعی مدرن است.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## مشکل

یک مدل زبان به یک سوال پاسخ می دهد: با توجه به اولین `t-1`توکن ها، توزیع احتمالات بر روی توکن ها چیست`t`تمرین بر روی این سیگنال  پیش بینی توکن بعدی  و شما یک مدل را دریافت می کنید که می تواند متن تعسفی را یک توکن در یک زمان تولید کند.

برای آموزش آن از پایان به پایان در یک مجموعه کامل در موازی، شما نیاز به پیش بینی هر موقعیت به صرفا به موقعیت های قبلی بستگی دارد. در غیر این صورت مدل به طور معمولی به نظر می رسد به پاسخ.

ماسک علتي اينکارو ميکنه. اين يک ماتريک سه مثلث بالا از`-inf`این در حالی است که در این حالت، هر موقعیت می تواند فقط به خود و موقعیت های قبلی توجه کند. و چون شما آن را یک بار به کل ردیف اعمال می کنید، شما N متوازی پیش بینی های علامت بعدی را در یک عبور جلو می گیرید.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi  همه آنها فقط ترانسفورماتورهای علت و جزیی با یک حلقه هسته ای هستند. آنچه آنها را از هم جدا می کند کیفیت داده ها، مقیاس و اصلاحات معماری و پس از آموزش (SFT، RLHF، DPO و جانشینان آنها) است.

## مفهوم

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### ماسک

با توجه به طولي که در آن قرار دارد$N$، ساخت یک$N \times N$ماتریکس:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

اضافه کردن`M`تا نمرات توجه خام قبل از softmax. $\exp(-\infty) = 0$هر ردیف ماتریس توجه توزیع احتمال نسبت به موقعیت های قبلی است.

هزینه اجرای: یک `torch.tril()`زمان محاسبه: نانوسکندها. تاثیر بر روی زمین: همه چیز.

### از کجا مثلث آمده

ماسک معمولا به عنوان یک پیچ روی توجه ارائه می شود. مشتق را به سمت دیگر اجرا کنید و آن را از غرضی بودن متوقف می کند: توجه سومین اصلاح یک میانگین پیشگویی است و مثلث مرزهای حلقه آن میانگین است، به عنوان ماتریک نوشته شده است.

**Stage 1 — prefix average.**احمقانه ترين خلاصه علليه اي از يه دنباله: موقعیت$i$به عنوان متوسط موقعیت ها تبدیل می شود$0 \ldots i$. به عنوان یک حلقه ، که است`out[i] = X[:i+1].mean(0)`. همان محاسبه یک ماتریس ضرب می شود. یک ماتریس مثلث پایین از یک را بگیرید، هر ردیف را با تعداد آن تقسیم کنید، ضرب کنید:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

خط$i$از$A$.$[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$صفر ها بالای قطب قطبی علت هستند هیچ چیزی در مورد آینده پنهان نشده است، آینده هرگز در مجموع نبود.

**Stage 2 — learned weights.**یک متوسط یکسانی با هر توکن گذشته به عنوان یکسانی مرتبط است.`S`. حالا صف ها دیگر با ساخت یک را جمع نمی کنند، بنابراین هر ردیف را با نرم ماکس به جای تقسیم با شمارش عادی کنید. نرم ماکس هرگز صفر دقیق را خارج نمی کند، که باعث شکستن علت است  مگر اینکه نمره های آینده به عنوان `-inf`، چون`exp(-inf) = 0`:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

مثلث مشابه، ماتریس صف-استوکاستیک مشابه، یک ماتمل.`-inf`ماسک ماشین آلات جدید نیست. این صفر واردات مرحله 1 است، که به دامنه ورودی softmax ترجمه می شود.

**Stage 3 — content-dependent weights.**در مرحله 2`S`پس از تمرین ثابت می شود: موقعیت 7 همیشه موقعیت 3 را با هم وزن می کند، هر چه نشانه ها بگویند. اجازه دهید نمره ها به خود نشانه ها بستگی داشته باشد: `S = Q @ K.T / sqrt(d_k)`هیچ چیز دیگه ای تغییر نمی کنه ماسک، نرم، ملمو هم مثل هم

سه مرحله، یک غیر متغیر: یک ماتریس سه مثلث پایین قطار-استوکاستیک ضرب به ترتیب. متوسط یکسانی، وزن های ثابت آموخته، وزن های وابسته به محتوا. ماسک هرگز به توجه اضافه نشده است. از میانگین زنده ماند.

```figure
mask-derivation
```

### آموزش موازی، نتیجه گیری سریالی

آموزش: به جلو گذراندن کل`(N, d_model)`یک بار در یک سری، از دست دادن انتروپی متقاطع N را محاسبه کنید (یک در هر موقعیت) ، مقدار، پشتپایه. موازی در طول سری. به همین دلیل است که مقیاس های آموزش GPT  شما 1M توکن را در یک دسته در یک گذرگاه GPU پردازش می کنید.

نتیجه گیری: تو توکن ها را با توکن ها تولید می کنی.`[t1, t2, t3]`، برو`t4`. غذا`[t1, t2, t3, t4]`، برو`t5`. غذا`[t1, t2, t3, t4, t5]`، برو`t6`. حافظه کش KV (درسه 12) حالت های پنهان را ذخیره می کند`t1…tn`بنابراین شما آنها را هر مرحله دوباره محاسبه نمی کنید. اما عمق سریال در نتیجه گیری = طول خروجی. این مالیات خودکشی است و چرا رمزگذاری گشایی گلوچه تاخیر هر LLM است.

### خسارت  تغییر در یک

توکن ها داده شده`[t1, t2, t3, t4]`:

- ورودی: `[t1, t2, t3]`
- اهداف: `[t2, t3, t4]`

برای هر موقعیت`i`، حساب کردن`-log P(target_i | inputs[:i+1])`خلاصه، اين اينترپي کراس کل تكراري است

هر ترانسفورماتور LM که از اين خسارت شنيدي قطار هاي قبل از آموزش، تعديل ظريف، SFT  همان خسارت، داده هاي مختلف

### استراتژی های رمزگذاری

بعد از آموزش، انتخاب نمونه ها مهم تر از آنچه مردم فکر می کنند است.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

در سال 2026، min-p + دمای 0.7 یک پیش فرض معقول برای مدل های وزن باز است.

### چه چیزی باعث شد که "وصف GPT" کار کند

1. **Decoder-only.**بدون کدر بالا، یک پاس توجه + FFN در هر لایه
2. **Scaling.**124M → 1.5B → 175B → تریلیون. قوانین مقیاس بندی چینچیلا (درسی 13) به شما می گوید که چگونه برای محاسبه هزینه کنید.
3. **In-context learning.**در حدود 6B13B ظاهر شد. این مدل می تواند بدون تنظیم دقیق از چند نمونه عکس پیروی کند.
4. **RLHF.**آموزش بعد از ترجیحات انسان متن خام پیش از آموزش را به دستیار چت تبدیل کرد.
5. **Pre-norm + RoPE + SwiGLU.**آموزش مستحکم در مقیاس

معماری اصلی از زمان GPT-2 خیلی تغییر نکرده است. همه چیز جالب در داده ها، مقیاس و پس از آموزش اتفاق افتاده است.

```figure
causal-mask
```

## آن را بسازید

### مرحله اول: ماسک علت

ببین`code/main.py`. يک خط:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

قبل از نرم کردن، به نمره توجه اضافه کنید.

### مرحله دوم: یک مدل دو لایه GPT

دو بلوک دیکودر را جمع کنید (خود توجه پوشیده + FFN ، بدون توجه متقابل). یک تمجیل توکن ، یک کدگذاری موقعیت و یک تمجیل غیر موجود (بند به ماتریس تمجیل توکن یک ترفند استاندارد از GPT-2) اضافه کنید.

### مرحله سوم: پیش بینی علامت بعدی، پایان به پایان

در یک لغت 20 توکن بازی، در هر موقعیت، Logits را تولید کنید. از دست دادن آنترپی متقابل را با هدف تغییر به یک محاسبه کنید. هیچ گرادینت نیست.

### مرحله چهارم: نمونه گیری

هر یک را با یک پرامپت ثابت اجرا کنید و خروجی را مقایسه کنید. یک عملکرد نمونه گیری 10 خط است.

## ازش استفاده کن

"پایتورچ" در سال 2026

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

زیر کوپ`generate()`هر دسته نتیجه گیری LLM تولید (vLLM، TensorRT-LLM، llama.cpp، Ollama، MLX) همان حلقه را با بهینه سازی سنگین  prefill دسته بندی، دسته بندی مداوم، KV cache paging، رمزگذاری حدس و گمان اجرا می کند.

**GPT vs BERT, one line each:**پیش بینی GPT$P(x_t \mid x_{<t})$. برت پيش بيني ميکنه$P(x_{\text{masked}} \mid x_{\text{unmasked}})$. از دست دادن مشخص می کنه که مدل می تونه تولید کنه

## -باده

ببین`outputs/skill-sampling-tuner.md`مهارت انتخاب پارامترهای نمونه گیری برای یک وظیفه نسل جدید و نشان دادن زمانی که کدگذاری تعیین کننده مورد نیاز است.

## تمرینات

1. **Easy.**فرار کن`code/main.py`و بررسی کنید که ماتریس توجه عللاتی بعد از نرم ترین مقدار سه مثلث پایین تر است.
2. **Medium.**4 . در 10 درخواست کوتاه ، پیچیدگی بین بین 4 و طمع را مقایسه کنید. آیا بین همیشه برنده می شود؟ (تغییر: معمولا برای ترجمه ، نه برای چت باز).
3. **Hard.**پیاده سازی رمزگذاری مفکوری: از یک مدل کوچک دو لایه به عنوان طرح و یک مدل شش لایه به عنوان تأیید کننده استفاده کنید. سرعت ساعت دیواری را در 100 تکمیل طول 64 اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## خواندن بیشتر

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) GPT-1
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) GPT-2
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 و یادگیری در زمینه
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) کاغذ رمزگذاری مشخصات
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) کد مرجع علل علل - LM.
