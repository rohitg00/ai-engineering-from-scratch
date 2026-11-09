# المهارات والمسار

> الإستدعاء هو قرار سلطة يلي قرار ملاءمة. وصف جيد يساعد النموذج على اختيار؛ سياسة جيدة تقرر ما إذا كان هذا الاختيار مسموح به.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## أهداف التعلم

- تمييز بين دعوة المستخدم الصريحة، دعوة النموذج الضمني، دعوة التطبيق، ودعوة المهارات إلى المهارات.
- نموذج المرونة البشرية ونموذج المؤهلات كبعالم السياسة المستقلة.
- اكتب وصفات التوجيه مع محفزات إيجابية وحدود القريبة من الإغلاق.
- التأهل المفصل، والانتقاء، والتنشيط، والربط للجدل، والتنفيذ في المسارات والاختبارات.
- تعديل حقل الدعوة المحددة للوقت التشغيلي دون تقديمها كمواد محمولة.

## المشكلة

تقوم بتثبيت`database-migration`المهارة. يمكن للمستخدم تشغيلها باسمها، ولكن النموذج يرى أيضًا وصفها ويختارها عندما يطرح شخص ما سؤال قاعدة البيانات العامة. ثم تقترح المهارة تغيير مخطط لمهمة تحتاج فقط إلى تفسير.

أنت تضيف`user-invocable: false`في وقت آخر من التشغيل، يتم تجاهل هذا الحقل.`disable-model-invocation: true`في الوقت الذي يفهمه، لا يزال المستخدم يستطيع استدعائه صراحة.

لا يوجد شيء خاطئ في أسماء الحقول. النموذج خاطئ. "يمكن للمستخدم رؤيته،" "يمكن لنموذج تحديده،" "يمكن للتطبيق تحميلها مسبقا،" و"الأدوات داخلها يمكن تنفيذها" هي حقائق منفصلة.`invocable`لا يمكن أن تعبر عنهم

التوجيه له وضع فشل ثان. إذا كانت الوصفات غامضة، تصبح العديد من المهارات معقولة. إذا تمت ملء الوصفات بالكلمات الرئيسية، فإن المهام غير ذات الصلة تثيرها. الكاتالوج هو واجهة محتملة: ضيقة بما فيه الكفاية للاستيعاب، محددة بما فيه الكفاية لالتوجيه.

## المفهوم

### خمسة قنوات يمكن أن تبدأ دورة الحياة

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

تحدد مواصفات Agent Skills المحمولة الحزمة. لا تحدد واجهة اتصال إدارة أوامر عالمية واحدة ، أو راية توجيه ضمنية ، أو API التطبيق ، أو دورة حياة السباق.

### مراحل الدعوة الخمسة

```figure
skill-invocation-stages
```

استخدم هذه الكلمات بدقة:

- **Eligible**يعني أن السياسة تسمح لهذه الفاعلة بطلب المهارة
- **Selected**يعني أن المستخدم قد سميه أو أن جهاز توجيه رأى أنه ذو صلة.
- **Activated**يعني إدخال تعليماتها في سياق العمل.
- **Executing**يعني أن الوكيل بدأ العمل على النموذج أو الأداة بموجب تلك التعليمات.
- **Completed**يعني أن المخرج قد اجتازت عملية التحقق المستقل من نجاحها.

- أثر يسجل فقط`skill_used=true`يختبئ الحدود حيث حدث فشل.

### الصفحة البشرية والنموذج تشكل ماتريك 2x2

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

المصفوفة هي نموذج سياسية، وليس YAML القياسية.

مستخدمات مضيف واحدة حالية `disable-model-invocation: true`للصف الوحيد للإنسان و`user-invocable: false`للسلسلة النموذج فقط. الافتراضي هو كليهما. مضيف آخر يستخدم `agents/openai.yaml`مع`allow_implicit_invocation: false`ليحافظ على الدعوة الصريحة مع تعطيل الاختيار الضمني. هذه هي مُعدلات وقت التشغيل. قد يتجاهلها مضيفون مجهولون.

التفاصيل المربكة مهمة:`user-invocable: false`لا يعني "لا يمكن أن يستخدم النموذج هذا". إنه يزيل الدعوة المستخدمية المباشرة في المضيف الذي يحددها. `disable-model-invocation: true`لا يعني "تم تعطيل المهارة". إنه يزيل اختيار النموذج المبدع مع الحفاظ على الوصول الصريح للمستخدم.

### الدعوة الصريحة هي الهوية أولاً

الدعوة الصريحة توفر الهوية مباشرة:

```text
/release-readiness v2.4.0
```

أو:

```text
release-readiness check v2.4.0 without publishing
```

الوثيقة الحالية لـ Codex Interfaces `/skills`للاختيار وسميات المهارات العادية في طلبات الدعوة الصريحة.`/skill-name`وتوسيع الحجج المحددة للمضيف. السينتاج الدقيق، وضوح القائمة، قواعد الاستشهاد، وتوسيع المتغيرات تنتمي إلى المضيف.

لا يزال الطلب الصريح يمر بالسياسة. لا ينبغي أن تتجاوز تسمية مهارة الإذنات المفقودة أو قيود مساحة العمل أو بوابات الموافقة أو عزل في الوقت التشغيل.

### الدعوة الضمنية هي وصف أولا

بالنسبة للتوجيه الضمني، يرى النموذج في البداية بيانات الكتالوجية بدلاً من الجسم الكامل. وبالتالي فإن الوصف هو واجهة التوجيه للمهارة.

ضعيف:

```yaml
description: Helps with releases.
```

واسعة جداً

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

المحدود:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

الإصدار المحدود يحتوي على:

1. **Capability:**تفتيش المرشح المعد
2. **Output:**تقرير الاستعداد
3. **Positive boundary:**يسأل إن كان القطع الأثرية جاهزة.
4. **Negative boundary:**إن البناء والتنمية العادية خارج نطاقه

الحدود السلبية مفيدة عندما تتشارك مهارات قريبة من بعضها المفردات.

### التوجيه هو تصنيف مع خيار الامتناع عن التوجيه

من أجل مهارة`s`وطلب`x`، تخيل درجة الموجّه:

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

قد يكون الدرجة الدقيقة قرارًا لدرجة الماجستير بدلاً من الرياضيات. لا يزال مبدأ الهندسة ينطبق: يجب أن يتجاوز اختيار عتبة ومهارة تنافسية. عندما تكون الأدلة ضعيفة ، فلتمتنع.

```figure
skill-routing-abstention
```

بالنسبة للمهارات ذات التأثير العالي، قد يكون التوجيه ضمني غير مناسب حتى مع وصف قوي. استخدم سياسة الإنسان فقط عندما تتجاوز تكلفة الإيجابية الكاذبة ملاءمة الاختيار الآلي.

### يجب أن تكون المؤهلات مسبقة التصنيف

لا تسجل كل مهارة اكتشفتها، اختر أقوى مباراة، وتحقق من سياسة واحدة من المهارات بعد ذلك. المباراة المحظورة أعلى بشكل خاطئ من شأنه منع المرشح المؤهل من أقل درجة من النظر.

استخدم هذا النظام للتوجيه الضمني:

1. الفلتر اكتشف مهارات من قبل الفاعل الطلبي و المضيف النشط المعدل.
2. تسجيل فقط المرشحين المؤهلين.
3. اختر أقوى مباراة مؤهلة إذا تمكنت من تطبيق قواعد العد والغموض.
4. الامتناع عن التدريب عندما لا يكون أي مرشح مؤهلاً أو لا تكون النتيجة المؤهلة قوية بما فيه الكفاية.

لنفترض`incident-triage`النتائج`0.80`لكن تمديد المضيف يعطى النموذج دعوة. `incident-review`النتائج`0.55`و يسمح بإدعاء النموذج يجب أن يقوم الجهاز التوجيه بتقييم`incident-review`كأفضل مرشح مؤهل.`incident-triage`، إنكر ذلك و توقف

هذا التسلسل يحافظ أيضا على تغييرات السياسة من تغيير معنى درجة الصلة. المؤهلية تعريف مجموعة الاختيار. الصلة تصنيف تلك المجموعة.

### احتاج تقييمات التوجيه الى خسائر قريبة

الحالات الإيجابية تثبت الإستدعاء:

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

السلبيات الواضحة تثبت دقة أساسية:

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

التخلفات القريبة تعرض جودة الحدود:

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

القريبة من أسهم الفاتحة`package`و`build`مع مهارة الإفراج ولكن ينتمي إلى مكان آخر. مجموعة توجيه مصنوعة فقط من إيجابيات واضحة وغير مرتبطة السلبيات سوف تتجاوز الجودة.

### الحجج لديها ثلاثة تمثيلات

حجة الدعوة تتجاوز عدة حدود:

```figure
skill-argument-boundaries
```

في كل حدود، الحفاظ على النية دون التعامل مع النص كرمز.

- يقرر المصفح المضيف نحو القواعد والنقوش.
- تحصل المهارة على نص أو متغيرات مرتبطة وفقاً لقواعد المضيف.
- التعليمات تؤكد القيم المطلوبة والإعدادات الافتراضية.
- تُحويل دعوة الأداة القيم إلى مخطط منخفض وتجديد صلاحيتها.

لا تتقاطع الحجج الخام في أوامر الغلاف. تفضل النص المطلوب باستخدام متجه الحجج أو أداة MCP المكتوبة.

### دعوة التطبيق هي التنسيق الصريح

يمكن لمنتج أن ينشط مهارة لأن سير عمله يعرف نوع المهمة بالفعل. على سبيل المثال، يمكن لخدمة مراجعة طلبات التقط قدماً`pull-request-risk-review`بعد أن يضغط المستخدم على مراجعة.

هذا يزيل عدم اليقين في التوجيه لكنه يخلق اعتماد على API في الوقت التشغيل. ابق هذا المعدل خارج الجسم المحمول:

```figure
skill-host-adapter
```

يجب أن تظل المهارة قابلة للتفاهم عندما يفتحها عميل متوافق مختلف.

### دعوة المهارات إلى المهارات هي حافة مثل الأداة

لنفترض`release-readiness`يطلب`security-change-review`عندما تغيرت ملفات الاعتماد

يجب على المتصل أن يقدم:

- الهوية المهنية المستهدفة
- مسارات مهمة ومصنوعات محددة
- عقد الاستجابة المتوقع
- سبب الدعوة
- إعاقة إذا لم تكن متاحة.
- قاعدة أعمق أو دورة أقصى.

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

لا يتم لصق المهارة الثانية بشكل أعمى في الأولى. يقرر المضيف كيفية تفعيلها وما إذا كانت تشارك السياق ، أو تشغيل في شوكة ، أو تعود من خلال نتيجة أداة.

### دورة حياة السياق محددة للضيف

بعد تنشيطها، قد يبقى جسم المهارات في المحادثة، أو يتم تلخيصه أثناء الضغط، أو يتم تشغيله في سياق مُنحَل. قد تستمر إمكانيات الأدوات دورًا واحدًا بينما تستمر التعليمات لفترة أطول. قد يتلقى المهارة دون تاريخ الوالد بأكمله.

لا تكتب مهارة تعتمد على افتراض حياة غير مرئية. ضع نتائج دائمة في الملفات أو حالة المخطوطة، وجعل إعادة الدخول آمنة، وتحديد ما يجب إعادة تحمله بعد الانقطاع.

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## بناءها

`code/main.py`تنفيذ السياسة والتوجه كمتكيفين منفصلين.

يتضمن النموذج:

- `Actor`للاتصال بالبشر، النموذج، الوكيل المستقل، التطبيق، المهارة، والحركة؛
- `SkillMetadata`لتحديد هوية التوجيه
- `InvocationPolicy`بالنسبة للمصفوفة البشرية/النموذجية
- `InvocationRequest`و`InvocationDecision`للدخل والنتائج التي يمكن تتبعها
- `CorePolicyAdapter`للسلوك المحمول بدون تمديدات مضيف؛
- `ExtensionPolicyAdapter`في مجالات الوقت الزمني المعترف بها
- `build_invocation_matrix(policy)`للنظر 2x2
- `route_request(skills, request, adapter)`لتحذير الأهلية قبل تصنيف الصلة والانتخاب والرفض.

إشغله

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

يطبخ المشاهد المصفوفة واحدا وقرارات للنموذج البشري المفصّل والخاطئ والوكيل المستقل والتطبيق والمهارات والتركيب و قنوات الاستخدام. تظهر نتائج التوسع-المعدل إزالة المقابلة الكسرية العليا المحجوبة قبل تصنيف بديل مؤهل. كما يتضمن قائمة الأسماء الدقيقة. لا توجد حاجة إلى نموذج API. يوجد جهاز توجيه التحديد لجعل حدود السياسة قابلة للتفتيش، وليس للازعاج بأن المطابقة اللكسيكية تعيد توجيه نموذج الإنتاج.

### لماذا مُعدّلات الأساس والإمدادات منفصلة

إذا كان أحد المتحللين يعطي معنى لكل حقل المواد الأمامية الملاحظة، فإنه يروج بصمت اتفاقيات الوقت التشغيلي إلى معيار مزيف.

- نعم`CorePolicyAdapter`يستخدم فقط السياسة المقدمة عن طريق الطلب.`ExtensionPolicyAdapter`يدرك مجموعة صريحة من الحقول المضيفة والسجلات التي غيرت الحقل القرار.

## استخدمها

اكتب عقد الدعوة قبل نشر مهارة:

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

هذا العقد هو وثيقة تصميم للمكيفات والاختبارات.`SKILL.md`المادة المباشرة ما لم يقررها معيار صريحا.

## أرسله

هذا الدرس يخلق`skill-invocation-router`يحتوي على مرجع نموذج الدعوة ، وسياسة مضيف مثالية ، و CLI غير تنفيذية تقيم بشري واحد ، نموذج ، وكيل مستقل ، تطبيق ، تركيب مهارات ، أو طلب الاستخدام وتعويض قرار JSON مع القناة ، والتكيف ، والنقطة ، والسبب.

إن CLI بمطالبة واحدة هو مسح سياسة وليس تقييم كامل. استخدم التصميم الإيجابي والقريب من الإغفال المسمى في الدروس 27 لحساب أعداد الخلط والدقة والإستدعاء والاستقرار المتكرر.

## التمارين

1. قم بإنشاء كل أربعة صفوف من المصفوفة البشرية/النموذجية وكتب حالة استخدام مشروعة لكل منها.
2. إضافة تفعيل التطبيقات فقط إلى `CorePolicyAdapter`إثبات أن المُتصلين البشريين والنموذجيين لا يزالون مستحرمين
3. اكتب عشر نقاط قريباً من التخطيط لمهارة التنفيذ. يجب على كل طلب مشاركة المفردات مع المهارة بينما ينتمي إلى سير عمل مختلف.
4. إضافة هامش لغموض بين أفضل اثنين من نقاط التوجيه.`ask`عندما تكون الحافة صغيرة جداً
5. إضافة أعمق قدر أقصى من التركيب إلى طلبات المهارات إلى المهارات واكتشاف دورة المهارات الثنائية.
6. إشغال نفس مجموعة الملصقات عبر مُعدات الأساس والإضافة، و شرح كل قرار تغيّر.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## المزيد من القراءة

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)لتحقيق المحفزات الإيجابية، والحدد، والقيام بتقييم.
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)لتصميم التشغيل والإخراج.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)للسيطرة الصريحة والعاطفة على الدعوة الحالية في المخطط.
- [Claude Code skills](https://code.claude.com/docs/en/skills)لضيف واحد `user-invocable`،`disable-model-invocation`، والحجج، والسياق المفوض.
