# قوانین مقیاس بندی

> مقاله کپلان سال 2020 گفت: مدل بزرگتر، ضرر کمتر. مقاله هوفمن سال 2022 گفت: شما زیر آموزش بودید. محاسبه به دو سطل می رود  پارامتر و توکن  و تقسیم آشکار نیست.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## مشکل

وقتی شما C FLOPs آموزش محاسبه و می خواهید بهترین مدل شما روبرو دو دکمه:

1. **How many parameters (N)?**مدل بزرگتر، ظرفیت بالاتر
2. **How many training tokens (D)?**اطلاعات بیشتر، استفاده بهتر از ظرفیت

FLOPs حدوداً به اندازه `6 × N × D`می تونید N رو بالا و پایین فشار دهید یا D رو بالا و پایین. کدام بهتره؟

قبل از سال 2022، پاسخ "پش N سخت" بود. GPT-3 (2020) پیرامیتر 175B را بر روی توکن های ~ 300B آموزش داده است. نسبت حدود 1.7 توکن در هر پارامتر. قوانین مقیاس بندی کاپلان این را پشتیبانی می کند.

هوفمن و همکاران (2022) ، که یک خانواده کوچک از مدل ها را به نام چینچیلا آموزش می دادند، چیزی متفاوت را پیدا کردند: نسبت مطلوب به **20 tokens per parameter**GPT-3 10x کمتر آموزش دیده بود. Chinchilla (70B پارام، 1.4T توکن) GPT-3 (175B، 300B توکن) را در هر معیار با هزینه نتیجه گیری 2.5x کمتر شکست داد.

2026 دنیای چینچیلا است  با یک پیچ مهم. Llama 3 8B بر روی 15 تریلیون توکن آموزش دیده است، نسبت 1.875 توکن در هر پارامتر. نود و چهار برابر از چینچیلا بهینه گذشته است. هزینه های تعبیر مهم تر از هزینه های آموزش برای مدل هایی است که در مقیاس استفاده می شود، بنابراین آموزش بیش از حد (پری چینچیلا) برای یک نقش پیاده سازی کوچکتر پیش فرض 2026 است.

## مفهوم

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### قانون هوفمن

از روزنامه چينچيلا، اين خسارت رو مي بينيم:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= پارامترهای (غیر شامل)
- $D$= توکن های آموزش
- $\alpha \approx 0.34$،$\beta \approx 0.28$(تقريباً همتقالي)
- $E \approx 1.69$، سقف خسارت غیر قابل کاهش
- $A \approx 406$،$B \approx 411$. .

دو اصطلاح با هم معامله می کنند در طول مقیاس.$N$در محاسبات ثابت ($C = 6ND$) و حلش کن.$\alpha$و$\beta$در بالا، نمایه ها در حدود 0.45 برای $N$و 0.55 برای$D$، پس نسبت دقیق مطلوب با بودجه به آرامی حرکت می کند`code/main.py`این دو روش مناسب اول مقاله، که بهینه را مستقیماً اندازه گیری می کنند، هر دو نماد را در حدود 0.5 قرار می دهند. این قانون تجربی نسبت ثابت را می دهد.$D = 20N$در$C = 6ND$و قانون انگشت ميگه:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

حسابداري: 20 توکن در هر پارامتر

### چرا به هر حال آموزش زيادي ميکني

چينچيللا-اپتميل از دست دادن هر روزي براي هر روزي کم ميکنه اما شما يک بار هزینه آموزش رو مي پردازيد

برای یک چت روت که یک تریلیون توکن در ماه را خدمت می کند، نتیجه گیری بر کل هزینه ها تسلط دارد. رویکرد لاما: قطار کوچکتر، طولانی تر. 8B در توکن های 15T عمیقاً بهینه سازی نتیجه گیری است:

- با گپ ها مصرف کننده مطابقت داره
- تاخير بخشي از 70B چينچيللا-افزاينده است
- کیفیت برای اکثر کارها به اندازه کافی نزدیک است.

مقاله 2024 DeepMind ("تدريب بیش از حد مطلوب جدید است") این را رسمی کرد. برای بار کاری تحت سلطه نتیجه گیری، نسبت مناسب به 100500 توکن در هر پارامتر بسته به حجم خدمت نزدیک است.

### ظهور در مقابل نرم بودن

ادعا: توانایی های خاصی (رسمی، استدلال چند مرحله ای، دنبال کردن زنجیره فکر) ناگهان در یک مقیاس "ظهور" می کنند.

Schaeffer و همکارانش (2023) استدلال کردند که این یک اثر اندازه گیری است: متریک های نوظهور از نمره های غیرمستقیم (مطابق دقیق، دقت در حد) استفاده می کنند که بهبود صاف در لوگیت های زیربنایی را پنهان می کنند. متریک های مداوم (برابر انتروپی) منحنیات صاف را نشان می دهند.

در سال 2026 توافق این است که پیش بینی ها از طریق خسارت مداوم قابل اعتماد هستند. قفسه های معیار اغلب آثار نمره ای هستند. بودجه ها را با متریک های مداوم برنامه ریزی کنید.

### عکس سال 2026

قوانین مقیاس گذاری هنوز هم کار می کنند، اما:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

بهینه ساز Muon (Kimi Moonlight، 2024) در داده های مشابه، افزایش محاسبه موثر 2x نسبت به AdamW را نشان داد. برخی از تمرینات 2026 از Muon به طور پیش فرض استفاده می کنند. ثابت مطلق در قانون مقیاس را تغییر می دهد، نه شکل آن.

```figure
scaling-laws
```

## آن را بسازید

ببین`code/main.py`ما معادله تلفات چينچيللا رو اجرا مي کنيم و براي حسابي بهینه حل مي کنيم$(N, D)$در هر یک از چند بودجه ی کامپیوتری.

### مرحله ی اول: از دست دادن چینچیلا

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

نقشه$L$به عنوان یک کنتور از$(N, D)$در ثابت$C = 6ND$حداقل رو پیدا کن

### مرحله دوم: مرز بهینه محاسبات

برای بودجه های کامپیوتری از`1e17`به`1e25`فلاپ ها رو پیدا کن$(N, D)$که به حداقل رساندن خسارت ها تحت تاثیر قرار می دهد$6ND = C$. نسبت رو بررسی کن$D/N \approx 20$. .

### مرحله سوم: هزینه آموزش بیش از حد

خسارت اضافی را که برای آموزش یک مدل 10 × کوچکتر (1/10 از N مطلوب، 10 × D مطلوب) پرداخت می کنید محاسبه کنید.

### مرحله 4: مقایسه با مدل های واقعی

به خبر رسيد`(N, D)`جفت های GPT-3، Chinchilla، Llama 3 8B، DeepSeek- V3 (پارام های فعال) و مقایسه پیش بینی شده با گزارش شده از دست دادن.

## ازش استفاده کن

احتمال نداره خودت يه مدل مرزي رو آموزش بدي اما قانون مقیاس به تو ميگه:

1. **Whether your fine-tune has enough data.**اگر داده های خاص شما در هر پارامر مدل پایه کمتر از 20 توکن باشد، انتظار دارید که در سطح خسارت اشباع شود.
2. **Whether to pick a bigger base model.**اگر تمام بودجه خود را برای نتیجه گیری خرج می کنید، مدل کوچکتر و طولانی تر را ترجیح دهید.
3. **Where the returns diminish.**فراتر از 1000× چینچیلا، تغییرات از دست دادن چوب به شور تبدیل می شوند.

**The research trajectory in 2026:**

- **Data-constrained regime.**وب تعداد محدود از توکن های با کیفیت بالا (~510 تریلیون انگلیسی پس از فیلتر) دارد. پیش آموزش مرزی به این سقف نزدیک می شود. داده های مصنوعی، چندزبانی، چندزبانی و تنظیم دقیق مقیاس RLHF اهرم بعدی هستند.
- **Compute-multiplier tricks.**بهینه ساز موون، MoE، بهتر نگه داشتن داده ها هر کدام ثابت های مطلق را تغییر می دهند، نه اسیمپتوت.
- **Scaling laws for RL.**سوال باز. شواهد اولیه نشان می دهد قانون قدرت در نمونه های RL اما با نمایه های بسیار متفاوت از قبل از تمرین.

## -باده

ببین`outputs/skill-training-budget-estimator.md`مهارت ها انتخاب ميکنن`(N, D, hours, GPU)`برای یک دوره آموزشی جدید با توجه به بودجه محاسباتی، محدودیت های پیاده سازی و از دست دادن هدف.

## تمرینات

1. **Easy.**فرار کن`code/main.py`چاپ چينچيللا - مطلوب$(N, D)$برای بودجه های کامپیوتری`1e20`،`1e22`،`1e24`با ميز مدل واقعي مقایسه کن
2. **Medium.**از خط خط خسارت به عنوان تابع حساب ها استفاده کنید.`log10(C)`براي مرز حسابي مطلوبي مشخص کن قانون پيش بيني ميکنه که به اين مسئله نياز داريم$>10^{28}$FLOPs برای کاهش بعدی 0.1 در اینتروپی کراس.
3. **Hard.**قانون مقیاس بندی خود را بر روی 5 مدل کوچک (100K تا 10M پارام) که بر روی همان مجموعه داده آموزش دیده اند، تنظیم کنید. تخمین$\alpha$و$E$. تا چه حد نماد شما با نماد منتشر شده ها مطابقت داره؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## خواندن بیشتر

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) اولین مقاله قانون مقیاس بندی؛ آموزش کم
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)چينچيللا
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) ظهور به عنوان اثر اندازه گیری.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)چرا آموزش زيادي لاما براي کاري که داره درسته
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) ضربگر محاسبه 2×
