# स्व-होस्टिंग सर्विसिंग चयन  हार्डवेयर और स्केल के लिए मशीन मिलान

> इंजन चयन हार्डवेयर, पैमाने और पारिस्थितिकी तंत्र का एक कार्य है  एक रैंकिंग बोर्ड रीड नहीं है। 2026 में चार इंजन स्व-होस्ट किए गए निष्कर्ष पर हावी हैंः llama.cpp, Ollama, vLLM, SGLang, रखरखाव मोड में TGI पीछे रह रहा है। **llama.cpp**सबसे तेज CPU पर  सबसे व्यापक मॉडल समर्थन, मात्रा और थ्रेडिंग पर पूर्ण नियंत्रण। **Ollama**एक कमांड स्थापना है, ~15-30% llama.cpp (गो + CGo + HTTP क्रमबद्धता), 3x आउटपुट अंतर के तहत प्रूड-जैसे लोड। **TGI entered maintenance mode December 11, 2025** केवल बग फिक्स, vLLM की तुलना में ~10% धीमा कच्चा आउटपुट लेकिन ऐतिहासिक रूप से शीर्ष अवलोकन और HF पारिस्थितिकी तंत्र के एकीकरण। यह रखरखाव स्थिति इसे एक जोखिम भरा दीर्घकालिक शर्त बनाती है  नई परियोजनाओं के लिए SGLang या vLLM अधिक सुरक्षित डिफ़ॉल्ट हैं। **vLLM**सामान्य प्रयोजन उत्पादन डिफ़ॉल्ट है  v0.15.1 (फरवरी 2026) PyTorch 2.10, RTX ब्लैकवेल SM120, H200 अनुकूलन जोड़ता है। **SGLang**यह एजेंसी मल्टी-टर्न / प्रीफिक्स-हेवी विशेषज्ञ है  400,000+ GPUs उत्पादन में (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS) । हार्डवेयर प्रतिबंधः सीपीयू-पहले → llama.cpp. AMD / non-NVIDIA → vLLM सबसे मजबूत समर्थित पथ है (TRT-LLM NVIDIA- लॉक है) । 2026 पाइपलाइन पैटर्नः dev = Ollama, staging = llama.cpp, prod = vLLM या SGLang. इंजन अलग-अलग वजन प्रारूप लेते हैं  llama.cpp परिवार के लिए GGUF, GPU इंजन के लिए HF सेफेटेंसर  इसलिए एक प्रारूप रूपांतरण चरणों के बीच बैठ सकता है।

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## सीखने के लक्ष्य

- एक इंजन दिए गए हार्डवेयर (सीपीयू / एएमडी / एनवीडीआईए हॉपर / ब्लैकवेल), पैमाने (1 उपयोगकर्ता / 100 / 10,000), और कार्यभार (सामान्य चैट / एजेंट / लंबी-संदर्भ) चुनें।
- 2026 TGI रखरखाव मोड की स्थिति (11 दिसंबर 2025) का नाम दें और यह नए परियोजनाओं को vLLM या SGLang की ओर क्यों तब्दील करता है।
- विकास/चरण/निर्माण पाइपलाइन का वर्णन करें, जिसमें चरणों के बीच GGUF-सेफेटेंसर प्रारूप रूपांतरण स्थित है।
- बताएं कि "CPU-first" llama.cpp को इंगित करता है और "AMD" TRT-LLM को क्यों बाहर करता है।

## समस्या

आपकी टीम एक नई स्व-होस्ट LLM परियोजना शुरू करती है. एक इंजीनियर Ollama, एक अन्य vLLM, एक तीसरा कहता है "क्या TGI सिर्फ बॉक्स से बाहर काम नहीं करता है? सभी तीन अलग-अलग संदर्भों के लिए सही हैं. कोई भी सभी के लिए सही नहीं है।

2026 में, विकल्प पेड़ मायने रखता हैः हार्डवेयर पहले, पैमाने दूसरा, कार्यभार तीसरा। और एक विशिष्ट 2025 घटना  TGI 11 दिसंबर को रखरखाव मोड में प्रवेश करने से  नई परियोजनाओं के लिए डिफ़ॉल्ट बदलता है।

## अवधारणा

### पांच इंजन

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### हार्डवेयर-पहला निर्णय

**CPU-first**ओल्मा भी काम करता है लेकिन धीमा है. कोई अन्य इंजन सीपीयू पर प्रतिस्पर्धी नहीं है।

**AMD GPU**→ vLLM सबसे मजबूत समर्थित पथ है (AMD ROCm समर्थन). SGLang भी काम करता है. TRT-LLM NVIDIA-लॉक है, इसलिए यह बाहर है.

**NVIDIA Hopper (H100 / H200)**→ vLLM या SGLang या TRT-LLM. सभी तीन शीर्ष स्तर.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM आउटपुट लीडर है (चरण 17 · 07) । vLLM और SGLang निकटता से अनुसरण करते हैं।

**Apple Silicon (M-series)**ओल्मा इसे लपेटता है।

### स्केल-सेकंड निर्णय

**1 user / local dev**→ Ollama. एक आदेश, सेकंड में पहले टोकन.

**10-100 users / small team**→ vLLM एकल-जीपीयू.

**100-10k users / production**→ vLLM उत्पादन-स्टैक (चरण 17 · 18) या SGLang.

**10k+ users / enterprise**→ vLLM उत्पादन-स्टैक + विघटित (चरण 17 · 17) + LMCache (चरण 17 · 18)

### कार्यभार-तीसरा निर्णय

**General chat / Q&A**→ vLLM व्यापक चूक पर जीतता है।

**Agentic multi-turn (tools, planning, memory)**→ एसजीएलएंग का रेडिक्स ध्यान (चरण 17 · 06) हावी है।

**RAG with heavy prefix reuse**→ SGLang.

**Code generation**→ vLLM ठीक है; कैश पर SGLang थोड़ा बेहतर है।

**Long context (128K+)**→ vLLM + टुकड़े टुकड़े पूर्व भरना; SGLang + स्तरित KV।

### टीजीआई रखरखाव जाल

Hugging Face TGI 11 दिसंबर, 2025 को रखरखाव मोड में प्रवेश किया। ऐतिहासिक रूप सेः शीर्ष स्तर की अवलोकन क्षमता, कक्षा में सर्वश्रेष्ठ एचएफ-इकोसिस्टम एकीकरण (मॉडल कार्ड, सुरक्षा उपकरण), कच्चे आउटपुट पर vLLM से थोड़ा पीछे।

2026 में नए परियोजनाओं के लिएः TGI से डिफ़ॉल्ट रूप से दूर। मौजूदा TGI तैनाती जारी रह सकती है लेकिन अंततः माइग्रेट करनी चाहिए। SGLang और vLLM सबसे सुरक्षित डिफ़ॉल्ट हैं।

### पाइपलाइन पैटर्न

डीवी (ओलामा) → स्टेजिंग (लमा.सीपीपी) → प्रोड (वीएलएलएम) इंजन अलग-अलग वजन प्रारूप लेते हैं  लामा.सीपीपी परिवार के लिए जीजीयूएफ, जीपीयू इंजन के लिए एचएफ सेफेटेंसर  ताकि प्रारूप रूपांतरण चरणों के बीच बैठ सके। इंजीनियर लैपटॉप पर तेजी से पुनरावृत्ति करते हैं; स्टेजिंग दर्पण उत्पादन मात्रा को आकार देते हैं; प्रोड सेवा लक्ष्य है।

### ओलमा चेतावनी

ओल्मा डेव के लिए बहुत अच्छा है। यह साझा उत्पादन के लिए बहुत अच्छा नहीं हैः Go HTTP सीरियलकरण ओवरहेड जोड़ता है, समवर्ती प्रबंधन vLLM से सरल है, OpenTelemetry समर्थन लेग्स। ओल्मा का उपयोग करें जहां यह चमकता है  एक उपयोगकर्ता, एक कमांड  और साझा के लिए vLLM पर स्विच करें।

### स्वयं होस्टिंग बनाम प्रबंधित एक अलग निर्णय है

चरण 17 · 01 (प्रबंधित हाइपरस्केलर्स), · 02 (उपयोग मंच) कवर प्रबंधित। यह सबक मानता है कि आपने पहले ही स्वयं होस्ट करने का फैसला किया है। स्वयं होस्ट करने के कारणः डेटा निवास, कस्टम फाइन-ट्यूनिंग, पैमाने पर कुल लागत स्वामित्व, होस्ट पर उपलब्ध डोमेन मॉडल नहीं।

### संख्याओं को याद रखना चाहिए

- TGI रखरखाव मोडः 11 दिसंबर, 2025
- vLLM v0.15.1: फरवरी 2026; PyTorch 2.10; ब्लैकवेल SM120 समर्थन।
- SGLang उत्पादन पदचिह्नः 400,000+ GPUs।
- ओल्मा आउटपुट गैप बनाम llama.cpp: 15-30% धीमा; 3x प्रोड लोड से नीचे।

```figure
data-parallel
```

## इसका प्रयोग करें

`code/main.py`एक निर्णय-वृक्ष पैदल यात्री हैः हार्डवेयर + पैमाने + कार्यभार दिए जाने पर, एक इंजन चुनता है और समझाता है कि क्यों।

## इसे भेजें

यह सबक हमें फल देता है`outputs/skill-engine-picker.md`. प्रतिबंधों को देखते हुए, एक इंजन चुनता है और प्रवास योजना लिखता है.

## व्यायाम

1. दौड़ें`code/main.py`क्या आउटपुट आपकी अंतर्ज्ञान से मेल खाता है?
2. आपका इन्फ्रारेड 12 H100s और 8 MI300X AMD है. कौन सा इंजन?
3. एक टीम 2026 में TGI का उपयोग करना चाहती है क्योंकि "यह वही है जो हम जानते हैं।" प्रवास मामले पर बहस करें।
4. ओल्लामा डेव से वीएलएलएम प्रोडः क्वांटिज़ेशन, कॉन्फ़िगरेशन और ऑब्जर्वेबिलिटी में क्या बदलाव हुए?
5. आरएजी उत्पाद P99 प्रीफिक्स लंबाई 8K और किरायेदारों के बीच उच्च पुनः उपयोग के साथ। एक इंजन चुनें और इसे चरण 17 · 11 + 18 के साथ ढेर करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## आगे पढ़ना

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) जारी नोट्स।
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
