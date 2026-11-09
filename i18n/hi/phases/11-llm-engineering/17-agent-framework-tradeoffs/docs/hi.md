# एजेंट फ्रेमवर्क ट्रेडऑफ  ग्राफ, भूमिका और अभिनेता ऑर्केस्ट्रेशन

> प्रत्येक फ्रेमवर्क एक ही डेमो बेचता है (अनुसंधान एजेंट एक रिपोर्ट बनाता है) और एक ही बग छिपाता है (राज्य योजना ऑर्केस्ट्रेशन परत के साथ लड़ती है) । उस फ्रेमवर्क का चयन करें जिसका अमूर्त रूप आपकी समस्या के आकार से मेल खाता है; बाकी सब कुछ चिपकने वाला है जिसे आप दो बार लिखते हैं।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## समस्या

आपके पास एक कार्य है जिसमें एक से अधिक एलएलएम कॉल की आवश्यकता होती है। शायद यह एक शोध वर्कफ़्लो (योजना, खोज, सारांश, उद्धरण) है। शायद यह एक कोड-पुनरावलोकन पाइपलाइन है (अनुवाद, आलोचना, पैच, सत्यापित करें) । शायद यह एक बहु-टर्न सहायक है जो उड़ानें बुक करता है, ईमेल लिखता है, और खर्च रिपोर्ट फाइल करता है। आप एक ढांचा चुनते हैं।

तीन दिन बाद, आप फ्रेमवर्क के अमूर्त लीक का पता लगाते हैं। CrewAI आपको भूमिकाएं देता है लेकिन जब "अनुसंधानकर्ता" को "लेखक" को एक संरचित योजना सौंपने की आवश्यकता होती है तो आपको "क्राउएई" देता है। ऑटोजेन आपको एजेंटों के बीच चैट देता है लेकिन इसमें प्रथम श्रेणी की स्थिति नहीं है इसलिए आपका चेकपॉइंट एक बातचीत लॉग का एक मसाला है। लैंगग्राफ आपको एक राज्य ग्राफ देता है लेकिन आपको एजेंट क्या करेगा, यह जानने से पहले प्रत्येक संक्रमण का नाम देने के लिए मजबूर करता है। एग्नो आपको एक एकल एजेंट अमूर्तता देता है जो चिल्लाता है जब आप तीन समवर्ती श्रमिकों को फैलाव करने की कोशिश करते हैं।

समाधान "सबसे अच्छा फ्रेमवर्क चुनें" नहीं है. यह आपके समस्या के आकार के लिए फ्रेमवर्क के मूल अमूर्तता को मेल करना है. यह सबक उस नक्शे को आकर्षित करता है।

## अवधारणा

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

2026 के परिदृश्य पर चार ढांचे का शासन है। उनके मूल अमूर्त रूप समान नहीं हैं।

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### "अवधारण" का क्या मतलब है

एक फ्रेमवर्क का मूल अमूर्तता वह चीज है जिसे आप वाइटबोर्ड पर आकर्षित करते हैं जब आप वास्तुकला को पेश करते हैं।

- **LangGraph**→ आप एक ग्राफ आकर्षित करते हैं. नोड्स कदम हैं, किनारे संक्रमण हैं, और प्रत्येक बिंदु पर राज्य वस्तु टाइप की जाती है. मानसिक मॉडल एक राज्य मशीन है।
- **CrewAI**→ आप एक संगठन चार्ट बनाते हैं. प्रत्येक भूमिका में एक नौकरी का विवरण होता है और एक प्रबंधक कार्यों को मार्ग देता है. मानसिक मॉडल विशेषज्ञों की एक छोटी टीम है।
- **AutoGen**एक दूसरे को संदेश भेजने वाले दो एजेंट एक दूसरे को संदेश भेजते हैं, एक तीसरा एक मॉडरेटर की जरूरत है तो एक साथ आता है. मानसिक मॉडल चैट है।
- **Agno**→ आप एक एकल बॉक्स को खींचते हैं जिसमें उपकरण लटकाए जाते हैं। एक टीम के लिए एक दूसरे के बक्से रखें। मानसिक मॉडल "बैटरी शामिल एजेंट" है।

### राज्य प्रश्न

राज्य वह जगह है जहां अधिकांश ढांचे के विकल्प उत्पादन में टूट जाते हैं।

- **LangGraph.**प्रकार की स्थिति (`TypedDict`या पिदान्टिक मॉडल), प्रति क्षेत्र घटकों, प्रथम श्रेणी के चेक पॉइंटर (SQLite/Postgres/Redis) । रिज्यूमे, इंटरट्यूड और टाइम ट्रैवल मुफ्त है। *(देखें चरण 11 · 16.) *
- **CrewAI.**  के माध्यम से कार्यों के बीच स्ट्रिंग के रूप में राज्य प्रवाह`context`क्षेत्र, या संरचना के माध्यम से `output_pydantic`कोई टिकाऊ प्रति चालक दल स्टोर बॉक्स से बाहर; आप अपने दम पर बोल्ट अगर चालक दल को एक पुनरारंभ में जीवित रहना होगा.
- **AutoGen.**राज्य चैट इतिहास और किसी भी उपयोगकर्ता द्वारा परिभाषित है `context`. वार्तालाप प्रतिलेखन बरकरार; मनमानी कार्यप्रवाह स्थिति नहीं जब तक आप एडाप्टर लिखते हैं.
- **Agno.**एक  से जुड़े अंतर्निहित भंडारण ड्राइवर (SQLite, Postgres, Mongo, Redis, DynamoDB)`Agent`द्वारा `storage=` बातचीत सत्र और उपयोगकर्ता स्मृति स्वचालित रूप से बनी रहती है. एक पूर्ण ग्राफ चेक पॉइंटर नहीं; सत्र स्टोर।

### शाखाओं का प्रश्न

हर गैर-नाज़ुक एजेंट शाखाओं, जो शाखाओं के मामलों का फैसला करता है.

- **LangGraph** आप सशर्त किनारों के माध्यम से निर्णय लेते हैं। राउटिंग नामित शाखाओं के साथ एक पायथन फ़ंक्शन है। संकलित ग्राफ में शाखाएं प्रथम श्रेणी हैं; चेक पॉइंटर रिकॉर्ड करता है कि कौन सी शाखा ली गई थी।
- **CrewAI** प्रबंधक पदानुक्रमिक मोड में निर्णय लेता है; अनुक्रमिक मोड में आप निर्माण समय पर निर्णय लेते हैं। रूटिंग कार्य सूची में अप्रत्यक्ष है; प्रबंधक के प्रॉम्प्ट के बाहर कोई प्रथम श्रेणी "यदि" नहीं है।
- **AutoGen** एजेंट चैट के माध्यम से निर्णय लेते हैं। शाखा कौन अगला बोलता है से उभरता है। `GroupChatManager`अगले स्पीकर का चयन करता है; आप एक हाथ से लिख सकते हैं `speaker_selection_method`लेकिन डिफ़ॉल्ट LLM-चालित है।
- **Agno** एजेंट तय करता है कि किस उपकरण के साथ अगला कॉल करना है। टीमों में एक समन्वयक/राउटर/सहयोगकर्ता मोड होता है; इसके अलावा शाखाएं विकसित करने की जिम्मेदारी डेवलपर की होती है।

### अवलोकनशीलता प्रश्न

- **LangGraph** LangSmith या किसी भी OTel निर्यातक के माध्यम से OpenTelemetry। प्रत्येक नोड संक्रमण एक ट्रैक स्पैन है; चेकपॉइंट दोहराए जाने वाले ट्रैक के रूप में डबल हैं। LangSmith प्रथम पक्ष विकल्प है; Langfuse / Phoenix में भी एडाप्टर हैं।
- **CrewAI** 2025 के अंत से प्रथम श्रेणी की ओपनटेलीमेट्री; लैंगफ्यूज, फीनिक्स, ओपिक, एजेंटऑप्स के साथ एकीकरण।
- **AutoGen** OpenTelemetry के माध्यम से एकीकरण `autogen-core`एजेंटओप्स और ओपिक के कनेक्टर हैं। ट्रैकिंग ग्रेन्युलरता प्रति एजेंट संदेश है, न कि प्रति नोड।
- **Agno** अंतर्निहित `monitoring=True`फ्लैग प्लस ओपनटेलीमेट्री निर्यातक; सत्रों के निशान के लिए लैंगफ्यूज के साथ सख्त एकीकरण।

### लागत और विलंबता

सभी चार फ्रेमवर्क प्रति कॉल ओवरहेड (फ्रेमवर्क लॉजिक, वैलिडेशन, सीरियलाइज़ेशन) जोड़ते हैं। ओवरहेड बढ़ाने का कड़ा क्रमः Agno ≈ LangGraph < CrewAI ≈ AutoGen। अंतर इस बात से हावी है कि फ्रेमवर्क को कितना अतिरिक्त LLM रूटिंग करता है। CrewAI के पदानुक्रमिक प्रबंधक टोकन खर्च करते हैं जो आगे जाने का निर्णय लेते हैं; ऑटोजेन का `GroupChatManager`LangGraph केवल टोकन खर्च जहां आप लिखते हैं`llm.invoke`. एग्नो के एकल एजेंट पथ पतला है.

जब प्रति रन लागत मायने रखता है, तो स्पष्ट रूटिंग (लंगग्राफ किनारे, ऑटोजेन `speaker_selection_method`) पर LLM- चयनित रूटिंग।

### सहकार्यशीलता

- **LangGraph** **LangChain**उपकरण, रिट्रीवर, LLM प्रथम श्रेणी के MCP एडाप्टर (MCP सर्वर के रूप में आयातित उपकरण) ।
- **CrewAI** उपकरण विरासत में `BaseTool`; लैंगचेन उपकरण, LlamaIndex उपकरण और MCP उपकरण सभी अनुकूलित हैं।`allow_delegation=True`. .
- **AutoGen**→ `FunctionTool`किसी भी पायथन कॉल करने योग्य को लपेटता है; एमसीपी एडाप्टर उपलब्ध है। एजेंट-टू-एजेंट पैटर्न के लिए एजी 2 पारिस्थितिकी तंत्र के लिए कस संरेखण।
- **Agno**→ `@tool`सजावट या बेसटूल उपवर्ग; एमसीपी एडाप्टर; एजेंटों और टीमों के बीच उपकरण साझा किए जा सकते हैं।

## कौशल

> आप एक वाक्य में समझा सकते हैं कि एक निश्चित ढांचा किसी निश्चित एजेंट समस्या के लिए क्यों सही है।

पूर्व-निर्माण चेकलिस्टः

1. **Draw the shape.**क्या यह एक ग्राफ (प्रकारित स्थिति, नामित संक्रमण) है? एक भूमिका खेल (विशेषज्ञ काम छोड़ देते हैं)? एक चैट (एजेंट्स काम करने तक बात करते हैं)? उपकरण के साथ एक एकल एजेंट?
2. **Decide who branches.**डेवलपर-निर्धारित शाखा → लैंगग्राफ. प्रबंधक-एजेंट-निर्धारित → क्रूएआई पदानुक्रमिक. चैट-उत्पादित → ऑटोजेन. टूल-कॉल-निर्धारित → एगनो.
3. **Check the state budget.**क्या आपको चेक-पॉइंट से रिज्यूमे की आवश्यकता है? समय यात्रा? मानव मध्य-चलन में बाधित करता है? यदि हां, तो लैंगग्राफ डिफ़ॉल्ट है; एग्नो सत्र बातचीत-स्केप राज्य को कवर करते हैं।
4. **Check the cost budget.**एलएलएम द्वारा चुने गए रूटिंग प्रति बारी अतिरिक्त टोकन लागत है। यदि एजेंट दिन में हजारों बार चलाता है, स्पष्ट रूटिंग पसंद करते हैं।
5. **Budget the framework overhead.**प्रत्येक फ्रेमवर्क एक और निर्भरता है. यदि कार्य दो एलएलएम कॉल और एक उपकरण है, तो सादे पायथन की 30 पंक्तियां लिखें; कोई फ्रेमवर्क किसी फ्रेमवर्क से सस्ता नहीं है।

जब तक आप ग्राफ, ऑर्ग चार्ट, चैट या एजेंट बॉक्स को आकर्षित नहीं कर सकते, तब तक एक फ्रेमवर्क की तलाश करने से इनकार करें।

## निर्णय मैट्रिक्स

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## व्यायाम

1. **Easy.**उसी कार्य को करें  "एंट्रोपिक के मुख्यालय का शोध करें, 200 शब्दों का एक संक्षिप्त पत्र लिखें, स्रोतों का हवाला दें"  और इसे लैंगग्राफ (चार नोड्सः योजना, खोज, लेखन, हवाला दें) और क्रूएआई (तीन भूमिकाएंः शोधकर्ता, लेखक, संपादक) में लागू करें। प्रति रन और कोड की पंक्तियों के लिए टोकन लागत की रिपोर्ट करें।
2. **Medium.**ऑटोजेन में एक ही कार्य का निर्माण करें (अनुसंधानकर्ता  लेखक चैट, संपादक के माध्यम से शामिल होता है `GroupChat`) और एग्नो (एक ही एजेंट के साथ)`search_tools`और `write_tools`(क) प्रति रन लागत, (ख) दुर्घटना के बाद फिर से शुरू करने की क्षमता, (ग) लेखन चरण से पहले मानव अनुमोदन इंजेक्शन करने की क्षमता।
3. **Hard.**निर्णय वृक्ष स्क्रिप्ट बनाएं `pick_framework.py`जो एक संक्षिप्त समस्या विवरण लेता है (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) और एक वाक्य के साथ एक सिफारिश लौटाता है। इसे आप स्वयं डिजाइन किए गए छह मामलों पर सत्यापित करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## आगे पढ़ना

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) स्टेटग्राफ, चेक पॉइंटर्स, इंटरक्यूज, टाइम ट्रैवल।
- [CrewAI documentation](https://docs.crewai.com/) चालक दल, प्रवाह, एजेंट, कार्य, प्रक्रियाएं।
- [AutoGen documentation](https://microsoft.github.io/autogen/) ConversableAgent, GroupChat, टीम, उपकरण।
- [Agno documentation](https://docs.agno.com/) एजेंट, टीम, वर्कफ़्लो, भंडारण, मेमोरी।
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) पैटर्न लाइब्रेरी (प्रॉम्प्ट चेनिंग, राउटिंग, समानांतर, ऑर्केस्ट्रेटर-वर्कर, मूल्यांकनकर्ता-अनुकूलनकर्ता) फ्रेमवर्क-अज्ञानी।
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) लूप हर फ्रेमवर्क कपड़े ऊपर।
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) ऑटोजेन का डिजाइन पेपर।
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) भूमिका-खेल की नींव जिस पर CrewAI शैली के व्यक्ति ढेरों का निर्माण होता है।
- चरण 11 · 16 (लंगग्राफ)  इस पाठ के संदर्भ ढांचे के साथ तुलना।
- चरण 11 · 19 (विचार)  एक पैटर्न जो लैंगग्राफ के लिए साफ नक्शा बनाता है लेकिन CrewAI के लिए अजीब है।
- चरण 11 · 22 (उत्पादन की अवलोकन क्षमता)  आप जो भी ढांचा चुनते हैं, उसे कैसे उपकरण बनाया जाए।
