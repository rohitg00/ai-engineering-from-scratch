# O acompanhamento do estado do diálogo

> "Quero um restaurante barato no norte... que seja moderado... e adicione italiano". Três turnos, três atualizações de estado.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## O problema

Em um sistema de diálogo orientado para tarefas, o objetivo do usuário é codificado como um conjunto de pares de valores de slots: `{cuisine: italian, area: north, price: moderate}`Cada turno de usuário pode adicionar, alterar ou remover um espaço. O sistema deve ler toda a conversa e emitir o estado atual corretamente.

Se você errar em um único slot, o sistema reserva o restaurante errado, agenda o voo errado ou carrega o cartão errado.

Por que ainda importa em 2026 apesar dos LLM:

- Os domínios sensíveis à conformidade (banco, saúde, reserva de companhias aéreas) exigem valores deterministas de slots, não geração de formas livres.
- Os agentes de uso de ferramentas ainda precisam de resolução de slots antes de ligar para as APIs.
- A correcção de várias voltas é mais difícil do que parece: "na verdade não, faça-o na quinta-feira".

O gasoduto moderno: conceitos clássicos de DST + extractores LLM + barris de saída estruturadas.

## O conceito

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**Um esquema define domínios (restaurante, hotel, táxi) e suas vagas (cozinha, área, preço, pessoas). Cada vagas pode ser vazio, preenchido com um valor de um conjunto fechado (preço: {barato, moderado, caro}), ou um valor de forma livre (nome: "The Copper Kettle").

**Two DST formulations.**

- **Classification.**Para cada par (slot, candidato_value), prever sim/não. Funciona para slots fechados. padrão pré-2020.
- **Generation.**Dado o diálogo, gerar valores de slots como texto livre. Funciona para slots de vocabulário aberto.

**Metric.**A precisão de metas conjuntas (JGA)  a fração de viradas em que * cada * slot é correto. Tudo ou nada. MultiWOZ 2.4 liderança tops em torno de 83% em 2026.

**Architectures.**

1. **Rule-based (slot regex + keyword).**Base forte para domínios estreitos.
2. **TripPy / BERT-DST.**Geração baseada em cópia com codificação BERT.
3. **LDST (LLaMA + LoRA).**LLM com instrução sintonizada com a solicitação de slots de domínio. Atinge a qualidade de nível ChatGPT no MultiWOZ 2.4.
4. **Ontology-free (2024–26).**Salte o esquema, gerar nomes e valores de slots diretamente.
5. **Prompt + structured output (2024–26).**LLM com esquema Pydantic + decodificação limitada. 5 linhas de código, prontas para produção.

### Os modos clássicos de falha

- **Co-reference across turns.**"Vamos ficar com a primeira opção". Precisamos de resolver qual opção.
- **Over-write vs append.**O usuário diz " acrescentar italiano". Você substitui a cozinha ou acrescenta?
- **Implicit confirmations.**"Ok, está bem". Aceitou a reserva?
- **Correction.**"De fato, é às 7 da tarde". Tem de atualizar a hora sem limpar outras vagas.
- **Coreference to previous system utterance.**"Sim, aquele". Que "que"?

```figure
n5-slot-tracker
```

## Construí-lo

### Passo 1: Extractor de slots baseado em regras

Veja .`code/main.py`. Os dicionários de regex + sinônimos cobrem 70% das declarações canônicas em domínios estreitos:

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

Falta o vocabulário canônico, funciona para confirmações deterministas.

### Passo 2: Loop de atualização de estado

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

Três invariantes:

- Nunca restabeleça um espaço que o usuário não tocou.
- A negação explícita ("não se importa com a cozinha") deve ser clara.
- A correcção do utilizador ("realmente...") deve ser substituída, não adjunta.

### Passo 3: DST orientado pela LLM com saída estruturada

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

O Instructor + Pydantic garante um objeto de estado válido, sem regex, sem desajustes de esquema, sem slots alucinados.

### Passo 4: Avaliação da JGA

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Calibração: que fração de viradas o sistema consegue todas as slots corretas? Para MultiWOZ 2.4, os sistemas 2026 mais importantes: 80-83%.

### Passo 5: correcção de manuseio

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

Em uma correção detectada, reescrever o último espaço atualizado em vez de anexar. É difícil de obter certo sem a ajuda do LLM. O padrão moderno: sempre deixe o LLM regenerar todo o estado da história em vez de atualizar gradualmente.

## Encurralagens

- **Full-history regeneration cost.**Deixar o Mestrado em Direito Regenerar-se cada vez mais custa $O(n^2)$- História de cap ou resumo de voltas mais antigas.
- **Schema drift.**Adicionar novos slots pós-hoc rompe dados antigos do treinamento.
- **Case sensitivity.**"Itálico" vs. "Itálico" vs. "ITALIANO" normalizam-se em todos os lugares.
- **Implicit inheritance.**Se o utilizador tiver especificado anteriormente "para 4 pessoas", uma nova solicitação para um tempo diferente não deve eliminar pessoas.
- **Free-form vs closed-set.**Os nomes, horários e endereços precisam de espaços de forma livre; cozinhas e áreas estão fechadas.

## Usá-lo

A pilha de 2026:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## Envia-o

Salva como`outputs/skill-dst-designer.md`- Não .

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## Exercícios

1. **Easy.**Construir o rastreador de estado baseado em regras em `code/main.py`Para 3 slots (cozinha, área, preço).
2. **Medium.**O mesmo conjunto de dados com o Instructor + Pydantic + um pequeno LLM. Compare JGA.
3. **Hard.**Implementar ambos e rota: primária baseada em regras, LLM fallback quando baseada em regras emite < 2 slots com confiança.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## Mais leitura

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) o critério de referência canônico.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) Ajuste de instruções LLaMA + LoRA para DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) o cavalo de trabalho DST baseado em cópias.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) TOD sem supervisão baseada em EM.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) resultados canônicos da DST.
