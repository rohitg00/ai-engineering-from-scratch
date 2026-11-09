# Đánh giá LLM  RAGAS, DeepEval, G-Eval

> Sự phù hợp chính xác và F1 không có sự tương đương ngữ nghĩa. Phân tích của con người không có quy mô. LLM-as-judge là câu trả lời sản xuất  với đủ hiệu chuẩn để tin vào số.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## Vấn đề

Hệ thống RAG của bạn trả lời: "29 tháng 6 năm 2007".
Quý vị vàng là: "29 tháng 6 năm 2007".
Đúng Match điểm 0. F1 điểm ~75%. Một con người sẽ ghi 100%.

Bây giờ nhân bằng 10.000 trường hợp thử nghiệm. nhân lần lần nữa bằng mỗi thay đổi của máy thu hồi, chunking, prompt, hoặc mô hình. Bạn cần một nhà đánh giá hiểu ý nghĩa, chạy giá rẻ trên quy mô, không nói dối về sự lùi lại, và đưa ra các chế độ thất bại đúng.

2026 có ba khung có chủ quyền về vấn đề này.

- **RAGAS.**Phân tích: Phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân tích phân (tri (tri công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công công
- **DeepEval.**Phân tích cho LLM. G-Eval, hoàn thành nhiệm vụ, ảo giác, métrics thiên vị. CI / CD-native.
- **G-Eval.**Một phương pháp (và một métrics DeepEval): LLM như thẩm phán với chuỗi suy nghĩ, tiêu chí tùy chỉnh, điểm số 0-1.

Cả ba đều dựa vào LLM như một thẩm phán. Bài học này xây dựng trực giác cho phương pháp và lớp tin tưởng xung quanh nó.

## Khái niệm

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**Thay thế một số liệu tĩnh bằng một LLM ghi điểm kết quả cho một rubric.`(query, context, answer)`, yêu cầu một thẩm phán LLM: "Score 0-1 trên trung thành. " Vui lại điểm số.

Tại sao nó hoạt động: LLM ước tính phán đoán của con người với một phần nhỏ chi phí.$0.003 per scored case enables 1000-sample regression eval runs for under $5.

Tại sao nó thất bại lặng lẽ:

1. **Judge bias.**Các thẩm phán thích câu trả lời dài hơn, câu trả lời từ gia đình mẫu của họ, câu trả lời phù hợp với phong cách nhanh chóng.
2. **JSON parsing failures.**Điểm số JSON → NaN xấu → được loại trừ từ tổng hợp. Người dùng RAGAS biết nỗi đau này. Gate với try/except + mode lỗi rõ ràng.
3. **Drift over model versions.**Tăng cấp thẩm phán thay đổi mọi số liệu.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**Định nghĩa một tiêu chí tùy chỉnh: "Phản ứng đã trích dẫn nguồn chính xác không?" Khung tự động mở rộng thành các bước đánh giá chuỗi suy nghĩ, sau đó đạt điểm 0-1.

**Calibration.**Đừng bao giờ tin vào điểm số của thẩm phán thô cho đến khi bạn có mối tương quan với nhãn của con người. Đi 100 ví dụ được dán nhãn bằng tay. Thẩm phán âm mưu vs con người. Xét số rho của Spearman. Nếu rho < 0,7, rubric thẩm phán của bạn cần phải được làm việc.

```figure
n5-judge-gauge
```

## Hãy xây dựng nó

### Bước 1: trung thành với NLI (tương tự như RAGAS)

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

Phân tích câu trả lời thành các yêu cầu nguyên tử. NLI kiểm tra từng yêu cầu với bối cảnh được lấy lại.

### Bước 2: đáp ứng liên quan

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

Nếu câu trả lời có nghĩa là những câu hỏi khác với câu hỏi được hỏi, sự liên quan của nó sẽ giảm đi.

### Bước 3: G-Eval métric tùy chỉnh

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

Các bước đánh giá là rubric. Các bước rõ ràng ổn định hơn các lời nhắc ngầm "score 0-1".

### Bước 4: Cổng CI

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

Đưa theo dạng tập tin phytest, chạy theo mọi thông tin cộng sự, khối hợp nhất theo các sự lùi.

### Bước 5: đánh giá đồ chơi từ đầu

Nhìn xem`code/main.py`- Chỉ có các ước tính trung thực (sự chồng chéo của câu trả lời với ngữ cảnh) và liên quan (sự chồng chéo của mã số câu trả lời với mã số câu hỏi). Không sản xuất.

## Những bẫy

- **No calibration.**Một thẩm phán có tương quan 0,3 với nhãn của con người là tiếng ồn.
- **Self-evaluation.**Sử dụng cùng một LLM để tạo ra và phán xét làm tăng điểm số 10-20%. Sử dụng một gia đình mô hình khác cho thẩm phán.
- **Positional bias in pairwise judging.**Các thẩm phán thích lựa chọn đầu tiên được đưa ra.
- **Raw aggregate hides failures.**Điểm trung bình 0,85 thường che giấu 5% thất bại thảm khốc.
- **Golden dataset rot.**Các tập hợp đánh giá không được phiên bản mà lở theo thời gian phá vỡ so sánh dọc.
- **LLM cost.**Với quy mô, thẩm phán chỉ định chi phí thống trị sử dụng mô hình rẻ nhất đáp ứng ngưỡng hiệu chuẩn GPT-4o-mini, Claude Haiku, Mistral-small.

## Sử dụng nó

Số 2026:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

Dòng xếp hạng điển hình: RAGAS để giám sát, DeepEval cho CI, G-Eval cho kích thước mới.

## Chuyển nó

Cứ như `outputs/skill-eval-architect.md`- Có thể là:

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

## Các bài tập

1. **Easy.**Sử dụng RAGAS trên 10 ví dụ RAG với ảo giác được biết đến.
2. **Medium.**50 câu trả lời của câu hỏi bằng số 0-1 cho sự chính xác, điểm bằng G-Eval, đo số số của Spearman giữa thẩm phán và con người.
3. **Hard.**Xây dựng một cổng CI phiền phức nhất với DeepEval. cố tình quay lại máy tìm kiếm. Kiểm tra cổng thất bại. Thêm cảnh báo quantile dưới cùng thông qua kiểm tra ngưỡng ở mức thấp nhất 10%.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## Đọc thêm

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) báo cáo RAGAS.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) tờ G-Eval.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) mở sản xuất hàng đống.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) thiên vị, chuẩn, giới hạn.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) Khung kết hợp hợp các hệ thống RAGAS, DeepEval, Phoenix.
