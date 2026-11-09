# हर्नस एक पुस्तकालय के रूप में  सुबगेंट और सत्र स्टोर

> एक हर्नस आप आयात कर सकते हैंः अंतर्निहित उपकरण, संदर्भ अलगाव के लिए उप-बॉगेंट, हुक, W3C निशान प्रसार, सत्र दृढ़ता। क्लाउड एजेंट एसडीके संदर्भ उदाहरण है  क्लाउड कोड हर्नस का पुस्तकालय रूप  और क्लाउड प्रबंधित एजेंट्स लंबे समय तक चलने वाले असिनक काम के लिए होस्ट विकल्प है।

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## सीखने के लक्ष्य

- मानव क्लाइंट एसडीके (कच्चे एपीआई) और क्लाउड एजेंट एसडीके (हार्नेस आकार) के बीच अंतर समझाएं।
- उप-सब्जेक्ट्स का वर्णन करें  समानांतर और संदर्भ अलगाव  और उनके लिए कब पहुंचें।
- पायथन एसडीके के सत्र भंडारण सतह का नाम (`append`,`load`,`list_sessions`,`delete`,`list_subkeys`) और `--session-mirror`. .
- अंतर्निहित उपकरणों के साथ एक स्टडीलिब हार्नेस, अलग-अलग संदर्भ के साथ उप-बगिंग, जीवनचक्र हुक और सत्र स्टोर लागू करें।

## समस्या

एक कच्चे एलएलएम एपीआई आपको एक बार फिर से मिलता है। एक उत्पादन एजेंट को टूल निष्पादन, एमसीपी सर्वर, जीवनचक्र हुक, उप-सम्बन्धी जड़, सत्र दृढ़ता, निशान प्रसार की आवश्यकता होती है। क्लाउड एजेंट एसडीके इस आकार को लाइब्रेरी के रूप में भेजता है  क्लाउड कोड का उपयोग करता है उसी हर्नल, कस्टम एजेंटों के लिए उजागर किया जाता है।

## अवधारणा

### क्लाइंट एसडीके बनाम एजेंट एसडीके

- **Client SDK (`anthropic`).**आप लूप, उपकरण, राज्य के मालिक हैं।
- **Agent SDK (`claude-agent-sdk`).**अंतर्निहित उपकरण निष्पादन, MCP कनेक्शन, हुक, उप-बॉगेंट जड़, सत्र स्टोर. क्लाउड कोड लूप एक पुस्तकालय के रूप में.

### अंतर्निहित उपकरण

SDK बॉक्स से 10+ टूल भेजता हैः फ़ाइल रीड/रइट, शेल, ग्रेप, ग्लोब, वेब फ़्रेच, और अधिक। कस्टम टूल मानक टूल-स्केम इंटरफ़ेस के माध्यम से पंजीकृत करते हैं।

### उप-समुद्रण

मानव द्वारा दो उद्देश्यों के लिए दस्तावेजः

1. **Parallelization.**एक साथ स्वतंत्र काम करें. "इन 20 मॉड्यूल में से प्रत्येक के लिए परीक्षण फ़ाइल खोजें" 20 समानांतर उप-कार्य है।
2. **Context isolation.**उप-संदर्भकर्ता अपनी-अपनी संदर्भ खिड़की का उपयोग करते हैं; केवल परिणाम ऑर्केस्ट्रेटर को लौटते हैं। ऑर्केस्ट्रेटर का बजट संरक्षित है।

पायथन एसडीके हाल ही में जोड़े गएः `list_subagents()`,`get_subagent_messages()`उप-सम्बन्धी प्रतिलेख पढ़ने के लिए।

### सत्र स्टोर

टाइपस्क्रिप्ट के साथ प्रोटोकॉल समताः

- `append(session_id, message)` एक मोड़ जोड़ें।
- `load(session_id)` बातचीत को बहाल करें।
- `list_sessions()` सूचीबद्ध करें।
- `delete(session_id)` उप-सहायता सत्रों के साथ।
- `list_subkeys(session_id)` उप-सहायक कुंजी सूचीबद्ध करें।

`--session-mirror`(CLI ध्वज) डिबगिंग के लिए, एक बाहरी फ़ाइल में प्रतिबिंबित करता है।

### हुक

जीवन चक्र हुक आप पंजीकृत कर सकते हैंः

- `PreToolUse`,`PostToolUse` गेट या ऑडिट टूल कॉल।
- `SessionStart`,`SessionEnd` स्थापित और गिराया।
- `UserPromptSubmit` मॉडल इसे देखने से पहले उपयोगकर्ता के इनपुट पर कार्य करें।
- `PreCompact` संदर्भ संपीड़न से पहले चलाएं।
- `Stop` एजेंट के बाहर निकलने पर सफाई।
- `Notification` साइड-चैनल अलर्ट।

हुक यह है कि कैसे प्रो-वर्कफ्लो (चरण 14 पाठ्यक्रम संदर्भ) और इसी तरह के सिस्टम क्रॉस-कटिंग व्यवहार जोड़ते हैं।

### W3C ट्रैक संदर्भ

कॉलर पर सक्रिय OTel स्पैन W3C ट्रैक संदर्भ हेडर के माध्यम से CLI उपप्रक्रिया में फैलता है। पूरे बहु-प्रक्रिया ट्रैक आपके बैकेंड में एक ट्रैक के रूप में दिखाई देता है।

### क्लाउड ने एजेंटों का प्रबंधन किया

होस्ट किया गया विकल्प (बीटा हेडर `managed-agents-2026-04-01`) दीर्घकालिक असिनक्रॉन कार्य, अंतर्निहित शीघ्र कैशिंग, अंतर्निहित संपीड़न, प्रबंधित बुनियादी ढांचे के लिए व्यापार नियंत्रण।

### जहां यह पैटर्न गलत हो जाता है

- **Subagent over-spawn.**100 छोटे कार्यों के लिए 100 उप-बॉगेंट्स को पैदा करना। ओवरहेड हावी है. बैच के बजाय।
- **Hook creep.**प्रत्येक टीम हुक जोड़ती है, स्टार्टअप समय गुब्बारे. तिमाही में हुक की समीक्षा.
- **Session bloat.**सत्र जमा होते हैं, आकार बढ़ता है। उपयोग `list_sessions`+ समाप्ति नीति।

```figure
ae-subagent-isolation
```

## इसे बनाओ

`code/main.py`stdlib में SDK आकार को लागू करता हैः

- `Tool`,`ToolRegistry`अंतर्निहित के साथ `read_file`,`write_file`,`list_dir`. .
- `Subagent` निजी संदर्भ, अलग-अलग रन, परिणाम लौटाए गए।
- `SessionStore` जोड़ें, लोड करें, सूची, हटाएं, सूची_उप कुंजी।
- `Hooks` `pre_tool_use`,`post_tool_use`,`session_start`,`session_end`. .
- एक डेमोः मुख्य एजेंट समानांतर में 3 उप-सब्जेक्ट उत्पन्न करता है (प्रत्येक अलग), परिणामों को एकत्र करता है, सत्र जारी रहता है।

इसे चलाओः

```
python3 code/main.py
npx tsx code/main.ts
```

इस निशान में उप-संदर्भ अलगाव (ऑर्केस्ट्रेटर संदर्भ आकार सीमित रहता है), हुक निष्पादन और सत्र की निरंतरता दिखाई देती है।

## इसका प्रयोग करें

- **Claude Agent SDK**क्लाउड-प्रथम उत्पादों के लिए जो क्लाउड कोड हर्नर आकार चाहते हैं।
- **Claude Managed Agents**होस्ट किए गए लंबे समय तक चलने वाले असिनक्रोनस कार्य के लिए।
- **OpenAI Agents SDK**(पढ़ें 16) ओपनएआई-पहले समकक्षों के लिए।
- **LangGraph + custom tools**यदि आप इसके बजाय ग्राफ के आकार की राज्य मशीन चाहते हैं।

## इसे भेजें

`outputs/skill-claude-agent-scaffold.md`एक क्लाउड एजेंट एसडीके एप्लिकेशन के साथ स्केच करता है subagents, हुक, सत्र स्टोर, एमसीपी सर्वर संलग्नक, और W3C निशान प्रसार।

## व्यायाम

1. एक उप-सॉबगेन्ट स्पॉनर जोड़ें जो 20 कार्यों को 5 समानांतर उप-सॉबगेन्ट के समूहों में बैच करता है। ऑर्केस्ट्रेटर संदर्भ आकार बनाम एक-प्रति-कार्य मापें।
2. एक `PreToolUse`उस दर-सीमा को हुक `write_file`कॉल (5 प्रति मिनट प्रति सत्र) व्यवहार का पता लगाएं।
3. तार `list_subkeys`गहरे घोंसले की तरह क्या दिखता है?
4. खिलौना को वास्तविक में ले जाओ `claude-agent-sdk`पायथन पैकेज. उपकरण पंजीकरण के बारे में क्या परिवर्तन?
5. क्लाउड प्रबंधित एजेंट्स डॉक्यूमेंट्स पढ़ें आप स्व-होस्टिंग से प्रबंधित करने के लिए कब स्विच करेंगे?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## आगे पढ़ना

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) क्लाउड कोड का पुस्तकालय रूप
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) उत्पादन के पैटर्न
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) होस्ट किए गए विकल्प
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) समकक्ष
