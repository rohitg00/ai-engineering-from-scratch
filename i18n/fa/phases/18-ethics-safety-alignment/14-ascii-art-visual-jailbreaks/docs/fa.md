# هنر و بازداشت های تصویری ASCII

> ژیانگ، شویی، نیو، شیانگ، راماسوبرامانیان، لی، پووندران، "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753). توکن های مربوط به ایمنی را در یک درخواست مضر پنهان کنید، آنها را با نسخه های ASCII از همان حروف جایگزین کنید و پیام مخفی را ارسال کنید. GPT-3.5، GPT-4, Gemini، Claude، Llama-2 همه موفق به تشخیص قوی ASCII-art توکن ها نمی شوند. حمله از PPL (فلترهای گیج کننده) ، دفاعی پارافرز و Retokenization عبور می کند. مرتبط: معیار ViTC تشخیص پیام های بصری غیر معنوی را اندازه گیری می کند؛ StructuralSleight به ساختار های غیر معمول متن رمزگذاری شده (درخش، نمودار، JSON گنجانده شده) به عنوان یک خانواده از حملات رمزگذاری عمومی می کند.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## اهداف یادگیری

- حمله ArtPrompt را شرح دهید: مرحله شناسایی کلمه، جایگزینی ASCII-art، آخرین درخواست پوشیده شده.
- توضیح دهید که چرا سیستم های دفاعی استاندارد (PPL، پارافرز، ریتوکنیزاسیون) در ArtPrompt شکست می خورند.
- ViTC را تعریف کنید و آنچه را که اندازه گیری می کند را توصیف کنید.
- StructuralSleight را به عنوان یک کلی سازی به ساختار های غیر معمول متن کوده شده تعکفی توصیف کنید.

## مشکل

حمله ها از طریق پارافرز و رول پلی (درسه 12) و از طریق زمینه طولانی (درسه 13) بر روی الگوی سطح متن عمل می کنند. ArtPrompt در سطح تشخیص عمل می کند: مدل نماد ممنوع را تجزیه و تحلیل نمی کند. آن را تجزیه و تحلیل یک تصویر ارائه شده در شخصیت. فیلتر ایمنی نشان دهنده امتیازات بی ضرر را می بیند. مدل یک کلمه را می بیند.

## مفهوم

### آرتر پرامپ، دو مرحله

مرحله ۱: شناسایی کلمه. در صورت درخواست مضر، مهاجم از یک LLM برای شناسایی کلمات مربوط به ایمنی استفاده می کند (به عنوان مثال، "بم" در "چگونه ساخت بمب") 

مرحله ۲. تولید فوری پوشیده شده. هر کلمه شناسایی شده را با نمایش هنر ASCII خود (بلاک 7x5 یا 7x7 از شخصیت هایی که شکل حروف را تشکیل می دهند) جایگزین کنید. مدل یک شبکه از نقاط بندی و فضاهای را دریافت می کند که یک مدل به اندازه کافی قادر می تواند به عنوان کلمه تشخیص دهد. یک فیلتر ایمنی فقط شبکه را می بیند.

نتیجه: GPT-4، Gemini، Claude، Llama-2، GPT-3.5 همه شکست خورده اند. نرخ موفقیت حمله بالاتر از 75 درصد در زیر مجموعه مقادیر خود.

### چرا دفاعي هاي استاندارد شکست مي خورند

- **PPL (perplexity filter).**هنر ASCII پیچیدگی بالایی دارد اما همه ورودی های جدید نیز همین طور است. گزینه های حدودی که مانع از ورودی ساختاری قانونی ArtPrompt می شوند.
- **Paraphrase.**پارافرز کردن پرامپرت هنر ASCII را نابود می کند. در عمل، پارافراسر LLM اغلب هنر را حفظ یا بازسازی می کند.
- **Retokenization.**تقسیم کردن توکن ها به طور متفاوت تغییر نمی کند که دید مدل شکل حروف را تشخیص می دهد.

مسئله اصلی این است که فیلترهای ایمنی در سطح توکن یا سیمانی هستند؛ آرټ پرامپ در سطح تشخیص بصری عمل می کند.

### شاخص مرجع ViTC

تشخیص پیام های بصری غیر معنوی. توانایی مدل را برای خواندن ASCII-art، wingdings و سایر محتوای بصری غیر متنی-معنی سنجش می کند. اثربخشی ArtPrompt با دقت ViTC ارتباط دارد: هرچه مدل بهتر متن بصری را بخواند، ArtPrompt بهتر روی آن کار می کند. این یک تعادل قابلیت-سلامتی است.

### ساختار

آرترپروپت: ساختارهای غیرمعمول متن کدگذاری شده (UTES) را عمومی می کند. درختان، نمودارها، JSON پوشیده شده، CSV-in-JSON، بلوک های کد سبک متفاوت. اگر یک ساختار در آموزش داده های ایمنی نادر است اما توسط مدل قابل تجزیه است، می تواند محتوای مضر را پنهان کند.

پیامدهای دفاعی: ایمنی باید در نمایش های ساختاری که مدل می تواند تجزیه و تحلیل کند، عمومی شود. مجموعه بزرگ و در حال رشد است.

### انالوگ حالت تصویر

LLMs بصری (GPT-5.2 ، Gemini 3 Pro ، Claude Opus 4.5 ، Grok 4.1) سطح حمله را گسترش می دهد. حملات سبک ArtPrompt با تصاویر واقعی قوی تر از آنالوگ های ASCII هستند زیرا کدرهای تصویر سیگنال غنی تر تولید می کنند.

### جایی که این در مرحله 18 قرار داره

درس 12-14 سه بردار حمله orthogonal را توصیف می کند: اصلاح تکراری (PAIR) ، طول زمینه (MSJ) و کدگذاری (ArtPrompt / StructuralSleight). درس 15 از حملات مدل متمرکز به حملات مرزی سیستم (دست تزریق فوری غیر مستقیم) تغییر می کند. درس 16 پاسخ ابزار دفاعی را توصیف می کند.

```figure
al-ascii-cloak
```

## ازش استفاده کن

`code/main.py`شما می توانید کلمات خاصی را در یک سوال مضر با گلیف های هنر ASCII پنهان کنید، تایید کنید که رشته پنهان شده از فیلتر کلمات کلیدی عبور می کند و (باختیاری) از طریق یک شناسه ساده، رشته پنهان شده را رمزگذاری کنید.

## -باده

این درس به ما کمک می کند`outputs/skill-encoding-audit.md`. در نظر گرفتن گزارش دفاع از jailbreak، آن را فهرست کردن کد گذاری خانواده های حمله پوشش داده شده (ASCII هنر، base64, leet-speak، UTF-8 homoglyph، UTES) و لایه دفاعی که هر یک را گرفتن.

## تمرینات

1. فرار کن`code/main.py`.آگاه کنید که رشته پوشیده از فیلتر ساده کلمات کلیدی عبور می کند. تغییر سطح کاراکتر مورد نیاز را گزارش کنید.

2. یک کدگذاری دوم را پیاده سازی کنید: base64 برای همان کلمه هدف. نرخ دور زدن فیلتر را با ArtPrompt و مشکل بازیابی مقایسه کنید.

3. Jiang et al. 2024 بخش 4.3 (نتایج پنج مدل) را بخوانید. دلیل اینکه چرا مقاومت ArtPrompt کلود بالاتر از مقاومت جمیانی در همان معیار است را پیشنهاد کنید.

4. یک دفاع پیش از نسل طراحی کنید که مناطق شکل ASCII را در پرامپت تشخیص دهد. نرخ مثبت دروغین را در کد مشروع، جدول ها و نماد ریاضی اندازه گیری کنید.

5. StructuralSleight 10 ساختار کد را لیست می کند. یک دفاع عمومی را که همه 10 را اداره می کند، رسم کنید و هزینه محاسبه را در هر پرامپت دفاع شده تخمین بزنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## خواندن بیشتر

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) کاغذ jailbreak از هنر ASCII
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) عمومی سازی UTES
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) حمله تکراری مکمل
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) حمله ی طول مکمل
