# Capstone 08  एक विनियमित ऊर्ध्वाधर के लिए उत्पादन RAG चैटबोट

> हार्वे, ग्लेन, मेन्डेबल और लामाक्लाउड सभी 2026 में एक ही उत्पादन आकार चलाते हैं। दृश्यों के लिए डॉक्लिंग या अनस्ट्रक्चर और कोलपाली के साथ सेवन करें। हाइब्रिड खोज. Bge-Renanker-v2-gemma के साथ पुनः रैंक. 60-80% हिट दर पर शीघ्र कैशिंग का उपयोग करके क्लाउड सोनट 4.7 के साथ संश्लेषण करें। लामा गार्ड 4 और नेमो गार्डरेल्स के साथ गार्ड। Langfuse और फीनिक्स के साथ देखो. 200 प्रश्नों के स्वर्ण सेट पर RAGAS के साथ ग्रेड। एक विनियमित डोमेन (कानूनी, नैदानिक, बीमा) में एक का निर्माण करें, और टॉपस्टोन स्वर्ण सेट, लाल टीम, और ड्रेफ डैशबोर्ड को पार कर रहा है।

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## समस्या

विनियमित डोमेन आरएजी (कानूनी अनुबंध, नैदानिक परीक्षण प्रोटोकॉल, बीमा पॉलिसी) 2026 का सबसे अधिक शिप किया गया उत्पादन रूप है क्योंकि आरओआई स्पष्ट है और दांव ठोस हैं। हार्वे (एलेन और ओवर) ने इसे कानूनी के लिए बनाया। Mendable जहाजों डेवलपर-डॉक्स स्वाद. ग्लेन उद्यम खोज को कवर करता है। पैटर्न हैः उच्च निष्ठा का सेवन करें, री रैंक के साथ हाइब्रिड प्राप्त करें, उद्धरण प्रवर्तन और त्वरित कैशिंग के साथ संश्लेषण करें, सुरक्षा के कई परतों के साथ सुरक्षा करें, और लगातार मॉनिटर ड्रिफ करें।

कठिन भागों मॉडल नहीं हैं। ये अधिकार क्षेत्र के प्रति जागरूक अनुपालन (HIPAA, GDPR, SOC2), उद्धरण स्तर की लेखा परीक्षा, लागत नियंत्रण (प्रोम्प्ट कैशिंग उच्च हिट दर पर 60-90% छूट खरीदता है), RAGAS निष्ठा के माध्यम से भ्रम का पता लगाना, और जब स्रोत दस्तावेजों को अपडेट किया जाता है तो सूचकांक पकड़ने के बिना बहाव का पता लगाना है। यह कपास्टोन आपको 200 प्रश्नों के एक स्वर्ण सेट पर सब कुछ भेजने के लिए कहता है जिसके साथ एक लाल टीम सूट है।

## अवधारणा

पाइपलाइन के दो पक्ष हैं।**Ingestion**: docling या Unstructured संरचित दस्तावेजों को विश्लेषण करता है; ColPali दृश्य रूप से समृद्ध दस्तावेजों को संभालता है; टुकड़े सारांश, टैग और भूमिका आधारित एक्सेस लेबल प्राप्त करते हैं। वेक्टर pgvector + pgvector scale (50M से कम वेक्टर) या Qdrant Cloud में जाते हैं; दुर्लभ BM25 साथ में चलता है। **Conversation**: लैंगग्राफ मेमोरी और मल्टी-टर्न को संभालता है; प्रत्येक क्वेरी हाइब्रिड रिट्रीवल चलाती है, bge-reranker-v2-gemma-2b के साथ रैंक करती है, क्लाउड सोनट 4.7 (प्रोम्प्ट-कैश) के साथ संश्लेषित करती है, Llama Guard 4 और NeMo Guardrails के माध्यम से आउटपुट पारित करती है, और एक उद्धरण-अंकर्ड प्रतिक्रिया जारी करती है।

मूल्यांकन स्टैक में चार परतें हैं।**Golden set**(सटीकता के लिए 200 उद्धरणों के साथ Q/A लेबल) । **Red team**(जेलब्रेक, पीआईआई निकालने के प्रयास, डोमेन से बाहर प्रश्न) सुरक्षा के लिए। **RAGAS**निष्ठा / उत्तर प्रासंगिकता / संदर्भ सटीकता के लिए स्वचालित रूप से प्रति मोड़। **Drift dashboard**(अरिज़ फ़ीनिक्स) देख रहा है पुनर्प्राप्ति गुणवत्ता और भ्रम स्कोर साप्ताहिक.

त्वरित कैशिंग लागत लीवर है। क्लाउड 4.5+ और GPT-5+ कैशिंग सिस्टम प्रॉम्प्ट + पुनर्प्राप्त संदर्भ का समर्थन करते हैं। 60-80% हिट दर पर, प्रति क्वेरी लागत 3-5 गुना कम होती है। पाइपलाइन को स्थिर पूर्वावलोकन के लिए डिज़ाइन किया जाना चाहिए (प्रथम सिस्टम प्रॉम्प्ट + रीरैंक किया गया संदर्भ) उच्च कैश हिट दर प्राप्त करने के लिए।

## वास्तुकला

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## स्टैक

- निगलनाः Unstructured.io या संरचित दस्तावेजों के लिए docling; दृश्य-समृद्ध पीडीएफ के लिए ColPali
- वेक्टर डीबीः pgvector + pgvectorscale 50M वेक्टर से कम; Qdrant Cloud अन्यथा
- स्पायर: क्षेत्र भार के साथ टैंटिवी BM25
- ऑर्केस्ट्रेशन: LlamaIndex वर्कफ़्लो (इंग्ज़िशन) + लैंगग्राफ (वार्ता)
- पुनः रैंकः bge-reranker-v2-gemma-2b स्व-होस्ट या Voyage पुनः रैंक-2 होस्ट
- LLM: क्लाउड सोनेट 4.7 त्वरित कैशिंग के साथ; बैकअप Llama 3.3 70B स्वयं होस्ट
- ईवल: RAGAS 0.2 ऑनलाइन, दीपईवल के लिए पग्लाने और जेलब्रेक सूट
- अवलोकनशीलताः एनोटेशन कतार के साथ लैंगफ्यूज स्व-होस्ट; ड्रिफ्ट के लिए एरिज़ फीनिक्स
- गार्डरेल्स: लामा गार्ड 4 इनपुट/आउटपुट वर्गीकरण, नेमो गार्डरेल्स v0.12 नीति, प्रेसिडियो पीआईआई स्क्रब
- अनुपालनः टुकड़ों पर भूमिका आधारित पहुंच लेबल; GDPR/HIPAA के लिए अधिकार क्षेत्र टैग

```figure
canary-rollout
```

## इसे बनाओ

1. **Ingestion.**अपने कॉर्पस (1000-10000 दस्तावेजों को गंभीर निर्माण के लिए) को अनस्ट्रक्चर या डॉक्लिंग के साथ पार्स करें। स्कैन / दृश्य-भारी पृष्ठों के लिए, कोलपाली के माध्यम से मार्ग दें। सारांश, भूमिका-लेबल, अधिकार क्षेत्र टैग के साथ टुकड़े बनाएं।

2. **Index.**घने एम्बेड (वॉएज-3 या नोमिक-एम्बेड-वी2) में pgvector + pgvector पैमाने। BM25 साइड इंडेक्स टैंटीवी के माध्यम से। भूमिका और अधिकार क्षेत्र फ़िल्टर के रूप में उपयोगी लोड।

3. **Hybrid retrieve.**पहले भूमिका + अधिकार क्षेत्र द्वारा फ़िल्टर करें; फिर समानांतर घने + BM25; पारस्परिक रैंक संलयन के साथ विलय करें; शीर्ष 20 को पुनः रैंक करें; शीर्ष 5 को सिंथेट करें।

4. **Synthesize with prompt caching.**कैश हेडर में सिस्टम प्रॉम्प्ट + स्थैतिक नीति; कैश एक्सटेंशन के रूप में संदर्भ को फिर से रैंक किया गया; कैश किए बिना प्रत्यय के रूप में उपयोगकर्ता प्रश्न। स्थिर स्थिति में 60-80% कैश हिट दर को लक्ष्य करें।

5. **Guardrails.**Llama Guard 4 इनपुट पर; NeMo Guardrails रेल डोमेन से बाहर प्रश्नों या नीति-निषिद्ध विषयों को ब्लॉक करता है; Presidio आउटपुट में आकस्मिक PII स्क्रब करता है; उद्धरण प्रवर्तन पोस्ट-फिल्टर।

6. **Golden set.**200 प्रश्न/उत्तर जोड़े जो डोमेन विशेषज्ञ द्वारा (जवाब, उद्धरण) के साथ लेबल किए गए हैं। सटीक उद्धरण मैच पर स्कोर एजेंट, उत्तर सटीकता, निष्ठा (RAGAS) ।

7. **Red team.**50 प्रतिकूल संकेतः जेलब्रेक (PAIR, TAP), पीआईआई निष्फिल्ट्रेशन प्रयास, आउट-डोमेन, क्रॉस-ज्यूरिशन्स लीक। पास/फेल और गंभीरता के साथ स्कोर।

8. **Drift dashboard.**एरीज़ फीनिक्स साप्ताहिक रूप से प्रतिशोध गुणवत्ता (एनडीसीजी, उद्धरण वफादारी) को ट्रैक करता है। 5% गिरावट पर अलर्ट।

9. **Cost report.**Langfuse: शीघ्र कैशिंग हिट दर, प्रति क्वेरी टोकन, $/क्वेरी चरणों द्वारा टूटना।

## इसका प्रयोग करें

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## इसे भेजें

`outputs/skill-production-rag.md`अनुपालन लेबल के साथ तैनात एक विनियमित डोमेन चैटबॉट, rubric के माध्यम से पारित, प्रत्यक्ष बहाव निगरानी के साथ अवलोकन किया।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## व्यायाम

1. एक अलग अधिकार क्षेत्र के तहत एक दूसरा कॉर्पस स्लाइस बनाएं (उदाहरण के लिए, GDPR के साथ HIPAA) 20 प्रश्नों के पार-अधिकार क्षेत्र जांच पर क्रॉस-लीक को रोकने के लिए भूमिका + अधिकार क्षेत्र फ़िल्टरिंग का प्रदर्शन करें।

2. उत्पादन यातायात के एक सप्ताह में शीघ्र कैश हिट दर मापें. पहचानें कि कौन से क्वेरी कैश प्रीफिक्स को तोड़ती है. पुनर्गठन.

3. 10k टोकन के सारांश बफर के साथ मल्टी-टर्न मेमोरी जोड़ें। यह मापें कि बातचीत बढ़ने के साथ विश्वास घटता है या नहीं।

4. क्लाउड Sonnet 4.7 के लिए Llama 3.3 70B स्व-होस्ट. $ / क्वेरी और निष्ठा डेल्टा मापने.

5. "अनिश्चितता" मोड जोड़ेंः यदि शीर्ष पुनर्व्यवस्थित स्कोर एक सीमा से नीचे है, तो एजेंट जवाब देने के बजाय "मेरे पास आत्मविश्वास वाले उद्धरण नहीं हैं" कहता है। झूठे विश्वास को कम करने का उपाय करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## आगे पढ़ना

- [Harvey AI](https://www.harvey.ai) संदर्भ कानूनी उत्पादन स्टैक
- [Glean enterprise search](https://www.glean.com) उद्यम स्तर पर संदर्भ आरएजी
- [Mendable documentation](https://mendable.ai) डेवलपर-डॉक्स आरएजी संदर्भ
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) प्रबंधित सेवन
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) लागत-लेवर संदर्भ
- [RAGAS 0.2 documentation](https://docs.ragas.io/) आरएजी मूल्यांकन ढांचे
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) संदर्भ बहाव की अवलोकन क्षमता
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) सुरक्षा वर्गीकरण 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) रेल नीति ढांचा
