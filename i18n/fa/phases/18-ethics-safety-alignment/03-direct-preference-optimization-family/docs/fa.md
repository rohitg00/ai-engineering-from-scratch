# خانواده بهینه سازی اولویت های مستقیم

> رافائلوف و همکارانش (2023) نشان داد که بهینه سازی RLHF دارای فرم بسته در مورد داده های ترجیح است، بنابراین شما می توانید از مدل پاداش صریح خارج شوید و سیاست را مستقیما بهینه کنید. این بینش باعث ایجاد یک خانواده  IPO، KTO، SimPO، ORPO، BPO  شد که هر کدام یک از حالت شکست DPO را اصلاح می کردند. در سال 2026، الگوریتم های تعاونی مستقیم، دویدن های پس از آموزش در مرز بیشتری را از PPO ارسال می کنند. اما منحنی بهینه سازی بیش از حد از درس 2 هنوز هم اعمال می شود: DAAs از گودارت فرار نمی کنند، آنها فقط به جایی که گاز می گیرد حرکت می کنند.

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## اهداف یادگیری

- شکل بسته DPO را از RLHF-with-KL-optimum اخذ کنید.
- حالت شکست هر یک از راه حل های IPO، KTO، SimPO، ORPO، BPO را در DPO بیان کنید.
- تفاوت بین "شکاف اجر ضمنی" و "قوة ترجیح" را تشخیص دهید و توضیح دهید که چرا نقشه برداری هویت IPO مهم است.
- توضیح دهید چرا Rafailov و همکاران (NeurIPS 2024) نشان می دهد که DAAs با وجود عدم وجود RM صریح بیش از حد بهینه سازی می کنند.

## مشکل

هدف RLHF (درس اول):

```math
\max_{\pi} \; \mathbb{E}_{x, y \sim \pi} \big[ r(x, y) \big] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{ref}})
```

دارای یک بهینه شناخته شده است:

```math
\pi^*(y \mid x) = \frac{1}{Z(x)} \, \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)
```

پس پاداش به طور ضمنی توسط نسبت سیاست مطلوب به مرجع تعریف می شود:

```math
r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
```

اينو به احتمالي برادلي-تيري و تابع قسمتي تبديل کن`Z(x)`لغو ميکنه چون فقط بستگی داره`x`. آنچه باقی مانده تنها یک ضرر در پارامترهای سیاست است  هیچ مدل پاداش مورد نیاز نیست.

مروارید: مشتق فرض می کند که مطلوب قابل دستیابی است، داده های ترجیحی در توزیع است، و سیاست مرجع لنگر حالت واقعی است. هیچ یک از این موارد دقیقاً درست نیست. هر عضو خانواده فرضیه ای متفاوت را اصلاح می کند.

## مفهوم

### DPO (Rafailov و همکارانش، 2023)

```math
L_{\text{DPO}} = -\log \sigma\!\left(
  \beta \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}
  - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}
\right)
```

چه اتفاقی می تواند پیش بیاد؟

- شکاف ضمنی پاداش`beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)`یک ترجیح کوچک می تواند شکاف بزرگی را ایجاد کند.
- این درایو از دست دادن، سوابق انتخاب شده و رد شده را در جهت های مخالف هدایت می کند. می تواند سوابق مطلق انتخاب شده را تا زمانی که سوابق رد شده سریعتر سقوط کند، پایین بکشد. این پدیده واکنش انتخاب شده است.
- ترجیحات خارج از توزیع (زفت هایی که هر دو پاسخ در سیاست مرجع نادر است) پاداش ضمنی تعسفی را به ارمغان می آورد.

### IPO (Azar و همکارانش، 2024)

بهینه سازی اولویت هویت، log-sigmoid را با نقشه برداری هویت بر روی احتمال اولویت جایگزین می کند. از دست دادن یک خطای مربع در یک هدف محدود می شود:

```math
L_{\text{IPO}} = \left( \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} - \frac{1}{2\beta} \right)^2
```

حاشیه توسط `1/(2 beta)`. قدرت ترجیح و تفاوت ضمنی پاداش متناسب است . هیچ انفجار

### KTO (Ethayarajh و همکارانش، 2024)

بهینه سازی کانمن-تفرسکی ساختار جفت را کاملاً کاهش می دهد. با توجه به یک خروجی واحد برچسب گذاری شده و یک سیگنال دوگانه "خواسته" یا "غیرخواسته" ، آن را به یک ابزار نظریه چشم انداز نقشه می زند:

```math
v(x, y) = \sigma\!\left(\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)} - z_{\text{ref}}\right)
```

با وزن های مختلف برای سود و خسارت (حوادث از دست دادن) مزایای: شما می توانید از داده های غیر جفت استفاده کنید که بسیار فراوان تر است.

### SimPO (Meng و همکارانش، 2024)

بهینه سازی ساده ترجیحات سیگنال آموزش را با تولید هماهنگ می کند. سیاست مرجع را کاملا حذف کنید و احتمال ثبت را با طول عادی کنید:

```math
L_{\text{SimPO}} = -\log \sigma\!\left(
  \frac{\beta}{|y_w|} \log \pi(y_w \mid x)
  - \frac{\beta}{|y_l|} \log \pi(y_l \mid x)
  - \gamma
\right)
```

با یک حاشیه`gamma`به طور معمول، این انگیزه را برای بهره برداری از حالت شکست در طول DPO حذف می کند (در طول`y_w`با ساخت یک شکاف بزرگ تر از لاگ-برابر می دهد).

### ORPO (Hong و همکارانش، 2024)

بهینه سازی ترجیحات نسبت احتمالات رادای احتمال منفی SFT یک اصطلاح ترجیح را اضافه می کند:

```math
\begin{aligned}
L_{\text{ORPO}} &= L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}} \\
L_{\text{OR}} &= -\log \sigma\!\left(\log \frac{\text{odds}(y_w)}{\text{odds}(y_l)}\right)
\end{aligned}
```

هیچ سیاست مرجعی  اصطلاح SFT تنظیم کننده است. در یک مرحله از مدل پایه تا مدل هموار. هیچ نقطه کنترل SFT جداگانه ای نیست.

### BPO (پیشنهاد ICLR 2026, OpenReview id=b97EwMUWu7)

مشکل ردای منتخب پایین را شناسایی می کند: DPO رتبه بندی را حفظ می کند `y_w > y_l`اما آزمايشات مطلق`y_w`BPO اضافه می کند یک خط اصلاح که مجازات حرکت پایین روی پاسخ انتخاب شده است. گزارش دقیق +10.1% در Llama-3.1-8B-Instruct در استدلال ریاضی بر DPO.

### نتیجه جهانی: DAAs هنوز بیش از حد بهینه سازی می کنند

رافیلوف و همکاران "قوانینی مقیاس بندی برای بهینه سازی بیش از حد مدل پاداش در الگوریتم های هماهنگی مستقیم" (NeurIPS 2024) سیاست های آموزش داده شده را با DPO، IPO، SLiC در مجموعه داده های متعدد در بودجه های KL انجام می دهند. منحنیات طلا- پاداش به مقابل KL دارای شکل قله و سقوط Gao و همکاران هستند. درخواست های ضمنی پاداش نمونه های خارج از توزیع در طول آموزش است؛ تنظیمات KL این را ثابت نمی کند.

DAAs از گودارت فرار نمی کنند. آنها سطح را از "نموذج پاداش بیش از حد بهینه سازی شده" به "نسب سیاست مرجع بیش از حد بهینه سازی شده" تغییر می دهند.

### انتخاب در میان آنها (2026)

- اگر داده های بزرگ انتخاب های جفتی دارید: DPO با بتا محافظه کار، SimPO اگر تعصب طول آشکار باشد.
- اگر شما بازخورد دوگانه ای را نداشته باشید: KTO.
- اگر می خواهید یک خط لوله یک مرحله از یک مدل پایه: ORPO.
- اگر در دفترچه های DPO سوابق سوابق انتخاب شده ای را ببینید: BPO.
- اگر نقاط ترجیح بسیار متفاوت باشد و DPO اشباع کننده باشد: IPO.

هر لابراتوار پنج تا را با یک باتری اجرا می کند و برنده را برای هر کار انتخاب می کند. هیچ دلیلی وجود ندارد که بهینه برای استدلال ریاضی و ایمنی یکسان باشد.

```figure
dpo-margin
```

## ازش استفاده کن

`code/main.py`در این مجموعه، 6 ضرر (DPO، IPO، KTO، SimPO، ORPO، BPO) در یک مجموعه داده های ترجیح بازی را مقایسه می کند که در آن قدرت واقعی ترجیح با جفت متفاوت است. هر ضرر با یک نمونه 500 جفت با سیاست نرم کم بهینه سازی می شود. نرخ پیروزی نهایی، انحراف انتخاب شده از لاگ-پروب و انتشار پاداش ضمنی در هر روش را نشان می دهد.

## -باده

این درس به ما کمک می کند`outputs/skill-preference-loss-selector.md`با توجه به آمار مجموعه داده ها (در مقایسه با جفت و غیر جفت، قدرت متغیر و یکسانی اولویت، توزیع طول) و هدف (در مرحله ی یک یا SFT پس از اولویت) ، یک از دست دادن اولویت را توصیه کنید و از حالت شکست که از آن محافظت می کند گزارش کنید.

## تمرینات

1. فرار کن`code/main.py`گزارش آخرین کاهش انتخاب شده در مورد DPO و BPO. BPO باید احتمال مطلق انتخاب شده را بالاتر نگه دارد  این را تایید کنید.

2. اطلاعات ترجیح را تغییر دهید تا همه جفت ها دارای قدرت برابر باشند. کدام یک از شش روش قوی تر است؟ کدام درجه؟ مزایای IPO را در اینجا توضیح دهید.

3. پاسخ های رد شده را به طور متوسط دو برابر طولانی تر از انتخاب شده کنید. بدون تغییر چیزی دیگر، بهره برداری طول DPO را به صورت عددی و سمپو را ثابت کنید.

4. Rafailov et al. (NeurIPS 2024) ادعا می کنند DAAs بیش از حد بهینه سازی می کنند. نسخه یک نقطه را تولید می کنند: انحراف KL انتخاب شده-منصوری رد شده و بهینه سازی بیش از حد در DPO در بتا بزرگ را مشاهده می کنند.

5. خلاصه مقاله BPO را بخوانید (OpenReview b97EwMUWu7). اصلاح یک خطی را که BPO به DPO اضافه می کند بنویسید.`code/main.py`. .

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DPO | "RLHF without a reward model" | Loss derived from the closed-form RLHF optimum; policy parameters only |
| Implicit reward | "the log-ratio" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — the DPO-implied reward |
| IPO | "bounded DPO" | Replaces log-sigmoid with identity; implicit reward gap capped by `1/(2 beta)` |
| KTO | "unpaired DPO" | Prospect-theory utility over single labels with loss aversion |
| SimPO | "reference-free DPO" | Length-normalized log-likelihood + margin; no reference policy |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term; trains from base model in one pass |
| BPO | "chosen-preserving DPO" | DPO plus a penalty for decreasing the chosen response's absolute log-prob |
| Degraded Chosen | "chosen goes down" | DPO decreases chosen log-prob so long as rejected falls faster |
| DAA | "direct alignment algorithm" | Any preference-loss method that skips an explicit RM |

## خواندن بیشتر

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
