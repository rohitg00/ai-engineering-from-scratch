# کنترل شبکه، لورا و تهویه

> متن به تنهایی یک سیگنال کنترل ناسازگار است. ControlNet به شما امکان می دهد یک مدل انتشار پیش از آموزش را کلر کنید و با یک نقشه عمق، پوز اسکلت، کریکبل یا تصویر کناری آن را هدایت کنید. LoRA به شما امکان می دهد یک مدل پارامتر 2B را با آموزش 10 میلیون پارامتر تنظیم کنید. با هم آنها Stable Diffusion را از یک اسباب بازی به لوله تصویر 2026 تبدیل کردند که در هر آژانس ارسال می شود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## مشکل

یک پیام مانند "زن لباس قرمز با سگ در خیابان پرشوده" به مدل هیچ اطلاعاتی در مورد * کجا * سگ است ، * چه حالت * زن در آن است ، یا * چشم انداز * خیابان نمی دهد. متن حدود 10٪ آنچه که برای مشخص کردن یک تصویر نیاز دارید را به پایین می آورد. بقیه بصری است و نمی تواند به طور موثر با کلمات توصیف شود.

آموزش یک مدل مشروط جدید از ابتدا برای هر سیگنال (موقف، عمق، خیره کننده، بخش بندی) ممنوع است. شما می خواهید ستون فقرات SDXL 2.6B-param را منجمد نگه دارید، یک شبکه جانبی کوچک را متصل کنید که حالت را می خواند و ویژگی های میانگین ستون فقرات را فشار دهید. این ControlNet است.

شما همچنین می خواهید به مدل مفاهیم جدیدی ( چهره، محصول، سبک خود) بدون آموزش مجدد مدل کامل آموزش دهید. شما می خواهید یک دلتا 100 برابر کوچکتر داشته باشید. این است که آداپتورهای درجه پایین LoRA  که به وزن های توجه موجود متصل می شوند.

ControlNet + LoRA + متن = ابزارک تمرین کننده 2026 . بیشتر خطوط لوله تصویر تولید لایه 2-5 LoRAs ، 1-3 ControlNets و یک آداپتور IP در بالای یک SDXL / SD3 / Flux پایه است.

## مفهوم

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang و همکارانش، 2023)

یک SD پیش از آموزش بگیرید. * کلون * نصف کدگر U-Net. اصلی را منجمد کنید. کلون را برای پذیرش ورودی اضافی شرایط (حوا، عمق، حالت) آموزش دهید. کلون را به نیمه کدگر اصلی با * صفر کنوولسیون * اتصال های تخلیه (۱ × ۱ کنو شروع به صفر  شروع به بدون کار، یادگیری دلتا) متصل کنید.

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

صفر-conv init به این معنی است که ControlNet به عنوان هویت شروع می شود  حتی قبل از آموزش هیچ ضرر ندارد. قطار در 1M (سرعت، حالت، تصویر) با ضایعات انتشار استاندارد سه برابر می شود.

ControlNets های هر مدل به عنوان مدل های جانبی کوچک (~ 360M برای SDXL، ~ 70M برای SD 1.5) ارسال می شوند.

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

برای هر لایه خطی $W \in \mathbb{R}^{d \times d}$در مدل، منجمد شدن$W$و دلتای درجه پایین اضافه کنید:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

با$r \ll d$رتبه 4-16 برای توجه استاندارد است، رتبه 64-128 برای آهنگ های سنگین.$2 \cdot d \cdot r$به جای$d^2$. براي توجه به SDXL با $d=640$،$r=16$: 20k پارامای در هر آداپتور به جای 410k  20x کاهش. در سراسر مدل: یک LoRA معمولا 20-200MB در مقابل پایه 5GB است.

در نتیجه می تونید لورا رو مقیاس بزنید:$W' = W + \alpha \cdot B A$.$\alpha = 0.5\text{-}1.5$این امر طبیعی است. LORA های متعدد به صورت اضافی (با توجه به هشدار معمول که آنها به روش های غیر خطی تعامل می کنند) ، جمع می شوند.

### آداپتور IP (Ye et al., 2023)

یک آداپتور کوچک که یک *تصاویر* را به عنوان شرایط (با متن) پذیرفته است. از کدگر تصویر CLIP برای تولید توکن های تصویر استفاده می کند، آنها را در کنار توکن های متن به توجه متقابل تزریق می کند. ~ 20MB در هر مدل پایه. اجازه می دهد تا شما "تصاویر را به سبک این مرجع تولید کنید" بدون یک LoRA.

## ماتریس ترکیب پذیری

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

کنترلنت، فضايي، لورا، معنوي، هر دو رو استفاده کن

```figure
v4-controlnet-zero
```

## آن را بسازید

`code/main.py`دو مکانیسم را در 1-D شبیه سازی می کند:

1. **LoRA.**یک لایه خطی پیش از آموزش$W$. یخش بده . یه درجه پایین رو آموزش بده$BA$مثل اين$W + BA$با یک لایه خطی هدف مطابقت دارد. نشان دهید که$r = 1$برای یادگیری یک اصلاح درجه 1 به طور کامل کافی است.

2. **ControlNet-lite.**یک پیش بینی کننده "بنیاد منجمد" و یک "شبکه جانبی" که سیگنال اضافی را می خواند. خروجی شبکه جانبی توسط یک مقیاس قابل یادگیری که به صفر آغاز شده است (ورژن ما از صفر-conv) بسته شده است. قطار و نگاه کردن به رامپ دروازه بالا.

### مرحله ی اول: ریاضیات لورا

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### مرحله دوم: شبکه جانبی صفر

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

در مرحله 0، تولید مشابه با پایه است.`gate`آهسته آهسته بدون حرکت فاجعه بار

## دام ها

- **Over-scaling LoRAs.** $\alpha = 2$یا$\alpha = 3$یک هک معمول "باید قوی تر شود" است که باعث تولید محصولات بیش از حد سبک شده / شکسته می شود. نگه دارید $\alpha \le 1.5$. .
- **ControlNet weight conflict.**استفاده از یک Pose ControlNet با وزن 1.0 و یک Depth ControlNet با وزن 1.0 معمولاً بیش از حد انجام می شود. مجموع وزن ≈ 1.0 یک پیش فرض امن است.
- **LoRA on the wrong base.**SDXL LoRA به طور خاموشي در SD 1.5 بدون کار ميکنه چون ابعاد توجه با هم مطابقت نداره.
- **Textual Inversion drift.**توکن هایی که در یک نقطه بازرسی آموزش دیده اند به طور بدی در نقطه بازرسی دیگری حرکت می کنند.
- **LoRA weight-merging and storage.**شما می توانید یک LoRA را به وزن مدل پایه برای نتیجه گیری سریعتر (بدون اضافه کردن زمان اجرا) درست کنید، اما توانایی مقیاس را از دست می دهید$\alpha$در زمان اجرا، هر دو نسخه رو نگه دار

## ازش استفاده کن

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## -باده

نگه دار`outputs/skill-sd-toolkit-composer.md`مهارت یک کار را انجام می دهد (اقتصادی در ورودی: سریع، تصویر مرجعی اختیاری، حالت اختیاری، عمق اختیاری، مسخره اختیاری) و از یک ستون ابزار، وزنه ها و پروتکل تخم تولید می شود.

## تمرینات

1. **Easy.**در`code/main.py`، درجه LoRA را تغییر دهید`r`در چه درجه ای LoRA دقیقا با دلتای هدف درجه 2 مطابقت دارد؟
2. **Medium.**دو LoRA جداگانه را روی دو تغییر هدف آموزش دهید. آنها را با هم بارگذاری کنید و تعامل اضافی آنها را نشان دهید. تعامل خطی را چه زمانی شکسته است؟
3. **Hard.**استفاده از پخش کننده ها برای جمع آوری: SDXL-بز + Canny-ControlNet (وزن 0.8) + یک سبک LoRA ($\alpha$0.8) + IP-Adapter (وزن 0.6) با توجه به تغییر وزن های دسته، تعادل FID در برابر تعمیل فوری را اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## یادداشت تولید: تبادلات LoRA، خطوط کنترل شبکه، خدمات چند مستاجر

یک سامسونگ واقعی از متن به تصویر صدها LoRA و ده ها ControlNets را در یک نقطه بازرسی پایه خدمت می کند. مشکل ارائه بسیار شبیه به LLM چند تنانسی است (ادبیات تولید مورد LLM را تحت دسته بندی مداوم و LoRAX / S-LoRA پوشش می دهد):

- **Hot-swap LoRAs, do not merge.**ادغام$W' = W + \alpha \cdot B \cdot A$به پايه مياد و 3-5% سریعتر در هر مرحله نتيجه ميده اما منجمد ميشه$\alpha$و پایه. لورا ها را در VRAM به عنوان دلتا درجه r گرم نگه دارید.`pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`برای فعال کردن هر درخواست هزینه تبادل`2 · d · r · num_layers`وزن  در مقیاس MB، زیر ثانیه.
- **ControlNet as a second attention lane.**کدگر کلر شده به طور موازی با پایه اجرا می شود. دو ControlNets با وزن 1.0 هر یک = دو گذر اضافی به جلو در هر مرحله، نه یک گذر ادغام شده. حجم دسته به شکل مربع کاهش می یابد. بودجه برای ~ 1.5 × هزینه مرحله ای در هر ControlNet فعال.
- **Quantized LoRAs too.**اگر پایه را کمی کنید (به درس 07، جریان در 8GB نگاه کنید) ، دلتا LoRA نیز به طور تمیز به 8 یا 4 بیت کمی می کند. بارگذاری به سبک QLoRA به شما اجازه می دهد 5-10 LoRA را در بالای یک پایه 4 بیت Flux بدون شکستن حافظه جمع کنید.

فلوکس مخصوص: لپ تاپ Niels Flux-on-8GB پایه را به 4 بیت اندازه می گیرد؛`pipe.load_lora_weights("user/style-lora")`) در این اساس کوانتزیزه شده در `weight_name="pytorch_lora_weights.safetensors"`هنوز هم کار می کند. این دستور کار اکثر آژانس های SaaS در سال 2026 ارسال می کنند.

## خواندن بیشتر

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) ControlNet
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (در اصل برای LLM ها؛ بندر های انتشار)
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) آداپتور IP
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) جایگزین سبک تر به ControlNet
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) خوابگاه
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) لوله های مرجع
