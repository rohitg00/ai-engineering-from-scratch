# تطوير عامل محرك Eval

> توجيه Anthropic: "ابدأ بأحذية بسيطة، واكتمالها بتقييم شامل، واضافة أنظمة وكالة متعددة الخطوات فقط عند الحاجة". التقييم ليس الخطوة الأخيرة. إنها الحلقة الخارجية التي تدفع كل خيار آخر في المرحلة 14.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## أهداف التعلم

- أسمائ طبقات التقييم الثلاثة  مقاييس ثابتة، وتخصيص خارج الإنترنت، والإنتاج عبر الإنترنت  وما هي كل منها.
- اشرح حلقة الضيقة من المحاسبين
- وصف أفضل الممارسات لعام 2026: تقييمات مباشرة إلى جانب الرمز، وتشغيل في CI، والعلاقات العامة البوابة.
- ربط كل درس من المرحلة 14 إلى حالة التقييم التي تولدها

## المشكلة

وكلاء يمرون في التجربة. يفشلوا في الإنتاج بطرق لا يمكن للتنبؤ بها التجربة. الإجابة على النماذج المرجعية "هل هذا النموذج قادر على نطاق واسع؟" وليس "هل هذا الوكيل يرسل اللصائح المناسبة لمنتجتي؟" الإجابة: التقييم على ثلاث طبقات، تعمل باستمرار، مع كل حفرة و قاعدة تعلمت خريطة إلى حالة تقييم.

## المفهوم

### ثلاث طبقات تقييم

1. **Static benchmarks** SWE-bench Verified للرمز (دروس 19) ، WebArena / OSWorld للتصفح / سطح المكتب (دروس 20) ، GAIA للعمومي (دروس 19) ، BFCL V4 لاستخدام الأدوات (دروس 06). استخدام للمقارنة عبر النموذج والإغلاق التراجعي. التلوث حقيقي: SWE-bench+ وجدت تسرب 32.67% من الحل. دائماً تقرير النتائج على SWE-bench Verified أو على مجموعة تدقيق تسرب مثل SWE-bench+.

2. **Custom offline evals** شكل منتجك:
   - ماجستير في الدراسة كقاضي (لانغفوز، فينيكس، أوبيك  الدروس 24).
   - القائمة على التنفيذ (إجراء الإصلاح، اختبارات التحقق).
   - على أساس المسار (مقارنة سلسلة العمل ضد الذهب؛ OSWorld-Human يظهر العاملين الأعلى 1.4-2.7x على الذهب).

3. **Online evals** الإنتاج:
   - إعادة إعادة الإجتماع (Langfuse).
   - إنذارات محفزة على الحراسة (المدرسة 16، 21).
   - تتبع التكلفة / التأخير في كل خطوة (تتتجاوز الدروس 23 OTel).

### المقيّم-المُحسن (أنثروبي)

الحلقة الضيقة:

1. المقترح يخلق الخروج
2. القضاة المقيّمون
3. إصلاحها حتى يمر المقيّم

هذا هو التطهير الذاتي (دروس 05) عامة. أي تدفق وكيل تهتم به يمكن أن يلف في المقيّم-تحسين للموثوقية.

### 2026 أفضل الممارسات

- العشوائيون يعيشون بجانب الرمز.
- أُدخل في كل إعلامي
- الاندماج على درجات تقييم (مثل "لا رجعة > 5% مقابل الرئيسية").
- كل حراسة يخططوا إلى حالة تقييم
- كل قاعدة تعلمت (التفكير، تدفق العمل التعلم قاعدة) خريطة لحالة الفشل.

### ربط المرحلة 14 معًا

معظم الدروس في المرحلة 14 تولد حالات تقييم. الجدول يردد الدروس مع واحدة واضحة:

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

إذا كان مجتمع التقييم الخاص بك لديه قضية لكل سطر، كنت قد تغطيت جوهر المرحلة 14.

### عندما يفشل التنمية القائمة على التقييم

- **No baseline.**الـ (إيفال) بدون آخر شيء معروف لا يمكن قراءته
- **LLM-judge without grounding.**القاضاة هم الهلوسة أيضاً. النمط النقدي (دروسة 05)  القرار الأساسية على الأدوات الخارجية.
- **Over-fitting to evals.**التكيف مع التقييم يختلف عن فائدة الإنتاج.
- **Flaky evals.**الحالات غير المحددة تسبب إنذارات كاذبة

```figure
ae-eval-three-layers
```

## بناءها

`code/main.py`هو حزمة تقييم stdlib:

- سجل الحالات مع الفئات (المعيار، المخصص، على الإنترنت).
- عميل مخطوط تحت الاختبار
- حلقة التقييم-التحسين: اقتراح، الحكم، وتحسين حتى تمر أو أقصى جولات.
- بوابة المعلوماتية: معدل الانتقال المجمّع + تراجع مقابل خط الأساس.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

الناتج: كل حالة تمر/فشل، علامة التراجع، حكم البوابة المعلوماتية.

## استخدمها

- اكتب قضايا تقييم في نفس النقود التي يكتبها وكيلك
- إبحث عنهم في كل علاقات إعلامية عبر المعلومات
- فشل بناء على التراجع.
- تتبع معدل مرور عبر الزمن
- ربط كل فشل في الإنتاج بحالة جديدة

## أرسله

`outputs/skill-eval-suite.md`يُبني مجموعة تقييم ثلاث طبقات لمنتج عامل مع بوابات CI وتتبع التراجع.

## التمارين

1. خذ إحدى فشلاتك في الإنتاج، اكتب حالة تقييم تُعيد ذلك، هل تمكّن وكيلك من إنجازها الآن؟
2. قم ببناء عنوان قضاة ماجستير في العلوم الدراسية للمجال الخاص بك مع ثلاثة أبعاد (الحقيقة، النغمة، النطاق).
3. سلك مجموعة تقييم إلى CI. فشل بناء على >=5% رجعة.
4. أضف مقياسًا لتكفاءة المسار: كم خطوة قام بها العميل مقابل مسار ذهب؟
5. خريط كل درس من المرحلة 14 إلى حالة تقييم في جناحك هل هناك أي مفقود؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## المزيد من القراءة

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) "بدء بسيط، تحسين مع تقييمات"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) مقياس المراقبة المنتخب
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) مقياس استخدام الأدوات
- [Langfuse docs](https://langfuse.com/) تقييمات + إعادة عرض جلسات في الممارسة
