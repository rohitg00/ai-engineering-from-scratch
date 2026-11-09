# Avaliação de longo contexto  NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro anuncia 10 milhões de tokens de contexto. Em 1 milhão de tokens, o MRCR de 8 agulhas cai para 26,3%. Publicado ≠ utilizável. Avaliação de longo contexto diz a capacidade real do modelo que você está enviando.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## O problema

Você tem um contrato de 200 páginas. O modelo reivindica um contexto de 1M-token. Você coleta o contrato e pergunta: "O que é a cláusula de rescisão?" O modelo responde , mas responde da página de capa porque a cláusula de rescisão fica em 120k tokens profundidade, além de onde o modelo realmente atende.

Esta é a lacuna de capacidade de contexto de 2026. As folhas de especificações dizem 1M ou 10M. A realidade diz que 60-70% disso é utilizável, e "utilizavel" depende da tarefa.

- **Retrieval (single needle in haystack):**- quase perfeito até ao máximo anunciado nos modelos de fronteira.
- **Multi-hop / aggregation:**degradação acentuada acima de ~ 128k na maioria dos modelos.
- **Reasoning over dispersed facts:**A primeira tarefa a falhar.

A avaliação de longo contexto mede esses eixos. Esta lição nomeia os pontos de referência, o que cada um mede realmente e como construir um teste de agulha personalizado para o seu domínio.

## O conceito

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**Coloque um fato ("a palavra mágica é o abacaxi") em uma profundidade controlada em um contexto longo. Peça ao modelo para recuperá-lo. Esfole profundidade × comprimento. O referência original de longo contexto.

**RULER (Nvidia, 2024).**13 tipos de tarefas em 4 categorias: recuperação (single / multi-key / multi-value), rastreamento multi-hop (tracking de variáveis), agregação (frequência de palavras comuns), QA. Comprimento de contexto configurável (4k a 128k +). Reveles modelos que saturam o NIAH, mas falham no multi-hop.

**LongBench v2 (2024).**503 perguntas de escolha múltipla, contextos de palavras 8k-2M, seis categorias de tarefas: QA single-doc, QA multi-doc, aprendizagem longa no contexto, diálogo longo, repo de código, dados estruturados longos.

**MRCR (Multi-Round Coreference Resolution).**Coreferência de várias voltas em escala, variantes de 8 agulhas, 24 agulhas, 100 agulhas, expõe quantos fatos um modelo pode fazer malabarismo antes que a atenção se degrada.

**NoLiMa.**"Agulha não-léxica". A agulha e a consulta não compartilham sobreposição literal; a recuperação requer um passo de raciocínio semântico.

**HELMET.**Concatena muitos documentos, faz uma pergunta a qualquer um, testa a atenção seletiva.

**BABILong.**Entra em cadeias de raciocínio dentro de pilhas de feno irrelevantes.

### O que é que realmente deve ser relatado

- **Advertised context window.**O número da folha de especificações.
- **Effective retrieval length.**A NIAH passa a um determinado limiar (por exemplo, 90%).
- **Effective reasoning length.**O multi-hop ou a agregação passa nesse limiar.
- **Degradation curve.**Precisão vs comprimento do contexto, traçado por tipo de tarefa.

Os números para a sua ficha de especificações: efetiva de recuperação e eficaz de raciocínio.

```figure
gx-niah-decay
```

## Construí-lo

### Passo 1: um NIAH personalizado para o seu domínio

Veja .`code/main.py`O esqueleto:

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
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

Esvaziar`depth_ratio`∈ {0, 0,25, 0,5, 0,75, 1,0} × `total_tokens`Traçar o heatmap. É o cartão NIAH para o seu modelo alvo.

### Passo 2: variante multiagulha

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

Perguntas como "Quais são as três palavras mágicas?" exigem recuperar todas as três.

### Passo 3: rastreamento de variáveis multi-hop (estilo RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

Os modelos de linha de frente com 128k frequentemente caem para 50-70% de precisão aqui.

### Passo 4: LongBench v2 na sua pilha

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

As pontuações agregadas escondem grandes diferenças no nível das tarefas.

## Encurralagens

- **NIAH-only evaluation.**Passar o NIAH com 1M tokens não diz nada sobre multi-hop.
- **Uniform depth sampling.**Muitas implementações apenas testam profundidade = 0,5.
- **Lexical overlap with filler.**Se a agulha compartilhar palavras-chave com o preenchimento, a recuperação se torna trivial.
- **Ignoring latency.**As instruções de 1M-token levam 30-120 segundos para preencher.
- **Vendor-self-reported numbers.**OpenAI, Google, Anthropic, todos publicam as suas próprias pontuações.

## Usá-lo

A pilha de 2026:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

Regra geral para a produção: nunca confie numa janela de contexto até que tenha a tarefa de raciocínio NIAH + 1 no seu comprimento previsto.

## Envia-o

Salva como`outputs/skill-long-context-eval.md`- Não .

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
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## Exercícios

1. **Easy.**Construir um NIAH com 3 profundidades (0,25, 0,5, 0,75) × 3 comprimentos (1k, 4k, 16k).
2. **Medium.**Adicione uma variante de 3 agulhas. Messa a recuperação de todas as 3 em cada comprimento. Compare com a taxa de passagem de uma agulha no mesmo comprimento.
3. **Hard.**Construa uma tarefa de rastreamento de variáveis (X1 → X2 → X3, com 3 saltos) incorporada em 64k de preenchimento. Messa a precisão em 3 modelos de fronteira. Relate comprimento de raciocínio eficaz por modelo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## Mais leitura

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack)O repo original da NIAH.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) o índice de referência multi-tarefa.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) Avaliação de contexto longo no mundo real.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666)Agulhas mais duras.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149)Raciocínio em palha de feno.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) o papel de preconceito de profundidade.
