# कैपस्टोन 17  व्यक्तिगत एआई ट्यूटर (अनुकूली, बहुआयामी, मेमोरी के साथ)

> खानमीगो (खान अकादमी), डुओलिंगो मैक्स, शिक्षा के लिए गूगल लर्नएलएम / मिथुन, क्विज़लेट क्यू-चैट और सिंथेसिस ट्यूटोर सभी ने 2026 में पैमाने पर अनुकूलनशील मल्टीमोडल ट्यूटोरियल शिप किया। सामान्य रूप एक सॉक्रेटिक नीति है (कभी भी बस उत्तर को छोड़ दें), एक छात्र मॉडल जो प्रत्येक बातचीत के बाद अपडेट होता है (बेयिसियन ज्ञान ट्रैकिंग शैली), आवाज + पाठ + फोटो-गणित इनपुट, पाठ्यक्रम ग्राफ पुनर्प्राप्त करना, अंतराल-पुनरावृत्ति अनुसूची, और उम्र के अनुरूप सामग्री के लिए हार्ड सुरक्षा फ़िल्टर। मुख्य लक्ष्य विषय-विशिष्ट ट्यूटर (के-12 बीजगणित या परिचय पायथन) भेजना है, 10 शिक्षार्थियों के साथ दो सप्ताह का प्रभावकारिता अध्ययन चलाएं, और सामग्री सुरक्षा ऑडिट पास करें।

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## समस्या

अनुकूलन ट्यूशन एक समय में एडी-टेक अनुसंधान आला था। 2026 तक यह एक उपभोक्ता उत्पाद बन जाएगा। खानमीगो को अधिकांश अमेरिकी स्कूलों में तैनात किया गया है। डुओलिंगो मैक्स ने दसियों मिलियन एमएयू को मारा। गूगल के LearnLM/Gemini for Education में Google Classroom में ट्यूशन की क्षमता है। क्विज़लेट क्यू-चैट फ्लैशकार्ड के साथ बैठता है। संश्लेषण ट्यूटर के साथ वायरलता हिट ट्यूटर-फॉर-चीखी-बच्चों. सामान्य तत्वः बहुआयामी इनपुट (प्रकार, बोलना, फोटोग्राफिक समीकरण), सोक्रेटिक शिक्षण (पहले पूछें, बाद में समझाएं), एक छात्र मॉडल जो प्रत्येक बातचीत के बाद अद्यतन होता है, और सख्त आयु-अनुकूल सुरक्षा।

आप एक विशिष्ट समूह के लिए इनमें से एक का निर्माण करेंगे। माप पट्टी एक वास्तविक प्रभावशीलता अध्ययन हैः 10 शिक्षार्थियों के साथ दो सप्ताह के दौरान प्री-टेस्ट और पोस्ट-टेस्ट स्कोर। आवाज लूप को प्राकृतिक महसूस करना चाहिए (कैपस्टोन 03 उप-स्टैक) । स्मृति को गोपनीयता का सम्मान करना चाहिए। सुरक्षा फ़िल्टर को COPPA-सचेत लाल-टीम के लिए पारित करना चाहिए।

## अवधारणा

चार घटक।**Tutor policy**यह एक सॉक्रेटिक लूप हैः जब छात्र उत्तर के लिए पूछता है, तो नीति एक प्रमुख प्रश्न पूछती है; जब वे इसे सही करते हैं, तो यह अगले अवधारणा पर जाता है; जब वे फंस जाते हैं, तो यह एक मंचित संकेत प्रदान करता है। **Learner model**यह बेईज़ियन ज्ञान ट्रैकिंग (या एक सरल संस्करण) है जो प्रत्येक बातचीत के बाद पाठ्यक्रम नोड के अनुसार मास्टरिंग संभावना को अपडेट करता है। **Curriculum graph**एक नीओ 4j अवधारणाओं के साथ पूर्व शर्त किनारों; नीति अगले अवधारणा का चयन करने के लिए ग्राफ पर चलता है। **Memory**एक एपिसोडिक + अर्थिक स्टोर (एजेंटमेमोरी-स्टाइल) है जो अतीत के इंटरैक्शन, गलतियों और वरीयताओं को रखता है।

यूएक्स मल्टीमोडल है। टाइप किए गए उत्तरों के लिए टेक्स्ट इनपुट। लाइवकिट + व्हिस्पर (पुनः उपयोग कपास्टोन 03) के माध्यम से आवाज इनपुट। डॉट्स.ओसीआर या पालीगेम्मा 2 के माध्यम से गणित समस्याओं के लिए फोटो इनपुट। कार्टेशिया सोनिक 2 के माध्यम से आवाज आउटपुट। सुरक्षा एलएमए गार्ड 4 के साथ-साथ उम्र के अनुसार फ़िल्टर (वयस्क सामग्री को ब्लॉक करता है, हिंसा, आत्म-हानि) और एक COPPA-सचेत स्मृति प्रतिधारण नीति का उपयोग करता है।

प्रभावशीलता अध्ययन परिणाम है। 10 शिक्षार्थी, प्री-टेस्ट और पोस्ट-टेस्ट, दो सप्ताह। रिपोर्ट सीखने की वृद्धि डेल्टा और आत्मविश्वास अंतराल। एक गैर-अनुकूली आधार रेखा (एक ही सामग्री ट्यूटर नीति के बिना रैखिक रूप से वितरित) के साथ तुलना करें।

## वास्तुकला

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## स्टैक

- विषय का चयनः K-12 बीजगणित या परिचय पायथन (गहनता के लिए एक चुनें)
- ट्यूटर नीति: लैंगग्राफ क्लाउड सोनेट 4.7 पर (जल्दी कैशिंग के साथ)
- लर्नर मॉडलः बेयसियन ज्ञान ट्रैकिंग (क्लासिक) या स्पेसिंग के लिए एफएसआरएस
- पाठ्यक्रम ग्राफः अवधारणाओं का नया 4j + पूर्व शर्त किनारे + आरईओ सामग्री
- स्मृतिः एजेंटस्मृति शैली के निरंतर वेक्टर + एपिसोडिक + अर्थिक भंडारण
- आवाजः लाइवकिट एजेंट 1.0 + कार्टेशिया सोनिक-2 (पुनः उपयोग कपिस्टोन 03 उप-स्टैक)
- फोटो गणितः dots.ocr या समीकरण पहचान के लिए PaliGemma 2
- सुरक्षाः लामा गार्ड 4 + आयु के अनुकूल फ़िल्टर
- Eval: ब्लूम लेवल प्रश्न पीढ़ी, प्री/पोस्ट टेस्ट हर्न, प्रभावकारिता अध्ययन उपकरण

```figure
cf-tutor-loop
```

## इसे बनाओ

1. **Curriculum graph.**पूर्वावश्यक किनारों के साथ 50-150 अवधारणा नोड्स (जैसे, "संख्या रेखा" से "क्वाड्रैटिक सूत्र" तक के -12 बीजगणित) का एक Neo4j बनाएं। प्रत्येक नोड (ओपन पाठ्यपुस्तक, ओपनस्टैक्स) के लिए OER सामग्री संलग्न करें।

2. **Learner model.**पूर्ववर्ती के साथ बेयिसियन ज्ञान को ट्रैक करना शुरू करेंः अनुमान, स्लिप, सीखने की दर। प्रत्येक बातचीत के बाद प्रति अवधारणा प्रभुत्व को अपडेट करें। प्रति छात्र पर कायम रहें।

3. **Tutor policy.**नोड्स के साथ लैंगग्राफ: `read_signal`(क्या छात्र का उत्तर सही था / आंशिक था / फंस गया था?`select_concept`(शिक्षा पाठ्यक्रम ग्राफ सबसे अधिक प्राथमिकता वाली अवधारणा चुनकर) ।`scaffold`(सोक्रेटिक संकेत), `update_mastery`. .

4. **Memory.**प्रत्येक बातचीत एक एपिसोडिक स्टोर में लिखती है। त्रुटियां और वरीयताएँ अर्थिक स्मृति को बढ़ावा देती हैं। COPPA-सचेत प्रतिधारण नीतिः 1 वर्ष के बाद स्वचालित रूप से हटाएं, माता-पिता के लिए सुलभ।

5. **Voice path.**लाइवकिट एजेंट्स कार्यकर्ता ट्यूटर नीति से जुड़ा हुआ है। विस्पर-v3-टर्बो के माध्यम से एएसआर। कार्टेशिया सोनिक-2 के माध्यम से टीटीएस। बारज-इन समर्थित (पुनः उपयोग कैपस्टोन 03 यांत्रिकी) ।

6. **Photo-math path.**छवि अपलोड या कैप्चर करें; समीकरण को पहचानने के लिए dots.ocr या PaliGemma 2 चलाएं; संरचित इनपुट के रूप में ट्यूटर को फ़ीड करें।

7. **Safety.**प्रत्येक मॉडल आउटपुट में Llama Guard 4 + एक आयु-अनुकूल फ़िल्टर (स्व-हानि, वयस्क सामग्री, हिंसा को ब्लॉक करता है) पारित होता है। सीखने वाले आईडी द्वारा स्कोप की मेमोरी एक्सेस; माता-पिता एक्सेस सतह को हटाने के लिए।

8. **Efficacy study.**10 छात्र, प्री-टेस्ट (मानक 30-सवाल आधार), दो सप्ताह के ट्यूटर इंटरैक्शन (3 सत्र/सप्ताह), पोस्ट-टेस्ट। एक ही सामग्री पर 10 शिक्षार्थियों के एक गैर-अनुकूली आधार समूह की तुलना करें।

9. **Weekly progress reports.**प्रत्येक छात्र द्वारा, खोजे गए विषयों, मास्टरिंग ट्रैकटोरियों और अनुशंसित अगले चरणों का पीडीएफ सारांश स्वचालित रूप से उत्पन्न करें।

## इसका प्रयोग करें

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## इसे भेजें

`outputs/skill-ai-tutor.md`एक विषय-विशिष्ट अनुकूलन ट्यूटर जिसमें मल्टीमोडल इनपुट, एक छात्र मॉडल, स्मृति, सुरक्षा और मापी गई प्रभावशीलता है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## व्यायाम

1. अनुकूलनशील छात्र मॉडल (कन्सेप्ट क्रम) के साथ और बिना प्रभावशीलता अध्ययन चलाएं। डेल्टा रिपोर्ट करें। अनुकूलनशील जीतने की उम्मीद करें, लेकिन आकार दिलचस्प संख्या है।

2. एक मल्टीमोडल जांच जोड़ेंः पाठ, आवाज और फोटो के रूप में दिया गया एक ही अवधारणा प्रश्न। मापें कि क्या शिक्षार्थियों को उनकी पसंद के मोडलिटी के साथ तेजी से अभिसरण होता है।

3. एक मूल डैशबोर्ड बनाएंः अभ्यास किए गए विषय, महारत पथ, आगामी अवधारणाएं, सुरक्षा घटनाएं (किसी भी गार्डरेल हिट) । COPPA-अनुरूप।

4. भाषा स्विच मोड जोड़ेंः ट्यूटर स्पेनिश में इनपुट स्वीकार करता है और स्पेनिश में पढ़ता है। एक्स-गार्ड कवरेज मापें।

5. स्मृति गोपनीयता पर जोर देंः सत्यापित करें कि छात्र ए आवाज क्लिप हमले के माध्यम से भी छात्र बी के डेटा को नहीं देख सकता है। प्रवेश के प्रयास को लॉग करें और अलर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## आगे पढ़ना

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) संदर्भ उपभोक्ता K-12 शिक्षक
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) भाषा सीखने के लिए संदर्भ शिक्षक
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) होस्ट किए गए संदर्भ मॉडल
- [Quizlet Q-Chat](https://quizlet.com) वैकल्पिक संदर्भ
- [Synthesis Tutor](https://www.synthesis.com) स्टार्टअप संदर्भ
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) अंतराल-पुनरावृत्ति अनुसूचक
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) छात्र-मॉडल क्लासिक
- [LiveKit Agents](https://github.com/livekit/agents) आवाज स्टैक
