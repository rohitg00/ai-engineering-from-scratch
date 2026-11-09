# الوظيفة التي تدعو للغوص العميق  OpenAI، الأنثروبيك، جيمين

> تجمع مزودي الحدود الثلاثة على نفس حلقة الاتصال بالأدوات في عام 2024 ثم اختلفوا على كل شيء آخر.`tools`و`tool_calls`. الاستخدامات الإنسانية`tool_use`و`tool_result`الكتل التي يستخدمها التوأم`functionDeclarations`هذه الدروس تفرق الثلاثة جانبا إلى جانبه بحيث لا يتم كسر الرمز الذي يتم شحنه على مزود واحد عندما تقوم بتنفيذه.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## أهداف التعلم

- أوضح الفرق الثلاثة في الشكل بين OpenAI و Anthropic و Gemini (إعلان ، دعوة ، نتيجة).
- ترجمة إعلان واحد للأداة عبر جميع تنسيقات المزودين الثلاثة وتنبؤ بمكان تختلف قيود الوضع الصارم.
- استخدام`tool_choice`في كل مزود لإجبار، أو منع، أو اختيار أداة الاتصال تلقائيًا.
- تعرف الحدود القاسية لكل مزود (عدد الأدوات ، عمق النظام ، طول الحجج) وتوقيعات الخطأ التي تنبعثها كل واحد عندما يتم انتهاك الحدود.

## المشكلة

تشكل طلب استدعاء الوظيفة يختلف حسب المقدم. ثلاثة أمثلة ملموسة من مجموعات الإنتاج 2026:

**OpenAI Chat Completions / Responses API.**أنت تمر`tools: [{type: "function", function: {name, description, parameters, strict}}]`. ردة النموذج تحتوي على `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`أين`arguments`هو سلسلة JSON يجب أن تحلل. وضع صارم (`strict: true`) يفرض الامتثال للخطط عبر فك القيود المحدود.

**Anthropic Messages API.**أنت تمر`tools: [{name, description, input_schema}]`ردنا على هذا هو`content: [{type: "text"}, {type: "tool_use", id, name, input}]`. .`input`تم تحليلها بالفعل (شيء وليس سلسلة)`user`رسالة تحتوي على`{type: "tool_result", tool_use_id, content}`-بلوك

**Google Gemini API.**أنت تمر`tools: [{functionDeclarations: [{name, description, parameters}]}]`(مُعَشَّرَة تحت `functionDeclarations`) والرد يأتي ك`candidates[0].content.parts: [{functionCall: {name, args, id}}]`أين`id`هو فريد في جيميني 3 و فوق لتنسيق المكالمة المتوازية.`{functionResponse: {name, id, response}}`. . .

نفس الحلقة، أسماء الميدان المختلفة، وترتيبات مختلفة، وآليات مختلفة للشريط مقابل الكائن، وآليات مختلفة للاتصال. فريق يكتب وكيل الطقس على OpenAI يدفع لميناء يومين إلى "أنثروبيك" و يوم آخر إلى "جيميني" فقط من أجل التبني.

هذه الدروس تبني مترجم يوحد الصيغ الثلاثة في إعلان واحد أداة القنوني والطرق في الحافة. مرحلة 13 · 17 تعميم نفس النمط في بوابة LLM.

## المفهوم

### الهيكل المشترك

كل مزود يحتاج إلى خمسة أشياء:

1. **Tool list.**اسم كل أداة وصف ونظام إدخال.
2. **Tool choice.**أجبري على أداة محددة أو حظر الأدوات أو دع النموذج يقرر
3. **Call emission.**الناتج المهيكلي الذي يسمي الأداة والحجج.
4. **Call id.**ربط الاستجابة بالدعوة الصحيحة (المسائل للموازية).
5. **Result injection.**رسالة أو حظر يربط النتيجة بالاتصال

### اختلافات الشكل، حقلًا بحقل

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | `tool_calls[]` on assistant message | `content[]` of type `tool_use` | `parts[]` of type `functionCall` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI generates) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `user` with `tool_result`, `tool_use_id` | `functionResponse` with matching `id` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | `strict: true` per tool (opt-in) | `responseSchema` at request level |

### الحدود التي ستضربها فعلاً

- **OpenAI.**128 أداة لكل طلب. عمق الخطة 5. سلسلة الحجج <= 8192 بايت. وضع القييد لا يتطلب `$ref`لا , لا`oneOf`-أجل`anyOf`-أجل`allOf`مع التداخل، كل ممتلكات المدرجة في `required`. . .
- **Anthropic.**64 أداة لكل طلب. عمق الخطة لا حدود لها فعلياً ولكن حد عملي 10. استخدام الأدوات الصارمة هو اختيار مع `strict: true`بدونها، النموذج هو عقد يميل إلى اتباعه، وليس ضمان.
- **Gemini.**64 وظيفة لكل طلب. أنواع الخطة هي OpenAPI 3.0 فرعية (اختلاف طفيف من JSON Schema 2020-12). الدعوات المتوازية هو واحد-هوية منذ جيمين 3.

### `tool_choice`السلوك

ثلاثة أنظمة تدعمها الجميع، تسميت مختلفة.

- **Auto.**النموذج يختار الأداة أو النص الافتراضي
- **Required / Any.**يجب أن يتصل النموذج بأداة واحدة على الأقل
- **None.**لا يجب أن تدعو النموذج إلى أدوات

بالإضافة إلى وضع واحد فريد لكل مزود:

- **OpenAI.**اجبر أداة محددة باسمها
- **Anthropic.**إجبار أداة محددة باسمها`disable_parallel_tool_use`العلم يفصل بين واحد مقابل متعدد
- **Gemini.** `mode: "VALIDATED"`يتوجه كل رد عبر مؤكدة النظام بغض النظر عن نية النموذج.

### المكالمات المتوازية

"أوبن آي"`parallel_tool_calls: true`(الديفالتي) ينشر مكالمات متعددة في رسالة مساعدة واحدة. تقوم بتشغيلها كلها وترد برسالة أداة-دور المجموعة التي تحتوي على إدخال واحد لكل`tool_call_id`. إنثروبي تاريخياً كان يطلب مكالمة واحدة`disable_parallel_tool_use: false`(الديفالتي اعتبارا من كلود 3.5) تمكن متعددة. سمح جيميني 2 بالاتصال المتوازي ولكن لم يعطي هواتف مستقرة. جيميني 3 يضيف UUIDs حتى تتواصل استجابات خارج النظام بشكل نظيف.

### التدفق

جميع الدعوات الثلاثة تدعم أداة التدفق. تنسيق الأسلاك يختلف:

- **OpenAI.**قطعات ديلتا من`tool_calls[i].function.arguments`تصل بشكل تدريجي، تتراكم حتى`finish_reason: "tool_calls"`. . .
- **Anthropic.**أحداث البدء المحدد / البلوك-دلتا / وقف المحدد. `input_json_delta`الكتائب تحمل حجج جزئية.
- **Gemini.** `streamFunctionCallArguments`(جديد في جيميني 3) يُصدّر قطع مع `functionCallId`حتى تتمكن مكالمات متوازية متعددة من التقاط.

مرحلة 13 · 03 تدخل عميقًا في إعادة تجميع الموازات + التدفق. يركز هذا الدروس على أشكال الإعلانات والدعوة الواحدة.

### الأخطاء وإصلاحها

أخطاء الحجج غير صالحة تبدو مختلفة أيضا.

- **OpenAI (non-strict).**النموذج يعود `arguments: "{bad json}"`إذا فشلت تحليل JSON، تقوم بإدخال رسالة خطأ وإعادة الاتصال.
- **OpenAI (strict).**يتم التحقق من التحقق من الصحة أثناء فك التشفير . غير صالحة JSON مستحيل ولكن `refusal`يمكن أن تظهر.
- **Anthropic (non-strict).** `input`قد تحتوي على حقل غير متوقعة، النموذج هو نصيحي. تأكيد جانب الخادم. مع `strict: true`، يتم تقييد أخذ العينات على النموذج.
- **Gemini.**المميزة في OpenAPI 3.0: `enum`على حقل الأشياء التي تم تجاهلها بصمت، تأكدي نفسك.

### نمط الترجمة

إعلان أداة طائفية في رمزك يبدو هكذا (انت تختار الشكل):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

ثلاث وظائف صغيرة تحويلها إلى ثلاثة أشكال مزود.`code/main.py`يقوم بذلك بالضبط، ثم يقوم بتجول مكالمة أداة مزيفة عبر شكل استجابة كل مزود. لا توجد شبكة مطلوبة  هذا الدرس يعلم الشكول، وليس HTTP.

فرق الإنتاج تغلف هذا المترجم في`AbstractToolset`(الذكاء الاصطناعي البيانتي)`UniversalToolNode`(لنجراف) ، أو`BaseTool`(LlamaIndex). مرحلة 13 · 17 تشكل بوابة تعرض API على شكل OpenAI أمام أي من الثلاثة.

```figure
function-call-args
```

## استخدمها

`code/main.py`يحدد واحد القنوني `Tool`فهي تقوم بعد ذلك بتحليل استجابة مزود مصنوعة يدويا لكل شكل إلى نفس جسم الدعوة القنوني ، مما يظهر أن التفاصيل نفسها تحت الجلد. قم بتشغيلها وتفاصيل الإعلانات الثلاث جنبا إلى جنب.

ما الذي يجب أن ننظر إليه:

- لا تختلف كتلة الإعلان الثلاثة إلا في أسم الملفات والحقول.
- تختلف كتلة الاستجابة الثلاثة في مكان وجود المكالمة (على مستوى أعلى `tool_calls`،`content[]`الحجر`parts[]`الدخول)
- واحد`canonical_call()`مقتطفات الوظيفة `{id, name, args}`من جميع أشكال الاستجابة الثلاثة.

## أرسله

هذا الدرس يُنتج`outputs/skill-provider-portability-audit.md`. نظراً لتكاملات الدعوة الوظيفية مع مزود واحد، فإن المهارة تنتج مراجعة للنقل: أي مزود يحد من الحدود التي يعتمد عليها، والحقول التي تحتاج إلى إعادة تسمية، وما الذي ينتهي عندما يتم نقلها إلى مزود آخر.

## التمارين

1. أركض`code/main.py`وتحقق من أن جميع JSONs الإعلانات المقدمة ثلاثة تسلسل نفس الأساسية `Tool`تعديل الأداة القنونية لإضافة مبرمير enum وتأكيد فقط مترجم جيميني يحتاج للتعامل مع عادة OpenAPI.

2. إضافة`ListToolsResponse`المصفح لكل مزود يستخرج قائمة الأدوات يعيد النموذج بعد `list_tools`أو دعوة اكتشاف. لا يوجد لدى OpenAI واحدة بشكل أصلي؛ لاحظ هذه التناظر.

3. تنفيذ`tool_choice`تحويل: خريطة القنوني `ToolChoice(mode="force", tool_name="x")`في جميع أشكال المزودين الثلاثة. ثم خريطة`mode="any"`و`mode="none"`تفقد جدول الاختلافات في الدروس

4. اختر واحد من المقدمين الثلاثة وقرأ دليل استدعاء الوظائف من نهايتها إلى نهايتها. ابحث عن حقل واحد في مواصفات مخططها التي لا تدعمها الاثنان الآخران. المتقدمين: OpenAI `strict`، الأنثروبيك `disable_parallel_tool_use`، التوأم`function_calling_config.allowed_function_names`. . .

5. كتابة متجه اختبار: دعوة أداة تنتهك حججها النظام المعلن. قم بتشغيلها من خلال مؤكدة كل مزود (ستعمل stdlib في الدروس 01 كوكب) وتسجيل أي أخطاء تنطلق. وثيقة من المزود الذي ستستخدم في الإنتاج لتحقيق الصرامة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Function calling | "Tool use" | Provider-level API for structured tool-call emission |
| Tool declaration | "Tool spec" | Name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | OpenAI flag that constrains decoding to match schema |
| `tool_use` block | "Anthropic's call shape" | Inline content block with id, name, input |
| `functionCall` part | "Gemini's call shape" | A `parts[]` entry containing name, args, and id |
| Arguments-as-string | "Stringified JSON" | OpenAI returns args as a JSON string, not an object |
| Parallel tool calls | "Fan-out in one turn" | Multiple tool calls in one assistant message |
| Refusal | "Model declines" | Strict-mode-only refusal block instead of a call |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini uses a JSON-Schema-like dialect with minor differences |

## المزيد من القراءة

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) الإشارة القنونية بما في ذلك الوضع الصارم والدعوات المتوازية
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) `tool_use`و`tool_result`النطقية الكلي
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) المكالمات المتوازية، والهوية الفريدة، و OpenAPI الفرعية
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) سطح مؤسسة جيمين
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) تفاصيل تنفيذ النظام الصارم
