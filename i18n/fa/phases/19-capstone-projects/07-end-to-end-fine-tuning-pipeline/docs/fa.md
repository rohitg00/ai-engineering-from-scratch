# Capstone 07  خط لوله تنظیم دقیق از پایان تا پایان (داده به SFT به DPO برای خدمت)

> مدل کلاس 8B که بر اساس اطلاعات شما آموزش داده شده، DPO بر اساس ترجیحات شما هماهنگ شده، کوانتيز شده، مفروضات رمزنگاري شده و در توکن های قابل اندازه گیری $/1M خدمت شده است. دسته باز 2026 Axolotl v0.8، TRL 0.15، Unsloth برای تکرار، GPTQ / AWQ / GGUF برای کوانتایی، vLLM 0.7 با EAGLE-3 برای خدمت است. هدف این است که کل خط لوله را به صورت قابل بازیافت اجرا کند (YAML در، نقطه پایان خدمت شده) و یک کارت مدل را تحت چارچوب باز بودن مدل 2026 منتشر کند.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## مشکل

هر تیم هوش مصنوعی جدی در سال 2026 یک خط لوله ای را در حال تنظیم است. نه به این دلیل که آنها یک مدل پایه مرزی را ارسال می کنند، بلکه به این دلیل که تطبیق پایین تر دامنه SFT، DPO با اولویت های برچسب گذاری شده، طرح های مستقیم برای رمزگذاری حدس زده، با EAGLE-3  خدمت می کنند جایی است که برندهای قابل اندازه گیری زندگی می کنند. Axolotl v0.8 کنترل کنفیگری های SFT چند GPU را انجام می دهد. TRL 0.15 DPO و GRPO را اداره می کند. اونسلوث به شما سرعت تکرار واحد GPU می دهد. vLLM 0.7 با EAGLE-3 باعث کاهش سرعت کد گذاری 2-3x بدون از دست دادن کیفیت می شود. ابزار کار می کند؛ صنایع در YAML ها، بهداشت داده ها و نظم ارزیابی است.

شما یک 8B تا 14B پایه (Llama 3.1 8B، Qwen3 14B، یا Gemma 3 12B) را از طریق SFT اجرا خواهید کرد سپس DPO را بر روی داده های خاص وظیفه، مقداری برای ارائه، و اندازه گیری سود در برابر lm- ارزیابی-harness، RewardBench-2, MT-Bench-v2 و MMLU-Pro اجرا خواهید کرد. شما یک کارت مدل را تحت چارچوب بازخودی مدل 2026 تولید خواهید کرد. نکته تکرار پذیری است: یک فرمان تمام لوله را از پایان به آخر تکرار می کند.

## مفهوم

خط لوله پنج مرحله داره**Data**: dedup (MinHash / Datatrove), فیلتر کیفیت (نمیوترون-CC سبک طبقه بندی کننده), PII scrub, تقسیم بهداشت کنترل در برابر آلودگی معیار عمومی. **SFT**: اکسلوتل یامل، زرو-3 در 8xH100، جدول کوسین، دنباله های بسته، دو تا دو دوره. **DPO or GRPO**: تنظیم TRL، 1 دوره، زوج های ترجیح یا به عنوان برچسب انسانی یا مدل قضاوت، تنظیم بتا. **Quantize**: GPTQ + AWQ + GGUF برای انعطاف پذیری در راه اندازی. **Serve**: vLLM 0.7 با EAGLE-3 سر spekulative (یا SGLang با SpecForge) ، K8s نشریات، HPA در صف انتظار.

ابلاسیون ها قابل تحویل هستند: SFT- فقط در مقابل SFT + DPO در برابر SFT + GRPO در سه معیار خاص وظیفه. معیار های خدمت: توکن / s در دسته 1 / 8 / 32, نرخ پذیرش EAGLE-3 ، توکن های $ / 1M. ارزیابی ایمنی: Llama Guard 4 نرخ عبور. مدل کارت: ارزیابی تعصب ، دانه های قابل بازیافت ، مجوز داده.

## معماری

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## دسته

- داده ها: داتاستروو برای کوری، طبقه بندی کننده Nemotron-CC برای کیفیت، Presidio برای PII
- پایه: Llama 3.1 8B، Qwen3 14B، یا Gemma 3 12B
- SFT: Axolotl v0.8 با ZeRO-3, Flash Attention 3, دنباله های بسته بندی شده
- تنظیمات ترجیحی: TRL 0.15 برای DPO یا GRPO؛ Unsloth برای تکرار یک GPU
- کمی: GPTQ (مارلین) ، AWQ، GGUF از طریق llama.cpp
- سرویس: vLLM 0.7 با کدگذاری اسپکولی EAGLE-3 (یا SGLang 0.4 + SpecForge)
- Eval: lm-evaluation-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro
- ارزیابی ایمنی: Llama Guard 4، ShieldGemma-2
- زیرساخت: Kubernetes + NVIDIA Plugin دستگاه، HPA در ردیف انتظار متریک
- قابل مشاهده: W&B برای آموزش، Langfuse برای نتیجه گیری

```figure
ce-finetune-stages
```

## آن را بسازید

1. **Data pipeline.**در مورد "دایتروو" در "کاپوس خام" کار کنید، طبقه بندی کننده کیفیت به سبک "نیموترون-سی سی" را اعمال کنید، "پریسیو" را پاک کنید، "پریسیو" را پاک کنید، "ترین/وال" را با "سیوم" صریح بنویسید.

2. **Contamination check.**برای هر تقسیم اعتبار، MinHash را با MMLU-Pro، MT-Bench-v2، RewardBench-2 تست کنید. هر تعاونی را رد کنید.

3. **Axolotl SFT.**يامل با زرو-3، FA3، بسته بندی تسلسل، 2-3 دوره در 8xH100، وارد W&B شو

4. **TRL DPO / GRPO.**از نقطه کنترل SFT استفاده کنید، یک دوره DPO را در جفت های اولویت اجرا کنید (یا GRPO با پاداش قابل تأیید در ریاضیات / کد).

5. **Quantize.**تولید سه کوانت: GPTQ-INT4-Marlin، AWQ-INT4, GGUF-Q4_K_M برای llama.cpp. اندازه ثبت و تولید نامی.

6. **Serve with speculative decoding.**vLLM 0.7 با EAGLE-3 سرپرست های طرح آموزش دیده از طریق Red Hat Speculators. میزان پذیرش و تاخیر دم در دسته 1 / 8 / 32. گزارش $/1M توکن در مقابل انسان / OpenAI در همان ارزیابی.

7. **Eval matrix.**باز کردن lm-eval-harness، RewardBench-2, MT-Bench-v2, MMLU-Pro در پایه، فقط SFT-DPO، SFT+GRPO. ایجاد یک جدول.

8. **Safety eval.**سرعت عبور لاما گارد 4 در مجموعه توسعه دهنده . فیلتر خروجی ShieldGemma-2

9. **Model card.**مدل MOF 2026: بخش داده ها، آموزش، ارزیابی، ایمنی، مجوز، قابلیت بازیافت با YAML ها و SHAs متعهد.

## ازش استفاده کن

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## -باده

`outputs/skill-finetuning-pipeline.md`یک فرمان واحد داده ها را از طریق SFT از طریق DPO از طریق quant از طریق serve از طریق eval اجرا می کند و یک کارت مدل + نقطه پایان خدمت شده را ارسال می کند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## تمرینات

1. فقط SFT-SFT + DPO + SFT + GRPO را در همان معیار خاص وظیفه اجرا کنید. گزارش دهید که کدام روش ترجیح برنده است و چقدر.

2. لاما 3.1 8B رو با Qwen3 14B عوض کن. توکن 1 میلیون دلار رو با کیفیت مشابه اندازه بگيري.

3. میزان پذیرش EAGLE-3 را در داده های دامنه در مقابل ShareGPT عمومی اندازه گیری کنید. گزارش دلتا و معنی آن برای بودجه های تاخیر.

4. 1- درصد آلودگی را تزریق کنید (پاسخ های MMLU-Pro را به داده های آموزش افشای کنید) و ارزیابی را تکرار کنید. دقت MMLU-Pro را بی واقعیت ببینید. یک دروازه کنترل آلودگی ایجاد کنید که این را ضبط کند.

5. به عنوان جایگزین کامل تنظیم دقیق SFT LoRA اضافه کنید. شکاف کیفیت را در حافظه 10 برابر کمتر اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## خواندن بیشتر

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) آموزش دهنده SFT / DPO مرجع
- [TRL documentation](https://huggingface.co/docs/trl) اجرای مرجع DPO و GRPO
- [Unsloth](https://github.com/unslothai/unsloth) مرجع تکرار یک GPU
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) روش GRPO
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) تکه خدمت مرجع
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) آموزش دهنده ی جایگزین برای رمزگذاری یابی
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): استاندارد طبقه بندی آزاد
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) رنده ی ارزیابی کنونی
