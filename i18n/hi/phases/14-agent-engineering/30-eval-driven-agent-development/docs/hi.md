# ईवल-ड्राइव एजेंट विकास

> मानव विज्ञान का मार्गदर्शनः "सरल संकेतों से शुरू करें, उन्हें व्यापक मूल्यांकन के साथ अनुकूलित करें, और आवश्यक होने पर ही बहु-चरण एजेंटिक सिस्टम जोड़ें।" मूल्यांकन अंतिम कदम नहीं है। यह बाहरी लूप है जो चरण 14 में अन्य सभी विकल्पों को चलाता है।

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## सीखने के लक्ष्य

- तीन मूल्यांकन परतों का नाम बताइए  स्थैतिक बेंचमार्क, कस्टम ऑफ़लाइन, ऑनलाइन उत्पादन  और प्रत्येक किस उद्देश्य के लिए है।
- मूल्यांकनकर्ता-अनुकूलनकर्ता सख्त लूप की व्याख्या करें।
- 2026 के सर्वोत्तम अभ्यास का वर्णन करेंः मूल्यांकन कोड के बगल में रहते हैं, आईसी में चलते हैं, गेट पीआर।
- प्रत्येक चरण 14 सबक को मूल्यांकन मामले से जोड़ें जो यह उत्पन्न करता है।

## समस्या

एजेंट डेमो पास करते हैं। वे उत्पादन में विफल होते हैं जिस तरह से डेमो का अनुमान नहीं लगाया जा सकता है। बेंचमार्क जवाब देते हैं "क्या यह मॉडल व्यापक रूप से सक्षम है?" नहीं "क्या यह एजेंट मेरे उत्पाद के लिए सही पैच भेज रहा है?" जवाबः तीन परतों पर मूल्यांकन, निरंतर चल रहा है, प्रत्येक गार्डरेल और सीखे गए नियम के साथ एक मूल्यांकन मामले में मैप किया गया है।

## अवधारणा

### तीन मूल्यांकन परतें

1. **Static benchmarks** SWE-बेंच ब्राउज़िंग / डेस्कटॉप के लिए सत्यापित (पढ़ना 19) , WebArena/OSWorld ब्राउज़िंग / डेस्कटॉप के लिए (पढ़ना 20) , GAIA के लिए सामान्यवादी (पढ़ना 19) , BFCL V4 के लिए उपकरण उपयोग (पढ़ना 06) । क्रॉस-मॉडल तुलना और प्रतिगमन गेटिंग के लिए उपयोग। प्रदूषण वास्तविक हैः SWE-बेंच + ने 32.67% समाधान रिसाव पाया। हमेशा SWE-बेंच सत्यापित या SWE-बेंच जैसे रिसाव-ऑडिट सेट पर स्कोर रिपोर्ट करें।

2. **Custom offline evals** आपके उत्पाद का आकारः
   - न्यायकर्ता के रूप में LLM (Langfuse, Phoenix, Opik  पाठ 24)
   - निष्पादन आधारित (पच चलाएं, जांच परीक्षण करें) ।
   - ट्रैकटोरिया आधारित (सोने के मुकाबले एक्शन सीक्वेंस की तुलना करें; ओएसवर्ल्ड-ह्यूमन सोने के मुकाबले शीर्ष एजेंटों को 1.4-2.7x दिखाता है) ।

3. **Online evals** उत्पादनः
   - सत्र रीप्ले (लंगफ्यूज)
   - गार्डरेल से ट्रिगर किए गए अलर्ट (पढ़ें 16, 21)
   - प्रति चरण लागत / विलंबता ट्रैकिंग (लर्सन 23 OTel का विस्तार) ।

### मूल्यांकनकर्ता-अनुकूलनकर्ता (मानव)

तंग लूपः

1. प्रस्तावक आउटपुट उत्पन्न करता है।
2. मूल्यांकनकर्ता न्यायाधीश।
3. मूल्यांकनकर्ता पास होने तक परिष्कृत करें।

यह आत्म-रिफाइन (लक्षण 05) सामान्य है. आप परवाह करने वाले किसी भी एजेंट प्रवाह विश्वसनीयता के लिए मूल्यांकनकर्ता-अनुकूलन में पैक कर सकते हैं।

### 2026 सर्वोत्तम प्रथा

- Evals कोड के बगल में रहते हैं।
- हर पीआर पर आईसी में चलें।
- मूल्यांकन स्कोर पर गेट विलय (जैसे "कोई पुनरावृत्ति नहीं > 5% बनाम मुख्य") ।
- हर गार्डरेल एक मूल्यांकन मामले के लिए नक्शे.
- प्रत्येक सीखे हुए नियम (विचार, कार्यप्रवाह समर्थक सीखने-नियम) एक विफलता के मामले का नक्शा बनाता है।

### चरण 14 को एक साथ जोड़ना

चरण 14 में अधिकांश पाठ मूल्यांकन मामलों को उत्पन्न करते हैं। तालिका में सबसे स्पष्ट के साथ पाठ सूचीबद्ध हैंः

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

यदि आपके मूल्यांकन सूट में प्रत्येक पंक्ति के लिए एक मामला है, तो आपने चरण 14 के मूल को कवर किया है।

### जहां मूल्यांकन-चालित विकास विफल रहता है

- **No baseline.**अंतिम ज्ञात-अच्छा के बिना Evals अवाचनीय हैं. भंडारण आधार रेखाओं.
- **LLM-judge without grounding.**आलोचनात्मक पैटर्न (पाठ 05)  बाहरी उपकरणों पर आधार पर न्याय करें।
- **Over-fitting to evals.**मूल्यांकन के लिए अनुकूलन उत्पादन उपयोगिता से भिन्न होता है।
- **Flaky evals.**गैर-निर्धारक मामलों में झूठी अलार्म पैदा होती है।

```figure
ae-eval-three-layers
```

## इसे बनाओ

`code/main.py`एक stdlib eval हर्नस हैः

- श्रेणीओं के साथ मामले रजिस्टर (बेंचमार्क, कस्टम, ऑनलाइन)
- एक स्क्रिप्ट एजेंट परीक्षण के तहत.
- मूल्यांकनकर्ता-अनुकूलनकर्ता लूपः प्रस्ताव, न्याय, पार या अधिकतम राउंड तक परिष्कृत करें।
- आईसी गेटः समग्र पास दर + बेसलाइन के मुकाबले प्रतिगमन।

इसे चलाओः

```
python3 code/main.py
npx tsx code/main.ts
```

आउटपुटः प्रति मामले पास/फेल, रिग्रेशन फ्लैग, आईसी गेट फैसले।

## इसका प्रयोग करें

- अपने एजेंट कोड के साथ एक ही रेपो में मूल्यांकन मामलों लिखें।
- उन्हें हर पीआर पर आईसी के माध्यम से चलाएं।
- प्रतिगमन पर निर्माण विफल.
- समय के साथ पास दर का पता लगाएं।
- प्रत्येक उत्पादन विफलता को एक नए मामले से जोड़ें।

## इसे भेजें

`outputs/skill-eval-suite.md`आईसी गेट और रेग्रिशन ट्रैकिंग के साथ एजेंट उत्पाद के लिए एक तीन-परत मूल्यांकन सूट बनाता है।

## व्यायाम

1. अपने उत्पादन विफलताओं में से एक ले लो, एक मूल्यांकन मामला लिखें जो इसे पुनः प्रस्तुत करता है।
2. अपने डोमेन के लिए तीन आयामों (वास्तविक, स्वर, दायरा) के साथ एक एलएलएम-जजज रूब्रिक बनाएं। 50 सत्रों का स्कोर करें।
3. मूल्यांकन सूट को आईसी में तार करें। >=5% प्रतिगमन पर बिल्ड विफल करें।
4. एक प्रक्षेपवक्र-कुशलता मीट्रिक जोड़ेंः एजेंट ने कितने कदम किए बनाम एक सोने की प्रक्षेपवक्र?
5. अपने सुइट में एक मूल्यांकन मामले के लिए प्रत्येक चरण 14 सबक मैप. कोई गायब?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## आगे पढ़ना

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) "सदा शुरू करें, मूल्यांकन के साथ अनुकूलित करें"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) संकलित बेंचमार्क
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) उपकरण उपयोग बेंचमार्क
- [Langfuse docs](https://langfuse.com/) मूल्यांकन + अभ्यास में सत्र दोहराव
