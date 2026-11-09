# مهارات العملاء: العقد المحمول وحدود الوقت

> المهارة ليست عرضًا طويلًا مع اسم ملف أفضل. إنها حزمة قابلة للاكتشاف من التعليمات والموارد ومساعدات قابلة للتنفيذ تدخل سياق الوكيل من خلال عقد تشغيل.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## أهداف التعلم

- تعريف مهارة العميل دون الخلط بينها مع عرض، أو تعليمات مخزن، أو أداة، أو خطوة، أو سوباجنت، أو مضخة.
- اقرأ الهاتف المحمول`SKILL.md`العقد والفصل عنه من تمديدات محددة للوقت التشغيل.
- شرح اكتشاف، واختيار، تنشيط، تحميل الموارد، استخدام الأدوات، والتحقق كمرحلة دورة الحياة المختلفة.
- تأكيد حزمة مهارات قبل أن يضعها في كتالوج العميل
- اختر بين مهارة، أداة MCP، خطوة، سوباجنت، أو رمز عادي لمهمة محددة.

## نجاح أول عشر دقائق

افعل هذا قبل التفسير الطويل. سوف تخلق مهارة صغيرة،
المراجعة الكاملة حزمة في عامل حقيقي مضيف، استدعاء ذلك، التحقق من
هذا يثبت دورة الحياة مع نتيجة قابل للملاحظة.

### قبل الرحلة إلى مختبر المضيف الحقيقي

نقطة التفتيش الحقيقية تستلزم Node.js،`npx`، بايثون 3 ، واحد مختار
المضيف المهني، وكتب الوصول إلى المشروع أو نطاق المستخدم الذي تختاره
التحقق من الأوامر المحلية أولاً:

```bash
node --version
npx --version
python3 --version
```

قرر أي مضيف وسطح ستستخدم قبل التثبيت.
لا توجد متطلبات، اقرأ هذا الدروس على الموقع أو استمر في
التمرينات اليدوية تحت. هذا التراجع يعلم العقد، ولكن
لا يثبت اكتشاف المضيف أو الدعوة أو تنفيذ النص المجمّع، أو
إزالة السلوك، إبق تلك الملاحظات علامة في انتظار

### 1. ابدأ في دليل عمل فارغ

إشغال هذه الأوامر من أي دليل أولي حيث تستمر في تعلم العمل:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

يجب أن لا تقوم بالطباعة أي شيء إذا كانت تقوم بطبع الملفات، اختر
دليل فارغ حتى المراجعة لديها حدود واضحة.

إعداد دليل لمهاراتك الأولى:

```bash
mkdir -p my-first-skill
```

إخلق`my-first-skill/SKILL.md`مع هذا المحتوى:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

التحقق من إنشاء الملف في المجلد المقصود:

```bash
test -f my-first-skill/SKILL.md
```

لا وجود رمز الخروج والخروج 0 يعني وجود الملف.

### 2. قم بتثبيت مجموعة المراجعة الكاملة

ابق في الداخل`agent-skills-first-run`و أطلق:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

اختر عامل المضيف والطاق الذي تستخدمه. يجب على الجهاز التثبيت إدراج
`skill-contract-reviewer`والمكان الذي كتبته`--full-depth`هو
المطلوبة لأن مهارة هذا الدروس هي حزمة مستوى مع المراجع،
السيناريو، ومتلك.

المجموعة`SKILL_ROOT`إلى المجلد المطلق الذي أبلغ عنه المثبت.
أن يكون الإرشاد الذي يحتوي على المثبت `SKILL.md`ليس مصدر الدروس
الإداري وليس مساحة العمل الحالية:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

إذا كانت جلسة العميل مفتوحة بالفعل، بدء جلسة جديدة أو استخدام ذلك المضيف
لا تفترض أن كل مضيف يقوم بإعادة تحميل قائمه

### 3. استدعاءها صراحة

في الوكيل المثبت، مع `agent-skills-first-run`كعمل
الإرشادات، استخدام النصوص التي يدعمها هذا المضيف:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

استخدم القيم المطلقة المطبوعة ل `SKILL_ROOT`و`TARGET_ROOT`في
طلب. اطلب من المضيف لتوسيعها قبل تنفيذها وتظهر بالضبط
أمر حل، وليس أمر يعتمد على دليل العمل العملي:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

يجب أن يكون للقيادة المحلّلة هذا الشكل، دون أيّة حجزات متبقية:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

النتيجة الناجحة لها كل الخصائص الثلاثة:

1. المضيف يجد`skill-contract-reviewer`باسمها
2. يقرأ المراجع العقد الحزمي ويقوم بتشغيل مؤكدة المجموعة.
3. يحتوي الإجابة على تقرير تأكيد بدون خطأ هيكلي للاتصالات
   العينة، بالإضافة إلى اختيار بدائي مبرر.

يجب أن تكون أدلة الإجراء أيضاً اسم مسار النص، مسار الهدف،
وكتور الحجج، و رمز الخروج. تقرير متسريع دون هذه الحقول لا
إثبات أن النص المكون من المرافق المثبت كان يعمل

إذا أبلغ المضيف أن المهارة غير متوفرة، تحقق من التثبيت
المقصود، إعادة مسح أو إعادة تشغيل مرة واحدة، ومحاولة أخرى الطلب الصريح.
إعادة كتابة وصف المهارات لإخفاء فشل التثبيت.

### 4. اختيار ضمني للنقش

ابدأ دوراً جديداً من العملاء و أدخل نفس المهمة دون تسمية المهارة:

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

إذا كشف المضيف مهارات مختارة، سجّل ما إذا كان قد اختار
`skill-contract-reviewer`إذا لم يظهر المضيف التوجيه، قم بتشخيص ضمني
الادعاء الصريح هو الرد الخلفي المحمول

### 5. نظف

إزالة فقط حزمة المراجعة المثبتة:

```bash
npx skills remove skill-contract-reviewer
```

اختر نفس المضيف والطاق المستخدم أثناء التثبيت. بعد إعادة مسح أو إعادة تشغيل
جلسة، طلب صريح ل`skill-contract-reviewer`يجب أن يبلغ عن
لا يمكن الحصول عليها`my-first-skill`في الدروس اللاحقة، أو إزالة
دليل المختبر بعد أن تنتهي من المسار

## المشكلة

لنفترض أن فريقك لديه سير عمل إصدار موثوق به. يجد التغييرات المدمجة، ويتحقق من ملاحظات الهجرة، ويحديث سجل التغييرات، ويقوم بتشغيل أمر التعبئة، ويحقق قائمة مراجعة.

وضع هذا التدفق العمل في عرض واحد يجعل من السهل التلصق وصعوبة التشغيل. لا يوجد في عرض الهوية المستقرة، لا قاعدة اكتشاف، لا حدود الموارد، لا شكل حزمة قابلة للتحقق، ولا يوجد إجابة على الأسئلة الأساسية: من يمكنه استدعائها؟ متى يجب على النموذج اختيارها؟ أي نصوص يمكن تشغيلها؟ أي ملفات يمكن الوثوق بها؟ ما الذي يبقى عندما يتم ضغط السياق؟

الخطأ المعاكس هو التعامل مع كل تعليم قابل لإعادة الاستخدام كمهارة. اتفاقيات مخزن، التلقائية التحكمية، الأدوات الخارجية، خطط الحدث، والوكلاء المفوضين تحل المشاكل المختلفة.`SKILL.md`ينتج دليل يبدو محمولاً بينما يعتمد على سلوك مضيف واحد غير مُوثق.

أول مهمة هندسية هي التصنيف، تحديد ما هو الفن قبل أن تقرر كيفية إغلاقه.

## المفهوم

### المهارات التي ترمز المعرفة الإجرائية

مهارة العميل هو دليل نقطة دخولها هي`SKILL.md`. يحتوي ملف الإدخال على المادة الأمامية YAML تليها تعليمات Markdown. يمكن أن يحتوي الإدراج أيضًا على مرجعيات وسكرتات وأصول.

```figure
skill-package-anatomy
```

الإرشادية، وليس ملف ماركداون وحده، هي الوحدة القابلة للتنفيذ.`SKILL.md`مع إشارات مفقودة هي حزمة مكسورة حتى لو تم تحليل المواد الأمامية.

### الامتزاجات المجاورة

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

يمكن لمهارة الإفراج أن تخبر العميل كيف يفتش الإفراج. يمكن لمخادم MCP كشف سجل الإفراج. يمكن أن يحظر القفز المباشر. يمكن للقائد التحكم بشكل مستقل في المرشح. هذه الأجزاء تتكون لأنها تحتفظ بمسؤوليات مختلفة.

### كلمة "مهارة" تعني أفكار مختلفة

في بعض الأحيان تُطلق أنظمة البحث على برنامج تعلم، أو مسار ناجح، أو قطعة سياسة محددة للبيئة مهارة. يمكن للعميل إنشاء هذه الأثاث أثناء الاستكشاف، واستردادها حسب شبيهة المهام، وتنفيذها، وتحديث المكتبة من المراجعة. مرحلة 14 · 10 تبني هذا النوع من مكتبة التعلم على مدى الحياة.

مهارة العميل في هذه المسار الصغير مختلفة. إنها حزمة مصممة مع عقد نظام الملفات المعلن ، وتفشي البيانات المعدنية ، والكشف التدريجي ، والدعوة المتوسطة في الوقت التشغيلي ، والأدوات التي يتم التحكم بها من قبل المضيف. يمكن إنشاؤها أو تحسينها من قبل العميل ، ولكن لا يتطلب التعلم للصيغة.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

كلاهما يحتوي على كفاءة قابلة للاستعمال بشكل متكرر.

### النواة المحمولة

تطلب مواصفات مهارات العميل حقلين من المواد الاولى:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`هو المعرف المستقر. يجب أن يلبي قواعد الإسم المحدد ويتطابق مع دليل الأم. `description`هو كل من الوثائق والبيانات المتحولية. يجب أن يقول ما تقوم به المهارة ومتى تطبق.

الحقول الاختيارية الحقول هي:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

يحتوي جهاز ماركداون على تعليمات التشغيل. يجب أن يحدد تدفق العمل، نقاط القرار، سلوك الفشل، والطرق المباشرة إلى الموارد الداعمة.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### تمديدات الوقت التشغيلي هي طبقة ثانية

بعض المضيفين يقبلون إضافية المواد الأمامية أو تكوين المرفق. يمكن أن تكون هذه الحقول مفيدة، لكنها ليست محمولة تلقائيًا.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

تعامل كل امتداد كإعداد. حافظ على سير العمل الأساسي صالحًا دون ذلك ، وثيقة الخلف ، واختبار المضيف الذي يستهلكه. قد يتجاهل وقت تشغيل حقلًا مجهولًا ، أو يرفضه ، أو يحفظه دون تنفيذ السلوك.

### المادة الأمامية هي البيانات المعدنية القابلة للتنفيذ

البيانات المعدنية تغير سلوك النظام قبل قراءة جسم المهارات.

- -أصيب بالشكل الخطأ`name`يمكن أن تجعل الاكتشاف يفشل
- غامض`description`يمكن أن يتوجه طلبات خاطئة.
- علم بشري فقط يمكن أن يزيل المهارة من كتالوج النموذج.
- إمكانية استخدام الأدوات تغير ما إذا كان المضيف يطلب الإذن.
- إعداد السياق يمكن أن تحرك التنفيذ إلى جلسة عامل منفصلة.

مراجعة المادة الأمامية مثل رمز التكوين. تأكيدها، نسخها، وإدراج سلوكها في تقييمات.

### دورة حياة المهارات

```figure
skill-runtime-lifecycle
```

كل سهم هو حدود مع وضع الفشل الخاص به.

1. **Discovery**يجد حزم محتملة في مواقع محددة.
2. **Validation**يرفض الحزم المعاصرة أو غير الآمنة قبل نشر الكتالوج.
3. **Cataloging**يظهر الوصف`name`و`description`ليس الحزمة الكاملة
4. **Selection**يقرر ما إذا كانت المهارة ذات صلة.
5. **Activation**يضع الجسم في سياق مرئي للنموذج.
6. **Disclosure**يقرأ الإشارات أو الأصول فقط عندما يطلبها فرع.
7. **Execution**يستخدم أدوات المضيف بموجب قواعد الإذن والعزل من المضيف.
8. **Verification**يختبر الفن المنتج بشكل مستقل عن ادعاء النموذج.

إن انهيار هذه المراحل يسبب نماذج عقلية سيئة. المهارة المكتشفة غير نشطة. المهارة النشطة غير مصرح بها للقيام بكل ما وصفه. دعوة أداة مسموح بها ليست دليلا على صحة النتيجة.

### المهارات والأدوات متناغمة

يجيب MCP: "ما هي القدرات التي يمكن لهذا التطبيق أن يستدعيها، وما هي مخططاتها؟" يجيب المهارة، "كيف ينبغي على وكيل التوجه إلى هذه الفئة من المهام؟"

```figure
skill-tool-orthogonality
```

قد تسمي المهارة أداة، ولكن المضيف يمتلك سجل القدرات الفعلية. إذا كانت الأداة غائبة، يجب أن تشير المهارة إلى عكس أو فشل بوضوح. يجب ألا يعني ذلك أبداً أن تسمية القدرة تخلقها.

### المهارات و تعليمات المخبز هي نطاق مختلف

تعليمات مخزن تصف البيئة التي تكون فيها بالفعل: الأوامر والاتفاقيات والملفات المولدة والحدود. تمنح مهارة إجراءات قابلة للاستعمال مرة أخرى لمهمة قد تحدث عبر العديد من مخزنات.

عندما ينطبق كلا الأمرين، فإن طلب المستخدم النشط وقواعد المخبز يحد من المهارة. لا يجب أن تتجاوز مهارة إعادة التصنيف العامة قاعدة المخبز التي تحظر تحرير الملفات المولدة.

### المهارات لا تستورد بعضها البعض

يمكن أن تُوجّه مهارة واحدة العميل إلى استدعاء أخرى، ولكن هذه ليست استيراد على مستوى اللغة. المهارة الثانية لا تزال تمر عبر اكتشاف الوقت التشغيلي، والإجابة، والتنشيط، والإذن، ومعالجة السياق.

اكتب الاعتمادات المتعددة المهارات على حواف سير العمل الملاحظ:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

هذا يجعل الاعتماد قابلاً للتحقق منه ويمنح المضيف فرصة لتنفيذ السياسة.

## بناءها

`code/main.py`يطبق مؤكداً صغيراً موجهاً نحو المعايير ومختار الأدوات. يبقى stdlib فقط حتى تكون كل قاعدة مرئية.

المحقق يظهر:

- `parse_frontmatter(text)`لفرق البيانات المعدنية عن الجسم.
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`للتحقق من الحقول المطلوبة، والإسم، والإمدادات غير المعروفة، وموجودة الجسم، والحدود المحمولة.
- `ValidationIssue`و`SkillReport`لإرجاع الأدلة المهيكلة بدلاً من البولية غير الشفافة.
- `FrontmatterSyntaxError`للمدخول الذي لا يمكن تفسيره بأمان.

الاختيار يُكشف`TaskShape`و`select_primitives(task)`. يخطط احتياجات المهمة إلى الرمز العادي، أو تعليمات مخزن، أو مهارة، أو خطوة، أو جهاز تحكم، أو أداة MCP.

إدير المختبر

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

هذا الحظر يتطلب نسخة محلية ويجب أن تبدأ من أي مكان في الداخل
ذلك النموذج كذلك`git rev-parse --show-toplevel`يمكن أن تحل جذور المخبأ

يقوم المشاهد الطباعة JSON لمهارة محمولة واحدة صالحة، مهارة مضيفة واحدة مُوسعة، حزمة واحدة غير صالحة، وعدة قرارات شكل المهام. تحقق من رموز المسألة. يجب أن يشرح مؤكد الحزمة كيفية إصلاح عنصر أثري دون تخمين نيابة عن المؤلف.

### أمر التحقق من المصادقة

تأكيد الحقائق الهيكلية الرخيصة قبل قواعد المحتوى العميقة:

```figure
skill-validation-order
```

هذا النظام يمنع الأخطاء الثانوية من إخفاء أول ناقص محطم.

## استخدمها

قبل كتابة مهارة، املأ هذه البطاقة القرارية:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

العديد من عمليات الإنتاج تستخدم أكثر من سطر واحد. بطاقة منع أحد الأدوات من التظاهر بتوفير كل خاصية.

## أرسله

هذا الدرس يخلق`skill-contract-reviewer`الحزمة تحت `outputs/`. يحتوي على:

- محمول`SKILL.md`التي تعيد مراجعة حزمة مهارات المقترحة؛
- قوائم التحقق المرجعية للعقد المحمول والانتخاب الأولي.
- نص التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق.
- أجهزة تشكيل المهام تغطي الإشارات والمهارات والأدوات والكوك والرقم العادي والسوابق.

قم بتثبيت الحزمة الكاملة، وليس فقط ملفها:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

ويقول المثبت عن كل مهارة في المرحلة 13
`/tmp/aiefs-skills/manifest.json`هذه الوجهة النظيفة تحقق من شكل الحزمة
حلقة النجاح الأول أعلاه تحقق اكتشاف ودعوة في مضيف حقيقي.

الدروس التالية تعزز كل مرحلة من مراحل دورة الحياة. الدروس 24 تبني اكتشاف وتفشي تدريجي. الدروس 25 تبني سياسة الدعوة والتوجه. الدروس 26 تفصل الإذنات عن الرمل. الدروس 27 تحويل الحزمة بأكملها إلى عنصر إطلاق تقييم.

## التمارين

1. تصنف خمس عمليات عمل من فريقك الخاص باستخدام `TaskShape`الدفاع عن كل حالة حيث تختار أكثر من واحد بدائي.
2. إضافة اختبارات الحدود التي تثبت أن 500 حرف `compatibility`يمر القيمة ويتعطل قيمة 501 حرفًا كخطأ في التفاصيل.
3. إضافة إضافة إضافة واحدة لفترة تشغيل إلى قائمة السماح. اكتب اختبار يثبت أن نفس الملف لا يزال مميزا عن مهارة المحمول فقط.
4. تقسيم خط 400 إلى `SKILL.md`إشارة واحدة، عقد نص واحد، وشكل خروج واحد. إبق كل ملف مسؤولا عن نوع واحد من المعلومات.
5. تصميم استجابة فشل لمهارة تشير إلى أداة MCP غير متوفرة. لا تحل محل أداة بصمت بإذنات أوسع.
6. مراجعة مهارة موجودة وتسمية كل جملة على أنها طريق، الإجراء، السياسة، مؤشر مرجع، أو عقد الخروج.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## المزيد من القراءة

- [Agent Skills specification](https://agentskills.io/specification)للديريكتوريا المحمولة وعقد المادة الأمامية.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)لقطاع النطاق والإرشادات وتنظيم الموارد.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)لسياسة اكتشاف و استدعاء القوانين الحالية.
- [Claude Code skills](https://code.claude.com/docs/en/skills)لفترة تشغيل واحدة من الدعوة والحجة والوسيلة والإضافات الموحدة للسياق.
