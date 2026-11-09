# Capstone 15  آرم ایمنی قانون اساسی + خط قرمز تیم

> طبقه بندی کنندگان اساسی Anthropic، Llama Guard 4 Meta، ShieldGemma 2 Google، Nemotron 3 Content Safety NVIDIA و X-Guard برای پوشش چندزبانی، استیک طبقه بندی کننده ایمنی 2026 را تعریف کردند. گراک، پیریت، NVIDIA Aegis و promptfoo به ابزار ارزیابی معارضیت استاندارد تبدیل شدند. نيمو گارد ريلز v0.12 اونا رو به يه لوله توليدي متصل ميکنه این سنگ پایه همه چیز را به هم متصل می کند: یک خط ایمنی لایه ای در اطراف یک برنامه هدف، یک عامل مستقل تیم قرمز که 6 خانواده حمله را اداره می کند، و یک اجرای خود منتقد قانون اساسی که دلتای بی ضرر قابل اندازه گیری را تولید می کند.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## مشکل

مرز ایمنی LLM در سال 2026 این نیست که آیا طبقه بندی کننده ها کار می کنند (تقریباً انجام می دهند) بلکه چگونگی ترکیب آنها به درستی در اطراف یک برنامه تولید بدون رد بیش از حد یا ترک سوراخ های آشکار است. نگهبان لاماي 4 نقضات سيستم انگليسي رو اداره ميکنه X-Guard (132 زبان) jailbreak چند زبانی را اداره می کند. ShieldGemma-2 تزریق فوری مبتنی بر تصویر را ضبط می کند. NVIDIA Nemotron 3 ایمنی محتوا شامل دسته های شرکت می شود. طبقه بندی کنندگان اساسی Anthropic یک رویکرد جداگانه ای است که در هنگام آموزش به جای خدمت استفاده می شود.

پی آر و تی پی کشف جیلبریک را خودکار می کنند. GCG حملات جفت مبتنی بر گرادیانت را اجرا می کند. حملات چند نوبت و کد سوئیچ از حافظه عامل بهره برداری می کنند. هر LLM در حال استفاده نیاز به یک گروه قرمز دارد.

شما یک برنامه هدف را سخت می کنید (یا یک مدل 8B با تنظیم دستورالعمل یا یکی از چتبات های RAG از سنگ های دیگر) ، 6 + خانواده حمله را علیه آن اجرا کنید و اندازه گیری قبل / بعد از بی ضرر را تولید کنید.

## مفهوم

خط خط ایمنی پنج لایه است.**Input sanitize**: خال خال های صفر عرض، رمزگذاری پایه64/rot13، استاندارد کردن یونیکوید. **Policy layer**: رایل های NeMo Guardrails v0.12 (خارج از دامنه، سمی، استخراج PII) **Classifier gate**: Llama Guard 4 در ورودی، X-Guard در غیر انگلیسی، ShieldGemma-2 در ورودی تصویر. **Model**: هدف LLM. **Output filter**: Llama Guard 4 در تولید، Presidio PII scrub، اجرای درخواست در صورت لزوم. **HITL tier**: خروجی که با ریسک بالا مشخص شده به صف Slack می روند.

دامنه تیم قرمز بر روی یک برنامه ریزی کننده اجرا می شود. PAIR و TAP به طور مستقل جیل بریک ها را کشف می کنند. GCG حملات جفت مبتنی بر گرادیانت را اجرا می کند. ASCII / base64 / rot13 رمزگذاری حملات. حملات چند نوبت (استفاده از حافظه، استفاده از حافظه). حملات کد سوئیچ (به انگلیسی با سواحیلی یا تایلندی مخلوط شده است). هر اجرا یک فایل یافته های ساختاری با امتیاز CVSS و جدول زمانی افشای تولید می کند.

اجرای خود انتقادات قانون اساسی یک مداخله زمانی آموزش است. 1k از درخواست های تلاش های مضر را بگیرید، مدل را به یک پاسخ طراحی کنید، آن را در برابر قانون اساسی نوشته شده (قواعد آسیب رساندن) انتقاد کنید و در حلقه انتقاد تمرین کنید. دلتای قبل / بعد از بی ضرر را در یک ارزیابی انجام شده اندازه گیری کنید.

## معماری

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## دسته

- طبقه بندی کننده های ایمنی: Llama Guard 4، ShieldGemma 2، NVIDIA Nemotron 3 Content Safety، X-Guard
- چارچوب Guardrail: NeMo Guardrails v0.12 + OPA
- راننده های تیم قرمز: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- عوامل فرار از زندان: PAIR (Chao و همکارانش، 2023) ، درخت حمله (TAP) ، ضمیمه GCG
- آموزش قانون اساسی: حلقه انتقاد از خود به سبک انسان شناسی + SFT در انتقاد
- "پریسیو"
- هدف: یک مدل 8B با تنظیم دستورالعمل یا یکی از چت های RAG دیگر Capstone

```figure
cf-safety-stack
```

## آن را بسازید

1. **Target setup.**یک مدل 8B با تنظیم دستورالعمل در vLLM ایجاد کنید (یا یک چتbot RAG را از سنگ آخر دیگر استفاده کنید). این برنامه در حال آزمایش است.

2. **Safety pipeline wrap.**خط لوله پنج لایه را در اطراف هدف سیم بزنید. بررسی کنید که هر لایه به طور جداگانه قابل مشاهده است (سطح در هر لایه در Langfuse).

3. **Classifier coverage.**باردار کردن Llama Guard 4، X-Guard ( چندزبان) ، ShieldGemma-2 (تصویر) هر یک را روی یک مجموعه کوچک با برچسب اجرا کنید تا خطوط پایه را تعیین کنید.

4. **Red-team scheduler.**برنامه گراک، پي آر آي تي، مامور پي آر، مامور تپ، يه راننده گگ سي، يه مهاجم چند دور و يه مهاجم سوئيچ کد هرکدوم در صف جداگانه اجرا ميشن

5. **Attack suite.**شش خانواده حمله: (1) jailbreak خودکار PAIR، (2) درخت حمله TAP، (3) جفت گرادینت GCG، (4) کدگذاری ASCII / base64 / rot13, (5) شخصیت چند نوبت، (6) سوئیچ کد چند زبانی. نرخ موفقیت در هر خانواده را گزارش کنید.

6. **Constitutional self-critique.**یک منتقد LLM با یک قانون اساسی نوشته شده (به عنوان "هیچ ضرر نکنید"، "دليل ها را نقل کنید"، "طلبات غیرقانونی را رد کنید") امتیاز می دهد. به هر یک از آن ها، هدف یک پاسخ را تهیه می کند. یک منتقد LLM با یک قانون اساسی نوشته شده ("هیچ ضرر نکنید"، "دليل ها را نقل کنید"، "تغییر از درخواست های غیرقانونی") امتیاز می دهد. به هر یک از آن ها، هدف از نظر دقیق در جفت های بهبود یافته از انتقاد، تغییر می کند. قبل از / پس از بی ضرر در یک ارزیابی انجام شده اندازه گیری می کند.

7. **Over-refusal measurement.**میزان مثبت دروغین را در یک مجموعه پاسخ های خفیف (به عنوان مثال، XSTest) ردیابی کنید. هدف باید در سوالات خفیف مفید بماند.

8. **CVSS scoring.**برای هر jailbreak موفق، امتیاز در CVSS 4.0 (وکتور حمله، پیچیدگی، تاثیر) تهیه کنید. یک جدول زمانی افشا و برنامه کاهش.

9. **Range automation.**همه چیز بالا روی یک کرون اجرا می شود؛ یافته ها به یک ردیف می نویسند؛ بازگشت بیش از حد رد هشدار آتش به Slack.

## ازش استفاده کن

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## -باده

`outputs/skill-safety-harness.md`یک خط خط ایمنی لایه ای در درجه تولید و یک خط قرمز بازتولید پذیر با دلتا قبل از و بعد از بی ضرر.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## تمرینات

1. افزونه Garak را برای تزریق فوری در یک چت بات RAG اجرا کنید و نرخ موفقیت حمله را با و بدون لایه فیلتر خروجی مقایسه کنید.

2. يه خانواده هفتم حمله اضافه کن: تزريق ناڅاپي از طریق اسناد بازيافت شده. اندازه گیری دفاعي زيادي مورد نياز.

3. حالت "رفض با کمک" را اجرا کنید: هنگامی که رایل محافظ مسدود می شود، هدف به جای رد صاف، پاسخ مرتبط ایمن تری را ارائه می دهد.

4. شکاف پوشش چند زبانی: یک زبان را پیدا کنید که X-Guard عملکرد کمتری داشته باشد. مجموعه داده های دقیق را برای آن پیشنهاد دهید.

5. خودکتابی اساسی را با مدل 30B اجرا کنید و اندازه گیری کنید که آیا دلتا مقیاس است.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## خواندن بیشتر

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) زمان آموزش
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) طبقه بندی ورودی/خروجی 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) تصویر + ایمنی چند مودالی
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) مرجع شرکت
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) امنیت چند زبانی 132 زبان
- [garak](https://github.com/NVIDIA/garak) ابزارک NVIDIA Red Team
- [PyRIT](https://github.com/Azure/PyRIT) چارچوب تیم قرمز مایکروسافت
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) چارچوب راه آهن
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) کاغذ مامور فرار از زندان
