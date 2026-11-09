# Capstone 14  سرور تعبیرات تخفیف

> رمزگذاری حدس زده شده  یک طرح ارزان پیشنهاد توکن ها، مدل هدف آنها را در یک گذر تایید می کند  اکنون یک بهینه سازی آماده تولید است، نه یک ترفند تحقیقاتی. Eagle-3 در vLLM 0.7 کشتی 2.5-3x تولید در ترافیک واقعی. P-EAGLE (AWS 2026) حدس های موازی را حتی بیشتر تر کرد. SpecForge SGLang به عنوان سرپرست های حرفه ای آموزش داده است. مرکز اسپکلوترز Red Hat طرح های مرتب شده برای مدل های باز مشترک را منتشر کرد. TensorRT-LLM در NVIDIA اولین درجه کدگذاری را انجام داد. دسته تولید 2026 vLLM یا SGLang با طرح های خانواده EAGLE، FP8 یا INT4 کوانتاسیون و HPA در صف انتظار است. این سنگ پایانی دو مدل باز را با 2.5x+ تولید خط پایه با گزارش کامل تاخیر دم خدمت خواهد کرد.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## مشکل

رمزنگاری های حدس زده در سال 2026 به یک کالای اولیه تبدیل شدند. EAGLE-3 سرپرست های مسودات در حال حاضر در حالت پنهان مدل هدف آموزش می دهند و N توکن را پیش بینی می کنند؛ مدل هدف در یک گذرگاه تایید می شود. نرخ پذیرش 60-80 درصد به 2-3 برابر تولید انتهای تا انتهای تبدیل می شود. vLLM 0.7 این را به طور بومی ادغام می کند. SGLang + SpecForge به شما آموزش را می دهد. اسپکلوترهای Red Hat طرح های هماهنگ برای Llama 3.3 70B، Qwen3-Coder-30B MoE، GPT-OSS-120B را منتشر می کنند.

این کشتی در عملیات خدمت است، نه مدل. نرخ پذیرش با توزیع ترافیک (ShareGPT vs code vs domain data) تغییر می کند. تاخیر دم در حالت رد بدتر از بدون حدس است.  شما باید p99 را در اندازه های دسته های متعدد گزارش کنید، نه فقط توکن های حالت ثابت / ثانیه. هزینه هر 1M توکن در مقابل آنترپیک / OpenAI API کالا اعتبار است.

## مفهوم

رمزنگاري پيش بيني دو لایه دارد.**draft**مدل (سرگرامی، ngram، یا مدل کوچکتر با هدف هماهنگ) k کاندیدای توکن در هر مرحله را پیشنهاد می کند.**target**مدل تمام k را در یک گذر تایید می کند؛ هر پیش فرض پذیرفته شده مسیر طمع را جایگزین می کند. نرخ پذیرش بستگی به خط بندی طرح-هدف و توزیع ورودی دارد.

EAGLE-3 در اکثر ترافیک پیش نویس ngram را از دست می دهد. P-EAGLE برای درختان پیش نویس عمیق تر مشکوک سازی موازی انجام می دهد. معامله: تاخیر P99 در رد بیشتر است زیرا گذر تایید بزرگتر است. پیکربندی سرویس باید تاخیر بسته به اندازه دسته را گزارش کند تا این موضوع را نشان دهد.

استفاده از Kubernetes. vLLM 0.7 یک نسخه را در هر GPU یا شارت تنزور متوازد اجرا می کند. HPA خود مقیاس در قطار انتظار به جای CPU. FP8 (Marlin) و INT4 (AWQ) کوانت حافظه GPU را در داخل یک پاکت H100 / H200 نگه می دارد. گزارش پایان به پایان است، میزان پذیرش، p50 / p99 در دسته 1/8/32 و $ / 1M توکن.

## معماری

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## دسته

- خدمت: vLLM 0.7 یا SGLang 0.4
- روش های حدس زدنی: EAGLE-3 سرای طرح، حدس زدنی موازی P-EAGLE، ngram fallback
- آموزش طرح: SpecForge (SGLang) یا Red Hat Speculators
- مدل های هدف: Llama 3.3 70B، Qwen3-Coder-30B MoE، GPT-OSS-120B
- اندازه گیری: FP8 (مارلین) ، INT4 AWQ
- انتشار: Kubernetes + افزونه دستگاه NVIDIA؛ HPA در متریک انتظار صف
- Eval: ShareGPT، MT-Bench-v2، GSM8K، HumanEval برای اندازه گیری پذیرش دامنه
- مرجع: رمزگذاری تندروی TensorRT-LLM برای یک خط پایه فروشنده

```figure
cf-spec-decode
```

## آن را بسازید

1. **Target model prep.**Llama 3.3 70B را انتخاب کنید. از طریق Marlin به FP8 مقدار دهید. تحت vLLM 0.7 در 1xH100 (یا 2x تنسور متواز) استفاده کنید.

2. **Draft source.**یک سر draft EAGLE-3 را از Red Hat Speculators (یا آموزش یک از طریق SpecForge) بکشید. به پیکربندی کدگذاری spekulative vLLM بارگذاری کنید.

3. **Baseline numbers.**قبل از حدس زدن: توکن ها در دسته 1/8/32، تاخیر 50/99، استفاده از GPU. منتشر کنید.

4. **Enable EAGLE-3.**تنظیمات باز، بازمرداد همان معیار را تکرار کنید. گزارش سرعت، نرخ پذیرش، p99 دم تاخیر دلتا.

5. **P-EAGLE.**امکان حدس زدن موازی را فراهم کنید. اندازه گیری درخت عمیق تر در مقابل سیریل ایگل 3 را. گزارش کند که پی ایگل در کجا کمک می کند در مقابل آسیب می رساند.

6. **Domain traffic.**ShareGPT vs HumanEval vs ترافیک خاص دامنه را از طریق همان سرور اجرا کنید. نرخ پذیرش هر توزیع را اندازه گیری کنید. زمانی که مسودات حرکت می کنند را شناسایی کنید.

7. **Second target model.**همون خط لوله رو در Qwen3-Coder-30B MoE اجرا کن مسودات پیچیده تر است گزارش

8. **K8s HPA.**در زیر K8s با HPA ردیابی `queue_wait_ms`. وقتي بار سه برابر بشه اندازه اش رو نشان بده

9. **Cost comparison.**توکن های 1 میلیون دلاری رو با کلود سونت 4.7 و OpenAI GPT-5.4 در همان ارزیابی محاسبه کن

## ازش استفاده کن

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## -باده

`outputs/skill-inference-server.md`یک مقدار اندازه گیری شده با رمزگذاری حدس زدنی، یک گزارش کامل معیار و یک K8s انتشار.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## تمرینات

1. کاهش میزان پذیرش را اندازه گیری کنید وقتی که طرح یک نسخه از هدف عقب مانده است (به عنوان مثال، Llama 3.3 -> 3.4 drift).

2. پیاده سازی ngram-fallback: اگر پذیرش EAGLE-3 زیر یک حد کاهش یابد، به طرح ngram تغییر دهید. گزارش بهبود قابلیت اطمینان.

3. یک آزمایش کنترل شده MoE اجرا کنید: همان Qwen3-Coder-30B با صداهای راهبری تزریق شده در مقابل خارج از. حساسیت پذیرش مسود را اندازه گیری کنید.

4. به H200 (141 GB) گسترش دهید. گزارش حجم مدل در هر نسخه حاصل شده و اینکه آیا می توانید یک Llama 3.3 70B بدون مقدار را خدمت کنید.

5. بنچمارک TensorRT-LLM تخميني در همان سخت افزار H100 گزارش اينكه برنده شده با vLLM

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## خواندن بیشتر

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) دسته خدمت مرجع
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) کاغذ رمزگذاری متوازی + ادغام
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) خط آموزش پیش نویس
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) مرکز خط مشروع
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) جایگزین فروشنده
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) مرجع تجاری
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) کاغذ روش
- [vLLM repository](https://github.com/vllm-project/vllm) کد و معیار
