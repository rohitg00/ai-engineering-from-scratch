# وكلاء المتصفحات ومهام الويب طويلة الأجل

> وكيل ChatGPT (يوليو 2025) دمج المشغل والبحث العميق في أحد العباء / وكيل المحطة ووضع BrowseComp SOTA عند 68.9٪. أغلقت OpenAI شركة "أوبريتر" في 31 أغسطس 2025  التوحيد في طبقة المنتجات. استحواذ شركة أنثروبيك على Vercept نقل كلود سونيت على OSWorld من أقل من 15٪ إلى 72.5٪. تم تصحيح WebArena-Verified (ServiceNow ، ICLR 2026) ، وصل معدل ~11.3% من السلب الكاذب في WebArena الأصلي وشحن مجموعة فرعية Hard ذات 258 مهمة. الأرقام حقيقية كما هو الحال في سطح الهجوم: أعلن رئيس إعداد OpenAI علناً أن الحقن العريض غير المباشر في عناصر المتصفح "ليس خطأ يمكن تصحيحه بالكامل". تم توثيق هجمات 20252026: الذكريات الملوثة (Atlas CSRF) ، هاش جاك (شبكات Cato) ، وخاطفات بنقرة واحدة في Perplexity Comet.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## المشكلة

وكيل المتصفح هو وكيل طويل الأفق الذي يقرأ المحتوى غير الموثوق به ويأخذ إجراءات متتالية. كل صفحة يزورها الوكيل هي مدخل لم يكتبها المستخدم كل نموذج على كل صفحة هو قناة قيادة محتملة. يظهر مجموعة الهجمات 20252026 أن هذا ليس افتراضيًا: تسمح "ذاكريات ملوثة" للمهاجم بتربط التعليمات الضارة بذاكرة العميل عبر صفحة صناعية؛ يخبأ HashJack الأوامر في شظايا URL التي يزورها العميل؛ يستخدم طائرات Perplexity Comet اختطافات نقرة واحدة.

الصورة الدفاعية غير مريحة. قال رئيس إعداد OpenAI أن الجزء الهادئ بصوت عال: الحقن العكسي غير المباشر "ليس خطأ يمكن تصحيحه بالكامل". هذا لأن الهجوم يعيش في حدود العميل القراءة مقابل التصرف ، والتي هي غير واضحة من الناحية المعماري.

هذه الدروس تسمى سطح الهجوم، وتسمى المشهد المرجعي (BrowseComp، OSWorld، WebArena-Verified) ، وتصوير سيناريو الحد الأدنى من الإشارة غير المباشرة على الفور حتى تتمكن من التفكير حول الدفاعات الحقيقية في الدروس 14 و 18.

## المفهوم

### المشهد لعام 2026، في فقرة واحدة لكل نظام

**ChatGPT agent (OpenAI).**أطلقت يوليو 2025. يوحد المشغل (المتصفح) والبحوث العميقة (البحث المتعدد الساعات). أغلقت المشغل المستقل في 31 أغسطس 2025. SOTA على BrowseComp عند 68.9%؛ أرقام قوية على OSWorld و WebArena- Verified.

**Claude Sonnet + Vercept (Anthropic).**ركزت عملية استحواذ شركة أنثروبيك على قدرات استخدام الكمبيوتر. نقل كلود سونيت على OSWorld من <15٪ إلى 72.5٪.

**Gemini 3 Pro with Browser Use (DeepMind).**برنامج التكامل في استخدام المتصفح يقدم التحكم في استخدام الكمبيوتر. FSF v3 (أبريل 2026، الدروس 20) تتبع الاستقلال في مجال البحث والتطوير في ML بشكل خاص.

**WebArena-Verified (ServiceNow, ICLR 2026).**يصلح مشكلة وثيقة: كان لدى WebArena الأصلي معدل إيجابي كاذب بنسبة ~11.3% (المهمات المشار إليها فشلت التي تم حلها بالفعل). يقوم الإصدار المحقق بإعادة تصنيفها مع معايير النجاح التي يتم تطبيقها من قبل البشر ويزيد مجموعة فرعية Hard من 258 مهمة (ورقة ICLR 2026 ، openreview.net/forum?id=94tlGxmqkN).

### براؤز كومب vs أوس وورلد vs ويب آرينا

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

نقاط مختلفة. درجة عالية من BrowseComp تقول أن الوكيل يجد الحقائق؛ لا تقول أن الوكيل يمكن حجز رحلة. درجة OSWorld أقرب إلى "هل يعمل على سطح المكتب الخاص بي".

### سطح الهجوم، سميت

1. **Indirect prompt injection.**تحتوي محتوى الصفحة غير الموثوق بها التعليمات. يقوم الوكيل بقراءتها. يقوم الوكيل بتنفيذها. أمثلة عامة: 2024 Kai Greshake et al., 2025 ورقة ذكريات ملوثة, 2026 HashJack (شبكات Cato).
2. **URL fragment / query injection.**- نعم`#fragment`أو سلسلة استفسار من عنوان URL المتصفح تحتوي على أوامر. لم يتم إظهارها بشكل مرئي ، لا يزال داخل سياق الوكيل.
3. **Memory-binding attacks.**تصدر Page تعليمات للعميل لكتابة ذاكرة ثابتة (تغطي الدروس 12 حالة دائمة). في الجلسة التالية، تقوم الذاكرة بإطلاق الحمل المفيد دون وجود محفز مرئي.
4. **CSRF-shaped attacks on authenticated sessions.**فئة الذكريات الملوثة: يتم تسجيل الدخول إلى مكان ما؛ صفحة المهاجم تنشر طلبات تغيير الحالة التي يقوم الوكيل بتنفيذها مع ملفات تعريف الارتباط للمستخدم.
5. **One-click hijack.**زر غير مضر بصرياً يُركب على عبء مفيد يتبعه العميل
6. **Content-Security-Policy holes in the agent's host surface.**يمكن أن تكون طبقات التصوير والأدوات نفسها متجهات الهجوم؛ ومجموعة المتصفح في المتصفح وكيل واسعة.

### لماذا "لا يمكن تصحيحها بالكامل"

الهجوم هو متوازي مع قدرات العميل. يجب على العميل قراءة محتوى غير موثوق به ليفعل عمله أي محتوى يقرأه العميل قد يحتوي على تعليمات أي تعليمات يتبعها الوكيل يمكن أن تكون غير متوافقة مع الطلب الفعلي للمستخدم. الدفاعات (حدود الثقة، المصنفات، أدوات السماح، HITL على الإجراءات التالية) يزيد من تكلفة الهجوم ويقلل من نصف قطر الانفجار. لا يغلقون الفصل

هذا هو نفس نمط التفكير مع نظرية لوب (الدرس 8): لا يمكن للوكيل إثبات أن الرمز التالي آمن؛ فإنه يمكن أن يضع فقط نظام حيث الرمز غير آمن أكثر قابلية للكشف.

### وضعية الدفاع التي في الواقع سفن

- **Read / write boundary.**القراءة لا تكون أبداً نتيجة. الكتابة (إرسال نموذج، نشر المحتوى، دعوة أداة ذات آثار جانبية) تتطلب موافقة بشرية جديدة إذا كان المحتوى المبدع قادمًا من خارج حدود الثقة.
- **Tool allowlist per task.**يمكن للعميل التصفح؛ لا يمكن أن يبدأ عملية تحويل النقدية إلا إذا تم تمكين هذه الأداة صراحة للمهمة.
- **Session isolation.**جلسات وكيل المتصفح تعمل مع إثباتات محددة فقط. لا مؤلف إنتاج، لا بريد إلكتروني شخصي. سجلات كل طلب HTTP تحتفظ للتدقيق.
- **Content sanitizer.**يتم تجريد HTML المجمّع من الأنماط السيئة المعروفة قبل أن يتم تشبيكها في سياق النموذج. (يقلل من الهجمات السهلة؛ لا يوقف الحملات المفيدة المتطورة.)
- **HITL on consequential actions.**نمط الاقتراح ثم التزام (الدرس 15).
- **Canary tokens on memory.**إذا اشتعلت مدخلات الذاكرة، يراه المستخدم (الدرس 14).

```figure
injection-boundary
```

## استخدمها

`code/main.py`يظهر النص (أ) ما الذي سيفعله وكيل ساذج ، (ب) ما يلتقط حد القراءة / الكتابة ، (ج) ما يلتقط المطهر ، (د) ما لا يلتقط.

## أرسله

`outputs/skill-browser-agent-trust-boundary.md`يطرح نطاق نشر عامل المتصفح المقترح: أي مناطق الثقة التي تلمسها، ما الذي يُسمح لها بالكتابة، وما هي الدفاعات التي يجب أن تكون في مكانها قبل الركض الأول.

## التمارين

1. أركض`code/main.py`تحديد أي هجوم يلتقط المطهر ولكن الحدود القراءة / الكتابة لا تفعل ، والتي تهاجم فقط الحدود القراءة / الكتابة.

2. تمديد المطهر للكشف عن فئة واحدة من حقن هاش جاك نمط URL- اقتزاز. قياس معدل الإيجابية الخاطئة على عناوين URL الخيرية مع اقتزازات مشروعة.

3. اختر سير عمل عميل متصفح حقيقي تعرفه (على سبيل المثال "حجز رحلة"). قم بإدراج كل قراءة وكل كتابة. علامة التي تكتب تحتاج إلى HITL ولماذا.

4. اقرأ ورقة ICLR 2026 المحققة من WebArena. حدد فئة من المهام التي لم تكن درجة WebArena الأصلية موثوقة وتوضح كيفية حل مجموعة فرعية المحققة لها.

5. تصميم قناري ذاكرة لتنظيم عامل المتصفح. ماذا ستخزن، أين، وما الذي يثير الإنذار؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## المزيد من القراءة

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) دمج المشغل والبحث العميق؛ BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) سلسلة المشغل والهندسة المعمارية التي أصبحت وكيل ChatGPT.
- [Zhou et al. — WebArena](https://webarena.dev/) المعيار المرجعي الأصلي.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) ورق ICLR 2026 ذو مجموعة ثابتة.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) يتضمن مناقشة سطح الهجوم لعاملين استخدام الحاسوب.
