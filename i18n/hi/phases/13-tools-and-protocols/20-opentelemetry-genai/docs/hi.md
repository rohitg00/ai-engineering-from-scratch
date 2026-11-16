# OpenTelemetry GenAI  ट्रैकिंग टूल अंत-टू-अंत कॉल

> एक एजेंट पांच उपकरण, तीन MCP सर्वर और दो उप एजेंटों को बुलाता है। आपको एक निशान की जरूरत है। ओपनटेलीमेट्री जेएनएआई सेमेटिक कन्वेंशन (v1.37 और ऊपर में स्थिर विशेषताएं) 2026 मानक हैं, मूल रूप से डेटाडॉग, लैंगफ्यूज, एरिज़ फीनिक्स, ओपनएलएलएमटीरी और एजेंटओप्स द्वारा समर्थित हैं। इस पाठ में आवश्यक गुणों का नाम दिया गया है, स्पैन पदानुक्रम (एजेंट → एलएलएम → उपकरण) चलाया गया है, और एक stdlib स्पैन उत्सर्जक जहाज आप किसी भी ओटीएल निर्यातक में प्लग कर सकते हैं।

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## सीखने के लक्ष्य

- LLM अवधि और उपकरण-कार्य अवधि के लिए आवश्यक OTel GenAI गुणों का नाम दें।
- एक निशान पदानुक्रम का निर्माण जो एजेंट लूप, एलएलएम कॉल, टूल कॉल, और एमसीपी क्लाइंट डिस्पैच को कवर करता है।
- तय करें कि कौन सी सामग्री को कैप्चर करना है (ऑप्ट-इन) बनाम संपादित करना है (डिफ़ॉल्ट) ।
- उपकरण कोड को फिर से लिखने के बिना स्थानीय कलेक्टर (जेगर, लैंगफ्यूज) को स्पैन जारी करें।

## समस्या

फरवरी 2026 से एक डिबगः उपयोगकर्ता रिपोर्ट "मेरे एजेंट को कभी-कभी जवाब देने में 30 सेकंड लगते हैं; अन्य समय 3 सेकंड।" कोई निशान नहीं। लॉग एलएलएम कॉल दिखाते हैं, लेकिन उपकरण डिस्पैच नहीं, एमसीपी सर्वर राउंड-ट्रिप नहीं, उप-एजेंट नहीं। आप अनुमान लगाते हैं। अंततः आप पाते हैंः एक एमसीपी सर्वर कभी-कभी एक ठंड-स्टार्ट पर लटका हुआ है।

अंत से अंत तक पता लगाने के बिना, आप यह नहीं मिल सकता.

इन सम्मेलनों को 2025-2026 में ओपनटेलीमेट्री सेमेटिक-कन्वेंशन समूह के तहत स्थापित किया गया था। वे स्थिर विशेषता नामों को परिभाषित करते हैं ताकि डेटाडॉग, लैंगफ्यूज, फीनिक्स, ओपनएलएलएमटीरी और एजेंटओप्स सभी एक ही अवधि का विश्लेषण करें। साधन एक बार; किसी भी बैकेंड पर जहाज।

## अवधारणा

### स्पैन पदानुक्रम

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

यह सब एक पहचान पत्र के नीचे घोंसला है। स्पैन आईडी माता-पिता-बच्चे के संबंधों को जोड़ती है।

### आवश्यक विशेषताएं

2025-2026 के सेमकोनव के अनुसारः

- `gen_ai.operation.name` `"chat"`,`"text_completion"`,`"embeddings"`,`"execute_tool"`,`"invoke_agent"`. .
- `gen_ai.provider.name` `"openai"`,`"anthropic"`,`"google"`,`"azure_openai"`. .
- `gen_ai.request.model` अनुरोधित मॉडल स्ट्रिंग (जैसे `"gpt-4o-2024-08-06"`) ।
- `gen_ai.response.model` मॉडल वास्तव में सेवा की।
- `gen_ai.usage.input_tokens`/`gen_ai.usage.output_tokens`. .
- `gen_ai.response.id` संबद्धता के लिए प्रदाता प्रतिक्रिया आईडी।

उपकरण की अवधि के लिएः

- `gen_ai.tool.name` उपकरण पहचानकर्ता।
- `gen_ai.tool.call.id` विशिष्ट कॉल आईडी।
- `gen_ai.tool.description` उपकरण विवरण (वैकल्पिक)

एजेंटों के लिएः

- `gen_ai.agent.name`/`gen_ai.agent.id`/`gen_ai.agent.description`. .

### स्पैन प्रकार

- `SpanKind.CLIENT`प्रक्रिया सीमा पार करने वाले कॉल के लिए (LLM प्रदाता, MCP सर्वर) ।
- `SpanKind.INTERNAL`एजेंट के स्वयं के लूप चरणों और उपकरण निष्पादन के लिए।

### ऑप्ट-इन सामग्री कैप्चर

डिफ़ॉल्ट रूप से, स्पैन मेट्रिक्स और समय को ले जाते हैं  न कि संकेत या पूर्णता। बड़े उपयोगिता लोड और PII डिफ़ॉल्ट रूप से बंद हैं। सेट `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`सामग्री को शामिल करने के लिए विशिष्ट सामग्री-कैप्चर वातावरण।

### स्पैन पर घटनाएं

टोकन स्तर की घटनाओं को स्पैन घटनाओं के रूप में जोड़ा जा सकता हैः

- `gen_ai.content.prompt` इनपुट संदेश।
- `gen_ai.content.completion` आउटपुट संदेश।
- `gen_ai.content.tool_call` उपकरण कॉल रिकॉर्ड किया गया है।

घटनाओं का समय क्रम विस्तृत पुनरावृत्ति के लिए एक अवधि के भीतर।

### निर्यातक

ओटीएल निर्यात को शामिल करता हैः

- **Jaeger / Tempo.**ओएसएस, स्थान पर.
- **Langfuse.**एलएलएम-निरीक्षण-विशिष्ट; टोकन उपयोग को दृश्यमान करता है।
- **Arize Phoenix.**Evals + tracing संयुक्त।
- **Datadog.**वाणिज्यिक; मूल रूप से पार्स `gen_ai.*`गुण।
- **Honeycomb.**स्तंभ उन्मुख; प्रश्न के अनुकूल।

सभी OTLP बोलते हैं, तार प्रारूप. आपका कोड कोई फर्क नहीं पड़ता.

### एमसीपी में प्रसार

जब एक MCP क्लाइंट सर्वर को कॉल करता है, तो W3C ट्रैकपेरेंट हेडर को अनुरोध में इंजेक्ट करें। स्ट्रीम करने योग्य HTTP मानक हेडर का समर्थन करता है। स्टीडियो नेटिव रूप से HTTP हेडर नहीं ले जाता है; विनिर्देश के 2026 रोडमैप में एक जोड़ने पर चर्चा की जाती है `_meta.traceparent`JSON-RPC कॉल पर फ़ील्ड।

उस जहाज तकः  में ट्रैकपेरेंट को शामिल करें`_meta`सर्वर ट्रैक आईडी लॉग करता है।

### मेट्रिक्स

स्पैन के साथ, GenAI semconv मेट्रिक्स को परिभाषित करता हैः

- `gen_ai.client.token.usage` हिस्टोग्राम।
- `gen_ai.client.operation.duration` हिस्टोग्राम।
- `gen_ai.tool.execution.duration` हिस्टोग्राम।

ऐसे डैशबोर्ड के लिए इनका उपयोग करें जिन्हें कॉल प्रति विवरण की आवश्यकता नहीं है।

### एजेंटओप्स परत

एजेंटओप्स (संस्थापित 2024) जीएनएआई अवलोकनशीलता में विशेषज्ञता प्राप्त है। यह स्वचालित रूप से ओटीएल स्पैन उत्सर्जित करने के लिए लोकप्रिय फ्रेमवर्क (लैंगग्राफ, पायदान्टिक एआई, क्रूएआई) को लपेटता है। यदि आपका स्टैक एक समर्थित फ्रेमवर्क का उपयोग करता है तो उपयोगी है; अन्यथा मैनुअल उपकरण का उपयोग करें।

```figure
t3-span-waterfall
```

## इसका प्रयोग करें

`code/main.py`एक एजेंट के लिए ओटीएल-आकार के स्पैन को स्टडआउट (ओटीएलपी-जेएसओएन-जैसे प्रारूप में) में भेजता है जो एलएलएम को कॉल करता है, दो उपकरण भेजता है, और एक एमसीपी राउंड-ट्रिप करता है। कोई वास्तविक निर्यातक नहीं  पाठ स्पैन आकार और विशेषता सेट पर केंद्रित है। आउटपुट को ओटीएलपी-संगत दर्शक में पेस्ट करें या बस इसे पढ़ें।

क्या देखना हैः

- सभी क्षेत्रों में निशान आईडी साझा किया जाता है।
- माता-पिता-बच्चे के लिंक को कोडित किया जाता है `parentSpanId`. .
- आवश्यक `gen_ai.*`गुणों को आबादी में हैं।
- सामग्री कैप्चर डिफ़ॉल्ट रूप से बंद है; एक परिदृश्य इसे env var के माध्यम से चालू करता है।

## इसे भेजें

यह सबक हमें फल देता है`outputs/skill-otel-genai-instrumentation.md`. एजेंट कोडबेस को देखते हुए, कौशल एक उपकरण योजना बनाता हैः कहां स्पैन जोड़ना है, कौन सा गुण आबादी को देता है, और कौन सा निर्यातक लक्षित है।

## व्यायाम

1. दौड़ें`code/main.py`. अवधि की गणना करें और पहचानें कि कौन सा ग्राहक बनाम आंतरिक है।

2. सामग्री कैप्चर (env var) को चालू करें और पुष्टि करें `gen_ai.content.prompt`और `gen_ai.content.completion`घटनाएं दिखाई देती हैं। PII के लिए प्रभाव ध्यान दें।

3. उपकरण निष्पादन मेट्रिक जोड़ें `gen_ai.tool.execution.duration`और इसे प्रति कॉल हिस्टोग्राम नमूना के रूप में उत्सर्जित करें।

4. एक माता-पिता एजेंट से एक ट्रैकपेरेंट को MCP अनुरोध में फैलाना `_meta.traceparent`MCP सर्वर एक ही निशान आईडी देखेंगे सत्यापित करें।

5. OTel GenAI semconv विनिर्देश पढ़ें. semconv में सूचीबद्ध एक विशेषता की पहचान करें कि इस पाठ के कोड उत्सर्जित नहीं करता है. इसे जोड़ें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## आगे पढ़ना

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) GenAI के लिए कैनोनिक सम्मेलन, मीट्रिक और घटनाएं
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) LLM और टूल-ईंसेक्यूशन स्पैन एट्रिब्यूट लिस्ट
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) एजेंट स्तर `invoke_agent`अवधि
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) GitHub द्वारा होस्ट किए गए सत्य स्रोत
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) उत्पादन एकीकरण के माध्यम से
