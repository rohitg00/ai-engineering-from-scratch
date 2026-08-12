# Логический вывод на естественном языке — текстовое следование

> «t entails h» означает, что человек, прочитавший t, заключил бы, что h истинно. NLI — это задача предсказания следования / противоречия / нейтральности. На первый взгляд скучная, но критически важная в продакшене.

**Тип:** Learn**Языки:** Python**Предварительные требования:** Фаза 5 · 05 (Sentiment Analysis), Фаза 5 · 13 (Question Answering)**Время:** ~60 минут
## Проблема

Вы построили суммаризатор. Он выдал резюме. Как узнать, что в резюме нет галлюцинации?

Вы построили чат-бота. Он ответил «да». Как узнать, что ответ подтверждается извлечённым фрагментом текста?

Вам нужно классифицировать 10 000 новостных статей по темам. У вас нет размеченных данных для обучения. Можно ли переиспользовать существующую модель?

Все три задачи сводятся к логическому выводу на естественном языке (Natural Language Inference, NLI). NLI спрашивает: дана посылка `t` и гипотеза `h` — следует ли `h` из `t`, противоречит ли ему, или они нейтральны (не связаны)?

- **Проверка на галлюцинации:** `t` = исходный документ, `h` = утверждение из резюме. Не следование = галлюцинация.
- **QA с опорой на источник:** `t` = извлечённый фрагмент, `h` = сгенерированный ответ. Не следование = выдумка.
- **Классификация без примеров (zero-shot):** `t` = документ, `h` = вербализованная метка («This is about sports»). Следование = предсказанная метка.

Одна задача, три применения в продакшене. Именно поэтому в основе каждого фреймворка оценки RAG лежит модель NLI.

## Концепция

![NLI: трёхклассовая классификация посылки и гипотезы](../assets/nli.svg)

**Три метки.**

- **Следование (entailment).** `t` → `h`. «The cat is on the mat» влечёт «There is a cat».
- **Противоречие (contradiction).** `t` → ¬`h`. «The cat is on the mat» противоречит «There is no cat».
- **Нейтральность (neutral).** Вывод невозможен в любую сторону. «The cat is on the mat» нейтрально по отношению к «The cat is hungry».

**Не логическое следование.** NLI — это *естественный* языковой вывод: то, что вывел бы типичный человек-читатель, а не строгая логика. «John walked his dog» влечёт «John has a dog» в терминах NLI, но строгая логика первого порядка допустила бы это лишь при аксиоматизации владения.

**Наборы данных.**

- **SNLI** (2015). 570 тыс. пар, размеченных людьми, подписи к изображениям в роли посылок. Узкая предметная область.
- **MultiNLI** (2017). 433 тыс. пар в 10 жанрах. Стандартный обучающий корпус в 2026 году.
- **ANLI** (2019). Adversarial NLI. Люди специально писали примеры, чтобы сломать существующие модели. Сложнее.
- **DocNLI, ConTRoL** (2020–21). Посылки длиной в документ. Проверяют многоходовой и дальний вывод.

**Архитектура.** Энкодер-трансформер (BERT, RoBERTa, DeBERTa) читает `[CLS] premise [SEP] hypothesis [SEP]`. Представление `[CLS]` подаётся на трёхклассовый softmax. Обучение на MNLI, оценка на отложенных бенчмарках даёт точность 90%+ на парах из того же распределения.

**Zero-shot через NLI.** Дан документ и набор кандидатных меток — каждая метка превращается в гипотезу («This text is about sports»). Для каждой вычисляется вероятность следования. Выбирается максимум. Это механизм, лежащий в основе пайплайна `zero-shot-classification` от Hugging Face.

```figure
nli-router
```

## Постройте это

### Шаг 1: запустите предобученную модель NLI

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

Для продакшен-NLI открытыми моделями по умолчанию служат `facebook/bart-large-mnli` и `microsoft/deberta-v3-large-mnli`. DeBERTa-v3 возглавляет лидерборды.

### Шаг 2: классификация без примеров

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

По умолчанию шаблон — «This example is about {label}.». Настраивается через `hypothesis_template`. Обучающие данные не требуются. Дообучение не требуется. Работает «из коробки».

### Шаг 3: проверка достоверности для RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Это ядро метрики достоверности (faithfulness) в RAGAS. Сгенерированный ответ разбивается на атомарные утверждения. Каждое утверждение проверяется против извлечённого контекста. Отчёт показывает долю утверждений, для которых подтверждено следование.

### Шаг 4: самодельный классификатор NLI (концептуально)

См. `code/main.py` — игрушечная реализация только на stdlib: посылка и гипотеза сравниваются через лексическое пересечение и обнаружение отрицания. Не конкурирует с трансформерными моделями, но показывает форму задачи: два текста на входе, трёхклассовая метка на выходе, функция потерь — перекрёстная энтропия по `{entail, contradict, neutral}`.

## Ловушки

- **Обходные пути «только гипотеза».** Модели могут предсказывать метку только по гипотезе с точностью ~60% на SNLI, потому что слова «not», «nobody», «never» коррелируют с противоречием. Сильная базовая линия для обнаружения утечки меток.
- **Эвристика лексического пересечения.** Эвристика подпоследовательности («каждая подпоследовательность влечёт следование») проходит SNLI, но проваливается на HANS/ANLI. Используйте состязательные бенчмарки.
- **Деградация на длинных документах.** Модели NLI, обученные на отдельных предложениях, теряют 20+ пунктов F1 на посылках длиной в документ. Для длинного контекста используйте модели, обученные на DocNLI.
- **Чувствительность zero-shot к шаблону.** «This example is about {label}» против «{label}» против «The topic is {label}» может менять точность на 10+ пунктов. Настройте шаблон.
- **Несоответствие домена.** MNLI обучается на общеупотребительном английском. Юридический, медицинский и научный текст требуют специализированных моделей NLI (например, SciNLI, MedNLI).

## Применение

Стек 2026 года:

| Сценарий | Модель |
|---------|-------|
| Универсальная NLI | `microsoft/deberta-v3-large-mnli` |
| Быстрая / edge | `cross-encoder/nli-deberta-v3-base` |
| Классификация без примеров (лёгкая) | `facebook/bart-large-mnli` |
| NLI на уровне документа | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Многоязычная | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Обнаружение галлюцинаций в RAG | Слой NLI внутри RAGAS / DeepEval |

Мета-паттерн 2026 года: NLI — это универсальный клей понимания текста. Когда нужно «поддерживает ли A утверждение B?» или «противоречит ли A утверждению B?» — обращайтесь к NLI раньше, чем к ещё одному вызову LLM.

## Отправьте это в продакшен

Сохраните как `outputs/skill-nli-picker.md`:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## Упражнения

1. **Лёгкое.** Запустите `facebook/bart-large-mnli` на 20 вручную составленных тройках (посылка, гипотеза, метка), покрывающих все три класса. Измерьте точность. Добавьте состязательные ловушки «эвристики подпоследовательности» («I did not eat the cake» против «I ate the cake») и проверьте, ломается ли модель.
2. **Среднее.** Сравните шаблон zero-shot `"This text is about {label}"` с `"The topic is {label}"` и `"{label}"` на 100 заголовках AG News. Отчитайтесь о разбросе точности.
3. **Сложное.** Постройте проверку достоверности для RAG: декомпозиция на атомарные утверждения + NLI для каждого. Оцените на 50 сгенерированных RAG-ответах с эталонным контекстом. Измерьте долю ложноположительных и ложноотрицательных срабатываний относительно ручной разметки.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | Трёхклассовая классификация отношения посылки и гипотезы. |
| RTE | Recognizing Textual Entailment | Более старое название NLI; та же задача. |
| Entailment | «t подразумевает h» | Типичный читатель заключил бы, что h истинно при данном t. |
| Contradiction | «t исключает h» | Типичный читатель заключил бы, что h ложно при данном t. |
| Neutral | «неопределённость» | Из t нельзя вывести h ни в какую сторону. |
| Zero-shot classification | NLI как классификатор | Метки вербализуются как гипотезы, выбирается максимум следования. |
| Faithfulness | Подтверждён ли ответ? | NLI над парой (извлечённый контекст, сгенерированный ответ). |

## Дополнительное чтение

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) — SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) — MultiNLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) — бенчмарк ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) — NLI как классификатор.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) — рабочая лошадка NLI 2026 года.
