# Avaliação de Contexto Longo — NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro anuncia 10M tokens de contexto. Em 1M tokens, MRCR de 8-needles cai pra 26.3%. Anunciado ≠ utilizável. Avaliação de contexto longo diz a capacidade real do modelo no qual você está deployando.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 13 (Question-Answering), Fase 5 · 23 (Estratégias de Chunking)
**Tempo:** ~60 minutos

## O Problema

Você tem um contrato de 200 páginas. O modelo declara contexto de 1M tokens. Você cola o contrato e pergunta: "What is the termination clause?" O modelo responde — mas responde da capa porque a cláusula de rescisão fica a 120k tokens de profundidade, além de onde o modelo realmente atende.

Esse é o gap de capacidade de contexto de 2026. Fichas técnicas dizem 1M ou 10M. A realidade diz que 60-70% disso é utilizável, e "utilizável" depende da tarefa.

- **Retrieval (agulha no palheiro):** quase perfeito até o máximo anunciado em modelos de fronteira.
- **Multi-hop / agregação:** degrada drasticamente além de ~128k na maioria dos modelos.
- **Raciocínio sobre fatos dispersos:** a primeira tarefa a falhar.

Avaliação de contexto longo mede esses eixos. Essa lição lista os benchmarks, o que cada um realmente mede e como construir um teste de agulha customizado pro seu domínio.

## O Conceito

![Baseline NIAH, RULER multi-task, LongBench holístico](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).** Coloque um fato ("the magic word is pineapple") em profundidade controlada num contexto longo. Passe o modelo pra recuperá-lo. Varredura profundidade × comprimento. O benchmark original de contexto longo. Modelos de fronteira agora saturam isso; é um baseline necessário mas não suficiente.

**RULER (Nvidia, 2024).** 13 tipos de tarefa em 4 categorias: retrieval (single / multi-key / multi-value), multi-hop tracing (rastreamento de variáveis), agregação (frequência de palavra comum), QA. Comprimento de contexto configurável (4k a 128k+). Revela modelos que saturam NIAH mas falham em multi-hop. No lançamento de 2024, apenas metade dos 17 modelos que declaravam 32k+ manteve qualidade a 32k.

**LongBench v2 (2024).** 503 questões de múltipla escolha, contextos de 8k-2M palavras, seis categorias de tarefa: QA de doc único, QA multi-doc, aprendizado in-context longo, diálogo longo, repositório de código, dados estruturados longos. O benchmark de produção pra comportamento real de contexto longo.

**MRCR (Multi-Round Coreference Resolution).** Coreferência multi-turn em escala. Variantes de 8-needle, 24-needle, 100-needle. Mostra quantos fatos um modelo consegue equilibrar antes que a atenção degrade.

**NoLiMa.** "Agulha não-lexical." A agulha e a consulta não têm sobreposição literal; retrieval requer um passo de raciocínio semântico. Mais difícil que NIAH.

**HELMET.** Concatena muitos documentos, faz uma pergunta de qualquer um deles. Testa atenção seletiva.

**BABILong.** Embute cadeias de raciocínio bAbI em palheiros irrelevantes. Testa raciocínio-no-palheiro, não só retrieval.

### O que realmente reportar

- **Janela de contexto anunciada.** O número da ficha técnica.
- **Comprimento efetivo de retrieval.** Passagem do NIAH em algum limiar (ex: 90%).
- **Comprimento efetivo de raciocínio.** Passagem multi-hop ou de agregação nesse limiar.
- **Curva de degradação.** Acurácia vs comprimento de contexto, plotada por tipo de tarefa.

Dois números pra sua ficha técnica: retrieval-efetivo e raciocínio-efetivo. Geralmente o raciocínio-efetivo é 25-50% da janela anunciada.

## Construindo

### Passo 1: NIAH customizado pro seu domínio

Veja `code/main.py`. O esqueleto:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\\nQ: {question}\\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

Varra `depth_ratio` ∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens` ∈ {1k, 4k, 16k, 64k}. Plote o heatmap. Essa é a ficha NIAH pro modelo-alvo.

### Passo 2: variante multi-needle

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

Perguntas como "What are the three magic words?" requerem recuperar todas as três. Sucesso de agulha única não prevê sucesso de multi-needle.

### Passo 3: rastreamento de variáveis multi-hop (estilo RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

A resposta requer encadear três atribuições. Modelos de fronteira a 128k frequentemente caem pra 50-70% de acurácia aqui.

### Passo 4: LongBench v2 na sua stack

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\\n\\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

Reporte acurácia por categoria. Pontuações agregadas escondem diferenças grandes entre tarefas.

## Armadilhas

- **Avaliação só com NIAH.** Passar NIAH a 1M tokens não diz nada sobre multi-hop. Sempre rode RULER ou um teste multi-hop customizado.
- **Amostragem de profundidade uniforme.** Muitas implementações só testam depth=0.5. Teste depth=0, 0.25, 0.5, 0.75, 1.0 — o efeito "perdido no meio" é real.
- **Sobreposição lexical com filler.** Se a agulha compartilha palavras-chave com o filler, retrieval vira trivial. Use agulhas não-sobrepostas estilo NoLiMa.
- **Ignorar latência.** Prompts de 1M tokens levam 30-120 segundos pra prefill. Meça tempo-primeiro-token junto com acurácia.
- **Números autorrelatados de vendor.** OpenAI, Google, Anthropic todos publicam suas próprias pontuações. Sempre re-rode independente no seu caso de uso.

## Usar

A stack de 2026:

| Situação | Benchmark |
|-----------|-----------|
| Verificação rápida de sanidade | NIAH customizado em 3 profundidades × 3 comprimentos |
| Seleção de modelo pra produção | RULER (13 tarefas) no comprimento-alvo |
| Qualidade de QA do mundo real | Subset single-doc-QA do LongBench v2 |
| Raciocínio multi-hop | BABILong ou rastreamento de variáveis customizado |
| Conversacional / diálogo | MRCR 8-needle no comprimento-alvo |
| Regressão de atualização de modelo | NIAH + harness RULER fixos, rode em cada modelo novo |

Regra geral pra produção: nunca confie numa janela de contexto até ter NIAH + 1 tarefa de raciocínio no comprimento pretendido.

## Entregar

Salve como `outputs/skill-long-context-eval.md`:

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-consulta.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## Exercícios

1. **Fácil.** Construa um NIAH com 3 profundidades (0.25, 0.5, 0.75) × 3 comprimentos (1k, 4k, 16k). Rode em qualquer modelo. Plote taxa de passagem como heatmap 3×3.
2. **Médio.** Adicione uma variante de 3-needles. Meça a recuperação das 3 em cada comprimento. Compare com taxa de passagem de agulha única no mesmo comprimento.
3. **Difícil.** Construa uma tarefa de rastreamento de variáveis (X1 → X2 → X3, com 3 hops) embutida em 64k de filler. Meça acurácia em 3 modelos de fronteira. Reporte comprimento efetivo de raciocínio por modelo.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| NIAH | Agulha no palheiro | Plante um fato no filler, peça pro modelo recuperá-lo. |
| RULER | NIAH com esteroides | 13 tipos de tarefa em retrieval / multi-hop / agregação / QA. |
| Contexto efetivo | A capacidade real | Comprimento no qual a acurácia ainda se mantém acima do limiar. |
| Perdido no meio | Viés de profundidade | Modelos sub-atendem conteúdo no meio de entradas longas. |
| Multi-needle | Muitos fatos de uma vez | Múltiplas plantações; testa manuseio de atenção, não só retrieval. |
| MRCR | Coref multi-turn | Coreferência de 8, 24 ou 100 agulhas; expõe saturação de atenção. |
| NoLiMa | Agulha não-lexical | Agulha e consulta não compartilham tokens literais; requer raciocínio. |

## Leitura Complementar

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) — o repo original do NIAH.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) — o benchmark multi-task.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) — avaliação de contexto longo do mundo real.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) — agulhas mais difíceis.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) — raciocínio no palheiro.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) — o paper de viés de profundidade.
