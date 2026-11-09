# أجهزة الدردشة  قواعد القاعدة إلى العصبية إلى وكلاء LLM

> أجابت إليزا مع مطابقة الأنماط. قام DialogFlow بتحديد النية. أجاب GPT من الوزن. قام كلود بتشغيل الأدوات والتحقق. حل كل عصر أسوأ فشل في السابق.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## المشكلة

يقول المستخدم "أريد تغيير رحلتي". يجب على النظام معرفة ما يريدونه، وما المعلومات المفقودة، وكيفية الحصول عليها، وكيفية إكمال الإجراء. ثم يقول المستخدم "انتظر، ماذا لو ألغيت بدلاً من ذلك؟" ويجب على النظام تذكر السياق، وتغيير المهام، والحفاظ على الحالة.

المحادثة صعبة لنظام ML. المدخل مفتوح. يجب أن تكون الخروج متماسكة على مدار عدة جولات. قد يحتاج النظام إلى التصرف على العالم (تغيير رحلة، شحن بطاقة). كل خطوة خاطئة مرئية للمستخدم.

وقد تمت الدورة عبر أربعة نماذج، كل منها قدمت لأن الأول فشل بشكل مرئي. هذا الدروس يمر بهم في الترتيب. إن منظومة الإنتاج 2026 هي هجينة من الاثنين الأخيرين.

## المفهوم

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### نصف القرن المخطوط 1950-2001

لم تستمر النموذج الأول خمس سنوات. استمر خمسين عامًا. معرفة قوسها مهمة لأن كل نظام فيه هو نفس الآلة  تتناسب مع إدخال ، وإصدار استجابة في حلبة ، وتحديث حالة صغيرة  وخمسين عامًا من إضافة القواعد إلى تلك الآلة لم تنتج الحالة العامة. هذا السقف هو السبب في وجود النموذجين من اثنين إلى أربعة.

**1950.**يتجنب تورينج "هل يمكن للآلات أن تفكر؟" عن طريق اقتراح بديل عملي: إذا لم يتمكن المحقق من معرفة الآلة عن شخص عبر النموذج التلفزيوني، فإن السؤال الفلسفي غير متنازع. تصبح المحادثة مقياسًا للمجال قبل أن يكون للمجال اسمًا.

**1956.**يصل الاسم إلى ورشة عمل صيفية في دارتموث "الذكاء الاصطناعي" على افتراض أن كل سمة من أشكال الذكاء "يمكن أن يتم وصفها بدقة من حيث المبدأ بحيث يمكن صنع آلة لمحاكتها".

**1966.**إليزة ترسل خدعة التفكير التي تقوم ببناءها في الخطوة الأولى: قواعد التفكك تسحب شظايا من المدخلات، قواعد إعادة الجمع تتردد إليها مرة أخرى كأسئلة. حوالي 200 نمط إجمالي، صفر حالة، صفر فهم  والمستخدمين يثقون بها على أي حال. قضى وايزنبوم بقية حياته المهنية مهتمًا بمقدار الآلات التي استغرقها.

**1972.**"باري" ، الذي تم بناؤه في جامعة ستانفورد على نموذج من المفارقة، يضيف قطعة لم تكن موجودة في "إليزيا": الحالة الداخلية. المتغيرات الرقمية للخوف والغضب وعدم الثقة تتحديث في كل جولة و بوابة يتم إطلاق النص التالي، لذا فإن المدخلات المتطابقة تنتج استجابات مختلفة اعتمادا على المحادثة حتى الآن. في اختبار نسخة أعمى، قام أطباء النفس بتمييز (باري) عن المرضى البشريين إنه الجدول المباشر لمكافحة الشخصية  نظام سريع يتم تنفيذه كثلاثة طواف. في نفس العام، تم توجيه الروبوتين إلى بعضهم البعض عبر ARPANET: نص معالج يجري مقابلة مع آلة حالة الارتباك، أول محادثة من روبوت إلى روبوت على شبكة.

**1995.**تقدم ALICE وصفة ELIZA مع AIML ، وهي لغة XML لأزواج الشكلات والعلامات. حوالي 40،000 فئة مكتوبة يدويا ، فازت بجائزة لوبنر ثلاث مرات. أثبتت قانون تقدم النظم القائمة على القواعد: المزيد من القواعد تشتري التغطية ، لا توجد عمومية. كل قاعدة هي مسؤولية يجب على شخص ما الاحتفاظ بها.

**2001.**وضع SmarterChild الوصفة أمام 30 مليون مستخدم رسالة فورية و يضيف البحث الخلفي  الطقس، الأسهم، أوقات الفيلم  المزجة في الشبابات. Squint و هو أداة الدعوة ارتداء زي 2001: تحليل نية، ودعوة خدمة، عرض النتيجة في الإجابة.

50 عاماً، تُعدّ آلية واحدة، قاعدة متزايدة، انتهت النموذج ليس لأن أحداً ما نفى ذلك، ولكن لأن تكلفة صيانة الآلات المكتوبة يدوياً تنمو خطياً مع التغطية بينما تتوقع المستخدمون أن تنمو مع ما رأوه الأسبوع الماضي.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**النماذج المكتوبة يدوياً تتطابق مع مدخلات المستخدم وتنتج استجابات. يقوم مصنفون النية بتوجيه التدفقات المحددة مسبقاً. تقوم آلات ملء الحالة بتجميع المعلومات المطلوبة. تعمل بشكل رائع داخل النطاق الضيق الذي تم تصميمه له. تفشل مباشرة خارجها. لا تزال تسير في مجالات حرجة للسلامة (تصديق المصرف ، حجز الطيران) حيث لا يتم التسامح مع الهلوسة.

**Retrieval-based.**نظام على شكل أسئلة استبيانية. قم بتشفير كل زوج من (التعبير، الاستجابة). في وقت تشغيل، قم بتشفير رسالة المستخدم واسترداد أقرب رد مخزن. فكر في ميزة "المواد المماثلة" الكلاسيكية في Zendesk. يتعامل مع المقاطع أفضل من القواعد. لا يوجد جيل، لذلك لا توجد توهينات.

**Neural (seq2seq).**يقوم المُشفّر بتشخيص المحادثات بتدريب على سجلات المحادثات. يُولد ردود الفعل من الصفر. يتدفق بشكل سريع ولكن معتاد على نتائج عامة ("لا أعرف") والتحرك الفعلي. لا يُعتمد على الموضوع أبداً. السبب في أنّ جوجل وفيسبوك ومايكروسوفت جميعًا كان لديهم أجهزة دردشة مخيبة للآمال في 2016-2019.

**LLM agents.**نموذج لغة مغلف في حلقة تخطيط، ودعوة الأدوات، وتحقق من النتائج. ليس روبوت دردشة مع عرض طويل. حلقة وكيل: خطط → دعوة أداة → مراقبة النتيجة → تحديد الخطوة التالية. استرداد-أول الأرض (RAG) يحميها من الهلوسة. دعوات الأداة تدعها تفعل الأشياء بالفعل. هذه هي بنية 2026.

هذه النماذج الأربعة ليست استبدالات متسلسلة. إنتاج 2026 يتحرك عبر كل أربعة: القواعد القائمة على المصادقة والإجراءات المدمرة، الاسترداد للأسئلة المتكررة، وتوليد الأعصاب للصيغة الطبيعية، وكيل LLM للاستفسارات المفتوحة المزدوجة.

## بناءها

### الخطوة الأولى: مطابقة النمط القائم على القواعد

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

اليزا في 20 سطر. خدعة التفكير ("أشعر بالأسف" → "لماذا تشعر بالأسف") هو عرض العلاج النفسي القنوني من ويزنباوم 1966.

### الخطوة الثانية: استرداد القائمة على الأسئلة

هذا المقطع الموضح يتطلب`pip install sentence-transformers`(الذي يجذب المصباح) القابلة للجري`code/main.py`لهذا الدروس يستخدم مثلة جاكارد ستدليب بدلاً من ذلك، لذلك الدروس تعمل دون اعتمادات خارجية.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

الرفض القائم على العدوان هو اختيار التصميم الرئيسي إذا لم يكن أفضل مطابق قريب بما فيه الكفاية، أعد `None`و دع النظام يتصاعد

### الخطوة الثالثة: توليد العصبية (الخط الأساسي)

استخدم جهاز تشفير-تشفير صغير مع ضبط التعليمات (FLAN-T5) أو نموذج محادثة معدل. إنتاج غير صالح للاستخدام بمفرده في عام 2026 (تناقض، غياب الموضوع، الهراء الواقعي) ، ولكن السفن داخل أنظمة هجينة للفصائل الطبيعية. تحتاج نماذج القيادة المعدلة على شكل DialoGPT فقط إلى مفصلات الدوران الصريحة ومعالجة EOS لإنتاج إجابات متماسكة. يعمل خط أنابيب النص2 النص FLAN-T5 خارج الصندوق لمثال تدريسي.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### الخطوة الرابعة: حلقة الوكيل LLM

شكل الإنتاج لعام 2026:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

ثلاثة أشياء لسمها. الأدوات هي وظائف قابلة للدعوة يمكن أن يستدعيها ماجستير في التدريب. تنتهي الحلقة عندما يعود ماجستير في التدريب الإجابة النهائية بدلاً من دعوة الأدوات. يمنع ميزانية الخطوة حلقات لا نهاية لها على المهام الغامضة.

إنتاج حقيقي يضيف: استرداد الأرض أولاً (إدخال وثائق ذات صلة قبل كل مكالمة LLM) ، والحواجز (رفض الإجراءات المدمرة دون تأكيد) ، واللاحظة (سجل كل خطوة) ، والتقييمات (التحقق الآلي من أن سلوك العميل يبقى على المواصفات).

### الخطوة 5: توجيه الهجين

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

النمط: قواعد تحديدية لأي شيء مدمرة، استرداد الأسئلة المطلوبة في الحلبة، وكلاء القانون لكل شيء آخر. هذا ما يُرسله في 2026 أنظمة دعم العملاء.

## استخدمها

"مجموعة 2026"

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

استخدم دائما التوجيه الهجري في الإنتاج. لا يوجد بنية واحدة تتعامل مع كل طلب بشكل جيد. طبقة التوجيه نفسها عادة ما تكون تصنيفية نية صغيرة.

## أساليب الفشل التي لا تزال تشحن

- **Confident fabrication.**الوكيل القانوني يدعي أنه أكمل إجراء لم يفعله التخفيف: التحقق من النتائج، تسجيل المكالمات الأداة، لا تدع القانوني يدعي أن شيئاً قد قام به دون عودة أداة ناجحة.
- **Prompt injection.**يضيف المستخدم نصًا يُجاوز طلب النظام. تم تصنيف LLM01 في Top 10 في OWASP لتطبيقات LLM 2025. هناك طعمين: حقن مباشر (ملتصق به في الدردشة) والحقن غير مباشر (مختبئ في الوثائق أو الرسائل الإلكترونية أو أدوات الناتج التي يقرأها الوكيل).

  معدلات الهجمات تختلف حسب السيناريو. تتراوح معدلات النجاح المقاسة بين ~ 0.5 - 8.5 في المائة على مستوى النماذج الحدودية في معايير الاستخدام العام للأدوات والتعريفات. وصلت إعدادات عالية المخاطر المحددة (الهجمات التكيفية ضد عوامل تشفير الذكاء الاصطناعي، والترتيبات الضعيفة) إلى 84٪. تشمل إيكو ليك (CVE-2025-32711, CVSS 9.3)  خطأ في إزالة البيانات من خلال النقر الصفر في Microsoft 365 Copilot الذي أدى إلى رسالة بريد إلكتروني يتم السيطرة عليها من قبل المهاجم.

  التخفيف: تعامل مدخلات المستخدم كغير موثوق بها طوال الحلقة ؛ تنظيف قبل دعوات الأداة ؛ عزل نتائج الأداة من المطلب الرئيسي ؛ استخدام نمط خطة التحقق من التنفيذ (PVE) حيث يقوم العميل بالتخطيط أولاً ، ثم يصدق كل إجراء ضد تلك الخطة قبل تنفيذها (هذا يمنع نتائج الأداة من حقن إجراءات جديدة غير مخطط لها) ؛ يتطلب تأكيد المستخدم للقيام بأفعال مدمرة ؛ تطبيق أقل امتيازات على نطاقات الأداة.

  لا توجد كمية من الهندسة السريعة التي تُزيل هذا الخطر بالكامل.
- **Scope creep.**يذهب العميل خارج المهمة لأن مكالمة الأداة أعادت المعلومات ذات الصلة بالتشابك. التخفيف: عقود الأداة الضيقة ؛ الحفاظ على تركيز النظام على الفور ؛ إضافة التقييمات لمعدل خارج المهمة.
- **Infinite loops.**العميل يستمر في الاتصال بنفس الأداة التخفيف: ميزانية خطوة، إزالة أداة الاتصال، قاضي ماجستير في "هل نحن نقدم"
- **Context window exhaustion.**المحادثات الطويلة تدفع الأوائل خارج السياق. التخفيف: تلخيص التحولات القديمة، استرداد التحولات السابقة ذات الصلة من خلال التشابه، أو استخدام نموذج سياق طويل.

## أرسله

إبقوا`outputs/skill-chatbot-architect.md`:

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## التمارين

1. **Easy.**تنفيذ الاستجابة القائمة على القواعد أعلاه مع 10 أنماط لشركة البوت لتطلب مقهى. حالات اختبار الحافة: طلبات مزدوجة، تعديلات، إلغاء، نية غير واضحة.
2. **Medium.**بناء سؤال متسلسل + تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تقديم تق
3. **Hard.**قم بتنفيذ حلقة الوكيل أعلاه مع ثلاث أدوات (البحث ، البيانات القراءة للمستخدم ، إرسال البريد الإلكتروني). قم بتقييم مع 50 سيناريو اختبار بما في ذلك محاولات الحقن السريع. أبلغ عن معدل إيقاف المهمة ، ومعدل فشل المهمة ، وأي نجاح في الحقن.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## المزيد من القراءة

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) الورقة التي جعلت المحادثة مقياس المجال.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf)ورقة "تشاتبوت" الأصلية القائمة على القواعد
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  بنية PARRY المتغيرة تأثير، أول مشغل دردشة دولية.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239)ورقة "جوجل" المتأخرة عن "الـ"نورال تشاتبوت" قبل أن يتولى عملاء "الـ"ل"
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)الورقة التي سميت نمط حلقة العميل.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) التوقعات الإنتاجية لعام 2024 التي لا تزال قائمة في عام 2026.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) ورقة الحقن السريع
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) التصنيف الذي جعل الحقن السريع القلق الأساسي للأمن.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) دفاعات عملية في طبقة التنسيق بما في ذلك تدفقات خطة التحقق من التنفيذ وتأكيد المستخدم.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) CVE القنوني لتحرير البيانات من خلال النقر الصفر من حقن محرر غير مباشر. حالة مرجعية لماذا وكلاء الوصول الكتابي يحتاجون إلى دفاعات في الوقت الزمني.
