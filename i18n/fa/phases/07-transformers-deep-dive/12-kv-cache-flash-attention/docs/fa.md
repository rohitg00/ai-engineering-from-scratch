# KV Cache، توجه فلاش و بهینه سازی انفرنس

> آموزش موازی و FLOP-بند شده است. تعبیر سریال و حافظه-بند شده است. گوشه های مختلف، ترفند های مختلف.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## مشکل

يه بازنوازيگر خودکشي ساده ي$O(N^2)$کار برای تولید$N$توکن ها: در هر مرحله توجه را بر روی پیشگویی کامل محاسبه می کند. برای پاسخ 4K- توکن که 16M عملیات توجه است، اکثر آنها تخفیف می دهند. هر حالت پنهان یک توکن پیشگویی زمانی که محاسبه می شود تعیین کننده است.

توجه به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش داده ها می پردازد. توجه به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش به اندازه ی یک صفحه نمایش می شود.

دو بهینه سازی، هر دو از داو و همکاران، نتیجه گیری مرز را از "سست" به "سرعانه" فشار داد:

1. **KV cache.**ویکتورهای K و V هر توکن پیشگویی را ذخیره کنید. توجه هر توکن جدید یک سوال در برابر کلید های ذخیره شده است.$O(N^2)$به$O(N)$در هر مرحله نسل
2. **Flash Attention.**تراشه محاسبات توجه به طوری که ماتریس کامل N × N هرگز به HBM نمی رسد. تمام نرم ماکس + ماتمول در SRAM اتفاق می افتد. 24× سرعت ساعت دیواری در A100؛ 510× در H100 با FP8.

در سال 2026 هر دو جهانی هستند. هر دسته نتیجه گیری تولید (vLLM، TensorRT-LLM، SGLang، llama.cpp) آنها را فرض می کند. هر مدل مرز کشتی با توجه فلش فعال است.

## مفهوم

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV مخزن ریاضی

هر لایه ی دیکودر، هر توکن، در تمام سرای KV:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

برای مدل 7B با 32 لایه، 32 سر (همه برای K و V استفاده می شود) ، d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

برای Llama 3 70B (80 لایه، d_head=128, GQA با 8 سر KV):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

این 10 گیگابایت در 32K به 40 گیگابایت در 128K می رسد که کل یک A100 40 گیگابایت فقط برای KV در اندازه دسته 1 است.

**GQA is the KV-cache win.**MHA با 64 KV سر 8 برابر بزرگتر خواهد بود، حدود 80 GiB در 32K. MLA حتی بیشتر فشرده می شود.

ابعاد را بکشید و اندازه حافظه پنهان را ببینید حرکت می کند. طول دنباله یا دسته را فشار دهید و ببینید که چقدر سریع آن را از طریق یک GPU عبور می کند:

```figure
kv-cache-sizer
```

### توجه فلاش  ترفند تایلینگ

توجه استاندارد:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

سه سفر دور و عقب HBM. در H100، عرض باند HBM 3 TB / s است؛ SRAM 30 TB / s است. هر سفر HBM یک عامل 10 کند شدن در مقابل نگه داشتن همه چیز در تراشه است.

توجه فلاش:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

يه سفر HBM به هر تاچ$O(N^2)$به$O(N)$. پاس عقب از برخی از ارزش های پاس جلو به جای ذخیره کردن آنها  یک حافظه دیگر برنده می شود.

**Numerical trick.**نرمترین حالت اجرا برقرار می شود`(max, sum)`در طول کاشی ها بنابراین نرمال سازی نهایی دقیق است. نه یک تقرب  توجه فلش تولید بایت متمایز به توجه استاندارد را محاسبه می کند (مودولو fp16 غیر مرتبط).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

فلاش 4 فقط در زمان راه اندازی به جلو عبور می کند. آموزش هنوز از فلاش 3 استفاده می کند. پشتیبانی GQA و varlen برای فلاش 4 در انتظار است (در اواسط سال 2026)

### کدگذاری حدس زدنی  برنده ی دیگر تاخیر

مدل ارزان پیشنهاد N توکن. مدل بزرگ همه N را موازی تأیید می کند. اگر تایید k توکن را قبول کند، شما 1 گذرنامه پیشروی مدل بزرگ را برای نسل k پرداخت کرده اید.

2026 عدم اجرا:
- **EAGLE 2 / Medusa.**سرای طرح های یکپارچه که حالت پنهان تایید کننده را به اشتراک می گذارند. سرعت 23x بدون از دست دادن کیفیت.
- **Speculative decoding with draft model.**سرعت 2×4 در سخت افزار مصرف کننده
- **Lookahead decoding.**تکرار جاکوبي، نیازی به مدل مسودات نیست، نيش اما رایگان

### دسته بندی مداوم

نتیجه گیری دسته بندی کلاسیک: منتظر تمام شدن آهسته ترین ردیف باشید، سپس یک دسته جدید شروع کنید. GPU را وقتی پاسخ های کوتاه زودتر تمام می شود، تلف می کند.

دسته بندی مداوم (اولین بار در Orca، اکنون در vLLM، TensorRT-LLM، SGLang): درخواست های جدید را به دسته تبدیل کنید به محض اینکه درخواست های قدیمی تمام شوند. 510 × افزایش تولید برای بار کاری چت معمولی.

### PagedAttention  KV cache به عنوان حافظه مجازی

ویژگی اصلی vLLM. کیش KV در بلوک های 16 توکن اختصاص داده شده است؛ یک جدول صفحه موقعیت های منطقی را به بلوک های فیزیکی نقشه می زند. به شما امکان می دهد KV را در نمونه های موازی (مطالعه جستجو، نمونه گیری موازی) ، پیشگوهای گرم سوئیچ برای کیش سریع و حافظه شکاف بخشید. بهبود 4x تولید نسبت به اختصاص ساده موازی.

```figure
flash-attention-memory
```

## آن را بسازید

```figure
iso-machine {"machine":"kv-cache"}
```

ببین`code/main.py`، یا بندر رستش`code/main.rs`. براي اجرا کردن نسخه رست:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`ما اجرا میکنیم:

1. یه آدم ساده$O(N^2)$دیکودر افزایشی
2. A$O(N)$کِي وي-کاش شده
3. يه نرمکاس تابلوي که الگورتم سرعت بالا Flash Attention رو شبیه ساز ميکنه

### مرحله اول: KV cache

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

ساده: به رشد متری هر توکن K و V در هر لایه، هر لیست سر ادامه دهید.

### مرحله دوم: نرم ترین کاشی

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

تولید بایت متمایز به `softmax(qK) V`در یک شوت، اما در هر زمان مجموعه کار یک `tile × d_head`بلوک نه کل`N × d_head`. .

### مرحله 3: مقایسه کدگذاری ساده با کدگذاری ذخیره شده

عملیات توجه شمارش. هر دو کدگر مقایسه کلید جستجو را انجام می دهند: مرحله `t`حضور داره`t`توکن ها، پس کل 1 + 2 + ... + N = N  N+1)/2. کد از N = 10 استفاده می کند و برای هر کدگر 55 چاپ می کند. برای نسل ۱۰۰ توکن، هر دو مقایسه 5050 را انجام می دهند. حافظه حافظه پیش بینی K و V را ذخیره می کند. بدون یک کش، هر مرحله K و V را برای پیشگویی کامل دوباره محاسبه می کند، بنابراین یک نسل 100 توکن 5050 حالت توکن را محاسبه می کند. با حافظه کش، K و V هر توکن یک بار محاسبه می شوند، بنابراین همان نسل ۱۰۰ حالت توکن را محاسبه می کند.

## ازش استفاده کن

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

تولید vLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

پیش فرض ذخیره سازی در میان درخواست ها یک پیروزی بزرگ 2026 است  همان سیستم فوری، چند نمونه شات، یا سند زمینه طولانی KV را در میان تماس ها تکرار می کند. برای بار کاری عامل با درخواست های ابزار مکرر، پیش فرض ذخیره سازی به طور معمول 5x افزایش تولید است.

## -باده

ببین`outputs/skill-inference-optimizer.md`مهارت انتخاب اجرای توجه، استراتژی KV cache، کوانتاسیون و رمزگذاری حدس زدنی برای یک انتشار نتیجه گیری جدید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. تایید کنید که کدگرهای ساده و ذخیره شده همان محصول را تولید می کنند؛ توجه کنید به تفاوت شمارش گزینه.
2. **Medium.**پیاده سازی پیشگویی: با توجه به یک پیام P و چندین تکمیل، یک عبور جلو را بر روی P اجرا کنید تا حافظه کش KV را پر کنید، سپس هر تکمیل را شاخ کنید. سرعت را در مقابل کدگذاری مجدد P برای هر یک اندازه گیری کنید.
3. **Hard.**پیاده سازی یک بازی PagedAttention: KV cache در بلوک های ثابت 16 توکن با یک لیست رایگان. هنگامی که یک ردیف تمام شده است، بلوک های آن را به استخر بازگردانید. شبیه سازی 1000 تکمیل چت با طول های مختلف. مقایسه شکاف حافظه با اختصاص متصل.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## خواندن بیشتر

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) فلش ۱
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) فلش 2
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) فلش ۳
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) خط لوله 5 مرحله ی بلیک ویل و ترفند نرم افزار-exp2؛ برای هشدارهای راه اندازی فقط به جلو که در این درس ذکر شده است، ریپو README را بخوانید.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)کاغذی کامل
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) رمزنگاري مشخصات
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) مقاله EAGLE-1/2 برای رویکرد یکپارچه در مورد متن درس.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) رویکرد Medusa در کنار Eagle اشاره شده است.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) عمیق ترین غوطه گیری در 16 توکن بلوک و صفحه میز طراحی.
