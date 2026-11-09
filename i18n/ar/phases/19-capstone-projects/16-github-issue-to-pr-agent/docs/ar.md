# كابستون 16  GitHub issue-to-PR وكيل مستقل

> وضع علامة على قضية، الحصول على PR  شكل المنتج 2026 للوكلاء التشفير المستقلين: تشغيل وكيل في صندوق الرمال السحابية، التحقق من اجتياز الاختبارات، ونشر PR جاهز للمراجعة مع المنطق. وكلاء AWS SWE عن بعد وكلاء خلفية كورسور OpenAI Codex سحابة، وجوجل جولز جميع شحنها. الأجزاء الصعبة هي إعادة إنتاج بيئة البناء من الاستثمار تلقائيًا ، ومنع تسرب المراجع ، وتطبيق ميزانيات لكل استثمار ، وتأكد من أن الوكيل لا يمكن الضغط القسري. هذه الحجر النهائي يبني النسخة المضيفة الذاتية ويقارنها على التكلفة وتجاوز مع البدائل المضيفة.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## المشكلة

وكيل التشفير السحابية غير المزامنة هو فئة منتج منفصلة من وكلاء التشفير التفاعلي (Capstone 01). UX هو علامة GitHub. أنت تسمية مشكلة `@agent fix this`يقوم العامل بالتحول إلى صندوق رمل في السحابة، ويستسخن الاستعمال، ويجري اختبارات، ويحرر الملفات، ويتحقق، وفتح بيانات علاقات مع منطق الوكيل في الجسم. لا حلقة تفاعلية، لا محطة. وكلاء AWS SWE عن بعد، وكلاء خلفية cursor، OpenAI Codex cloud، جوجل جولز، ومتصفحات المصنع جميعها تتقارب على هذا.

التحديات الهندسية ملموسة: إعادة إنتاج البيئة (يجب على الوكيل بناء repo من الصفر دون صورة تطوير مخزن) ، والاختبارات المتفجرة (يجب إعادة تشغيلها أو عزلها) ، وتحديد نطاق الاعتمادات (تطبيق GitHub مع أدنى مستوى من الاحتياجات الدقيقة) ، وتنفيذ الميزانية لكل repo يوميا، وسياسة عدم دفع القوة. القيادة القصوى تقيس معدل الانتقال، والتكلفة، والسلامة مقابل البدائل المضيفة.

## المفهوم

إن المحفز هو شبكة شبكة GitHub (تسمية القضية أو تعليقات العلاقات العامة). يقوم المرسل بتسجيل العمل إلى ECS Fargate أو Lambda. يجذب العامل repo إلى صندوق رمل Daytona أو E2B مع دوكرفايل عامة استنتاج من repo (اللغة ، الإطار). يقوم الوكيل بتشغيل خلية صغيرة من الوكيل أو SWE-وكيل v2 ضد Claude Opus 4.7 أو GPT-5.4-Codex. يكرر: قراءة الرمز ، واقتراح إصلاح ، تطبيق إصلاح ، تشغيل الاختبارات.

التحقق هو خطوة الإغلاق. يجب أن يمر المعلومات الكاملة في صندوق الرمل قبل فتح PR. يتم حساب دلتا التغطية ؛ إذا كان سلبيًا خارج العدالة ، فسيتم فتح PR ولكن يتم وضع علامة `needs-review`. الوكيل يضع العقلانية كوصف العلاقات العامة بالإضافة إلى`@agent`يمكن للمراجعة أن يطلبوا متابعة

يتم تحديد الأمان من خلال سطحين مختلفين من GitHub: يقدم التطبيق رمزًا للوثبات قصير الأجل مع `workflows: read`و ضيقة محتويات الاحتفاظ / نطاقات العلاقات العامة؛ حماية الفرع (ليس تصاريح التطبيق) يفرض "لا كتابة مباشرة إلى `main`" و"لا قوة الضغط"  التطبيق لا يضاف أبدا إلى قائمة التجاوز.`.github/workflows`ليس بريميتيفاً حقيقيًا لتطبيق GitHub ، لذلك يجب على قائمة السماح للعميل بتحرير الملفات فرض ذلك على العامل. يتم فرض السقف المالي لكل إعادة يوميًا في المرسل (على سبيل المثال ، ماكسب 5 PRs لكل إعادة يوميًا ، 20 دولارًا لكل إعادة عامة).

## الهندسة المعمارية

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## الـ"كثيرة"

- محفز: تطبيق GitHub مع رمز ذو الحبوب الدقيقة ؛ مستلم الويب هوك عبر Lambda أو Fly.io
- عامل: مهمة ECS Fargate (أو GitHub Actions self-hosted runner)
- صندوق الرمال: حاوية دايتونا للتطوير أو صندوق رمل E2B لكل مهمة
- حلقة العميل: خط أساسي من العميل الصغرى أو العميل الصغرى v2 على كلود أوبوس 4.7 / GPT-5.4-Codex
- الاسترداد: خريطة إعادة التأمين على الحارس + إزالة
- التحقق: المعلومات المعلوماتية الكاملة في صندوق الرمل + بوابة التغطية
- الملاحظة: لنجفوز مع أرشيف تتبع لكل شخص مرتبط من جهاز العلاقات العامة
- الميزانية: سقف يومي للدولار لكل إعادة التأمين؛ أقصى عدد من العلاقات العامة لكل إعادة التأمين يوميا

```figure
cf-issue-to-pr
```

## بناءها

1. **GitHub App.**رمز التثبيت المحدد: قضايا قراءة + كتابة، pull_requests كتابة، المحتوى قراءة + كتابة، سير العمل قراءة. حماية الفرع (السطح الوحيد الذي يمكن أن يفعل ذلك) يفرض "لا إضافة مباشرة إلى `main`"و"لا يدفع القوة" التطبيق ليس في قائمة التخطيط العامل يفرض "لا يكتب تحت`.github/workflows`" كتحقيق قائمة السماح على الاختلاف المقترح، لأن تصاريح تطبيق GitHub ليست مسارية.

2. **Webhook receiver.**وظيفة لامبدا تقبل علامة النسخة / تعليقات العلاقات العامة الويب.`@agent fix this`-الترتيبات إلى مركز القيادة

3. **Dispatcher.**يقوم بتشغيل المهام من SQS. ينفذ الميزانية اليومية لكل إعادة. يدور مهمة ECS Fargate مع عنوان إعادة الإعلان، جسم الإصدار، وصندوق رمل دايتونا الطازج.

4. **Environment inference.**اكتشاف اللغة (بايتون، Node، Go، Rust) ومدير الحزم (uv، pnpm، go mod، cargo). إنشاء ملف Docker على الفور إذا لم يكن موجودا.

5. **Agent loop.**الوسائل: ripgrep، tree-sitter repo-map، read_file، edit_file، run_tests، git. الحدود الصعبة: 20 دولار، 30 دقيقة ساعة الحائط، 30 دورة العميل.

6. **Verification.**بعد انتهاء الحلقة، قم بتشغيل مجموعة الاختبارات الكاملة في صندوق الرمل. قم بتحساب التغطية الديلتا عبر jacoco / coverage.py. إذا كانت CI حمراء: توقف، لا تفتح PR. إذا انخفض التغطية أكثر من 2%: افتح PR مع `needs-review`اللقب

7. **PR posting.**اضغط على فرع الوكيل. افتح علاقات العلاقات عبر API GitHub مع: عنوان، المنطق، ملخص مختلف، تتبع URL، التكلفة، التحولات.

8. **Credential hygiene.**يعمل عامل مع رمز تثبيت تطبيق GitHub قصير الأمد. يتم مسح السجلات من أجل الأسرار قبل التخزين.

9. **Eval.**30 موضوع داخلي ذو صعوبة مختلفة. قياس معدل الانتقال، جودة العلاقات العامة (الامتداد المختلف، والطراز، والغطاء) ، والتكلفة، والتمدد. مقارنة مع وكلاء خلفية المكالمات ووكلاء AWS SWE عن بعد في نفس القضايا.

## استخدمها

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## أرسله

`outputs/skill-issue-to-pr.md`هو المنتج. عامل غيتهوب التطبيق + غير متزامن السحابة التي تحول القضايا الملصقة إلى علاقات علاقية جاهزة للمراجعة مع التكلفة المحدودة والإئتمانات المحددة.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## التمارين

1. إضافة وضع " إصلاح اختبار الطائف ": العلامة التشريعية `@agent stabilize-flake TestX`يُجري الاختبار 50 مرة في صندوق الرمال ويُقترح تغييرًا بسيطًا يُثبته.

2. مقارنة التكلفة مقابل وكلاء خلفية المدافعين على ثلاثة قضايا مشتركة.

3. تنفيذ لوحة ميزانية: تكلفة يومية لكل شخص، تكلفة لكل مستخدم، تحذير عن حالة تشوه

4. بناء وضع "جفاف" يفتح مسودة علاقات العلاقات العامة دون تشغيل CI، حتى يمكن للمراجعين فحص الخطة رخيصة.

5. إضافة سياسة الاحتفاظ: يتم حذف فروع العلاقات العامة التي تزيد عن 7 أيام دون دمج تلقائيًا.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## المزيد من القراءة

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) مرجع وكيل السحابة غير المزامن القنوني
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) إشارة لـ CLI
- [Cursor Background Agents](https://docs.cursor.com/background-agent)البديل التجاري
- [OpenAI Codex (cloud)](https://openai.com/codex)منافس مضيف
- [Google Jules](https://jules.google) النسخة المضيفة لـ Google
- [Factory Droids](https://www.factory.ai) إشارة تجارية بديلة
- [GitHub App documentation](https://docs.github.com/en/apps) الهوية المحددة للروبوت
- [Daytona cloud sandboxes](https://daytona.io) صندوق الرمل المرجعي
