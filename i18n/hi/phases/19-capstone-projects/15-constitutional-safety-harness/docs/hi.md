# कैपस्टोन 15  संवैधानिक सुरक्षा हर्न + रेड-टीम रेंज

> बहुभाषी कवरेज के लिए एंथ्रोपिक के संवैधानिक वर्गीकरण, मेटा के लामा गार्ड 4, गूगल के शील्डगेम्मा-2, एनवीडीआईए के नेमोट्रॉन 3 सामग्री सुरक्षा और एक्स-गार्ड ने 2026 सुरक्षा-वर्गीकरण स्टैक को परिभाषित किया। गाराक, पायरिट, एनवीआईडीआईए एजीस और प्रॉम्प्टफू मानक विरोधी मूल्यांकन उपकरण बन गए। NeMo Guardrails v0.12 उन्हें एक उत्पादन पाइपलाइन में जोड़ता है। यह कैपस्टोन इसे एक साथ जोड़ता हैः एक लक्षित ऐप के चारों ओर एक परत सुरक्षा हर्नल, एक स्वायत्त रेड-टीम एजेंट जो 6 से अधिक हमले परिवारों को चलाता है, और एक संवैधानिक आत्म-आलोचना रन जो एक मापनीय हानिरहितता डेल्टा पैदा करता है।

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## समस्या

2026 में एलएलएम सुरक्षा की सीमा यह नहीं है कि वर्गीकरणकर्ता काम करते हैं (वे, लगभग) लेकिन बिना ओवर-रिफ्यूज या स्पष्ट छेद छोड़ने के लिए एक उत्पादन ऐप के आसपास उन्हें सही ढंग से कैसे बनाया जाए। लामा गार्ड 4 अंग्रेजी नीति उल्लंघन को संभालता है। एक्स-गार्ड (132 भाषाओं) बहुभाषी जेलब्रेक को संभालता है। ShieldGemma-2 छवि आधारित शीघ्र इंजेक्शन को पकड़ता है। NVIDIA Nemotron 3 सामग्री सुरक्षा उद्यम श्रेणियों को कवर करती है। मानव विज्ञान के संवैधानिक वर्गीकरण प्रशिक्षण के दौरान सेवा के बजाय उपयोग किए जाने वाले एक अलग दृष्टिकोण हैं।

हमले के विकास भी मायने रखते हैं। PAIR और TAP जेलब्रेक खोज को स्वचालित करते हैं। GCG ग्रेडिएंट-आधारित प्रत्यय हमले चलाता है। मल्टी-टर्न और कोड-स्विच हमले एजेंट मेमोरी का शोषण करते हैं। किसी भी तैनात LLM को रेड-टीम रेंज की आवश्यकता होती है।

आप एक लक्ष्य अनुप्रयोग (या तो एक 8B निर्देश-ट्यून मॉडल या अन्य capstones से RAG चैटबॉट में से एक) को कठोर करेंगे, इसके खिलाफ 6+ हमले परिवार चलाएंगे, और एक पहले / बाद की हानिरहितता माप बनाएंगे।

## अवधारणा

सुरक्षा पाइपलाइन पांच परतों से है।**Input sanitize**: शून्य चौड़ाई वाले अक्षरों को हटाएं, बेस 64/रोट 13 को डिकोड करें, यूनिकोड को सामान्य बनाएं। **Policy layer**: NeMo Guardrails v0.12 रेल (गैर डोमेन, विषाक्तता, पीआईआई निष्कर्षण) । **Classifier gate**: एलमा गार्ड 4 इनपुट पर, एक्स गार्ड गैर-अंग्रेजी पर, शील्डगेम्मा-2 छवि इनपुट पर। **Model**: लक्ष्य LLM. **Output filter**: एलएएमए गार्ड 4 आउटपुट पर, प्रेसिडियो पीआईआई स्क्रब, लागू होने पर कोटेशन प्रवर्तन। **HITL tier**: उच्च जोखिम वाले आउटपुट एक स्लैक कतार में जाते हैं।

रेड-टीम रेंज एक शेड्यूलर पर चलता है। PAIR और TAP स्वायत्त रूप से जेलब्रेक का पता लगाते हैं। GCG ग्रेडिएंट-आधारित प्रत्यय हमले चलाता है। ASCII / base64 / rot13 एन्कोडिंग हमले। मल्टी-टर्न हमले (व्यक्तिगत अपनाने, स्मृति शोषण) । कोड स्विच हमले (इंग्लिश और स्वाहिली या थाई के साथ मिश्रित) । प्रत्येक रन सीवीएसएस स्कोरिंग और प्रकटीकरण समयरेखा के साथ एक संरचित निष्कर्ष फ़ाइल उत्पन्न करता है।

संवैधानिक-स्व-आलोचना दौड़ एक प्रशिक्षण-समय हस्तक्षेप है। 1k हानिकारक-प्रयास संकेत लें, मॉडल को प्रतिक्रिया का मसौदा तैयार करें, लिखित संविधान (हानिकारक-नहीं नियम) के खिलाफ आलोचना करें, और आलोचना लूप पर फिर से प्रशिक्षण दें। एक लंबे समय तक चलने वाले मूल्यांकन पर हानिरहितता डेल्टा को मापें।

## वास्तुकला

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## स्टैक

- सुरक्षा वर्गीकरणकर्ता: लामा गार्ड 4, शील्डगेमा-2, एनवीआईडीआईए नेमोट्रॉन 3 सामग्री सुरक्षा, एक्स गार्ड
- गार्डरेल फ्रेमवर्क: NeMo Guardrails v0.12 + OPA
- रेड-टीम ड्राइवरः गाराक (एनवीआईडीआईए), पायरिट (माइक्रोसॉफ्ट एज़्यूर), एनवीआईडीआईए एजीआईएस, प्रॉम्प्टफू
- जेल ब्रेक एजेंटः PAIR (Chao et al., 2023), ट्री-ऑफ-एटैक (TAP), GCG प्रत्यय
- संवैधानिक प्रशिक्षणः मानव शैली की आत्म-आलोचना लूप + आलोचना पर एसएफटी
- पीआईआई स्क्रब: प्रेसिडियो
- लक्ष्यः एक 8B निर्देश-ट्यूनिंग मॉडल या अन्य capstones के RAG चैटबॉट

```figure
cf-safety-stack
```

## इसे बनाओ

1. **Target setup.**vLLM पर एक 8B निर्देश-ट्यून मॉडल स्थापित करें (या किसी अन्य capstone से एक RAG चैटबॉट का पुनः उपयोग करें) यह परीक्षण में ऐप है।

2. **Safety pipeline wrap.**लक्ष्य के चारों ओर पांच परतों की पाइपलाइन को तार करें। प्रत्येक परत को व्यक्तिगत रूप से देखा जा सकता है (लैंगफ्यूज में प्रति परत स्पैन) की जांच करें।

3. **Classifier coverage.**लोड लामा गार्ड 4, एक्स-गार्ड (बहुभाषी), शील्डगेम्मा-2 (छवि) । आधार रेखाओं को स्थापित करने के लिए प्रत्येक को एक छोटे लेबल सेट पर चलाएं।

4. **Red-team scheduler.**कार्यक्रम गाराक, PyRIT, एक PAIR एजेंट, एक TAP एजेंट, एक GCG धावक, एक बहु-टर्न हमलावर, और एक कोड स्विच हमलावर. प्रत्येक एक अलग कतार पर चलाता है।

5. **Attack suite.**छह हमले परिवारः (1) PAIR स्वचालित जेलब्रेक, (2) TAP पेड़-ऑफ-आक्रमण, (3) GCG ग्रेडिएंट प्रत्यय, (4) ASCII / base64 / rot13 एन्कोडिंग, (5) मल्टी-टर्न पर्सन, (6) बहुभाषी कोड-स्विच। प्रति परिवार सफलता दर रिपोर्ट करें।

6. **Constitutional self-critique.**1k हानिकारक प्रयासों के संकेतों को संभालें। प्रत्येक के लिए, लक्ष्य एक प्रतिक्रिया का मसौदा तैयार करता है। एक आलोचक एलएलएम एक लिखित संविधान के खिलाफ स्कोर करता है ("कोई नुकसान नहीं करो", "सबूत का हवाला दो, "अवैध अनुरोधों को अस्वीकार करो") । संकेत जहां आलोचनात्मक वस्तुओं को फिर से लिखा जाता है; लक्ष्य आलोचना-सुधारित जोड़े पर ठीक-ठीक है। एक आयोजित मूल्यांकन पर हानिकारकता से पहले / बाद का माप।

7. **Over-refusal measurement.**एक सौम्य शीघ्र सूट (जैसे, XSTest) पर झूठी सकारात्मकता दर का पता लगाएं। सौम्य प्रश्नों पर लक्ष्य उपयोगी रहना चाहिए।

8. **CVSS scoring.**प्रत्येक सफल जेलब्रेक के लिए, सीवीएसएस 4.0 (हमला वेक्टर, जटिलता, प्रभाव) पर स्कोर करें। एक खुलासा समयरेखा और mitigation योजना उत्पन्न करें।

9. **Range automation.**उपरोक्त सब कुछ एक क्रॉन पर चलता है; निष्कर्ष एक कतार में लिखते हैं; ओवर-रिज्यूलेशन रेग्रिशन स्लैक को आग चेतावनी देता है।

## इसका प्रयोग करें

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## इसे भेजें

`outputs/skill-safety-harness.md`उत्पादन स्तर की परतों वाली सुरक्षा पाइपलाइन प्लस एक पुनरुत्पादित रेड-टीम रेंज जिसमें पहले/बचे हानिरहितता डेल्टा हैं।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## व्यायाम

1. RAG चैटबॉट पर शीघ्र-इंजेक्शन के लिए गाराक प्लगइन चलाएं और आउटपुट-फिल्टर परत के साथ और उसके बिना हमले की सफलता दर की तुलना करें।

2. एक सातवें हमले परिवार जोड़ेंः अप्रत्यक्ष शीघ्र इंजेक्शन प्राप्त दस्तावेजों के माध्यम से। अतिरिक्त रक्षा की आवश्यकता का माप.

3. "सहायता के साथ अस्वीकार" मोड लागू करेंः जब गार्डरेल ब्लॉक होता है, तो लक्ष्य एक सुरक्षित संबंधित उत्तर प्रदान करता है।

4. बहुभाषी कवरेज अंतरः एक ऐसी भाषा खोजें जहां एक्स-गार्ड कम प्रदर्शन करता है। इसे लक्षित करने के लिए एक सूक्ष्म-ट्यूनिंग डेटासेट का प्रस्ताव करें।

5. 30B मॉडल पर संवैधानिक आत्म-आलोचना चलाएं और मापें कि डेल्टा पैमाने क्या हैं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## आगे पढ़ना

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) प्रशिक्षण समय संदर्भ
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) इनपुट/आउटपुट वर्गीकरण 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) छवि + मल्टीमोडल सुरक्षा
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) उद्यम संदर्भ
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) 132 भाषाओं की बहुभाषी सुरक्षा
- [garak](https://github.com/NVIDIA/garak) NVIDIA रेड-टीम टूलकिट
- [PyRIT](https://github.com/Azure/PyRIT) माइक्रोसॉफ्ट रेड टीम फ्रेमवर्क
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) रेल ढांचा
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) जेल ब्रेक एजेंट पेपर
