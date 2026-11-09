# الحجر الرئيسي 07  خط أنابيب التنسيق الدقيق من النهاية إلى النهاية (بيانات إلى SFT إلى DPO لخدمة)

> نموذج من فئة 8B تدرب على بياناتك الخاصة، DPO-موافق على تفضيلاتك الخاصة، كمية، تشفير المضاربة، وتخدم في القياس $ / مليون رموز. كومة مفتوحة 2026 هي Axolotl v0.8 ، TRL 0.15 ، Unsloth للتكرار ، GPTQ / AWQ / GGUF للتقييم الكمي ، vLLM 0.7 مع EAGLE-3 للخدمة. الحجر النهائي هو تشغيل خط الأنابيب بأكمله بشكل قابل للتكرار (YAML في، خدمة نقطة نهاية خارج) ونشر بطاقة نموذجية في إطار افتتاح نموذج 2026.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## المشكلة

كل فريق من أفراد الذكاء الاصطناعي الجاد في عام 2026 يحافظ على خط أنابيب للتحسين على النفط. ليس لأنهم يرسلون نموذج أساسي الحدود، ولكن لأن التكيف أسفل التيار  النطاق SFT، DPO ضد التصفيات المعلقة، مسودات مستقلية لترشيح التكهنات، الخدمة مع EAGLE-3  هو حيث الفوز القابل للقياس يعيش. Axolotl v0.8 يتعامل مع تشكيلات SFT متعددة GPU. تRL 0.15 تتعامل مع DPO و GRPO. (أنسلوت) يمنحك إعادة التكرار بسرعة واحدة vLLM 0.7 مع EAGLE-3 يدفع إعادة تشكيل النتائج 2-3x دون فقدان الجودة. الأدوات تعمل، والحرف في YAMLs، نظافة البيانات، وتربية تقييم.

سوف تقوم بتشغيل قاعدة 8B إلى 14B (Llama 3.1 8B ، Qwen3 14B ، أو Gemma 3 12B) من خلال SFT ثم DPO على البيانات المحددة للمهام ، والكميات لتقديم ، ويقاس مكاسب ضد lm-value-harness ، RewardBench-2 ، MT-Bench-v2 ، وMMLU-Pro. سوف تنتج بطاقة نموذجية تحت إطار افتتاح نموذج 2026 . النقطة هي قابلية التنسيق: أمر واحد يكرر خط الأنابيب كله من نهايت إلى نهايت.

## المفهوم

خط الأنابيب لديه خمس مراحل**Data**: التخلص (MinHash / Datatrove) ، المرشح الجودة (مصنف نموترون-CC) ، مسح المعلومات المختلفة، التحقق من النظافة المزدوجة ضد التلوث العام. **SFT**: أكسولوتل يامل، زرو-3 على 8xH100، جدول كوسين، تسلسلات معبأة، 2-3 عصر. **DPO or GRPO**: تكوين TRL، 1 عصر، أزواج التفضيلات إما على علامة البشر أو القرار على النموذج، التنسيق البيتا. **Quantize**: GPTQ + AWQ + GGUF لمرونة الاستعمال. **Serve**: vLLM 0.7 مع EAGLE-3 رؤساء المضاربة (أو SGLang مع SpecForge) ، نشر K8s، HPA في انتظار الصف.

الإجراءات هي المنتجة: SFT- فقط مقابل SFT + DPO مقابل SFT + GRPO على ثلاثة معايير محددة للمهام. قياسات خدمة: الرموز / الثانية في المجموعة 1 / 8 / 32, معدل قبول EAGLE-3 ، الرموز $ / 1M. تقييم السلامة: Llama Guard 4 معدل عبور. بطاقة نموذج: تقييمات التحيز ، بذور قابلية التكاثر ، ترخيص البيانات.

## الهندسة المعمارية

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

## الـ"كثيرة"

- البيانات: بيانات لتحديد النسب، تصنيف Nemotron-CC للجودة، Presidio لجهاز إحصاءات متعددة الاستخدامات
- القاعدة: Llama 3.1 8B، Qwen3 14B، أو Gemma 3 12B
- SFT: Axolotl v0.8 مع ZeRO-3، فلاش انتباه 3، تسلسلات معبأة
- التنسيق المفضل: TRL 0.15 لـ DPO أو GRPO؛ Unsloth لـ إعادة التكرار من GPU واحد
- الكمية: GPTQ (مارلين) ، AWQ، GGUF عبر llama.cpp
- الخدمة: vLLM 0.7 مع فك EAGLE-3 التخمينات (أو SGLang 0.4 + SpecForge)
- Eval: lm-evaluation-harness، RewardBench-2، MT-Bench-v2، MMLU-Pro
- تقييم السلامة: حارس لامة 4، ShieldGemma-2
- البنية التحتية: Kubernetes + NVIDIA جهاز إضافة، HPA على المقياسات انتظار الصف
- الملاحظة: W&B للتدريب، Langfuse للإستنتاج

```figure
ce-finetune-stages
```

## بناءها

1. **Data pipeline.**إشغال بيانات التخفيض على الجسم الخام، تطبيق تصنيف الجودة نموترون-CC، Presidio scrubs PII، كتابة القطار / وال تقسيم مع بذرة صريحة.

2. **Contamination check.**لكل تقسيم للتحقق من التحقق من التحقق من التحقق من مادة (مين هاش) مقابل مجموعة اختبار (MMLU-Pro) و (MT-Bench-v2) و (RewardBench-2).

3. **Axolotl SFT.**يامل مع زرو 3، فاي 3، التسلسل التسلسل، 2-3 دورات على 8xH100.

4. **TRL DPO / GRPO.**خذ نقطة التفتيش SFT، تشغيل دور واحد من DPO على أزواج التفضيلات (أو GRPO مع مكافأة يمكن التحقق من الرياضيات / الرمز).

5. **Quantize.**إنتاج ثلاثة كوانت: GPTQ-INT4-Marlin، AWQ-INT4, GGUF-Q4_K_M للاما.cpp. حجم السجل والعبور الاسمي.

6. **Serve with speculative decoding.**vLLM 0.7 التكوين مع EAGLE-3 مسودة رؤساء تدرب عن طريق Red Hat Speculators. قياس معدل قبول وتأخير الذيل في المجموعة 1 / 8 / 32. تقرير $/1M رموز مقابل الأنثروبيك / OpenAI على نفس تقييم.

7. **Eval matrix.**تشغيل إم-إيفال-حربة، RewardBench-2, MT-Bench-v2, MMLU-Pro على القاعدة، SFT-وحدها، SFT+DPO، SFT+GRPO. إنتاج جدول.

8. **Safety eval.**إنّهُ يُمكنكَ أن تُحصل على معدل عبور (لاما غارد) 4 على مجموعة التطوير.

9. **Model card.**نموذج MOF 2026: البيانات والتدريب والتقييم والسلامة والترخيص والجزء من إعادة التأهيل مع YAMLs والشراكات المشتركة.

## استخدمها

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

## أرسله

`outputs/skill-finetuning-pipeline.md`يصف المنتج. أمر واحد يقوم بتشغيل البيانات من خلال SFT من خلال DPO من خلال quant من خلال serve من خلال eval ، ويعرض بطاقة نموذج + نقطة النهاية المقدم.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## التمارين

1. قم بتشغيل SFT-only مقابل SFT+DPO مقابل SFT+GRPO على نفس المعيار المرجعي المحدد للمهام. قم بتقرير طريقة التفضيل التي تفوز بكم.

2. تبادله بـ (إلاما 3.1 8 ب) مقابل (كوين 3 14 ب) وقاس رموز الدولارات الواحد مليون بجودة متطابقة

3. قياس معدل قبول EAGLE-3 على بيانات النطاق مقابل ShareGPT العامة. تقرير الدلتا وما يعنيه ل ميزانيات التأخير.

4. حقن 1% من التلوث (تسريب MMLU-Pro إجابات في بيانات التدريب) وإعادة تشغيل تقييم. مشاهدة MMLU-Pro الدقة قفز غير واقعي. بناء بوابة مراقبة التلوث CI التي تلتقط هذا.

5. إضافة LoRA SFT كبديل للتحديد الدقيق الكامل. قياس الفجوة الجودة عند 10 مرات أقل ذاكرة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## المزيد من القراءة

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) مدربة المرجعية لـ SFT / DPO
- [TRL documentation](https://huggingface.co/docs/trl)تنفيذات مرجعية لـ DPO و GRPO
- [Unsloth](https://github.com/unslothai/unsloth) إشارة إعادة التكرار لمجموعة واحدة من أجهزة البيانات
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) منهجية GRPO
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) كومة الخدمات المرجعية
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) مدرب بديل للكشف المضاربي
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): معيار تصنيف الإفراج المفتوح
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) متدرب تقييم تقييم
