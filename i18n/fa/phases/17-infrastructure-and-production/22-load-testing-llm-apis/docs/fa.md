# آزمایش بار LLM API  چرا k6 و سوسک دروغ می گویند

> تسترهای بارگذاری سنتی برای پاسخ های جریان، طول خروجی متغیر، متریک های سطح توکن یا شتاب GPU طراحی نشده اند. دو تله به اکثر تیم ها می خورد. تله GIL: اندازه گیری سطح توکن Locust توکن سازی را تحت GIL پایتون اجرا می کند که با تولید درخواست در مواقعی سنگین رقابت می کند. پس از توکن سازی پس از آن تاخیر بین توکن گزارش شده را افزایش می دهد. تله یکسانی سریع: تله های یکسان در یک حلقه یک نقطه در توزیع توکن را آزمایش می کنند؛ ترافیک واقعی دارای طول متغیر و مطابقت های مختلف پیشگویی است. LLMPerf اين مسئله رو با`--mean-input-tokens`+ `--stddev-input-tokens`نقشه برداری ابزار در سال 2026: تخصصی LLM (GenAI-Perf، LLMPerf، LLM-Locust، guidellm) برای دقت سطح توکن**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)** جریان آگاه، Kubernetes بومی از طریق CRDs TestRun / PrivateLoadZone توزیع شده، بهترین برای دروازه های CI / CD؛ Vegeta for Go پرتاب نرخ ثابت؛ Locust 2.43.3 فقط با گسترش LLM-Locust برای جریان. الگوهای بار: حالت ثابت، رمپ، اوج (تست اتوماتیک) ، خیس (سرخ حافظه).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## اهداف یادگیری

- دو الگوی ضد (فنگ GIL، فنگ prompt-uniformity) را که باعث می شود آزمایش کنندگان بار عمومی برای API LLM دروغ بگویند، توضیح دهید.
- یک ابزار برای یک هدف مشخص را انتخاب کنید: LLMPerf (مطابق اجرا), k6 + گسترش جریان (گات CI), guidellm (متعدد مصنوعی در مقیاس بزرگ), GenAI-Perf (توصیه NVIDIA).
- چهار الگوی بار (مستقیم، رامپ، نوک، خیس) را طراحی کنید و حالت شکست هر یک را نام ببرید.
- یک توزیع فوری واقع بینانه با استفاده از میانگین + stddev از توکن های ورودی به جای طول ثابت ایجاد کنید.

## مشکل

تو در حالي که تو در حال توليد با 200 کاربر واقعي بود، سرویس به سطح P99 TTFT منفجر شد، GPU ها به هم متصل شدند

دو چیز اتفاق افتاد. اول، k6 500 پیام مشابهی را ارسال کرد.  جمع آوری درخواست و پیشگویی شما باعث شد به نظر برسد که شما 500 کد همزمان را در حال انجام دادن هستید. دوم، k6 تاخیر بین توکن ها را در پاسخ های جریان به همان شیوه ای که چشم تجربه می کند، ردیابی نمی کند؛ یک اتصال HTTP را می بیند، نه 500 توکن که در فواصل مختلف می آیند.

تست بار برای LLM رشته خودش است.

## مفهوم

### تله GIL (لوکست)

Locust از پایتون استفاده می کند و توکن سازی را در کنار مشتری تحت GIL اجرا می کند. در زیر مواقعی بالا، توکن های پشت تولید درخواست. تاخیر بین توکن گزارش شده شامل پس انداز توکن سازی در کنار مشتری است. شما فکر می کنید سرور کند است؛ این تست است.

درست: گسترش LLM-Locust توکن سازی را به فرآیندهای جداگانه منتقل می کند، یا از یک خط زبان ترکیب شده (k6, LLMPerf با استفاده از tokenizers.rs) استفاده می کند.

### تله ی یکسانی سریع

همه تسترهای بار شناخته شده به شما اجازه می دهند یک پرامپت را پیکربندی کنید. در یک آزمایش حلقه ای از 10،000 تکرار هر بار همان پرامپت را ارسال می کند. سرور هر بار که  پرفکس حافظه پیش فرض به 100٪ نزدیک می شود، همان پیش فرض را می بیند.

درست کردن: نمونه از یک توزیع سریع.`--mean-input-tokens 500 --stddev-input-tokens 150` طول و محتوای متنوع

### چهار الگوی بار

1. **Steady-state** RPS ثابت برای ۳۰ تا ۶۰ دقیقه.
2. **Ramp** افزایش خطی RPS از 0 به هدف بیش از 15 دقیقه.
3. **Spike** ناگهان 3-10x RPS برای 2 دقیقه پس از آن عقب. گرفت: تاخیر اتوماتیک مقیاس، شتاب صف، اثر شروع سرد.
4. **Soak** حالت ثابت برای 4-8 ساعت. گرفتگی: لیک حافظه، حرکت در حوضه اتصال، overflow قابل مشاهده.

### نقشه برداری ابزار 2026

**LLMPerf**(Anyscale)  پایتون اما توکن سازی پشتیبانی شده توسط Rust. پیام های متوسط / stddev. جریان آگاهانه. بهترین پیش فرض برای اجرای عملکرد.

**NVIDIA GenAI-Perf** مرجع NVIDIA. از Triton استفاده می کند. پوشش متریک جامع. توجه داشته باشید ITL TTFT را خارج می کند؛ LLMPerf آن را شامل می کند. دو ابزار TPOT مختلف را برای یک سرور تولید می کنند.

**LLM-Locust**(درسته)  افزونه سوسک که فتن GIL را درست می کند.

**guidellm** مقایسه ی مصنوعی در مقیاس بزرگ

**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)**:
- k6 خود (Go، جمع آوری شده، بدون GIL) متریک های آگاه از جریان را اضافه کرد.
- k6 اپراتور از CRD های TestRun / PrivateLoadZone برای تست های توزیع شده بومی Kubernetes استفاده می کند.
- بهترین برای گات های CI/CD و تست SLA

**Vegeta** Go، ساده تر از k6. نرخ ثابت پر شدن HTTP. نه LLM آگاه اما برای آزمون دروازه / محدودیت نرخ خوب است.

**Locust 2.43.3 stock** دارای فتن GIL برای LLM. فقط با LLM-Locust تمدید.

### دروازه SLA در CI

در مورد روابط عمومی با:

- هر یک از 30 تا 50 تکرار در RPS خط اصلی.
- دروازه: P50/P95 TTFT، 5xx < 5٪، TPOT زیر حد.
- . بر اساس شکستن راه حل رو خراب کن

### توزیع سریع واقعی

از نمونه های ترافیک واقعی (اگر شما آنها را دارید) یا از توزیع های منتشر شده (به عنوان مثال، ShareGPT به دنبال برای چت، HumanEval برای کد) بسازید. متوسط + stddev را به LLMPerf ارسال کنید. از هر هزینه ای اجتناب کنید.

### شماره هایی که باید به یاد داشته باشی

- k6 عامل 1.0 GA: سپتامبر 2025.
- k6 v2026.1.0: سنجش های آگاه از جریان.
- اجرا معمول LLMPerf: 100 تا 1000 درخواست در همزمان X.
- دروازه CI معمولی: 30-50 تکرار در هر PR.
- چهار الگوی: ثابت، رامپ، نوک، خیس

```figure
load-pattern-waves
```

## ازش استفاده کن

`code/main.py`یک آزمایش بار را با توزیع سریع واقعی شبیه سازی می کند، TPOT موثر را اندازه گیری می کند و تله سریع یکسانی را نشان می دهد.

## -باده

این درس به ما کمک می کند`outputs/skill-load-test-plan.md`با توجه به بار کاری و SLA، ابزار را انتخاب می کند و چهار الگوی بار را طراحی می کند.

## تمرینات

1. فرار کن`code/main.py`.با تقسيم يکسان و واقعي مقایسه کنيد
2. اسکریپت k6 را برای یک دروازه CI بنویسید: TTFT P95 < 800 ms در 100 همزمان، زمان اجرا 5 دقیقه.
3. تست امواج شما نشان می دهد حافظه 50 میگابایت در ساعت رشد می کند. سه دلیل و ابزار برای انتخاب بین آنها را نام دهید.
4. آزمایش اسپیک از 10 RPS تا 100 RPS. زمان انتظار برای بهبود در صورت کارپنتر + vLLM (فاز 17 · 03 + 18) در محل است؟
5. GenAI-Perf TPOT=6ms را گزارش می دهد؛ LLMPerf TPOT=11ms را در همان سرور گزارش می دهد. توضیح دهید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## خواندن بیشتر

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
