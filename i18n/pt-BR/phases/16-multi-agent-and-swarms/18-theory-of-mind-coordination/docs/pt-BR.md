# Teoria da Mente e Coordenação Emergente

> Li et al. (arXiv:2310.10701) mostraram que os agentes de LLM numa exposição de jogo de texto cooperativa **emergent high-order Theory of Mind**(ToM)  raciocínio sobre o que outro agente acredita sobre as crenças de um terceiro agente  mas falha no planejamento de longo horizonte devido ao gerenciamento de contexto e alucinação. Riedl (arXiv:2510.05174) mediu sinergia de ordem superior em uma população e descobriu que **only**A condição de ToM-prompt produz diferenciação ligada à identidade e complementaridade orientada para os objetivos; as LLM de baixa capacidade apresentam apenas uma emergência falsa. Isto é, a emergência da coordenação é imediatamente condicional e depende do modelo, não gratuita. Esta lição implementa um agente minimalista consciente de TOM, executa uma tarefa cooperativa com e sem o Instrução de TOM, e mede o delta de coordenação em relação ao protocolo Riedl 2025.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Problemas

A coordenação multi-agente geralmente parece mágica: os agentes dividem o trabalho, antecipam-se uns aos outros, evitam a redundância. Geralmente, esta "emergência" é um artefato da engenharia de prompt  alguém disse aos agentes para "coordenar".

A conclusão de Riedl de 2025 é mais rigorosa: sob condições controladas, a coordenação só surge quando os agentes são convidados a raciocinar sobre **other agents' minds**(ToM). Sem o comando de ToM, mesmo modelos fortes mostram padrões de coordenação que não sobrevivem aos controles estatísticos.

Esta lição trata o ToM como uma capacidade específica (razão sobre crenças sobre crenças), constrói um agente mínimo consciente do ToM e mede como é a coordenação real versus como é a vestimenta rápida.

## Conceptos

### O que significa ToM

Psicologia do desenvolvimento: uma criança de 3 anos pensa que o mundo interior de qualquer pessoa corresponde ao seu. Uma criança de 5 anos entende que os outros têm crenças diferentes. Uma criança de 7 anos explica as crenças sobre crenças ("ela acha que eu acho que a bola está sob o copo").

Para os agentes da LLM, a ToM ordena um mapa para:

- **Zeroth-order:**O agente só age com base nas suas próprias observações.
- **First-order:**"Alice acredita em X".
- **Second-order:**"Alice acredita que o Bob acredita em X".

Li et al. 2023 descobriram que a ToM de primeira e segunda ordem surgem em agentes LLM em jogos cooperativos, mas se degradam com um longo horizonte e comunicação pouco confiável.

### O teste Sally-Anne, em resumo

Um teste de crença falsa de 1985: Sally coloca um mármore na cesta A, deixa. Anne o move para a cesta B. Onde Sally vai olhar quando ela voltar? Uma criança com ToM de primeira ordem diz cesta A (a crença de Sally difere da realidade).

Os LLM da era GPT-4 passam testes de estilo Sally-Anne quando posados de forma clara. Eles falham quando a narrativa é longa, a cena muda várias vezes ou a pergunta é formulada indiretamente. Esse é o estado prático de 2026 do ToM em LLM de produção.

### Medida de coordenação da Riedl

Riedl (arXiv:2510.05174) construiu um teste em escala populacional: N agentes, um objectivo cooperativo, condições de prontidão variáveis.

1. **Identity-linked differentiation.**Os agentes desenvolvem diferenças de papel estáveis ao longo do tempo?
2. **Goal-directed complementarity.**As acções dos agentes complementam-se (subtarefas diferentes) em vez de duplicarem-se?
3. **Higher-order synergy.**Uma medida estatística de se o grupo consegue o que nenhum subconjunto poderia.

Resultado: somente sob a condição de ToM prompt, todas as três métricas produzem sinal acima da linha de base. Sem ToM prompt, as métricas flutuam perto da chance para modelos de capacidade moderada.

### A ilusão de coordenação

Sem controles estatísticos, a "coordenação emergente" nas demonstrações muitas vezes reflete:

- Engenharia rápida que se baseia em coordenação (comunações de sistema que dizem "trabalhar juntos").
- Bias de observadores (vemos padrões que esperamos).
- Seleção de corridas bem sucedidas após o hockey.

Os sistemas de produção que comercializam a "coordenação emergente" sem sinal mensurável devem ser tratados como comercializados.

### Um agente minimamente consciente de TOM

Estrutura:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

O `other_models`O atributo é o estado ToM. O primeiro ordenamento ToM mantém apenas um nível.`other_models[i][other_models_of_j]`O que eu acho que o Agente J acredita.

### Por que o longo horizonte dói

Li et al. documento: limites de contexto fazem com que os agentes esqueçam qual crença pertence a quem. A alucinação adiciona crenças falsas a outros modelos de agentes. Ambos produzem erros "Eu pensei que ele pensava X" que se compõem ao longo do tempo.

As medidas de mitigação documentadas no documento e em seguimento em 2024-2026:

- **Explicit ToM state in the prompt.**Formatos estruturados: `{agent_id: belief_list}`Força a recuperação para preservar a vinculação entre identidade e crença.
- **Shorter reasoning chains.**Menos atualizações de ToM por turno reduzem a alucinação composta.
- **External ToM store.**Manter o modelo fora do contexto do MLL; injetar apenas partes relevantes por turno.

### Quando a ToM falhar na produção

- **Adversarial settings.**Os agentes com boa ToM são mais fáceis de manipular (você pode modelar o que eles modelam de você, depois explorar).
- **Heterogeneous teams.**Quando os modelos são diferentes, o modelo ToM que funciona para um oponente não generaliza.
- **Ground-truth-dependent tasks.**A TOM é sobre crenças; se a correcção depende dos fatos, a TOM pode ser uma distração.

### A coordenação que você pode realmente medir

Três sinais práticos que a coordenação de uma equipa é real, em vez de vestida de forma rápida:

1. **Complementarity over time.**Em uma tarefa de várias rotas, as ações dos agentes cobrem sub-tarefas dissociadas?
2. **Anticipation.**A ação do agente A na virada T + 1 depende de uma previsão sobre a ação de B em T + 2 que resultou correta?
3. **Correction.**Quando A interpreta erroneamente a crença de B na curva T, A corrige com a curva T + 2?

Estes são mensuráveis num sistema de multi-agentes registados. São a versão substancial da narrativa de "coordenação".

```figure
sw-theory-of-mind
```

## Construí-lo

`code/main.py`Implementos:

- `ToMAgent` acompanha as próprias crenças e os modelos de crenças de cada agente.
- Uma tarefa cooperativa: três agentes devem coletar três tokens de três caixas; cada caixa pode conter um token.
- Duas configurações: `zeroth_order`(sem TOM) e `first_order`(ToM com modelo de crença de nível único).
- Medida de 200 ensaios aleatórios: taxa de conclusão, taxa de duplicação (dois agentes que visam a mesma caixa), rotação média até conclusão.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Output esperado: agentes de ordem zero duplicam o esforço a uma taxa de ~ 35% e completam ~ 60% dos ensaios em 10 voltas. agentes ToM de primeira ordem duplicam a ~ 5% e completam ~ 95%.

## Usá-lo

`outputs/skill-tom-auditor.md`É uma habilidade que verifica a afirmação de "coordenação emergente" de um sistema multi-agente.

## Envia-o

Lista de verificação das reivindicações de coordenação:

- **Control condition.**Uma versão do seu sistema sem o aviso de coordenação.
- **Statistical test.**A diferença entre sistema e controlo é significativa em `p < 0.05`- Na sua métrica?
- **Complementarity measure.**Ações-disjunção ao longo do tempo, não apenas o sucesso final.
- **Failure-case log.**Quando os agentes se descoordenam, como é que o estado do ToM parece?
- **Model-capacity disclosure.**Se o efeito desaparecer em modelos menores, diga-o.

## Exercícios

1. Corra .`code/main.py`Confirme que a ToM de primeira ordem reduz a taxa de duplicação em cerca de 7x. A diferença persiste quando escalas para 5 agentes e 5 caixas?
2. Implementar a ToM de segunda ordem (agente A modela o que B pensa sobre C). Melhora-se em relação à primeira ordem?
3. Injectar um **hallucination**O que é que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é?
4. Leia Li et al. (arXiv:2310.10701). Reproduzir a descoberta de "degradação de longo horizonte": à medida que as turnas crescem de 10 para 30, como o seu desempenho de primeira ordem ToM muda?
5. Leia Riedl 2025 (arXiv:2510.05174). Implemente a estatística de sinergia de ordem superior nos seus registros de simulação.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Mais leitura

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) ToM emergente em jogos cooperativos; modos de falha de longo horizonte
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) medição em escala populacional; a indicação de TOM é a condição de carga
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://doi.org/10.1017/S0140525X00076512) a origem do conceito de TOM em 1978
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8)  o artigo Sally-Anne (1985)
