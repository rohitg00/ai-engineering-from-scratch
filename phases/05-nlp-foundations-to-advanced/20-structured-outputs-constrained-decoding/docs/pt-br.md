# Saídas Estruturadas e Decodificação Restrita

> Pede JSON pra um LLM. Recebe JSON a maior parte do tempo. Em produção, "maior parte" é o problema. Decodificação restrita transforma "maior parte" em "sempre" editando os logits antes da amostragem.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 17 (Chatbots), Fase 5 · 19 (Tokenização Subword)
**Tempo:** ~60 minutos

## O Problema

Um classificador pergunta pra um LLM: "Retorne um de {positive, negative, neutral}." O modelo retorna "The sentiment is positive — this review is overwhelmingly favorable because the customer explicitly states that they ...". Seu parser trava. A acurácia F1 do seu classificador é 0.0.

Geração em texto livre não é contrato. É sugestão. Um sistema de produção precisa de contrato.

Três camadas existem em 2026.

1. **Prompting.** Peça educadamente. "Retorne apenas o objeto JSON." Funciona ~80% em modelos de fronteira, menos em menores.
2. **APIs nativas de saída estruturada.** `response_format` da OpenAI, uso de ferramentas da Anthropic, modo JSON do Gemini. Confiável em schemas suportados. Travado no vendor.
3. **Decodificação restrita.** Modifica os logits a cada passo de geração pra que o modelo *não possa* emitir tokens inválidos. 100% válido por construção. Funciona em qualquer modelo local.

Essa lição constrói intuição pras três e diz quando usar qual.

## O Conceito

![Decodificação restrita mascarando tokens inválidos a cada passo](../assets/constrained-decoding.svg)

**Como a decodificação restrita funciona.** A cada passo de geração, o LLM produz um vetor de logits sobre o vocabulário inteiro (~100k tokens). Um *processador de logits* fica entre o modelo e o sampler. Ele calcula quais tokens são válidos dada a posição atual na gramática-alvo — JSON Schema, regex, gramática livre de contexto — e define os logits de todos os tokens inválidos como menos infinito. O softmax sobre os logits restantes coloca massa de probabilidade apenas em continuações válidas.

Implementações em 2026:

- **Outlines.** Compila JSON Schema ou regex numa máquina de estados finitos. Cada token recebe uma busca O(1) pro próximo token válido. Baseado em FSM, então schemas recursivos precisam de flattening.
- **XGrammar / llguidance.** Motores de gramática livre de contexto. Lidam com JSON Schema recursivo. Overhead de decodificação quase zero. A OpenAI creditou llguidance na implementação de saídas estruturadas de 2025.
- **Decodificação guiada do vLLM.** `guided_json`, `guided_regex`, `guided_choice`, `guided_grammar` via backends Outlines, XGrammar ou lm-format-enforcer.
- **Instructor.** Wrapper baseado em Pydantic sobre qualquer LLM. Retenta em falha de validação. Cross-provider, mas não modifica logits — depende de retentativas + prompts conscientes de saída estruturada.

### O resultado contra-intuitivo

Decodificação restrita frequentemente é *mais rápida* que geração irrestrita. Duas razões. Primeiro, diminui o espaço de busca do próximo token. Segundo, implementações inteligentes pulam a geração de tokens pra tokens forçados (scaffolding como `{"name": "` — cada byte é determinado).

### A armadilha que custa

A ordem dos campos importa. Coloque `answer` antes de `reasoning` e o modelo comete-se a uma resposta antes de pensar. JSON é válido. Resposta está errada. Nenhuma validação pega isso.

```json
// ERRADO
{"answer": "yes", "reasoning": "because ..."}

// CERTO
{"reasoning": "... therefore ...", "answer": "yes"}
```

A ordem dos campos do schema é lógica, não formatação.

## Construindo

### Passo 1: geração restrita por regex do zero

Veja `code/main.py` pra uma implementação FSM independente. A ideia central em 30 linhas:

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

O FSM rastreia quais partes da gramática já foram satisfeitas. `valid_tokens(state, tokenizer)` calcula quais tokens do vocabulário podem avançar o FSM sem sair de um caminho aceitante.

### Passo 2: Outlines pra JSON Schema

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

Zero erros de validação. Nunca. O FSM torna saída inválida inalcançável.

### Passo 3: Instructor pra Pydantic agnóstico de provider

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

Mecanismo diferente. Instructor não toca nos logits. Formata o schema no prompt, parseia a saída e retenta em falha de validação (padrão 3 vezes). Funciona com qualquer provider. Retentativas adicionam latência e custo. Portabilidade cross-provider é o ponto de venda.

### Passo 4: APIs nativas de vendor

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

Decodificação restrita do lado do servidor. Paridade de confiabilidade com Outlines pra schemas suportados. Sem gerenciamento de modelo local. Trava no vendor.

## Armadilhas

- **Schemas recursivos.** Outlines achata a recursão pra uma profundidade fixa. Saídas com estrutura de árvore (comentários aninhados, AST) precisam de XGrammar ou llguidance (baseados em CFG).
- **Enums enormes.** Enum com 10.000 opções compila lentamente ou dá timeout. Mude pra um retriever: prevê top-k candidatos primeiro, restringe a esses.
- **Gramática rigorosa demais.** Força regex `date: "YYYY-MM-DD"` e o modelo não consegue produzir `"unknown"` pra datas faltantes. O modelo compensa inventando uma data. Permita `null` ou um sentinela.
- **Comprometimento prematuro.** Veja a armadilha da ordem de campos acima. Sempre coloque reasoning primeiro.
- **Modo JSON de vendor sem schema.** Modo JSON puro só garante JSON válido, não válido *pro seu caso de uso*. Sempre forneça um schema completo.

## Usar

A stack de 2026:

| Situação | Escolha |
|-----------|------|
| Modelo OpenAI/Anthropic/Google, schema simples | Saída estruturada nativa do vendor |
| Qualquer provider, workflow Pydantic, tolera retentativas | Instructor |
| Modelo local, precisa 100% de validade, schema plano | Outlines (FSM) |
| Modelo local, schema recursivo | XGrammar ou llguidance |
| Servidor de inferência self-hosted | Decodificação guiada do vLLM |
| Processamento em batch com retentativas aceitáveis | Instructor + modelo mais barato |

## Entregar

Salve como `outputs/skill-structured-output-picker.md`:

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, reserva model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema conformidade rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## Exercícios

1. **Fácil.** Faça prompting num modelo de pesos abertos pequeno (ex: Llama-3.2-3B) sem decodificação restrita pra `Review(sentiment, confidence, evidence_span)`. Meça a fração que parseia como JSON válido em 100 reviews.
2. **Médio.** Mesmo corpus com modo JSON do Outlines. Compare taxa de conformidade, latência e acurácia semântica.
3. **Difícil.** Implemente um decodificador restrito por regex do zero pra números de telefone (`\d{3}-\d{3}-\d{4}`). Verifique 0 saídas inválidas em 1000 amostras.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| Decodificação restrita | Forçar saída válida | Mascarar logits de tokens inválidos a cada passo de geração. |
| Processador de logits | A coisa que restringe | Função: `(logits, state) -> masked_logits`. |
| FSM | Máquina de estados finitos | Representação de gramática compilada; busca O(1) pro próximo token válido. |
| CFG | Gramática livre de contexto | Gramática que lida com recursão; mais lenta mas mais expressiva que FSM. |
| Ordem dos campos do schema | Importa? | Sim — o primeiro campo compromete; sempre coloque reasoning antes de answer. |
| Decodificação guiada | Nome do vLLM pra isso | Mesmo conceito, integrado ao servidor de inferência. |
| Modo JSON | Versão antiga da OpenAI | Garante sintaxe JSON; NÃO garante compatibilidade com schema. |

## Leitura Complementar

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) — o paper do Outlines.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) — decodificação restrita rápida baseada em CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) — integração com servidor de inferência.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) — referência de API + pegadinhas.
- [Instructor library](https://python.useinstructor.com/) — Pydantic + retentativas cross-provider.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) — benchmark de 6 frameworks de decodificação restrita.
