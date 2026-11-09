# Capstone 02  कोडबेस पर RAG (क्रॉस-रिपो सेमेन्टिक सर्च)

> 2026 में हर गंभीर इंजीनियरिंग संगठन एक आंतरिक कोड खोज चलाता है जो अर्थ को समझता है, न कि सिर्फ स्ट्रिंग्स। स्रोत ग्राफ एम्प, पाठ्यक्रम के कोडबेस उत्तर, Augment के उद्यम ग्राफ, Aider के repomap, Pinterest के आंतरिक MCP  एक ही आकार. कई repos को खाएं, पेड़-सिटर के साथ विश्लेषण करें, फंक्शन-और वर्ग स्तर के टुकड़े एम्बेड करें, हाइब्रिड-खोजें, पुनः रैंक करें, उद्धरणों के साथ उत्तर दें। यह capstone आप एक बनाने के लिए कहता है कि 10 repos पर 2M लाइनों कोड को संभालने और प्रत्येक git धक्का पर वृद्धिशील पुनः सूचकांक जीवित रहता है।

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## समस्या

2026 तक हर सीमा कोडिंग एजेंट कोडबेस रिट्रीवल लेयर के साथ जहाज करता है क्योंकि केवल संदर्भ विंडो क्रॉस-रिपो प्रश्नों को हल नहीं करती है। क्लाउड का 1M-token संदर्भ मदद करता है; यह रैंक प्राप्त करने की आवश्यकता को समाप्त नहीं करता है। कच्चे टुकड़ों के विष पर साफ़-साफ़ खोज उत्पन्न कोड, मोनोरेपो डुप्लिकेशन और दुर्लभ आयातित प्रतीकों के लंबे पूंछ पर परिणाम देती है। उत्पादन उत्तर एक रि-रैंकिंग के साथ एएसटी-जागरूक टुकड़ों पर एक हाइब्रिड (घन + बीएम 25) खोज है, जिसका समर्थन प्रतीक संदर्भों के ग्राफ द्वारा किया जाता है।

आप इसे एक वास्तविक फ्लीट  नहीं एक ट्यूटोरियल रेपो  को इंडेक्स करके सीखते हैं और MRR@10, उद्धरण वफादारी और वृद्धिशील ताज़ापन को मापते हैं। विफलता मोड बुनियादी ढांचे के हैंः 100k फ़ाइल मोनोरेपो, एक धक्का जो आधे फ़ाइलों को रिटच करता है, एक क्वेरी जिसे सही उत्तर देने के लिए चार रेपो को पार करने की आवश्यकता होती है।

## अवधारणा

एएसटी-जागरूक सेवन पाइपलाइन प्रत्येक फ़ाइल को पेड़-सइटर के साथ पार्स करती है, फंक्शन और क्लास नोड्स को निकालेगी, और फिक्स्ड टोकन विंडो के बजाय नोड सीमाओं पर टुकड़े। प्रत्येक टुकड़े को तीन प्रतिनिधित्व प्राप्त होते हैंः एक घने एम्बेडिंग (वॉएज-कोड-3 या नामिक-एम्बेड-कोड), दुर्लभ BM25 शब्द, और एक छोटा प्राकृतिक भाषा सारांश। सारांश में एक तीसरी पुनः प्राप्त करने योग्य पद्धति जोड़ी गई है  उपयोगकर्ता पूछते हैं "एक्स को कैसे अधिकृत किया जाता है" और सारांश में "authz" का उल्लेख किया जाता है, भले ही कोड में केवल `check_permission`. .

रिट्रीवल हाइब्रिड है। एक क्वेरी घने और BM25 दोनों खोजों को चलाती है, शीर्ष-के को मिलाती है, और संघ को क्रॉस-एन्कोडर री-रैंक (कोहेरे रेनैंक-3 या बीजे-रेनैंक-वी2-जेम्मा-2बी) को सौंपती है। पुनर्गठित सूची एक लंबी-सामग्री सिंथेसाइज़र (क्लाउड सोनट 4.7 के साथ त्वरित कैशिंग, या Llama 3.3 70B स्वयं होस्ट) के लिए जाती है जिसमें फ़ाइल और लाइन रेंज द्वारा प्रत्येक दावे का उल्लेख करने के निर्देश होते हैं। बिना उद्धरण के उत्तरों को पोस्ट-फिल्टर द्वारा अस्वीकार कर दिया जाता है।

इनक्रीमेंटल फ्रेशनेस बुनियादी ढांचे की समस्या है। Git पुश एक अंतर को ट्रिगर करता हैः कौन सी फ़ाइलें बदल गई हैं, कौन से प्रतीक बदल गए हैं। केवल प्रभावित टुकड़े फिर से एम्बेड किए गए हैं। प्रभावित क्रॉस-फाइल प्रतीक किनारे (आयात, विधि कॉल) पुनः गणना किए जाते हैं। इंडेक्स 2M लाइनों को पुनः संसाधित किए बिना एक समान रहता है।

## वास्तुकला

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## स्टैक

- पार्सिंगः 17 भाषा व्याकरण (पाइटन, टीएस, रुस्ट, गो, जावा, सी++, आदि) के साथ पेड़-सेटर
- घने एम्बेड: Voyage-code-3 (होस्ट) या nomic-embed-code-v1.5 (self-host), bge-code-v1 fallback
- स्परस इंडेक्सः BM25F के साथ टैंटिवी (रस्ट), प्रतीक नाम बनाम शरीर पर क्षेत्र-वजनित
- वेक्टर डीबीः हाइब्रिड खोज के साथ Qdrant 1.12 या 50M वेक्टर से कम टीमों के लिए pgvector + pgvectorscale
- टुकड़ा सारांश मॉडलः क्लाउड हैकु 4.5 या मिथुन 2.5 फ्लैश, शीघ्र कैश
- पुनर्गठनः सहकारी पुनर्गठन-3 या bge-reanker-v2-gemma-2b स्व-होस्ट
- ऑर्केस्ट्रेशनः LlamaIndex वर्कफ़्लोस इनजेक्शन के लिए, लैंगग्राफ क्वेरी एजेंट के लिए
- सिंथेसाइज़रः क्लाउड सोनट 4.7 (1M संदर्भ) त्वरित कैशिंग के साथ
- प्रतीक ग्राफः आयात और कॉल किनारों के लिए Neo4j (प्रबंधित) या kuzu (एम्बेड)
- अवलोकनशीलताः प्रति प्रतिधारण + संश्लेषण चरण में लैंगफ्यूज स्पैन्स

```figure
ce-hybrid-retrieval
```

## इसे बनाओ

1. **Ingestion walker.**प्रत्येक पुश हुक पर गिट इतिहास दोहराएं. बदल गई फ़ाइलों को इकट्ठा करें. प्रत्येक फ़ाइल के लिए, पेड़-सिटर, निष्कर्षण समारोह और वर्ग नोड्स के साथ उनके पूर्ण स्रोत अवधि के साथ विश्लेषण करें. टुकड़े रिकॉर्ड जारी करें`{repo, path, start_line, end_line, symbol, body}`. .

2. **Chunk summarizer.**Haiku 4.5 कॉल में बैच टुकड़े सिस्टम प्रीएम्ब्यूल पर त्वरित कैशिंग के साथ। प्रम्प्टः "इस फ़ंक्शन को एक वाक्य में सारांशित करें, इसके सार्वजनिक अनुबंध और दुष्प्रभावों का नाम दें।" टुकड़े के साथ सारांश स्टोर करें।

3. **Embedding pool.**दो समानांतर कतारें: घने (यात्रा-कोड-3 बैच 128) और सारांश (एक ही मॉडल, लेकिन सारांश स्ट्रिंग पर) ।`{repo, path, start_line, end_line, symbol, kind}`. .

4. **BM25 index.**क्षेत्र-वजनित टैंटिवी सूचकांकः प्रतीक नाम वजन 4, प्रतीक शरीर वजन 1, सारांश वजन 2. "एक्स नामित फ़ंक्शन खोजें" प्रश्नों के साथ "एक्स करने वाला फ़ंक्शन खोजें" सक्षम करता है।

5. **Symbol graph.**प्रत्येक टुकड़े के लिए, रिकॉर्ड किनारेः आयात (यह फ़ाइल रेपो से प्रतीक Y का उपयोग करती है), कॉल (यह फ़ंक्शन कक्षा C पर विधि M को कॉल करता है), विरासत। kuzu में स्टोर करें। रेपो सीमाओं के पार निकासी का विस्तार करने के लिए क्वेरी समय में उपयोग किया जाता है।

6. **Query agent.**तीन नोड्स के साथ लैंगग्राफ।`retrieve`घने आग + BM25 समानांतर, (रेपो, पथ, प्रतीक) द्वारा दोहराया। `rerank`शीर्ष 50 पर क्रॉस-एन्कोडर चलाता है और शीर्ष 10 रखता है।`synth`संदर्भ में पुनः रैंक टुकड़े के साथ क्लाउड सोनट 4.7 कॉल, सिस्टम प्रॉम्प्ट कैश, फ़ाइलःलाइन उद्धरण की आवश्यकता है।

7. **Citation enforcement.**मॉडल आउटपुट का विश्लेषण करें; बिना किसी दावे के `(repo/path:start-end)`एंकर को फिर से पूछने के लिए चिह्नित किया जाता है या छोड़ दिया जाता है। उपयोगकर्ता को केवल उद्धृत उत्तर लौटाएं।

8. **Incremental re-index.**प्रत्येक वेबहॉक पर, प्रतीक स्तर अंतर की गणना करें। केवल उन टुकड़ों को फिर से एम्बेड करें जिनके पाठ में बदलाव हुआ है। उन टुकड़ों के लिए प्रतीक किनारों को फिर से गणना करें जिनके आयात में बदलाव हुआ है। उपायः 2M-LOC बेड़े के लिए 60 सेकंड से कम समय में 50 फ़ाइल पुश फिर से अनुक्रमित करें।

9. **Eval.**100 क्रॉस-रिपो सवालों को गोल्ड फाइलःलाइन उत्तरों के साथ लेबल करें। MRR@10, nDCG@10, उद्धरण निष्ठा (सत्यापित एंकर के साथ दावों का अंश) और p50/p99 विलंबता मापें।

## इसका प्रयोग करें

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## इसे भेजें

उपलब्ध कौशल `outputs/skill-codebase-rag.md`. रिपो के एक कॉर्पस को देखते हुए, यह सेवन पाइपलाइन, हाइब्रिड सूचकांक और क्वेरी एजेंट को खड़ा करता है और किसी भी क्रॉस-रिपो प्रश्न के लिए उद्धृत उत्तर देता है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## व्यायाम

1. नाम-संलग्न-कोड के लिए Voyage-कोड-3 स्विच करें। स्वयं होस्ट किए गए MRR@10 डेल्टा मापें। रिपोर्ट करें कि क्या रिक्त स्थान को फिर से रैंकिंग सक्षम होने के साथ बंद किया जाता है।

2. 20% उत्पन्न कोड (एलएलएम निर्मित बॉयलरप्लेट) को कॉर्पस में इंजेक्ट करें और फिर से मूल्यांकन करें। पुनर्प्राप्ति विषाक्तता का निरीक्षण करें। उपयोगिता लोड में "जनित" ध्वज जोड़ें और उन हिट को कम करें।

3. बेंचमार्क Qdrant हाइब्रिड खोज बनाम pgvector + pgvectorscale आपके कॉर्पस आकार पर। रिपोर्ट p99 बैच आकार 1 पर।

4. एक नमूना-आधारित बहाव जांच जोड़ेंः साप्ताहिक, 100 प्रश्नों के मूल्यांकन को दोहराएं। MRR@10 पर चेतावनी 5% की गिरावट > 5%.

5. क्रॉस-भाषा प्रतीक संकल्प तक विस्तारः एक पायथन फ़ंक्शन जो gRPC पर एक गो सेवा को कॉल करता है। उन्हें जोड़ने के लिए प्रतीक ग्राफ का उपयोग करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## आगे पढ़ना

- [Sourcegraph Amp](https://ampcode.com) उत्पादन क्रॉस-रेपो कोड खुफिया
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) इस टॉपस्टोन के लिए संदर्भ गहरे गोताखोरी
- [Aider repo-map](https://aider.chat/docs/repomap.html) पेड़-सिटर रैंक repo दृश्य
- [Augment Code enterprise graph](https://www.augmentcode.com) वाणिज्यिक प्रतीक-ग्राफ RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) संदर्भ कार्यान्वयन
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) यात्रा-कोड-3 विवरण
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) क्रॉस-कोडर संदर्भ
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) आंतरिक मंच संदर्भ
