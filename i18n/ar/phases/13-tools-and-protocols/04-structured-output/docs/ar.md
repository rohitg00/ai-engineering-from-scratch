# إنتاج مهيكل  مخطط JSON، Pydantic، Zod، تشفير القيود المحدود

> "اطلب من النموذج أن يعيد JSON بشكل جيد" يفشل 5 إلى 15 في المائة من الوقت، حتى على النماذج الحدودية. تغطي المخرجات المهيكلة هذا الفجوة مع فك القيود المحدود: يتم منع النموذج حرفيا من إصدار رمز يعرقل النموذج. وضع OpenAI الصارم، استخدام أداة النموذج النموذجية من Anthropic، Gemini `responseSchema`، الذكاء الاصطناعي البيانتيكي `output_type`، و (زود)`.parse`هذه الدروس تبني مؤكدة النظام والتي سيتم استخدامها من قبل المتعلمين في النظام الصارم للأنبوب الاستخراجية الإنتاجية.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## أهداف التعلم

- اكتب مخطط JSON 2020-12 لهدف الاستخراج باستخدام القيود الصحيحة (enum، min/max، مطلوب، نمط).
- شرح لماذا الوضع الصارم وتشخيص القيود المحدود يمنح ضمانات مختلفة عن "الصلاحية بعد الجيل".
- تمييز بين ثلاثة أنماط الفشل: خطأ التحليل، انتهاك النظام، رفض النموذج.
- إرسال خط أنابيب استخراج مع إصلاح المطبوعة ومعالجة رفض المطبوعة.

## المشكلة

وكيل يقرأ رسالة البريد الإلكتروني عن طلب الشراء يحتاج إلى تحويل النص الحر إلى`{customer, line_items, total_usd}`ثلاثة مقاربات

**Approach one: prompt for JSON.**"رد في JSON مع الحقول العميل، line_items، total_usd. " يعمل 85 إلى 95 في المائة من الوقت على نماذج الحدود. يفشل في ست طرق: الإطار المفقود، العطف المتأخر، الأنواع الخطأ، الحقول الهلوسة، قصف في حد رمز، تسرب النص مثل "هنا JSON:".

**Approach two: validate after generation.**إنشاء بحرية، تحليل، التحقق من الصلاحية ضد النظام، تجربة أخرى على الفشل. موثوق بها ولكن مكلفة  تدفع مقابل كل تجربة أخرى، والخطأ التقطيع تكلفة دور واحد إضافي لكل حدوث.

**Approach three: constrained decoding.**يقوم المقدم بتفريغ النظام في وقت فك الرمز. يتم إخفاء الرموز غير الصالحة من توزيع العينات. يتم ضمان تحليل الخروج وتأكيد التحقق. ينهي الإفشل إلى وضع واحد: الرفض (يقرر النموذج أن المدخل لا يناسب النظام).

كل مزود حدودي في عام 2026 يرسل نوعاً ما من النهج الثالث

- **OpenAI.** `response_format: {type: "json_schema", strict: true}`بالإضافة`refusal`في الاستجابة إذا كان النموذج ينخفض.
- **Anthropic.**تنفيذ الخطة`tool_use`المدخلات`stop_reason: "refusal"`ليس شيئاً، لكن`end_turn`بدون نداء أداة هو الإشارة.
- **Gemini.** `responseSchema`على مستوى الطلب، في عام 2026، تقوم شركة Gemini بإرسال قيود لغوية على مستوى الرمزية للأنواع المختارة.
- **Pydantic AI.** `output_type=InvoiceModel`يُصدّر إصدارًا منظمًا`RunResult`يتم كتابته إلى`InvoiceModel`. . .
- **Zod (TypeScript).**محلل الوقت التشغيلي الذي يؤكد إصدار المقدم ضد مخطط Zod؛ يزدوج مع OpenAI `beta.chat.completions.parse`. . .

الخيط المشترك: إعلان النظام مرة واحدة، نفذها من نهايتها إلى النهاية.

## المفهوم

### خطة JSON 2020-12  اللغة الفرنسية

يقبل كل مزود JSON Schema 2020-12. البنائم التي تستخدمها أكثر:

- `type`: واحد من`object`،`array`،`string`،`number`،`integer`،`boolean`،`null`. . .
- `properties`: خريطة اسم المجال إلى المخطط الفرعي.
- `required`: قائمة بأسماء الحقول التي يجب أن تظهر.
- `enum`: مجموعة مغلقة من القيم المسموح بها.
- `minimum`- لا ، لا`maximum`(أرقام) ،`minLength`- لا ، لا`maxLength`- لا ، لا`pattern`(الخطوط)
- `items`: النظام الفرعي المطبق على كل عنصر صف.
- `additionalProperties`: `false`يحظر حقل إضافية (تختلف الافتراضات حسب النظام).

وضع OpenAI الصارم يضيف ثلاثة متطلبات: يجب أن يتم سرد كل ممتلكات في `required`،`additionalProperties: false`في كل مكان، ولا يوجد شيء غير حل`$ref`إذا كسرت هذه، فإن API يعيد 400 في وقت الطلب.

### (بايدانتيك) ، الارتباط بـ (بايتون)

بيدانتيك v2 توليد مخطط JSON من نماذج على شكل فئة بيانات عبر `model_json_schema()`الذكاء الاصطناعي البيدانتيكي يلف هذا بحيث تكتب:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

و إطار الوكيل يترجم النظام إلى وضع OpenAI الصارم ، الأنثروبيك `input_schema`أو التوأم`responseSchema`في الحافة. إنتاج النموذج يعود كمنطبخ`Invoice`إثبات الأخطاء في التحقق`ValidationError`مع مسارات الخطأ المكتوبة.

### زود، التماسة من نوع النص

(Zod)`z.object({customer: z.string(), ...})`) هو ما يعادل TS. يكتشف SDK Node من OpenAI `zodResponseFormat(Invoice)`والتي تنقل إلى عبء نظام JSON من API.

### الرفض

النظام الصارم لا يمكن إجبار النموذج على الإجابة. إذا لم تتناسب المدخلات مع النموذج ("كان البريد الإلكتروني قصيدة وليس فاتورة") ، فإن النموذج ينبعث `refusal`يجب أن يعالج رمزك هذا الأمر كنتيجة من الدرجة الأولى، وليس فشلا. الرفض مفيد أيضاً كإشارة سلامة: ماثلة طلبت استخراج رقم بطاقة ائتمان من بريد إلكتروني محمي يعود رفض مع سبب السلامة المرفق.

### التشفير المحدود في المجال المفتوح

تنفيذات الوزن المفتوحة تستخدم ثلاثة تقنيات.

1. **Grammar-based decoding**(`outlines`،`guidance`،`lm-format-enforcer`): بناء آليات محددة تحديدية من النظام؛ في كل خطوة، غطاء اللوجيتات من الرموز التي من شأنها أن تنتهك FSM.
2. **Logit masking with a JSON parser**: تشغيل محلل JSON التدفق في خطوة مقفلة مع النموذج؛ في كل خطوة، حساب مجموعة الوهم الصالح-القادم.
3. **Speculative decoding with a verifier**: النموذج الرخيص مشروع يقدم الرموز، والتحقق ينفذ النظام.

يختار مقدمو المعلومات التجارية واحدة من هذه الخدمات خلف الكواليس. إن حالة الفن في عام 2026 أسرع من التوليد العادي للمنتجات المهيكلة القصيرة والسرعة نفسها تقريباً للمنتجات الطويلة.

### أساليب الفشل الثلاثة

1. **Parse error.**إنتاج لا يعد JSON صالحاً. لا يمكن أن يحدث في وضع صارم. لا يزال يمكن أن يحدث على مزودي غير صارمين.
2. **Schema violation.**الناتج يُحلل لكنه ينتهك النظام لا يمكن أن يحدث تحت وضع صارم
3. **Refusal.**النموذج ينحدر يجب التعامل معه كنتيجة منخفضة

### إستراتيجية إعادة المحاولة

عندما تكون خارج وضع الصارم (استخدام أدوات الأنثروبية، غير صارم OpenAI، التوأم القديم) ، نمط الاسترداد هو:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

عادة ما يكون محاولة إعادة واحدة كافية. ثلاث محاولات إعادة تسجل شرائح نموذج ضعيفة. ما يزيد عن ثلاثة هو علامة على مخطط سيء: لا يمكن أن يرضيه النموذج لبعض المدخلات، ويجب إصلاح المطلب أو مخطط.

### دعم النموذج الصغير

يعمل التشفير المقيّد على نماذج صغيرة. النموذج المفتوح ذو المعلم 3B مع فرض القواعد اللغوية يفوق النموذج ذو المعلم 70B مع التحفيز الخام على المهام المهيكلة. هذا هو السبب الرئيسي الذي يجعل المخرجات المهيكلة مهمة في الإنتاج: إنه يفصل الموثوقية عن حجم النموذج.

```figure
constrained-decoding
```

## استخدمها

`code/main.py`يرسل مؤكداً أدنى من JSON Schema 2020-12 في stdlib (أنواع، مطلوبة، enum، min/max، نمط، عناصر، خصائص إضافية).`Invoice`النتائج المزيفة من خلال المحقق، والتي تظهر خطأ الفحوص، وانتهاك النتائج، والسلك الرفض.

ما الذي يجب أن ننظر إليه:

- المحقق يعيد المخطط `[ValidationError]`قائمة مع المسار والرسالة. هذا هو الشكل الذي تريد أن يظهر على طلب محاولة إعادة.
- فروع الرفض لا تحاول مرة أخرى. إنها تسجل وتعطي الرفض المكتوب. المرحلة 14 · 09 تستخدم الرفض كإشارة سلامة.
- - نعم`additionalProperties: false`تحقق من حرائق على مدخل الاختبار المتعارض، مع إظهار سبب إغلاق الوضع الصارم الباب على الحقول الهلوسة.

## أرسله

هذا الدرس يُنتج`outputs/skill-structured-output-designer.md`. بالنظر إلى هدف استخراج النص الحر (فواتير وتذاكر الدعم والإستيرة الذاتية، إلخ) ، تنتج المهارة مخطط JSON 2020-12 الذي يتوافق مع الوضع الصارم ونموذج Pydantic الذي يعكس ذلك، مع رفض النمط ومحاولة التعامل مرة أخرى.

## التمارين

1. أركض`code/main.py`إضافة حالة اختبار رابع`total_usd`هو رقم سلبي. تأكد من أن المؤكد يرفضها مع `minimum`مسار القيود

2. تمديد المحقق للتأييد `oneOf`مع مميز.`line_item`هو إما منتج أو خدمة، ويتم وضع علامة على `kind`. وضع الصارم لديه قواعد دقيقة هنا؛ تحقق من دليل الخروج المهيكلي OpenAI.

3. اكتب نفس مخطط الفاتورة مثل Pydantic BaseModel ومقارنة `model_json_schema()`تحديد مجموعة Pydantic من الحقل واحد افتراضيًا التي يتم إغلاقها في الإصدار المتحرك يدويًا.

4. قياس معدلات الرفض. قم ببناء عشرة مدخلات لا ينبغي استخراجها (أغنية غنية، دليل رياضي، بريد إلكتروني فارغ) ومررها عبر مزود حقيقي مع وضع صارم. احسب الرفض مقابل الخروج الهلوسة. هذه هي الحقيقة الأساسية لك إعادة الرفض.

5. اقرأ دليل الخروج المهيكل من OpenAI من أعلى إلى أسفل. حدد البناء الذي يحظر صراحة في وضع صارم يسمح به مخطط JSON البسيط. ثم صمم مخطط يستخدم البناء المحظور غير جوهري ويعيد تعديله لتكون متوافقة صارمة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "The schema spec" | IETF-draft schema dialect every modern provider speaks |
| Strict mode | "Guaranteed schema" | OpenAI flag that enforces schema via constrained decoding |
| Constrained decoding | "Logit masking" | Decode-time enforcement that masks invalid next-tokens |
| Refusal | "Model declines" | Typed outcome when input cannot fit the schema |
| Parse error | "Invalid JSON" | Output did not parse as JSON; impossible under strict |
| Schema violation | "Wrong shape" | Parsed but violated types / required / enum / range |
| `additionalProperties: false` | "No extras allowed" | Forbids unknown fields; required in OpenAI strict |
| Pydantic BaseModel | "Typed output" | Python class that emits and validates JSON Schema |
| Zod schema | "TypeScript output type" | TS runtime schema for provider output validation |
| Grammar enforcement | "Open-weights constrained decode" | FSM-based logit masking, as in outlines / guidance |

## المزيد من القراءة

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) وضع صارم، رفضات، ومتطلبات النظام
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) أغسطس 2024 بعد إطلاق تشرح ضمان فك الكشف
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) التزامات النوع output_type المخطوطة التي تتسلسل إلى كل مزود
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) المواصفات القنونية
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) ملاحظات تنفيذ المؤسسات والتحذيرات الصارمة
