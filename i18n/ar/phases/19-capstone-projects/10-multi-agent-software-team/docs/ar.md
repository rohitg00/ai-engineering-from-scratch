# كابستون 10  فريق هندسة البرمجيات متعددة الوكلاء

> صيغة 2026 من فريق هندسي متعدد الوكلاء قد تجمع: خطط المهندس المعماري، N المبرمجين يعملون في أشجار العمل المتوازية، بوابات المراجعة، اختبار يصدق. بنية المصنع SWE-AF، التحفيز القائم على الأدوار MetaGPT، رسمية الممثل المكتوب من AutoGen 0.4، ديفين من Cognition، و درويد من المصنع جميعها هبطت على ذلك بشكل مستقل. الأشجار الموازية تعمل على تحويل الساعة الجدارية إلى انتاج. البروتوكولات المشتركة في الحالة والإرسال تصبح سطح الفشل الحجر النهائي هو بناء الفريق، تقييم على مقعد SWE-Pro، وتقرير أي التسليمات تقطع وكيفية.

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## المشكلة

أسلحة التشفير من عامل واحد ضربت السقف على المهام الكبيرة. ليس لأن أي وكيل فردي ضعيف، ولكن لأن سياق 200k-token لا يمكن أن تحتوي على خطة معمارية زائد أربعة شرائح قاعدة كود متوازية زائد تعليق المراجع زائد نتائج الاختبار. المصانع متعددة الوكلاء تقسيم المشكلة: المهندس المعماري يملك الخطة، ومدفّر يمتلك تنفيذها في أشجار العمل المتوازية، ومرجع البحث، ومتحقق. بنية "الفاكتور" في SWE-AF ، ودورات MetaGPT ، وخط البيانات المميزة للفاعل من AutoGen  جميع الإطارات الثلاثة تصف نفس الشكل.

سطح الفشل هو التسليم. يقوم المهندس بتخطيط شيء لا يستطيع المبرمجون تنفيذه. ينتج المبرمجون اختلافات متناقضة. يوافق المراجع على تصحيح الهلوسة. يقوم المتجر بتسابقة مبرمج مكتوب. ستقوم ببناء أحد هذه الفريقات، وتشغيله على 50 قضية SWE-bench Pro، وتتبع كل عملية التسليم، وتنشر ما بعد الموت.

## المفهوم

الأدوار هي وكلاء من نوعها**Architect**(كلود أوبوس 4.7) يقرأ العدد، ويكتب خطة، ويكسر في مهام فرعية مع واجهات صريحة. **Coders**(كلود سونيت 4.7 ، N حالات متوازية ، كل في `git worktree`+ صندوق رمل دايتونا) تنفيذ المهام الفرعية بشكل مستقل. **Reviewer**(GPT-5.4) يقرأ الفرق المدمج ويمنح موافقة أو يطلب تغييرات محددة. **Tester**(جيميني 2.5 برو) تعمل على مجموعة الاختبار بشكل معزول وتبلغ عن اختراق أو فشل مع الأثاث.

يتم الاتصال من خلال لوحة مهمة مشتركة (محمّلة بالملفات أو Redis). كل دور يتطلب مهام يسمح لها بتمييزها. التسليمات هي رسائل من نوع بروتوكول A2A. مشاكل التنسيق: حل النزاعات في الاندماج (دور منسق أو الاندماج الآلي ثلاثي الاتجاهات) ، وتزامن الحالة المشتركة (يتم تجميد الخطة بمجرد بدء المشغلي؛ وتعد التخطيطات أحداث منفصلة) ، ومراقبة البوابات للمراجعة (لا يمكن للمراجعة أن توافق على تغييراتها أو التغييرات التي اقترحتها).

تعزيز الوهم هو التكلفة الخفية. كل حدود الدور تضيف طلبات ملخصة ومحيط التسليم. تصبح جولة 40 جولة من وكيل واحد 160 جولة إجمالية عبر أربعة أدوار. يوزن اللعبة خصيصًا كفاءة الوهم مقابل خط أساس وكيل واحد لأن السؤال ليس "هل يعمل وكيل متعدد" ولكن "هل يفوز بالدولار".

## الهندسة المعمارية

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## الـ"كثيرة"

- التنسيق: لنجراف مع حالة مشتركة + كل عامل
- الرسائل: بروتوكول A2A (جوجل 2025) للرسائل المكتوبة بين الوكلاء
- النماذج: أوبوس 4.7 (المعماري) ، سونيت 4.7 (مبرمج) ، GPT-5.4 (مراجعة) ، جيميني 2.5 برو (متجرب)
- عزل الأشجار: `git worktree add`لكل مُبرمج + صندوق رمل "ديتونا"
- منسق الاندماج: الاندماج المخصص ثلاثي الطرق + حل النزاعات بالوساطة من خلال القانون القانوني
- Eval: SWE-bench Pro (50 عدد) ، سيناريوهات SWE-AF، HumanEval++ للتجارب الوحيدة
- الملاحظة: Langfuse مع المراحل المحددة بالرموز، محاسبة الرمز لكل وكيل
- التنفيذ: K8s مع كل دور كالتنفيذ منفصل + HPA على الاحتفاظ

```figure
ce-team-handoff
```

## بناءها

1. **Task board.**JSONL المدعومة بالملفات مع رسائل مدخلة: `plan_request`،`subtask`،`diff_ready`،`review_needed`،`test_needed`،`approved`،`rejected`،`replan_needed`-الوكلاء يشتركون في التسميات

2. **Architect.**يقرأ إصدار GitHub ، ويستخدم Opus 4.7 مع نموذج خطة يتطلب واجهات المهام الفرعية الصريحة (الملفات الملموسة ، الوظائف العامة ، تأثير الاختبار). ينشر واحد `plan_request`مع يوم من المهام الفرعية.

3. **Coders.**في عمل متوازي، كل من يطلب وظيفة فرعية واحدة من اللجنة.`git worktree add`إضافة إلى صندوق رمل في "ديتونا" يقوم بتنفيذ المهمة الفرعية`diff_ready`مع الملفات + ديلتا اختبار.

4. **Merge coordinator.**في جميع المبرمجين، يدمج ثلاثي الاتجاهات فروع N في فرع مرحلة. حل النزاع بوساطة LLM فقط عندما يكون هناك تداخل مستوى الملفات.

5. **Reviewer.**GPT-5.4 يقرأ الاختلاف المدمج لا يمكن أن يوافق على الاختلافات التي أصدرتها.`approved`(لا) أو`review_feedback`مع طلبات تغيير محددة يتم توجيهها إلى المبرمج المعني.

6. **Tester.**جيني 2.5 برو) يدير مجموعة الاختبارات في صندوق رمال نظيف) يلتقط الأثاث`test_passed`أو`test_failed`مع تعديلات التكثيف. اختبارات الفشل حلقة مرة أخرى إلى المبرمج الذي يمتلك المهمة الفرعية الفاشلة.

7. **Handoff accounting.**كل رسالة تتعبر حدود الدور تحصل على فترة في Langfuse مع حجم الحمل المفيد والنموذج المستخدم. احسب تعزيز رمز لكل مهمة فرعية (مشاركات كودر_توكين + مرجع_توكين + اختبار_توكين + معماري_توكين / كودر_توكين).

8. **Eval.**تشغيل على 50 قضية SWE-bench Pro. مقارنة pass@1 و $- لكل قضية حل مع خط أساسي من وكيل واحد (سونيت واحد 4.7 في شجرة عمل واحدة).

9. **Post-mortem.**لكل إصدار فاشل، حدد الإصدار الذي انتهى (الخطة غامضة جداً، الصراع المدمج، المراجع الموافقة الخاطئة، فلاش اختبار). قم بتقديم نظام تاريخي لفشل الإصدار.

## استخدمها

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## أرسله

`outputs/skill-multi-agent-team.md`وبالنظر إلى عنوان المسألة ومستوى التوازي، يقوم الفريق بإنتاج علاقات إعلامية جاهزة للتدمير مع محاسبة رموز لكل دور.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## التمارين

1. حقن حشرة واضحة في فرق منتصف الجولة (إضافية `return None`قبل الهيئة الرئيسية) قياس معدل المراجع الموافقة على الكذبة. ضبط المراجع على طلب حتى يكون الموافقة على الكذب أقل من 5%.

2. خفض إلى اثنين من المبرمجين (المعماري + اثنين من المبرمجين + المراجع + اختبار ، كل مبرمجين يعملان اثنين من المهام الفرعية بالتسلسل). مقارنة الساعة الحائطية وتجاوز معدل.

3. استبدل منسق المدمج بقيود كتابة واحدة (المهمات الفرعية تلمس مجموعات ملفات منفصلة). قياس عبء التخطيط على المهندس المعماري.

4. مراجعة التداول من GPT-5.4 إلى Claude Opus 4.7. قياس معدل الموافقة الكاذبة و دلتا تكلفة الرمز.

5. إضافة دور خامس: الموثق (هايكو 4.5). بعد مراجعة، فإنه ينتج إدخال تاريخ التغيير. قياس ما إذا كانت جودة الوثائق تبرر الإنفاق الإضافي على الرمز.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## المزيد من القراءة

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF)مصنع متعدد الوكلاء 2026
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT)إطار متعدد الوكلاء القائم على الأدوار
- [AutoGen v0.4](https://github.com/microsoft/autogen) إطار عمل Microsoft المميز
- [Cognition AI (Devin)](https://cognition.ai) منتج مرجع
- [Factory Droids](https://www.factory.ai) منتج مرجع بديل
- [Google A2A protocol](https://a2a-protocol.org/latest/) مواصفات الرسائل بين الوكلاء
- [git worktree documentation](https://git-scm.com/docs/git-worktree) الأساسية المعزولة
- [SWE-bench Pro](https://www.swebench.com) هدف التقييم
