# کدگذاری حدس زده شده  مسود، تایید، تکرار

> رمزگذاری خودکارگرگسیو سریال است. هر توکن منتظر دیگری است. رمزگذاری حدس زده زنجیره را شکسته است: یک مدل ارزان طرح N توکن ها را تایید می کند، مدل گران قیمت همه N را در یک عبور پیشروی تأیید می کند. هنگامی که طرح درست است شما یک پیشروی بزرگ برای نسل N پرداخت می کنید.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## مشکل

نمونه گیری یک توکن 70B LLM برای H100 حدود 30 ms طول می کشد. یک مدل طرح 3B حدود 3 ms طول می کشد. اگر ما اجازه دهیم طرح 3B 5 توکن را پیش بگذاریم، سپس 70B * یک بار * را اجرا کنید تا همه 5 را تأیید کنید، کل $5 \times 3 + 30 = 45$ms برای تا 5 توکن پذیرفته شده  در مقابل `5×30 = 150 ms`برای تولید خط مستقیم. این تمام پیچ های تخمک گذاری است: مقدار کمی از حافظه اضافی GPU (نمونه مسود) را با تاخیر تخمک گذاری 24× کمتر معامله کنید.

این ترفند باید توزیع را حفظ کند. نمونه گیری حدس زده، که توسط Leviathan و همکارانش (2023) و توسط Chen و همکارانش به طور همزمان معرفی شده است، تضمین می کند که تسلسل خروجی **identically distributed**به چيزي که مدل بزرگ خودش ميکرد بدون تعادل با کیفیت فقط سریعتر

چهار خانواده از جفت های تایید کننده مسودات بر نتیجه گیری 2026 تسلط دارند:

1. **Vanilla speculative (Leviathan 2023).**مدل طرح جداگانه (به عنوان مثال، Llama 3 1B) + تأیید کننده (به عنوان مثال، Llama 3 70B).
2. **Medusa (Cai 2024).**چند تا سر رمزگشایی روی تایید کننده موقعیت پیش بینی`t+1..t+k`در موازی، هیچ طرح الگویی نیست
3. **EAGLE family (Li 2024, 2025).**طرح سبک که از حالت پنهان تأیید کننده استفاده می کند؛ نرخ پذیرش نزدیک تر از وانیل؛ 34× معمول.
4. **Lookahead decoding (Fu 2024).**تکرار جاکوبي، اصلاً مدل مسوداتي لازم نيست، خودآگاهي، نيش اما بدون وابستگی

هر دسته نتیجه گیری تولید در سال 2026 به طور پیش فرض رمزگذاری مفروضاتی را ارسال می کند. vLLM، TensorRT-LLM، SGLang و llama.cpp همه حداقل از وانیل + EAGLE-2 پشتیبانی می کنند.

## مفهوم

### الگوریتم اصلی

با توجه به یک تایید کننده$M_q$و يه مسوديه ارزان تر$M_p$:

1. بذار$x_1 \ldots x_k$باید پیشگویی که قبلاً رمزگذاری شده باشد.
2. **Draft**: استفاده$M_p$به طور خودکشی پیشنهاد کنید$d_{k+1}, d_{k+2}, \ldots, d_{k+N}$با احتمالات طرح$p_1 \ldots p_N$. .
3. **Verify in parallel**: اجرا$M_q$یک بار دیگه$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$، گرفتن احتمالات تایید کننده$q_1 \ldots q_{N+1}$برای موقعیت ها$k+1 \ldots k+N+1$. .
4. **Accept/reject each draft token left to right**: برای هر یک$i$، با احتمال قبول کن$\min(1, q_i(d_i) / p_i(d_i))$. .
5. در مورد رد اول در موقعیت$j$نمونه:$t_j$از توزیع "بقیه"$(q_j - p_j)_+$تمام مسودات بعد از$j$از بین می رود.
6. در مورد قبول همه چیز$N$: نمونه یک توکن اضافی$t_{N+1}$از$q_{N+1}$(توکن پاداش رایگان)

ترفند توزیع باقیمانده، بینش ریاضی است که تولید را دقیقاً مانند$M_q$از ابتدا نمونه گرفته بودم

### چه چیزی سرعت را تعیین می کند

بذار$\alpha$= نرخ پذیرش انتظار می رود در هر طرح توکن.$c$= نسبت هزینه های طرح به بررسی کننده.

- نسل ساده ای یک مدل بزرگ را به هر توکن می خواند.
- پيش بيني ها يه تماس بزرگ مدل رو به صورت هر دو ميده$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$توکن ها وقتی$\alpha$اون بالاست

قانون معمولي در $\alpha = 0.75$و$N = 5$: 3x کمتر از تماس های مدل بزرگ. هزینه مسود 5x ارزان است. کل ساعت دیواری کاهش ~ 2.5x.

**$\alpha$ depends on:**

- چگونه طرح به دقت به تایید کننده نزدیک می شود.$\alpha$به طور قابل توجهی
- استراتژی رمزگشایی. مسودۀ طمع آمیز در مقابل تأیید کننده طمع انگیز: بالا $\alpha$نمونه گیری دمای: با هم مطابقت پذیر شدن سخت تر است، پذیرش کاهش می یابد.
- نوع کار: کد و تولید ساختار یافته بیشتر (قابل پیش بینی) را پذیرفته است؛ نوشتن خلاقانه در قالب آزاد کمتر را پذیرفته است.

### مدوسا  طرح بدون طرح مدل

مادوزا مدل طرح را با سرای خروجی اضافی روی تایید کننده جایگزین می کند.`t`:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

هر سر به خارج از خود logits خود را. در نتیجه شما نمونه از هر سر برای دریافت یک دنباله کاندید، سپس با یک عبور جلو با استفاده از یک طرح توجه درخت که در نظر گرفتن تمام ادامه کاندید در یک زمان.

مزایایی: هیچ مدل دوم. معایب: اضافه کردن پارامترهای قابل آموزش؛ نیاز به مرحله تنظیم دقیق تحت نظارت (~ 1B توکن) ؛ نرخ پذیرش کمی کمتر از اسپکولیتی وانیل با طرح خوب است.

### ارگل  با استفاده مجدد از حالت های پنهان بهتر است

EAGLE-1/2/3 (Li et al., 20242025) باعث می شود که مدل مسود یک ترانسفورماتور کوچک (معمولا یک لایه) باشد که حالت پنهان لایه آخر تأیید کننده را جذب می کند. از آنجا که مسود نشان دهنده ویژگی های تأیید کننده را می بیند، پیش بینی های آن به شدت با توزیع خروجی تأیید کننده ارتباط برقرار می کند. نرخ پذیرش از ~ 0.6 (وانلی) به 0.85+ افزایش می یابد. این ها نرخ های هر توکن در معیار های چت هستند، با یک طرح آموزش داده شده بر اساس داده های چت مطابقت دارد. در مورد ترافیک تولید مخلوط، برنامه های مرحله 17 · 05 با 0.6 تا 0.8 برای EAGLE-3 و ترافیک دامنه ممکن است کمتر باشد.

EAGLE-3 (2025) جستجوی درختان را در ادامه نامزده اضافه کرد. vLLM و SGLang کشتی EAGLE-2/3 به عنوان مسیر مشخصات پیش فرض برای Llama 3/4 و Qwen 3 .

### رقص KV

اطلاعات تایید$N$طرح توکن ها را به یک عبور جلو وارد کننده می کند. این به کش KV تایید کننده را به $N$اگر برخی از مسودات رد شوند، باید حافظه پیش فرض را به طول پیش فرض پذیرفته شده برگردانید.

اجرای تولید (vLLM ها) `--speculative-config`با کلاهک های KV از خاکستر استفاده کنید. ابتدا بنویسید، تعهد کنید که قبول کنید. از نظر مفهومی سخت نیست، اما سخت است.

```figure
draft-verify-tokens
```

## آن را بسازید

ببین`code/main.py`ما الگوریتم نمونه گیری اصلی (خطای رد + توزیع باقیمانده) را با:

- یک "نموذج بزرگ" که یک تعیین کننده نرم حداکثر بر روی یک توزیع کد دست (تا ما می توانیم پذیرش ریاضی تحلیلی را تایید کنیم).
- یک "نمونه مسود" که یک اختلال از مدل بزرگ است.
- یک حلقه پذیرش/ رد که همان توزیع حاشیه ای را با نمونه گیری مستقیم تولید می کند.

`code/main.rs`این یک پورت Rust با عملکرد و نمایش های مشابه است. این تنها از کتابخانه استاندارد استفاده می کند. اعداد تصادفی از پایتون متفاوت است، اما نتیجه گیری های چاپ شده یکسان هستند.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### مرحله اول: مرحله رد

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`یک عدد تصادفی یکسانی است.`q_prob`احتمال تایید کننده برای توکن طراحی شده است. `p_prob`نظریه لاویاتان این است که این تصمیم برنولی، که از پس گیری نمونه از باقی مانده در زمان رد، توزیع تایید کننده را دقیقا حفظ می کند.

### مرحله دوم: توزیع باقیمانده

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

ازش بردارید`p`از`q`از نظر عنصر، ارزش های منفی را به صفر فشار دهید، دوباره عادی سازی کنید.

### مرحله سوم: یک مرحله حدس زدنی

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

پنج قبول شده → یک پاداش → شش توکن تولید شده در یک گذرنامه تایید کننده.

### مرحله 4: میزان پذیرش را اندازه گیری کنید

۱۰۰۰۰ مرحله ی حدس زدنی را در سطوح مختلف کیفیت طرح اجرا کنید. نرخ پذیرش طرح در مقابل انحراف KL بین توزیع طرح و تایید کننده. شما باید یک رابطه یکسردی پاک را ببینید.

### مرحله 5: بررسی معادلات توزیع

از نظر تجربی: هیستogram سیگنال های تولید شده توسط حلقه ی حدس زدن باید با هیستogram تولید شده توسط نمونه گیری مستقیماً از تأیید کننده مطابقت داشته باشد. این نظریه لیویاتان در عمل است. یک آزمایش چایی مربع در داخل خطا نمونه گیری تأیید می کند.

## ازش استفاده کن

تولید:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM از اواسط سال 2026 سریعترین مسیر مدیسا را دارد.`faster-whisper`اون يه نسخه کوچولو از رمزگشایی مفكري براي "سسپر بزرگ" رو مي پوشه

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- توليد يك سري از 15 توکن.
- نمونه گیری با درجه حرارت بالا ($\alpha$قطره ها)
- پیاده سازی های محدود به حافظه (نموذج مسود به VRAM اضافه می شود).

## -باده

ببین`outputs/skill-spec-decode-picker.md`مهارت انتخاب یک استراتژی تخفیف بازبینی (وانیل / مدوسا / ایگل / درخشان) و تنظیم پارامترهای (N، دمای مسود) برای یک کار فرضیه جدید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. تایید کنید توزیع توکن های حدس زدایی با توزیع نمونه مستقیم تایید کننده در 50،000 توکن در عرض p = 0.05 چیدری
2. **Medium.**سرعت تراشه (توکین ها در هر مدل بزرگ پیش) به عنوان یک تابع از $N$برای$\alpha = 0.5, 0.7, 0.85$. مشخص کردن بهترین$N$برای هر یک$\alpha$. (توصیه: توکن های انتظار می رود در هر تماس تایید = $(1 - \alpha^{N+1}) / (1 - \alpha)$.)
3. **Hard.**یک مدوزا کوچک پیاده سازی کنید: GPT سنگ اصلی را از درس 14 بگیرید، 3 سر LM اضافی اضافه کنید که موقعیت t + 2، t + 3، t + 4 را پیش بینی می کنند. روی minishakespeare با یک از دست دادن مشترک چند سر تمرین کنید. نرخ پذیرش را با یک طرح وانیل که با کوتاه کردن همان مدل ساخته شده است مقایسه کنید.
4. **Hard.**انجام رول بیک: با یک پیشگویی 10 توکن KV شروع کنید، 5 توکن مسود را تغذیه کنید، یک رد را در موقعیت 3 شبیه سازی کنید. بررسی کنید که خواندن پیشگویی شما به درستی با "پیشگویی + 2 پیشگویی اول پذیرفته شده" در تکرار بعدی مطابقت دارد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## خواندن بیشتر

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) الگوریتم اصلی و نظریه معادلیت.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) معرفی همزمان؛ اثبات برنوولی پاک
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) کاغذ مادوزا؛ بررسی توجه به درختان
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) EAGLE-1؛ پیش نویس مخفی شده با شرایط دولتی
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) ارگ 2؛ عمق درختان پویا
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) ارگل-3
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057)نگاه کن، بدون طرح
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) مرجع تولید کنونی با تمام چهار استراتژی متصل شده است.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) کد مرجع برای EAGLE-1/2/3.
