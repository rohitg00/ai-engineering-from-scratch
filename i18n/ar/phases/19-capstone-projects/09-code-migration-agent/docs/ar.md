# كابستون 09  وكيل الهجرة الرمزية (لغة مستوى إعادة التأهيل / تحديث وقت التشغيل)

> أمازون MigrationBench (Java 8 إلى 17) وGoogle App Engine Py2-to-Py3 المهاجرين وضع 2026 بار. OpenRewrite Moderne يقوم بإعادة كتابة AST المحددة على نطاق واسع. غريت تستهدف نفس المشكلة مع نظام التشغيل النمطي (DSL). يجمع نمط الإنتاج بين كلتا: أساس تحديدي لإعادة كتابة آمنة بالإضافة إلى طبقة عاملة للقضايا الغامضة، وصندوق رمل لكل فروع، وسلطة اختبارية تتحول إلى خضراء قبل فتح PR. الحجر النهائي هو الهجرة 50 مقبض حقيقي ونشر معدل الانتقال مع تصنيف الفشل.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## المشكلة

الهجرة الكبيرة للرموز هي واحدة من أكثر التطبيقات تنظيفاً لإنتاج عوامل التشفير عام 2026. الحقيقة الأساسية واضحة (هل تمر مجموعة الاختبارات بعد الهجرة؟) ، والمكافآت حقيقية (هجرة أسطول جاوا-8 هي مشروع على نطاق عدد العاملين) ، والمعايير العامة (MigrationBench 50repo الفرعية). "مؤشر "مودرن" يدير الجانب الدستري الطبقة الوكيل تتعامل مع كل ما لا يمكن لوصفات OpenRewrite: إعادة الكتابة الغامضة، تدفق النظام البناء، النص المزمن طويل الذيل، كسر الاعتماد الانتقالي.

سوف تقوم ببناء وكيل يأخذ إعادة تأمين Java 8 (أو Python 2 repo) وينتج فرع هجرة CI خضراء. سوف تقيس معدل الانتقال، الحفاظ على تغطية الاختبار، وتكلفة كل إعادة تأمين، وبناء تصنيف الفشل.

## المفهوم

خط الأنابيب له طبقتان**deterministic substrate**(OpenRewrite لـ Java، libcst لـ Python) تعمل معظم إعادة الكتابة الميكانيكية بأمان: الاستيرادات، توقيعات الأساليب، تحديات الأمان الصفحية، محاولة مع الموارد، استبدال API القديمة. هو سريع ويؤدي إلى اختلافات قابلة للتدقيق.**agent layer**(OpenAI Agents SDK أو LangGraph over Claude Opus 4.7 و GPT-5.4-Codex) يتعامل مع الحالات التي لا تستطيع الوصفات: تحديثات ملفات بناء (Maven/Gradle/pyproject) ، صراعات الاعتماد الانتقالي، شرائح الاختبار، ملاحظات مخصصة.

كل إعادة تشغيل يحصل على صندوق رمل دايتونا مع وقت تشغيل الهدف مثبت مسبقا. يقوم الوكيل بتكرار: تشغيل البناء ، وتصنيف الفشل ، وتطبيق إصلاح ، وإعادة تشغيل. الحدود الصعبة: 30 دقيقة لكل إعادة تشغيل ، 8 دولارات لكل إعادة تشغيل ، 20 دورة وكيل. إذا اجتاز جميع الاختبارات وانخفض التغطية بأكثر من 2 نقاط مئوية ، فإن الفرع يفتح PR. وإلا ، يتم تسجيل الإعادة تشغيل تحت فئة الفشل مع أدلة.

تصنيف الفشل هو المنتج. عبر 50 إعادة، ما الذي مات؟ إعادة التعبيرات التحولية؟ ملاحظات مخصصة؟ إصدار أداة؟ اختبار الفقرات غير مرتبطة بالهجرة؟ كل فئة تحصل على عدد ومثالية اختلاف. يمكن للكاتب الوصفة المستقبلية استهداف ثلاثة أوائل.

## الهندسة المعمارية

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## الـ"كثيرة"

- الأساس القياسي: OpenRewrite (Java) أو libcst (Python)
- وكيل: OpenAI Agents SDK أو LangGraph على كلود أوبوس 4.7 + GPT-5.4-Codex
- صندوق الرمل: دايوتا ديف كونتينر لكل فرع، وقت تشغيل هدف مثبت مسبقًا (جاوا 17 / بايثون 3.12)
- أنظمة البناء: مافن، جريدل، uv (بايتون)
- المقاييس: Amazon MigrationBench 50 repo subset (Java 8 إلى 17) ، Google App Engine Py2-to-Py3 repos
- أسلحة الاختبار: متوازي الجري، تغطية عبر Jacoco (Java) أو تغطية.py (Python)
- الملاحظة: لنجفوز + قطعة تتبع لكل إعادة التأمين مع كل جزء مختلف
- لوحة التحكم: لوحة التحكم في التخلفات التشريعية مع العد لكل فئة والفروق النموذجية

```figure
ce-migration-funnel
```

## بناءها

1. **Recipe pass.**قم بتشغيل إصدارات OpenRewrite (Java) أو libcst (Python) أولاً. استلم 70-80% من الهجرات التي هي ميكانيكية. إلتزام كما "الوصفة" إلتزام.

2. **Build trial.**صندوق الرمل في "ديتونا": قم بتثبيت وقت تشغيل الهدف، قم بتشغيل البناء، إذا كان أخضر، قم بالاختبارات، إذا كان أحمر، سلمي إلى العميل.

3. **Agent loop.**لنجرافي مع الأدوات: `run_build`،`read_file`،`edit_file`،`run_test`،`git_diff`. يقوم الوكيل بتصنيف الفشل (العمق والترجمة والاختبار وأداة البناء) ويتم تطبيق إصلاح مستهدف.

4. **Budget caps.**30 دقيقة في الساعة الجدارية لكل إعادة إعلان، 8 دولار، 20 عميل يتحول. أي خرق يتوقف وملفات تحت "ميزانية_تنفذ" مع الاختلاف الحالي.

5. **Test + coverage gate.**بعد أن يذهب البناء الأخضر، قم بتشغيل مجموعة الاختبار. مقارنة التغطية مع repo الأساسي. إذا انخفض التغطية أكثر من 2 نقاط مئوية، قم بتسجيل تحت "التغطية_التراجع".

6. **PR open.**عند النجاح، اضغط على الفرع، افتح العلاقات العامة مع الفرق وموجّه من الوصفات المطبقة والتي تتعهد الوكيل المؤلف.

7. **Failure taxonomy.**لكل إعادة إعادة إعادة فشل، قم بتعليق مع فئة: `dep_upgrade_required`،`build_tool_drift`،`custom_annotation`،`test_flake`،`syntax_edge_case`،`budget_exhausted`-بني لوحة التحكم

8. **50-repo run.**تنفيذ عبر مجموعة فرعية MigrationBench. تقرير معدل الانتقال لكل فئة، وتكلفة لكل تقرير، وتغطية الحفاظ، ومقارنة ضد القرار فقط.

## استخدمها

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## أرسله

`outputs/skill-migration-agent.md`يتم إعطاء repo ، فإنه ينفذ وصفات تحديدية ثم حلقة وكيل لإنتاج فرع هجرة خضراء ، أو يملأ repo تحت فئة تصنيف.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## التمارين

1. قم بتشغيل خط الأنابيب الهجرة باستخدام OpenRewrite فقط (لا وكيل). مقارنة معدل مرور إلى خط الأنابيب الكامل. حدد الحالات التي يكون فيها وكيل وحده هو الفرق.

2. تنفيذ عملية التحقق من "نظافة اللنت": بعد الهجرة، قم بتشغيل لنتر نمط (غير ذو بقعة لـ Java، ruff لـ Python). تفشل في إعداد العلاقات العامة إذا ظهرت أخطاء جديدة لنت. قياس معدل تغطية المحافظة على النمط ولكن تعود إلى النمط.

3. إضافة محفز "الفرق الأدنى": بعد أن تمت اختبار فرع الوكيل، قم بتقليص التغييرات غير الضرورية بممر ثان.

4. تمديد الهجرة الثالثة: العقد 18 إلى العقد 22. إعادة استخدام غلفة صندوق الرمال؛ تبادل طبقة الوصفة لبرنامج رمزية مخصصة.

5. قياس الوقت إلى أول بناء خضراء (TTFGB) كمقياس UX. الهدف: p50 تحت 10 دقائق.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## المزيد من القراءة

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) مقياس التقني لعام 2026
- [Moderne.io OpenRewrite platform](https://www.moderne.io) مرجع التربة المحددة
- [OpenRewrite documentation](https://docs.openrewrite.org) كتابة الوصفة
- [Grit.io](https://www.grit.io) وضع رمز بديل DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) إشارة وكلاء SDK
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) مقياس الهجرة البديلة
- [libcst](https://github.com/Instagram/LibCST) أساسيّة طبيّة Python
- [Daytona sandboxes](https://daytona.io) إشارة لكل فروع
