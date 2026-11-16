# कौशल का आह्वान और मार्गनिर्देशन

> एक अच्छा विवरण मॉडल को चुनने में मदद करता है; एक अच्छी नीति यह तय करती है कि क्या यह विकल्प अनुमति है।

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## सीखने के लक्ष्य

- स्पष्ट उपयोगकर्ता कॉल, अप्रत्यक्ष मॉडल कॉल, आवेदन कॉल और कौशल-से-कौशल कॉल में अंतर करें।
- मानव दृश्यता और पात्रता के मॉडल को स्वतंत्र नीतिगत आयाम के रूप में प्रस्तुत करें।
- सकारात्मक ट्रिगर और पास-मिस सीमाओं के साथ रूटिंग विवरण लिखें।
- अलग पात्रता, चयन, सक्रियण, तर्क बाध्यकारी, और निशान और परीक्षणों में निष्पादन।
- लंचटाइम विशिष्ट कॉल फ़ील्ड को पोर्टेबल फ्रंटमैटर के रूप में प्रस्तुत किए बिना अनुकूलित करें।

## समस्या

आप एक स्थापित `database-migration`कौशल. उपयोगकर्ता इसे नाम से चला सकता है, लेकिन मॉडल इसके विवरण को भी देखता है और जब कोई सामान्य डेटाबेस प्रश्न पूछता है तो इसे चुनता है। कौशल फिर एक कार्य के लिए योजना परिवर्तन का प्रस्ताव करता है जिसे केवल एक स्पष्टीकरण की आवश्यकता होती है।

आप जोड़ते हैं`user-invocable: false`एक अन्य रनटाइम में, उस क्षेत्र को अनदेखा किया जाता है। आप जोड़ते हैं`disable-model-invocation: true`इस तरह के एक कार्य को करने के लिए, उपयोगकर्ता को पूरी तरह से उपयोग करने की अनुमति है।

फ़ील्ड नामों में कुछ भी गलत नहीं है. मॉडल गलत है. "उपयोगकर्ता इसे देख सकता है", "मॉडल इसे चुन सकता है", "अनुप्रयोग इसे प्रीलोड कर सकता है", और "इसके अंदर उपकरण निष्पादित कर सकते हैं" अलग-अलग तथ्य हैं। एक एकल बुलियन कहा जाता है `invocable`उन्हें व्यक्त नहीं कर सकते।

रूटिंग में एक दूसरी विफलता मोड है। यदि विवरण अस्पष्ट हैं, तो कई कौशल विश्वसनीय हो जाते हैं। यदि विवरणों में कीवर्ड हैं, तो संबंधित कार्य उन्हें ट्रिगर करते हैं। कैटलॉग एक संभावनात्मक इंटरफ़ेस हैः फिट होने के लिए पर्याप्त कॉम्पैक्ट, रूटिंग के लिए पर्याप्त विशिष्ट।

## अवधारणा

### पांच चैनल जीवन चक्र शुरू कर सकते हैं

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

पोर्टेबल एजेंट कौशल विनिर्देश पैकेज को परिभाषित करता है। यह एक सार्वभौमिक स्लैश कमांड UI, अप्रत्यक्ष रूटिंग ध्वज, एप्लिकेशन एपीआई या सबगेन्ट जीवन चक्र को मानकीकृत नहीं करता है।

### पांच बुलाने के चरण

```figure
skill-invocation-stages
```

इन शब्दों का उपयोग सटीक रूप से करेंः

- **Eligible**नीति इस अभिनेता को कौशल का अनुरोध करने की अनुमति देता है।
- **Selected**इसका अर्थ है कि उपयोगकर्ता ने इसे नाम दिया है या राउटर ने इसे प्रासंगिक माना है।
- **Activated**इसका अर्थ है कार्य संदर्भ में उसके निर्देशों को प्रवेश करना।
- **Executing**इसका अर्थ है कि एजेंट ने उन निर्देशों के तहत मॉडल या उपकरण काम शुरू किया।
- **Completed**इसका अर्थ है कि आउटपुट ने स्वतंत्र सफलता जांच पूरी की है।

एक निशान है कि केवल रिकॉर्ड करता है`skill_used=true`जहां एक विफलता हुई है सीमा को छिपाता है।

### मानव और मॉडल का आह्वान 2x2 मैट्रिक्स का गठन करता है

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

मैट्रिक्स नीतिगत मॉडल है, मानक यैमएल नहीं।

एक वर्तमान होस्ट उपयोग करता है `disable-model-invocation: true`केवल मानव-पहचान के लिए और `user-invocable: false`केवल मॉडल के लिए पंक्ति. डिफ़ॉल्ट दोनों है. एक अन्य होस्ट का उपयोग करता है `agents/openai.yaml`के साथ`allow_implicit_invocation: false`यह रनटाइम एडाप्टर है। अज्ञात मेजबान उन्हें अनदेखा कर सकते हैं।

भ्रमित विवरण महत्वपूर्ण हैः`user-invocable: false`इसका मतलब यह नहीं है कि "मॉडल इसका उपयोग नहीं कर सकता है।" यह होस्ट में प्रत्यक्ष उपयोगकर्ता का आह्वान हटा देता है जो इसे परिभाषित करता है। `disable-model-invocation: true`इसका मतलब यह नहीं है कि "कौशल अक्षम है।" यह स्पष्ट उपयोगकर्ता पहुंच बनाए रखते हुए मॉडल द्वारा शुरू चयन को हटा देता है।

### स्पष्ट रूप से आह्वान पहचान-पहले है

स्पष्ट रूप से बुलाया जाने से पहचान सीधे मिलती हैः

```text
/release-readiness v2.4.0
```

या

```text
release-readiness check v2.4.0 without publishing
```

वर्तमान कोडेक्स इंटरफेस दस्तावेज़ `/skills`स्पष्ट रूप से कॉल करने के अनुरोधों में चयन और सरल कौशल नामों के लिए।`/skill-name`सटीक वाक्य रचना, मेनू दृश्यता, उद्धरण नियम, और चर विस्तार मेजबान के लिए हैं।

एक स्पष्ट अनुरोध अभी भी नीति पारित करता है। एक कौशल का नामकरण अनुपलब्ध अनुमतियों, कार्यक्षेत्र प्रतिबंधों, अनुमोदन गेटवे या रनटाइम अलगाव को बायपास नहीं करना चाहिए।

### अप्रत्यक्ष आह्वान पहले वर्णन है

अप्रत्यक्ष रूटिंग के लिए, मॉडल शुरू में पूर्ण शरीर के बजाय कैटलॉग मेटाडेटा देखता है। इसलिए विवरण कौशल का रूटिंग इंटरफ़ेस है।

कमजोर:

```yaml
description: Helps with releases.
```

अति व्यापक:

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

सीमित:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

सीमित संस्करण में निम्नलिखित शामिल हैंः

1. **Capability:**एक तैयार उम्मीदवार का निरीक्षण करें।
2. **Output:**तैयारता रिपोर्ट।
3. **Positive boundary:**पूछता है कि क्या एक रिलीज कलाकृतियों तैयार है।
4. **Negative boundary:**सामान्य निर्माण और विकास के दायरे से बाहर हैं।

नकारात्मक सीमाएं उपयोगी होती हैं जब दो पास के कौशल शब्दावली साझा करते हैं। वे लगभग-गुम मूल्यांकन के लिए प्रतिस्थापन नहीं हैं।

### रूटिंग एक एस्टेन विकल्प के साथ वर्गीकरण है

एक कौशल के लिए `s`और अनुरोध `x`, एक राउटर स्कोर कल्पना करेंः

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

सही स्कोरिंग अंकगणित के बजाय LLM निर्णय हो सकता है। इंजीनियरिंग सिद्धांत अभी भी बरकरार हैः चयन एक सीमा और प्रतिस्पर्धी कौशल से परे होना चाहिए। जब सबूत कमजोर है, तो खुद से बचें।

```figure
skill-routing-abstention
```

उच्च प्रभाव वाले कौशल के लिए, स्पष्ट रूप से रूटिंग एक मजबूत विवरण के साथ भी अनुचित हो सकती है। जब झूठी सकारात्मक की लागत स्वचालित चयन की सुविधा से अधिक हो तो केवल मानव नीति का उपयोग करें।

### पात्रता रैंकिंग से पहले होनी चाहिए

प्रत्येक कौशल को स्कोर न करें, सबसे मजबूत मैच चुनें, और उसके बाद उस कौशल की नीति की जांच करें। एक अवरुद्ध शीर्ष मैच गलत तरीके से एक पात्र कम स्कोर वाले उम्मीदवार को विचार करने से रोकता है।

अप्रत्यक्ष रूटिंग के लिए इस क्रम का उपयोग करेंः

1. फिल्टर ने अनुरोध करने वाले अभिनेता और सक्रिय होस्ट एडाप्टर द्वारा कौशल की खोज की।
2. केवल पात्र उम्मीदवारों को स्कोर करें।
3. यदि यह सीमा और अस्पष्टता नियमों को साफ करता है तो सबसे मजबूत पात्र मैच का चयन करें।
4. जब कोई उम्मीदवार पात्र नहीं हो या कोई पात्र स्कोर पर्याप्त मजबूत न हो तो संन्यास से बचना।

मान लीजिए `incident-triage`अंक`0.80`लेकिन इसका होस्ट विस्तार मॉडल का आह्वान अक्षम करता है। `incident-review`अंक`0.55`और मॉडल का आह्वान करने की अनुमति देता है. राउटर मूल्यांकन करना चाहिए`incident-review`यह सबसे अच्छा पात्र उम्मीदवार है।`incident-triage`, इससे इनकार करें, और बंद करो.

इस क्रमबद्धता से नीति परिवर्तनों को प्रासंगिकता स्कोर के अर्थ को बदलने से भी बचाया जाता है। पात्रता चयन सेट को परिभाषित करती है। प्रासंगिकता उस सेट को रैंक करती है।

### रूटिंग मूल्यांकन को लगभग चूक की आवश्यकता होती है

सकारात्मक मामलों में याद दिलाया जाता हैः

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

स्पष्ट नकारात्मक मूल सटीकता साबित करते हैंः

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

निकट चूक सीमा गुणवत्ता को उजागर करती हैः

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

लगभग मिस शेयर `package`और `build`केवल स्पष्ट सकारात्मक और संबंधित नकारात्मक से बना एक रूटिंग सेट गुणवत्ता को अधिक महत्व देगा।

### तर्क में तीन प्रतिनिधित्व होते हैं

एक आह्वान तर्क कई सीमाओं को पार करता हैः

```figure
skill-argument-boundaries
```

प्रत्येक सीमा पर, पाठ को कोड के रूप में व्यवहार किए बिना इरादे को बनाए रखें।

- मेजबान पार्सर कमांड सिंटैक्स और उद्धरण तय करता है।
- कौशल को मेजबान नियमों के अनुसार बाध्य पाठ या चर प्राप्त होते हैं।
- निर्देश आवश्यक मानों और डिफ़ॉल्ट मानों को मान्य करते हैं।
- एक टूल कॉल मानों को टाइप किए गए स्कीम में परिवर्तित करता है और उन्हें पुनः मान्य करता है।

कच्चे तर्क को शेल कमांड में इंटरपोलेट न करें। तर्क वेक्टर या टाइप किए गए MCP टूल के साथ बुलाए गए स्क्रिप्ट को प्राथमिकता दें।

### आवेदन का आह्वान स्पष्ट रूप से संगठित है

एक उत्पाद एक कौशल को सक्रिय कर सकता है क्योंकि उसके वर्कफ़्लो पहले से ही कार्य प्रकार को जानता है। उदाहरण के लिए, एक पुल-अनुरोध समीक्षा सेवा प्रीलोड कर सकती है `pull-request-risk-review`उपयोगकर्ता समीक्षा दबाए जाने के बाद।

यह रूटिंग अनिश्चितता को दूर करता है लेकिन रनटाइम एपीआई पर निर्भरता पैदा करता है। उस एडाप्टर को पोर्टेबल बॉडी के बाहर रखेंः

```figure
skill-host-adapter
```

एक अलग अनुपालनशील ग्राहक द्वारा खोले जाने पर कौशल को समझ में आना चाहिए।

### कौशल-से-कौशल का आह्वान एक उपकरण की तरह एक किनारा है

मान लीजिए `release-readiness`पूछता है`security-change-review`जब निर्भरता फ़ाइलें बदल गई।

कॉल करने वाले को निम्नलिखित जानकारी प्रदान करनी चाहिएः

- लक्ष्य कौशल पहचान;
- एक सीमित कार्य और कलाकृतियों के मार्ग;
- अपेक्षित प्रतिक्रिया अनुबंध;
- आह्वान का कारण;
- यदि उपलब्ध नहीं है तो एक वापसी;
- अधिकतम गहराई या चक्र नियम।

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

दूसरा कौशल अंधेरे ढंग से पहले में चिपकाया नहीं जाता है। मेजबान यह तय करता है कि इसे कैसे सक्रिय किया जाए और क्या यह संदर्भ साझा करता है, कांटा में चलता है, या एक उपकरण परिणाम के माध्यम से लौटता है।

### संदर्भ जीवन चक्र मेजबान के लिए विशिष्ट है

सक्रियण के बाद, कौशल शरीर बातचीत में रह सकता है, संपीड़न के दौरान संक्षेप में किया जा सकता है, या एक आवंटित संदर्भ में चलाया जा सकता है। उपकरण अनुदान एक बारी तक रह सकता है जबकि निर्देश लंबे समय तक जारी रह सकते हैं। एक उप-सहायक माता-पिता के पूरे इतिहास के बिना कौशल प्राप्त कर सकता है।

एक कौशल न लिखें जो एक अदृश्य जीवनकाल पर निर्भर करता है। फ़ाइलों या टाइप की गई स्थिति में टिकाऊ आउटपुट डालें, फिर से प्रवेश सुरक्षित करें, और बताएं कि interruption के बाद क्या पुनः लोड किया जाना चाहिए।

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## इसे बनाओ

`code/main.py`नीति और रूटिंग को अलग-अलग एडाप्टर के रूप में लागू करता है।

इस मॉडल में निम्नलिखित शामिल हैंः

- `Actor`मानव, मॉडल, स्वायत्त एजेंट, आवेदन, कौशल और हर्न कॉलर्स के लिए;
- `SkillMetadata`रूटिंग पहचान के लिए;
- `InvocationPolicy`मानव/मॉडल मैट्रिक्स के लिए;
- `InvocationRequest`और `InvocationDecision`ट्रैक करने योग्य इनपुट और परिणामों के लिए;
- `CorePolicyAdapter`कोई होस्ट एक्सटेंशन के बिना पोर्टेबल व्यवहार के लिए;
- `ExtensionPolicyAdapter`मान्यता प्राप्त रनटाइम फ़ील्ड के लिए;
- `build_invocation_matrix(policy)`2x2 दृश्य के लिए;
- `route_request(skills, request, adapter)`प्रासंगिकता रैंकिंग, चयन और अस्वीकरण से पहले पात्रता फ़िल्टरिंग के लिए।

इसे चलाओः

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

डेमो स्पष्ट मानव, अप्रत्यक्ष मॉडल, स्वायत्त एजेंट, अनुप्रयोग, कौशल-संयोजन और उपयोग चैनलों के लिए एक मैट्रिक्स और निर्णय प्रिंट करता है। इसके एक्सटेंशन-एडॉप्टर परिणामों से पता चलता है कि एक पात्र विकल्प की श्रेणी में आने से पहले एक अवरुद्ध शीर्ष शब्दावली मैच को हटा दिया जा रहा है। इसमें सटीक नामों के लिए भी सूचीबद्ध हैं। कोई मॉडल एपीआई आवश्यक नहीं है। निर्धारात्मक राउटर नीतिगत सीमाओं को निरीक्षण करने के लिए मौजूद है, यह दावा नहीं करने के लिए कि शब्दकोश मिलान उत्पादन मॉडल राउटिंग को पुनः प्रस्तुत करता है।

### कोर और एक्सटेंशन एडाप्टर अलग क्यों हैं

यदि एक पार्सर प्रत्येक अवलोकन किए गए फ्रंटमैटर फ़ील्ड को अर्थ सौंपता है, तो यह चुपचाप रनटाइम कन्वेंशन को एक नकली मानक में बढ़ावा देता है। अलग-अलग एडाप्टर कॉल करने वाले को यह नाम देने के लिए मजबूर करते हैं कि कौन से होस्ट अर्थशास्त्र सक्रिय हैं।

`CorePolicyAdapter`केवल आवेदन द्वारा प्रदान की गई नीति का उपयोग करता है।`ExtensionPolicyAdapter`मेजबान फ़ील्ड और रिकॉर्ड का एक स्पष्ट सेट पहचानता है जिसमें फ़ील्ड ने निर्णय बदल दिया है।

## इसका प्रयोग करें

किसी कौशल को प्रकाशित करने से पहले एक अनुबंध लिखेंः

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

यह अनुबंध एडाप्टर और परीक्षणों के लिए डिजाइन प्रलेखन है। यह पोर्टेबल नहीं है `SKILL.md`जब तक कि एक मानक स्पष्ट रूप से इसे अपनाता नहीं है।

## इसे भेजें

यह सबक `skill-invocation-router`बंडल. इसमें एक कॉल-मॉडल संदर्भ, एक उदाहरण होस्ट नीति, और एक गैर-कार्यकारी सीएलआई शामिल है जो एक मानव, मॉडल, स्वायत्त एजेंट, एप्लिकेशन, कौशल-संयोजन, या हर्न अनुरोध का मूल्यांकन करता है और चैनल, एडाप्टर, स्कोर और कारण के साथ एक जेएसओएन निर्णय लौटाता है।

एक अनुरोध CLI एक नीति जांच है, एक पूर्ण ट्रिगर मूल्यांकन नहीं। भ्रम गणना, सटीकता, याद और दोहराए गए रन की स्थिरता की गणना करने के लिए पाठ 27 में लेबल किए गए सकारात्मक और लगभग चूक डिजाइन का उपयोग करें।

## व्यायाम

1. मानव/मॉडल मैट्रिक्स की सभी चार पंक्तियों को बनाएं और प्रत्येक के लिए एक वैध उपयोग मामला लिखें।
2.  में केवल आवेदन सक्रियण जोड़ें`CorePolicyAdapter`. साबित करें कि मानव और मॉडल कॉल करने वालों को अस्वीकार कर दिया गया है.
3. एक तैनाती कौशल के लिए दस पास-मिस लिखें। प्रत्येक प्रॉम्प्ट को एक अलग वर्कफ़्लो से संबंधित होने के दौरान कौशल के साथ शब्दावली साझा करनी चाहिए।
4. शीर्ष दो रूटिंग स्कोर के बीच अस्पष्टता मार्जिन जोड़ें।`ask`जब मार्जिन बहुत छोटा हो।
5. कौशल-से-कला अनुरोधों में अधिकतम संरचना गहराई जोड़ें और दो-कला चक्र का पता लगाएं।
6. कोर और एक्सटेंशन एडैप्टर के माध्यम से एक ही लेबल सेट चलाएं। हर बदला निर्णय समझाएं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## आगे पढ़ना

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)सकारात्मक ट्रिगर, विशिष्टता और मूल्यांकन के लिए।
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)ट्रिगर और आउटपुट eval डिजाइन के लिए।
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)वर्तमान कोडेक्स स्पष्ट और अप्रत्यक्ष आह्वान नियंत्रण के लिए।
- [Claude Code skills](https://code.claude.com/docs/en/skills)एक मेजबान के लिए `user-invocable`,`disable-model-invocation`, तर्क, और प्रदाय संदर्भ।
