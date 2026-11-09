# कैपस्टोन 04  बहुआयामी दस्तावेज़ QA (पहली दृष्टि PDF, तालिकाएं, चार्ट)

> 2026 के दस्तावेज़-QA सीमा OCR-तो-पाठ से दूर हो गया और दृष्टि-पहले देर से बातचीत की ओर। ColPali, ColQwen2.5 और ColQwen3-omni प्रत्येक पीडीएफ पृष्ठ को एक छवि के रूप में व्यवहार करते हैं, इसे बहु-वेक्टर देर से बातचीत के साथ एम्बेड करते हैं, और क्वेरी को सीधे पैचों में शामिल होने देते हैं। वित्तीय 10Ks, वैज्ञानिक पत्रों और हस्तलिखित नोटों पर यह पैटर्न OCR-पहले से बड़े मार्जिन से हराता है। 10 हजार पृष्ठों पर पाइपलाइन को अंत से अंत तक बनाएं और ओसीआर-तो-पाठ के खिलाफ साइड-बाय-साइड प्रकाशित करें।

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## समस्या

उद्यम पीडीएफ पर बैठते हैं जो ओसीआर पाइपलाइनों को तोड़ते हैंः घूर्णन तालिकाओं के साथ स्कैन किए गए 10K, समीकरणों से घने वैज्ञानिक पत्र, चार्ट जो केवल छवियों के रूप में अर्थपूर्ण होते हैं, हस्तलिखित टिप्पणी। इनको पहले पाठ के रूप में व्यवहार करने का मतलब है कि सिग्नल का आधा खोना। 2026 का उत्तर कच्चे पृष्ठों की छवियों पर देर से बातचीत बहु-वेक्टर पुनर्प्राप्ति है। कोलपाली (इल्लुइन टेक) ने इसे पेश किया; कोलक्यूवेन2.5 - v0.2 और कोलक्यूवेन3-ओम्नी ने सटीकता को बढ़ाया। ViDoRe v3 में, दृष्टि-पहले निकालने के स्कोर OCR-तो-पाठ से ऊपर सार्थक मार्जिन  और चार्ट, तालिकाओं और हस्तलिखित पर अंतर बड़ा होता है।

कॉम्प्रेशन स्टोरेज और लेटेन्सी है। एक ColQwen एम्बेडिंग प्रति पृष्ठ ~2048 पैच वेक्टर है, एक भी 1024-डिम वेक्टर नहीं। कच्चे भंडारण बेलन। DocPruner (2026) मापने योग्य सटीकता हानि के बिना 50% कटौती लाता है। आप 10k पृष्ठों का सूचकांक करेंगे, ViDoRe v3 nDCG@5, 2 से कम समय में उत्तर प्रदान करेंगे, और सीधे OCR-then-text बेसलाइन के साथ तुलना करेंगे।

## अवधारणा

देर से बातचीत का मतलब है कि प्रत्येक क्वेरी टोकन प्रत्येक पैच टोकन के खिलाफ स्कोर करता है, और प्रति क्वेरी टोकन अधिकतम स्कोर योगित होता है। आपको एक भी pooled वेक्टर की आवश्यकता के बिना बारीक-बीज वाली मिलान मिलती है। एक बहु-वेक्टर सूचकांक (वेस्पा, क्यूड्रेंट मल्टी-वेक्टर, या एस्ट्राडीबी) प्रति पैच एम्बेडिंग को संग्रहीत करता है और पुनर्प्राप्ति के समय मैक्ससिम चलाता है।

उत्तरदाता एक दृष्टि-भाषा मॉडल है जो क्वेरी प्लस शीर्ष-के प्राप्त पृष्ठों को छवियों के रूप में लेता है और सबूत क्षेत्रों (सीमांकन बक्से या पृष्ठ संदर्भ) के साथ एक उत्तर लिखता है। Qwen3-VL-30B, Gemini 2.5 Pro, और InternVL3 2026 सीमा विकल्प हैं। समीकरणों और वैज्ञानिक संकेतन के लिए, एक OCR fallback (Nougat, dots.ocr) एक वैकल्पिक पाठ चैनल के रूप में सम्मिलित किया जाता है।

मूल्यांकन एक दो आयामी मैट्रिक्स है। एक अक्षः सामग्री प्रकार (सादे पाठ पैराग्राफ, घने तालिकाएं, बार / लाइन चार्ट, हस्तलिखित नोट्स, समीकरण) । अन्य अक्षः पुनर्प्राप्ति दृष्टिकोण (दृश्य-पहला देर से बातचीत बनाम ओसीआर-तो-पाठ बनाम हाइब्रिड) । प्रत्येक सेल को nDCG@5 और उत्तर सटीकता मिलती है। रिपोर्ट डिलीवर है।

## वास्तुकला

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## स्टैक

- पृष्ठ रेंडरिंगः PyMuPDF (fitz) 180 DPI पर, पोर्ट्रेट-नॉर्मलाइज्ड
- देर से बातचीत का मॉडल: ColQwen2.5-v0.2 या ColQwen3-omni (Hugging Face पर विडोर टीम)
- सूचकांकः बहु-वेक्टर क्षेत्र के साथ वेस्पा, या बहु-वेक्टर Qdrant, या MaxSim के साथ AstraDB
- कटाईः DocPruner 2026 नीति (उच्च-विभिन्नता पैच बनाए रखें, 50% संपीड़न < 0.5% सटीकता हानि)
- OCR fallback (समरूपताएँ / घने तालिकाएँ): dots.ocr या Nougat
- VLM उत्तरदाता: Qwen3-VL-30B स्वयं होस्ट या Gemini 2.5 Pro होस्ट; InternVL3 बैकअप के रूप में
- मूल्यांकनः ViDoRe v3 बेंचमार्क, बहु-पृष्ठ तर्क के लिए M3DocVQA
- दर्शक UI: Next.js 15 सबूत क्षेत्रों के लिए कैनवास ओवरले के साथ

```figure
ce-late-interaction
```

## इसे बनाओ

1. **Ingest.**10K के माध्यम से 10K पीडीएफ पृष्ठों, वैज्ञानिक पत्रों और स्कैन किए गए दस्तावेजों के एक कॉर्पस के माध्यम से चलें। प्रत्येक पृष्ठ को 1536x2048 PNG में प्रस्तुत करें। दृढ़ रहें `{doc_id, page_num, image_path}`. .

2. **Embed.**प्रत्येक पृष्ठ छवि पर ColQwen2.5-v0.2 चलाएं। आउटपुट आकार ~2048 dim 128 के पैच एम्बेडेड। उच्चतम सिग्नल आधा रखने के लिए DocPruner लागू करें। वेस्पा बहु-वेक्टर क्षेत्र या Qdrant बहु-वेक्टर पर लिखें।

3. **Query.**प्रत्येक आने वाले क्वेरी के लिए क्वेरी टावर (टोकन-स्तर के एम्बेडेड) के साथ एम्बेड करें। सूचकांक के खिलाफ मैक्ससिम चलाएंः प्रत्येक क्वेरी टोकन के लिए, पृष्ठ पैच एम्बेडेड पर अधिकतम डॉट-प्रोडक्ट लें, योग। शीर्ष-के पृष्ठों को लौटाएं।

4. **Synthesize.**प्रश्न और शीर्ष 5 पृष्ठों की छवियों के साथ Qwen3-VL-30B को कॉल करें। प्रम्प्टः "केवल प्रदान किए गए पृष्ठों का उपयोग करके उत्तर दें। प्रत्येक दावे को (doc_id, पृष्ठ) द्वारा उद्धृत करें और क्षेत्र (चित्र, तालिका, पैराग्राफ) का नाम दें।"

5. **Evidence regions.**उद्धृत क्षेत्रों को निकालने के लिए उत्तर पोस्ट-प्रोसेस करें। यदि VLM सीमांकन बक्से (Qwen3-VL करता है) जारी करता है, तो उन्हें दर्शक में ओवरलैप के रूप में प्रस्तुत करें।

6. **OCR fallback.**समीकरण घने (छवि भिन्नता पर हेरिस्टिक) के रूप में पहचाने गए पृष्ठों के लिए, Nougat या dots.ocr चलाएं और छवि के साथ अतिरिक्त चैनल के रूप में OCR पाठ पारित करें।

7. **Eval.**ViDoRe v3 (पुनर्प्राप्त nDCG@5) और M3DocVQA (बहु-पृष्ठ QA सटीकता) चलाएं। उसी संश्लेषक के साथ एक ही कॉर्पस पर OCR-then-text पाइपलाइन भी चलाएं। एक सामग्री-प्रकार × दृष्टिकोण मैट्रिक्स उत्पन्न करें।

8. **UI.**स्ट्रीमलाइट प्रोटोटाइप पहले; पृष्ठ-दर-पृष्ठ सबूत-क्षेत्र ओवरले के साथ Next.js 15 उत्पादन दर्शक।

## इसका प्रयोग करें

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## इसे भेजें

`outputs/skill-doc-qa.md`डिलीवरी का वर्णन करता हैः एक विशिष्ट कॉर्पस के लिए ट्यून किया गया दृष्टि-पहले मल्टीमोडल दस्तावेज़ QA प्रणाली और ViDoRe v3 पर OCR-then-text बेसलाइन के साथ मूल्यांकन किया गया।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## व्यायाम

1. एक ही कॉर्पस पर ColQwen2.5-v0.2 बनाम ColQwen3-omni मापें. कौन से पृष्ठ सही होते हैं और दूसरे को याद करते हैं? टाइप द्वारा मार्ग के लिए सूचकांक में "सामग्री वर्ग" टैग जोड़ें।

2. आक्रामक रूप से सिरे से (75%, 90%) छाँटें। संपीड़न चट्टान खोजेंः वह बिंदु जहां ViDoRe nDCG@5 ओसीआर मूल रेखा से नीचे गिरता है।

3. एक हाइब्रिड बनाएं: ओसीआर-तो-पाठ और कोलक्वेन को समानांतर में चलाएं, आरआरएफ के साथ फ्यूज करें, क्रॉस-एन्कोडर के साथ रैंक करें। क्या हाइब्रिड अकेले किसी को भी हराता है? यह सबसे ज्यादा मदद करता है?

4. Qwen2-VL-30B को छोटे VLM (Qwen2.5-VL-7B) के लिए बदलें। डॉलर प्रति सटीकता वक्र मापें।

5. हाथ से लिखे नोट समर्थन जोड़ें। हाथ से लिखे कॉर्पस को प्रस्तुत करें, ColQwen के साथ एम्बेड करें, माप निकासी करें। एक हाथ से लिखे ओसीआर पाइपलाइन के साथ तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## आगे पढ़ना

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) संदर्भ देर से बातचीत डॉक्यूमेंट रिकवरी
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) मौलिक पद्धति पत्र
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) उत्पादन के लिए तैयार चेकपोस्ट
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) बहु-पृष्ठ बहु-मॉडल आरएजी बेसलाइन
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) संदर्भ सेवा स्टैक
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) वैकल्पिक सूचकांक
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) वैकल्पिक प्रबंधित सूचकांक
- [Nougat OCR](https://github.com/facebookresearch/nougat) समीकरण के योग्य ओसीआर गिरावट
