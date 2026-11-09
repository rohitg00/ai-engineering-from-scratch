# متریکهای تعبیر  TTFT، TPOT، ITL، Goodput، P99

> پنج متریک تعیین می کند که آیا یک انتشار نتیجه گیری کار می کند. TTFT پیش از پر کردن و اضافه کردن صف و اضافه کردن شبکه است. TPOT (معمولا به عنوان ITL گزارش می شود، اگرچه ابزارهای در مورد اینکه آیا ITL اولین توکن را می شمرد اختلاف نظر دارند) هزینه رمزگذاری مربوط به حافظه در هر توکن است. تاخیر پایان به پایان TTFT به اضافه TPOT ضرب طول خروجی است. درآمدی توکن ها در ثانیه در سراسر ناوگان جمع آوری شده است. اما چیزی که برای محصول مهم است، خوب بودن است. تولید بالا با تولید خوب پایین به این معنی است که شما توکن هایی را پردازش می کنید که هرگز به وقت کاربران نمی رسند. شماره مرجع برای Llama-3.1-8B-Instruct در TRT-LLM در سال 2026: متوسط TTFT 162 ms، متوسط TPOT 7.33 ms، متوسط E2E 1,093 ms. هميشه گزارش بده P50، P90، P99  هرگز فقط به معنی نباشه و به تله اندازه گیری توجه کنید: GenAI-Perf TTFT را از محاسبه ITL حذف می کند، LLMPerf آن را شامل می کند؛ دو ابزار در مورد TPOT برای یک اجرا متفق نیستند.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## اهداف یادگیری

- TTFT، TPOT، ITL، E2E، تولید و goodput را به طور دقیق تعریف کنید و هر یک از اجزای اندازه گیری را نام دهید.
- توضیح دهید که چرا متوسط آمار برای ارائه LLM اشتباه است و چگونه P50/P90/P99 را بخوانید.
- ساخت یک SLO چند محدودیت (به عنوان مثال TTFT<500 ms و TPOT<15 ms و E2E<2 s) و محاسبه خوبput با آن.
- دو ابزار مرجع را که در مورد TPOT برای یک دوره مخالفند، نام ببرید و دلیل آن را توضیح دهید.

## مشکل

"توانایی ما ۱۵۰۰۰ توکن در ثانیه است". پس چه؟ اگر ۴۰ درصد از درخواست ها بیش از ۲ ثانیه از پایان به پایان فرا رسد، کاربران جلسه را ترک می کنند. تنها توانایی به شما نمی گوید که آیا محصول کار می کند یا خیر.

انفرنس دارای محورهای متعدد تاخیر است و هر یک از آنها به طور متفاوتی شکست می خورند. پر کردن قبل از زمان حساب و اندازه گیری با طول سریع است. رمزگشایی به حافظه محدود شده و مقیاس با اندازه دسته بندی شده. تاخير قطار مشکل عملياتي است. شبکه مشکل فاصله فیزیکی است. شما برای هر یک از آنها معیار های متفاوتی نیاز دارید، و شما به پرسنسیل ها نیاز دارید، و شما به یک ترکیب واحد نیاز دارید که می گوید " آیا کاربر آنچه را که انتظار داشت، بدست آورد"

## مفهوم

### TTFT  زمان برای اولین توکن

`TTFT = queue_time + network_request + prefill_time`

پیش پر کردن زمانی غالب است که پیام های درخواست طولانی هستند. در Llama-3.3-70B FP8 در H100، یک پیام 32k حدود 800 ms از پیش پر کردن خالص را می گیرد. زمان صف رفتار برنامه نویس در زیر بار است. درخواست شبکه زمان سیم است که شامل TLS است. TTFT تاخیر است که کاربر قبل از هر چیزی جریان می یابد.

### TPOT / ITL  تاخیر بین توکن ها

اسم های زیادی برای یک مقدار.`TPOT`(زمان هر توکن خروجی)`ITL`(توانایی بین توکن ها)`decode latency per token` همه یکسان است. این زمان بین توکن های جریان شده متوالی پس از اولین است.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

در همان دسته Llama-3.3-70B H100 با پر کردن مقدم، TPOT به طور متوسط ~ 7 ms بدون پر کردن مقدم، در طول پر کردن مقدم در یک ردیف همسایه، TPOT می تواند به 50 ms افزایش یابد.

### تاخیر E2E

`E2E = TTFT + TPOT * output_tokens + network_response`

برای خروجی های طولانی (>500 توکن) ، E2E تحت تسلط TPOT است. برای خروجی های کوتاه با پیام های طولانی، E2E تحت تسلط TTFT است. گزارش E2E با حالت خروجی طول.

### درایو

`throughput = total_output_tokens / elapsed_time`

اندازه گیری جمع شده، به شما میزان بهره وری ناوگان می گوید نه سلامت درخواست فردی

### خوب بودن  متریک که واقعا به شما اهمیت می دهد

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO یک محدودیت چندگانه است. یک درخواست فقط اگر هر محدودیت را رعایت کنید "خوب" است. Goodput سهم است. برخی از کاغذ ها و داشبورد ها به عنوان نرخ خوب را گزارش می کنند: درخواست ها در ثانیه که به هر SLO پاسخ می دهند. سهم را با نرخ درخواست برای تبدیل ضرب کنید. تولید بالا در 60٪ goodput شکست است. تولید پایین در 99٪ goodput هدف است.

در سال 2026، goodput متریک مورد استفاده در ارسال MLPerf Inference v6.0 و در ردیابی داخلی SLA در ارائه دهندگان پلتفرم AI است.

### چرا آمار اشتباه است

توزیع تاخیر LLM به سمت راست منحنی است. یک دسته کد با یک همسایه طولانی می تواند 500 توکن با TPOT ~ 7 ms و 20 توکن با TPOT ~ 60 ms ارسال کند. متوسط TPOT 9 ms است. P99 TPOT 65 ms است. کاربران به طور منظم به P99 می رسند  به همین دلیل آنها می روند.

همیشه سه برابر را گزارش کنید (P50، P90، P99). برای تجربه کاربر، P99 آن چیزی است که شما بهینه سازی می کنید.

### شماره مرجع  Llama-3.1-8B-Instruct on TRT-LLM، 2026

- متوسط TTFT: 162 ms
- متوسط TPOT: 7.33 ms
- متوسط E2E: 1,093 ms
- P99 TPOT: بسته به پیکربندی پر کردن قطعات، 10 تا 25 ms متفاوت است.

این ها نقاط مرجع NVIDIA منتشر شده هستند. آنها با اندازه مدل (70B 3-5x نشان می دهد) ، سخت افزار (H100 در مقابل B200 ~ 3x) و بار تغییر می کنند.

### دام اندازه گیری

دو مورد از ابزارهای مرجع 2026 مورد استفاده بیشتر در مورد TPOT برای همان اجرا با هم موافق نیستند:

- **NVIDIA GenAI-Perf**: TTFT را از محاسبه ITL خارج می کند. ITL از توکن 2 شروع می شود.
- **LLMPerf**: شامل TTFT می شود. ITL از توکن 1 شروع می شود.

برای یک درخواست با TTFT 500 ms و 100 توکن خروجی در 700 ms کل کد گذاری، GenAI-Perf گزارش `ITL = 700/99 = 7.07 ms`، گزارشات LLMPerf`ITL = 1200/100 = 12.00 ms`انتخاب ابزار شماره رو عوض ميکنه

هميشه مشخص کنين ابزارها چي هستن و هميشه تعريف رو منتشر کن

### ساخت یک SLO

یک SLO منطقی برای یک مدل چت 70B در سال 2026:

- TTFT P99 <= 800 ms
- TPOT P99 <= 25 ms
- E2E P99 <= 3 ثانیه برای <300 توکن
- هدف تولید خوب >= 99٪

SLO های شرکت TTFT (200-400 ms) را محکم می کنند و E2E را آزاد می کنند. نکته این است که آنها را یادداشت کنید، سه را اندازه گیری کنید و به عنوان یک ترکیب خوب پیگیری کنید.

### چگونه اندازه گیری کنیم

- ترافیک واقعی یا مصنوعی واقعی (LLMPerf با `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`)
- هدف 2x هم زمان حداکثر برای اجرای معیار.
- 30-50 تکرار انجام دهید، درصد نمونه ی ترکیب را بگیرید.
- با نام ابزار، نسخه ابزار، مدل، سخت افزار، همزمان، توزیع فوری منتشر کنید.

```figure
throughput-latency
```

## ازش استفاده کن

`code/main.py`یک ماشین حساب خوب بازی است. توزیع تاخیر مصنوعی تولید کنید، SLO را اعمال کنید و خوب تولید را محاسبه کنید. همچنین تفاوت GenAI-Perf vs LLMPerf TPOT را در همان ردیف نشان می دهد.

.[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)دستگاه نشان می دهد که زمان هر توکن خروجی در NVIDIA L4 از کجا می آید. یک مرحله رمزگذاری 16.41 جی بی وزن را می خواند، که حداقل 54.7ms در 300 جی بی / ثانیه است و مرحله اندازه گیری 60.16ms است.

## -باده

این درس به ما کمک می کند`outputs/skill-slo-goodput-gate.md`. با توجه به یک بار کاری و SLO، این محصول یک نسخه معیاری CI / CD آماده را تولید می کند که دروازه ها را به جای تولید خوب در حال استفاده قرار می دهد.

## تمرینات

1. فرار کن`code/main.py`.توزيعي با 1 درصد ذير بالا رو پيدا کنيد. وقتي که P99 TPOT را از 30 ms به 15 ms تنگ کنيد چطوري گودپوت عوض ميشه؟
2. يه فروشنده ميگه "15000 توک/س" در Llama 3.3 70B H100.
3. چرا پر کردن مقدماتی از P99 TPOT محافظت می کند اما TPOT را نمی کند؟
4. ساخت یک SLO مصرف کننده برای یک دستیار صوتی (اولین توکن شنیده می شود، نه خوانده می شود). کدام متریک برای کاربر قابل مشاهده تر است؟
5. سند های LLMPerf README و GenAI-Perf را بخوانید. سه متریک دیگر را که ابزارها با آنها مخالفند شناسایی کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## خواندن بیشتر

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) تعریف کاینونیک TTFT، ITL، TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) تعاریف جایگزین و دستور اندازه گیری
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) اندازه گیری های کاربردی در مورد استفاده های واقعی.
- [LLMPerf](https://github.com/ray-project/llmperf) شاخص Open Source مبتنی بر رایه
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) ابزار معیار NVIDIA
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) شاخص مرجعی مبتنی بر تولید خوب که توسط صنعت پذیرفته شده است.
