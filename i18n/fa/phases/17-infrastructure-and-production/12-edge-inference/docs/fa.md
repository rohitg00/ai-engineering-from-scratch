# Edge Inference  موتور عصبی اپل، کوالکام هکسگون، WebGPU/WebLLM، Jetson

> محدودیت اصلی لبه، عرض باند حافظه است نه محاسبه. DRAM موبایل در 50 تا 90 جی بی/ ثانیه قرار دارد؛ مرکز داده HBM3 2-3 TB/s  فاصله 30 تا 50x را پاک می کند. رمزگشایی به حافظه محدود شده، بنابراین شکاف حتمي است. در سال 2026 منظره به چهار بخش تقسیم می شود. موتور عصبی اپل M4/A18 با حافظه ی یکپارچه (هیچ نسخه CPUNPU) 38 TOPS را به دست می آورد. کوالکام اسنپدراگون ایکس ایلیت /8 جنرال 4 هکسگون 45 تاپس را به دست آورد. WebGPU + WebLLM Llama 3.1 8B (Q4) را با ~ 41 توک / ثانیه در M3 Max (تقریبا 70-80% از بومی) اجرا می کند؛ 17.6k ستاره های GitHub، API سازگار با OpenAI، ~ 70-75% پوشش تلفن همراه. NVIDIA Jetson Orin Nano Super (8GB) با Llama 3.2 3B / Phi-3 مطابقت دارد؛ AGX Orin gpt-oss-20b را از طریق vLLM با ~ 40 توک / ثانیه اجرا می کند؛ Jetson T4000 (JetPack 7.1) 2x AGX Orin است. TensorRT Edge-LLM از EAGLE-3، NVFP4 پشتیبانی می کند، prefill  که در CES 2026 توسط Bosch، ThunderSoft، MediaTek نمایش داده شده است.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## اهداف یادگیری

- توضیح دهید که چرا نتیجه گیری LLM موبایل محدود به حافظه و عرض باند و محاسبه ثانویه است.
- چهار هدف کناری (Apple ANE، Qualcomm Hexagon، WebGPU/WebLLM، NVIDIA Jetson) را لیست کنید و هر یک را با یک مورد استفاده مطابقت دهید.
- شکاف پوشش WebGPU 2026 (فایرفکس Android را به سرعت در حال دستیابی) و فرود Safari iOS 26 را نام دهید.
- یک فرمت کوانتاسیون را برای هر هدف انتخاب کنید (Core ML INT4 + FP16 برای ANE، QNN INT8/INT4 برای Hexagon، WebGPU Q4 برای مرورگر، NVFP4 برای Jetson Thor).

## مشکل

یک مشتری یک چت روت در دستگاه را می خواهد: صدای اول، خصوصی به طور پیش فرض، کار غیر فعال است. در MacBook Pro M3 Max، Llama 3.1 8B Q4 با ~55 توک / ثانیه خوب اجرا می شود. در یک iPhone 16 Pro، همان مدل با 3 توک / ثانیه خوب اجرا نمی شود. در یک اندروید متوسط با Snapdragon 8 Gen 3, 7 توک / ثانیه. در مرورگر از طریق WebGPU در Chrome Android v121 +، 4-8 توک / ثانیه بسته به دستگاه.

تفاوت تولید یک مسئله پورت نیست. این شکاف عرض باند به مراتب فرمت کوانتاسیون به مراتب این است که آیا NPU از فضای کاربر قابل دسترسی است. نتیجه گیری کناری در سال 2026 چهار مشکل مختلف با چهار راه حل مختلف است.

## مفهوم

### عرض باند سقف واقعی است

کد پاکسازی مجموعه ی کامل وزن ها را برای هر توکن می خواند. یک مدل 7B در Q4 3.5 GB است. خواندن 3.5 GB در 50 GB / ثانیه 70 ms است  یک سقف نظری از ~ 14 tok / s. در 90 GB / s (DRAM تلفن همراه پیشرفته) سقف به ~ 25 tok / s حرکت می کند. هیچ مقدار محاسباتی کمک می کند زیر این تعداد.

مرکز داده HBM3 با 3 TB/s، 3.5 GB را در 1.2 ms پاک می کند. سقف 830 توک/s است. همان مدل، وزن مشابه. زیرسیستم حافظه متفاوت.

### موتور عصبی اپل (M4 / A18)

- تا 38 TOPS. حافظه ی یکپارچه (CPU و ANE در یک حوضه مشترک هستند)  هیچ هزینه ی کپی نیست.
- دسترسی از طریق Core ML + `.mlmodel`مدل های مرتب شده یا از طریق Shaders Metal Performance (MPS) از طریق PyTorch.
- Llama.cpp Backend Metal MPS را به طور مستقیم استفاده می کند، نه ANE؛ ANE بومی نیاز به تبدیل Core ML دارد.
- بهترین مسیر عملی برای برنامه های iOS در سال 2026: Core ML با وزنه های INT4 + فعال سازی FP16.

### کوالکم هکسگون (اسنپ دراگون ایکس ایلیت / 8 جن 4)

- تا 45 تاپس. با CPU و GPU در SoC ادغام شده اما دامنه حافظه جداگانه
- QNN (Qualcomm Neural Network) SDK و AI Hub تبدیل از PyTorch / ONNX را فراهم می کند.
- قالب های چت، لاما ۳، فی ۳ همه به عنوان آثار درجه اول در مرکز هوش مصنوعی ارسال می شوند.

### اینتل / AMD NPU (لunar lake، Ryzen AI 300)

- 40-50 TOPS. نرم افزار از اپل / کوالکوم عقب مانده است؛ OpenVINO بهبود می یابد اما به صورت نشی.
- بهترین برای برنامه های همراه با ویندوز ARM؛ بومی در کامپیوترهای AMD / Intel برای اولین بار محلی.

### WebGPU + WebLLM

- مدل ها را در مرورگر از طریق شader های کامپیوتری WebGPU اجرا کنید؛ هیچ نصب ای وجود ندارد.
- Llama 3.1 8B Q4 در ~ 41 توک / ثانیه در M3 Max  تقریبا 70-80٪ از بومی از طریق همان backend.
- 17.6k GitHub ستاره در WebLLM؛ OpenAI سازگار JS API؛ Apache 2.0.
- پوشش 2026: کروم اندروید v121+, سفاری iOS 26 GA، فایرفاکس اندروید هنوز هم در حال پیگیری. پوشش کلی موبایل 70-75%.

### NVIDIA خانواده جتسون

- Orin Nano Super (8GB): با Llama 3.2 3B، Phi-3 با سرعت خوب در ثانیه مطابقت دارد.
- AGX Orin: gpt-oss-20b را از طریق vLLM با ~ 40 توک/س انجام می دهد.
- Thor / T4000 (JetPack 7.1): عملکرد 2x AGX Orin، EAGLE-3 و NVFP4 پشتیبانی می شود.
- TensorRT Edge-LLM (2026) از کدگذاری ایگل ۳، وزن NVFP4، prefill  بهینه سازی های مرکز داده ها را به کناری پشتیبانی می کند.

### انتخاب کوانتزی برای هر هدف

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### تله بلند زمینه در کناره

زمینه 128K Llama 3.1 یک ویژگی مرکز داده است. در یک تلفن با 8 GB RAM، مدل 4 GB + 2 GB KV برای توکن های 32K + OS overhead = OOM. انتشار کنتکس در 4K-8K نگه دارد مگر اینکه کوانتاسیون KV تهاجمی (Q4 KV) پذیرفته شود.

### صدا برنامه قاتل است

عوامل صوتی حساس به تاخیر هستند (ترجمهای اول <500 ms). نتیجه گیری محلی تاخیر شبکه را به طور کامل از بین می برد. با صحبت به متن (ورینات Whisper Turbo در کنار اجرا می شود) ترکیب می شود و نتیجه گیری حاشیه به حلقه صوتی کیفیت تولید تبدیل می شود.

### شماره هایی که باید به یاد داشته باشی

- اپل M4 / A18 ANE: 38 TOPS
- کوالکم هکسگون SD X Elite: 45 توپس
- WebLLM M3 Max: ~41 توک/س در Llama 3.1 8B Q4.
- AGX Orin: ~40 توک/س در gpt-oss-20b از طریق vLLM.
- فاصله بین باند در حد مرکز داده: 30-50x
- پوشش موبایل WebGPU: ~ 70-75% (فایرفکس اندروید عقب مانده).

```figure
edge-bandwidth-pipe
```

## ازش استفاده کن

`code/main.py`محاسبه سقف تخفیف تخفیف در نظریه از ریاضیات محدود با عرض باند در سراسر اهداف کناری. مقایسه با معیار های مشاهده شده و برجسته هایی که در آن عرض باند، نه محاسبه، گلو شکنی است.

## -باده

این درس به ما کمک می کند`outputs/skill-edge-target-picker.md`. به عنوان یک سیستم عامل (iOS/Android/browser/Jetson) ، مدل و بودجه تاخیر/ حافظه، یک فرمت کوانتاسیون و خط تبدیل را انتخاب می کند.

## تمرینات

1. فرار کن`code/main.py`برای یک مدل 7B در Q4 در یک Snapdragon 8 Gen 3 (~ 77 GB / s عرض باند) ، سقف رمزگذاری را محاسبه کنید. در مقایسه با 6-8 tok / s مشاهده شده  آیا زمان اجرا کارآمد است؟
2. WebGPU در اندروید به Chrome v121 نیاز دارد. برای مرورگرهای قدیمی تر از طریق همان API سازگار با OpenAI یک فال بیک طراحی کنید.
3. برنامه iOS شما نیاز به پخش 4K-تلفن دارد. کدام مدل/فورمات ترکیب اجازه می دهد تا شما در یک آیفون 16 کمتر از 4 گیگابایت حافظه فعال داشته باشید؟
4. جتسون آگکس اورین GPT-oss-20b را با 40 توک/دقیقه اجرا می کند. جتسون نانو فقط با 3B مطابقت دارد. اگر محصول شما هر دو را هدف قرار می دهد، چگونه یکپارچه سازی استیک نتیجه گیری می کنید؟
5. بحث کنید که آیا "WebLLM در سال 2026 آماده تولید است". پوشش، عملکرد و شکاف اندروید فایرفاکس را ذکر کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## خواندن بیشتر

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) منظره و معیارها
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) اورين / AGX / تور
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) اعلام بندر کناری 2026
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) طراحی و معیارها
- [Apple Core ML](https://developer.apple.com/documentation/coreml) تبدیل به یک بومی
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) مدل های پیش از تبدیل برای هکسگون
