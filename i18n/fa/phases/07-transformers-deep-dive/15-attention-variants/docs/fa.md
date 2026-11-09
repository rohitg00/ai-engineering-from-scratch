# توجه متغیرات  پنجره ای، فرسایش، تفاوت

> توجه کامل یک دایره است. هر نماد هر نماد را می بیند، و حافظه قیمت را می پردازد. سه نوع شکل دایره را خم می کنند و نیمی از هزینه را بازمی آورند.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## مشکل

هزینه های توجه کامل$O(N^2)$حافظه و$O(N^2)$برای یک Llama 3 70B با 128K که 16 میلیارد توجه در هر لایه، برباید 80 لایه است. توجه فلاش (درس 12) پنهان می کند$O(N^2)$حافظه فعال سازی اما هزینه ریاضی را تغییر نمی دهد  هر توکن هنوز هم به هر توکن دیگر توجه می کند.

سه کلاس از ویرانت توپولوژی خود ماتریس توجه را تغییر می دهند:

1. **Sliding window attention (SWA).**هر توکن به پنجره ای ثابت از همسایه ها توجه می کند نه به عنوان پیشگویی کامل.$O(N \cdot W)$کجا$W$. "جمه 2/3"، اولين لايهاي "ميسترايل 7 بي"، "في-3-لونگ"
2. **Sparse / block attention.**فقط زوج های انتخاب شده`(i, j)`اونها به صفر وزن مجبور میشن. Longformer، BigBird، OpenAI
3. **Differential attention.**دو نقشه توجه را با طرح Q / K جداگانه محاسبه کنید، یکی را از دیگری حذف کنید. "دستگاه توجه" را که وزن چند توکن اول را خونریزی می کند، می کشد. DIFF Transformer مایکروسافت (2024).

این دو هم در هم وجود دارد. یک مدل مرزی 2026 اغلب آنها را مخلوط می کند: اکثر لایه ها SWA-1024 هستند، هر پنجم توجه کامل جهانی است و چند سر تفاوت است که بازیافت را تمیز می کند. نسبت 5: 1 SWA به جهانی Gemma 3 ، پیش فرض کتاب درسی فعلی است.

## مفهوم

### توجه پنجره های پرتاب (SWA)

هر سوال در موقعیت$i$فقط در موقعیت های$[i - W, i]$(SWA علت) یا $[i - W/2, i + W/2]$توکن ها خارج از پنجره$-\infty$در ماتریکس نمره

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

برای$N = 8192$و$W = 1024$, ماتریکس نمره دارای 1024 × 8192 ردیف غیر صفر در انتظار  کاهش 8 × است.

**KV cache shrinks with SWA.**فقط آخرین$W$توکن های K و V باید در هر لایه نگهداری شوند. برای یک پیکربندی Gemma-3-ish (1024 پنجره، زمینه 128K) ، KV cache 128x کاهش می یابد.

**Quality cost.**ترانسفورماتورهای تنها SWA با بازیافت در فاصله طولانی مبارزه می کنند. راه حل: لایه های SWA را با لایه های توجه کامل با هم جدا کنید. Gemma 3 از 5:1 SWA:global استفاده می کند. Mistral 7B از یک استیک SWA علت وجو استفاده می کند که در آن اطلاعات از طریق پنجره های همپوشانی "به جلو جریان می یابد"$W$و بعدش`L`لایه هایی که مدل می تواند در آن شرکت کند`L × W`توکن ها رو برگردون

### توجه کم / مسدود

یکی رو انتخاب کن`N × N`نماد کمزوري پيش از زمان. سه شکل قنونيک:

- **Local + strided (OpenAI sparse transformer).**تا آخرين بار هم توجه کن$W$توکن ها و هر`stride`-از قبل از اون نماد سوم$O(N \cdot \sqrt{N})$حساب کردن
- **Longformer / BigBird.**پنجره محلی + مجموعه کوچکی از توکن های جهانی (به عنوان مثال `[CLS]`) که به همه توجه می کنند و توسط همه توجه می شوند + لینک های تصادفی.
- **Native Sparse Attention (DeepSeek, 2025).**ببین کدام بلوک ها`(Q, K)`. ماده ، بلوک صفر رو در سطح هسته رد کن

توجه کم است یک داستان مهندسی هسته است. ریاضیات ساده است (ماستر امتیاز را نقاب بزنید) ؛ پیروزی از هیچ وقت بارگذاری ورود صفر به SRAM ناشی می شود. فلاش آتنشن - 3 و 2026 FlexAttention API الگوهای کم است را در PyTorch درجه اول می سازند.

### توجه متمایز (ترانسفارمر DIFF، 2024)

توجه منظم یک مشکل "دوباره توجه" دارد: softmax هر ردیف را مجبور به جمع کردن به 1 می کند، بنابراین توکن هایی که نمی خواهند به هیچ چیز خاص توجه کنند وزن اولین توکن (یا چند تا اول) را از دست می دهند. این ظرفیت را که باید به محتوای واقعی رفته بود، می دزدیده است.

توجه تفاوتي با حسابي اين مسئله رو حل ميکنه**two**نقشه های توجه و معایب:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

کجا$\lambda$A1 وزن محتوای واقعی را ضبط می کند؛ A2 مخزن را ضبط می کند. معاینه مخزن را لغو می کند، وزن را به توکن های مربوطه توزیع می کند.

نتایج گزارش شده (مایکروسافت 2024): 510% کم تر از پیچیدگی، 1.52× طولانی تر از زمینه موثر در طول آموزش، تیز تر سوزن در سکه ی خاشق.

### مقایسه ی متغیر

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## آن را بسازید

ببین`code/main.py`، یا بندر رستش`code/main.rs`. براي اجرا کردن نسخه رست:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`ما یک مقارن ماسک علت را اجرا می کنیم که تمام، SWA، محلی+درسته و توجه فرقی را در یک سری بازی به هم نشان می دهد.

### مرحله ی اول: ماسک کامل علت (بزنس)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

خط پایه از درس ۷. مثلث پایین؛ وزن صفر بالای قطب قطبی.

### مرحله دوم: ماسک علتانه پنجره ای

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

یک پارامتر  `window`. برای`window >= n`، شما تمام توجه عللوي را به دست مي آوريد`window = 1`، هر رمز فقط به خودشون کمک ميکنه

### مرحله سوم: ماسک کم کم محلی + قدم

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

پنجره ي محلي شلوغ و هر`stride`-تکين سوم به شروع سيرنامه باز مي گردد.

### مرحله 4: توجه متمایز

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

دو توجه عبور می کند، از طریق یک معادل مخلوط آموخته شده معاینه می کنیم. در کد ما نقشه گرما توجه-سنگ واحد و تفاوت را مقایسه می کنیم و به سقوط سنگ نگاه می کنیم.

### مرحله 5: اندازه های KV cache

اندازه حافظه کش در هر لایه را در  چاپ کنید$N = 131072$برای هر نوع. SWA و انواع نادر کاهش 10100×. دو برابر تفاوت. پرداخت صورتحساب حافظه خود را آگاهانه.

## ازش استفاده کن

مدل های تولید 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention در PyTorch 2.5+ یک عملکرد ماسک را قبول می کند:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

این به یک هسته Triton سفارشی مرتب می شود. در حدود 10٪ سرعت FlashAttention-3 برای الگوهای رایج، و عملکرد ماسک یک کالای پایتون است.

**When to pick each:**

- **Pure full attention** هر لایه تا ~ 16K زمینه، یا زمانی که کیفیت بازیافت مهم است.
- **SWA + global mix** زمینه طولانی (> 32K) ، آموزش و نتیجه گیری محدود به حافظه.
- **Sparse block attention** هسته سفارشی، الگوی سفارشی. برای بار کاری تخصصی (بازیافت، صوتی) ذخیره شده است.
- **Differential attention** هر بار کاری که آلودگی از آب آبشار توجه به درد می رساند (RAG در یک زمینه طولانی، سوزن در یک تکه شین).

## -باده

ببین`outputs/skill-attention-variant-picker.md`مهارت یک توپولوژی توجه برای یک مدل جدید را با توجه به طول زمینه هدف، نیازهای بازیافت و پروفایل محاسباتی آموزش/تألیف انتخاب می کند.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. SWA رو در`window=4`همه چيز رو خارج از 4 تا تاکن آخر در هر ردیف صفر ميکنه`window=n`به طور متماثل تمام توجه عللاتی را بازتولید می کند.
2. **Medium.**استفاده از SWA علتي با `window=1024`در مورد يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادداشت هاي تمامي، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري، يادگيري،
3. **Hard.**یک ترکیب لایه 5: 1 مدل Gemma-3 (5 SWA، 1 جهانی) را در مدل پای سنگ پیاده سازی کنید. از دست دادن، حافظه و کیفیت تولید را با خط های پایه خالص SWA و خالص جهانی در پارامترهای مطابقت مقایسه کنید.
4. **Hard.**توجه متمایز را با یک دانش آموز اجرا کنید$\lambda$در هر سر. آموزش در یک کار بازیافت مصنوعی (یک سوزن، 2000 دلال). دقت بازیافت را در مقایسه با یک خط پایه توجه در پارامترهای مطابقت اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## خواندن بیشتر

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) پنجره شیفتی کانونیکی + ورق جهانی
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) محلی + جهانی + تصادفی
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) الگوی محلی + خط در OpenAI
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) 1:1 SWA:گلوبال مخلوط
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) مخلوط 5: 1 با پنجره=1024 که حالا نسخه پیش فرض کتاب است.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) کاغذ DIFF ترانسفورماتور
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) توجه به کمال در مورد DeepSeek-V3.2
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) مرجع API برای الگوی ماسک به عنوان تماس در استفاده از آن.
