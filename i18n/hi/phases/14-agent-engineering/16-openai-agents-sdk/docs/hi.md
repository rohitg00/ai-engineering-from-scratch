# OpenAI एजेंट्स SDK: हस्तान्तरण, गार्डरेल्स, ट्रैकिंग

> OpenAI एजेंट्स SDK प्रतिक्रिया एपीआई पर निर्मित हल्का बहु-एजेंट फ्रेमवर्क है। पांच आदिमः एजेंट, हैंडऑफ, गार्डरेल, सत्र, ट्रैकिंग। हैंडऑफ नामित उपकरण हैं।`transfer_to_<agent>`. इनपुट या आउटपुट पर गार्डरेल्स टूट जाते हैं. डिफ़ॉल्ट रूप से ट्रैकिंग चालू है.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## सीखने के लक्ष्य

- OpenAI एजेंट्स SDK के पांच आदिमों का नाम बताइए।
- हाथों को समझाएंः उन्हें उपकरण के रूप में क्यों मॉडल किया जाता है, मॉडल किस नाम के आकार को देखता है, और संदर्भ कैसे स्थानांतरित होता है।
- इनपुट गार्डरेल्स, आउटपुट गार्डरेल्स और टूल गार्डरेल्स में अंतर करें; समझाएं `run_in_parallel`प्रतिरोध मोड के साथ।
- हाथों के साथ एक स्टडलिब रनटाइम लागू करें + गार्डरेल्स + स्पैन-स्टाइल ट्रैकिंग।

## समस्या

एजेंट जो साफ-सुथरा रूप से कार्य नहीं कर सकते हैं, वे सब कुछ एक प्रॉम्प्ट में भर देते हैं। बिना गार्डरेल वाले एजेंट पीआईआई भेजते हैं, नीति-उपवर्तन आउटपुट, या हमेशा के लिए लूप। ओपनएआई के एसडीके तीन आदिम को कोडित करता है जो मल्टी-एजेंट काम को ट्रेस करने योग्य बनाता है।

## अवधारणा

### पांच आदिम

1. **Agent.**एमएलए + निर्देश + उपकरण + हस्तान्तरण।
2. **Handoff.**एक अन्य एजेंट को प्रतिनिधि। मॉडल के लिए एक उपकरण के रूप में प्रतिनिधित्व किया गया नाम `transfer_to_<agent_name>`. .
3. **Guardrail.**इनपुट (केवल पहला एजेंट), आउटपुट (केवल अंतिम एजेंट) या टूल इनवोकशन (प्रति फ़ंक्शन टूल) पर सत्यापन।
4. **Session.**बारी के पार स्वचालित बातचीत इतिहास.
5. **Tracing.**LLM पीढ़ियों के लिए निर्मित स्पैन, उपकरण कॉल, हस्तान्तरण, गार्डरेल्स।

### उपकरण के रूप में हस्तान्तरण

मॉडल देखता है `transfer_to_billing_agent`इसे कॉल करने से रनटाइम को संकेत मिलता हैः

1. बातचीत के संदर्भ को कॉपी करें (या इसे  के माध्यम से ढहाना)`nest_handoff_history`बीटा) ।
2. निर्देशों के साथ लक्ष्य एजेंट को शुरू करें।
3. लक्ष्य एजेंट के साथ दौड़ जारी रखें।

यह उपरीक्षक पैटर्न (पाठ 13 /पाठ 28) है।

### गार्डरेल्स

तीन स्वादः

- **Input guardrails.**पहले एजेंट के इनपुट पर चलें. एलएलएम कॉल से पहले असुरक्षित या दायरे से बाहर अनुरोधों को अस्वीकार करें।
- **Output guardrails.**पिछले एजेंट के आउटपुट पर चलें, पीआईडी लीक, नीति उल्लंघन, गलत प्रतिक्रियाओं को पकड़ें।
- **Tool guardrails.**प्रत्येक फ़ंक्शन-टूल चलाएं, तर्क सत्यापित करें, अनुमतियों की जांच करें, ऑडिट निष्पादन करें।

मोडः

- **Parallel**(डिफ़ॉल्ट) गार्डरेल LLM मुख्य LLM के साथ चलता है। निचली पूंछ विलंबता। यदि ट्रिप किया जाता है, तो मुख्य LLM का काम त्याग दिया जाता है (टोकन अपशिष्ट) ।
- **Blocking**(`run_in_parallel=False`) गार्डरेल LLM पहले चला जाता है. अगर ट्रिप, कोई टोकन मुख्य कॉल पर बर्बाद नहीं किया.

त्रिविरे उठाने `InputGuardrailTripwireTriggered`/`OutputGuardrailTripwireTriggered`. .

### ट्रैक करना

डिफ़ॉल्ट रूप से चालू. हर LLM पीढ़ी, उपकरण कॉल, हस्तान्तरण, और गार्डरेल एक स्पैन उत्सर्जित करता है। `OPENAI_AGENTS_DISABLE_TRACING=1`बाहर चुनता है।`add_trace_processor(processor)`प्रशंसकों को OpenAI के साथ अपने स्वयं के बैकेंड तक फैलाता है।

### सत्र

`Session`बैकएंड में बातचीत इतिहास संग्रहीत करता है (SQLite, Redis, कस्टम) । `Runner.run(agent, input, session=session)`ऑटो-लोड और संलग्नक।

### जहां यह पैटर्न गलत हो जाता है

- **Handoff drift.**एजेंट ए एजेंट बी को सौंपता है जो एजेंट ए को वापस देता है. एक हॉप काउंटर जोड़ें.
- **Guardrail bypass.**उपकरण गार्डरेल्स केवल कार्य उपकरण पर आग लगाते हैं; अंतर्निहित उपकरण (फ़ाइल रीडर, वेब लपक) को अलग नीति की आवश्यकता होती है।
- **Over-tracing.**संवेदनशील सामग्री को स्पैन में जोड़ा जाए। ओटेल जेनएआई सामग्री कैप्चर नियम (पाठ 23)  बाहरी रूप से स्टोर करें, आईडी द्वारा संदर्भित करें।

```figure
ae-agent-handoff
```

## इसे बनाओ

`code/main.py`stdlib में SDK आकार को लागू करता हैः

- `Agent`,`FunctionTool`,`Handoff`(प्रवाहन अर्थशास्त्र के साथ एक कार्य उपकरण के रूप में) ।
- `Runner`इनपुट/आउटपुट/उपकरण गार्डरेल्स, हैंडऑफ डिस्पैच और हॉप काउंटर के साथ।
- निशान के आकार को दिखाने के लिए एक सरल स्पैन उत्सर्जक।
- एक triage agent जो उपयोगकर्ता के query के आधार पर बिलिंग या support को सौंपता है; guardrail एक इनपुट पर trips करता है।

इसे चलाओः

```
python3 code/main.py
npx tsx code/main.ts
```

निशान दो सफल हस्तान्तरण दिखाता है, एक इनपुट गार्डरेल यात्रा, और एक स्पैन पेड़ वास्तविक एसडीके उत्सर्जन का प्रतिबिंबित करता है।

## इसका प्रयोग करें

- **OpenAI Agents SDK**OpenAI-first उत्पादों के लिए।
- **Claude Agent SDK**(पाठ 17) क्लाउड-प्रथम उत्पादों के लिए।
- **LangGraph**(पाठ 13) जब आप स्पष्ट स्थिति और टिकाऊ जीवनशैली चाहते हैं।
- **Custom**जब आपको सटीक नियंत्रण की आवश्यकता होती है (ध्वनि, बहु-प्रदाता, संघीय तैनाती) ।

## इसे भेजें

`outputs/skill-agents-sdk-scaffold.md`एक एजेंट एसडीके ऐप को एक ट्रायज एजेंट, हैंडऑफ, इनपुट/आउटपुट/टूल गार्डरेल्स, सत्र स्टोर और एक ट्रैस प्रोसेसर के साथ स्टैफ़ल करता है।

## व्यायाम

1. एक हाथ-हॉप काउंटर जोड़ेंः N स्थानांतरण के बाद अस्वीकार करें। व्यवहार का पता लगाएं।
2. कार्यान्वयन`nest_handoff_history`विकल्प के रूप में  स्थानांतरण से पहले पूर्व संदेशों को एक सारांश में ढकना।
3. एक अवरुद्ध आउटपुट गार्डरेल लिखें. संकेतों पर विलंबता की तुलना करें जो इसे ट्रिप करेंगे बनाम जो गुजरते हैं।
4. तार `add_trace_processor`एक JSON लॉगर के लिए. यह प्रति अवधि क्या आकार उत्सर्जित करता है?
5. SDK दस्तावेजों को पढ़ें. अपने stdlib खिलौना को पोर्ट करने के लिए `openai-agents-python`आपने गलत क्या मॉडल बनाया?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## आगे पढ़ना

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) आदिम, हस्तान्तरण, पहरा, ट्रैकिंग
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) क्लाउड स्वाद वाला समकक्ष
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) जब किसी को भी दान देने की आवश्यकता हो
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) मानक एजेंट एसडीके मैप को
