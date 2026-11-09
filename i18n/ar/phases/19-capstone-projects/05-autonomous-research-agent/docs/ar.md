# كابستون 05  وكيل بحث مستقل (مدرسة العلماء الذكاء الاصطناعي)

> نشر "سانتيس" الذكاء الاصطناعي (Sakana) ورقائق كاملة. العميل مختبر أجرى التجارب. (ألين) المُتعلّق بمعرفة الذكاء شارك أثرًا شكل 2026 هو البحث عن الخطة- تنفيذ- التحقق من الأشجار على التجارب، التكلفة الميزانية، تنفيذ رمز مربع الرمال، كتاب الرؤية-ردود LaTeX، ومجموعة المراجعة الآلية في نمط NeurIPS. الحجر النهائي هو بناء واحد، تشغيله من نهاية إلى نهاية في غضون 30 دولار لكل ورقة، والبقاء على قيد الحياة من صندوق الرمال الهروب الفريق الأحمر الذي سكانا وثيق.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## المشكلة

وكالات البحث الذاتية تجاوزت عتبة في عام 2026 نشرت "Sakana AI" AI-Scientist-v2 في الطبيعة مع ورق تم إنشاؤها التي تمت إصلاح مراجعة الأقران في ورشة العمل. تمتد "شينكا إيفولف" (ICLR 2026) الخط إلى الفرضيات المتطورة. مختبر العملاء من شركة (إم دي) أرسلت أثر قابلة للتكاثر الوكلاء ليسوا سحرية إنهم حلقة تنفيذ خطة التحقق تتجاوز شجرة من التجارب المرشحة، مع حدات التكلفة، صناديق الرمل المرتبطة بالبذور، والإعادة التقييم الآلية. السفينة في الحلقة، الميزانية، وقصة السلامة.

تتعلم الحلقة من خلال تنفيذ واحدة ضد فكرة بذرة في مجال ضيق (على سبيل المثال ، إزالة الانتباه على محول 100M). القيمة ليست في اكتشاف شيء جديد في أول مرة. القيمة هي في البنية التحتية: بحث الأشجار، صندوق الرمل التجريبي، حلقة الكاتب والمراجع، تقرير الفريق الأحمر. فريق "سكانا" وثّق فشل الهروب من صندوق الرمل، يجب أن يمر عميلك بنفس الفريق الأحمر.

## المفهوم

العميل هو أفضل بحث أولا شجرة. العقد هي مواصفات التجربة: (الفرضية، التكوين، الرمز، النتيجة المتوقعة). تقدم خطوة توسيع الأطفال مع التحريرات الصغيرة (منحاز التبديل ، حجم الحزمة ، إزالة مكون). كل طفل يذهب في صندوق رمال جديد مع قبعة مصادر صلبة. النتائج تعود إلى وظيفة تسجيل التي تصنف العقدة حسب (الابتكار × الجودة × الميزانية المتبقية). الشجرة تنمو حتى يتم استنفاد الميزانية، ثم يتم كتابة أفضل فرع.

الكاتب متعدد الأسلوب يُولد مسودة لتكس، ويُجمعه، ويُعطي الأرقام، ويُغذّي الفيديو المُعَرض إلى وضع الرؤية في كلود أوبوس 4.7 للنقد على التخطيط، وقراءة الأرقام، وتحديد الدليل على الدعوى. مجموعة من المراجعين من خمسة قضاة ماجستير في العلوم القانونية تصدر درجات نمط NeurIPS (الابتكار والصرامة والوضوح والتكاثر والأثر) ؛ إذا انخفض متوسطها دون العد ، فإن الورقة تعود إلى الكاتب مع النقد.

السلامة تحمل الحمل. كل تجربة تعمل في صندوق رمل E2B أو Daytona بدون خروج شبكة، ومرحلة الحائط المحدودة، وحدود الموارد. خطوة إنتاج الرمز العميل تمر عبر طبقة سياسة التي تحجب الاتصالات النظامية التي تتفرى من صندوق الرمل. تقرير الفريق الأحمر يعيد سطح الهجوم الموثقة سكانا (قنابل الشوك، وتفريغ نظام الملفات، LLM المكتوبة مكالمات الشبكة).

## الهندسة المعمارية

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## الـ"كثيرة"

- التنسيق: لنجراف مع نقاط التفتيش والبوابات الموافقة البشرية
- بحث الأشجار: أفضل أول على عقدة التجربة المخصصة (شكل AB-MCTS من Sakana v2)
- صندوق الرمل: E2B لكل تجربة، Docker-in-Docker fallback؛ حدات الموارد عبر مجموعات
- الأدب: API المعلمة المفصلية + OpenAlex + الاحتفاظ المحلي FAISS من الموجات
- كاتب: قالب LaTeX + Claude Opus 4.7 (وضع الرؤية) لمراجعة الصور وتخطيطها
- المراجعة: مجموعة من 5 قضاة (أوبوس 4.7 ، GPT-5.4 ، جيميني 3 برو ، ديب سيك R1 ، Qwen3-ماكس) مع جمع معتمد
- إطار التجارب: PyTorch 2.5 للتجارب الفيزيائية، W&B للتقطيع
- قابلية للملاحظة: لنجفوز لمتابعة العميل، 30 دولار بقيمة صعبة لكل ورقة

```figure
ce-experiment-tree
```

## بناءها

1. **Seed and domain scoping.**خذ فكرة البذور (على سبيل المثال "تحقيق أنماط التناثر في خرائط الانتباه من محولات فرع-1B"). حدد مساحة البحث: نماذج ومجموعات بيانات وميزانية الحساب.

2. **Literature pass.**استفسار عالم النطاقات + OpenAlex لـ 50 ورقة ذات صلة أكثر المشاركات؛ محفظة الاحتفاظ بإجراءات محلية؛ توليد محفظة ذات صفحة واحدة.

3. **Tree scaffolding.**إبدأ الجذر مع فرضية البذور.`expand(node) -> children`مع مقترحات تحرير صغيرة (تغيير إعداد واحد لكل طفل).`score(node)`كجديد موازن × جودة × مدة ميزانية.

4. **Sandbox wrapping.**كل تجربة تعمل`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`يتم كتابة البذور على صندوق الرمال، يتم تركيب المخرجات للخروج فقط للقراءة.

5. **Plan-execute-verify loop.** `plan`يقدم الأطفال.`execute`يدير صندوق الرمل، ويستولى على السجلات والمقاييس`verify`يقوم بإجراء فحوصات وحدة على المقاييس (هل انخفض الخسارة؟ هل عزل التأثير؟)

6. **Writer.**بعد الميزانية، حدد أفضل فرع. قم بتقديم الأرقام باستخدام مقطوعة المصفوفات. قم بتوليد مسودة لتكس عبر كلود أوبوس 4.7 مع تعقب الفرع في السياق. قم بتجميع. قم بإعادة PDF المجمّع إلى رؤية أوبوس 4.7 للنقد. قم بتكرار.

7. **Reviewer ensemble.**خمسة قضاة يدرسون المسودة على (الابتكار والصرامة والوضوح والتكاثر والأثر) مع أسمائح نمط NeurIPS. إذا كان متوسط < 4.0/5, عودوا إلى الكاتب مع النقد. توقف صعب بعد 3 إعادة كتابة.

8. **Red team.**بناء أو دمج مجموعة من المهام المتضاربة التي تستهدف صندوق الرمل: قنابل الشوكة، محاولات إزالة الشبكة، الهروب من نظام الملفات، طرازات القذيفة المكتوبة في LLM. تأكد من حجب جميعها. اكتب النتائج.

9. **Reproducibility.**كل ورقة شحن مع بحثها شجرة تتبع JSON، البذور، W&B تشغيل روابط، صناديق الرمل، و README تكرارها نهاية إلى نهاية.

## استخدمها

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## أرسله

`outputs/skill-ai-scientist.md`وذلك في حالة وجود فكرة بذرة + نطاق + ميزانية 30 دولار، فإنه يدير خط الأنابيب الكامل ويعرض ورقة قابلة للمراجعة بالإضافة إلى مجموعة قابلة للتكرار.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## التمارين

1. قم بتشغيل خط الأنابيب ضد ثلاثة أفكار بذرة مختلفة في نفس المجال، قارن أي أجزاء من بحث الأشجار تتداخل، حدد الحسابات المزدوجة المهدرة.

2. إضافة البوابة البشرية في الحلقة قبل تنفيذ التجربة للعقدات التي تقدر أعلى من 5 دولار. قياس كم تنخفض التكلفة الإجمالية.

3. تغيير مجموعة المراجعين مقابل قاض واحد، قياس معدل قبول الكذب على مجموعة من الأوراق السيئة المعروفة.

4. إدخال اختبار فريق حمراء لتفريغ الشبكة: وكيل يكتب الرمز الذي يحاول`curl`عنوان خارجي تأكد`--network=none`السياسة تمنعها، سجل المحاولة

5. مقارنة بحثك عن الأشجار مع خط أساس عشوائي مسطح (مثل الميزانية، لا استراتيجية التوسع).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## المزيد من القراءة

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) وكيل أبحاث الإنتاج المرجعي
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) المنهج الأصلي
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) التوسع التطوري
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory)إطار مختبر البحوث متعددة الأدوار
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) طبقة تشكيل المرجعية
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) البحث في الأدب
- [E2B sandboxes](https://e2b.dev)عزل تجربة مرجعية
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) الرسم الذي يرمزه مجموعة المراجعة
