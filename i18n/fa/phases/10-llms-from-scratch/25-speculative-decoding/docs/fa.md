# کدگذاری و ارگ

> یک LLM مرز تولید یک توکن نیاز به یک عبور کامل به جلو بیش از میلیاردها پارامتر. این گذرگاه پیش رو به طور گسترده ای بیش از حد فراهم شده است: اغلب اوقات یک مدل بسیار کوچکتر می تواند 3-5 توکن بعدی را به درستی حدس بزند و مدل بزرگ فقط نیاز به * تایید * حدس دارد. وقتی حدس درست باشه 5 تا توکن برای قیمت یک تا رمزگذاری مفروضاتی (Leviathan و همکارانش) 2023) این را درست انجام داد و EAGLE-3 (2025) نرخ پذیرش را به ~ 4.5 توکن در هر تایید  یک سرعت 4-5x در توزیع خروجی مطابقت پذیر افزایش داد.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## مشکل

تولید رمزگذاری برای یک مدل کلاس 70B در H100 معمولاً 40-80 توکن/دقیقه است. هر توکن نیاز به یک گذرنامه کامل پیشروی دارد که تمام وزن های مدل را از HBM می خواند. شما نمی توانید مدل را بدون تغییر در تولید کوچک تر کنید. شما نمی توانید اندازه دسته را فراتر از حافظه افزایش دهید. شما گیر کرده اید  مگر اینکه بتوانید اجازه دهید مدل بیش از یک توکن را در هر گذرنامه پیشروی تولید کند.

نسل خودکشی به طور ذاتی سریال به نظر می رسد:`x_{t+1} = sample(p(· | x_{1:t}))`اما یک فرصت هم زمان وجود دارد. اگر شما یک پیش بینی ارزان داشته باشید که می گوید "4 توکن بعدی احتمالا [a، b، c، d]" شما می توانید تمام 5 موقعیت را در یک**single forward pass of the big model**و بلندترین پیشگویی را بپذیرید.

لاویاتان، کالای، متیاس (2023، "تفرقه سریع از ترانسفورمرها از طریق کدگذاری حدس زدنی") این را از طریق یک قانون هوشمند قبول / رد که توزیع نمونه گیری مدل هدف را حفظ می کند، درست انجام داد. همان توزیع خروجی، 2-4x سریعتر.

## مفهوم

### تنظیم دو مدل

- **Target model** `M_p`: مدل بزرگ، آهسته، با کیفیت بالا که واقعا ازش نمونه می خواهید. توزیع: `p(x)`. .
- **Draft model** `M_q`: یک مدل کوچک، سریع و با کیفیت پایین تر.`q(x)`. 5-30× کوچکتر

هر مرحله:

1. طرح مدل پیشنهاد می کند`K`توکن ها به صورت خودکار: `x_1, x_2, ..., x_K ~ q`. .
2. مدل هدف يک گذرگاه جلو رو به همه ي آن ها ميگيره`K+1`موقعیت های موازی، تولید`p(x_k)`برای هر توکن پیشنهادی
3. هر نشانه را از چپ به راست با استفاده از قانون رد نمونه سازی اصلاح شده در زیر قبول/ رد کنید. طولانی ترین پیشگویی مطابقت پذیر را قبول کنید.
4. اگر هر توکن رد شود، نمونه ای از جایگزین را از توزیع اصلاح شده و متوقف کنید. در غیر این صورت نمونه ای از توکن های پاداش را از `p(· | x_1...x_K)`. .

اگر مسودۀ به طور کامل با هدف مطابقت داشته باشد، توکن های K+1 را در هر هدف پیشرو دریافت می کنید. اگر مسودۀ در موقعیت 1 اشتباه باشد، فقط یک توکن را دریافت می کنید.

### قانون دقت

تخميناتي که ميخوايم اينه**provably equivalent in distribution to sampling from p**قانون رد:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

کجا`(p - q)+`بخش مثبت تفاوت نقطه ای را نشان می دهد.`p ≈ q`) پذیرش تقریباً 1. وقتی با آنها اختلاف نظر دارند، توزیع باقیمانده طوری ساخته می شود که نمونه کلی هنوز دقیقاً درست باشد `p`. .

**Greedy case.**برای نمونه گیری دمای=0 فقط چک کنید`argmax(p) == x_t`اگر بله، قبول کن، اگر نه، محصول`argmax(p)`و متوقف شو

### سرعت انتظار می رود

اگر نرخ پذیرش در سطح توکن مدل طرح باشد`α`، توکن های انتظار شده تولید شده در هر گذرگاه هدف:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

در`α = 0.8, K = 4`.`(1 - 0.8^5)/(1 - 0.8) = 3.36`توکن ها در هر پیش بینی. یک هدف پیش بینی تقریباً هزینه دارد`cost_q * K + cost_p`(K طرح مراحل و یک هدف تایید) اگر `cost_p >> cost_q * K`نسبت سرعت بالا `3.36× / 1 = 3.36×`در مورد تولید.

تنها پارامتر واقعی اینه`α`، که کاملاً به هماهنگی مسودات و اهداف بستگی داره.

### آموزش طرح: تزریق

يه مدل کوچک تصادفي يه طرح بد ميده دستور استاندارد اينه که از هدف تصفيه کنيم

1. یک معماری کوچک را انتخاب کنید (~1B برای هدف 70B، ~500M برای هدف 7B).
2. مدل هدف را در یک متن بزرگ اجرا کنید؛ توزیع های توکن بعدی آن را ذخیره کنید.
3. با انحراف KL، مسود را با توزیع هدف (نه با توکن حقیقت اساسی) آموزش دهید.

نتیجه:`α`معمولاً 0.6-0.8 در برنامه نویسی، 0.7-0.85 در چت زبان طبیعی. سرعت 2-3x در تولید.

### قارتل: رسم درخت + استفاده مجدد از ویژگی

لی، وی، ژانگ، ژانگ (2024، "AEGLE: نمونه گیری حدس زدایی نیاز به بازبینی ویژگی عدم اطمینان") دو ناکارآمدی در رمزگذاری استاندارد حدس زدایی مشاهده کرد:

1. این مسودۀ مراحل سریال K را انجام می دهد، هر یک از آنها کامل است. اما مسودۀ می تواند ویژگی های هدف (حالات پنهان) را از آخرین تایید  نشان دهنده های غنی محاسبه شده که مسودۀ از ابتدا بازمی گردد، دوباره استفاده کند.
2. طرح تولید یک زنجیره خطی. اگر طرح می تواند یک * درخت * از کاندیداها را تولید کند (هر گره چندین حدس می زند) ، عبور تک جلو هدف می تواند چندین مسیر کاندیداها را به طور موازی از طریق ماسک توجه درخت تأیید کند و طولانی ترین شاخه پذیرفته شده را انتخاب کند.

تغییرات EAGLE-1:
- ورودی مسود = آخرین حالت پنهان هدف در موقعیت t، نه توکن های خام.
- طرح معماری = 1 لایه دیکودر ترانسفورماتور (نه یک مدل کوچک جداگانه).
- تولید = درخت K = 4-8 کاندید در هر عمق، عمق 4-6

EAGLE-2 (2024) توپولوژی درختان پویا را اضافه می کند: درخت در جایی که طرحش نامشخص است، بزرگتر می شود و در جایی که مطمئن است، باریک می ماند.`α_effective`بدون افزایش هزینه های تایید.

ایگل ۳ (Li et al. 2025, "EAGLE-3: مقیاس کردن سرعت گیری در مورد زبان های بزرگ از طریق آزمون زمان آموزش") وابستگی ثابت از ویژگی های لایه بالا را حذف می کند و طرح را با یک "تسلس زمان آزمون" جدید کاهش می دهد. نرخ پذیرش از 0.75 (EAGLE-2) به 0.82 (EAGLE-3) افزایش می یابد و میانگین توکن ها / تایید از 3.0 به 4.5. این ارقام از یک تنظیمات مرجع آمده اند. پذیرش بستگی به جفت مدل، درخت مسود و ترافیک دارد: مرحله 10 · 15 0.88 تا 0.92 قیمت برای هر توکن مسیر پذیرفته شده در شاخص های مقایسه ای چت و مرحله 17 · 05 برنامه های 0.6 تا 0.8 در چت عمومی تولید دارد.

### بررسی توجه درختان

وقتی طرح یک درخت را تولید می کند، مدل هدف آن را با یک گذرگاه پیش رو با استفاده از یک **tree attention mask** یک ماسک عللاتی که توپولوژی درخت را به جای یک خط خالص رمزگذاری می کند. هر نشانه تنها به اجداد خود در درخت توجه می کند. عبور تایید هنوز یک پیشروی است، یک ماتمول؛ ماسک توپولوژیک تنها چند ورودی اضافی KV را هزینه می کند.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

اگه`a, b`در رقابت کاندیداهای اولین نمره هستند و`c, d, e, f`در این حالت، تمام شش موقعیت در یک گذرگاه پیش رو تأیید می شوند. output طولانی ترین پیشگویی در طول هر مسیر پذیرفته شده است.

### وقتی برنده می شود و وقتی برنده نمی شود

**Wins:**
- چت / تکمیل با متن قابل پیش بینی (کد، انگلیسی مشترک، خروجی ساختار یافته) `α`اون بالاست
- تنظیمات با محاسبه GPU غیر استفاده شده در طول رمزگذاری (فاز محدود به حافظه). طراحی درخت از FLOPs موجود استفاده می کند.

**Loses / no win:**
- تولیدات بسیار استوکاستیک (نویس خلاقانه در دمای بالا)`α`به سمت`1/|vocab|`. .
- دسته ای که با هم زمان بسیار بالا خدمت می کند  دسته بندی قبلا FLOPs را پر می کند، جایی برای تأیید درختان کمی است.
- مدل های هدف بسیار کوچک که در آن طرح خیلی کوچک نیست.

فروشگاه های تولید معمولاً گزارش می دهند که ۲-۳ برابر سرعت ساعت دیواری در چت، ۳-۵ برابر در تولید کد و تقریباً صفر برابر در نوشتن خلاق است.

```figure
speculative-decoding
```

## آن را بسازید

`code/main.py`:

- یک مرجع`speculative_decode(target, draft, prompt, K, temperature)`که قانون رد دقیق را اجرا می کند و تأیید می کند توزیع هدف را حفظ می کند ( KL < 0.01 بر اساس نمونه گیری هدف ساده).
- یک درخت طرح سبک عقاب که یک درخت عمق K با شاخه های بالا-p ساخته شده است.
- یک سازنده ماسک توجه درخت که الگوی علت وجوانی مناسب را برای یک تایید کننده تولید می کند.
- یک آستین نرخ پذیرش که هر دو روی یک LM کوچک (از یک هدف GPT-2- کوچک از یک هدف GPT-2- متوسط) اجرا می شود.

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## ازش استفاده کن

- **vLLM**و**SGLang**در vLLM، عبور کنید`--speculative-config`یک شی JSON با `method`،`model`و`num_speculative_tokens`؛ اگل ۳`"method": "eagle3"`. .
- **NVIDIA TensorRT-LLM**درختان Medusa و Eagle را به طور بومی پشتیبانی می کند.
- **Reference draft models**.`Qwen/Qwen3-0.6B`(مشروعات Qwen3-32B)`meta-llama/Llama-3.2-1B-Instruct`(مخططات للاما 3.x 70B)
- **Medusa heads**(Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): به جای یک طرح مدل، K را به عنوان یک هدف اضافه کنید. ساده تر برای پیاده سازی، پذیرش کمی کمتر از EAGLE.

## -باده

این درس به ما کمک می کند`outputs/skill-speculative-tuning.md` یک مهارت که بار کاری یک مدل هدف را مشخص می کند و انتخاب می کند: مدل مسود، K (طول مسود) ، عرض درخت، دمای و زمانی که به رمزگذاری ساده برگردد.

## تمرینات

1. قانون رد دقیق را اجرا کنید و آن را تجربیانه تأیید کنید.`speculative_decode`و از طریق نمونه گیری هدف ساده؛ فاصله تلویزیون بین دو توزیع خروجی را محاسبه کنید. باید < 0.01 باشد.

2. فرمول سرعت را محاسبه کن`α`و`K`، نشان دادن توکن های انتظار می رود در هر هدف پیش رو.$K$برای$\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$. .

3. يه مسوده کوچولو رو آموزش بده يه هدف 124 ميليون گپيت-2 رو بردار و يه مسوده 30 ميليون گپيت-2 رو در توکن 100 ميليون با از دست دادن KL تصفيه کن`α`در متن بازداشت شده انتظار می رود: 0.6-0.7.

4. طراحی درخت به سبک EAGLE را اجرا کنید. به جای یک زنجیره، شاخه های اصلی را در هر عمق قرار دهید. ماسک توجه درخت را بسازید. بررسی کنید که هدف طولانی ترین شاخه درست را قبول می کند.

5. حالت شکست را اندازه گیری کنید. کد تخنیکی را در دمای=1.5 (استوکاسیت بالا) اجرا کنید. نشان دهید α فرو می افتد و الگوریتم به دلیل هزینه های بالا آهسته تر از کد ساده است.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## خواندن بیشتر

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) قانون دقیق رد و تحلیل نظری سرعت
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) مقاله نمونه گیری متضاد در DeepMind
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) جایگزین سر های موازی به یک طرح مدل
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) استفاده مجدد از ویژگی ها و طراحی درختان
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) توپولوژی درختان پویا
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) زمان قطار- زمان آزمون- زمان مطابقت
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) رمزگذاری جیکوبی/لوک هید، یک جایگزین بدون اسپکلاژور
