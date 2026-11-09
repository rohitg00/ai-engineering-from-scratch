# Avaliação do Mestrado em Direito Jurídico  RAGAS, DeepEval, G-Eval

> A correspondência exata e a F1 não têm equivalência semântica. A revisão humana não é escalavel. LLM-as-judge é a resposta de produção  com calibração suficiente para confiar no número.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## O problema

O teu sistema RAG responde: "29 de Junho de 2007".
A referência do ouro é: "29 de Junho de 2007".
O Match exacto marca 0, o F1 marca 75%. Um humano marca 100%.

Agora multiplica por 10.000 casos de teste. Multiplica novamente por cada mudança no retriever, em pedaços, em pedidos ou no modelo. Você precisa de um avaliador que entenda o significado, funciona a uma escala barata, não mente sobre regressões e apresenta os modos de falha certos.

2026 tem três estruturas que possuem este problema.

- **RAGAS.**Avaliação de avaliação de geração de recuperação-agumentada. Quatro métricas RAG (filidade, relevância de resposta, precisão de contexto, recall de contexto) com backends de NLI + LLM-juiz.
- **DeepEval.**Pito para LLM. G-Eval, conclusão de tarefas, alucinação, métricas de viés. CI/CD nativo.
- **G-Eval.**Um método (e uma métrica DeepEval): LLM-as-judge com cadeia de pensamento, critérios personalizados, pontuação 0-1.

Esta lição constrói a intuição para o método e a camada de confiança ao seu redor.

## O conceito

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**Substituir uma métrica estática por um LLM que marca os resultados dados por uma rubrica.`(query, context, answer)`"Ponto 0-1 na fidelidade". Retorna a pontuação.

Por que funciona: os LLM aproximam o julgamento humano a uma pequena fracção do custo.$0.003 per scored case enables 1000-sample regression eval runs for under $5.

Por que falha silenciosamente:

1. **Judge bias.**Os juízes preferem respostas mais longas, respostas da família modelo, respostas que correspondem ao estilo de resposta.
2. **JSON parsing failures.**Má pontuação JSON → NaN → silenciosamente excluída do agregado. Os usuários RAGAS conhecem esta dor. Porta com modo de tentativa/exceto + falha explícita.
3. **Drift over model versions.**A atualização do juiz muda todas as métricas.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**Define um critério personalizado: "A resposta cita a fonte correta?" A estrutura se expande automaticamente em etapas de avaliação de cadeia de pensamento, em seguida, pontuação 0-1. Boa para dimensões de qualidade específicas de domínio RAGAS não cobre.

**Calibration.**Nunca confie na pontuação do juiz bruto até ter uma correlação com os rótulos humanos. Exerça 100 exemplos rotulados à mão. Juiz de trama vs. humano. Compute rho de Spearman. Se rho < 0,7, a rubrica do juiz precisa de trabalho.

```figure
n5-judge-gauge
```

## Construí-lo

### Passo 1: fidelidade com a NLI (estilo RAGAS)

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

Decompõe a resposta em alegações atômicas. NLI verifique cada alegação contra o contexto recuperado. fidelidade = fração suportada.

### Passo 2: relevância da resposta

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

Se a resposta implica perguntas diferentes daquelas feitas, a relevância diminui.

### Passo 3: Métrica personalizada G-Eval

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

Os passos de avaliação são as rubricas. Os passos explícitos são mais estáveis do que as indicações implícitas de "pontuação 0-1".

### Passo 4: Porta de informação

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

Envio como um arquivo de pesquisa, executa todas as relações públicas, bloqueia as regressões.

### Passo 5: Avaliação de brinquedos a partir do zero

Veja .`code/main.py`- Aproximações de fidelidade (superposição das reivindicações de resposta com o contexto) e de relevância (superposição dos tokens de resposta com os tokens de pergunta).

## Encurralagens

- **No calibration.**Um juiz com correlação de 0,3 a rótulos humanos é ruído.
- **Self-evaluation.**Usar o mesmo LLM para gerar e julgar infla pontuações em 10-20%. Use uma família de modelos diferente para o juiz.
- **Positional bias in pairwise judging.**Os juízes preferem a primeira opção apresentada, sempre ordenem aleatoriamente e executem ambas.
- **Raw aggregate hides failures.**A média de 0,85 oculta 5% de falhas catastróficas.
- **Golden dataset rot.**Os conjuntos de avaliação não versados que se deslocam ao longo do tempo quebram a comparação longitudinal.
- **LLM cost.**A escala, o juiz diz que o custo é mais alto, use o modelo mais barato que atenda ao limiar de calibração, GPT-4o-mini, Claude Haiku, Mistral-small.

## Usá-lo

A pilha de 2026:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

Estação típica: RAGAS para monitoramento, DeepEval para CI, G-Eval para novas dimensões.

## Envia-o

Salva como`outputs/skill-eval-architect.md`- Não .

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

## Exercícios

1. **Easy.**Use RAGAS em 10 exemplos de RAG com alucinações conhecidas. Verifique a fidelidade das capturas métricas de cada um.
2. **Medium.**50 QA em mão responde 0 a 1 para corretão, pontuação com G-Eval, medida o RH entre juiz e humano.
3. **Hard.**Construir um portão de dados mais rápido com DeepEval. Regressar intencionalmente o retriever. Verificar que o portão falha. Adicionar alerta do quântil inferior através de verificação de limiar no 10% mais baixo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## Mais leitura

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217)O papel RAGAS.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634)- O papel G-Eval.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) Estaca de produção aberta.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)- Preconceitos, calibração, limites.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) estrutura unificadora que integra RAGAS, DeepEval, Phoenix.
