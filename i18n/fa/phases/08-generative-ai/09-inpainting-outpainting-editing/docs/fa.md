# رنگسازی، رنگسازی و ویرایش تصویر

> متن به تصویر چیزهای جدید را ایجاد می کند. نقاشی قدیمی را اصلاح می کند. در تولید، 70٪ از کارهای تصویر قابل پرداخت ویرایش است  پس زمینه را عوض کنید، لوگو را حذف کنید، پارچه را گسترش دهید، دست را بازسازی کنید. نقاشی جایی است که انتشار به دست می آورد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## مشکل

یک مشتری یک عکس محصول کامل را با یک علامت منحرف کننده در پس زمینه ارسال می کند. شما می خواهید این علامت را پاک کنید و همه چیز دیگر را شبیه پیکسل بگذارید. شما نمی توانید از نو متن به تصویر اجرا کنید  نتیجه رنگ، نور و زاویه محصول متفاوت خواهد بود. شما می خواهید * فقط * منطقه پوشیده را بازسازی کنید و می خواهید بازسازی به شرایط اطراف احترام بگذارد.

این نقاشی است.

- **Inpainting.**در داخل ماسک بازتولید کنید، در خارج از پیکسل ها بمانید.
- **Outpainting.**خارج از ماسک (یا خارج از پارچه) بازسازی کنید، در داخل بمانید.
- **Image editing.**کل تصویر را بازسازی کنید اما وفاداری معنوی یا ساختاری به اصل را حفظ کنید (SDEdit، InstructPix2Pix).

هر خط لوله انتشار در سال 2026 یک حالت رنگگذاری را ارسال می کند. فلکس.۱-فول، رنگ لوله انتشار پایدار، SDXL-Inpaint، DALL-E 3 Edit. آنها بر اساس همان اصل کار می کنند.

## مفهوم

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### رویکرد ساده (و چرا اشتباه است)

با استفاده از ماسک، متن به تصویر استاندارد را اجرا کنید. در هر مرحله نمونه گیری، منطقه ناشناس را از غشای غشای غشای غشای غشای غشای غشای پاک جایگزین کنید. این کار... بد کار می کند. آثار مرزی خونریزی می کنند چون مدل هیچ اطلاعاتی در مورد آنچه در منطقه ناشناس است ندارد.

### مدل رنگ گذاری مناسب

یک شبکه U-Net اصلاح شده را اجرا کنید که به جای 4 کانال ورودی 9 کانال را می گیرد:

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

کانال های اضافی یک کپی از تصویر منبع کد VAE و یک ماسک یک کانال هستند. در زمان آموزش، شما به طور تصادفی مناطق تصویر را ماسک می کنید و مدل را آموزش می دهید تا فقط منطقه ماسک شده را نشان دهد در حالی که منطقه بدون ماسک به عنوان سیگنال شرایطی پاک داده می شود. در نتیجه، مدل می تواند آنچه را که در اطراف منطقه ماسک شده است "بینید" و تکمیل های منسجم را تولید کند.

SD-Inpaint، SDXL-Inpaint، Flux-Fill همه از این ورودی ۹ کانال (یا آنالوگ) استفاده می کنند.`StableDiffusionInpaintPipeline`،`FluxFillPipeline`. .

### SDEdit (Meng et al., 2022)  ویرایش رایگان

به تصویر منبع تا حد متوسط اضافه کنید `t`، بعد از اون زنجیره برگشتي رو از`t`به صفر با یک درخواست جدید بدون آموزش مجدد انتخاب شروع`t`وفاداری را به خاطر آزادی خلاقانه معامله می کند:

- `t/T = 0.3`→ تقریباً مشابه منبع، تغییرات سبک کوچک
- `t/T = 0.6`→ اصلاحات معتدل، ساختار خشن را حفظ می کند
- `t/T = 0.9`→ از نزدیک به صدا، حفظ منبع حداقل تولید شده

### InstructPix2Pix (بروکس و همکارانش، 2023)

. یک مدل انتشار را به خوبی تنظیم کنید`(input_image, instruction, output_image)`در نتیجه، حالت هم روی تصویر ورودی و هم یک دستورالعمل متن ("به آن آفتاب فرو می رود"، "تنگه ای اضافه کنید"). دو مقیاس CFG: مقیاس تصویر و مقیاس متن.

### RePaint (Lugmayr و همکارانش، 2022)

یک مدل انتشار بدون شرط استاندارد را حفظ کنید. در هر مرحله برگشت، نمونه مجدد را انجام دهید. گاهی به حالت شور تر بازمی گردد و بازسازی شود. از آثار مرزی اجتناب کنید. زمانی که شما یک مدل رنگ برداری آموزش دیده ندارید استفاده می شود.

```figure
inpaint-mask-reinject
```

## آن را بسازید

`code/main.py`ما یک طرح رنگ سازی 1D بازی را بر روی داده های 5 بعدی پیاده سازی می کنیم. ما یک DDPM را بر روی داده های مخلوط 5 بعدی آموزش می دهیم که هر نمونه 5 تیر از یکی از دو خوشه است. در نتیجه، ما 2 از 5 ابعاد را "پوش" می کنیم، در هر مرحله نسخه های سر و صدای جلو از سه بدون ماسک تزریق می کنیم و فقط ابعاد پوشیده را بازسازی می کنیم.

### مرحله 1: داده های DDPM ۵-D

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### مرحله دوم: از بین بردن قطار در تمام 5 کم

DDPM استاندارد. خروجی شبکه پیش بینی صدا 5D برای ورودی صدا 5D

### مرحله سوم: در نتیجه گیری، برعکس آگاه با ماسک

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

این رویکرد ساده است و روی داده های 1 بعدی اسباب بازی کار می کند. تصویر واقعی از ورودی 9 کانال استفاده می کند زیرا منسجمیت بافت مهم تر است.

### مرحله 4: رنگ کردن

رنگ کردن با نقاب به عقب: نقاب جدید (که قبلاً وجود نداشت) را پوشش دهید، بقیه را با اصلی پر کنید. هدف آموزشی یکسان.

## دام ها

- **Seams.**این رویکرد ساده، مرز های قابل مشاهده را می گذارد زیرا اطلاعات گرادینت در ماسک جریان ندارد. درست کنید: ماسک را با 8-16 پیکسل گسترش دهید، یا از یک مدل رنگ مناسب استفاده کنید.
- **Mask leakage.**اگر منطقه ناشناس تصویر حالت دهنده با کیفیت پایین یا سر و صدا باشد، نسل درون ماسک را آلوده می کند.
- **CFG interacts with mask size.**CFG بالا در ماسک کوچک = پیچ اشباع شده. CFG را برای اصلاحات کوچک کاهش دهید.
- **SDEdit fidelity cliff.**از کجا ميام؟`t/T = 0.5`به`t/T = 0.6`ميتونه هویت موضوع رو از دست بده
- **Prompt mismatch.**این پیام باید تصویر را توصیف کند نه فقط محتوای جدید. "یک گربه روی صندلی نشسته" نه "یک گربه".

## ازش استفاده کن

| Task | Pipeline |
|------|----------|
| Remove object, small mask | SD-Inpaint or Flux-Fill, standard prompt |
| Replace sky | SD-Inpaint + "blue sky at sunset" |
| Extend canvas | SDXL outpaint mode (8px feather) or Flux-Fill with outpaint mask |
| Regenerate hand / face | SD-Inpaint with prompt re-describing the subject + ControlNet-Openpose |
| Change style of one region | SDEdit at `t/T=0.5` on masked region |
| "Make it sunset" | InstructPix2Pix or Flux-Kontext |
| Background replacement | SAM mask → SD-Inpaint |
| Ultra-high-fidelity | Flux-Fill or GPT-Image (hosted) for hardest cases |

SAM (Meta Segment Anything، 2023) + diffusion inpaint، لوله حذف پس زمینه 2026 است. SAM 2 (2024) بر روی ویدیو کار می کند.

## -باده

نگه دار`outputs/skill-editing-pipeline.md`. مهارت یک تصویر اصلی + توضیحات ویرایش + ماسک اختیاری (یا SAM prompt) را می گیرد و خروجی: رویکرد تولید ماسک، مدل پایه، مقیاس CFG (تصاویر + متن) ، حالت SDEdit-t یا رنگ گذاری و لیست چک QA را می گیرد.

## تمرینات

1. **Easy.**در`code/main.py`، فرکانس ابعاد پوشیده از 0.2 تا 0.8 متفاوت است.
2. **Medium.**پیاده سازی RePaint: در هر 10 مرحله برگشت، 5 مرحله عقب (ضوضوح اضافه کنید) و دوباره آن را نشان دهید. اندازه گیری کنید که آیا آن را کاهش می دهد.
3. **Hard.**برای مقایسه با پخش کننده های Hugging Face استفاده کنید: SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1- در 20 کار بازسازی صورت پر کنید. نمره به طور جداگانه در مورد پیوستن و حفظ هویت قرار می گیرد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | Regenerate inside a mask; keep outside pixels. |
| Outpainting | "Extend the canvas" | Regenerate outside the canvas; keep inside. |
| 9-channel U-Net | "Proper inpainting model" | U-Net with `noisy \| encoded-source \| mask` as input. |
| SDEdit | "Img2img with noise level" | Noise to time `t`, denoise with new prompt. |
| InstructPix2Pix | "Text-only edits" | Fine-tuned diffusion on (image, instruction, output) triples. |
| RePaint | "No retraining" | Re-noise periodically during reverse to reduce seams. |
| SAM | "Segment Anything" | Mask generator by clicks or boxes; pairs with inpaint. |
| Flux-Kontext | "Edit with context" | Flux variant that accepts a reference image + instruction for edits. |

## توجه تولید: خطوط لوله ویرایش حساس به تاخیر هستند

کاربران ویرایش یک تصویر انتظار می رود که به مدت زیر ۵ ثانیه دور و عقب سفر کنند. یک SDXL-Inpaint 30 مرحله ای در 10242 به مدت 3-4 ثانیه در یک L4 است، به علاوه تولید ماسک SAM (~ 200 ms) و کد VAE / کد VAE (~ 500 ms ترکیب شده). در چارچوب تولید، این TTFT محدود به جای تولید محدود است  دسته 1، موازی کم، هر مرحله را به حداقل رساندن:

- **SAM-H is the slow one.**SAM-H در 10242 ~ 200 ms است؛ SAM-ViT-B ~ 40 ms با کاهش کیفیت جزئی. SAM 2 (ویڈیو) اضافه می کند زمان هزینه های اضافی؛ از آن برای ویرایش یک تصویر استفاده نکنید.
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)`اگر شما لانت های نسل قبلی (معمولا در UI های ویرایش تکراری) دارید، آنها را مستقیماً از طریق `latents=...`برای رد کردن یک کد VAE
- **Mask dilation matters for throughput too.**یک ماسک کوچک به این معنی است که بیشتر پاس های پیشروی U-Net ضایع می شود (پیکسل های ناشناس به هر حال بسته می شوند). `diffusers`"`StableDiffusionInpaintPipeline`بدون توجه به این که U-Net کامل را اجرا می کند؛ تنها 9 کانال نسخه های مناسب رنگ استفاده از مخفي محاسبه.
- **Flux-Kontext is the 2025 answer.**. واحد جلو عبور`(source_image, instruction)` بدون ماسک جداگانه، بدون سراف صدا SDEdit. در H100، در حدود 1.5 ثانیه ویرایش ارسال می شود. درس معماری: سقوط مراحل.

## خواندن بیشتر

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) نقاشی بدون آموزش
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) مرگ
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) ویرایش دستورالعمل های متن
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643)SAM، منبع ماسک
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) ویدیو SAM
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) ویرایش سطح توجه
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) ابزار 2024
