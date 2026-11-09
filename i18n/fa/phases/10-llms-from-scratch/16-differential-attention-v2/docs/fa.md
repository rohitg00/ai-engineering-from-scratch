# توجه متفاوت (V2)

> توجه Softmax مقدار کمی احتمال را بر روی هر توکن غیر متقابل پخش می کند. بیش از ۱۰۰ هزار توکن که صدا می افزاید و سیگنال را غرق می کند. ترانسفارمر متمایز (Ye et al., ICLR 2025) آن را با محاسبه توجه به عنوان تفاوت دو نرمکس، کاهش سطح شور مشترک، تنظیم می کند. DIFF V2 (مائیکروسافت، ژانویه 2026) نسخه بازنویسی تولید است: مطابقت تاخیر رمزگذاری با خط پایه ترانسفورمتر، هیچ هسته سفارشی، FlashAttention سازگار است. این درس V1 تا V2 از انتهای تا انتهای است، با اجرای بازی کاری از عملیات تفاوت که می توانید در stdlib Python اجرا کنید.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## اهداف یادگیری

- دقیقا توضیح دهید که چرا توجه نرمmax دارای کف شور است و چرا با طول زمینه رشد می کند.
- فرمول توجه فرقی را اخذ کنید و توضیح دهید که چرا معاینه بخش شور مشترک را در حالی که سیگنال را حفظ می کند، لغو می کند.
- با توجه به تفاوت V1 تا V2: چه چیزی سریع تر، چه چیزی ساده تر، چه چیزی پایدار تر شد و چرا هر تغییر برای آموزش پیش از تولید ضروری بود.
- توجه متمایز را از ابتدا در پایتون خالص پیاده سازی کنید و از لحاظ تجربی ویژگی لغو صدا را در یک سوال سیگنال + صدا مصنوعی تأیید کنید.

## مشکل

توجه استاندارد نرم ماکس دارای یک ویژگی ریاضی است که به یک سردرد عملیاتی در مقیاس تبدیل می شود.`q`، وزن توجه ها`softmax(qK^T / sqrt(d))`Softmax هرگز نمی تواند صفر های دقیق را تولید کند: هر توکن غیر متناسب با مقدار مثبت را به دست می آورد. این مقدار باقی مانده شور است و با طول زمینه مقیاس می گیرد. در توکن های 128k، حتی اگر هر توکن غیر متناسب فقط 0.0001% احتمال را بدست آورد، 127,999 از آنها در مجموع حدود 13٪ از کل را به دست می آورند. مدل باید یاد بگیرد که در اطراف یک طبقه شور که با زمینه رشد می کند، مسیر را طی کند.

از نظر تجربی این به عنوان اختلال توجه ظاهر می شود: نقل قول های توهم در RAG های طولانی، شکست های در میان در وظایف بازیابی 100k، و کاهش دقیق دقیق در معیار های سوزن در سنگ بخار بیش از 32k. کاغذ ترانسفارمرهای فرقی (arXiv:2410.05258, ICLR 2025) شکاف را اندازه گیری کرد: ترانسفارمرهای DIFF دچار کم پیچیدگی، دقت بیشتر در زمینه طولانی و توهم کمتر نسبت به خطوط پایه با اندازه مشابه هستند.

DIFF V1 سه مشکل داشت که آن را از خطوط لوله پیش از آموزش مرزها دور نگه داشت. حافظه حافظه ی ارزش آن باید دو بار در هر مرحله رمزگذاری بارگذاری می شد، نیاز به هسته های CUDA سفارشی داشت که سازگاری FlashAttention را شکست می دادند و RMSNorm در هر سر آموزش طولانی مدت را در مقیاس 70B-plus بی ثبات کرد. DIFF V2 (برنامه unilm مایکروسافت، 20 ژانویه 2026) سه مورد را حل کرد. این درس هر دو نسخه را اجرا می کند، عامل تفاوت را ایجاد می کند و حذف صدا را در یک سوال بازی سنج می کند.

## مفهوم

### کف شور نرم ماکس

برای یه سوال`q`و کليدها`K = [k_1, ..., k_N]`، وزن توجه:

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

نه`w_i`همیشه صفر است.`k_i`کاملاً با `q`، نمره`q . k_i`0  نیست و با انحراف در اطراف صفر نوسان می کند`||q||^2 / d`بعد از نرمال شدن softmax، هر توکن مرتبط با آن هنوز هم کمک می کند`O(1/N)`به مبلغ وزن شده. کل سهم توکن های غیر مرتبط`O((N-1)/N) = O(1)` مقدار کمی نیست.

چیزی که مدل می خواهد چیزی شبیه یک top-k سخت است: وزن بالا در توکن های مطابقت، وزن نزدیک به صفر در همه جا. Softmax برای انجام این کار مستقیم خیلی صاف است.

### ایده تفاوت

طرح های Q و K هر سر را به دو قسمت تقسیم کنید:$Q = (Q_1, Q_2)$و$K = (K_1, K_2)$دو نقشه توجه رو محاسبه کن

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

تولید:

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

این تخفیف هر گونه توزیع سر و صدا را که دو نقشه به اشتراک می گذارند لغو می کند. اگر هر دو نقشه وزن تقریباً یکسانی در توکن های 127k غیر مرتبط دارند (که آنها در ابتداء تصادفی می کنند) ، آنها لغو می شوند. سیگنال  وزن اوج در چند توکن واقعاً مرتبط  فقط لغو می شود اگر در هر دو نقشه با همان شدت ظاهر شود ، که این امر زمانی که مدل قطار نیست.

`lambda`یک مقیاس قابل یادگیری در هر سر است که به عنوان `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`. ممکنه منفی باشه`lambda_init`به طور پیش فرض به یک عدد مثبت کوچک مانند 0.8

### چرا این تطابق با سر و صدا را لغو می کند

به فکر دو میکروفون سر و صدا که صدای مشابه را ضبط می کنند. هر دو بلندگو را به همراه صداهای پس زمینه مرتبط می گیرند. یکی را از دیگری حذف کنید و صدا مشترک از بین می رود. صدا زنده می ماند زیرا دو سیگنال در مرحله یا ضخامت به اندازه کافی متفاوت است تا از لغو کامل جلوگیری کند.`lambda`درست همین تعادل را یاد می گیرد.

### V1 vs V2: تفاوت

V1 تعداد پارامتر را برابر با خط پایه ترانسفورمتر نگه داشت. برای دریافت دو سوال در هر سر، اندازه سر را به نصف کاهش داد. این هزینه به معنای صریح و دردناک تر به نصف مقدار حافظه حافظه را به طور کامل کاهش داد. Decode باید به صورت دو بار در هر مرحله (یک بار در هر شاخه softmax) ، مقدار حافظه را بارگذاری کرد. نتیجه: decode به سرعت تر از خط پایه با وجود تعداد پارامتر های مطابقت.

V2 تعداد سر های جستجو را دو برابر می کند و سر های KV را یکسان نگه می دارد (پارامترهای قرض گرفته شده از پروژکتور بالا) ، ابعاد سر مانند خط اصلی باقی می ماند. پس از برداشت، ابعاد اضافی به پایین پیش بینی می شود تا با خط اصلی ترانسفورمتر مطابقت داشته باشد $O_W$سه اتفاق همزمان اتفاق می افتد:

1. سرعت رمزگذاری با خط پایه مطابقت دارد (KV cache یک بار بار بارگذاری می شود).
2. FlashAttention بدون تغییر اجرا می شود (هیچ هسته سفارشی وجود ندارد).
3. شدت ریاضی در رمزگذاری افزایش می یابد (حساب بیشتر در هر بایت بارگذاری شده از HBM).

V2 همچنین RMSNorm را که V1 برای ثبات کاهش استفاده می کرد حذف می کند. در مقیاس های پیش از آموزش کلاس 70B، این RMSNorm آموزش دیر را بی ثبات کرد. V2 آن را با یک طرح ابتدایی ساده تر جایگزین می کند که آموزش را بدون ماژول اضافی پایدار می کند.

### چه وقت به دستش بريم

| Workload | Benefit |
|----------|---------|
| Long-context RAG (64k+) | Cleaner attention maps, fewer hallucinated citations |
| Needle-in-haystack benchmarks | Substantial accuracy lift past 32k |
| Multi-document QA | Less cross-document interference |
| Code completion at 8k | Marginal, not worth the architecture change |
| Short chat (< 4k) | Essentially indistinguishable from baseline |

ارزش با طول زمینه رشد می کند. در توکن های 4k، سطح شور به اندازه کافی کوچک است تا توجه استاندارد خوب باشد. در 128k، به شما آسیب می رساند.

### چطور با دکمه های 2026 دیگر هم جمع می شود

| Feature | Compatible with DIFF V2? |
|---------|------------------------|
| GQA | Yes (V2 increases Q heads, not KV heads) |
| MLA (DeepSeek) | Yes in principle, no published paper combining them |
| MoE | Yes (attention is independent of MLP block) |
| RoPE | Yes (unchanged) |
| YaRN / long-context scaling | Yes (exactly where DIFF helps most) |
| FlashAttention | Yes in V2 (was no in V1) |
| Speculative decoding | Yes (attention change is invisible to the spec-decode loop) |

```figure
differential-attention
```

## آن را بسازید

`code/main.py`یک سوال بازی با ساختار شناخته شده سیگنال به علاوه صدا به شما اجازه می دهد نسبت حذف صدا را مستقیماً اندازه گیری کنید.

### مرحله ی اول: توجه استاندارد نرم

عملیات ماتریکس Stdlib: لیست لیست ها، دستی ماتمول، نرم ماکس با تخفیف ثبات عددی از ماکس.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### مرحله دوم: Q، K را به دو قسمت تقسیم کنید

سبک V1: ابعاد سر را به نصف کاهش دهید. سبک V2: ابعاد سر را حفظ کنید و تعداد سر را دو برابر کنید. پیاده سازی اسباب بازی از V1 برای شفافیت آموزشی استفاده می کند. ریاضیات یکسان است، فقط حسابداری متفاوت است.

### مرحله 3: دو شاخه نرم ماکس + معایب

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

توجه: وزن خروجی می تواند منفی باشد. این خوب است  حافظه حافظه هنوز هم مشارکت های امضا شده را اداره می کند. پروژکتور V بعدی نشان را جذب می کند.

### مرحله 4: اندازه گیری حذف صدا

یک دنباله مصنوعی طول 1024 بسازید. علامت سیگنال رو در موقعیت شناخته شده قرار بده، بقیه اش رو با صدا پر کن محاسبه وزن توجه نرم استاندارد (a) در موقعیت سیگنال و (b) وزن توجه فرقی. نسبت سیگنال به صدا در هر یک را اندازه گیری کنید. توجه DIFF به طور قابل اعتماد نسبت سیگنال به صدا را با فاکتور 3x-10x بالاتر تولید می کند بسته به اینکه دو شاخه چقدر برای تفاوت آموزش دیده اند.

### مرحله 5: حسابداری پارامتر V1 در مقابل V2

با توجه به یک پیکربندی (خفیده=4096, سر=32, d_head=128), چاپ:

- ترانسفورماتور پایه: Q، K، V هر اندازه `hidden * hidden`، MLP در 4 * پنهان.
- DIFF V1: Q، K هر اندازه `hidden * hidden`، اندازه V`hidden * hidden`(غیر تغییر یافته) ، سر کم نصف شده در داخل.`lambda`پارامترها$(O(\text{heads} \cdot d_{\text{head}}))$. .
- DIFF V2: اندازه Q `2 * hidden * hidden`، اندازه K`hidden * hidden`، اندازه V`hidden * hidden`. اونم از قبل به پایین رونمایی شده$O_W$. همش اضافه میشه`lambda`پارامترها

این اسباب بازی هزینه پارامتر اضافی V2 را اندازه گیری می کند (تقریباً `hidden * hidden`و آن را چاپ می کند.

## ازش استفاده کن

DIFF V2 هنوز در هر سرور نتیجه گیری تولید از آوریل 2026 ارسال نشده است، اما ادغام در vLLM و SGLang در حال انجام است. در همین حال الگوی در:

- مدل های تولید طولانی مدت داخلی مایکروسافت
- تکرار تحقیقات در چندین دوره آموزشی مدل باز که هدف از 256k-plus-تحنیف است.
- معماری های ترکیبی که توجه DIFF را با توجه پنجره های شیفت روی لایه های جایگزین ترکیب می کنند.

وقتی که شما در سال 2026 به این هدف برسید:

- آموزش یک مدل جدید از ابتدا با هدف 64k و بیشتر از یک زمینه موثر. توجه متمایز را از ابتدا اضافه کنید؛ آموزش مجدد بعد گران است.
- تنظیم دقیق یک مدل طولانی زمینه که شکست های گم شده در وسط بر ارزیابی شما تسلط دارند. یک LoRA در پروژکتورهای Q می تواند ساختار DIFF را نزدیک کند.

وقتی که نمی خوای:

- شما یک مدل فشرده پیش از آموزش با عملکرد پایدار در زمینه طولانی خدمت می کنید هزینه آموزش مجدد به ندرت به وزن های موجود باز می گردد.
- تو همیشه زیر 16 هزارتاست و سطح شور هم مهم نیست

## -باده

این درس به ما کمک می کند`outputs/skill-diff-attention-integrator.md`با توجه به معماری مدل، طول زمینه هدف، مشخصات توهم و بودجه آموزش، یک برنامه ادغام برای اضافه کردن توجه متمایز به یک دوره جدید پیش از آموزش یا تنظیم دقیق LoRA را تولید می کند.

## تمرینات

1. فرار کن`code/main.py`. بررسی کنید که نسبت سیگنال به صدا که برای توجه فرقی گزارش شده بالاتر از توجه استاندارد نرمماکس در جستجو مصنوعی است. amplitude noise را تغییر دهید و نقطه عبور را نشان دهید که توجه استاندارد غیرقابل استفاده می شود.

2. دلتای شمارش پارامتر را از خط پایه به DIFF V1 و از خط پایه به DIFF V2 برای یک مدل کلاس 7B محاسبه کنید (خفای = 4096, سر = 32, d_head = 128, 32 لایه). نشان دهید کدام اجزای پارامتر کسب کرده و کدامین یکسان باقی مانده اند.

3. بخش 3 مقاله DIFF V1 را بخوانید (arXiv:2410.05258) و بخش 2 وبلاگ DIFF V2 Hugging Face را بخوانید. در دو جمله توضیح دهید که چرا V1 به صورت RMSNorm مورد نیاز است و چرا V2 می تواند آن را بدون ایجاد انحراف در آموزش حذف کند.

4. پیاده سازی یک ابلاسیون: توجه متمایز را با `lambda = 0`(پاک اول نرم) و`lambda = 1`در سوال مصنوعی اندازه گیری کنید که چگونه سیگنال به صدا در سراسر سویپ تغییر می کند. شناسایی `lambda`که حداکثر رساندن سیگنال به صدا است.

5. بازیکنی را به GQA + DIFF V2 گسترش دهید. 8 سر KV و 32 سر Q را انتخاب کنید. نشان دهید که اندازه حافظه کش KV با مدل GQA با همان (8, 32) پیکربندی مطابقت دارد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Differential attention | "Two softmaxes minus each other" | Split Q, K into two halves, compute two softmax maps, subtract the second (scaled by $\lambda$) from the first, then multiply by V |
| Noise floor | "The non-zero tail of softmax" | The $O(1/N)$ weight softmax puts on every unrelated token, which sums to $O(1)$ across long contexts |
| lambda | "The subtraction scale" | Per-head learnable scalar parameterized as `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`; can be negative |
| DIFF V1 | "The ICLR 2025 version" | Original Differential Transformer; halves head dim to preserve parameter count, needs custom kernel, slower decode |
| DIFF V2 | "The January 2026 fix" | Doubles Q heads keeping KV heads; matches baseline decode speed and works with FlashAttention |
| Per-head RMSNorm | "The V1 stabilizer" | Extra norm V1 applied after the difference; V2 removed it to prevent late-training instability |
| Signal-to-noise ratio | "How much attention is wasted" | Ratio of weight on the true signal position to average weight on unrelated positions |
| Lost in the middle | "Long-context failure mode" | Empirical phenomenon where retrieval accuracy dips for documents in the middle of a long context — DIFF attention reduces this |
| Arithmetic intensity | "FLOPs per byte loaded" | Ratio V2 increased at decode by doubling queries per KV load; important for memory-bound decode |

## خواندن بیشتر

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) مقاله اصلی با نظریه لغو صدا و حذف متن طولانی
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) بازنویسی تولید-پرداخت، مطابقت با کد پایه، FlashAttention- سازگار
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) تجزیه و تحلیل نظری از دلیل اینکه معاینه ساختار توجه پیش از آموزش را بهبود می بخشد
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) ویرانه اشتراک گذاری پارامتر
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) خط پایه DIFF ترانسفورماتور از
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) شاخص مرجع در زمینه طولانی، اهداف توجه DIFF
