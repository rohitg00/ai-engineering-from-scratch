# LLM Değerlendirmesi — RAGAS, DeepEval, G-Eval

> Tam eşleşme ve F1 anlamsal eşdeğerliği kaçırıyor. Gerçek kişi tarafından yapılan inceleme ölçeklenmez. Yargıç olarak Yüksek Lisans, üretim yanıtıdır - sayıya güvenmek için yeterli kalibrasyonla.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 13 (Soru Yanıtlama), Aşama 5 · 14 (Bilgi Erişimi)
**Süre:** ~75 dakika

## Sorun

RAG sisteminiz yanıt veriyor: "29 Haziran 2007."
Altın referans: "29 Haziran 2007."
Tam Maç puanları 0. F1 puanları ~%75. Bir insan %100 puan alır.

Şimdi 10.000 test durumuyla çarpın. Geri getirici, parçalama, prompt veya modelde yapılan her değişiklikle tekrar çarpın. Anlamı anlayan, ölçekte ucuza çalışan, regresyonlar konusunda yalan söylemeyen ve doğru hata modlarını ortaya çıkaran bir değerlendiriciye ihtiyacınız var.

2026'da bu soruna sahip üç framework var.

- **RAGAS.** Alma-Artırılmış Nesil Değerlendirmesi. NLI + LLM-yargıç arka uçlarına sahip dört RAG ölçümü (sadıklık, cevap alaka düzeyi, bağlam hassasiyeti, bağlam hatırlama). Araştırma destekli, hafif.
- **DeepEval.** LLM'ler için Pytest. G-Eval, görev tamamlama, halüsinasyon, önyargı ölçümleri. CI/CD-yerel.
- **G-Eval.** Bir yöntem (ve bir DeepEval metriği): Düşünce zinciri, özel kriterler, 0-1 puan ile hakem olarak Yüksek Lisans.

Üçü de yargıç olarak Yüksek Lisans'a güveniyor. Bu ders, yönteme ilişkin sezgiyi ve onun etrafındaki güven katmanını oluşturur.

## Konsept

![Dört değerlendirme boyutu, yargıç olarak yüksek lisans mimarisi](../assets/llm-evaluation.svg)

**Yargıç olarak Yüksek Lisans.** Statik bir ölçümü, bir değerlendirme tablosu verilen çıktıları puanlayan bir Yüksek Lisans ile değiştirin. Yüksek Lisans Hakimi `(query, context, answer)`, prompt'ya verildiğinde: "Sadakat konusunda 0-1 puan verin." Skoru geri ver.

Neden işe yarıyor: Yüksek Lisans'lar, maliyetin çok küçük bir kısmıyla insan muhakemesine yaklaşır. GPT-4o-mini ~$0.003 per scored case enables 1000-sample regression eval runs for under $5'te.

Neden sessizce başarısız oluyor:

1. **Yargıç önyargısı.** Jüri daha uzun yanıtları, kendi model ailesinden gelen yanıtları, prompt tarzıyla eşleşen yanıtları tercih eder.
2. **JSON ayrıştırma hataları.** Kötü JSON → NaN puanı → sessizce toplamdan çıkarıldı. RAGAS kullanıcıları bu acıyı biliyor. Try/hariç + açık hata modlu kapı.
3. **Model versiyonları üzerinde değişiklik.** Hakemin yükseltilmesi her ölçümü değiştirir. Yargıç modeli + versiyonunu dondurun.

**RAG dörtlü.**

| Metrik | Soru | Arka uç |
|--------|----------|---------|
| Sadakat | Cevaptaki her iddia, alınan bağlamdan mı geliyor? | NLI tabanlı zorunluluk |
| Cevap alaka düzeyi | Cevap soruyu ele alıyor mu? | Cevaplardan varsayımsal sorular oluşturun; gerçek soruyla karşılaştırın |
| Bağlam hassasiyeti | Alınan parçaların hangi kısmı alakalıydı? | Yüksek Lisans Hakimi |
| Bağlam hatırlama | Geri alma gereken her şeyi geri getirdi mi? | Yüksek Lisans-altın cevabına karşı yargıç |

**G-Eval.** Özel bir kriter tanımlayın: "Cevapta doğru kaynak belirtildi mi?" framework, düşünce zinciri değerlendirme adımlarına otomatik olarak genişler ve ardından 0-1 puan alır. RAGAS'ın kapsamadığı alana özgü kalite boyutları için iyidir.

**Kalibrasyon.** İnsan etiketleriyle bir korelasyon elde edene kadar asla ham hakem puanına güvenmeyin. Elle etiketlenmiş 100 örneği çalıştırın. Yargıç vs insan konusu. Spearman rho'yu hesaplayın. Rho < 0,7 ise değerlendirme değerlendirme listenizin üzerinde çalışılması gerekir.

## İnşa Et

### Adım 1: NLI'ye bağlılık (RAGAS tarzı)

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

Cevabı atomik iddialara ayırın. Her talebi, alınan bağlama göre NLI-kontrol edin. Sadakat = desteklenen kesir.

### 2. Adım: yanıtın alaka düzeyi

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

Cevap sorulandan farklı soruları ima ediyorsa alaka düzeyi düşer.

### 3. Adım: G-Eval özel metriği

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

Değerlendirme adımları değerlendirme tablosudur. Açık adımlar, örtülü "0-1 puan" prompt'lardan daha kararlıdır.

### Adım 4: CI kapısı

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

Bir pytest dosyası olarak gönderin. Her PR'da çalıştırın. Regresyonlarda birleştirmeleri engelle.

### Adım 5: oyuncağın sıfırdan değerlendirilmesi

Bkz. `code/main.py`. Aslına uygunluk (cevap iddialarının bağlamla örtüşmesi) ve alaka düzeyi (cevap token'ların soru token'lerle örtüşmesi) için yalnızca Stdlib'e yönelik yaklaşımlar. Üretim değil. Şekli gösterir.

## Tuzaklar

- **Kalibrasyon yok.** İnsan etiketleriyle 0,3 korelasyona sahip bir yargıç gürültüdür. Sevkiyattan önce bir kalibrasyon çalışması yapılmasını zorunlu kılın.
- **Öz değerlendirme.** Oluşturmak ve yargılamak için aynı LLM'yi kullanmak, puanları %10-20 oranında artırır. Hakim için farklı bir model ailesi kullanın.
- **İkili değerlendirmede konumsal önyargı.** Yargıçlar sunulan ilk seçeneği tercih eder. Her zaman sıralamayı rastgele yapın ve her ikisini de çalıştırın.
- **Ham toplam, arızaları gizler.** Ortalama puan 0,85 genellikle %5'lik yıkıcı arızaları gizler. Her zaman alt kantilini inceleyin.
- **Altın dataset çürük.** Zaman içinde sürüklenen, sürümlenmemiş değerlendirme kümeleri boylamsal karşılaştırmayı bozar. Her değişiklikte dataset'yi etiketleyin.
- **LLM maliyeti.** Büyük ölçekte, hakim çağrıları maliyete hakimdir. Kalibrasyon eşiğini karşılayan en ucuz modeli kullanın. GPT-4o-mini, Claude Haiku, Mistral-küçük.

## Kullan onu

2026 yığını:

| Kullanım örneği | Framework |
|---------|-----------|
| RAG kalite izleme | RAGAS (4 metrik) |
| CI/CD regresyon kapıları | DeepEval + pytest |
| Özel alan adı kriterleri | DeepEval bünyesinde G-Eval |
| Çevrimiçi canlı trafik izleme | Referanssız modlu RAGAS |
| Döngüdeki insan anlık kontrolleri | Ek açıklama kullanıcı arayüzüne sahip LangSmith veya Phoenix |
| Kırmızı takım / güvenlik değerlendirmesi | Promptfoo + DeepEval |

Tipik yığın: İzleme için RAGAS, CI için DeepEval, yeni boyutlar için G-Eval. Üçünü de çalıştırın; yararlı bir şekilde aynı fikirde değiller.

## Gönderin

`outputs/skill-eval-architect.md` olarak kaydet:

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

1. **Kolay.** Bilinen halüsinasyonları olan 10 RAG örneğinde RAGAS'ı kullanın. Sadakat ölçüsünün her birini yakaladığını doğrulayın.
2. **Orta.** El etiketi 50 QA, doğruluk açısından 0-1 arası yanıtlar verir. G-Eval ile puanlayın. Yargıç ve insan arasındaki Spearman rho'yu ölçün.
3. **Zor.** DeepEval ile bir pytest CI kapısı oluşturun. Geri çağırıcıyı kasıtlı olarak gerileyin. Geçidin başarısız olduğunu doğrulayın. En düşük %10'luk eşik kontrolü yoluyla alt yüzdelik uyarı ekleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Hakim olarak Yüksek Lisans | Yüksek Lisans ile Puanlama | Prompt bir değerlendirme tablosu verildiğinde çıktıları 0-1 arasında puanlamak için bir değerlendirme modeli. |
| RAGAS | RAG metrik kütüphanesi | 4 referanssız RAG metriği içeren açık kaynaklı değerlendirme framework. |
| Sadakat | Cevap temelli mi? | Alınan bağlamın gerektirdiği yanıt taleplerinin oranı. |
| Bağlam hassasiyeti | Alınan parçalar alakalı mıydı? | Gerçekten önemli olan üst K parçalarının oranı. |
| Bağlam hatırlama | Arama her şeyi buldu mu? | Alınan parçalar tarafından desteklenen altın yanıt taleplerinin bir kısmı. |
| G-Eval | Özel Yüksek Lisans jürisi | Değerlendirme listesi + düşünce zinciri değerlendirme adımları + 0-1 puan. |
| Kalibrasyon | Güven ama doğrula | Hakem puanı ile insan puanı arasındaki Spearman korelasyonu. |

## Daha Fazla Okuma

- [Es ve ark. (2023). RAGAS: Alma Artırılmış Üretimin Otomatik Değerlendirmesi](https://arxiv.org/abs/2309.15217) — RAGAS makalesi.
- [Liu ve ark. (2023). G-Eval: Daha İyi İnsan Hizalaması ile GPT-4 kullanılarak NLG Değerlendirmesi](https://arxiv.org/abs/2303.16634) — G-Eval makalesi.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) — üretim yığınını aç.
- [Zheng ve ark. (2023). MT-Bench ve Chatbot Arena ile Yüksek Lisans Yüksek Lisansını Jüri Olarak Değerlendirmek](https://arxiv.org/abs/2306.05685) — önyargılar, kalibrasyon, sınırlar.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) — RAGAS, DeepEval, Phoenix'i entegre eden framework'yi birleştiriyor.
