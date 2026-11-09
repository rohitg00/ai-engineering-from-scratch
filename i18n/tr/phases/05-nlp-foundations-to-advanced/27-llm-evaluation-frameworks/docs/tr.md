# LLM Değerlendirme  RAGAS, DeepEval, G-Eval

> Tam eşleşme ve F1 semantik eşdeğerliği eksik. İnsan inceleme ölçeklenmez. LLM-as-judge, sayıya güvenmek için yeterli kalibrasyonla  üretim cevabıdır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## Sorun

RAG sisteminiz cevap veriyor: 29 Haziran 2007.
Altın referans: "29 Haziran 2007".
F1 skorları %75'e kadar.

Şimdi 10 bin test vaka ile çarpın. Geri alınan, parçalanmış, uyarılmış veya modeldeki her değişiklikle tekrar çarpın. Anlamı anlayan, ölçekte ucuz çalışan, geri dönüşler hakkında yalan söyleyen ve doğru başarısızlık modlarını ortaya çıkaran bir değerlendirmeciye ihtiyacınız var.

2026'da bu sorunun üç çerçevesine sahip.

- **RAGAS.**Arama-Keyitilmiş Nesil ASessment. NLI + LLM yargıç arka planları ile dört RAG ölçüsü (sadakat, cevap-ağayış, bağlam-düzgünlük, bağlam-içindirme) Araştırma dayalı, hafif.
- **DeepEval.**Yüksek lisans için test. G-Eval, görev tamamlama, halüsinasyon, önyargı ölçümleri. CI/CD-native.
- **G-Eval.**Bir yöntem (ve DeepEval ölçüsü): LLM-as-judge, fikir zinciri, özel kriterler, 0-1 puan.

Bu ders, yöntem ve çevresindeki güven katmanının içgüdülerini oluşturur.

## Anlaşım

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**Bir metrikin yerini bir rubrika verildiğinde sonuçları notlayan bir LLM ile değiştirin.`(query, context, answer)`Bir yargıçın, "Amanlık 0-1 puanı" diye sormasını rica ediyorum.

Neden işe yarıyor: LLM'ler, maliyetin küçük bir kısmına insan yargısını yakından değerlendirir.$0.003 per scored case enables 1000-sample regression eval runs for under $5.

Neden sessizce başarısız oluyor:

1. **Judge bias.**Yargıçlar daha uzun cevapları tercih ediyor, kendi model ailesinden cevaplar, hızlı stille uyumlu cevaplar.
2. **JSON parsing failures.**Kötü JSON → NaN puanı → sessizce toplama dışlanmıştır. RAGAS kullanıcıları bu ağrıyı bilirler.
3. **Drift over model versions.**Yargıç'ın yükseltilmesi her metrikte değişiklikler yapar.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**Özel bir kriter tanımlayın: "Çözüm doğru kaynağı belirtti mi?" Çerçeve otomatik olarak düşünce zinciri değerlendirme adımlarına genişleşiyor, sonra 0-1 puanlar.

**Calibration.**İnsan etiketleriyle ilişkili bir ilişki bulana kadar asla ham yargıç puanına güvenme. 100 el etiketli örnek çalıştır.

```figure
n5-judge-gauge
```

## Yapın

### Adım 1: NLI'ye sadakat (RAGAS tarzı)

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

Cevabı atom iddialarına ayırın. NLI, her iddiayı alınan bağlamla kontrol edin.

### Adım 2: Cevapların uygunluğu

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

Cevap sorulan sorudan farklı sorular içerirse, önem azalır.

### Adım 3: G-Eval özel metrik

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

Açık adımlar, içten "0-1 puan" isteklerinden daha istikrarlıdır.

### 4. Adım: CI kapısı

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

Her PR'yi çalıştırın, blok geri dönüşlerle birleşir.

### Adım 5: Oyuncak değerlendirme sıfırdan

Bakın .`code/main.py`. Sadece sadakat ( cevabın iddialarının bağlamla üst üste olması) ve önem ( cevabın simgelerinin soru simgelerinin üst üste olması) yaklaşımları.

## Tuzaklar

- **No calibration.**İnsan etiketlerine göre 0.3 oranı olan bir yargıç gürültüdür.
- **Self-evaluation.**Aynı LLM'yi kullanarak ve yargılamak için puanları 10-20% arttırır. Yargıç için farklı bir model ailesi kullanın.
- **Positional bias in pairwise judging.**Yargıçlar ilk seçeneği tercih ederler.
- **Raw aggregate hides failures.**Ortalama puan 0.85 genellikle% 5 felaketlik başarısızlıkları saklar.
- **Golden dataset rot.**Zamanla sürüklenen sürümlenmemiş değerleme kümeleri uzunluklı karşılaştırmayı kırar.
- **LLM cost.**Ölçüsünde, yargıçların belirlediği maliyetleri üstlenir.

## Kullan

2026'da:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

Tipik bir yığın: izleme için RAGAS, CI için DeepEval, yeni boyutlar için G-Eval.

## Gönder

- Kaydet .`outputs/skill-eval-architect.md`- ...

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

## Egzersizler

1. **Easy.**Bilinen halüsinasyonlarla 10 RAG örneğinde RAGAS kullanın.
2. **Medium.**50'li kaliteli bir cevap, doğruluk için 0-1'e, G-Eval ile puan, yargıç ve insan arasında Spearman rho ölçüsü.
3. **Hard.**DeepEval ile en kötü bir CI kapısı oluşturun. Retriever'i kasten geri çevirin. Kapının başarısız olduğunu kontrol edin. En düşük %10'da eşiğin kontrolü yoluyla alt kuantil uyarısını ekleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## Daha Fazla Okumak

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) RAGAS kağıdı.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634)G-Eval kağıdı.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) Açık üretim aşaması.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) tarafsızlıklar, kalibrasyon, sınırlar.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) RAGAS, DeepEval, Phoenix'i entegre eden birleşik çerçeve.
