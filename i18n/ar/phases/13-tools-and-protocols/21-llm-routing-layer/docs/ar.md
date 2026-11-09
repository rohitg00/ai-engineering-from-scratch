# LLM طبقة التوجيه  LiteLLM, OpenRouter, Portkey

> إغلاق المزود مكلف تحميلات عمل مختلفة للدعوة إلى الأدوات تناسب نماذج مختلفة. بوابات التوجيه تعطى سطح واحد من API، محاولات إعادة، فشل، تتبع التكاليف، والحواجز. ثلاثة أنواع رئيسية تهيمن على عام 2026: LiteLLM (المصدر المفتوح المضيف الذاتي) ، OpenRouter (التي تدير SaaS) ، Portkey (مصدر الإنتاج ، مفتوح المصدر في مارس 2026. هذه الدروس تعطي أسماء لمعايير القرار وتشكل بوابة توجيه ستدليب.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker), TypeScript
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## أهداف التعلم

- تمييز خيارات التوجيه المضيفة الذاتية والمتدارة ومرحلة الإنتاج.
- تنفيذ سلسلة إرجاعية تستعيد فشل المزودين في ترتيب أولويات محدد.
- تتبع تكلفة الطلب واستخدام الرمز بين المقدمين.
- القرار بين LiteLLM، OpenRouter، و Portkey لقيود الإنتاج معينة.

## المشكلة

سيناريوهات حيث يكون التوجيه للمزود مهم:

1. **Cost.**كلود سونيت يكلف 3 مرات تكلفة هايكو، لمهام التجريب، هيكو كافية، لمهام التجميع، سونيت يستحق ذلك. طريق على الطلب.

2. **Failover.**أوبن آي آي) في وقت سيء) كل طلب يفشل تريد إرجاعك إلى (أنثروبيك) تلقائيًا دون إعادة نشر

3. **Latency.**يتطلب واجهة المحادثة الحية إشارة سريعة من الوقت إلى الأول. لا، لا. طريق من خلال التخفيف SLA.

4. **Compliance.**يجب على مستخدمي الاتحاد الأوروبي البقاء في مناطق الاتحاد الأوروبي.

5. **Experimentation.**طرازين على نفس الحمل، طريقًا بتحديد المختبرات

التشفير اليدوي لكل هذا التكامل متكرر. بوابة توجيه تعطى API متوافقة مع OpenAI ويتعامل مع الباقي.

## المفهوم

### شكل النظام الأساسي المتوافق مع OpenAI

الجميع يتحدثون على شكل OpenAI.`/v1/chat/completions`، يقبل مخطط OpenAI ، ويقوم بالوكالة الداخلية إلى Anthropic / Gemini / Cohere / Ollama / أي شيء. العميل لا يهتم.

### الاسم الاسمية النموذجية

بدلاً من تحديد المقطع، رمزك يقول`our_smart_model`عندما يقوم مزود بعمل جيل جديد، تغير اسم الخادم الجانب؛ رمزك لا يلمس شيئا.

### السلاسل الخلفية

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

و يحدد البوابات هذا في إعداد، وتعد التجربات المتأخرة مقابل ميزانية حتى لا تنفجر التكاليف.

### الاحتفاظ بالتخزين

يصل الإشارات المتماثلة أو شبه المتماثلة إلى التخزين بدلاً من المقدم. يمكن أن تكون التوفيرات على حلقات الوكيل المتكررة 30 إلى 60 في المائة. المفاتيح تستند إلى التضمين. تشترك الإشارات المتماثلة تقريباً في فتحة التخزين.

### الحراسة

مستوى البوابة:

- **PII redaction.**إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال إرسال
- **Policy violations.**رفض الإشارات التي تحتوي على محتوى محظور
- **Output filters.**أزفوا الأجزاء من أجل التسرب

(بورتكي) و (كونغ) كلاهما يطلقان على الحراسة المختلفة

### حدود أسعار كل مفتاح

مفتاح API واحد = فريق واحد. ميزانيات لكل مفتاح تمنع فريق واحد من استهلاك الحصة المشتركة. معظم البوابات تدعم هذا.

### التداولات المضيفة ذاتيا مقابل التداولات المدارة

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

فاز LiteLLM عندما يكون لديك فريق SRE وتريد سيادة البيانات. فاز OpenRouter عندما تريد اشتراك واحد وليس إضفاء التأثير. فاز Portkey عندما تحتاج إلى الحواجز والامتثال خارج الصندوق.

### تتبع التكاليف

كل طلب يحمل`provider`،`model`،`input_tokens`،`output_tokens`. مضاعفة بالأسعار لكل نموذج لكل رمز (مستمدة من ورقة الأسعار التي يحتفظ بها البوابة).

### MCP + توجيه

يمكن لبرة توجيه كل من مكالمات LLM وطلبات أخذ العينات من MCP. عندما يفضل نموذج طلب أخذ العينات نموذجًا محددًا ، فإن البوابة تترجم إلى الخلفية اليمنى. هذا هو المكان الذي يتم فيه دمج مرحلة 13 · 17 (بوابة MCP) وبوابة توجيه هذه الدروس في بعض الأحيان في خدمة واحدة.

### استراتيجيات التوجيه

- **Static priority.**أول من قائمة، تراجع عن الخطأ.
- **Load balancing.**- كرة حلقة أو مُزنة
- **Cost-aware.**اختر أرخص نموذج لقاء تأخير / جودة.
- **Latency-aware.**اختر أسرع طراز في آخر 9 دقائق
- **Task-aware.**طرق التصنيف السريع التشفير إلى نموذج واحد، والتمويل إلى آخر.

```figure
tp-router-failover
```

## استخدمها

`code/main.py`ينفذ بوابة توجيه في ~ 150 سطر: يقبل طلبات على شكل OpenAI ، ويتحول إلى أجزاء لكل مزود ، ويقوم بتشغيل سلسلة إرجاع الأولوية ، ويقوم بتتبع تكلفة كل طلب ، ويتم تطبيق مرسلة تحرير PII على المدخلات. قم بتشغيله مع ثلاث سيناريوهات: طلب طبيعي ، وتعطيل مزود أساسي يؤدي إلى إرجاع ، وتسريب PII الذي يتم اكتشافه عن طريق التحرير.

ما الذي يجب أن ننظر إليه:

- `ROUTES`dict: alias -> قائمة مقدمي الخدمات المحددة حسب الأولوية.
- حاولوا مرة أخرى على 5xx
- متابعة التكاليف تضاعف استخدام الرمز بالأسعار لكل نموذج.
- محرر المعلومات يقوم بتنظيف الأنماط ذات شكل SSN قبل إعادة إرسالها.

## أرسله

هذا الدرس يُنتج`outputs/skill-routing-config-designer.md`نظراً لملف تحميل العمل (التأخير والتكلفة والامتثال) ، فإن المهارة تختار LiteLLM / OpenRouter / Portkey وتنتج إعدادات التوجيه.

## التمارين

1. أركض`code/main.py`. تنشئ سيناريو انقطاع الطاقة؛ تأكد من أن الهبوط على المقدم الثاني وتحديد التكلفة بشكل صحيح.

2. إضافة التخزين الآلي: SHA256 من الإشارة هي مفتاح البحث؛ إضافة التخزين الآلي تعود على الفور. قياس التوفيرات على تكاليف المكالمة المتكررة.

3. إضافة تصنيف سريع يُوجّه "رمز ..." يُطلب إلى مستعار يُفضل الذكاء و "التجميع ..." يُطلب إلى مستعار يُفضل السرعة.

4. تصميم ميزانيات الفريق الواحد: لكل فريق حدة نفقات شهرية؛ Gateway يرفض الطلبات بمجرد أن يتم ضرب حدة. اختيار التنفيذ الكبيرة (للأطلب أو النافذة).

5. اقرأ وثائق LiteLLM و OpenRouter و Portkey جنبا إلى جنب.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## المزيد من القراءة

- [LiteLLM — docs](https://docs.litellm.ai/) بوابة توجيهية مضيفة ذاتية
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) إدارة توجيه SaaS
- [Portkey — docs](https://portkey.ai/docs) توجيه الإنتاج مع الحواجز
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) دليل القرار
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) استبيان البائعين
