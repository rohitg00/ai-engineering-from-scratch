# पाठ संक्षेप

> निष्कर्षण प्रणाली आपको बताती है कि दस्तावेज क्या कहता है, अमूर्त प्रणाली आपको बताती है कि लेखक का क्या मतलब था, अलग-अलग कार्य, अलग-अलग जाल।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## समस्या

एक 2,000 शब्द का समाचार लेख आपके फीड में आता है। आपको 120 शब्दों की आवश्यकता है जो इसे कैप्चर करते हैं। आप या तो लेख से तीन सबसे महत्वपूर्ण वाक्य चुन सकते हैं (अवशिष्ट) या सामग्री को अपने शब्दों में फिर से लिख सकते हैं (मूर्त) । दोनों को सारांश कहा जाता है। वे पूरी तरह से अलग समस्याएं हैं।

निष्कर्षण सारांश एक रैंकिंग समस्या है. प्रत्येक वाक्य को स्कोर, शीर्ष वापस`k`. आउटपुट हमेशा व्याकरणिक होता है क्योंकि इसे शाब्दिक रूप से उठाया जाता है. लेख में वितरित सामग्री की कमी का खतरा है।

अमूर्त सारांशकरण एक पीढ़ी की समस्या है। एक ट्रांसफार्मर इनपुट पर स्थित नया पाठ उत्पन्न करता है। आउटपुट धाराप्रवाह और संपीड़ित है लेकिन स्रोत में नहीं थे कि तथ्यों को भंग कर सकते हैं। जोखिम आत्मविश्वास का निर्माण है।

यह सबक दोनों का निर्माण करता है, जिसमें प्रत्येक के पास असफलता मोड है।

## अवधारणा

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**लेख को एक ग्राफ के रूप में देखें जहां नोड्स वाक्य हैं और किनारे समानताएं हैं। ग्राफ पर पेजरैंक (या कुछ ऐसा) चलाएं ताकि वे सभी अन्य चीजों से कितने जुड़े हैं, इसके आधार पर वाक्य स्कोर करें। उच्चतम स्कोर करने वाले वाक्य सारांश हैं। कैनोनिक कार्यान्वयन है **TextRank**(मिहलसीआ और ताराऊ, 2004) ।

**Abstractive.**दस्तावेज़-सारांश जोड़े पर एक ट्रांसफार्मर एन्कोडर-डेकोडर (BART, T5, Pegasus) को ठीक से ट्यून करें। निष्कर्ष पर, मॉडल दस्तावेज़ को पढ़ता है और क्रॉस-अटेंशन के माध्यम से सारांश टोकन-टू-टोकन उत्पन्न करता है। पेगासस विशेष रूप से एक अंतराल वाक्य पूर्व प्रशिक्षण उद्देश्य का उपयोग करता है जो इसे बहुत अधिक ठीक से ट्यून किए बिना सारांशित करने में उत्कृष्ट बनाता है।

 के साथ मूल्यांकन**ROUGE**(रिमॉल-ओरिएंटेड अंडरस्टडी फॉर गिस्टिंग एवैल्यूएशन) ROUGE-1 और ROUGE-2 स्कोर यूनिकग्राम और बिगग्राम ओवरलैप करते हैं। ROUGE-L सबसे लंबे सामान्य अनुक्रम का स्कोर करता है। उच्चतर बेहतर है लेकिन 40 ROUGE-L "अच्छा" है और 50 "असाधारण" है। प्रत्येक पेपर में तीनों की रिपोर्ट होती है। `rouge-score`पैकेज।

```figure
summarize-collapse
```

## इसे बनाओ

### चरण 1: पाठरंक (अवशिष्ट)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

दो चीजें नाम देने लायक हैं। समानता फ़ंक्शन लॉग-नर्मलाइज़ेड वर्ड ओवरलैप का उपयोग करती है, जो मूल टेक्स्ट रैंक संस्करण है। TF-IDF वेक्टरों का कॉसीन भी काम करता है। दम्पिंग कारक 0.85 और पुनरावृत्ति संख्या पेज रैंक डिफ़ॉल्ट हैं।

### चरण 2: BART के साथ अमूर्त

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-big-CNN CNN/DailyMail corpus पर ठीक से ट्यून किया गया है। यह बॉक्स से बाहर समाचार शैली के सारांश उत्पन्न करता है। अन्य डोमेन (वैज्ञानिक पत्र, संवाद, कानूनी) के लिए, संबंधित पेगासस चेकपोस्ट का उपयोग करें या अपने लक्ष्य डेटा पर ठीक से ट्यून करें।

### चरण 3: ROUGE मूल्यांकन

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

बिना इसके, "running" और "run" अलग-अलग शब्दों के रूप में गिनती करते हैं और ROUGE कम गिनती करता है।

### ROUGE से परे (2026 संक्षेप मूल्यांकन)

ROUGE बीस वर्षों से प्रमुख संक्षेप मेट्रिक रहा है और यह 2026 में अकेले पर्याप्त नहीं है। एनएलजी पेपरों के एक बड़े पैमाने पर मेटा-विश्लेषण ने दिखायाः

- **BERTScore**(सापेक्ष रूप से सम्मिलित समानता) ने 2023 तक आधार प्राप्त किया और अब अधिकांश सारांश पत्रों में ROUGE के साथ रिपोर्ट किया गया है।
- **BARTScore**मूल्यांकन को पीढ़ी के रूप में व्यवहार करता हैः संक्षेप को पूर्व प्रशिक्षित BART द्वारा स्रोत को देखते हुए इसे कितनी संभावना से असाइन किया जाता है।
- **MoverScore**(परमार्थ आंदोलन के अंतराल संदर्भ एम्बेडेड) 2025 के संक्षेप बेंचमार्क में शीर्ष स्थान पर पहुंच गया क्योंकि यह ROUGE की तुलना में बेहतर अर्थिक ओवरलैप को कैप्चर करता है।
- **FactCC**और **QA-based faithfulness**2021-2023 में आम थे, अब अक्सर **G-Eval**(जीपीटी-4 प्रम्प्ट चेन जो विचार श्रृंखला तर्क के साथ सहानुभूति, सुसंगतता, धाराप्रवाहता, प्रासंगिकता का स्कोर करता है) ।
- **G-Eval**और इसी तरह के LLM-जज दृष्टिकोण मानव न्याय ~ 80% समय के साथ मेल खाते हैं जब rubrics अच्छी तरह से डिजाइन कर रहे हैं।

उत्पादन सिफारिशः विरासत तुलना के लिए ROUGE-L रिपोर्ट, अर्थिक ओवरलैप के लिए BERTScore, सुसंगतता और तथ्यात्मकता के लिए G-Eval रिपोर्ट। मानव लेबल वाले 50-100 संक्षेप के अनुसार मापें।

### चरण 4: तथ्यात्मकता समस्या

अमूर्त सारांश हाल्यूसिनैशन के लिए प्रवण होते हैं। निष्कर्षण सारांश में हाल्यूसिनैशन का जोखिम बहुत कम होता है क्योंकि आउटपुट स्रोत से शाब्दिक रूप से हटा दिया जाता है, हालांकि वे अभी भी गुमराह कर सकते हैं यदि स्रोत वाक्य विसंगति, अप्रचलित या अनुक्रम से बाहर उद्धृत किए जाते हैं। यह एकमात्र सबसे बड़ा कारण है उत्पादन प्रणालियों अभी भी अनुपालन-समीप सामग्री के लिए निष्कर्षण विधियों को पसंद करते हैं।

नामकरण के लिए प्यास के प्रकारः

- **Entity swap.**स्रोत "जॉन स्मिथ" कहता है. संक्षेप में "जॉन ब्राउन" कहता है.
- **Number drift.**स्रोत कहता है "25,000. " संक्षेप कहता है "25 मिलियन. "
- **Polarity flip.**स्रोत कहता है "प्रस्ताव अस्वीकार कर दिया।" संक्षेप में कहता है "प्रस्ताव स्वीकार किया।"
- **Fact invention.**स्रोत ने सीईओ का उल्लेख नहीं किया है. संक्षेप में कहा गया है कि सीईओ ने मंजूरी दी है।

मूल्यांकन कार्य के दृष्टिकोणः

- **FactCC.**स्रोत वाक्य और संक्षेप वाक्य के बीच संबंध पर प्रशिक्षित एक द्विआधारी वर्गीकरण। तथ्यात्मक/असत्यवादी भविष्यवाणी करता है।
- **QA-based factuality.**QA मॉडल से ऐसे प्रश्न पूछें जिनका उत्तर स्रोत में है। यदि सारांश विभिन्न उत्तरों का समर्थन करता है, तो चिह्नित करें।
- **Entity-level F1.**स्रोत में नामित संस्थाओं की तुलना संक्षेप में करें. संक्षेप में केवल मौजूद संस्थाएं संदिग्ध हैं।

किसी भी उपयोगकर्ता-उपयोगी वस्तु के लिए जहां तथ्य महत्व है (समाचार, चिकित्सा, कानूनी, वित्तीय), निष्कर्षण सबसे सुरक्षित डिफ़ॉल्ट है। अमूर्त वस्तुओं की लूप में तथ्य की जांच की आवश्यकता होती है।

## इसका प्रयोग करें

2026 स्टैकः

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

लंबे संदर्भ वाले एलएलएम अक्सर 2026 में विशेष मॉडल से बेहतर होते हैं जब गणना कोई बाधा नहीं होती है। समझौता लागत और पुनरुत्पादनशीलता है; विशेष मॉडल अधिक सुसंगत आउटपुट देते हैं।

## इसे भेजें

`outputs/skill-summary-picker.md`:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## व्यायाम

1. **Easy.**5 समाचार लेखों पर टेक्स्ट रैंक चलाएं। शीर्ष 3 वाक्यों की तुलना एक संदर्भ सारांश के साथ करें। ROUGE-L मापें। आपको CNN/DailyMail शैली के लेखों पर 30-45 ROUGE-L देखना चाहिए।
2. **Medium.**इकाई स्तर की तथ्यात्मकता को लागू करेंः स्रोत और सारांश (स्पासाइ) से नामित संस्थाओं का निकासी, सारांश में स्रोत संस्थाओं की गणना और स्रोत के खिलाफ सारांश संस्थाओं की सटीकता। उच्च सटीकता और कम याद का मतलब सुरक्षित लेकिन संक्षिप्त है; कम सटीकता का मतलब है कि भ्रामक संस्थाएं।
3. **Hard.**50 सीएनएन/डेलीमेल लेखों पर एलएलएम (क्लाउड या जीपीटी-4) के साथ बर्ट-बड़ा सीएनएन की तुलना करें। रिपोर्ट ROUGE-L, तथ्यों (संस्था F1) द्वारा, और प्रति सारांश लागत। दस्तावेज जहां प्रत्येक जीतता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## आगे पढ़ना

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) निष्कर्षण संबंधी कैनोनिक पेपर।
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) BART पेपर।
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) पेगासस और अंतराल वाक्य लक्ष्य।
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) लाल कागज।
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) तथ्य के परिदृश्य पत्र।
