# Outputes estruturadas e decodificação restrita

> Peça um LLM para JSON. Obtenha JSON a maior parte do tempo. Na produção, "a maioria" é o problema. A decodificação restrita transforma "a maioria" em "sempre" editando os logits antes da amostragem.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## O problema

Um classificador pede um LLM: "Retorna um de {positivo, negativo, neutro}." O modelo retorna "O sentimento é positivo  esta revisão é esmagadoramente favorável porque o cliente afirma explicitamente que eles ...". Seu parser falha.

A geração de formas livres não é um contrato, é uma sugestão.

Existem três camadas em 2026.

1. **Prompting.**Pergunte bem. "Retorna apenas o objeto JSON". Funciona cerca de 80% em modelos de fronteira, menos em modelos menores.
2. **Native structured output APIs.**OpenAI `response_format`, Utilização de ferramentas antropóficas, modo JSON Gemini, confiável em esquemas suportados, bloqueado pelo fornecedor.
3. **Constrained decoding.**Modifique os logits em cada etapa de geração para que o modelo *não possa* emitir tokens inválidos. 100% válido por construção. Funciona em qualquer modelo local.

Esta lição constrói a intuição para os três e nomes para quando alcançar.

## O conceito

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**A cada etapa de geração, o LLM produz um vetor logit sobre o vocabulário completo (~ 100k tokens). Um processador logit fica entre o modelo e o amostragem. Ele calcula quais tokens são válidos dada a posição atual na gramática-alvo  JSON Schema, regex, gramática livre de contexto  e define as logitas de todos os tokens inválidos para infinito negativo. O softmax sobre os logits restantes coloca a massa de probabilidade apenas em continuidades válidas.

Implementações em 2026:

- **Outlines.**Compila JSON Schema ou regex em uma máquina de estado finito.$O(1)$Baseado no FSM, os esquemas recorrentes precisam ser aplanados.
- **XGrammar / llguidance.**Engenharia de gramática livre de contexto. Manusei esquema JSON recursivo. Descodagem quase zero. OpenAI creditou a orientação em sua implementação de saída estruturada de 2025.
- **vLLM guided decoding.**- Incorporado .`guided_json`- Não .`guided_regex`- Não .`guided_choice`- Não .`guided_grammar`através de contornos, XGrammar, ou backends de formato Im-enforcer.
- **Instructor.**Envolvimento baseado em Pydantic sobre qualquer LLM. Retracções em falhas de validação. Cross-provider, mas não modifica logits  ele depende de retracções + instruções estruturadas de consciência de saída.

### O resultado contraditório

A decodificação restrita é muitas vezes mais rápida do que a geração sem restrições. Duas razões. Primeiro, reduz o espaço de pesquisa do próximo token. Segundo, implementações inteligentes ignoram a geração de tokens inteiramente para tokens forçados (establojamento como `{"name": "` cada byte é determinado).

### A armadilha que te custa

A ordem no campo é importante.`answer`Antes de`reasoning`O modelo compromete-se a uma resposta antes de pensar. JSON é válido. A resposta é errada. Nenhuma validação a pega.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

A ordem de campo do esquema é lógica, não formatação.

```figure
constrained-decoder
```

## Construí-lo

### Passo 1: geração restringida regex a partir do zero

Veja .`code/main.py`A ideia central é de 30 linhas:

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

O FSM acompanha quais partes da gramática que já se encontraram satisfeitas. `valid_tokens(state, tokenizer)`Computa quais são os tokens de vocabulário que podem avançar no FSM sem deixar um caminho de aceitação.

### Passo 2: Esboços para JSON Schema

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

O FSM torna a saída inválida inacessível.

### Passo 3: Instrutor para Pydantic, agnóstico do fornecedor

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

O instrutor não toca logits. Ele forma o esquema no prompt, analisa a saída e retrata falhas de validação (default 3 vezes). Funciona com qualquer provedor. Retrains adicionam latência e custo.

### Passo 4: APIs nativas de fornecedores

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

Descrição limitada do lado do servidor. Paridade de confiabilidade com Outlines para esquemas suportados. Sem gerenciamento local de modelos.

## Encurralagens

- **Recursive schemas.**Os resultados estruturados em árvores (comentários aninhados, AST) precisam de XGrammar ou de orientação (baseada em CFG).
- **Huge enums.**O enum de 10 mil opções é compilado lentamente ou vezes fora.
- **Grammar too strict.**Força .`date: "YYYY-MM-DD"`Regex e modelo não podem ser emitidos `"unknown"`O modelo compensa inventando uma data.`null`Ou um sentinela.
- **Premature commitment.**Veja a armadilha de ordem de campo acima.
- **Vendor JSON mode without schema.**O modo JSON puro só garante JSON válido, não válido *para o seu caso de uso*. Sempre forneça um esquema completo.

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## Envia-o

Salva como`outputs/skill-structured-output-picker.md`- Não .

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
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## Exercícios

1. **Easy.**Promover um pequeno modelo de pesos abertos (por exemplo, Llama-3.2-3B) sem restrições de decodificação para `Review(sentiment, confidence, evidence_span)`- Meter a fração que analisa como JSON válido em 100 avaliações.
2. **Medium.**O mesmo corpus com o modo JSON Outlines. Compare a taxa de conformidade, latência e precisão semântica.
3. **Hard.**Implementar um decodificador com restrição regex a partir do zero para números de telefone (`\d{3}-\d{3}-\d{4}`) Verificar 0 resultados inválidos em 1000 amostras.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## Mais leitura

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) O artigo Outlines.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) Descodagem limitada rápida baseada em CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) Integração do servidor de inferência.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) Referência API + gotchas.
- [Instructor library](https://python.useinstructor.com/) Pydantic + retrata os fornecedores.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) comparativa de 6 estruturas de decodificação restritas.
