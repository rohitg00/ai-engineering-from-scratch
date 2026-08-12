# Оценивание LLM — RAGAS, DeepEval, G-Eval

> Метрика точного совпадения (Exact Match) и F1 упускают семантическую эквивалентность. Ручная проверка не масштабируется. LLM-судья (LLM-as-judge) — продакшен-ответ на эту проблему, при условии достаточной калибровки, чтобы доверять числу.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Этап 5 · 13 («Ответы на вопросы»), этап 5 · 14 («Информационный поиск»)
**Время:** ~75 минут

## Проблема

Ваша RAG-система отвечает: «29 июня 2007-го».
Эталонный ответ: «29 июня 2007 года».
Точное совпадение даёт 0. F1 даёт ~75%. Человек поставил бы 100%.

Теперь умножьте это на 10 000 тестовых примеров. Умножьте ещё раз на каждое изменение ретривера, разбиения на фрагменты, промпта или модели. Вам нужен оценщик, который понимает смысл, работает дёшево в масштабе, не врёт о регрессиях и выявляет нужные режимы сбоя.

В 2026 году эту проблему решают три фреймворка.

- **RAGAS.** Retrieval-Augmented Generation ASsessment. Четыре метрики RAG (достоверность, релевантность ответа, точность контекста, полнота контекста) с бэкендами NLI + LLM-судья. Обоснован исследованиями, лёгкий.
- **DeepEval.** Pytest для LLM. G-Eval, метрики завершения задачи, галлюцинаций, смещения. Нативен для CI/CD.
- **G-Eval.** Метод (и метрика в DeepEval): LLM-судья с цепочкой рассуждений, кастомными критериями, оценкой 0-1.

Все три опираются на LLM-судью. Этот урок формирует интуицию для метода и слоя доверия вокруг него.

## Концепция

![Четыре измерения оценивания и архитектура с LLM-судьёй](../assets/llm-evaluation.svg)

**LLM-судья (LLM-as-judge).** Замена статической метрики на LLM, которая оценивает выходы по заданной рубрике. Дано `(query, context, answer)`, промпт для LLM-судьи: «Оцени от 0 до 1 достоверность». Верните оценку.

Почему это работает: LLM аппроксимируют человеческое суждение за малую долю стоимости. GPT-4o-mini примерно за \$0,003 за оценённый случай позволяет запускать регрессионные оценки на 1000 примерах менее чем за \$5.

Почему это молча не срабатывает:

1. **Смещение судьи.** Судьи предпочитают более длинные ответы, ответы от той же модели-семейства, ответы, соответствующие стилю промпта.
2. **Ошибки парсинга JSON.** Плохой JSON → оценка NaN → молча исключается из агрегата. Пользователи RAGAS знают эту боль. Защищайтесь try/except + явным режимом сбоя.
3. **Дрейф между версиями модели.** Обновление судьи меняет каждую метрику. Зафиксируйте модель-судью + версию.

**Четвёрка RAG.**

| Метрика | Вопрос | Бэкенд |
|--------|----------|---------|
| Достоверность (Faithfulness) | Каждое утверждение в ответе взято из полученного контекста? | Логическое следование на основе NLI |
| Релевантность ответа (Answer relevance) | Отвечает ли ответ на вопрос? | Генерация гипотетических вопросов из ответа; сравнение с реальным вопросом |
| Точность контекста (Context precision) | Какая доля полученных фрагментов была релевантной? | LLM-судья |
| Полнота контекста (Context recall) | Вернул ли поиск всё необходимое? | LLM-судья относительно эталонного ответа |

**G-Eval.** Определите кастомный критерий: «Процитировал ли ответ правильный источник?» Фреймворк автоматически разворачивает его в шаги оценки по цепочке рассуждений, затем оценивает от 0 до 1. Хорошо подходит для доменно-специфичных измерений качества, которые не покрывает RAGAS.

**Калибровка.** Никогда не доверяйте сырой оценке судьи, пока у вас нет корреляции с человеческими метками. Прогоните 100 вручную размеченных примеров. Постройте график судья против человека. Вычислите коэффициент корреляции Спирмена. Если rho < 0.7, рубрика вашего судьи нуждается в доработке.

```figure
n5-judge-gauge
```

## Постройте это

### Шаг 1: достоверность с помощью NLI (в стиле RAGAS)

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

Разложите ответ на атомарные утверждения. Проверьте каждое утверждение относительно полученного контекста с помощью NLI. Достоверность = доля подтверждённых.

### Шаг 2: релевантность ответа

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

Если ответ подразумевает вопросы, отличные от заданного, релевантность падает.

### Шаг 3: кастомная метрика G-Eval

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

Шаги оценки — это и есть рубрика. Явные шаги стабильнее, чем неявные промпты «оцени от 0 до 1».

### Шаг 4: контрольная точка CI

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

Оформите как pytest-файл. Запускайте при каждом PR. Блокируйте слияния при регрессиях.

### Шаг 5: игрушечное оценивание с нуля

См. `code/main.py`. Приближения достоверности (пересечение утверждений ответа с контекстом) и релевантности (пересечение токенов ответа с токенами вопроса) только на stdlib. Не для продакшена. Показывает общую форму.

## Ловушки

- **Отсутствие калибровки.** Судья с корреляцией 0.3 с человеческими метками — это шум. Требуйте калибровочный прогон перед внедрением.
- **Самооценивание.** Использование той же LLM для генерации и оценивания завышает оценки на 10–20%. Используйте другое семейство моделей для судьи.
- **Позиционное смещение при попарном оценивании.** Судьи предпочитают первый представленный вариант. Всегда рандомизируйте порядок и прогоняйте оба варианта.
- **Сырой агрегат скрывает сбои.** Средняя оценка 0.85 часто скрывает 5% катастрофических сбоев. Всегда проверяйте нижний квантиль.
- **Устаревание золотого набора данных.** Неверсионированные наборы для оценки, дрейфующие со временем, ломают продольное сравнение. Помечайте набор данных при каждом изменении.
- **Стоимость LLM.** В масштабе вызовы судьи доминируют в затратах. Используйте самую дешёвую модель, которая соответствует порогу калибровки. GPT-4o-mini, Claude Haiku, Mistral-small.

## Применение

Стек 2026 года:

| Сценарий использования | Фреймворк |
|---------|-----------|
| Мониторинг качества RAG | RAGAS (4 метрики) |
| Регрессионные контрольные точки CI/CD | DeepEval + pytest |
| Кастомные доменные критерии | G-Eval внутри DeepEval |
| Онлайн-мониторинг живого трафика | RAGAS в режиме без эталонных ответов |
| Выборочные проверки с участием человека | LangSmith или Phoenix с UI для аннотирования |
| Редтиминг / оценивание безопасности | Promptfoo + DeepEval |

Типичный стек: RAGAS для мониторинга, DeepEval для CI, G-Eval для новых измерений. Запускайте все три; их несогласие полезно.

## Отправьте это в продакшен

Сохраните как `outputs/skill-eval-architect.md`:

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

## Упражнения

1. **Лёгкое.** Используйте RAGAS на 10 примерах RAG с известными галлюцинациями. Проверьте, что метрика достоверности выявляет каждую из них.
2. **Среднее.** Вручную разметьте 50 ответов на вопросы от 0 до 1 по правильности. Оцените с помощью G-Eval. Измерьте корреляцию Спирмена между судьёй и человеком.
3. **Сложное.** Постройте контрольную точку CI на pytest с DeepEval. Намеренно ухудшите ретривер. Проверьте, что контрольная точка срабатывает на сбой. Добавьте оповещение по нижнему квантилю через проверку порога на нижних 10%.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| LLM-судья (LLM-as-judge) | Оценивание с помощью LLM | Промпт для модели-судьи с целью оценить выходы от 0 до 1 по заданному критерию. |
| RAGAS | Библиотека метрик RAG | Открытый фреймворк оценивания с 4 безэталонными метриками RAG. |
| Достоверность (Faithfulness) | Обоснован ли ответ? | Доля утверждений ответа, подтверждённых полученным контекстом. |
| Точность контекста (Context precision) | Были ли полученные фрагменты релевантны? | Доля топ-K фрагментов, которые действительно имели значение. |
| Полнота контекста (Context recall) | Нашёл ли поиск всё? | Доля утверждений эталонного ответа, подтверждённых полученными фрагментами. |
| G-Eval | Кастомный LLM-судья | Рубрика + шаги оценки по цепочке рассуждений + оценка от 0 до 1. |
| Калибровка | Доверяй, но проверяй | Корреляция Спирмена между оценкой судьи и оценкой человека. |

## Дополнительное чтение

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — статья о RAGAS.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) — статья о G-Eval.
- [Документация DeepEval](https://deepeval.com/docs/metrics-introduction) — открытый продакшен-стек.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) — смещения, калибровка, ограничения.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) — объединяющий фреймворк, интегрирующий RAGAS, DeepEval, Phoenix.
