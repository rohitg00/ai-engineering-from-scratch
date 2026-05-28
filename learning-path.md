# Learning Path: CRM-инженер-маркетолог AI-автоматизации

Этот документ — карта обучения Pavel'а на 12-18 месяцев, выбранная
2026-05-26 после нескольких итераций.

## Цель и позиционирование

> **Статус позиционирования (2026-05-26):** «CRM-инженер-маркетолог
> AI-автоматизации» — это **рабочая гипотеза**, не финальное решение.
> Веб-исследование показало, что ниша уже частично заселена соседними
> ролями: **MarTech Engineer**, **GTM Engineer**, **Marketing Operations
> Architect (AI & Automation)** — они растут на этом стыке уже 3-5 лет.
> Конкретный job title пересмотрим через **~6 месяцев** обучения,
> опираясь на реальные вакансии и собственный прогресс. Контент плана
> релевантен для **любой** из соседних ролей — учим правильные вещи в
> любом случае.

**CRM-инженер-маркетолог AI-автоматизации** — редкая комбинация на стыке
трёх профессий:

- **Маркетолог** — понимает бизнес-задачу, метрики, клиента, бренд.
- **Data Scientist** — понимает, какие AI/ML-инструменты подходят под
  задачу, и умеет их применять.
- **Агент-инженер** — умеет собрать из готовых LLM/моделей рабочую
  автоматизированную систему.

**Не путать:**
- ❌ Data Scientist (строит модели с нуля для исследовательских задач).
- ❌ ML Engineer (деплоит и масштабирует production-инфраструктуру).
- ❌ Backend-разработчик (пишет CRM-систему как софт).

**А именно:** маркетинговый бэкграунд первичен; инженерия —
инструмент, чтобы проектировать AI-автоматизированные маркетинговые
системы (триггеры, journey, копирайтинг, сегментация, поддержка),
работающие на агентах.

На рынке таких людей мало, потому что классические CRM-маркетологи
боятся технологий, а технические DS/MLE не понимают маркетинговой
логики.

## Методология «системно с практикой»

Чтобы не было размытости — конкретные правила:

1. **Каждая релевантная фаза проходится полностью** по списку уроков
   ниже. Не «по диагонали».

2. **На каждом уроке:**
   - Прочитать `en.md` целиком.
   - Завести `ru.md` рядом (по правилу [feedback-lesson-ru-notes]) и
     вести по ходу.
   - Сделать **прикладные** упражнения через готовые библиотеки
     (sklearn, pytorch, transformers, anthropic SDK).
   - **Не реализовывать алгоритмы от руки** на сотнях строк, если для
     них уже есть стандартная библиотечная функция. Один проход «руками»
     для понимания концепции — окей, как было на уроке 01 фазы 1.
     Делать так каждый раз — нет.
   - Quiz после прохождения.

3. **В конце каждой релевантной фазы — мини-проект** на маркетинговом
   датасете, объединяющий темы фазы. Складывается в подпапку `my/` урока
   или в отдельную папку фазы.

4. **Каждые 2-3 фазы — большой портфолио-проект** (см. список ниже).
   Это становится отдельным публичным GitHub-репо для резюме.

5. **«Без чернухи про деплой»** = пропускаем production-DevOps (kubernetes,
   autoscaling, GPU serving internals, и т.п.). Но базовые
   production-вопросы для агентов (кэширование, A/B, безопасность) —
   берём, потому что без них автоматизированную систему не запустить.

6. **Курс — основной трек.** Внешние ресурсы как доп. чтение —
   опционально, не обязательно.

## Карта курса по фазам

Маркировка:
- ⭐⭐ — ядро твоей специализации, проходим максимально глубоко.
- ⭐ — критично для базы, проходим системно с практикой.
- ✅ — нужно, проходим с практикой.
- ⚠️ — концептуально / обзорно, без упражнений на реализацию.
- ❌ — пропускаем (вернёмся точечно, если когда-нибудь понадобится).

### Фаза 0 — Setup and Tooling

| Урок | Приоритет | Что делать |
|---|---|---|
| 01-08 | сделано | dev environment, git, GPU, APIs, jupyter, venv, docker, editor |
| 09 data-management | ✅ | дозакрыть (упражнение с rotten_tomatoes/streaming) |
| 10 terminal-and-shell | ⚠️ | короткий обзор |
| 11 linux-for-ai | ❌ | для системных администраторов, не нам |
| 12 debugging-and-profiling | ✅ | базовый Python debug пригодится |

### Фаза 1 — Math Foundations

| Урок | Приоритет | Что делать |
|---|---|---|
| 01 linear-algebra-intuition | ✅ | интуицию закрыли — осталось показать те же операции через numpy (без класса Vector и матриц от руки) |
| 02 vectors-matrices-operations | ⚠️ | концепция матричных операций через numpy |
| 03 matrix-transformations | ⚠️ | геометрия преобразований через примеры, без реализации |
| 04 calculus-for-ml | ⚠️ | интуиция производной и градиента — основа понимания gradient descent |
| 05 chain-rule-and-autodiff | ⚠️ | концепция, реализация — нет |
| 06 probability-and-distributions | ✅ | основа для ML и A/B-тестов |
| 07 bayes-theorem | ✅ | Bayesian thinking — полезно для маркетинга |
| 08 optimization | ⚠️ | концепция gradient descent |
| 09 information-theory | ⚠️ | энтропия, cross-entropy — поверхностно |
| 10 dimensionality-reduction | ✅ | PCA для визуализации сегментов |
| 11 SVD | ⚠️ | концепция, реализация — нет |
| 12 tensor-operations | ⚠️ | базовые операции в PyTorch |
| 13 numerical-stability | ❌ | для тех, кто пишет численные алгоритмы |
| 14 norms-and-distances | ⚠️ | в основном уже прошли на уроке 01 |
| 15 statistics-for-ml | ⭐ | **критично** — A/B-тесты, гипотезы, доверительные интервалы |
| 16 sampling-methods | ⚠️ |
| 17-20 | ❌ | linear systems, convex opt, complex numbers, Fourier — глубокая математика |

### Фаза 2 — ML Fundamentals — ⭐ ЯДРО БАЗЫ

Все 18 уроков релевантны. **Прикладной подход:** концепция → как
работает алгоритм простыми словами → как применять через sklearn → когда
применять в маркетинге.

| Урок | Приоритет |
|---|---|
| 01 what-is-machine-learning | ✅ |
| 02 linear-regression | ✅ (LTV-моделирование) |
| 03 logistic-regression | ⭐ (churn, propensity, conversion) |
| 04 decision-trees | ✅ (интерпретируемые модели) |
| 05 support-vector-machines | ⚠️ (концепция, реже на практике) |
| 06 knn-and-distances | ✅ (рекомендации, поиск похожих) |
| 07 unsupervised-learning | ⭐ (кластеризация для сегментации) |
| 08 feature-engineering | ⭐ (главный рабочий навык) |
| 09 model-evaluation | ⭐ (без этого результаты пустые) |
| 10 bias-variance | ✅ (концепция переобучения) |
| 11 ensemble-methods | ⭐ (XGBoost, LightGBM — рабочая лошадка) |
| 12 hyperparameter-tuning | ✅ |
| 13 ml-pipelines | ✅ (sklearn Pipeline) |
| 14 naive-bayes | ⚠️ (классика NLP) |
| 15 time-series | ✅ (прогнозы метрик retention) |
| 16 anomaly-detection | ✅ (fraud, churn-сигналы) |
| 17 imbalanced-data | ⭐ (типичная проблема в churn) |
| 18 feature-selection | ✅ |

**Большой проект после фазы 2:** Churn Prediction с SHAP-интерпретацией
(см. ниже).

### Фаза 3 — Deep Learning Core

| Урок | Приоритет |
|---|---|
| 01 the-perceptron | ⚠️ концепция |
| 02 multi-layer-networks | ⚠️ концепция |
| 03 backpropagation | ⚠️ интуиция, без реализации |
| 04 activation-functions | ⚠️ знать имена и роли |
| 05 loss-functions | ⚠️ знать имена и роли |
| 06 optimizers | ⚠️ концепция Adam, SGD |
| 07 regularization | ⚠️ dropout, batch norm — концепция |
| 08 weight-initialization | ❌ |
| 09 learning-rate-schedules | ❌ |
| 10 mini-framework | ❌ реализация фреймворка с нуля |
| 11 intro-to-pytorch | ⭐ нужно для следующих фаз — простой touch |
| 12 intro-to-jax | ❌ |
| 13 debugging-neural-networks | ❌ |

**Действие:** концептуально пройти 01-07 (чтобы понимать, как устроена
нейросеть). Серьёзно — урок 11 (PyTorch intro).

### Фаза 4 — Computer Vision — ❌ ПРОПУСКАЕМ

### Фаза 5 — NLP — ✅ ВЫБОРОЧНО

| Урок | Приоритет |
|---|---|
| 01 text-processing | ✅ |
| 02 bag-of-words-tfidf | ✅ |
| 03 word-embeddings-word2vec | ✅ |
| 04 glove-fasttext-subword | ⚠️ |
| 05 sentiment-analysis | ⭐ (NPS, отзывы) |
| 06 named-entity-recognition | ✅ (извлечение продуктов/брендов) |
| 07-13 POS, CNN/RNN, seq2seq, attention, translation, summarization, QA | ⚠️ концепция attention обязательно |
| 14 information-retrieval-search | ⭐ |
| 15 topic-modeling | ⭐ |
| 16-21 generation, chatbots, multilingual, tokenization, structured, NLI | ⚠️ обзорно |
| 22 embedding-models-deep-dive | ⭐ (фундамент RAG) |
| 23 chunking-strategies-rag | ⭐ |
| 24-26 coreference, entity-linking, relation extraction | ⚠️ |
| 27 llm-evaluation-frameworks | ⭐ |
| 28-29 long-context-eval, dialogue | ⚠️ |

**Большой проект после фазы 5:** Sentiment + Topic Analysis на отзывах.

### Фаза 6 — Speech and Audio — ❌ ПРОПУСКАЕМ

### Фаза 7 — Transformers Deep Dive — ⚠️ КОНЦЕПЦИЯ

Прочитать обзорно `en.md` каждого урока. Понять архитектуру через
визуализации (Jay Alammar). Реализацию transformer от руки **не делать**
— это для DL-инженеров. Главное вынести: «attention = массив скалярных
произведений query × key, self-attention позволяет каждому токену
обращать внимание на остальные».

### Фаза 8 — Generative AI — ⚠️ ОБЗОРНО

Урок 01 (taxonomy) — концепция «какие виды генеративных моделей
бывают». Остальное (VAE, GANs, diffusion и т.п.) — за рамками
твоей ниши, пропускаем.

### Фаза 9 — Reinforcement Learning — ❌ ПРОПУСКАЕМ

### Фаза 10 — LLMs from Scratch — ❌ ПРОПУСКАЕМ

### Фаза 11 — LLM Engineering — ⭐⭐ КЛЮЧЕВАЯ

Все 17 уроков. Каждый — прикладной мини-проект на маркетинговом сценарии.

| Урок | Приоритет |
|---|---|
| 01 prompt-engineering | ⭐⭐ |
| 02 few-shot-cot | ⭐ |
| 03 structured-outputs | ⭐ |
| 04 embeddings | ⭐ |
| 05 context-engineering | ⭐ |
| 06 rag | ⭐⭐ |
| 07 advanced-rag | ⭐ |
| 08 fine-tuning-lora | ⚠️ (концепция: когда нужен fine-tuning, когда хватает prompt) |
| 09 function-calling | ⭐ |
| 10 evaluation | ⭐ |
| 11 caching-cost | ✅ (бюджет на LLM) |
| 12 guardrails | ⭐ |
| 13 production-app | ✅ (без deep DevOps) |
| 14 model-context-protocol | ⭐ |
| 15 prompt-caching | ✅ |
| 16 langgraph-state-machines | ✅ |
| 17 agent-framework-tradeoffs | ✅ |

**Большой проект после фазы 11:** RAG-помощник для CRM-операторов
(см. ниже).

### Фаза 12 — Multimodal AI — ⚠️ ОБЗОРНО

| Урок | Приоритет |
|---|---|
| 01-02 ViT, CLIP | ⚠️ концепция |
| 23-24 multimodal-rag | ⚠️ если будет проект с изображениями товаров |
| Остальное | ❌ |

### Фаза 13 — Tools and Protocols — ⭐ ПОЧТИ ВСЯ ВАЖНА

Это **технический фундамент агентов**.

| Урок | Приоритет |
|---|---|
| 01 the-tool-interface | ⭐ |
| 02 function-calling-deep-dive | ⭐ |
| 03 parallel-and-streaming-tool-calls | ⭐ |
| 04 structured-output | ⭐ |
| 05 tool-schema-design | ⭐ |
| 06 mcp-fundamentals | ⭐⭐ (стандарт от Anthropic) |
| 07 building-an-mcp-server | ⭐ |
| 08 building-an-mcp-client | ⭐ |
| 09 mcp-transports | ✅ |
| 10 mcp-resources-and-prompts | ✅ |
| 11 mcp-sampling | ✅ |
| 12 mcp-roots-and-elicitation | ✅ |
| 13 mcp-async-tasks | ✅ |
| 14 mcp-apps | ✅ |
| 15 mcp-security-tool-poisoning | ⭐ |
| 16 mcp-security-oauth-2-1 | ✅ |
| 17 mcp-gateways-and-registries | ⚠️ (ближе к DevOps) |
| 18 mcp-auth-production | ⚠️ (ближе к DevOps) |
| 19 a2a-protocol | ⭐ (Agent-to-Agent протокол) |
| 20 opentelemetry-genai | ✅ (observability агентов) |
| 21 llm-routing-layer | ✅ |
| 22 skills-and-agent-sdks | ⭐ |
| 23 capstone-tool-ecosystem | ⭐ финальный проект фазы |

### Фаза 14 — Agent Engineering — ⭐⭐ СЕРДЦЕ СПЕЦИАЛИЗАЦИИ

**Все 30 уроков**, максимально глубоко. Это **твоя главная фаза**, на
которой стоит вся ниша. Каждый урок — практический проект.

| Урок | Приоритет |
|---|---|
| 01 the-agent-loop | ⭐⭐ |
| 02-05 ReWOO, Reflexion, ToT, Self-Refine | ⭐ |
| 06 tool-use-and-function-calling | ⭐ |
| 07-09 memory (MemGPT, sleep-time, Mem0) | ⭐ |
| 10 skill-libraries-voyager | ✅ |
| 11 planning-htn-and-evolutionary | ✅ |
| 12 anthropic-workflow-patterns | ⭐⭐ |
| 13 langgraph-stateful-graphs | ⭐ |
| 14 autogen-actor-model | ✅ |
| 15 crewai-role-based-crews | ⭐ |
| 16 openai-agents-sdk | ⭐ |
| 17 claude-agent-sdk | ⭐⭐ |
| 18 agno-and-mastra-runtimes | ✅ |
| 19-20 benchmarks (SWEBench, GAIA, WebArena, OSWorld) | ⚠️ обзор |
| 21 computer-use-agents | ⭐ (важно для автоматизации CRM-операций) |
| 22 voice-agents-pipecat-livekit | ⭐ (voice-каналы маркетинга) |
| 23 otel-genai-conventions | ✅ |
| 24 agent-observability-platforms | ✅ |
| 25 multi-agent-debate | ✅ |
| 26 failure-modes-agentic | ⭐ |
| 27 prompt-injection-defense | ⭐ |
| 28 orchestration-patterns | ⭐ |
| 29 production-runtimes | ✅ (без deep DevOps) |
| 30 eval-driven-agent-development | ⭐ |

**Большой проект после фазы 14:** Triggered CRM-agent (см. ниже).

### Фаза 15 — Autonomous Systems — ❌ ПРОПУСКАЕМ

### Фаза 16 — Multi-agent and Swarms — ⭐ ВЫБОРОЧНО ГЛУБОКО

| Урок | Приоритет |
|---|---|
| 01 why-multi-agent | ⭐ |
| 02 fipa-acl-heritage | ⚠️ исторический контекст |
| 03 communication-protocols | ⭐ |
| 04 primitive-model | ✅ |
| 05 supervisor-orchestrator-pattern | ⭐⭐ (главный паттерн маркетинга) |
| 06 hierarchical-architecture | ⭐ |
| 07 society-of-mind-debate | ⚠️ обзорно |
| 08 role-specialization | ⭐⭐ (роли в маркетинговых командах агентов) |
| 09 parallel-swarm-networks | ✅ |
| 10 group-chat-speaker-selection | ✅ |
| 11 handoffs-and-routines | ⭐ |
| 12 a2a-protocol | ⭐ |
| 13 shared-memory-blackboard | ⭐ |
| 14 consensus-and-bft | ⚠️ |
| 15 voting-debate-topology | ⚠️ |
| 16 negotiation-bargaining | ⚠️ |
| 17 generative-agents-simulation | ✅ (симуляция клиентов!) |
| 18 theory-of-mind-coordination | ⚠️ |
| 19 swarm-optimization-pso-aco | ❌ исследовательское |
| 20 marl-maddpg-qmix-mappo | ❌ RL в мультиагентах |
| 21 agent-economies | ⚠️ |
| 22 production-scaling-queues-checkpoints | ✅ |
| 23 failure-modes-mast-groupthink | ⭐ |
| 24 evaluation-coordination-benchmarks | ✅ |
| 25 case-studies-2026-sota | ⭐ |

**Большой проект после фазы 16:** Multi-agent journey orchestration
(см. ниже).

### Фаза 17 — Infrastructure and Production — ⚠️ ВЫБОРОЧНО

«Без чернухи про деплой» — но несколько уроков всё же релевантны:

| Урок | Приоритет |
|---|---|
| 01 managed-llm-platforms | ⚠️ обзор: какие платформы есть |
| 11 multi-region-kv-locality | ❌ |
| 13 llm-observability | ✅ |
| 14 prompt-semantic-caching | ⭐ (бюджет на LLM критичен) |
| 15 batch-apis | ✅ (массовая обработка маркетинговых данных) |
| 19 ai-gateways | ✅ |
| 21 ab-testing-llm-features | ⭐ (твоя профессия) |
| 22 load-testing-llm-apis | ⚠️ |
| 25 security-secrets-audit | ⭐ |
| 27 finops-llms | ⭐ (управление бюджетом LLM) |
| Остальные | ❌ (vLLM internals, TensorRT, GPU autoscaling и т.п.) |

### Фаза 18 — Ethics, Safety, Alignment — ⚠️ ВЫБОРОЧНО

| Урок | Приоритет |
|---|---|
| 01-19 alignment research, jailbreaking, red-teaming | ❌ (AI safety research) |
| 15 indirect-prompt-injection | ⭐ |
| 20 bias-representational-harm | ⭐⭐ |
| 21 fairness-criteria | ⭐ |
| 22 differential-privacy-for-llms | ✅ |
| 23 watermarking | ⚠️ |
| 24 regulatory-frameworks-eu-us-uk-korea | ⭐⭐ (GDPR, EU AI Act — критично) |
| 25 echoleak-cves-for-ai | ⚠️ |
| 26 model-system-dataset-cards | ✅ |
| 27 data-provenance-training-governance | ⭐ |
| 28 alignment-research-ecosystem | ❌ |
| 29 moderation-systems | ⭐ |
| 30 dual-use-risk | ❌ |

### Фаза 19 — Capstone Projects — для своих проектов

---

## Большие портфолио-проекты

Каждый — отдельный публичный GitHub-репо. README с **бизнес-объяснением**,
не сухими метриками. По мере прохождения курса.

### Проект 1. RFM-сегментация и кластеризация (после фазы 2 урок 7)

- **Данные:** Online Retail II UCI или Brazilian E-Commerce (Olist).
- **Срок:** 2-3 недели.
- **Технологии:** pandas, sklearn (KMeans, DBSCAN), matplotlib/seaborn,
  PCA для визуализации.
- **Что покажет:** работа с CRM-данными, базовый ML, бизнес-интерпретация
  сегментов.

### Проект 2. Churn Prediction с SHAP-интерпретацией (после фазы 2)

- **Данные:** IBM Telco Customer Churn.
- **Срок:** 3-4 недели.
- **Технологии:** pandas, sklearn, XGBoost/LightGBM, SHAP, threshold
  tuning.
- **Что покажет:** classification end-to-end, бизнес-интерпретация
  feature importance.

### Проект 3. Uplift Modeling — звезда классической части портфолио (после фазы 2)

- **Данные:** MineThatData E-Mail Analytics Challenge (датасет Hillstrom).
- **Срок:** 4-5 недель.
- **Технологии:** scikit-uplift или CausalML.
- **Что покажет:** редкий маркетинговый ML-навык — отличаем «купили из-за
  кампании» от «купили бы и так». Инкрементальный ROI.

### Проект 4. Sentiment + Topic Analysis на отзывах (после фазы 5)

- **Данные:** открытые отзывы (Amazon Reviews) или русскоязычные.
- **Срок:** 3 недели.
- **Технологии:** transformers (huggingface), BERTopic / LDA, опционально
  Streamlit для dashboard.
- **Что покажет:** превращение неструктурированного текста в actionable
  инсайты.

### Проект 5. RAG-помощник для CRM-операторов (после фазы 11)

- **Идея:** оператор задаёт вопрос про продукт / триггер / тариф —
  получает ответ со ссылками на источники.
- **Данные:** документация Mindbox / Customer.io / Klaviyo (публичная)
  или фиктивная база.
- **Срок:** 4 недели.
- **Технологии:** Anthropic API, embeddings, Chroma (vector DB),
  опционально LangChain.
- **Что покажет:** full LLM-pipeline, RAG, evaluation pipeline.

### Проект 6. Triggered CRM-agent (после фазы 14)

- **Идея:** LLM-агент решает в реальном времени, что отправить клиенту,
  на основе его профайла и недавних действий. Не «if X then Y», а
  «агент думает». С function calling — у агента есть инструменты
  «отправить email», «добавить в сегмент», «эскалировать менеджеру».
- **Данные:** синтетика (профайлы + история действий).
- **Срок:** 5-6 недель.
- **Технологии:** Claude Agent SDK или langgraph, function calling,
  workflow patterns (Anthropic), evaluation framework.
- **Что покажет:** **редкий навык** — не просто prompting, а
  агент-инженерия в маркетинговом контексте.

### Проект 7. Multi-agent journey orchestration (после фазы 16)

- **Идея:** несколько агентов работают вместе над запуском
  маркетинговой кампании. Например: Segmentation Agent (выбирает
  целевую аудиторию) → Copy Agent (генерирует копии) → Evaluator Agent
  (оценивает варианты) → Sender Agent (отправляет лучшие).
- **Срок:** 6-8 недель.
- **Технологии:** CrewAI / langgraph / Claude Agent SDK, supervisor
  pattern, A2A protocol, observability через OpenTelemetry.
- **Что покажет:** **звезда портфолио** — мульти-агентная архитектура
  для конкретной маркетинговой задачи. Никто из обычных маркетологов
  такого не делает.

### Проект 8 (опциональный). Voice-agent первой линии CRM-поддержки (если voice интересен)

- **Технологии:** Pipecat / LiveKit + Claude / OpenAI Realtime API.
- **Срок:** 4 недели.

---

## Приблизительный таймлайн (12-18 месяцев)

Темп — гибкий, зависит от загрузки. Это **верхняя граница**, реально
можно идти быстрее по интересу.

### Месяцы 1-2: фундамент

- Закрыть фазу 0 (уроки 09, 10, 12) + фазу 1 (урок 01 закончить через
  numpy, далее по приоритетам — 06, 07, 10, 15).
- **Проект 1** — RFM-сегментация (после фазы 2 урока 7, но можно
  параллельно).

### Месяцы 3-5: ML Fundamentals

- Фаза 2 целиком, прикладно через sklearn.
- **Проект 2** — Churn Prediction.
- **Проект 3** — Uplift Modeling.

### Месяцы 6-7: Deep Learning concepts + NLP

- Фаза 3 — концептуально, плюс PyTorch intro руками.
- Фаза 5 — выборочные уроки (см. таблицу).
- **Проект 4** — Sentiment + Topic Analysis.

### Месяцы 8-10: LLM Engineering — ключевая фаза

- Фаза 11 целиком.
- Параллельно — обзорно фазы 7 (transformers concept), 8 (generative
  taxonomy), 12 (multimodal concept).
- **Проект 5** — RAG-помощник для операторов.

### Месяцы 11-13: Tools, Protocols + Agent Engineering

- Фаза 13 (Tools and Protocols) целиком — MCP, function calling,
  observability.
- Фаза 14 (Agent Engineering) целиком — **главная фаза**, 30 уроков с
  максимальной практикой.
- **Проект 6** — Triggered CRM-agent.

### Месяцы 14-16: Multi-agent systems

- Фаза 16 (Multi-agent) — выборочно глубоко.
- **Проект 7** — Multi-agent journey orchestration.

### Месяцы 17-18: Производственные нюансы и этика

- Фаза 17 — выборочные уроки (caching, batch, A/B, security, finops).
- Фаза 18 — выборочные (bias, fairness, regulations, privacy).
- Финализация портфолио, обновление резюме, переговоры о позиции.

---

## Что НЕ делаем

- ❌ Не реализуем алгоритмы от руки, если для них есть sklearn /
  transformers / готовая библиотека. Один проход «как устроено внутри»
  для интуиции — okay. Сотни строк ML-кода от руки — нет.
- ❌ Не идём в production-DevOps глубоко (vLLM internals, GPU
  autoscaling, kubernetes для serving). Если когда-нибудь будет команда
  с MLE — они это закроют.
- ❌ Не уходим в исследовательские области (CV, RL, audio,
  multimodal generation, AI safety research, autonomous systems).
- ❌ Не учим математику впрок — только если конкретно нужна под текущую
  тему.

## Принцип возврата к пропущенным темам

Если по ходу прикладной работы возникает конкретная необходимость
понять, как работает алгоритм или область:

1. Идти в соответствующий урок курса.
2. Прочитать `en.md` (плюс при желании `ru.md`).
3. Сделать прикладной мини-эксперимент.

Это и есть **just-in-time learning** — расширяем глубину тогда, когда
есть реальная задача.

## Опциональное доп. чтение

Не обязательно, для расширения кругозора:

- **Kevin Hillstrom (MineThatData)** — https://blog.minethatdata.com/
  про email/CRM/retention-аналитику с реальными датасетами.
- **Avinash Kaushik** — https://www.kaushik.net/avinash/ маркетинговая
  аналитика без академической математики.

## Ссылки

- Конспект урока 01 фазы 1: [phases/01-math-foundations/01-linear-algebra-intuition/docs/ru.md](phases/01-math-foundations/01-linear-algebra-intuition/docs/ru.md)
- Инсайты урока 01 фазы 1: [phases/01-math-foundations/01-linear-algebra-intuition/docs/insights.md](phases/01-math-foundations/01-linear-algebra-intuition/docs/insights.md)
- Правила работы над проектом: [.claude/CLAUDE.md](.claude/CLAUDE.md)
