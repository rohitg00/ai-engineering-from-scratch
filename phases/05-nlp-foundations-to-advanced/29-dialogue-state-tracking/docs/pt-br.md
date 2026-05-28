# Dialogue State Tracking

> "Eu quero um restaurante barato no norte... na verdade, moderately... e adicione italiano." Três turnos, três atualizações de estado. DST mantém o dicionário slot-valor sincronizado pra que a reserva funcione.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 17 (Chatbots), Fase 5 · 20 (Saídas Estruturadas)
**Tempo:** ~75 minutos

## O Problema

Num sistema de diálogo orientado a tarefa, o objetivo do usuário é codificado como um conjunto de pares slot-valor: `{cuisine: italian, area: north, price: moderate}`. Cada turno do usuário pode adicionar, alterar ou remover um slot. O sistema precisa ler a conversa inteira e sair com o estado atual correto.

Erra um único slot e o sistema reserva o restaurante errado, agenda o voo errado ou cobra o cartão errado. DST é a dobradiça entre o que o usuário disse e o que o backend executa.

Por que ainda importa em 2026 apesar dos LLMs:

- Domínios sensíveis a conformidade (banco, saúde, reserva de passagens) requerem valores de slot determinísticos, não geração em texto livre.
- Agentes com uso de ferramentas ainda precisam de resolução de slot antes de chamar APIs.
- Correção multi-turn é mais difícil do que parece: "actually no, make it Thursday."

O pipeline moderno: conceitos clássicos de DST + extratores LLM + guardrails de saída estruturada.

## O Conceito

![DST: histórico de diálogo → estado slot-valor](../assets/dst.svg)

**Estrutura da tarefa.** Um schema define domínios (restaurante, hotel, táxi) e seus slots (cuisine, area, price, people). Cada slot pode estar vazio, preenchido com um valor de um conjunto fechado (price: {cheap, moderate, expensive}) ou um valor livre (name: "The Copper Kettle").

**Duas formulações de DST.**

- **Classificação.** Pra cada par (slot, candidate_value), prevê sim/não. Funciona pra slots de vocabulário fechado. Padrão pré-2020.
- **Geração.** Dado o dialogue, gere valores de slots como texto livre. Funciona pra slots de vocabulário aberto. O padrão moderno.

**Métrica.** Joint Goal Accuracy (JGA) — fração de turnos onde *cada* slot está correto. Tudo-ou-nada. O ranking do MultiWOZ 2.4 chega a ~83% em 2026.

**Arquiteturas.**

1. **Baseada em regras (slot regex + keyword).** Baseline forte pra domínios estreitos. Debugável.
2. **TripPy / BERT-DST.** Geração baseada em cópia com encoding BERT. Padrão pré-LLM.
3. **LDST (LLaMA + LoRA).** LLM com fine-tuning de instrução e prompting de domínio-slot. Alça qualidade de nível ChatGPT no MultiWOZ 2.4.
4. **Sem ontologia (2024–26).** Pule o schema; gere nomes e valores de slots diretamente. Lida com domínios abertos.
5. **Prompt + saída estruturada (2024–26).** LLM com schema Pydantic + decodificação restrita. 5 linhas de código, pronto pra produção.

### Os modos clássicos de falha

- **Coreferência entre turnos.** "Let's stay with the first option." Precisa resolver qual opção.
- **Sobrescrever vs anexar.** O usuário diz "add Italian." Você substitui a cozinha ou anexa?
- **Confirmações implícitas.** "OK cool" — aquilo aceitou a reserva oferecida?
- **Correção.** "Actually make it 7 pm." Precisa atualizar horário sem limpar outros slots.
- **Coreferência pra fala anterior do sistema.** "Yes, that one." Qual "aquele"?

## Construindo

### Passo 1: extrator de slots baseado em regras

Veja `code/main.py`. Regex + dicionários de sinônimos cobrem 70% das enunciações canônicas em domínios estreitos:

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

Frágil fora do vocabulário canônico. Funciona pra confirmações de slot determinísticas.

### Passo 2: loop de atualização de estado

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

- Nunca redefina um slot que o usuário não tocou.
- Negação explícita ("never mind the cuisine") deve limpar.
- Correção do usuário ("actually...") deve sobrescrever, não anexar.

### Passo 3: DST guiado por LLM com saída estruturada

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

Instructor + Pydantic garante um objeto de estado válido. Sem regex, sem incompatibilidades de schema, sem slots alucinados.

### Passo 4: avaliação de JGA

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Calibre: que fração de turnos o sistema acerta TODOS os slots? No MultiWOZ 2.4, os melhores sistemas de 2026: 80-83%. Seu sistema de domínio deve superar isso no seu vocabulário estreito ou o baseline LLM te vence.

### Passo 5: tratamento de correção

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

Numa correção detectada, sobrescreva o último slot atualizado em vez de anexar. Difícil de acertar sem ajuda de LLM. O padrão moderno: sempre deixe o LLM regenerar o estado inteiro a partir do histórico em vez de atualizar incrementalmente — isso lida naturalmente com correções.

## Armadilhas

- **Custo de regeneração de histórico completo.** Deixar o LLM regenerar estado a cada turno custa O(n²) em tokens no total. Limite o histórico ou resuma turnos mais antigos.
- **Drift de schema.** Adicionar novos slots depois quebra dados de treino antigos. Versione seu schema.
- **Sensibilidade a caixa.** "Italian" vs "italian" vs "ITALIAN" — normalize em todo lugar.
- **Herança implícita.** Se o usuário já eespecificaçãoificou "for 4 people," um pedido novo pra horário diferente não deve limpar people. Sempre passe o histórico completo.
- **Livre vs conjunto fechado.** Nomes, horários e endereços precisam de slots livres; cozinhas e áreas são fechados. Misture os dois no schema.

## Usar

A stack de 2026:

| Situação | Abordagem |
|-----------|----------|
| Domínio estreito (uma ou duas intenções) | Baseado em regras + regex |
| Domínio amplo, dados rotulados disponíveis | LDST (LLaMA + LoRA em dados estilo MultiWOZ) |
| Domínio amplo, sem rótulos, pronto pra prod | LLM + Instructor + schema Pydantic |
| Fala / voz | ASR + normalizador + LLM-DST |
| Fluxo de reserva multi-domínio | LLM guiado por schema com modelos Pydantic por domínio |
| Sensível a conformidade | Primário baseado em regras, reserva LLM com fluxo de confirmação |

## Entregar

Salve como `outputs/skill-dst-designer.md`:

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, conformidade needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for conformidade-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## Exercícios

1. **Fácil.** Construa o rastreador de estado baseado em regras em `code/main.py` pra 3 slots (cuisine, area, price). Teste em 10 diálogos feitos à mão. Meça JGA.
2. **Médio.** Mesmo dataset com Instructor + Pydantic + um LLM pequeno. Compare JGA. Inespecificaçãoione os turnos mais difíceis.
3. **Difícil.** Implemente ambos e faça roteamento: primário baseado em regras, reserva LLM quando o baseado em regras emite <2 slots com confiança. Meça o JGA combinado e custo de inferência por turno.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| DST | Rastreamento de estado de diálogo | Mantenha o dicionário slot-valor sincronizado entre turnos de diálogo. |
| Slot | Unidade de intenção do usuário | Parâmetro nomeado que o backend precisa (cuisine, date). |
| Domínio | A área da tarefa | Restaurante, hotel, táxi — conjuntos de slots. |
| JGA | Joint Goal Accuracy | Fração de turnos onde cada slot está correto. Tudo-ou-nada. |
| MultiWOZ | O benchmark | Dataset multi-domínio WOZ; avaliação padrão de DST. |
| DST sem ontologia | Sem schema | Gere nomes e valores de slots diretamente, sem lista fixa. |
| Correção | "Actually..." | Turno que sobrescreve um slot preenchido anteriormente. |

## Leitura Complementar

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) — o benchmark canônico.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) — fine-tuning de instrução LLaMA + LoRA pra DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) — workhorse de DST baseado em cópia.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) — TOD não-supervisionado baseado em EM.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) — resultados canônicos de DST.
