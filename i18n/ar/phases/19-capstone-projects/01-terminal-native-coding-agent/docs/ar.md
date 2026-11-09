# كابستون 01  وكيل التشفير المحلي في المحطة

> بحلول عام 2026، سيتم تحديد شكل وكيل التشفير. حزمة TUI، خطة حالة، سطح أداة مربع رمال، حلقة التي تخطط، تعمل، تلاحظ، تعافى. كلود كود، كورسور 3، و "أوبن كود" تبدو متشابهة من 50 قدم. هذه الحجر النهائي يطلب منك أن تبني نهاية واحدة إلى نهاية  CLI في، سحب الطلب  وتقييمها ضد الوكيل الصغرى و Live-SWE-وكيل على SWE-bench Pro. سوف تتعلم لماذا الجزء الصعب ليس هو الموديل المكالمة ولكن حلقة الأدوات، مربع الرمال، والسقف التكلفة على 50 جولة.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## المشكلة

أصبح وكلاء التشفير الفعلي فئة تطبيقات الذكاء الاصطناعي المهيمنة في عام 2026. كلود كود (أنثروپي) ، كورسور 3 مع المكون 2 و علامات التبويب العميلة (كورسور) ، Amp (Sourcegraph) ، OpenCode (112k نجوم) ، Factory Droids ، وGoogle Jules جميعها تغيرات السفينة من نفس الهندسة المعمارية: حزمة محطة ، سطح أداة مسموح بها ، صندوق رمل ، وخطط عمل مراقبة حلقة بنيت حول نموذج حدودي. الحدود ضيقة  عميل SWE على الهواء مباشرة وصل إلى 79.2% على مقعد SWE تأكدت مع Opus 4.5  ولكن المهندسة الرفيع. معظم أساليب الفشل ليست أخطاء النموذج إنها عدم استقرار حلقة الأدوات، وتسمم السياق، وتكلفة رمزية هربية، وتشغيلات نظام الملفات المدمرة.

لا يمكنك التفكير حول هؤلاء العملاء من الخارج عليك أن تبني واحد، شاهد حلقة تحطم في المنحنى 47 عندما يعيد ripgrep 8MB من المقابلة، وإعادة بناء طبقة التقطيع.

## المفهوم

الحزام لديه أربع سطحات**Plan**يحافظ على كائن حالة على شكل TodoWrite الذي يعيد النموذج كتابة كل دور. **Act**إرسال مكالمات الأداة (قراءة، تحرير، تشغيل، بحث، git). **Observe**يلتقط رموز الخروج / stdout / stderr / ، ويقصر ، ويرجع الموجز. **Recover**يُعامل أخطاء الأداة دون أن تُنفخ نافذة السياق أو تتحلق إلى الأبد. شكل 2026 يضيف شيء آخر: **hooks**. .`PreToolUse`،`PostToolUse`،`SessionStart`،`SessionEnd`،`UserPromptSubmit`،`Notification`،`Stop`و`PreCompact`نقاط التوسع المُتَكَنِّفَة التي يُحقق فيها المشغل السياسة والمتسع والحواجز.

صندوق الرمل هو E2B أو دايتونا. كل مهمة تعمل في حاوية جديدة من تطوير مع Git worktree نصب القراءة والكتابة. الحزام لا يلمس نظام الملفات المضيف شجرة العمل تُمزق على النجاح أو الفشل. يتم فرض مراقبة التكاليف على ثلاثة طبقات: سقف رمزية لكل جولة، وميزانية دولارية لكل جلسة، وحد صعب للالتحول (عادة 50). طبقة الملاحظة هي OpenTelemetry امتدادات مع GenAI الاتفاقيات الترجمية، شحن إلى لنجفوز المضيفة الذاتية.

## الهندسة المعمارية

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## الـ"كثيرة"

- وقت تشغيل الحزمة: Bun 1.2 + Ink 5 (تفاعل في المحطة)
- نموذج الوصول: OpenRouter API موحدة مع Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (للمهمات الأصعب)
- نقل الأدوات: نموذج بروتوكول السياق StreamableHTTP (إصدار MCP 2026)
- صندوق الرمل: صناديق الرمل E2B (JS SDK) أو حاويات تطوير دايتونا
- البحث عن الرمز: عملية ripgrep الفرعية، أجهزة الحبس الشجري لـ 17 لغة (مُحَمَّلَت مسبقاً)
- العزل:`git worktree add`لكل مهمة، تنظيف النجاح / الفشل
- الحزام الموازي: SWE-bench Pro (مجموعة فرعية معتمدة) + Terminal-Bench 2.0 + الاحتفاظ الخاص بك 30 مهمة
- الملاحظة: OpenTelemetry SDK مع `gen_ai.*`semconv → Langfuse المضيفة الذاتية
- نشر علاقات عامة: تطبيق GitHub مع رمز ذو حبوب دقيقة، يقتصر نطاقه على الاسترداد المستهدف

```figure
ce-agent-loop
```

## بناءها

1. **TUI and command loop.**أضع مشروع "بون" على الستارة بالحبرة`agent run <repo> "<task>"`. طبع عرض مقطوع: لوحة خطط (في الأعلى) ، تدفق الدعوات الأداة (في الوسط) ، ميزانية الرمز (في الأسفل) إضافة إلغاء على Ctrl-C التي تنطلق `SessionEnd`-الربط قبل الخروج

2. **Plan state.**حدد مخطط TodoWrite المكتوب (المنتظر / in_progress / المواد المنجزة مع ملاحظات). يقوم النموذج بإعادة كتابة الحالة الكاملة كل دور كدعوة أداة  لا تدعها تتغير تدريجياً.`.agent/state.json`حتى يتمكنوا من استئناف الحوادث

3. **Tool surface.**حدد ستة أدوات: `read_file`،`edit_file`(مع إضافة إضافية)`ripgrep`،`tree_sitter_symbols`،`run_shell`(مع وقف)`git`(حالة / diff / commit / push). قم بتعرض MCP StreamableHTTP بحيث يكون الحاجز غير معقول للنقل. كل أداة تعيد الناتج المقطوع (الحد عند 4k tokens لكل مكالمة).

4. **Sandbox wrapping.**كل مهمة تولد صندوق رمل E2B. `git worktree add -b agent/$TASK_ID`جميع المكالمات الأداة تنفذ داخل صندوق الرمال نظام الملفات المضيف غير قابل

5. **Hooks.**تنفيذ جميع أنواع الركوب الثمانية لعام 2026. سلك أربعة ركوبات على الأقل من قبل المستخدم: (أ) `PreToolUse`حرس قيادة مدمرة يمنع`rm -rf`خارج شجرة العمل، (ب) `PostToolUse`الحسابات الرمزية، (ج) `SessionStart`إطلاق الميزانية، (د) `Stop`يكتب حزمة أثر نهائية

6. **Eval loop.**قم بتسجيل مجموعة فرعية من 30 عدد من SWE-bench Pro Python. قم بتشغيل الحبل ضد كل واحد. قم بالمقارنة مع الوكيل الصغرى (الخط الأساسي الحد الأدنى) على pass@1, turns-per-task، و $-per-task. اكتب النتائج إلى `eval/results.jsonl`. . .

7. **Cost control.**التوقفات الصعبة: 50 جولة، 200 ألف سياق، 5 دولارات لكل مهمة.`PreCompact`و يختصّر هوك التحولات القديمة إلى كتلة سابقة في 150 ألف، مما يفرّغ مساحة للملاحظات الجديدة دون فقدان الخطة.

8. **PR posting.**على النجاح، الخطوة الأخيرة هي`git push`+ مكالمة API GitHub التي تفتح علاقات علاقية مع الخطة وموجب المختلف في الجسم.

## استخدمها

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## أرسله

المهارة المقدمة تعيش في`outputs/skill-terminal-coding-agent.md`. بالنظر إلى مسار الاسترداد وصف المهمة ، فإنه يدير حلقة كاملة للخطة-عمل-التلاحظ في مربع رمل ويرد عنوان PR بالإضافة إلى مجموعة تتبع.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## التمارين

1. قم بتغيير نموذج الدعم من كلود سونيت 4.7 إلى Qwen3-Coder-30B المقدم على vLLM. مقارنة pass@1 و $-per-task. أبلغ أين يعمل نموذج مفتوح بشكل أقل.

2. إضافة`reviewer`وكيل فرعي يقرأ الاختلاف قبل نشر العلاقات العامة ويمكنه طلب حلقة مراجعة. قياس ما إذا كانت المراجعات الإيجابية الخاطئة تقلل معدل مرور SWE-bench أقل من خط الأساس للوكيل الواحد (لمحة: عادة نعم).

3. اختبار الإجهاد في صندوق الرمل: اكتب مهمة تحاول`curl`عنوان خارجي ومهام يكتب خارج شجرة العمل. تأكد من كل منهما محاصر من قبل المكعب PreToolUse. سجل المحاولات.

4. تنفيذ`PreCompact`التجميع مع نموذج أصغر (هايكو 4.5). قياس كمية وفاء الخطة ضاعت عند ضغط 3x.

5. تغيير MCP StreamableHTTP النقل للستديو، مقياس البدء البارد والانخفاض لكل مكالمة، اختيار فائز لاستخدام محلي فقط.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## المزيد من القراءة

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) الحزام المرجعي من شركة "أنتروبيك"
- [Cursor 3 changelog](https://cursor.com/changelog) العامل علامات التبويب وملاحظات المنتج المكون 2
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) الحد الأدنى من خط الأساس لمقارنة القائمة على المقعد
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79.2% مقعد SWE تم التحقق منه مع Opus 4.5
- [OpenCode](https://opencode.ai)-السلطة المفتوحة، 112 ألف نجم
- [SWE-bench Pro leaderboard](https://www.swebench.com) التقييم الذي يستهدف هذا الحجر النهائي
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP، المعلومات المتعلقة بالقدرة
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) مخططات المدى للدعوات الأداة واستخدام الرمز
