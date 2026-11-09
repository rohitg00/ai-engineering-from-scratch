# कैपस्टोन 05  स्वायत्त अनुसंधान एजेंट (एआई-वैज्ञानिक वर्ग)

> साकाना के एआई-साइंटिस्ट-वी 2 ने पूर्ण पेपर प्रकाशित किए। एजेंट प्रयोगशाला प्रयोगों चलाया. एलेन एआई ने निशान साझा किए। 2026 आकार प्रयोगों पर योजना-कार्य-सत्यापन पेड़ खोज, बजट लागत, सैंडबॉक्स कोड निष्पादन, एक दृष्टि-वापसी LaTeX लेखक, और एक स्वचालित NeurIPS शैली समीक्षक समूह है। मुख्य लक्ष्य एक बनाना है, इसे प्रति पेपर $30 के भीतर अंत से अंत तक चलाएं, और सैंडबॉक्स-एस्केप रेड टीम को जीवित रखें जिसे साकान ने दस्तावेज किया है।

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## समस्या

स्वायत्त अनुसंधान एजेंटों ने 2026 में एक सीमा पार कर ली। साकाना एआई का एआई-साइंटिस्ट-वी 2 प्रकृति में प्रकाशित किया गया था जिसमें पेपर उत्पन्न किए गए थे जो कार्यशाला समकक्ष समीक्षा को मंजूरी देते थे। शिंकाईवोल्व (ICLR 2026) ने विकासशील परिकल्पनाओं के लिए रेखा का विस्तार किया। एएमडी के एजेंट प्रयोगशाला पुनः प्रयोज्य निशान भेज दिया। एजेंट जादू नहीं हैं  वे एक योजना-कार्यकारी-सत्यापन लूप हैं जो उम्मीदवार प्रयोगों के पेड़ पर चलता है, लागत कैप, बीज-बाउंड रेत बॉक्स और स्वचालित समीक्षा के साथ। जहाज लूप में है, बजट, और सुरक्षा कहानी.

आप एक संकीर्ण क्षेत्र में बीज विचार के खिलाफ एक को लागू करके लूप सीखते हैं (उदाहरण के लिए, 100M पैरामीटर ट्रांसफार्मर पर ध्यान-छलता अपवर्तन) । मूल्य पहली बार कुछ नया खोजने में नहीं है। मूल्य बुनियादी ढांचे में हैः पेड़ खोज, प्रयोग सैंडबॉक्स, लेखक-समीक्षक लूप, रेड टीम रिपोर्ट। साकन टीम ने सैंडबॉक्स भागने में विफलता का दस्तावेज किया है; आपके एजेंट को उसी लाल टीम को पास करना होगा।

## अवधारणा

एजेंट सबसे अच्छा पेड़ खोज पहले है. नोड्स प्रयोग विनिर्देश हैंः (अनुमान, कॉन्फिग, कोड, अपेक्षित परिणाम) । विस्तार चरण बच्चों को छोटे संपादन (स्वैप अनुकूलक, बैच आकार बदलना, एक घटक को काटना) के साथ प्रस्तावित करता है। प्रत्येक बच्चा एक ताजा रेत बॉक्स में एक हार्ड संसाधन कैप के साथ दौड़ता है। परिणाम एक स्कोरिंग फ़ंक्शन में वापस आते हैं जो नोड्स को (नवीनता × गुणवत्ता × शेष बजट) के अनुसार रैंक करता है। जब तक बजट समाप्त नहीं होता तब तक पेड़ बढ़ता है, तब सबसे अच्छी शाखा लिखी जाती है।

लेखक बहुमुखी है। यह एक LaTeX ड्राफ्ट उत्पन्न करता है, इसे संकलित करता है, आंकड़े प्रस्तुत करता है, और लेआउट, आंकड़े पठनीयता और दावा-सबूत संरेखण पर आलोचना के लिए क्लाउड ओपस 4.7 के दृश्य मोड में प्रस्तुत पीडीएफ को वापस खिलाता है। पांच एलएलएम न्यायाधीशों के एक समीक्षक समूह ने न्यूरआईपीएस शैली के स्कोर (नवीनता, कठोरता, स्पष्टता, पुनरुत्पादित करने योग्यता, प्रभाव) जारी किए; यदि औसत सीमा से नीचे गिरता है, तो पेपर आलोचना के साथ लेखक को लौटता है।

सुरक्षा भार सहनशील है। प्रत्येक प्रयोग नेटवर्क निकास, सीमाबद्ध वॉल-घड़ी और पिन संसाधन सीमाओं के बिना E2B या डेटोनवा सैंडबॉक्स में चलता है। एजेंट का कोड-जनरेशन चरण एक नीति परत से गुजरता है जो सैंडबॉक्स से बचने वाले सिस्टम्स कॉल को ब्लॉक करता है। रेड-टीम रिपोर्ट साकाना-प्रलेखित हमले की सतह (फॉर्क बम, फाइल सिस्टम भागता है, एलएलएम-लिखित नेटवर्क कॉल) को पुनः प्रस्तुत करती है।

## वास्तुकला

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## स्टैक

- ऑर्केस्ट्रेशनः लॉन्गग्राफ चेकपोइंटिंग और मानव अनुमोदन गेट के साथ
- पेड़ खोजः कस्टम सर्वश्रेष्ठ-पहले प्रयोग नोड्स (सकान v2 से एबी-एमसीटीएस शैली)
- सैंडबॉक्सः E2B प्रति प्रयोग, Docker-in-Docker fallback; संसाधनों की सीमाओं के माध्यम से cgroups
- साहित्यः अर्थशास्त्र विद्वान ग्राफ एपीआई + ओपनएलेक्स + स्थानीय एफएआईएसएस कैश सार
- लेखक: चित्र आलोचना और लेआउट के लिए LaTeX टेम्पलेट + क्लाउड ओपस 4.7 (दृश्य मोड)
- समीक्षक: 5 न्यायाधीशों (ओपस 4.7, जीपीटी-5.4, मिथुन 3 प्रो, डीपसेक आर1, क्यूवेन 3-मैक्स) का समूह
- प्रयोग ढांचाः भौतिक प्रयोगों के लिए PyTorch 2.5, लकड़ी के लिए W&B
- अवलोकनशीलता: एजेंट के निशान के लिए लैंगफ्यूज, $30 प्रति पेपर कठिन बजट

```figure
ce-experiment-tree
```

## इसे बनाओ

1. **Seed and domain scoping.**एक बीज विचार लें (जैसे, "सब्-1बी ट्रांसफार्मर के ध्यान मानचित्रों में स्परसिटी पैटर्न की जांच करें") खोज स्थान को परिभाषित करेंः मॉडल, डेटासेट, गणना बजट।

2. **Literature pass.**50 सबसे ज्यादा उद्धृत प्रासंगिक पत्रों के लिए सेमेटिक स्कॉलर + ओपनएलेक्स का क्वेरी करें; स्थानीय रूप से कैश सार; 1 पृष्ठ डोमेन डाइजेस्ट उत्पन्न करें।

3. **Tree scaffolding.**बीज परिकल्पना के साथ जड़ को प्रारंभ करें।`expand(node) -> children`छोटे संपादन प्रस्तावों के साथ (प्रति बच्चे एक कॉन्फ़िग परिवर्तन) ।`score(node)`एक भारित नवीनता × गुणवत्ता × बजट अवधि के रूप में।

4. **Sandbox wrapping.**हर प्रयोग चलता है`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`बीज रेत बॉक्स में लिखा जाता है; आउटपुट केवल पढ़ने के लिए वापस बाहर रखा जाता है।

5. **Plan-execute-verify loop.** `plan`बच्चों का प्रस्ताव देता है।`execute`रेत बॉक्स चलाता है, लॉग और माप कैप्चर करता है। `verify`मेट्रिक्स पर इकाई जांच करता है (क्या नुकसान कम हुआ? क्या निष्कर्षण प्रभाव को अलग कर दिया? असफल नोड्स पेड़ पर विफलता का कारण संग्रहीत करते हैं।

6. **Writer.**बजट के बाद, सबसे अच्छी शाखा का चयन करें। matplotlib के साथ आंकड़े प्रस्तुत करें। संदर्भ में शाखा ट्रैक के साथ क्लाउड ओपस 4.7 के माध्यम से एक लाटेक्स मसौदा उत्पन्न करें। संकलन करें। संकलन किए गए पीडीएफ को आलोचना के लिए ओपस 4.7 विजन में वापस खिलाएं। पुनरावृत्ति करें।

7. **Reviewer ensemble.**पांच न्यायाधीशों ने न्यूरआईपीएस शैली के rubrics के साथ ड्राफ्ट (नवीनता, कठोरता, स्पष्टता, पुनरुत्पादन, प्रभाव) पर स्कोर किया। यदि औसत <4.0/5, तो आलोचना के साथ लेखक को लौटें। 3 पुनः लेखन के बाद हार्ड स्टॉप।

8. **Red team.**रेत बॉक्स को लक्षित करने वाले प्रतिकूल कार्यों का एक सेट बनाएं या एकीकृत करेंः फोर्क बम, नेटवर्क निष्फिल्ट्रेशन प्रयास, फ़ाइल सिस्टम भागने, एलएलएम-लिखित शेल मेटाक्यारेक्टर। सभी को अवरुद्ध की पुष्टि करें। निष्कर्षों को लिखें।

9. **Reproducibility.**प्रत्येक पेपर अपने पेड़-खोज के साथ जहाज JSON, बीज, W & B रन लिंक, सैंडबॉक्स कॉन्फ़िग और एक README अंत से अंत तक इसे पुनः पेश करता है।

## इसका प्रयोग करें

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## इसे भेजें

`outputs/skill-ai-scientist.md`एक बीज विचार + एक डोमेन + $ 30 का बजट दिया गया है, यह पूरी पाइपलाइन चलाता है और एक समीक्षा योग्य पेपर जारी करता है प्लस एक पुनरावृत्ति बंडल।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## व्यायाम

1. एक ही डोमेन में तीन अलग-अलग बीज विचारों के खिलाफ पाइपलाइन चलाएं। पेड़-खोज के किन हिस्सों की तुलना करें। दोहराया गया व्यर्थ गणना की पहचान करें।

2. $ 5 से अधिक मूल्य के नोड्स के लिए प्रयोग निष्पादन से पहले मानव-इन-द-लुप गेट जोड़ें। मापें कि कुल लागत कितनी गिरती है।

3. एक ही न्यायाधीश के लिए समीक्षक समूह को बदलें, ज्ञात-खराब कागजातों के एक लंबे सेट पर झूठे स्वीकृति दर को मापें।

4. नेटवर्क-exfiltration लाल टीम परीक्षण शुरू करेंः एजेंट कोड लिखता है कि करने की कोशिश करता है `curl`बाहरी पते की पुष्टि करें।`--network=none`नीति इसे अवरुद्ध करता है. प्रयास को लॉग.

5. अपने पेड़-खोज की तुलना एक फ्लैट यादृच्छिक आधार रेखा (एक ही बजट, कोई विस्तार रणनीति) के साथ करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## आगे पढ़ना

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) संदर्भ उत्पादन अनुसंधान एजेंट
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) मूल पद्धति
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) विकासवादी विस्तार
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) बहु-भूमिका अनुसंधान प्रयोगशाला ढांचा
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) संदर्भ ऑर्केस्ट्रेशन परत
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) साहित्य खोज
- [E2B sandboxes](https://e2b.dev) संदर्भ प्रयोग अलगाव
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) समीक्षक समूह द्वारा कोडित rubric
