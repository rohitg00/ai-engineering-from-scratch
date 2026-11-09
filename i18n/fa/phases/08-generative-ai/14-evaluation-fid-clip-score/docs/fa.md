# ارزیابی  FID، CLIP Score، ترجیحات انسانی

> هر نمره ای که در هر مدل تولید شده است، FID، CLIP و نرخ پیروزی را از یک میدان ترجیح انسانی ذکر می کند. هر عدد دارای حالت شکست است که یک محقق تعیین کننده می تواند بازی کند. اگر شما حالت شکست را نمی دانید، نمی توانید از یک بازی پیشرفت واقعی را تشخیص دهید.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## مشکل

یک مدل تولیدگر بر اساس * کیفیت نمونه * و * رعایت شرایط * قضاوت می شود. هیچ یک از آنها اندازه گیری شکل بسته ای ندارد. مدل شما باید 10،000 تصویر را ارائه دهد؛ چیزی باید به آنها اعداد را اختصاص دهد؛ شما باید به اعداد در سراسر خانواده های مدل، در سراسر قطعنامه ها، در سراسر معماری اعتماد کنید. سه متریک از دستکش 2014-2026 زنده ماند:

- **FID (Fréchet Inception Distance).**فاصله بین دو توزیع  واقعی و تولید شده  در فضای ویژگی شبکه آغاز. پایین تر بهتر است.
- **CLIP score.**شباهت بین تصویر تولید شده از تصویر CLIP و متن CLIP از یک پرامپت. بالاتر بهتر است. اندازه گیری های پیگیری.
- **Human preference.**دو مدل را با یک پرامپت در یک صفحه قرار دهید، انسان ها (یا یک مدل کلاس GPT-4) بهترین را انتخاب کنند و به یک نمره Elo جمع کنند.

شما همچنین خواهید دید: IS (نمره آغاز، عمدتا بازنشسته) ، KID، CMMD، ImageReward، PickScore، HPSv2، MJHQ-30k. هر یک برای یک شکست از قبلی اصلاح می کند.

## مفهوم

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### کیفیت نمونه FID 

Heusel et al. (2017).

1. ویژگی های Inception-v3 (2048-D) را برای N تصاویر واقعی و N تولید کنید.
2. يه گاسين رو به هر حوضچه ي حسابي بگيريم$\mu_r, \mu_g$و همتای$\Sigma_r, \Sigma_g$. .
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$. .

تفسیر: فاصله فرشیت بین دو گاسین چند متغیر در فضای ویژگی. پایینتر = توزیع های مشابه تر.

حالت شکست:
- **Biased on small N.**FID به طور متوسط مربع بر روی توزیع ویژگی  N کوچک زیرنظر متغیر است، به طور نادرست FID پایین می دهد. همیشه استفاده کنید $N \ge 10{,}000$. .
- **Inception-dependent.**در ابتدا v3 در ImageNet آموزش دیده است. دامنه های دور از ImageNet ( چهره ها، هنر، تصاویر متن) FID بی معنی را تولید می کنند. از یک استخراج ویژگی خاص دامنه استفاده کنید.
- **Gaming.**اضافه کردن روی قبل از شروع FID پایین بدون بهبود کیفیت بصری را به دست می آورد.

### نمره CLIP  پیوستن سریع

رادفورد و همکاران (2021). برای یک تصویر تولید شده + پرامپت:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

متوسط در 30k تصویر تولید شده → یک مقیاس قابل مقایسه بین مدل ها.

حالت شکست:
- **CLIP's own blind spots.**CLIP استدلال ترکیب ضعیف دارد ("یک مکعب قرمز روی یک کاله آبی" اغلب شکست می خورد). مدل ها می توانند بدون دنبال کردن دستورالعمل های پیچیده در امتیاز CLIP رتبه خوبی داشته باشند.
- **Short prompt bias.**پیام های کوتاه با تصاویر CLIP بیشتر مطابقت دارند. پیام های طولانی تر به طور مکانیکی نمرات CLIP پایین تر دارند.
- **Prompt gaming.**شامل "کوالتی بالا، 4K، شاهکار" در پیامک امتیاز CLIP را بدون بهبود پیوند تصویر-متن افزایش می دهد.

CMMD (Jayasumana و همکاران 2024) برخی از این موارد را حل می کند: از ویژگی های CLIP به جای Inception استفاده می کند، تفاوت حداکثر متوسط به جای Fréchet. بهتر در تشخیص تفاوت های ظریف کیفیت.

### ترجیحات انسان  حقیقت اصلی

یک مجموعه از پیام ها را انتخاب کنید. با مدل A و مدل B تولید کنید. جفت ها را به انسان ها (یا یک قاضی LLM قوی) نشان دهید. مجموع برنده ها به نمره ایلو یا برادلی-ترری تبدیل می شوند. معیار:

- **PartiPrompts (Google)**: 1600 درخواست مختلف، 12 دسته
- **HPSv2**: 107 هزار نوتیشن انسانی، به طور گسترده ای به عنوان یک نماینده خودکار استفاده می شود.
- **ImageReward**: 137 هزار جفت ترجیح عکس فوری، مجوز MIT
- **PickScore**: آموزش داده شده در انتخاب انتخاب 2.6M
- **Chatbot-Arena-style image arenas**.https://imagearena.ai/و دیگران.

حالت شکست:
- **Judge variance.**غیر متخصصین ترجیحات متفاوتی نسبت به کارشناسان دارند. از هر دو استفاده کنید.
- **Prompt distribution.**.مطالبات انتخاب شده از کرسی به نفع یک خانواده است
- **LLM-judge reward hacking.**قاضي GPT-4 با نتيجهاي خوب ولي اشتباه دست و پنجه ميگيره

## با هم استفاده کنید

گزارش ارزیابی تولید باید شامل:

1. FID بر روی 10 تا 30 هزار نمونه در برابر توزیع واقعی (کوالتی نمونه)
2. نمره CLIP / CMMD در نمونه های مشابه در مقابل پیام های آنها (ملازمیت).
3. نرخ پیروزی در یک میدان کور در مقابل مدل قبلی (تفضيلت کلی).
4. تجزیه و تحلیل حالت شکست: 50 نمونه تصادفی از خروجی که برای مشکلات شناخته شده نشان داده شده است (اناتومی دست، رندرنگ متن، تعداد متناظر ثابت).

هر اندازه گیری یک نفر دروغ است. سه اندازه گیری تایید کننده + بررسی کوالیتی یک ادعا است.

```figure
gx-fid-distributions
```

## آن را بسازید

`code/main.py`FID، CLIP-score-like و Elo را در "وکتورهای ویژگی" مصنوعی اجرا می کند (ما از ویکتورهای 4D به عنوان جایگزین برای ویژگی های آغاز استفاده می کنیم). می بینید:

- محاسبه FID در یک N کوچک و در یک N بزرگ  تعصب.
- "نمره CLIP" به عنوان شباهت کوسین بین مجموعه های ویژگی.
- قانون بروزرسانی Elo از یک جریان اولویت مصنوعی

### مرحله ی اول: FID در چهار خط

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### مرحله دوم: شبیه سازی کوزین به سبک CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### مرحله سوم: جمع آوری Elo

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## دام ها

- **FID at N=1000.**هوریستیک تحت N=10k قابل اعتماد نیست. مقاله هایی که گزارش FID کم N را می دهند بازی هستند.
- **Comparing FID across resolutions.**اندازه 299×299 شروع تغییر توزیع ویژگی. فقط با رزولوشن مطابقت مقایسه کنید.
- **Reporting one seed.**حداقل 3 تا تخم رو اجرا کن
- **CLIP score inflation via negative prompts.**بعضی از لوله ها با اضافه کردن پرامپ، CLIP رو افزایش میدن
- **Elo bias from prompt overlap.**اگر هر دو مدل در طول تمرین یک پیامک بنچ مارک را ببینند، Elo بی معنی است. از مجموعه های پیامک های طولانی استفاده کنید.
- **Human eval paid-crowd skew.**نوتیفیسورهای مولد و متورک جوان تر / دوستانه فناوری هستند. با کارشناسان استخدام شده هنر / طراحی مخلوط شوید.

## ازش استفاده کن

پروتکل ارزیابی تولید در سال 2026:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

همه چهار ستون در یک گزارش = ادعای هر کدام به تنهایی = بازاریابی

## -باده

نگه دار`outputs/skill-eval-report.md`. مهارت یک نقطه بازرسی مدل جدید + خط پایه را می گیرد و یک برنامه ارزیابی کامل را ارائه می دهد: اندازه نمونه ها، متریک، سوند های حالت شکست، معیارهای تایید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`.با مقایسه FID در N=100 در برابر N=1000 در همان توزیع های مصنوعی گزارش میزان تعصب
2. **Medium.**CMMD را از ویژگی های سبک CLIP مصنوعی پیاده سازی کنید (برای فرمول، Jayasumana et al., 2024 را ببینید). حساسیت نسبت به تفاوت های کیفیت در مقایسه با FID.
3. **Hard.**تنظیم HPSv2 را تکرار کنید: 1000 جفت تصویر فوری را از زیر مجموعه Pick-a-Pic بگیرید، یک امتیاز دهنده کوچک مبتنی بر CLIP را بر اساس اولویت ها تنظیم کنید و توافق آن را با مجموعه ای که نگه داشته شده است اندازه بگیرید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## يادداشت تولیدی: ارزیابی یک کار فرضیه نیز است

اجرا FID در نمونه های 10k به معنای تولید تصاویر 10k است. برای یک پایه SDXL 50 مرحله ای در 10242 در یک L4 واحد، که ~ 11 ساعت است از یک درخواست نتیجه گیری. بودجه ارزیابی واقعی است، و قاب بندی دقیقا سناریو غیر فعال-تثبیت است (به حداکثر رساندن تولید، نادیده گرفتن TTFT):

- **Batch hard, forget latency.**تشخیص غیر خطی = دسته بندی جامد در بزرگترین اندازه که در حافظه قرار دارد. `pipe(...).images`با`num_images_per_prompt=8`در یک H100 80GB، ساعت دیواری 4-6x سریعتر از درخواست یکبار اجرا می شود.
- **Cache the real features.**استخراج ویژگی های آغاز (FID) یا CLIP (CLIP-score، CMMD) در مجموعه مرجع واقعی * یک بار* اجرا می شود، به عنوان یک`.npz`. به هر ارزیابی دوباره حساب نکن

برای CI / دروازه های بازپسین: FID + CLIP را در زیر مجموعه 500 نمونه در هر PR (~ 30 دقیقه) اجرا کنید؛ FID + HPSv2 + Elo را هر شب به طور کامل اجرا کنید.

## خواندن بیشتر

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) کاغذ FID
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) کلپ
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) پارسپرامپ
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) بررسی حالت شکست
