# LLM मूल्यांकन  RAGAS, DeepEval, G-Eval

> सटीक मैच और F1 सेमींटिक समकक्षता को याद नहीं करते हैं। मानव समीक्षा पैमाने पर नहीं होती है। LLM-जैसे-जिज उत्पादन उत्तर है  संख्या पर भरोसा करने के लिए पर्याप्त माप के साथ।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## समस्या

आपका RAG प्रणाली जवाब देता हैः "29 जून, 2007".
सोने का संदर्भ हैः "29 जून, 2007"
सटीक मैच स्कोर 0. F1 स्कोर ~75%. एक इंसान 100% स्कोर करेगा।

अब 10,000 परीक्षण मामलों से गुणा करें। रिट्रीवर, चश्मा, प्रॉम्प्ट या मॉडल में हर बदलाव से फिर से गुणा करें। आपको एक मूल्यांकनकर्ता की आवश्यकता है जो अर्थ को समझता है, स्केल पर सस्ते में चलता है, प्रतिगमन के बारे में झूठ नहीं बोलता है, और सही विफलता मोड को उजागर करता है।

2026 में तीन ढांचे हैं जो इस समस्या का मालिक हैं।

- **RAGAS.**पुनर्प्राप्ति-उन्नत पीढ़ी के एएसएएसएस्सेमेंट। चार आरएजी मेट्रिक्स (निष्ठा, उत्तर-संदिग्धता, संदर्भ-सटीकता, संदर्भ-रिहॉल) एनएलआई + एलएलएम-जजज बैकेंड के साथ। अनुसंधान-समर्थित, हल्का।
- **DeepEval.**एमएलएस के लिए पायटेस्ट जी-ईवल, कार्य-पूर्णता, भ्रम, पूर्वाग्रह मेट्रिक्स. आईसी/सीडी-नेटिव।
- **G-Eval.**एक विधि (और एक डीपईवल मेट्रिक): विचार श्रृंखला के साथ LLM-जैसे-जजज, कस्टम मानदंड, 0-1 स्कोर।

यह सब विधि और उसके आसपास के विश्वास परत के लिए अंतर्दृष्टि का निर्माण करता है।

## अवधारणा

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**एक स्थैतिक मीट्रिक को LLM से बदलें जो किसी rubric को दिए गए आउटपुट को स्कोर करता है।`(query, context, answer)`, एक न्यायाधीश LLM के लिए पूछेंः "निष्ठा पर 0-1 स्कोर।" स्कोर वापस.

यह क्यों काम करता हैः एलएलएम मानव न्याय को लागत के एक छोटे से अंश पर अनुमानित करते हैं।$0.003 per scored case enables 1000-sample regression eval runs for under $5.

यह चुपचाप क्यों विफल रहता हैः

1. **Judge bias.**न्यायाधीशों को लंबे समय तक उत्तर पसंद हैं, अपने स्वयं के मॉडल परिवार से उत्तर, उत्तर जो शीघ्र शैली से मेल खाते हैं।
2. **JSON parsing failures.**खराब JSON → NaN स्कोर → चुपचाप संकलित से बाहर रखा गया। RAGAS उपयोगकर्ताओं को यह दर्द पता है। प्रयास / अपवाद + स्पष्ट विफलता मोड के साथ गेट।
3. **Drift over model versions.**न्यायाधीश को अपग्रेड करने से हर मीट्रिक बदल जाता है।

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**एक कस्टम मानदंड परिभाषित करेंः "क्या उत्तर सही स्रोत का हवाला देता है?" फ्रेमवर्क स्वचालित रूप से विचार श्रृंखला मूल्यांकन चरणों में विस्तारित होता है, फिर 0-1 स्कोर करता है। डोमेन-विशिष्ट गुणवत्ता आयामों के लिए अच्छा RAGAS कवर नहीं करता है।

**Calibration.**जब तक आप मानव लेबल के साथ एक सहसंबंध नहीं रखते तब तक कच्चे न्यायाधीश स्कोर पर कभी भरोसा न करें। 100 हाथ लेबल उदाहरण चलाएं। प्लॉट न्यायाधीश बनाम मानव। स्पीयरमैन rho की गणना करें। यदि rho < 0.7, तो आपके न्यायाधीश रूब्रिक को काम करने की आवश्यकता है।

```figure
n5-judge-gauge
```

## इसे बनाओ

### चरण 1: एनएलआई (RAGAS शैली) के साथ निष्ठा

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` is any callable: prompt str -> generated str.
# Example: llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""Break this answer into simple factual claims (one per line):
{answer}
"""
    return llm(prompt).splitlines()


def faithfulness(answer: str, context: str, llm: LLM) -> float:
    claims = atomic_claims(answer, llm)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        result = nli({"text": context, "text_pair": claim})[0]
        entail = next((s for s in result if s["label"] == "entailment"), None)
        if entail and entail["score"] > 0.5:
            supported += 1
    return supported / len(claims)
```

उत्तर को परमाणु दावों में तोड़ दें। एनएलआई प्रत्येक दावों को प्राप्त संदर्भ के साथ जांचें। निष्ठा = अंश समर्थित।

### चरण 2: उत्तर प्रासंगिकता

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: any model implementing .encode(texts, normalize_embeddings=True) -> ndarray
# e.g., encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"Write {n} questions this answer could be the answer to:\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

यदि उत्तर में पूछे गए प्रश्न से भिन्न प्रश्न हैं, तो प्रासंगिकता कम होती है।

### चरण 3: G-Eval कस्टम मीट्रिक

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="Correctness",
    criteria="The answer should be factually accurate and match the expected output.",
    evaluation_steps=[
        "Read the expected output.",
        "Read the actual output.",
        "List factual claims in the actual output.",
        "For each claim, mark supported or unsupported by the expected output.",
        "Return score = fraction supported.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="When was the first iPhone released?",
                   actual_output="June 29th, 2007.",
                   expected_output="June 29, 2007.")
metric.measure(test)
print(metric.score, metric.reason)
```

मूल्यांकन चरणों को rubric हैं. स्पष्ट चरणों को स्पष्ट "स्कोर 0-1" संकेतों की तुलना में अधिक स्थिर हैं।

### चरण 4: आईसी गेट

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"faithfulness regression on {case.id}"
        rel.measure(case)
        assert rel.score >= 0.7, f"relevancy regression on {case.id}"
```

एक पिटेस्ट फ़ाइल के रूप में जहाज, हर पीआर पर चलाओ. ब्लॉक regressions पर विलय.

### चरण 5: खरोंच से खिलौना मूल्यांकन

देखो`code/main.py`. केवल निष्ठा (संदर्भ के साथ उत्तर दावों के ओवरलैप) और प्रासंगिकता (संदर्भ टोकन के साथ उत्तर टोकन के ओवरलैप) के अनुमान। उत्पादन नहीं। आकार दिखाता है।

## फंदे

- **No calibration.**मानव लेबल के साथ 0.3 संबद्धता के साथ एक न्यायाधीश शोर है. शिपिंग से पहले एक माप चलाने की आवश्यकता है.
- **Self-evaluation.**एक ही LLM का उपयोग करके और न्यायाधीश बनाने के लिए स्कोर 10-20% तक बढ़ जाता है। न्यायाधीश के लिए एक अलग मॉडल परिवार का उपयोग करें।
- **Positional bias in pairwise judging.**न्यायाधीश पहले विकल्प को पसंद करते हैं। हमेशा क्रम क्रमबद्ध करें और दोनों को चलाएं।
- **Raw aggregate hides failures.**औसत स्कोर 0.85 अक्सर 5% आपदा विफलताओं को छिपाता है। हमेशा नीचे क्वांटिल की जांच करें।
- **Golden dataset rot.**अनवर्स किए गए मूल्यांकन सेट जो समय के साथ बहते हैं, longitudinal comparison को तोड़ते हैं। प्रत्येक परिवर्तन के साथ डेटासेट को टैग करें।
- **LLM cost.**पैमाने पर, न्यायाधीशों को लागत पर हावी होने का फैसला किया गया है सबसे सस्ता मॉडल का उपयोग करें जो मापने की सीमा को पूरा करता है।

## इसका प्रयोग करें

2026 स्टैकः

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

सामान्य स्टैकः निगरानी के लिए RAGAS, IC के लिए डीपईवल, नए आयामों के लिए जी-ईवल। तीनों को चलाएं; वे उपयोगी रूप से असहमत हैं।

## इसे भेजें

`outputs/skill-eval-architect.md`:

```markdown
---
name: eval-architect
description: Design an LLM evaluation plan with calibrated judge and CI gates.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Given a use case (RAG / agent / generative task), output:

1. Metrics. Faithfulness / relevance / context-precision / context-recall + any custom G-Eval metrics with criteria.
2. Judge model. Named model + version, rationale for cost vs accuracy.
3. Calibration. Hand-labeled set size, target Spearman rho vs human > 0.7.
4. Dataset versioning. Tag strategy, change log, stratification.
5. CI gate. Thresholds per metric, regression-window logic, bottom-quantile alert.

Refuse to rely on a judge untested against ≥50 human-labeled examples. Refuse self-evaluation (same model generates + judges). Refuse aggregate-only reporting without bottom-10% surfacing. Flag any pipeline where judge upgrade lands without parallel baseline eval.
```

## व्यायाम

1. **Easy.**ज्ञात भ्रमों के साथ 10 RAG उदाहरणों पर RAGAS का उपयोग करें। प्रत्येक में सटीकता मीट्रिक पकड़ की जांच करें।
2. **Medium.**50 QA सही के लिए 0-1 के लिए जवाब देता है। G-Eval के साथ स्कोर. न्यायाधीश और मानव के बीच स्पीयरमैन rho मापने.
3. **Hard.**DeepEval के साथ एक सबसे बड़ा CI गेट बनाएं. जानबूझकर रिट्रीवर को वापस करें. गेट विफलता की पुष्टि करें. सबसे कम 10% पर सीमा की जांच के माध्यम से निचले क्वांटिल अलर्ट जोड़ें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## आगे पढ़ना

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) रगस पेपर।
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) G-Eval पेपर।
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) खुले उत्पादन स्टैक।
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) पूर्वाग्रह, माप, सीमाएं।
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) एक एकीकृत ढांचा जो RAGAS, DeepEval, Phoenix को एकीकृत करता है।
