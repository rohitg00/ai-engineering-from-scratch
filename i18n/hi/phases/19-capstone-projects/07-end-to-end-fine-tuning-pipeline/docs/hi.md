# कैपस्टोन 07  अंत से अंत तक फाइन ट्यूनिंग पाइपलाइन (SFT से DPO तक डेटा सेवा करने के लिए)

> एक 8B वर्ग मॉडल आपके अपने डेटा पर प्रशिक्षित, DPO-अनुसूचित आपकी अपनी प्राथमिकताओं पर, क्वांटिज़ेड, अनुमानात्मक-डिकोड, और मापने योग्य $ / 1M टोकन पर सेवा दी। 2026 खुला स्टैक एक्सोलोटल v0.8, TRL 0.15, पुनरावृत्ति के लिए Unsloth, क्वांटिज़ेशन के लिए GPTQ/AWQ/GGUF, सेवा के लिए EAGLE-3 के साथ vLLM 0.7 है। मुख्य लक्ष्य पूरी पाइपलाइन को पुनः प्रयोज्य रूप से चलाना है (YAML में, सेवा समाप्ति बिंदु बाहर) और 2026 मॉडल ओपननेस फ्रेमवर्क के तहत एक मॉडल कार्ड प्रकाशित करना है।

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## समस्या

2026 में हर गंभीर एआई टीम एक ठीक-ठीक पाइपलाइन को नल पर रखती है। इसलिए नहीं कि वे सीमा आधार मॉडल भेजते हैं, बल्कि इसलिए कि डाउनस्ट्रीम अनुकूलन  डोमेन SFT, DPO लेबल वाली प्राथमिकताओं के खिलाफ, अनुमानित डिकोडिंग के लिए डिस्टिल किए गए ड्राफ्ट, EAGLE-3  के साथ सेवा करते हैं जहां मापने योग्य जीत रहती है। Axolotl v0.8 बहु-GPU SFT कॉन्फ़िगरेशन को संभालता है। TRL 0.15 DPO और GRPO को संभालता है। Unsloth आप तेजी से एकल GPU पुनरावृत्ति मिलता है। EAGLE-3 के साथ vLLM 0.7 गुणवत्ता हानि के बिना decode आउटपुट 2-3x धक्का देता है। उपकरण काम करता है; शिल्प YAMLs में है, डेटा स्वच्छता, और मूल्यांकन अनुशासन.

आप एसएफटी के माध्यम से 8 बी से 14 बी आधार (लामा 3.1 8 बी, क्यूवेन 3 14 बी, या जेम्मा 3 12 बी) चलाएंगे, फिर कार्य-विशिष्ट डेटा पर डीपीओ, सेवा के लिए क्वांटिज़ करें, और आईएम-मूल्यांकन-हर्नेस, रिवार्डबेंच-2, एमटी-बेंच-वी 2 और एमएमएलयू-प्रो के खिलाफ लाभ मापेंगे। आप 2026 मॉडल ओपननेस फ्रेमवर्क के तहत एक मॉडल कार्ड बनाएंगे। बिंदु पुनरुत्पादनशीलता हैः एक कमांड पूरी पाइपलाइन को अंत से अंत तक फिर से चलाता है।

## अवधारणा

पाइपलाइन में पांच चरण हैं।**Data**: डिडूप (MinHash / Datatrove), गुणवत्ता फ़िल्टर (Nemotron-CC शैली वर्गीकरण), PII स्क्रब, सार्वजनिक बेंचमार्क प्रदूषण के खिलाफ स्प्लिट-हाइजीन जांच। **SFT**: Axolotl YAML, ZeRO-3 पर 8xH100, कॉसिन शेड्यूल, पैक अनुक्रम, 2-3 युग। **DPO or GRPO**: TRL कॉन्फ़िग, 1 epoch, प्राथमिकता जोड़े या तो मानव लेबल या मॉडल-आधारित, बीटा ट्यूनिंग। **Quantize**: GPTQ + AWQ + GGUF तैनाती की लचीलापन के लिए। **Serve**: vLLM 0.7 EAGLE-3 के साथ अनुमानित प्रमुख (या SpecForge के साथ SGLang), K8s तैनाती, कतार में HPA प्रतीक्षा।

Ablations are the deliverable: SFT-only vs SFT+DPO vs SFT+GRPO on three task-specific benchmarks. Serving metrics: tokens/s at batch 1 / 8 / 32, EAGLE-3 acceptance rate, $/1M tokens. Safety eval: Llama Guard 4 पास rate. Model card: bias evaluations, reproducibility seeds, data licensing.

## वास्तुकला

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## स्टैक

- डेटाः डिडप के लिए डेटाट्रोव, गुणवत्ता के लिए नेमोट्रॉन-सीसी वर्गीकरण, पीआईआई के लिए प्रेसिडियो
- आधारः लामा 3.1 8B, Qwen3 14B, या Gemma 3 12B
- एसएफटीः ज़ेरो-3, फ्लैश ध्यान 3, पैक किए गए अनुक्रमों के साथ एक्सोलोटल v0.8
- प्राथमिकता ट्यूनिंगः डीपीओ या जीआरपीओ के लिए टीआरएल 0.15; एकल-जीपीयू पुनरावृत्ति के लिए अनलॉथ
- मात्राः GPTQ (मार्लिन), AWQ, GGUF via llama.cpp
- सेवाः vLLM 0.7 EAGLE-3 अनुमानात्मक डिकोडिंग (या SGLang 0.4 + SpecForge) के साथ
- Eval: lm-मूल्यांकन-हर्नेस, रिवार्डबेंच-2, एमटी-बेंच-वी2, एमएमएलयू-प्रो
- सुरक्षा मूल्यांकनः लामा गार्ड 4, शील्डगेम्मा-2
- बुनियादी ढांचाः कुबेरनेट्स + एनवीआईडीआईए डिवाइस प्लगइन, कतार-उत्तरा मेट्रिक पर एचपीए
- अवलोकनशीलता: प्रशिक्षण के लिए W&B, निष्कर्ष के लिए Langfuse

```figure
ce-finetune-stages
```

## इसे बनाओ

1. **Data pipeline.**कच्चे शरीर पर डेटाट्रॉव डिडूप चलाएं। नेमोट्रॉन-सीसी शैली की गुणवत्ता वर्गीकरण लागू करें। प्रेसिडियो स्क्रब पीआईआई। स्पष्ट बीज के साथ ट्रेन / वाल विभाजन लिखें।

2. **Contamination check.**प्रत्येक सत्यापन विभाजन के लिए, MMLU-Pro, MT-Bench-v2, RewardBench-2 परीक्षण सेट के साथ MinHash की गणना करें। किसी भी ओवरलैप को अस्वीकार करें।

3. **Axolotl SFT.**ZeRO-3 के साथ YAML, FA3, अनुक्रम पैकिंग. 8xH100 पर 2-3 युग. लॉग इन W & B.

4. **TRL DPO / GRPO.**SFT चेकपॉइंट ले लो, प्राथमिकता जोड़े पर DPO का एक युग चलाओ (या गणित/कोड पर सत्यापित इनाम के साथ GRPO) ।

5. **Quantize.**तीन क्वांट उत्पन्न करेंः GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M llama.cpp के लिए। रिकॉर्ड आकार और नाममात्र पारगमन।

6. **Serve with speculative decoding.**vLLM 0.7 रेड हैट स्पेक्लूटर्स के माध्यम से प्रशिक्षित EAGLE-3 ड्राफ्ट हेड के साथ कॉन्फ़िग करें। बैच 1 / 8 / 32 पर स्वीकृति दर और पूंछ विलंबता को मापें। उसी मूल्यांकन पर $/1M टोकन बनाम एंथ्रोपिक / ओपनएआई की रिपोर्ट करें।

7. **Eval matrix.**आधार पर lm-eval-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro चलाएं, केवल SFT-केवल, SFT+DPO, SFT+GRPO। एक तालिका उत्पन्न करें।

8. **Safety eval.**एलएमए गार्ड 4 डिवलपर सेट पर पास दर.

9. **Model card.**MOF 2026 टेम्पलेटः डेटा, प्रशिक्षण, मूल्यांकन, सुरक्षा, लाइसेंस, YAML और प्रतिबद्ध SHAs के साथ पुनरुत्पादनशीलता अनुभाग।

## इसका प्रयोग करें

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## इसे भेजें

`outputs/skill-finetuning-pipeline.md`एक एकल कमांड एसएफटी के माध्यम से डेटा को डीपीओ के माध्यम से क्वांट के माध्यम से सेवा के माध्यम से eval के माध्यम से चलाता है, और एक मॉडल कार्ड + सेवा किए गए एंडपॉइंट जारी करता है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## व्यायाम

1. एक ही कार्य-विशिष्ट बेंचमार्क पर केवल एसएफटी बनाम एसएफटी+डीपीओ बनाम एसएफटी+जीआरपीओ चलाएं। रिपोर्ट करें कि कौन सी प्राथमिकता विधि जीतती है और कितनी।

2. Qwen3 14B के लिए Llama 3.1 8B आदान-प्रदान करें. $ 1M टोकन को एक समान गुणवत्ता पर मापें।

3. डोमेन डेटा बनाम सामान्य ShareGPT पर EAGLE-3 स्वीकृति दर का माप करें। डेल्टा और विलंबता बजट के लिए इसका क्या अर्थ है, इसकी रिपोर्ट करें।

4. प्रदूषण का 1% इंजेक्ट करें (एमएमएलयू-प्रो के जवाब प्रशिक्षण डेटा में लीक करें) और मूल्यांकन को फिर से चलाएं। एमएमएलयू-प्रो सटीकता को अवास्तविक रूप से कूदते हुए देखें। एक प्रदूषण-चेक आईसी गेट बनाएं जो इसे पकड़ ले।

5. पूर्ण-सफाई-ट्यूनिंग के विकल्प के रूप में लोरा एसएफटी जोड़ें। 10 गुना कम मेमोरी पर गुणवत्ता अंतर को मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## आगे पढ़ना

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) संदर्भ एसएफटी/डीपीओ प्रशिक्षक
- [TRL documentation](https://huggingface.co/docs/trl) डीपीओ और जीआरपीओ संदर्भ कार्यान्वयन
- [Unsloth](https://github.com/unslothai/unsloth) एकल-जीपीयू पुनरावृत्ति संदर्भ
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) GRPO पद्धति
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) संदर्भ सेवा स्टैक
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) वैकल्पिक अनुमानात्मक डिकोडिंग प्रशिक्षक
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): खुले रिलीज़ ग्रेडिंग मानक
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) कैनोनिक मूल्यांकन रनर
