# Capstone 05  آژانس تحقیقاتی مستقل (کلاس دانشمند هوش مصنوعی)

> "سکانا" AI-Scientist-v2 مقاله های کامل را منتشر کرد. مامور آزمایشگاه آزمایشات رو انجام داد آيل اينترنتي آثار رو به هم ميگه شکل 2026 برنامه ریزی-جایز-تحقق درخت جستجو در مورد آزمایشات، هزینه بودجه، اجرای کد sandboxed، یک دیدگاه-بازدید LaTeX نویسنده، و یک مجموعه خودکار NeurIPS سبک بازبینی. هدف اینه که یکی بسازیم، آن را در حدود ۳۰ دلار در هر کاغذ اجرا کنیم و از تیم قرمز فرار از جعبه شن که سکانا مستند کرده زنده بمانیم.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## مشکل

آژانس های تحقیقاتی مستقل در سال 2026 از حد عبور کردند. مقاله AI-Scientist-v2 از "Sakana AI" در مجله طبیعت با مقاله های تولید شده منتشر شد که بررسی همتایان را از کارگاه پاک کرد. ShinkaEvolve (ICLR 2026) خط را به فرضیه های تکامل گسترش داد. آزمایشگاه عامل AMD آثار قابل بازيابي رو ارسال کرد عوامل جادویی نیستند آنها یک حلقه برنامه اجرا تایید هستند که روی درخت آزمایشات کاندیداها می چرخد، با قیمت های محدود، جعبه های شنوی محدود با دانه ها و بررسی خودکار. سفينه در حال انجام عمل بودجيه و اطلاعات امنيتي

شما با اجرای یک در مقابل یک ایده تخم در یک دامنه باریک (به عنوان مثال، آبلاسیون توجه-سپرسیتی در یک ترانسفورمتر پارامتر 100M) ، حلقه را یاد می گیرید. ارزش این نیست که در اولین بار چیزی جدید کشف کنی. ارزش در زیرساخت ها است: جستجوی درخت، جعبه شنای آزمایش، حلقه نویسندگان-مراجعات، گزارش تیم قرمز. تیم ساکانا شکست های فرار جعبه شنوی رو ثبت کرده است، مامور شما باید از تیم قرمز عبور کند.

## مفهوم

مامور اولين جستجوي درخته گره ها مشخصات آزمایش هستند: (فرضی، تنظیم، کد، نتیجه انتظار می رود). یک مرحله گسترش به کودکان با ویرایش های کوچک (تغییر کننده تبادل، تغییر اندازه دسته، حذف یک قطعه) پیشنهاد می کند. هر بچه در یک جعبه قند تازه با یک کلاه منابع سخت می رید. نتایج به یک تابع امتیاز باز می گردند که گره ها را با (تفصیل × کیفیت × بودجه باقی مانده) رتبه بندی می کند. درخت تا وقتي که بودجه تموم بشه رشد ميکنه و بعد بهترين شاخه رو مي نويسند

نویسنده چند موداليه این یک مسودات لاتکس تولید می کند، آن را مرتب می کند، اعداد را ارائه می دهد و PDF ارائه شده را به حالت دید کلاود اوپوس 4.7 برای انتقاد از طرح، قابلیت خواندن اعداد و موازی اثبات ادعاها می دهد. یک مجموعه بازرس از پنج قاضی LLM نمره های سبک NeurIPS (نویستی، سختی، وضوح، قابل بازیافت، تاثیر) را صادر می کند؛ اگر متوسط زیر سنین کاهش یابد، مقاله با انتقاد به نویسنده باز می گردد.

ایمنی تحمل پذیر است. هر آزمایش در یک جعبه شنای E2B یا Daytona بدون خروج شبکه، ساعت دیواری محدود و محدودیت منابع محدود اجرا می شود. مرحله تولید کد عامل از طریق یک لایه سیاست عبور می کند که سیسکال های خارج از جعبه شنای را مسدود می کند. گزارش تیم قرمز سطح حمله مستند شده توسط ساکانا (بم های شکنی، فرار سیستم فایل ها، تماس های شبکه نوشته شده توسط LLM) را بازیافت می کند.

## معماری

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## دسته

- سازش: لینگ گراف با کنترل و دروازه های تایید انسانی
- جستجوی درخت: بهترین اولین مورد سفارشی از گره های آزمایش (به سبک AB-MCTS از Sakana v2)
- Sandbox: E2B در هر آزمایش، Docker-in-Docker fallback؛ محدودیت منابع از طریق گروه های c
- ادبیات: API گراف دانش آموز معنوی + OpenAlex + مخزن محلی FAISS از خلاصه
- نویسنده: قالب LaTeX + Claude Opus 4.7 (موډ دید) برای انتقاد و طرح تصاویر
- بازبینی: مجموعه ای از 5 قاضی (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) با جمع بندی با وزن
- چارچوب آزمایش: PyTorch 2.5 برای آزمایشات فیزیکی، W&B برای چوب برداری
- قابل مشاهده: لنگفوز برای ردیابی عوامل، بودجه سخت 30 دلار برای هر کاغذ

```figure
ce-experiment-tree
```

## آن را بسازید

1. **Seed and domain scoping.**یک ایده تخم (به عنوان مثال "تعمیر الگوهای تنفر در نقشه های توجه ترانسفورماتورهای زیر-1B") را بگیرید. فضای جستجو را تعریف کنید: مدل ها، مجموعه داده ها، بودجه محاسبه.

2. **Literature pass.**از Semantic Scholar + OpenAlex برای 50 مقاله مرتبط مورد ذکر استفاده کنید؛ خلاصه های محلی؛ یک دایرکت دامنه یک صفحه ایجاد کنید.

3. **Tree scaffolding.**ریشه رو با فرضيه تخم شروع کن`expand(node) -> children`با پیشنهادات کوچک ویرایش (یک تغییر در پیکربندی برای هر کودک)`score(node)`به عنوان یک نوع جدید وزن شده × کیفیت × بودجه.

4. **Sandbox wrapping.**هر آزمايشي اجرا ميشه`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`(یا سیاست E2B معادل) دانه ها به جعبه شن نوشته می شوند، خروجی ها فقط برای خواندن به عقب نصب می شوند.

5. **Plan-execute-verify loop.** `plan`بچه ها رو پیشنهاد می کنه`execute`جعبه شن رو اجرا مي کنه، دفترچه ها و مقايسه ها رو ضبط مي کنه.`verify`بررسی واحد بر روی متریک انجام می دهد (آیا از دست دادن کاهش یافته است؟ آیا آبلاسیون اثر را جدا کرده است؟) گره های شکست خورده دلیل شکست را در درخت ذخیره می کنند.

6. **Writer.**پس از بودجه، بهترین شاخه را انتخاب کنید. اعداد را با matplotlib ارائه دهید. یک مسودۀ لاتکس را از طریق کلاود آپوس 4.7 با ردیابی شاخه در زمینه ایجاد کنید. مرتب کنید. PDF را به Opus 4.7 برای انتقاد برگردانید. تکرار کنید.

7. **Reviewer ensemble.**پنج قاضی با استفاده از Rubrics سبک NeurIPS (نوی، سخت، شفاف، قابل بازیافت، تاثیر) در مسودات را نمره می دهند. اگر متوسط <4.0/5 باشد، به نویسنده با انتقاد برگردید. پس از 3 بار دوباره نوشتن، توقف سخت.

8. **Red team.**ساخت یا ادغام مجموعه ای از وظایف خصومت آمیز که به سمت جعبه شن است: بمب های شکنی، تلاش های تخلیه شبکه، فرار از سیستم فایل ها، متاکراکترهای پوسته ی LLM نوشته شده. تایید کنید که همه مسدود شده اند. یافته ها را بنویسید.

9. **Reproducibility.**هر کاغذ با ردیابی درختان جستجو JSON، دانه ها، لینک های W&B اجرا، پیکربندی جعبه های شن و ریدمی که آن را از پایان به آخر تولید می کند، می فرستد.

## ازش استفاده کن

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## -باده

`outputs/skill-ai-scientist.md`با توجه به ایده بیج + دامنه + بودجه 30 دلار، این خط را به طور کامل اجرا می کند و یک مقاله قابل بررسی و یک بسته قابل بازیافت را منتشر می کند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## تمرینات

1. با سه ایده مختلف تخم در یک حوزه، مقایسه کنید که کدام قسمت از درختان با هم تعویض شده اند، محاسبه ی ضایع شده دوگانه را شناسایی کنید.

2. قبل از اجرای آزمایش برای گرهایی که بیش از ۵ دلار تخمین زده می شوند، یک دروازه انسانی در حلقه را اضافه کنید. اندازه گیری کنید که کل هزینه ها چقدر کاهش می یابد.

3. .مجموعه بازرس ها رو به جاي يک قاضي عوض کنين . نرخ قبول اشتباه رو بر روي مجموعه ي نامعلوم و بد روزنامه ها اندازه بگيري

4. تست گروه قرمز از تخلیه شبکه را معرفی کنید: مامور کد را می نویسد که سعی می کند`curl`آدرس خارجي.`--network=none`قانون مسدودش ميکنه.

5. جستجوی درخت خود را با یک خط پایه تصادفی صاف (مثل بودجه، بدون استراتژی گسترش) مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## خواندن بیشتر

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) آژانس تحقیقاتی تولید مرجع
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) روش اصلی
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) گسترش تکامل
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) چارچوب آزمایشگاه های تحقیقاتی چند نقش
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) لایه ورق بندی مرجع
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) جستجو در ادبیات
- [E2B sandboxes](https://e2b.dev) انزوا آزمایش مرجع
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) این موضوع که گروه بررسی کننده آن را کدگذاری می کند
