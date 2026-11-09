# انتخاب سرویس های میزبان خود  تطابق موتور با سخت افزار و مقیاس

> انتخاب موتور یک تابع سخت افزاری، مقیاس و اکوسیستم است  نه یک خواندن صفحه رتبه بندی. چهار موتور در سال 2026 بر نتیجه گیری خود میزبان تسلط دارند: llama.cpp، Ollama، vLLM، SGLang، با TGI در حالت نگهداری عقب مانده است. **llama.cpp**سریع ترین در CPU  گسترده ترین پشتیبانی از مدل، کنترل کامل بر کوانتاسیون و threading. **Ollama**این نصب یک فرمان dev-laptop است، ~15-30% کندتر از llama.cpp (هزینه های سریال سازی Go + CGo + HTTP) ، شکاف تولید 3x تحت بار مانند prod. **TGI entered maintenance mode December 11, 2025** فقط اشکال اصلاح می شود، ~ 10% تولید خام کندتر از vLLM اما از لحاظ تاریخی قابل مشاهده و ادغام اکوسیستم HF بالا است. این وضعیت نگهداری آن را یک شرط بلند مدت خطرناک می کند  SGLang یا vLLM برای پروژه های جدید امن تر هستند. **vLLM**این استاندارد تولید عمومی است  v0.15.1 (فبروری 2026) اضافه می کند PyTorch 2.10, RTX Blackwell SM120, H200 بهینه سازی. **SGLang**این شرکت متخصص چند پیچ / پیش فرض سنگین  400،000+ GPU در تولید (xAI، LinkedIn، Cursor، Oracle، GCP، Azure، AWS) است. محدودیت های سخت افزاری: CPU-first → llama.cpp AMD / non-NVIDIA → vLLM قوی ترین مسیر پشتیبانی شده است (TRT-LLM با NVIDIA قفل شده است). مدل خط لوله ۲۰۲۶: dev = ollama، stageing = llama.cpp، prod = vLLM یا SGLang. موتورها اشکال وزن متفاوتی را دارند  GGUF برای خانواده llama.cpp، HF safetensors برای موتورهای GPU  بنابراین یک شکل تبدیل می تواند بین مراحل قرار گیرد.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## اهداف یادگیری

- موتور را انتخاب کنید که به شما سخت افزار داده شده باشد (CPU / AMD / NVIDIA Hopper / Blackwell), مقیاس (1 کاربر / 100 / 10,000) و بار کاری (چات عمومی / عامل / زمینه طولانی).
- وضعیت حالت نگهداری TGI 2026 (11 دسامبر 2025) و اینکه چرا پروژه های جدید را به سمت vLLM یا SGLang تغییر می دهد را نام ببرید.
- خط تولید/تحویل/تولید را توصیف کنید، از جمله جایی که یک تغییر شکل GGUF به سیفیتنسور بین مراحل قرار دارد.
- توضیح دهید که چرا "CPU-first" به llama.cpp اشاره می کند و "AMD" TRT-LLM را از بین می برد.

## مشکل

تیم شما یک پروژه جدید LLM خود میزبان را آغاز می کند. یک مهندس می گوید اولما، دیگری می گوید vLLM، سوم می گوید "آیا TGI فقط از جعبه خارج نمی شود؟" هر سه برای زمینه های مختلف مناسب هستند. هیچ یک برای همه مناسب نیست.

در سال 2026 درخت انتخاب مهم است: سخت افزار اول، مقیاس دوم، بار کاری سوم. و یک رویداد خاص 2025  TGI وارد حالت نگهداری در 11 دسامبر  تغییر پیش فرض برای پروژه های جدید.

## مفهوم

### پنج موتور

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### تصمیم گیری در مورد سخت افزار اول

**CPU-first**اولاما هم کار می کند اما کند تر است. هیچ موتور دیگری در CPU رقابت نمی کند.

**AMD GPU**→ vLLM قوی ترین مسیر پشتیبانی شده است (عملیات ROCm AMD). SGLang نیز کار می کند. TRT-LLM با NVIDIA قفل شده است، بنابراین خاموش شده است.

**NVIDIA Hopper (H100 / H200)**→ vLLM یا SGLang یا TRT-LLM. همه سه درجه بالا.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM رهبر تولید است (فاز 17 · 07). vLLM و SGLang به نزدیک دنبال می شوند.

**Apple Silicon (M-series)**اولاما اینو بسته می کنه

### تصمیم در مقیاس دوم

**1 user / local dev**اولاما، يک فرمان، اولين علامت در چند ثانیه

**10-100 users / small team**→ vLLM واحد GPU

**100-10k users / production**→ vLLM تولید-پایه (فاز 17 · 18) یا SGLang.

**10k+ users / enterprise**→ vLLM تولید-پایه + تجزیه شده (فاز 17 · 17) + LMCache (فاز 17 · 18).

### تصمیم سوم بار کاری

**General chat / Q&A**→ vLLM در موارد گسترده برنده می شود.

**Agentic multi-turn (tools, planning, memory)**→ توجه رادیکس SGLang (فاز 17 · 06) غالب است.

**RAG with heavy prefix reuse**→ SGLang

**Code generation**→ vLLM خوب است؛ SGLang کمی بهتر در حافظه کش.

**Long context (128K+)**→ vLLM + پر کردن مقدمۀ قطعه ای؛ SGLang + KV طبقه ای.

### تله نگهداری TGI

Hugging Face TGI وارد حالت نگهداری شد 11 دسامبر 2025  فقط اصلاحات خطاهای در آینده. از نظر تاریخی: مشاهده ای سطح بالا، بهترین در کلاس HF-یکوسیستم ادغام (مودل کارت ها، ابزار ایمنی) ، کمی عقب از vLLM در تولید خام.

برای پروژه های جدید در سال 2026: پیش فرض از TGI دور است. انتشار TGI موجود می تواند ادامه یابد اما باید در نهایت مهاجرت کند. SGLang و vLLM پیش فرض های امن تر هستند.

### الگوی خط لوله

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). موتورها اشکال وزن متفاوتی را در نظر می گیرند. GGUF برای خانواده llama.cpp، HF safetensors برای موتورهای GPU  بنابراین یک تبدیل فرمت می تواند بین مراحل قرار گیرد. مهندسان به سرعت در لپ تاپ ها تکرار می کنند. آینه های مرحله ای کوانتاسیون تولید را انجام می دهند. prod هدف خدمت است.

### هشدار اولاما

اولاما برای توسعه عالی است. برای تولید مشترک عالی نیست: سریالیزاسیون HTTP Go اضافه هزینه های اضافی می کند، مدیریت موازی ساده تر از vLLM است، پشتیبانی از OpenTelemetry تاخیر دارد. از اولاما استفاده کنید که در آن یک کاربر ، یک فرمان و به vLLM برای اشتراک گذاری روشن می شود.

### خود میزبانی در مقابل مدیریت یک تصمیم جداگانه است

مرحله 17 · 01 (هایپر اسکالرها مدیریت شده) · 02 (پلتفرم های تعبیر) پوشش مدیریت شده است. این درس فرض می کند که شما قبلا تصمیم به خود میزبان. دلایل خود میزبان: اقامت داده ها، تنظیم دقیق سفارشی، مالکیت هزینه کل در مقیاس، مدل دامنه در میزبان موجود نیست.

### شماره هایی که باید به یاد داشته باشی

- حالت نگهداری TGI: 11 دسامبر 2025.
- vLLM v0.15.1: فوریه 2026؛ PyTorch 2.10؛ پشتیبانی از Blackwell SM120.
- اثر تولید SGLang: 400،000+ GPU
- فاصله تولید اولاما در مقابل llama.cpp: 15-30% کندتر؛ 3x تحت بار افزونه.

```figure
data-parallel
```

## ازش استفاده کن

`code/main.py`یک راهرو در درخت تصمیم گیری است: با توجه به سخت افزار + مقیاس + بار کاری، موتور را انتخاب می کند و دلیل آن را توضیح می دهد.

## -باده

این درس به ما کمک می کند`outputs/skill-engine-picker.md`با توجه به محدودیت ها، موتور را انتخاب می کند و نقشه مهاجرت را می نویسد.

## تمرینات

1. فرار کن`code/main.py`با سخت افزار / مقیاس / بار کار شما. آیا محصول با شهود شما مطابقت دارد؟
2. انفرا تو 12 تا H100 و 8 تا MI300X AMD هست
3. یک تیم می خواهد از TGI در سال 2026 استفاده کند چون "این چیزی است که ما می دانیم".
4. اولاما Dev به vLLM prod: چه تغییرات در کوانتایی، پیکربندی و مشاهده ای وجود دارد؟
5. محصول RAG با طول پیش فرض P99 8K و استفاده مجدد بالا در میان مستاجران. یک موتور را انتخاب کنید و آن را با مرحله 17 · 11 + 18 جمع کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## خواندن بیشتر

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) یادداشت های آزاد
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
