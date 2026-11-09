# कैपस्टोन 09  कोड माइग्रेशन एजेंट (रिपो-लेवल लैंग्वेज / रनटाइम अपग्रेड)

> अमेज़ॅन के माइग्रेशनबेंच (जावा 8 से 17) और गूगल के ऐप इंजन Py2-to-Py3 माइग्रेटर ने 2026 बार सेट किया। मॉडर्न के ओपन रीराइट पैमाने पर निर्धारक एएसटी रीराइट करता है। ग्रिट को कोडमोड-शैली डीएसएल के साथ एक ही समस्या का लक्ष्य है। उत्पादन पैटर्न दोनों को जोड़ता हैः सुरक्षित रीस्क्रिप्ट के लिए एक निर्धारक सब्सट्रेट प्लस अस्पष्ट मामलों के लिए एक एजेंट परत, प्रति शाखा निर्माण के लिए एक रेत बॉक्स, और एक परीक्षण हर्नर जो पीआर खोलने से पहले हरा हो जाता है। मुख्य लक्ष्य 50 वास्तविक रिपो को स्थानांतरित करना है और विफलता वर्गीकरण के साथ पास दर प्रकाशित करना है।

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## समस्या

बड़े पैमाने पर कोड माइग्रेशन 2026 कोडिंग एजेंटों के सबसे स्वच्छ उत्पादन अनुप्रयोगों में से एक है। मूल सत्य स्पष्ट है (क्या परीक्षण सूट प्रवास के बाद पारित होती है?), पुरस्कार वास्तविक हैं (जावा-8 बेड़े के प्रवास एक कर्मचारी पैमाने पर परियोजना है), और बेंचमार्क सार्वजनिक हैं (मigrationBench 50-repo उपसमूह) । मॉडर्न का ओपन रीराइट निर्धारक पक्ष को संभालता है। एजेंट परत सब कुछ संभाले OpenRewrite नुस्खे नहीं कर सकते हैं: अस्पष्ट rewrites, बिल्ड-सिस्टम बहाव, लंबी पूंछ वाक्यविन्यास, पारगमन निर्भरता टूटना।

आप एक एजेंट का निर्माण करेंगे जो जावा 8 रेपो (या पायथन 2 रेपो) लेता है और एक ग्रीन-सीआई माइग्रेटेड शाखा का उत्पादन करता है। आप पास दर, परीक्षण कवरेज संरक्षण, प्रति रेपो लागत, और एक विफलता टैक्सोनामी का निर्माण करेंगे। एक निर्धारक-केवल बेसलाइन के खिलाफ साइड-बाय आपको बताता है कि एजेंट का मूल्य वास्तव में कहां रहता है।

## अवधारणा

पाइपलाइन में दो परतें हैं।**deterministic substrate**(जावा के लिए ओपनरवाइट, पायथन के लिए लिबस्ट) मैकेनिकल रीवाइट्स का बड़ा हिस्सा सुरक्षित रूप से चलाता हैः आयात, विधि हस्ताक्षर, शून्य सुरक्षा संपादन, संसाधनों के साथ प्रयास, अप्रचलित एपीआई प्रतिस्थापन। यह तेज़ है और ऑडिट योग्य अंतर उत्पन्न करता है।**agent layer**(OpenAI एजेंट्स SDK या LangGraph over Claude Opus 4.7 और GPT-5.4-Codex) मामलों को संभालता है जो व्यंजनों नहीं कर सकते हैंः बिल्ड-फाइल अपग्रेड (मैवेन/ग्रेडल/पीप्रोजेक्ट), पारगमन निर्भरता संघर्ष, परीक्षण फ्लेक्स, कस्टम टिप्पणी।

प्रत्येक रेपो को डेटाना सैंडबॉक्स मिलता है जिसमें लक्ष्य रनटाइम पूर्वस्थापित होता है। एजेंट पुनरावृत्ति करता हैः रन बिल्ड, वर्गीकृत विफलताओं, लागू फिक्स, फिर से चलाएं। हार्ड सीमाएंः 30 मिनट प्रति रेपो, $ 8 प्रति रेपो, 20 एजेंट टर्न। यदि सभी परीक्षण पास होते हैं और कवरेज 2 प्रतिशत अंक से अधिक नहीं गिरता है, तो शाखा एक पीआर खोलती है। यदि नहीं, तो रेपो को विफलता वर्ग के तहत सबूत के साथ दायर किया जाता है।

50 रेपो के बीच, क्या टूट गया? पारगमन डिप्स? कस्टम एनोटेशन? निर्माण उपकरण संस्करण? परीक्षण फ्लेक्स जो प्रवास से संबंधित नहीं हैं? प्रत्येक वर्ग को एक गिनती और एक नमूना अंतर मिलता है। भविष्य की नुस्खा लेखकों को शीर्ष तीन का लक्ष्य रखा जा सकता है।

## वास्तुकला

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## स्टैक

- निर्धारक सब्सट्रेटः ओपनरीवाइट (जावा) या लिबक्सस्ट (पाइटन)
- एजेंटः ओपनएआई एजेंट्स एसडीके या लैंगग्राफ क्लाउड ओपस 4.7 + जीपीटी-5.4-कोडेक्स पर
- सैंडबॉक्सः डेटोन डेव कंटेनर प्रति शाखा, पूर्व-स्थापित लक्ष्य रनटाइम (जावा 17 / पायथन 3.12)
- निर्माण प्रणालीः मावेन, ग्रेडले, यूवी (पाइटन)
- बेंचमार्कः अमेज़न माइग्रेशनबेंच 50-रिपो उपसमूह (जावा 8 से 17), Google ऐप इंजन Py2-to-Py3 repos
- परीक्षण हर्नसः समानांतर धावक, जैकोको (जावा) या कवर.पी.पी. (पाइटन) के माध्यम से कवरेज
- अवलोकनशीलताः प्रत्येक भिन्न भाग के साथ प्रति रेपो में लैंगफ्यूज + ट्रैक बंडल
- डैशबोर्डः प्रति वर्ग गणना और उदाहरण अंतर के साथ विफलता-टैक्सनोमी डैशबोर्ड

```figure
ce-migration-funnel
```

## इसे बनाओ

1. **Recipe pass.**पहले OpenRewrite (जावा) या libcst (पाइटन) व्यंजनों को चलाएं। यांत्रिक प्रवासनों के 70-80% को पकड़ें। "विन्यास" के रूप में प्रतिबद्ध करें।

2. **Build trial.**डेटोन सैंडबॉक्सः लक्ष्य रनटाइम स्थापित करें, निर्माण चलाएं. अगर हरा है, तो परीक्षण पर कूदें. अगर लाल है, तो एजेंट को सौंप दें.

3. **Agent loop.**उपकरण के साथ लैंगग्राफः `run_build`,`read_file`,`edit_file`,`run_test`,`git_diff`. एजेंट विफलता (गहन, वाक्य रचना, परीक्षण, निर्माण उपकरण) को वर्गीकृत करता है और एक लक्षित सुधार लागू करता है।

4. **Budget caps.**30 मिनट प्रति रेपो दीवार घड़ी, $ 8 लागत, 20 एजेंट बारी. किसी भी उल्लंघन रोकता है और वर्तमान अंतर के साथ "बजट_exhausted" के तहत फ़ाइलें.

5. **Test + coverage gate.**बिल्ड ग्रीन होने के बाद, परीक्षण सूट चलाएं। आधार रेपो के साथ कवरेज की तुलना करें। यदि कवरेज 2 प्रतिशत अंक से अधिक गिर गया है, तो "कवरेज_रेग्रेसशन" के तहत फ़ाइल करें।

6. **PR open.**सफलता के बाद, शाखा को धक्का दें, अंतर और सारांश के साथ PR खोलें कि किस नुस्खा का उपयोग किया गया है और किस एजेंट ने लेखक को प्रतिबद्ध किया है।

7. **Failure taxonomy.**प्रत्येक असफल रेपो के लिए, एक वर्ग के साथ टैग करेंः `dep_upgrade_required`,`build_tool_drift`,`custom_annotation`,`test_flake`,`syntax_edge_case`,`budget_exhausted`एक डैशबोर्ड बनाएं।

8. **50-repo run.**MigrationBench उपसमूह में निष्पादित करें। प्रति वर्ग उत्तीर्ण दर, प्रति प्रतिवेदन लागत, कवरेज-संरक्षण, और केवल तुलना-विनाशात्मक आधार रेखा की रिपोर्ट करें।

## इसका प्रयोग करें

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## इसे भेजें

`outputs/skill-migration-agent.md`एक रेपो दिया जाता है, यह एक हरे माइग्रेटेड शाखा उत्पन्न करने के लिए निर्धारक व्यंजनों को निष्पादित करता है, फिर एक एजेंट लूप, या एक टैक्सोनोमी वर्ग के तहत रेपो फाइल करता है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## व्यायाम

1. केवल OpenRewrite के साथ माइग्रेट पाइपलाइन चलाएं (कोई एजेंट नहीं) । पूरे पाइपलाइन के पास दर की तुलना करें। ऐसे मामलों की पहचान करें जहां केवल एजेंट अंतर है।

2. "लिंट-क्लीन" जांच करेंः माइग्रेशन के बाद, एक शैली लिंटर चलाएं (जावा के लिए निर्दोष, पायथन के लिए ruff) । यदि नई लिंटर त्रुटियां दिखाई देती हैं तो पीआर विफल करें। कवरेज-रक्षित-लेकिन-शैली-रिग्रेड दर को मापें।

3. "कम से कम अंतर" अनुकूलक जोड़ेंः एजेंट की शाखा परीक्षणों को पास करने के बाद, दूसरे पास के साथ अनावश्यक परिवर्तनों को काट दें। अंतर आकार में कमी की रिपोर्ट करें।

4. तीसरे माइग्रेशन तक विस्तारः नोड 18 से नोड 22. सैंडबॉक्स पैकिंग का पुनः उपयोग करें; कस्टम कोडमॉड के लिए नुस्खा परत को स्वैप करें।

5. यूएक्स मेट्रिक के रूप में समय-से-पहले-ग्रीन-बिल्ड (टीटीएफजीबी) मापें। लक्ष्यः 10 मिनट से कम पी 50।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## आगे पढ़ना

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) 2026 के लिए कैनोनिक बेंचमार्क
- [Moderne.io OpenRewrite platform](https://www.moderne.io) निर्धारक सब्सट्रेट संदर्भ
- [OpenRewrite documentation](https://docs.openrewrite.org) नुस्खा लेख
- [Grit.io](https://www.grit.io) वैकल्पिक कोडमॉड डीएसएल
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) एजेंट एसडीके संदर्भ
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) वैकल्पिक प्रवास बेंचमार्क
- [libcst](https://github.com/Instagram/LibCST) पायथन निर्धारक सब्सट्रेट
- [Daytona sandboxes](https://daytona.io) प्रति शाखा रेफरेन्स सैंडबॉक्स
