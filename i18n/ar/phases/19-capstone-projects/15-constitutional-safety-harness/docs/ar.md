# الحجر الرئيسي 15  حزمة السلامة الدستورية + مجموعة فريق الأحمر

> حددت المصفوفات الدستورية لشركة الأنثروبيك، و"ميتا لاما غارد 4"، و"جوجل شيلد جيما 2"، و"نيموترون 3" من شركة NVIDIA، و"إكس غارد" للتغطية متعددة اللغات، كومة تصنيفات السلامة لعام 2026. أصبحت Garak، PyRIT، NVIDIA Aegis، و promptfoo أدوات تقييم المعارضة القياسية. نيمو غاردريلز v0.12 يربطهم في خط إنتاج هذه الحجر الرئيسي يجمع كل شيء معاً: حزمة أمن طبقاتية حول تطبيق هدف، وكيل فريق أحمر مستقل يعمل على 6 أسرة هجوم، ومركز تقرير النفس الدستوري الذي ينتج دلتا الأضرار القاسية.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## المشكلة

الحدود من سلامة ماجستير في مجال القانون في عام 2026 ليست ما إذا كانت المصنفة تعمل (فهي تعمل، تقريبا) ولكن كيفية تكوينها بشكل صحيح حول تطبيق الإنتاج دون رفض مفرط أو ترك ثقوب واضحة. حرس (إلاما) الرابع يتعامل مع الانتهاكات الإنجليزية إكس-غارد (132 لغة) تتعامل مع jailbreak متعددة اللغات. (ShieldGemma-2) يلتقط حقن سريع على أساس الصورة. NVIDIA Nemotron 3 سلامة المحتوى تغطي فئات المؤسسات. المصفوفات الدستورية لـ Anthropic هي نهج منفصل يستخدم أثناء التدريب بدلاً من الخدمة.

تطور الهجوم مهم أيضًا. PAIR و TAP تُتلقّن اكتشاف jailbreak. GCG تعمل على هجمات الإثرات القائمة على التراجع. هجمات التحول المتعدد والتحول الرمزي تستغل ذاكرة العميل. أي LLM ينشر يحتاج إلى مجموعة فريق حمراء  garak و PyRIT هي الدفعيات القنونية  بالإضافة إلى التخفيفات الموثقة والنتائج التي تسجل CVSS.

ستقوم بتحديد تطبيق الهدف (إما نموذج 8B المنسق مع التعليمات أو أحد أجهزة الدردشة RAG من الحجر الرئيسي الآخر) ، وتشغيل 6 عائلات هجوم ضد ذلك، وتحقيق قياس قبل / بعد الأضرار.

## المفهوم

خط الأنابيب الأمني هو خمسة طبقات.**Input sanitize**: خريط الرسومات ذات الواسعة الصفرية، فك رمز الأساس64/مصدر13، وتطبيع يونيكود. **Policy layer**: سكة حديد NeMo Guardrails v0.12 (خارج المجال، السموم، استخراج PII). **Classifier gate**: حرس إلاما 4 على المدخلات، حرس إكس على غير الإنجليزية، ShieldGemma-2 على المدخلات الصورة. **Model**: الدرجة القانونية المستهدفة. **Output filter**: حرس لاما 4 على الخروج، إزالة Presidio PII، إنفاذ الإستشهاد عند الاقتضاء. **HITL tier**: الخروج التي تمت علامة عالية المخاطر تذهب إلى صف Slack.

يدير مجموعة الفريق الأحمر على جهاز جدولة. يكتشف PAIR و TAP بشكل مستقل عمليات jailbreak. يقوم GCG بتشغيل هجمات الإثر القائمة على التراجع. هجمات تشفير ASCII / base64 / rot13. هجمات متعددة التحولات (تبني الشخصية ، استغلال الذاكرة). هجمات تبديل الشفرة (مختلطة باللغة الإنجليزية مع السواحلية أو التايلاندية). تنتج كل عملية تشغيل ملفًا مهيكليًا للملاحظات مع تسجيل CVSS وتفشي جدول زمني.

إنّ عملية النقد الذاتي الدستوري هي تدريب وقت التدخل. خذ 1k محاولة إيذاء، وجعل النموذج يصمم ردًا، وانتقده ضد دستور مكتوب (قواعد عدم إيذاء) ، وإعادة تدريب على حلقة النقد. قياس دلتا الأضرار قبل / بعد على تقييم مدته.

## الهندسة المعمارية

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

## الـ"كثيرة"

- تصنيفات السلامة: Llama Guard 4، ShieldGemma 2، NVIDIA Nemotron 3 سلامة المحتوى، X-Guard
- إطار الحراسة: NeMo Guardrails v0.12 + OPA
- برامج تشغيل الفريق الأحمر: garak (NVIDIA) ، PyRIT (Microsoft Azure) ، NVIDIA Aegis ، promptfoo
- وكلاء الهروب من السجن: PAIR (Chao et al., 2023) ، شجرة الهجمات (TAP) ، جججججج
- التدريب الدستوري: حلقة النقد الذاتي على النمط الأنثروبي + SFT على النقد
- (مصدر المعلومات)
- الهدف: نموذج 8B المنسق إلى التعليمات أو أحد أجهزة الدردشة RAG الأخرى

```figure
cf-safety-stack
```

## بناءها

1. **Target setup.**قم بتصميم نموذج 8B المنسق مع التعليمات على vLLM (أو إعادة استخدام راج دردشة من آخر حجر رأس). هذا هو التطبيق قيد الاختبار.

2. **Safety pipeline wrap.**سلك خط الأنابيب الخمس طبقات حول الهدف. التحقق من أن كل طبقة يمكن ملاحظتها بشكل فردي (التدفق لكل طبقة في Langfuse).

3. **Classifier coverage.**شحن حارس لاما 4، حارس إكس (متعددة اللغات) ، ShieldGemma-2 (الصورة). تشغيل كل على مجموعة صغيرة مع علامة لتحديد خطوط أساس.

4. **Red-team scheduler.**الموعد غراك، بيرايت، عميل PAIR، عميل TAP، ج.سي.جي.ج، مهاجم متعدد التحولات، ومهاجم مبدل الرمز.

5. **Attack suite.**ست أسرة من الهجمات: (1) PAIR التلقائي jailbreak، (2) TAP شجرة الهجمات، (3) GCG تراجع التالي، (4) ASCII / base64 / rot13 تشفير، (5) شخصية متعددة التحولات، (6) متعددة اللغات رمز-التبديل.

6. **Constitutional self-critique.**إدارة 1k محاولات الضرر. لكل منها، يخطط الهدف للرد. يحصل ماجستير في التدريس المنتقد على درجات ضد دستور مكتوب ("لا تضر"، "استشهد الأدلة،" "رفض الطلبات غير القانونية"). يحصل على محاولات إعادة كتابة الأشياء النقدية؛ يضبط الهدف على الأزواج المتحسنة من النقد. يقيّم قبل / بعد الأضرار في تقييم مستمر.

7. **Over-refusal measurement.**تتبع معدل الإيجابيات الخاطئة على مجموعة الاستعلامات الخيرية (مثل XSTest). يجب أن يبقى الهدف مفيدًا في الأسئلة الخيرية.

8. **CVSS scoring.**لكل عملية اختراق السجن الناجحة، قم بتسجيل CVSS 4.0 (متجه الهجوم، التعقيد، التأثير). قم بتحديد جدول زمني للإفصاح وخطة التخفيف.

9. **Range automation.**كل شيء أعلاه يعمل على cron؛ النتائج تكتب إلى صف؛ الرجعة الإرهاقية المفرطة تنبيهات النار إلى Slack.

## استخدمها

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## أرسله

`outputs/skill-safety-harness.md`هو المنتج. خط أنابيب السلامة المطبقة على مستوى الإنتاج بالإضافة إلى مجموعة حمراء قابلة للتكرار مع دلتا قبل / بعد الأضرار.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## التمارين

1. تشغيل مضخة Garak لحقن الإستعلام على متن الرواية RAG ومقارنة معدل نجاح الهجوم مع و بدون طبقة الصفحات المخرجة.

2. إضافة عائلة الهجوم السابع: الحقن الفوري غير المباشر عبر الوثائق المكتسبة. قياس الدفاع الإضافي المطلوب.

3. تنفيذ وضع "رفض مع المساعدة": عندما يُغلق الحائط، يقدم الهدف إجابة ذات صلة أكثر أمانًا بدلاً من رفض مسطح.

4. فجوة التغطية متعددة اللغات: العثور على لغة لا تعمل بشكل جيد فيها X-Guard. اقترح مجموعة بيانات دقيقة تستهدفها.

5. إجر النقد الذاتي الدستوري على نموذج 30B وقاس ما إذا كانت النطاقات الدلتا.

## الشروط الرئيسية

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

## المزيد من القراءة

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) إشارة وقت التدريب
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) تصنيف المدخل/المخرج لعام 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) الصورة + السلامة متعددة الطرق
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) إشارة للشركات
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) سلامة متعددة اللغات في 132 لغة
- [garak](https://github.com/NVIDIA/garak)مجموعة أدوات فريق NVIDIA
- [PyRIT](https://github.com/Azure/PyRIT) إطار فريق Microsoft الأحمر
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/)الإطار السكك الحديدي
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) ورقة عميل الهروب
