# एजेंट कौशलः पोर्टेबल कॉन्ट्रैक्ट और रनटाइम सीमा

> एक कौशल एक बेहतर फ़ाइल नाम के साथ एक लंबा प्रॉम्प्ट नहीं है। यह निर्देशों, संसाधनों और निष्पादित करने योग्य सहायक का एक खोज योग्य पैकेज है जो रनटाइम अनुबंध के माध्यम से एक एजेंट के संदर्भ में प्रवेश करता है।

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## सीखने के लक्ष्य

- एक एजेंट कौशल को एक प्रॉम्प्ट, रिपॉजिटरी निर्देश, एक उपकरण, एक हुक, एक सबगेन्ट या एक प्लगइन के साथ भ्रमित किए बिना परिभाषित करें।
- पोर्टेबल पढ़ें `SKILL.md`अनुबंध और इसे रनटाइम-विशिष्ट विस्तार से अलग करना।
- खोज, चयन, सक्रियण, संसाधन लोडिंग, उपकरण उपयोग और सत्यापन को जीवन चक्र के अलग-अलग चरणों के रूप में समझाएं।
- एक रनटाइम एजेंट की सूची में डाल से पहले एक कौशल पैकेज को मान्य करें।
- किसी विशिष्ट कार्य के लिए एक कौशल, एमसीपी उपकरण, हुक, सबगेन्ट या साधारण कोड के बीच चयन करें।

## दस मिनट की पहली सफलता

लंबे स्पष्टीकरण से पहले ऐसा करें. आप एक छोटे कौशल बनाने, स्थापित
एक वास्तविक एजेंट मेजबान में पूर्ण समीक्षक बंडल, इसे कॉल, सत्यापित
यह एक अवलोकन योग्य परिणाम के साथ जीवन चक्र साबित करता है।

### वास्तविक मेजबान प्रयोगशाला के लिए पूर्व उड़ान

वास्तविक मेजबान चेकपॉइंट Node.js की आवश्यकता होती है, `npx`, पायथन 3, एक चुना
कौशल सक्षम होस्ट, और परियोजना या उपयोगकर्ता दायरा आप चुनते हैं में पहुँच लिखने
पहले स्थानीय आदेशों की जांच करेंः

```bash
node --version
npx --version
python3 --version
```

स्थापना से पहले आप किस होस्ट और दायरे का उपयोग करेंगे, इसका निर्णय लें।
आवश्यकता उपलब्ध नहीं है, इस सबक को वेबसाइट पर पढ़ें या आगे बढ़ें
नीचे मैनुअल पैकेज अभ्यास है। कि पतन अनुबंध सिखाता है, लेकिन यह
होस्ट डिस्कवरी, इनवोकशन, बंडल-स्क्रिप्ट निष्पादन का प्रमाण नहीं देता है, या
उन अवलोकनों को प्रतीक्षा में चिह्नित रखें।

### 1. एक खाली कार्य निर्देशिका में शुरू करें

किसी भी माता-पिता निर्देशिका से इन आदेशों को चलाएं जहां आप काम सीखते रहते हैंः

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

अंतिम आदेश कुछ भी प्रिंट नहीं करना चाहिए. अगर यह फ़ाइलें प्रिंट करता है, एक अलग चुनें
रिक्त निर्देशिका तो समीक्षा एक स्पष्ट सीमा है।

अपनी पहली कौशल के लिए एक निर्देशिका बनाएंः

```bash
mkdir -p my-first-skill
```

सृजन`my-first-skill/SKILL.md`इस सामग्री के साथः

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

सत्यापित करें कि आपने फ़ाइल को इच्छित निर्देशिका में बनाया हैः

```bash
test -f my-first-skill/SKILL.md
```

कोई आउटपुट और आउटपुट कोड 0 का मतलब है कि फ़ाइल मौजूद है।

### 2. पूर्ण समीक्षक बंडल स्थापित करें

अंदर रहो `agent-skills-first-run`और चलाएँः

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

आप एजेंट होस्ट और दायरा का चयन करें आप उपयोग कर रहे हैं. इंस्टॉलर सूचीबद्ध करना चाहिए
`skill-contract-reviewer`और जिस गंतव्य पर लिखा गया था।`--full-depth`है
आवश्यक है क्योंकि इस पाठ की कौशल संदर्भों के साथ एक घोंसले हुए बंडल है, एक
एक स्क्रिप्ट, और एक संपत्ति.

सेट `SKILL_ROOT`स्थापनाकर्ता द्वारा रिपोर्ट की गई पूर्ण निर्देशिका में।
स्थापित होने वाली निर्देशिका हो `SKILL.md`, पाठ स्रोत नहीं
निर्देशिका और वर्तमान कार्यक्षेत्र नहींः

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

यदि एजेंट सत्र पहले से ही खुला था, एक नया सत्र शुरू या उस मेजबान के सत्र का उपयोग
यह मत मानो कि हर होस्ट अपने कैटलॉग को गर्म रीलोड करता है।

### 3. इसे स्पष्ट रूप से बुलाओ

 के साथ स्थापित एजेंट में`agent-skills-first-run`कार्यरत
निर्देशिका, उस होस्ट द्वारा समर्थित वाक्यविन्यास का उपयोग करेंः

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

 के लिए मुद्रित निरपेक्ष मानों का उपयोग करें`SKILL_ROOT`और `TARGET_ROOT`में
अनुरोध. होस्ट से उन्हें निष्पादन से पहले विस्तार करने के लिए अनुरोध करें और सटीक दिखाएं
हल कमांड, प्रक्रिया कार्य निर्देशिका पर निर्भर नहीं कमांडः

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

हल कमांड का आकार इस प्रकार होना चाहिए, जिसमें कोई स्थानधारक नहीं बचेः

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

सफल परिणाम में तीनों गुण होते हैंः

1. मेजबान खोजता है `skill-contract-reviewer`नाम से।
2. समीक्षक पैकेज अनुबंध को पढ़ता है और उसका बंडल वैधकर्ता चलाता है।
3. इस प्रतिक्रिया में एक सत्यापन रिपोर्ट है जिसमें संरचनात्मक त्रुटि नहीं है
   नमूना, प्लस एक उचित आदिम चयन।

निष्पादन सबूत भी स्क्रिप्ट पथ का नाम देना चाहिए, लक्ष्य पथ, सीडीडी, सटीक
तर्क वेक्टर, और प्रस्थान कोड. इन क्षेत्रों के बिना एक धाराप्रवाह रिपोर्ट नहीं है
साबित करें कि स्थापित साथी स्क्रिप्ट चल रही है।

यदि होस्ट रिपोर्ट करता है कि कौशल अनुपलब्ध है, स्थापना की पुष्टि करें
गंतव्य, फिर से स्कैन या फिर से शुरू एक बार, और स्पष्ट अनुरोध फिर से प्रयास करें।
स्थापना विफलता को छिपाने के लिए कौशल विवरण को फिर से लिखें।

### 4. जांच का संवेदी चयन

एक नया एजेंट बारी शुरू करें और कौशल का नाम दिए बिना एक ही कार्य दर्ज करेंः

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

यदि मेजबान चयनित कौशल का खुलासा करता है, तो रिकॉर्ड करें कि क्या उसने चुना है
`skill-contract-reviewer`. यदि मेजबान रूटिंग का खुलासा नहीं करता है, तो संक्षेप में चिह्नित करें
स्पष्ट रूप से बुलावा पोर्टेबल fallback है।

### 5. साफ करें

केवल स्थापित रिव्यूर बंडल को हटा दें:

```bash
npx skills remove skill-contract-reviewer
```

स्थापना के दौरान उपयोग किए गए होस्ट और दायरे का चयन करें। पुनः स्कैन या नए
सत्र, एक स्पष्ट अनुरोध के लिए `skill-contract-reviewer`रिपोर्ट करना चाहिए कि
यह उपलब्ध नहीं है।`my-first-skill`बाद के पाठों के लिए, या हटा दें
आप ट्रैक खत्म करने के बाद प्रयोगशाला निर्देशिका.

## समस्या

मान लीजिए आपकी टीम में एक विश्वसनीय रिलीज़ वर्कफ़्लो है। यह विलय किए गए परिवर्तनों को ढूंढता है, माइग्रेशन नोट्स की जांच करता है, चैंजलॉग को अपडेट करता है, पैकेजिंग कमांड चलाता है, और समीक्षा की जाँच सूची बनाता है।

एक प्रॉम्प्ट में उस वर्कफ़्लो को डालने से पेस्ट करना आसान हो जाता है और ऑपरेट करना मुश्किल हो जाता है। प्रॉम्प्ट में कोई स्थिर पहचान नहीं है, कोई डिस्कवरी नियम नहीं है, कोई संसाधन सीमा नहीं है, कोई परीक्षण योग्य पैकेज आकार नहीं है, और बुनियादी सवालों के जवाब नहीं हैंः इसे किसने कॉल कर सकता है? मॉडल को इसे कब चुनना चाहिए? यह किस स्क्रिप्ट को चला सकता है? किस फ़ाइल पर भरोसा किया जा सकता है? जब संदर्भ संपीड़ित किया जाता है तो क्या बचा रहता है?

इसके विपरीत, प्रत्येक पुनः प्रयोज्य निर्देश को एक कौशल के रूप में माना जाना गलत है। भंडारण सम्मेलन, निर्धारात्मक स्वचालन, बाहरी उपकरण, घटना हुक और प्रतिनिधि एजेंट विभिन्न समस्याओं को हल करते हैं। उन सभी को पैक करना।`SKILL.md`एक होस्ट के अनौपचारिक व्यवहार पर निर्भर करते हुए एक निर्देशिका उत्पन्न करता है जो पोर्टेबल दिखता है।

पहले इंजीनियरिंग कार्य वर्गीकरण है, यह तय करना कि कलाकृतियों को पैकेज करने से पहले क्या है।

## अवधारणा

### प्रक्रियात्मक ज्ञान को कोड करने के लिए कौशल

एक एजेंट कौशल एक निर्देशिका है जिसका प्रवेश बिंदु है `SKILL.md`. प्रविष्टि फ़ाइल में YAML फ्रंटमैटर होता है जिसके बाद मार्कडाउन निर्देश होते हैं. निर्देशिका में संदर्भ, स्क्रिप्ट और संपत्ति भी हो सकती है।

```figure
skill-package-anatomy
```

निर्देशिका, केवल मार्कडाउन फ़ाइल नहीं, तैनात करने योग्य इकाई है।`SKILL.md`संदर्भों की कमी के साथ एक टूटा हुआ पैकेज है भले ही इसके सामने की सामग्री को विश्लेषण किया जाए।

### पड़ोसी अमूर्तियाँ

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

एक रिलीज़ कौशल एजेंट को बता सकता है कि रिलीज़ की जांच कैसे करें। एक एमसीपी सर्वर रिलीज़ रजिस्ट्री को उजागर कर सकता है। एक हुक प्रत्यक्ष धक्काओं को प्रतिबंधित कर सकता है। एक उप-सैन्य उम्मीदवार को स्वतंत्र रूप से ऑडिट कर सकता है। ये टुकड़े इसलिए बनाते हैं क्योंकि वे अलग-अलग जिम्मेदारियों को बनाए रखते हैं।

### "कुशल" शब्द दो अलग-अलग विचारों का नाम है

अनुसंधान प्रणालियों में कभी-कभी एक सीखा गया कार्यक्रम, सफल पटरियों या पर्यावरण-विशिष्ट नीति टुकड़े को एक कौशल कहा जाता है। एक एजेंट खोज के दौरान इन कलाकृतियों को बना सकता है, उन्हें कार्य समानता द्वारा प्राप्त कर सकता है, उन्हें निष्पादित कर सकता है, और प्रतिक्रिया से पुस्तकालय को संशोधित कर सकता है। चरण 14 · 10 इस तरह के जीवन भर सीखने वाली पुस्तकालय का निर्माण करता है।

इस मिनी-ट्रैक में एक एजेंट कौशल अलग है। यह एक लेखक पैकेज है जिसमें एक घोषित फ़ाइल सिस्टम अनुबंध, कैटलॉग मेटाडेटा, प्रगतिशील प्रकटीकरण, रनटाइम-मध्यस्थ इनवॉकिंग और होस्ट-नियंत्रित उपकरण हैं। इसे एक एजेंट द्वारा उत्पन्न या सुधार किया जा सकता है, लेकिन प्रारूप के लिए सीखने की आवश्यकता नहीं है।

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

दोनों विचार पुनर्नवीनीकरण योग्य क्षमताओं को पैकेज करते हैं। उन्हें केवल इसलिए कार्यान्वयन के दावे साझा नहीं करने चाहिए क्योंकि वे एक नाम साझा करते हैं।

### पोर्टेबल कोर

एजेंट कौशल विनिर्देश दो सामने की सामग्री क्षेत्रों की आवश्यकता होती हैः

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`यह विनिर्देश के नामकरण नियमों को पूरा करना चाहिए और मूल निर्देशिका से मेल खाना चाहिए। `description`यह दस्तावेजीकरण और रूटिंग मेटाडेटा दोनों है। यह कहना चाहिए कि कौशल क्या करता है और जब यह लागू होता है।

पोर्टेबल वैकल्पिक फ़ील्ड हैंः

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

मार्कडाउन निकाय में ऑपरेशनल निर्देश हैं। यह कार्यप्रवाह, निर्णय बिंदुओं, विफलता व्यवहार और समर्थन संसाधनों के लिए प्रत्यक्ष मार्गों को परिभाषित करना चाहिए।

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### रनटाइम एक्सटेंशन एक दूसरी परत है

कुछ होस्ट अतिरिक्त फ्रंटमैटर या साथी कॉन्फ़िगरेशन स्वीकार करते हैं। ये फ़ील्ड उपयोगी हो सकते हैं, लेकिन वे स्वचालित रूप से पोर्टेबल नहीं हैं।

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

प्रत्येक एक्सटेंशन को एक एडाप्टर के रूप में व्यवहार करें। इसके बिना कोर वर्कफ़्लो को मान्य रखें, फॉलबैक का दस्तावेजीकरण करें, और इसे खपत करने वाले होस्ट का परीक्षण करें। एक रनटाइम एक अज्ञात फ़ील्ड को अनदेखा कर सकता है, इसे अस्वीकार कर सकता है, या व्यवहार को लागू किए बिना इसे संरक्षित कर सकता है।

### फ्रंटमैटर निष्पादित मेटाडेटा है

मेटाडेटा कौशल शरीर को पढ़ने से पहले सिस्टम व्यवहार को बदलता है।

- एक विकृत `name`यह खोज को विफल कर सकता है।
- एक अस्पष्ट `description`गलत अनुरोधों को मार्गदर्शक कर सकते हैं।
- केवल मानव ध्वज मॉडल की सूची से कौशल को हटा सकता है।
- उपकरण अनुदान में परिवर्तन हो सकता है कि होस्ट अनुमति मांगता है या नहीं।
- एक संदर्भ सेटिंग निष्पादन को एक अलग एजेंट सत्र में स्थानांतरित कर सकती है।

कॉन्फ़िगरेशन कोड जैसे फ्रंटमैटर की समीक्षा करें, इसे मान्य करें, इसे संस्करण करें और मूल्यांकन में इसके व्यवहार को शामिल करें।

### कौशल जीवन चक्र

```figure
skill-runtime-lifecycle
```

प्रत्येक तीर एक सीमा है अपने स्वयं के विफलता मोड के साथ।

1. **Discovery**कॉन्फ़िगर किए गए स्थानों में संभावित पैकेज ढूंढता है।
2. **Validation**कैटलॉग प्रकाशन से पहले गलत रूप से तैयार या असुरक्षित पैकेज को अस्वीकार करता है।
3. **Cataloging**एक कॉम्पैक्ट को उजागर करता है `name`और `description`, पूरा पैकेज नहीं.
4. **Selection**निर्णय लेता है कि क्या कौशल प्रासंगिक है।
5. **Activation**शरीर को मॉडल दृश्यमान संदर्भ में लोड करता है।
6. **Disclosure**केवल तब संदर्भ या संपत्ति पढ़ता है जब शाखा उन्हें मांगती हो।
7. **Execution**होस्ट के अनुमतियों और अलगाव नियमों के तहत होस्ट टूल का उपयोग करता है।
8. **Verification**उत्पादित कलाकृतियों की जांच मॉडल के दावे से स्वतंत्र रूप से की जाती है।

इन चरणों में गिरावट से खराब मानसिक मॉडल पैदा होते हैं। एक पता लगाया गया कौशल सक्रिय नहीं होता है। एक सक्रिय कौशल को यह सब करने की अनुमति नहीं है जो यह वर्णन करता है। एक अनुमति प्राप्त उपकरण कॉल परिणाम सही है कि सबूत नहीं है।

### कौशल और उपकरण समान हैं

एमसीपी जवाब देता है, "इस एप्लिकेशन किस क्षमताओं को बुला सकता है, और उनकी योजनाएं क्या हैं?" एक कौशल जवाब देता है, "एजेंट को इस कार्य वर्ग के दृष्टिकोण को कैसे approach करना चाहिए? "

```figure
skill-tool-orthogonality
```

कौशल एक उपकरण का नाम ले सकता है, लेकिन मेजबान वास्तविक क्षमता रजिस्ट्री का मालिक है। यदि उपकरण अनुपस्थित है, तो कौशल को एक विफलता या विफलता स्पष्ट रूप से बतानी चाहिए। इसका मतलब यह नहीं होना चाहिए कि किसी क्षमता का नामकरण इसे बनाता है।

### कौशल और भंडार निर्देश अलग-अलग दायरे हैं

रिपॉजिटरी निर्देश आपके पहले से ही जिस वातावरण में हैं, उसे बताते हैंः कमांड, कन्वेंशन, जेनरेट की गई फ़ाइलें और सीमाएं। एक कौशल एक कार्य के लिए पुनः प्रयोज्य प्रक्रिया प्रदान करता है जो कई रिपॉजिटरी में हो सकता है।

जब दोनों लागू होते हैं, तो सक्रिय उपयोगकर्ता अनुरोध और भंडार नियम कौशल को सीमित करते हैं। एक सामान्य पुनरावर्तन कौशल को एक भंडार नियम को ओवरराइड नहीं करना चाहिए जो उत्पन्न फ़ाइलों को संपादित करने से मना करता है।

### कौशल एक दूसरे को आयात नहीं करते

एक कौशल एजेंट को दूसरे को कॉल करने के लिए निर्देशित कर सकता है, लेकिन यह भाषा स्तर का आयात नहीं है। दूसरा कौशल अभी भी रनटाइम डिस्कवरी, पात्रता, सक्रियण, अनुमतियां और संदर्भ प्रबंधन के माध्यम से जाता है।

पार-कुशल निर्भरता को अवलोकन योग्य कार्यप्रवाह किनारों के रूप में लिखेंः

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

इससे निर्भरता की जांच की जा सकती है और मेजबान को नीति लागू करने का मौका मिलता है।

## इसे बनाओ

`code/main.py`यह केवल stdlib रहता है ताकि हर नियम दिखाई दे।

सत्यापितकर्ता का पता चलता हैः

- `parse_frontmatter(text)`शरीर से मेटाडेटा को अलग करने के लिए।
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`आवश्यक क्षेत्रों, नामकरण, अज्ञात विस्तार, शरीर की उपस्थिति और पोर्टेबल सीमाओं की जांच करने के लिए।
- `ValidationIssue`और `SkillReport`एक अपारदर्शी बुलियन के बजाय संरचित सबूत वापस करने के लिए।
- `FrontmatterSyntaxError`ऐसे इनपुट के लिए जो सुरक्षित रूप से व्याख्या नहीं की जा सकती है।

चयनकर्ता प्रकट करता है `TaskShape`और `select_primitives(task)`. यह सामान्य कोड, भंडार निर्देश, एक कौशल, एक हुक, एक उप-सग, या एक MCP उपकरण के लिए एक कार्य की जरूरतों का नक्शा बनाता है.

प्रयोगशाला चलाओ:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

इस कमांड ब्लॉक एक स्थानीय क्लोन की आवश्यकता है और अंदर से कहीं से शुरू करना चाहिए
कि क्लोन तो `git rev-parse --show-toplevel`भंडारण रूट हल कर सकते हैं।

डेमो एक मान्य पोर्टेबल कौशल, एक होस्ट-विस्तारित कौशल, एक अमान्य पैकेज और कई कार्य-आकार निर्णयों के लिए JSON प्रिंट करता है। मुद्दे कोड की जांच करें। एक पैकेज सत्यापनकर्ता को लेखक की ओर से अनुमान लगाए बिना किसी कलाकृतियों को कैसे ठीक किया जाए, इसकी व्याख्या करनी चाहिए।

### सत्यापन आदेश के मामले

गहन सामग्री नियमों से पहले सस्ते संरचनात्मक तथ्यों को मान्य करेंः

```figure
skill-validation-order
```

यह क्रम द्वितीयक त्रुटियों को पहले टूटे हुए अपरिवर्तनीय को अन्धकार से रोकता है।

## इसका प्रयोग करें

किसी कौशल को लिखने से पहले, यह निर्णय कार्ड भरेंः

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

कई उत्पादन कार्यप्रवाहों में एक से अधिक पंक्ति का उपयोग किया जाता है। कार्ड एक कलाकृतियों को हर संपत्ति प्रदान करने का नाटक करने से रोकता है।

## इसे भेजें

यह सबक `skill-contract-reviewer``outputs/`इसमें निम्नलिखित शामिल हैंः

- एक पोर्टेबल `SKILL.md`जो प्रस्तावित कौशल पैकेज की समीक्षा करता है;
- पोर्टेबल अनुबंध और आदिम चयन के लिए संदर्भ चेकलिस्ट;
- निर्धारक सत्यापन स्क्रिप्ट;
- कार्य-आकार के उपकरण जो संकेत, कौशल, उपकरण, हुक, सामान्य कोड और उप-सम्बन्धी को कवर करते हैं।

पूरे बंडल को स्थापित करें, न केवल इसकी प्रविष्टि फ़ाइलः

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

पाठ्यक्रम इंस्टॉलर प्रतिलिपि चरण 13 कौशल प्रत्येक रिपोर्ट और लिखता है
`/tmp/aiefs-skills/manifest.json`. यह स्वच्छ गंतव्य पैकेज के आकार की जांच करता है;
ऊपर पहला सफलता लूप वास्तविक मेजबान में खोज और आह्वान की जांच करता है।

निम्नलिखित पाठ जीवन चक्र के प्रत्येक चरण को गहरा करते हैं। पाठ 24 खोज और प्रगतिशील प्रकटीकरण का निर्माण करता है। पाठ 25 कॉल नीति और रूटिंग का निर्माण करता है। पाठ 26 सैंडबॉक्सिंग से अनुमतिओं को अलग करता है। पाठ 27 पूरे पैकेज को एक मूल्यांकन रिलीज़ आर्टिफैक्ट में बदल देता है।

## व्यायाम

1. अपनी टीम से पांच कार्यप्रवाहों को वर्गीकृत करें `TaskShape`. हर मामले का बचाव करें जहां आप एक से अधिक आदिम चुनते हैं.
2. सीमा परीक्षणों को जोड़ने के लिए यह साबित करने के लिए कि एक 500 वर्ण `compatibility`मान पारित होता है और एक 501 वर्ण मूल्य विनिर्देश त्रुटि के रूप में विफल रहता है।
3. अनुमति सूची में एक रनटाइम एक्सटेंशन जोड़ें. एक परीक्षण लिखें जो साबित करता है कि एक ही फ़ाइल अभी भी पोर्टेबल-केवल कौशल से अलग है।
4. 400 लाइनों के एक संकेत में विभाजित `SKILL.md`एक संदर्भ, एक स्क्रिप्ट अनुबंध, और एक आउटपुट टेम्पलेट. प्रत्येक फ़ाइल एक प्रकार की जानकारी के लिए जिम्मेदार रखें.
5. एक कौशल के लिए विफलता प्रतिक्रिया डिजाइन करें जो एक अनुपलब्ध MCP उपकरण का संदर्भित करता है। व्यापक अनुमतियों के साथ चुपचाप एक उपकरण की जगह न लें।
6. किसी मौजूदा कौशल की समीक्षा करें और प्रत्येक वाक्य को रूटिंग, प्रक्रिया, नीति, संदर्भ सूचक या आउटपुट अनुबंध के रूप में लेबल करें। जो भी नहीं है उसे हटा दें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## आगे पढ़ना

- [Agent Skills specification](https://agentskills.io/specification)पोर्टेबल निर्देशिका और फ्रंटमैटर अनुबंध के लिए।
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)दायरा, निर्देश और संसाधन संगठन के लिए।
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)वर्तमान कोडेक्स खोज और आह्वान व्यवहार के लिए।
- [Claude Code skills](https://code.claude.com/docs/en/skills)एक रनटाइम के आह्वान, तर्क, उपकरण और प्रदायित संदर्भ विस्तार के लिए।
