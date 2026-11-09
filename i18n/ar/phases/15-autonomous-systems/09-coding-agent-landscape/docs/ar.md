# منظرة وكيل التشفير الذاتي (2026)

> ارتفع مؤشر SWE-Bench Verified من 4% إلى 80.9% في أقل من ثلاث سنوات. نفس كلود سونيت 4.5 حصل على 43.2% على SWE-agent v1 و 59.8% على Cline متنازل  الإرصفة حول النموذج الآن مهمة بقدر ما النموذج نفسه. أوبين هاندز (أو أوبين ديفين سابقا) هي المنصة الأكثر نشاطاً مرخصة بمعهد MIT ويقوم حلقة CodeAct بها بتنفيذ أعمال Python مباشرةً في صندوق رمل بدلاً من دعوات أداة JSON. أرقام العناوين تخفي مشكلة منهجية: 161 من 500 وظيفة SWE-bench المحققة تتطلب فقط 12 تغيير خط، و SWE-bench Pro (10 + وظائف خط) يقع في 2359% لنفس النماذج الحدودية.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## المشكلة

"أي وكيل التشفير هو الأفضل" هو السؤال الخطأ. السؤال الصحيح هو: على توزيع المهام التي تتناسب مع عملي، مع الرفوف الذي سأعمل في الإنتاج، ما هو موثوقية نهاية إلى نهاية حصلت؟

بين عامي 2022 و 2026 تعلمت الحقل أن الرفوفد  طبقة الاسترداد، المخطط، مربع الرمال، حلقة التحرير والتحقق، شكل التعليق  تحمل الحمل. حصل كلود سونيت 4.5 على SWE-agent v1 على 43.2% على SWE-bench Verified؛ نفس النموذج داخل منصة Cline الذاتية حصل على 59.8%. 16.6 نقاط اختلاف مطلقة، نفس الوزن. النموذج الأساسي هو مكون، والحلقة هي المنتج.

المشكلة المرافقة هي أن تثبيت المرجع يخفي الانحدارات. مقعد SWE- Verified قريب من التثبيت ، والسيل سهل المهمة (161 من 500 مهمة تتطلب ≤2 خطوط) يسحب أعلى النتيجة. يتم قياس جودة العالم الحقيقي بشكل أفضل على توزيعات مثل مقعد SWE Pro (10 + تغييرات الخط) ، حيث لا يزال نفس القادة يجلسون عند 2359%.

## المفهوم

### المجلس القانوني، فقرة واحدة

يأخذ SWE-bench (Jimenez et al.) قضايا GitHub الحقيقية مع تصحيحات الحقيقة الأرضية وطلب من وكيل إنتاج تصحيح يجعل مجموعة الاختبار تمر. SWE-bench Verified (OpenAI ، 2024) هو مجموعة فرعية من 500 مهمة تم تنظيفها من قبل الإنسان مع إزالة المهام المزيفة والمتفككة. SWE-bench Pro هو خليفة أصعب  المهام التي تتطلب 10+ خطوط من التغيير ، حيث يجلس وكلاء الحدود الحالية عند 2359%.

### ما يظهر في الواقع منحنى 2022 → 2026

- **2022**: نماذج البحث عند ~4% على مقعد SWE خام.
- **2024**: GPT-4 + الرفوفات في نمط ديفين عند ~ 14% ؛ وكيل SWE عند ~ 12%.
- **2025**: كلود 3.5 / 3.7 سونيت داخل Aider و SWE- عامل دفع إلى نطاق 40 55%.
- **2026**: كلود سونيت 4.5 والمتنافسين الحدودية عند 7080%+ على مقعد SWE- Verified.

جاءت المنحدرة من ثلاثة مصادر مركبة: نماذج أساسية أفضل، وأحسن منصة (CodeAct، التفكير، حلقات التحقق) ، وأحسن معايير (إزالة الضوضاء المحققة).

### CodeAct vs JSON أداة الدعوات

أطلقت OpenHands (All-Hands-AI ، arXiv:2407.16741, OpenDevin) رهانًا معماريًا محددًا: بدلاً من نموذج إصدار دعوات أداة JSON التي يقوم بها مضيف بتفكير وتنفيذها ، يقوم النموذج بإصدار رمز Python ويمارسها kernel على شكل Jupyter في صندوق رمال. يمكن للعميل أن يدور عبر الملفات وأدوات سلسلة ، ويقبض استثناءاتها الخاصة داخل إجراء واحد.

التنازل:

- **JSON tool calls**: كل عمل هو دور واحد؛ سهل التحقيق؛ محدودة التكوين؛ آمن افتراضيًا لأن كل دعوة تمر عبر مؤكدة صريحة.
- **CodeAct**: عمل واحد يمكن أن يكون برنامج كامل؛ تكوينية؛ يتطلب صندوق رمل صلب (OpenHands يستخدم عزل Docker); وضع الفشل يشمل أي شيء يسمح به الوقت تشغيل صندوق رمل.

كلا الهندسة المعمارية في الإنتاج. CodeAct هو المهيمن على المنصات المفتوحة (OpenHands، smolagents). تظل دعوات أداة JSON مهيمنة في الخدمات المدارة (وكلاء الأنثروبولية المدارة، مساعدات OpenAI) حيث يسيطر المقدم على المنفذ.

### الرفوف في المشهد 2026

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### لماذا السوق يهيمن

مسار التشفير هو مسار طويل الأفق (الدرس 1) ، ويتمثل المواد الموثوقة عبر الخطوات. ثلاثة أماكن حيث يشتري الرفوف نقاط:

1. **Retrieval**: إيجاد الملفات المناسبة لقراءتها هو عقدة الزجاجة الصامتة. ACI وكيل SWE، OpenHands الملفات المؤشر، و Aider repo-خريطة كل هجوم على هذا.
2. **Verifier loop**: تشغيل الاختبارات، قراءة آثار كومة، ومحاولة إعادة هو 10+ نقطة دلتا على مقعد SWE.
3. **Failure containment**: صندوق الرمل الذي يتراجع عن الخطأ يمنع تلفات المركبة. نفس النموذج مع ودون حلقة التحقق يبدو كنتين مختلفين.

### التشبثات المرجعية والتوزيع الحقيقي

يذكر مؤلفو OpenHands و Epoch AI أن SWE-bench Verified لديه ذيل سهل: 161 من 500 مهمة تحتاج فقط إلى 12 خط من التغيير. يتم دفع النتيجة العالية جزئيا من هذا الذيل. يقتصر SWE-bench Pro على 10 + تغييرات الخط وتعطي النتيجة في نطاق 2359% حتى بالنسبة للأنظمة الحدودية. توزيع الإنتاج الخاص بك يقرب تقريبًا بالتأكيد من Pro أكثر من Verified.

التداخلات في اختيار وكيل: تشغيل مجموعة فرعية مثل Pro من مخزون الأخطاء الخاص بك. النتيجة التي تهم النتيجة على المهام تمثل ما تمر به.

```figure
a5-scaffold-delta
```

## استخدمها

`code/main.py`يُقارن اثنين من أوقافات وكيل الألعاب على توزيع مصغر ثابت للمهمة:

1. أ**JSON tool-call**الرف الذي يأخذ خطوة واحدة في كل دور.
2. أ**CodeAct**الرف الذي يمكن أن يبعث مقطوعة Python صغيرة لكل عمل.

تستخدم كلاهما "نموذج" (قواعد تحديد) ، لذلك يفرز المقارنة الرفع من جودة النموذج. يظهر الخروج أن ررفع CodeAct يحل المزيد من المهام في عدد أقل من الجولات بتكلفة نصف قطر انفجار أكبر لكل عمل.

## أرسله

`outputs/skill-scaffold-audit.md`تساعدك على مراجعة أساس الوكيل التشفير المقترح قبل اعتمادها: جودة الاستخدام، وجود المؤكد، عزل صندوق الرمل، وملاءمة المعايير للتوزيع.

## التمارين

1. أركض`code/main.py`كم عدد المفاتيح التي يقوم بها كل منصة في نفس مجموعة المهام؟ ما هو نصف قطر انفجار لكل عمل؟

2. اقرأ ورقة OpenHands (arXiv:2407.16741). يجادل الورقة CodeAct يفوق دعوات أداة JSON في المهام المعقدة. حدد وضع فشل واحد يقر فيه الورقة وكتب جملة واحدة عندما سيهيمن هذا الوضع في الإنتاج.

3. اختر مهمة واحدة من سجل الأخطاء الخاص بك التي تتطلب 10 + خطوط من التغيير عبر ملفين. تقدير احتمال النجاح من نهاية إلى نهاية لنموذج الحدود تحت (أ) دعوات أداة JSON و (ب) CodeAct. تبرير الفجوة.

4. SWE-Bench Verified لديه 161 ملف واحد، 12 خط مهام. بناء نتيجة التي تستبعد لهم. كيف يضرب قائمة النسب؟

5. اقرأ "إدخال SWE-bench Verified" (OpenAI). شرح المنهجية المحددة المستخدمة لإزالة المهام الغامضة، وتسمية فئة واحدة التي سوف تفوت الهيئة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## المزيد من القراءة

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) المعيار المرجعي الأصلي والنهجية.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) كيف تم بناء مجموعة فرعية تم تصنيفها.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) معمارة CodeAct وتصميم تدفق الأحداث.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) النتائج المتابعة مباشرة.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) إطار موثوقية وكيل التشفير على الأفق الطويل.
