# गहरी गोताखोरी को बुला रहा फ़ंक्शन  OpenAI, मानव, जुड़वां

> तीनों सीमा प्रदाता 2024 में एक ही टूल-कॉल लूप पर एक साथ आए और फिर बाकी सब पर विभेद किया।`tools`और `tool_calls`मानवयुक्त उपयोग`tool_use`और `tool_result`ब्लाक. मिथुन उपयोग करता है`functionDeclarations`इस सबक में तीनों को अलग अलग किया गया है ताकि एक प्रदाता पर भेजे जाने वाले कोड को पोर्ट करते समय टूट न जाए।

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## सीखने के लक्ष्य

- OpenAI, Anthropic और Gemini फ़ंक्शन-कॉल करने वाले पेलोड (घोषणा, कॉल, परिणाम) के बीच तीन आकार अंतर बताएं।
- तीनों प्रदाता प्रारूपों में एक उपकरण घोषणा का अनुवाद करें और अनुमान लगाएं कि कठोर मोड प्रतिबंध कहां भिन्न होंगे।
- उपयोग करें`tool_choice`प्रत्येक प्रदाता में जबरन, प्रतिबंधित, या स्वचालित उपकरण चयन कॉल करने के लिए।
- प्रत्येक प्रदाता के प्रति हार्ड सीमा (उपकरण संख्या, स्कीम गहराई, तर्क लंबाई) और सीमाओं का उल्लंघन होने पर प्रत्येक त्रुटि हस्ताक्षर को जानें।

## समस्या

कार्य कॉल अनुरोध का आकार प्रदाता के अनुसार भिन्न होता है। 2026 उत्पादन स्टैक के तीन ठोस उदाहरणः

**OpenAI Chat Completions / Responses API.**तुम पास करो`tools: [{type: "function", function: {name, description, parameters, strict}}]`. मॉडल की प्रतिक्रिया में शामिल है `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`कहाँ`arguments`यह एक JSON स्ट्रिंग है जिसे आपको विश्लेषण करना होगा।`strict: true`) प्रतिबंधित डिकोडिंग के माध्यम से योजना अनुपालन को लागू करता है।

**Anthropic Messages API.**तुम पास करो`tools: [{name, description, input_schema}]`. प्रतिक्रिया वापस आता है के रूप में`content: [{type: "text"}, {type: "tool_use", id, name, input}]`. .`input`पहले से ही विश्लेषण किया गया है (एक वस्तु, एक स्ट्रिंग नहीं) । आप एक नए के साथ जवाब `user`एक संदेश युक्त `{type: "tool_result", tool_use_id, content}`ब्लॉक.

**Google Gemini API.**तुम पास करो`tools: [{functionDeclarations: [{name, description, parameters}]}]`(निविष्ट नीचे)`functionDeclarations`) प्रतिक्रिया इस प्रकार आती है `candidates[0].content.parts: [{functionCall: {name, args, id}}]`कहाँ`id`आप उत्तर के साथ जवाब देते हैं`{functionResponse: {name, id, response}}`. .

एक ही लूप, अलग-अलग क्षेत्र के नाम, अलग-अलग घोंसले, अलग-अलग स्ट्रिंग- बनाम-ऑब्जेक्ट सम्मेलन, अलग-अलग सहसंबंध तंत्र. एक टीम जो ओपनएआई पर मौसम एजेंट लिखती है, केवल पाइपलाइन के लिए एंथ्रोपिक को दो दिन का पोर्ट और जुड़वां को एक और दिन का भुगतान करती है।

इस पाठ में एक अनुवादक बनाया गया है जो तीनों प्रारूपों को एक कैनोनिक टूल घोषणा और किनारे पर मार्गों में एकीकृत करता है। चरण 13 · 17 एक एलएलएम गेटवे में एक ही पैटर्न को सामान्य बनाता है।

## अवधारणा

### आम संरचना

प्रत्येक प्रदाता को पांच चीजों की आवश्यकता होती हैः

1. **Tool list.**प्रत्येक उपकरण का नाम, वर्णन और इनपुट योजना।
2. **Tool choice.**किसी विशिष्ट उपकरण को मजबूर करें, उपकरण को प्रतिबंधित करें, या मॉडल को निर्णय लेने दें।
3. **Call emission.**संरचित आउटपुट उपकरण और तर्कों का नामकरण।
4. **Call id.**सही कॉल के लिए प्रतिक्रिया को सहसंबंधित करें (समान के लिए मामले) ।
5. **Result injection.**एक संदेश या ब्लॉक जो परिणाम को कॉल से जोड़ता है।

### आकार में अंतर, क्षेत्र द्वारा क्षेत्र

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

### सीमाओं आप वास्तव में हिट करेंगे

- **OpenAI.**प्रति अनुरोध 128 उपकरण। स्कीम गहराई 5. तर्क स्ट्रिंग <= 8192 बाइट्स। सख्त मोड की आवश्यकता नहीं है `$ref`नहीं , नहीं`oneOf`/`anyOf`/`allOf`ओवरलैप के साथ, प्रत्येक संपत्ति में सूचीबद्ध `required`. .
- **Anthropic.**प्रति अनुरोध 64 उपकरण। योजना गहराई प्रभावी रूप से असीमित लेकिन व्यावहारिक सीमा 10। सख्त उपकरण उपयोग ऑप्ट-इन के साथ है।`strict: true`इसके बिना, योजना एक अनुबंध है जो मॉडल का पालन करने की प्रवृत्ति है, गारंटी नहीं।
- **Gemini.**प्रति अनुरोध 64 फ़ंक्शन। स्कीम प्रकार ओपनएपीआई 3.0 उपसमूह हैं (जेएसओएन स्कीम 2020-12 से थोड़ा विचलन) । समानांतर कॉल अद्वितीय-आईडी से जुड़वां 3।

### `tool_choice`व्यवहार

तीन मोड जो सभी का समर्थन करते हैं, अलग-अलग नाम दिए गए हैं।

- **Auto.**मॉडल उपकरण या पाठ चुनता है।
- **Required / Any.**मॉडल कम से कम एक उपकरण को बुलाता है।
- **None.**मॉडल उपकरण नहीं बुला सकता है।

प्लस प्रत्येक प्रदाता के लिए अद्वितीय एक मोडः

- **OpenAI.**नाम से एक विशिष्ट उपकरण को मजबूर करें।
- **Anthropic.**नाम से एक विशिष्ट उपकरण को मजबूर करना; `disable_parallel_tool_use`ध्वज एकल बनाम बहु को अलग करता है।
- **Gemini.** `mode: "VALIDATED"`मॉडल इरादे के बावजूद एक योजना सत्यापनकर्ता के माध्यम से प्रत्येक प्रतिक्रिया को रूट करता है।

### समानांतर कॉल

ओपनएआई की `parallel_tool_calls: true`(डिफ़ॉल्ट) एक सहायक संदेश में कई कॉल जारी करता है. आप उन्हें सभी चलाते हैं और प्रति बैच एक प्रविष्टि युक्त उपकरण भूमिका संदेश के साथ जवाब`tool_call_id`. मानव इतिहास में एक ही कॉल किया;`disable_parallel_tool_use: false`(क्लाउड 3.5 के रूप में डिफ़ॉल्ट) मल्टी सक्षम करता है। मिथुन 2 ने समानांतर कॉल की अनुमति दी लेकिन स्थिर आईडी नहीं दी; मिथुन 3 UUID जोड़ता है ताकि ऑर्डर से बाहर प्रतिक्रियाएं साफ-सुथरी से सहसंबंधित हों।

### स्ट्रीमिंग

तीनों समर्थन स्ट्रीम उपकरण कॉल. तार प्रारूप अलग हैः

- **OpenAI.** के डेल्टा टुकड़े`tool_calls[i].function.arguments`आप जमा जब तक`finish_reason: "tool_calls"`. .
- **Anthropic.**ब्लॉक-स्टार्ट / ब्लॉक-डेल्टा / ब्लॉक-स्टॉप घटनाएँ। `input_json_delta`टुकड़े आंशिक तर्क ले जाते हैं।
- **Gemini.** `streamFunctionCallArguments`(जेमिनी 3 में नया) एक के साथ टुकड़े उत्सर्जित करता है `functionCallId`तो कई समानांतर कॉल interleave कर सकते हैं।

चरण 13 · 03 समानांतर + स्ट्रीमिंग री-एम्ब्लेड पर गहराई से जाता है। यह पाठ घोषणा और एकल कॉल के आकार पर केंद्रित है।

### त्रुटियां और मरम्मत

अमान्य तर्क त्रुटियां भी अलग दिखती हैं।

- **OpenAI (non-strict).**मॉडल रिटर्न `arguments: "{bad json}"`, अपने JSON विश्लेषण विफल रहता है, आप एक त्रुटि संदेश इंजेक्ट और फिर से कॉल.
- **OpenAI (strict).**सत्यापन डिकोडिंग के दौरान होता है; अमान्य JSON असंभव है लेकिन `refusal`दिखाई दे सकता है।
- **Anthropic (non-strict).** `input`सर्वर पक्ष को मान्य करें। के साथ `strict: true`, नमूनाकरण योजना तक सीमित है।
- **Gemini.**OpenAPI 3.0 की विशेषता: `enum`वस्तु क्षेत्रों पर चुपचाप अनदेखा; स्वयं को मान्य करें।

### अनुवादक पैटर्न

अपने कोड में एक कैनोनिक उपकरण घोषणा इस तरह दिखता है (आप आकार चुनते हैंः

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

तीन छोटे कार्यों को यह तीन प्रदाता आकारों में अनुवाद।`code/main.py`यह सब कुछ एक ही समय में होता है, और फिर प्रत्येक प्रदाता के प्रतिक्रिया के रूप के माध्यम से एक नकली उपकरण कॉल को वापस करता है। कोई नेटवर्क की आवश्यकता नहीं है  यह सबक आकारों को सिखाता है, HTTP नहीं।

उत्पादन टीमों इस अनुवादक को `AbstractToolset`(पायडान्टिक एआई), `UniversalToolNode`(लंगग्राफ), या `BaseTool`(LlamaIndex) चरण 13 · 17 एक गेटवे भेजता है जो तीनों में से किसी के सामने एक ओपनएआई-आकार के एपीआई को उजागर करता है।

```figure
function-call-args
```

## इसका प्रयोग करें

`code/main.py`एक कैनोनिक को परिभाषित करता है `Tool`डेटाक्लास और तीन अनुवादक जो ओपनएआई, एंथ्रोपिक और जेमिनी घोषणा JSON जारी करते हैं। यह फिर एक ही कैनोनिकल कॉल ऑब्जेक्ट में प्रत्येक आकार के एक हाथ से निर्मित प्रदाता प्रतिक्रिया को पार्स करता है, यह प्रदर्शित करता है कि अर्थशास्त्र त्वचा के नीचे समान है। इसे चलाएं और तीन घोषणाओं को एक साथ अलग करें।

क्या देखना हैः

- तीन घोषणा ब्लॉकों में केवल लिफाफे और फ़ील्ड नामों में अंतर है।
- तीन प्रतिक्रिया ब्लॉक जहां कॉल रहता है में भिन्न होते हैं (शीर्ष स्तर `tool_calls`,`content[]`ब्लॉक, `parts[]`प्रवेश) ।
- एक `canonical_call()`कार्य निकासी `{id, name, args}`तीनों प्रतिक्रिया के रूपों से।

## इसे भेजें

यह सबक हमें फल देता है`outputs/skill-provider-portability-audit.md`. एक प्रदाता के साथ एक समारोह-कॉल करने वाले एकीकरण को देखते हुए, कौशल एक पोर्टेबिलिटी ऑडिट उत्पन्न करता हैः किस प्रदाता पर यह निर्भर करता है, किन क्षेत्रों को नाम बदलने की आवश्यकता है, और एक दूसरे प्रदाता को पोर्ट करते समय क्या टूटता है।

## व्यायाम

1. दौड़ें`code/main.py`और सत्यापित करें कि तीन प्रदाता घोषणा JSONs सभी एक ही अंतर्निहित क्रमबद्ध `Tool`वस्तु. एक enum पैरामीटर जोड़ने के लिए कैनोनिक उपकरण को संशोधित करें और पुष्टि करें कि केवल Gemini अनुवादक को OpenAPI विचित्रता को संभालने की आवश्यकता है।

2. एक जोड़ें `ListToolsResponse`प्रत्येक प्रदाता के लिए पार्सर जो उपकरण सूची को निकालता है एक मॉडल एक के बाद वापस आता है `list_tools`OpenAI में एक मूल रूप से नहीं है; इस असंबद्धता पर ध्यान दें।

3. कार्यान्वयन`tool_choice`रूपांतरणः एक कैनोनिकल मानचित्र `ToolChoice(mode="force", tool_name="x")`सभी तीन प्रदाता आकारों में. फिर नक्शा`mode="any"`और `mode="none"`. सबक की अंतर तालिका की जाँच करें.

4. तीन प्रदाताओं में से एक चुनें और इसके फ़ंक्शन कॉल गाइड को अंत से अंत तक पढ़ें। इसके स्कीमा स्पेसिफिकेशन में एक फ़ील्ड खोजें जिसे अन्य दो समर्थन नहीं करते हैं। उम्मीदवारः OpenAI `strict`, मानव विज्ञान `disable_parallel_tool_use`, जुड़वां`function_calling_config.allowed_function_names`. .

5. एक परीक्षण वेक्टर लिखेंः एक उपकरण कॉल जिसका तर्क घोषित योजना का उल्लंघन करता है। इसे प्रत्येक प्रदाता के सत्यापनकर्ता के माध्यम से चलाएं (लक्ष्य 01 में stdlib एक प्रॉक्सी के रूप में काम करेगा) और रिकॉर्ड करें कि कौन से त्रुटियां आग लगती हैं। दस्तावेज जो आप उत्पादन में उपयोग करेंगे।

## प्रमुख शर्तें

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

## आगे पढ़ना

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) कैनोनिक संदर्भ जिसमें सख्त मोड और समानांतर कॉल शामिल हैं
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) `tool_use`और `tool_result`ब्लॉक अर्थशास्त्र
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) समानांतर कॉल, अद्वितीय आईडी और ओपनएपीआई उपसमूह
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) मिथुनों की उद्यम सतह
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) सख्त मोड स्कीम प्रवर्तन विवरण
