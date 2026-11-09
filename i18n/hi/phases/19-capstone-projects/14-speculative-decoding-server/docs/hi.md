# कैपस्टोन 14  अनुमानात्मक-डिकोडिंग इन्फरेंस सर्वर

> अनुमानित डिकोडिंग  एक सस्ता ड्राफ्ट टोकन का प्रस्ताव देता है, लक्ष्य मॉडल उन्हें एक पास में सत्यापित करता है  अब उत्पादन के लिए तैयार अनुकूलन है, एक शोध चाल नहीं है। vLLM 0.7 जहाजों में ईगल-3 वास्तविक यातायात पर 2.5-3x पारगमन। पी-एगल (एडब्ल्यूएस 2026) ने समानांतर अटकलों को और आगे बढ़ाया। एसजीएलएंग के स्पेकफोर्ज ने बड़े पैमाने पर प्रशिक्षित सैनिक प्रमुखों को प्रशिक्षित किया। रेड हैट के स्पेक्लूटर्स हब ने आम खुले मॉडल के लिए संरेखित मसौदा प्रकाशित किया। TensorRT-LLM ने NVIDIA पर प्रथम श्रेणी का अनुमानित डिकोडिंग किया। 2026 उत्पादन सेवा स्टैक vLLM या SGLang है जिसमें EAGLE-परिवार ड्राफ्ट, FP8 या INT4 क्वांटिज़ेशन और कतार-उत्तरा पर HPA है। यह कपाट दो खुले मॉडल को 2.5x+ बेसलाइन थ्रूपुट पर पूरी तरह से टेल-लैटेंसी रिपोर्ट के साथ सेवा देने वाला है।

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## समस्या

2026 में अनुमानित डिकोडिंग एक वस्तु बन गई। ईगल-3 ड्राफ्ट हेड लक्ष्य मॉडल की छिपी हुई अवस्थाओं पर प्रशिक्षण देते हैं और आगे N टोकन की भविष्यवाणी करते हैं; लक्ष्य मॉडल एक पास में सत्यापित होता है। 60-80% की स्वीकृति दरें 2-3 गुना अंत-से-अंत आउटपुट का अनुवाद करती हैं। vLLM 0.7 इसे मूल रूप से एकीकृत करता है। SGLang + SpecForge आपको प्रशिक्षण पाइपलाइन देता है। रेड हैट के स्पेक्लूटर्स ने Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B के लिए संरेखित मसौदा प्रकाशित किया।

शिल्प सेवा संचालन में है, मॉडल नहीं। ट्रैफ़िक वितरण (शेयरजीपीटी बनाम कोड बनाम डोमेन डेटा) के साथ स्वीकृति दर चलती है। अस्वीकृति के तहत पूंछ विलंबता अटकलों के बिना भी बदतर है  आपको कई बैच आकारों पर p99 रिपोर्ट करना चाहिए, न कि केवल स्थिर-राज्य टोकन / सेकंड। 1M टोकन प्रति लागत बनाम मानव / ओपनएआई एपीआई विश्वसनीयता लीवर है।

## अवधारणा

अनुमानित डिकोडिंग में दो परतें हैं।**draft**मॉडल (एगल-3 सिर, ngram, या छोटे लक्ष्य-अनुसूचित मॉडल) प्रत्येक चरण के लिए k उम्मीदवार टोकन का प्रस्ताव देता है।**target**मॉडल एक पास में सभी k को सत्यापित करता है; कोई भी स्वीकार्य पूर्वावलोकन लालची पथ की जगह लेता है। स्वीकृति दर ड्राफ्ट-लक्ष्य संरेखण और इनपुट वितरण पर निर्भर करती है।

ईगल-3 अधिकांश ट्रैफ़िक पर ngram ड्राफ्ट से बेहतर है। पी-ईगल गहरे ड्राफ्ट पेड़ों के लिए समानांतर अटकलें चलाता है। कॉम्प्रेशनः अस्वीकार पर पी 99 विलंबता अधिक है क्योंकि सत्यापित पास बड़ा है। इस पर प्रकाश डालने के लिए सेवा कॉन्फ़िगरेशन को बैच आकार के बकेट विलंबता की रिपोर्ट करनी चाहिए।

VLLM 0.7 प्रति GPU या टेन्सर-समान शेड पर एक प्रतिकृति चलाता है। CPU की बजाय कतार-उत्तरा पर HPA ऑटोस्केल। FP8 (मार्लिन) और INT4 (AWQ) क्वांट H100 / H200 लिफाफे के अंदर GPU मेमोरी रखते हैं। अंत-से-अंत रिपोर्ट आउटपुट, स्वीकृति दर, batch 1/8/32 पर p50/p99 और $/1M टोकन है।

## वास्तुकला

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## स्टैक

- सेवाः vLLM 0.7 या SGLang 0.4
- अनुमानित पद्धतिः ईगल-3 ड्राफ्ट हेड, पी-ईगल समानांतर अनुमान, ngram fallback
- प्रारूप प्रशिक्षणः स्पेकफोरज (एसजीएलएंग) या रेड हैट स्पेक्युलेटर
- लक्ष्य मॉडलः Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- मात्राः एफपी8 (मार्लिन), INT4 AWQ
- तैनातीः कुबेरनेट्स + एनवीआईडीए डिवाइस प्लगइन; कतार-उत्तरा मेट्रिक पर एचपीए
- Eval: ShareGPT, MT-Bench-v2, GSM8K, HumanEval डोमेन-स्प्रेड स्वीकृति माप के लिए
- संदर्भः विक्रेता बेसलाइन के लिए TensorRT-LLM अनुमानात्मक डिकोडिंग

```figure
cf-spec-decode
```

## इसे बनाओ

1. **Target model prep.**Llama 3.3 70B चुनें. मार्लिन के माध्यम से FP8 तक क्वांटिज़ करें. 1xH100 (या 2x टेन्सर-समान) पर vLLM 0.7 के तहत तैनात करें।

2. **Draft source.**Red Hat Speculators से एक संरेखित EAGLE-3 ड्राफ्ट हेड खींचें (या SpecForge के माध्यम से एक को प्रशिक्षित करें) । vLLM के अनुमानात्मक-डिकोडिंग कॉन्फ़िग में लोड करें।

3. **Baseline numbers.**अटकलों से पहलेः टोकन / बैच 1/8/32, पी 50 / पी 99 विलंबता, जीपीयू उपयोग. प्रकाशित करें.

4. **Enable EAGLE-3.**फ्लिप कॉन्फ़िग; वही बेंचमार्क फिर से चलाएं. रिपोर्ट स्पीडअप, स्वीकृति दर, p99 टेल-लैटेंसी डेल्टा.

5. **P-EAGLE.**समानांतर अनुमान लगाने में सक्षम करें; गहरे ड्राफ्ट ट्री बनाम सीरियल ईगल-3 को मापें।

6. **Domain traffic.**ShareGPT बनाम HumanEval बनाम डोमेन-विशिष्ट ट्रैफ़िक को उसी सर्वर के माध्यम से चलाएं। प्रति वितरण स्वीकृति दर मापें। ड्राफ्ट के बहाव के समय की पहचान करें।

7. **Second target model.**Qwen3-Coder-30B MoE पर एक ही पाइपलाइन चलाएं। ड्राफ्ट अधिक मुश्किल है (MoE रूटिंग शोर) रिपोर्ट।

8. **K8s HPA.**एचपीए ट्रैकिंग के साथ K8 के तहत तैनात `queue_wait_ms`लोड तीन गुना होने पर स्केल आउट का प्रदर्शन करें।

9. **Cost comparison.**एक ही मूल्यांकन पर मानव क्लाउड सोनट 4.7 और ओपनएआई जीपीटी-5.4 के खिलाफ $ 1M टोकन की गणना करें। प्रकाशित करें।

## इसका प्रयोग करें

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## इसे भेजें

`outputs/skill-inference-server.md`एक मापा सेवा स्टैक के साथ अनुमानात्मक डिकोडिंग, एक पूर्ण बेंचमार्क रिपोर्ट, और एक K8s तैनाती।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## व्यायाम

1. जब मसौदा लक्ष्य से एक संस्करण पीछे हो जाए (जैसे, Llama 3.3 -> 3.4 बहाव) तब स्वीकृति दर में गिरावट को मापें। निगरानी अलर्ट बनाएं।

2. एनजीआरएम-फॉल-बैक लागू करेंः यदि ईएजीएलई-3 स्वीकृति एक सीमा से नीचे गिरती है, तो एनजीआरएम ड्राफ्ट पर स्विच करें। विश्वसनीयता में सुधार की रिपोर्ट करें।

3. नियंत्रित एमओई प्रयोग चलाएँः उसी क्यूवेन3-कोडर-30बी के साथ इंजेक्शन वाले रूटिंग शोर बनाम बाहर। ड्राफ्ट स्वीकृति संवेदनशीलता मापें।

4. H200 (141 GB) तक विस्तारित करें। मॉडल आकार प्रति प्रतिकृति हेडरूम प्राप्त की रिपोर्ट करें और क्या आप एक अनक्वैंटेड Llama 3.3 70B की सेवा कर सकते हैं।

5. बेंचमार्क TensorRT-LLM एक ही H100 हार्डवेयर पर अनुमानित डिकोडिंग. रिपोर्ट जहां यह vLLM बनाम जीतता है.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## आगे पढ़ना

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) संदर्भ सेवा स्टैक
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) समानांतर अनुमानात्मक डिकोडिंग पेपर + एकीकरण
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) ड्राफ्ट हेड प्रशिक्षण पाइपलाइन
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) संरेखित ड्राफ्ट हब
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) विक्रेता विकल्प
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) वाणिज्यिक संदर्भ
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) विधि पत्र
- [vLLM repository](https://github.com/vllm-project/vllm) कोड और बेंचमार्क
