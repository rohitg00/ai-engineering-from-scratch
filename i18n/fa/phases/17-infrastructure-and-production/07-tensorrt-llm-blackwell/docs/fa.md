# مجموعه ی انفرنس تخصصی سخت افزاری  FP8 و NVFP4 در بلیک ویل

> تراکم نتیجه گیری تخصصی سخت افزاری حمل و نقل را برای تولید تجارت می کند و TensorRT-LLM  فقط NVIDIA، تنظیم شده برای Blackwell  واضح ترین مثال از سود تجاری است. در GB200 NVL72 با ارتقای Dynamo، SemiAnalysis InferenceX اندازه گیری شد $0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0.09 / M در H100 + vLLM  یک شکاف اقتصادی 7x. این استیک دو فرمت نقطه شناور را با دو تکنیک خدمت ترکیب می کند: FP8 برای حافظه کش KV و هسته های توجه حیاتی است زیرا دارای محدوده پویایی است که آنها نیاز دارند؛ NVFP4 (4-bit microscaling) وزنه ها و فعال سازی ها را اداره می کند؛ پیش بینی چند توکن (MTP) و پیشکد / کد تجزیه شده اضافه کردن 2-3x دیگر در بالا. روز-0 مدل پشتیبانی بار FP4 وزن مستقیم بدون تبدیل پس از آموزش. ماهیگیری برای تیم های مهندسی 2026: TRT-LLM منبع باز است اما مخصوص NVIDIA  CUDA- و Blackwell تخصصی  بنابراین اتخاذ آن تجارت حمل و نقل برای تولید است. قبل از اينکه به اين کار دست بياري، از ميکس مدل ها و سخت افزار حساب کن

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## اهداف یادگیری

- توضیح دهید که چرا FP8 برای حافظه KV و توجه حتی زمانی که وزن در NVFP4 باشد، مهم است.
- بر اساس BF16، FP8 و NVFP4، اثر HBM یک مدل مرزی را محاسبه کنید و دلیل دهید که پس انداز از کجا می آید.
- ویژگی های خاص Blackwell را نام دهید TRT-LLM (روز-0 FP4 ، MTP ، سرویس تجزیه شده ، ابتدایی های همه).
- تصمیم بگیرید که قفل NVIDIA TRT-LLM چقدر ارزش 7 برابر تفاوت هزینه در مقابل vLLM در Hopper دارد.

## مشکل

مرز اقتصاد نتیجه گیری در سال 2026 "چقدر توکن در هر دلار" است. پاسخ به چهار گزینه بسته بستگی دارد: نسل سخت افزاری (Hopper H100/H200 در مقابل Blackwell B200/GB200) ، دقت (BF16 → FP8 → NVFP4), موتور خدمت (vLLM در برابر SGLang در برابر TRT-LLM) و ارتقایی (سطح در برابر تجزیه در برابر Dynamo).

در هاپر با vLLM، یک 120B MoE در ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$0.012  7x ارزان تر. برخی از این شکاف سخت افزاری است (بلاکویل 11-15x در هر GPU LLM در مقایسه با Hopper). برخی از آنها است: وزن FP4 ، مسود MTP ، prefill / decode تجزیه شده و NVLink 5 همه چیز برای ارتباطات متخصص MoE.

شما نمی توانید این را در خارج از NVIDIA تکرار کنید. این معامله است  حمل و نقل برای اقتصاد. درک اینکه کدام گزینه های دسته ای به کدام سهم از شکاف می دهند، نکته ی این درس است.

## مفهوم

### چرا FP8 هنوز کف KV کش است

یک اشتباه رایج در سال 2026: فرض کنید NVFP4 در همه جا اعمال می شود. این کار را نمی کند. KV cache به FP8 (8-bit floating point) نیاز دارد زیرا کلید های توجه و ارزش هایی را که طیف گسترده ای از پویایی را پوشش می دهد ذخیره می کند. کوانتزیز KV به FP4 باعث از دست دادن دقت فاجعه بار می شود.

NVFP4 (2025-2026) برای وزنه ها و فعال سازی ها اعمال می شود. میکروسکلینگ: هر بلوک وزنه ها دارای فاکتور مقیاس خود هستند بنابراین بلوک های کوچک می توانند دامنه های پویایی مختلف را بدون از دست دادن مقیاس پر تنسر طی کنند. برای فعال سازی ها، FP4 به دلیل فعال سازی در یک لایه دارای دامنه کوچک است، نگه می دارد.

روش معمول بلیک ویل:

- وزن: NVFP4 (4-bit میکروسکلینگ).
- فعال سازی: NVFP4.
- KV cache: FP8
- اکامولیتر توجه: FP32 (استقرار نرم حداکثر).

### ابتدایی های خاص بلیکویل TRT-LLM استفاده می کند

- **Day-0 FP4 weights**: ارائه دهندگان مدل وزن FP4 را مستقیما ارسال می کنند؛ بار TRT-LLM بدون تبدیل پس از آموزش. هیچ مرحله AWQ / GPTQ برای FP4 نیست.
- **Multi-token prediction (MTP)**: همان ایده ایگل (فاز 17 · 05) اما به ساخت TRT-LLM ادغام شده است.
- **Disaggregated serving**: پیش از پر کردن و رمزگذاری در مجموعه های GPU جداگانه، KV cache به NVLink یا InfiniBand منتقل شده است.
- **All-to-all communication primitives**NVLink 5 تاخیر ارتباطات متخصص MoE را با 3x در مقایسه با Hopper کاهش می دهد. هسته های MoE TRT-LLM برای این کار تنظیم شده اند.
- **NVFP4 + MXFP8 microscaling**: کنترل سریع ترازو در Blackwell Tensor Cores

### اعدادي که بايد ياد بگيري

- HGX B200 در توکن های 0.02 / M در GPT-OSS-120B از طریق TRT-LLM.
- GB200 NVL72 در توکن های $0.012/M از طریق Dynamo (ترکیتر TRT-LLM).
- H100 + vLLM ≈ $ 0.09 / M توکن ها در بار کار قابل مقایسه.
- افزایش 2.8 برابر تولید در سه ماه از بروزرسانی های TRT-LLM (2026).
- 11-15 برابر در هر GPU LLM تولید، بلکویل در مقابل هاپر.
- MLPerf Inference v6.0 (اپریل 2026): بلکویل بر هر کار ارسال شده تسلط دارد.

### هزینه های FP4 در کیفیت

NVFP4 تهاجمی است. در بار کار سنگین استدلال (سلسلۀ تفکر، ریاضیات، کد ژن با زمینه طولانی) ، وزن FP4 به طور قابل مشاهده کاهش می یابد. کالیبریشن هر بلوک کاهش می یابد اما از بین نمی برد. مدل های استدلال تیم اغلب از وزن FP8 + فعال سازی FP4 به عنوان یک سازش استفاده می کنند، یا به H200 با FP8 در سراسر می مانند.

قانون: همیشه کیفیت کار را در مجموعه ارزیابی خود تأیید کنید قبل از تعهد به وزن NVFP4.

### چرا اين يک تصميم اينترنتي اينترنتي است

TRT-LLM هسته های C++ + CUDA + منبع بسته است. مدل ها باید برای یک SKU GPU خاص مرتب شوند. هیچ AMD، هیچ Intel، هیچ ARM. اگر استراتژی زیربنایی شما چند فروشنده است، TRT-LLM یک غیر راه اندازی برای سطح TRT-LLM است. شما هنوز هم می توانید از vLLM در سخت افزار مخلوط خدمت کنید. اگر فقط NVIDIA هستید، فاصله 7x برای قفل پرداخت می کند.

### 2026 دستور کار عملی

برای یک لایحه تحلیلی سالانه 100 میلیون دلاری، اجرا در Hopper + vLLM 7-10 برابر روی میز باقی می گذارد. بار کاری غالب هزینه را به Blackwell + TRT-LLM + Dynamo مهاجرت کنید. برای سرعت تکرار مدل، سطح آزمایش را در H100 + vLLM نگه دارید. کیفیت را در هر مدل NVFP4 تبدیل شده قبل از تولید تأیید کنید.

### پاداش تجزیه

بخش تقسیم شده TRT-LLM (پول های جداگانه پر کردن و رمزگذاری) در مرحله 17 · 20 به طور عمیق پوشش داده شده است. در بلکویل، ضربات: وزن FP4 × سرعت MTP × قرار دادن تقسیم شده × مسیر آگاه از کیش. شماره 7x این دسته را فرض می کند.

```figure
pipeline-parallel
```

## ازش استفاده کن

`code/main.py`HBM Footprint، decode throughput (نظام محدود به حافظه) و $/M-tokens را برای یک مدل در سه دسته محاسبه می کند: H100 + BF16 + vLLM، H100 + FP8 + vLLM، B200 + NVFP4/FP8 + TRT-LLM. آن را اجرا کنید تا اثر ترکیب و سهم شکاف هر تغییر را ببینید.

## -باده

این درس به ما کمک می کند`outputs/skill-trtllm-blackwell-advisor.md`با توجه به حجم کار، اندازه مدل و حجم سالانه توکن، تصمیم می گیرد که آیا استیک Blackwell + TRT-LLM ارزش قفل NVIDIA را دارد یا خیر.

## تمرینات

1. فرار کن`code/main.py`در یک 120B MoE با پارامترهای فعال 30٪، تولید رمزگذاری محدود بیند و حافظه را در H100 BF16، H100 FP8 و B200 NVFP4/FP8 محاسبه کنید. بزرگترین پرش از کجا می آید؟
2. یک مشتری 2 میلیون دلار در سال برای H100 + vLLM خرج می کند. تعداد ترازنده پردازنده های بلیک ویل که باید برای خرید آن ها برای پرداخت هزینه مهاجرت به TRT-LLM در 12 ماه به دلیل 7 برابر شکاف اقتصادی، چه مقدار است؟
3. شما می بینید که دقت 3 امتیاز در MATH پس از تبدیل وزن NVFP4 کاهش می یابد. دو مسیر بازیابی را نام دهید: یکی کیفیت اول (باید وزن FP8) ، یکی هزینه اول (تعداد با داده های در دامنه).
4. نتایج نتیجه گیری MLPerf v6.0 رو بخوانید. کدام کار کوچکترین شکاف بلیک ویل-اوپر-هاپر دارد و چرا؟
5. HBM مورد نیاز برای یک مدل 405B در وزن NVFP4 + FP8 KV در زمینه 128k را محاسبه کنید. آیا آن را در یک گره GB200 NVL72 واحد مناسب است؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## خواندن بیشتر

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) آوریل 2026 نتایج MLPerf
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) هسته های NVLink 5 همه تا همه و MoE
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) مستندات رسمی موتور
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) گروه بندی دسته بندی شده بالای TRT-LLM
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) مجموعه معیار که اعداد بلکویل را منتشر می کند.
