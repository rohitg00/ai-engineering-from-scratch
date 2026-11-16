# समानांतर उपकरण कॉल और उपकरण के साथ स्ट्रीमिंग

> तीन स्वतंत्र मौसम खोजों को क्रमबद्ध किया गया है तीन राउंड-ट्रिप है। उन्हें समानांतर में चलाएं और कुल समय सबसे धीमी एकल कॉल तक गिर जाता है। प्रत्येक सीमा प्रदाता अब एक ही मोड़ में कई उपकरण कॉल जारी करता है। भुगतान वास्तविक है; पाइपलाइन सूक्ष्म है। यह सबक दोनों आधे चलता हैः समानांतर फैन-आउट और स्ट्रीम-आर्कमेंट री-एम्ब्लेड, आईडी-कोरेलेशन फंके पर जोर देते हुए।

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## सीखने के लक्ष्य

- क्यों बताएँ `parallel_tool_calls: true`अस्तित्व में है और इसे निष्क्रिय करने के लिए कब।
- समानांतर फैन-आउट के दौरान सही उपकरण-कॉल आईडी के साथ स्ट्रीम किए गए तर्क टुकड़ों को सहसंबंधित करें।
- आंशिक पुनः इकट्ठा `arguments`पहले से पार्सिंग के बिना पूर्ण JSON में स्ट्रिंग्स।
- तीन शहरों के मौसम बेंचमार्क चलाएं जो अनुक्रमिक बनाम समानांतर विलंबता प्रदर्शित करता है।

## समस्या

बिना समानांतर कॉल के, एक एजेंट "बेंगलुरु, टोक्यो और ज्यूरिख में मौसम कैसा है" का जवाब देते हुए यह करता हैः

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

तीन एलएलएम घूम-फिर यात्राएं, जिनमें से प्रत्येक भी निष्पादक विलंब का भुगतान करता है. लगभग 4 आदर्श दीवार घड़ी समय.

समानांतर कॉल के साथः

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

एक एलएलएम रेंडरिंग ट्रिप। निष्पादक समय तीनों में से अधिकतम है, योग नहीं। ओपनएआई, एंथ्रोपिक और जेमिनी पर उत्पादन बेंचमार्क दर्शाते हैं कि वैन-आउट वर्कलोड पर वॉल-क्लॉक में 60 से 70 प्रतिशत की कमी है।

जब तीन कॉल पूर्ण रूप से क्रम से बाहर हो जाते हैं, तो आपके परिणाम मिलान को ले जाना चाहिए `tool_call_id`जब आप एक ही उपकरण के लिए दो समानांतर कॉल को अलग नहीं कर सकते थे, तो एक वास्तविक दुनिया की समस्या को हल करने के लिए जेमिनी 3 ने अद्वितीय आईडी जोड़ी।

## अवधारणा

### समानांतर को सक्षम करना

- **OpenAI.** `parallel_tool_calls: true`डिफ़ॉल्ट रूप से चालू करें। सेट `false`क्रमबद्ध मजबूर करने के लिए.
- **Anthropic.**समानांतर `disable_parallel_tool_use: false`(क्लाउड 3.5 और ऊपर पर डिफ़ॉल्ट) सेट `true`सीरियल के लिए।
- **Gemini.**हमेशा समानांतर क्षमता; `tool_config.function_calling_config.mode = "AUTO"`मॉडल को निर्णय लेने दें।

समानांतर निष्क्रिय करें जब उपकरण क्रमबद्ध निर्भरता है (`create_file`तो `write_file`), जब एक कॉल के आउटपुट दूसरे के इनपुट को सूचित करता है, या जब रेट लिमिटर फैन-आउट को संभाल नहीं सकता है।

### आईडी सहसंबंध

मॉडल द्वारा जारी किए जाने वाले प्रत्येक कॉल में एक `id`. प्रत्येक परिणाम मेजबान वापस करता है एक ही आईडी शामिल करना चाहिए. यह बिना, परिणाम अस्पष्ट हैं.

- **OpenAI.** `tool_call_id`प्रत्येक उपकरण भूमिका संदेश पर।
- **Anthropic.** `tool_use_id`प्रत्येक पर `tool_result`ब्लॉक.
- **Gemini.** `id`प्रत्येक पर `functionResponse`(जिमिनी 3 और ऊपर;जिमिनी 2 नाम से मेल खाता है जो समान नाम के समानांतर कॉल के लिए टूट गया है) ।

### एक साथ कॉल चलाना

मेजबान प्रत्येक कॉल के निष्पादक को अपने स्वयं के धागे, कॉरोटीन या रिमोट वर्कर पर चलाता है। सबसे सरल हार्नेस एक धागे पूल का उपयोग करता है; उत्पादन में असिनसियो का उपयोग होता है।`asyncio.gather`पूर्णता का क्रम अप्रत्याशित है  पहचानकर्ता आईडी है।

एक आम बगः कॉल-लिस्ट क्रम में परिणामों के साथ उत्तर दें पूरा करने के क्रम के बजाय। यह आमतौर पर काम करता है क्योंकि मॉडल केवल परवाह करता है`tool_call_id`, लेकिन यदि कोई परिणाम छोड़ दिया जाता है या दोहराया जाता है, तो परिणामों के प्राप्त क्रम से दूर उत्तर सूची को पुनः क्रमबद्ध किया जाता है लॉग में अंतर को ढूंढना मुश्किल बनाता है। स्पष्ट आईडी के साथ पूर्ण क्रम में उत्तर देना बेहतर है।

### स्ट्रीमिंग टूल कॉल

जब मॉडल स्ट्रीम, `arguments`तीन समानांतर कॉल के लिए टुकड़ों के तीन अलग-अलग धाराओं तार पर interlease. आप प्रति आईडी एक accumulator की जरूरत है.

प्रदाता द्वारा आकारः

- **OpenAI.**प्रत्येक टुकड़ा है `choices[0].delta.tool_calls[i].function.arguments`(आंशिक स्ट्रिंग) टुकड़ा ले जाता है`index`आप प्रति सूचकांक जमा, पढ़ें `id`जब यह पहली बार दिखाई देता है, और JSON विश्लेषण जब `finish_reason = "tool_calls"`. .
- **Anthropic.**स्ट्रीम घटनाएँ हैं `message_start`, फिर एक `content_block_start`प्रकार के साथ प्रति ब्लॉक `tool_use`(आईडी, नाम, खाली इनपुट युक्त) ।`content_block_delta`घटनाओं का संचरण`input_json_delta`टुकड़े.`content_block_stop`हर ब्लॉक बंद करता है।
- **Gemini.** `streamFunctionCallArguments`(ज्विन 3 और ऊपर) एक के साथ टुकड़े उत्सर्जित करता है `functionCallId`इससे पहले कि मिथुन 3 स्ट्रीमिंग एक बार में एक पूर्ण कॉल लौटा।

### आंशिक JSON और विश्लेषण-प्रारंभिक जाल

तुम विश्लेषण नहीं कर सकते `arguments`जब तक यह पूरा नहीं हो जाता।`{"city": "Beng`सही गेट प्रदाता का अंत-ऑफ-कॉल सिग्नल है: OpenAI का `finish_reason = "tool_calls"`, मानव विज्ञान `content_block_stop`, या जुड़वां के स्ट्रीम-एंड घटना.`json.loads`. एक अधिक मजबूत दृष्टिकोण एक क्रमिक JSON पार्सर का उपयोग करता है जो संरचना के पूरा होने के रूप में घटनाओं को उत्पन्न करता है; ओपनएआई के स्ट्रीमिंग गाइड यूएक्स के लिए इसकी सिफारिश करता है जो एक लाइव "विचार" संकेतक दिखाता है। ब्रास-कंटिंग पूर्णता परीक्षण के रूप में अविश्वसनीय है (उद्धृत स्ट्रिंग के अंदर ब्रास या छुटे हुए सामग्री के कारण झूठे सकारात्मक होते हैं) और केवल एक अनौपचारिक डिबग हेरिस्टिक के रूप में उपयोग किया जाना चाहिए।

### आदेश से बाहर पूरा

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

मेजबान उत्तर में अभी भी आईडी को उद्धृत करना होगाः

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

उत्तर में आदेश OpenAI या मानव पर सटीकता के लिए मायने नहीं रखता। मिथुन जब तक आईडी मेल खाते हैं तब तक किसी भी आदेश को स्वीकार करता है।

### बेंचमार्कः अनुक्रमिक बनाम समानांतर

हर्नेस में `code/main.py`400, 600, और 800 ms विलंबता के साथ तीन निष्पादक अनुकरण करता है। अनुक्रम इसे कुल 1800 ms में चलाता है। समानांतर इसे अधिकतम 400, 600, 800) = 800 ms में चलाता है। अंतर स्थिर है, आनुपातिक नहीं है, इसलिए टूल की संख्या के साथ बचत बढ़ जाती है।

वास्तविक दुनिया चेतावनीः समानांतर कॉल डाउनस्ट्रीम एपीआई को तनाव देते हैं। एक दर-सीमित सेवा के लिए 10-तरफ़ा फैन-आउट विफल हो जाएगा। चरण 13 · 17 गेटवे स्तर के बैकप्रेशर को कवर करता है; भविष्य के चरण के लिए पुनः अर्थशास्त्र का प्रयास करने की योजना बनाई गई है।

### स्ट्रीमिंग फैन आउट वॉल घड़ी

यदि मॉडल स्वयं स्ट्रीम्स है, तो आप सभी कॉल के लिए प्रतीक्षा करने के बजाय एक कॉल के तर्क पूरा होने के साथ ही निष्पादन शुरू कर सकते हैं। यह एक अनुकूलन है OpenAI दस्तावेज लेकिन सभी SDK उजागर नहीं करते हैं। इस पाठ में हर्नर ऐसा करता हैः जैसे ही सिमुलेटेड स्ट्रीम एक पूर्ण तर्क ऑब्जेक्ट देता है, मेजबान उस कॉल को शुरू करता है।

```figure
tp-parallel-fanout
```

## इसका प्रयोग करें

`code/main.py`पहले में तीन सिम्युलेटेड मौसम कॉल क्रमशः और समानांतर में चलाया जाता है`concurrent.futures.ThreadPoolExecutor`दूसरे भाग में एक नकली स्ट्रीमिंग प्रतिक्रिया पुनः प्रस्तुत करता है  टुकड़े `arguments`एक धारा पर परस्पर तीन समानांतर कॉल के लिए  और उन्हें फिर से इकट्ठा करता है प्रति आईडी के साथ `StreamAccumulator`कोई LLM, कोई नेटवर्क, बस पुनर्मिलन तर्क.

क्या देखना हैः

- अनुक्रमिक टाइमर 1.8 सेकंड तक पहुंचता है समानांतर टाइमर 0.8 सेकंड तक पहुंचता है उसी नकली विलंबता पर।
- संचयक प्रत्येक कॉल के JSON को पूरा होने पर ही प्रति-आईडी बफर करके और पार्स करके आदेश से बाहर आने वाले टुकड़ों को संभालता है।
- निष्पादक एक आईडी के तर्क को अंतिम रूप देने के रूप में ही शुरू होता है, सभी धाराओं के अंत के बाद नहीं।

## इसे भेजें

यह सबक हमें फल देता है`outputs/skill-parallel-call-safety-check.md`. एक उपकरण रजिस्ट्री को देखते हुए, कौशल लेखा परीक्षाएं जो उपकरण को समानांतर करने के लिए सुरक्षित हैं, जिनके आदेश निर्भरता है, और जो डाउनस्ट्रीम दर सीमाओं को भारी कर देंगे  प्रति उपकरण के साथ एक संशोधित रजिस्ट्री लौटाएं `parallel_safe`ध्वज।

## व्यायाम

1. दौड़ें`code/main.py`पुष्टि करें कि समानांतर-से-अनुक्रम अनुपात लगभग है`max/sum`(वास्तविक रन थ्रेड शेड्यूलिंग, सीरियलकरण और हर्नस ओवरहेड के कारण आदर्श से थोड़ा विचलित होते हैं) किस विलंबता वितरण पर समानांतर मायने रखना बंद कर देता है?

2. बैटरी को "कॉल मध्य-stream रद्द किया गया" मामले को संभालने के लिए बढ़ाएं, इसका बफर छोड़कर और एक `cancelled`इस मामले को स्पष्ट रूप से दस्तावेज किस प्रदाता?`content_block_stop`अर्थशास्त्र और ओपनएआई के `finish_reason: "length"`व्यवहार।

3. थ्रेड पूल को  से बदलें`asyncio.gather`. बेंचमार्क दोनों. आप छोटे जीत देखने के लिए चाहिए async कम संदर्भ स्विच लागत के कारण, लेकिन केवल अगर निष्पादक वास्तविक I / O करते हैं.

4. दो उपकरण चुनें जो समानांतर नहीं होना चाहिए (जैसे `create_file`तो `write_file`  `ordering_dependency`रजिस्ट्री में ग्राफ और उस ग्राफ पर समानांतर फैन आउट गेट। यह निर्भरता-जागरूक शेड्यूलिंग के लिए न्यूनतम मशीनरी है, जिसे भविष्य के एजेंट इंजीनियरिंग चरण औपचारिक रूप से बनाता है।

5. ओपनएआई के समानांतर फ़ंक्शन कॉल सेक्शन और एंथ्रोपिक के `disable_parallel_tool_use`डॉक्स. वास्तविक दुनिया के उपकरण के एक प्रकार की पहचान करें जहां मानव विज्ञान समानांतरता को अक्षम करने की सिफारिश करता है। (संकेतः एक ही संसाधन पर परिणामकारी उत्परिवर्तन) ।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## आगे पढ़ना

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) डिफ़ॉल्ट व्यवहार और ऑप्ट-आउट ध्वज
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) `disable_parallel_tool_use`और परिणाम बैचिंग
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) मिथुन 3 से आईडी-संदर्भित समानांतर कॉल
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) OpenAI धाराओं के लिए टुकड़े टुकड़े तर्क फिर से इकट्ठा
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) `content_block_delta`के साथ`input_json_delta`
