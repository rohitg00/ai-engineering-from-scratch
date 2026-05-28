# Theory of Mind e Coordenação Emergente

> Li et al. (arXiv:2310.10701) mostraram que agentes LLM num jogo de texto cooperativo exibem **Theory of Mind emergente de alta ordem** (ToM) — raciocinar sobre o que outro agente acredita sobre as crenças de um terceiro agente — mas falham em planejamento de longo horizonte devido a gerenciamento de contexto e alucinação. Riedl (arXiv:2510.05174) mediu sinergia de alta ordem em uma população e descobriu que **somente** a condição de prompt ToM produz diferenciação ligada a identidade e complementaridade direcionada a objetivos; LLMs de menor capacidade mostram apenas emergência espúria. Ou seja, coordenação emergente é condicional ao prompt e dependente do modelo, não é grátis. Esta lição implementa um agente mínimo consciente de ToM, roda uma tarefa cooperativa com e sem prompt ToM, e mede o delta de coordenação contra o protocolo Riedl 2025.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 07 (Society of Mind and Debate), Fase 16 · 17 (Generative Agents)
**Tempo:** ~75 minutos

## Problema

Coordenação multi-agent frequentemente parece mágica: agentes dividem trabalho, antecipam uns aos outros, evitam redundância. Geralmente essa "emergência" é artefato de engenharia de prompt — alguém disse aos agentes pra "coordenar." Remova o prompt, remova a coordenação.

O achado de Riedl em 2025 é mais rigoroso: em condições controladas, coordenação só emerge quando agentes são provocados pra raciocinar sobre **mentes de outros agents** (ToM). Sem o prompt ToM, mesmo modelos fortes mostram padrões de coordenação que não sobrevivem a controles estatísticos. Isso importa pra produção: times lançam features de "coordenação multi-agent" que são dependentes de prompt e frágeis.

Esta lição trata ToM como uma capacidade eespecificaçãoífica (raciocinar sobre crenças sobre crenças), constrói um agente mínimo consciente de ToM, e mede o que coordenação real parece vs o que enfeite de prompt parece.

## Conceito

### O que ToM significa

Psicologia do desenvolvimento: uma criança de 3 anos acha que o mundo interno de qualquer pessoa é igual ao dela. Uma de 5 anos entende que outros têm crenças diferentes. Uma de 7 anos raciocina sobre crenças sobre crenças ("ela acha que eu acho que a bola está debaixo da xícara"). Essas são ToM de zero, primeira e segunda ordem.

Pra agentes LLM, as ordens de ToM mapeiam pra:

- **Ordem zero:** sem modelo dos outros. O age só pelas próprias observações.
- **Primeira ordem:** o agente tem um modelo das crenças de cada outro agent. "Alice acredita em X."
- **Segunda ordem:** o agente modela crenças recursivas. "Alice acredita que Bob acredita em X."

Li et al. 2023 descobriram que ToM de primeira e segunda ordem emergem em agentes LLM em jogos cooperativos mas degradam com horizonte longo e comunicação não confiável.

### O teste Sally-Anne, em resumo

Um teste de crença falsa de 1985: Sally coloca uma bolinha no cesto A e sai. Anne move pro cesto B. Onde Sally vai olhar quando voltar? Uma criança com ToM de primeira ordem diz cesto A (crença de Sally difere da realidade). Uma sem diz cesto B.

LLMs da era GPT-4 passam testes estilo Sally-Anne quando postos simplesmente. Falham quando a narrativa é longa, a cena muda várias vezes, ou a pergunta é formulada indiretamente. Esse é o estado prático de ToM em LLMs de produção em 2026.

### A medição de coordenação de Riedl

Riedl (arXiv:2510.05174) construiu um teste em escala de população: N agents, objetivo cooperativo, condições variáveis de prompt. Medir:

1. **Diferenciação ligada a identidade.** Agents desenvolvem distinções de papel estáveis ao longo do tempo?
2. **Complementaridade direcionada a objetivos.** As ações dos agentes se complementam (subtarefas diferentes) em vez de duplicar?
3. **Sinergia de alta ordem.** Uma medida estatística de se o grupo alcança o que nenhum subconjunto conseguiria.

Resultado: somente sob a condição de prompt ToM todas as três métricas produzem sinal acima do baseline. Sem prompt ToM, métricas flutuam perto do acaso pra modelos de capacidade moderada. Modelos grandes mostram alguma coordenação sem prompt ToM explícito mas o efeito é menor que com prompt explícito.

### A ilusão de coordenação

Sem controles estatísticos, "coordenação emergente" em demos frequentemente reflete:

- Engenharia de prompt que injeta coordenação (prompts de sistema dizendo "trabalhem juntos").
- Viés de observador (vemos padrões que esperamos).
- Seleção pós-hoc de runs bem-sucedidas.

Sistemas em produção que vendem "coordenação emergente" sem sinal mensurável devem ser tratados como marketing. Meça antes de afirmar.

### Um agente mínimo consciente de ToM

Estrutura:

```
agent state:
  own_beliefs:    {facts the agente believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agente will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

O atributo `other_models` é o estado de ToM. ToM de primeira ordem mantém apenas um nível. ToM de segunda ordem adiciona `other_models[i][other_models_of_j]` — o que eu acho que o agente i acha que o agente j acredita.

### Por que horizonte longo prejudica

Li et al. documentam: limites de contexto fazem agentes esquecerem qual crença pertence a quem. Alucinação adiciona crenças falsas a modelos de outros agents. Ambos produzem erros tipo "eu achei que ele achava X" que se acumulam ao longo do tempo.

Mitigações documentadas no paper e em trabalhos de 2024-2026:

- **Estado ToM explícito no prompt.** Formato estruturado: `{agent_id: belief_list}`. Força a recuperação a preservar a vinculação identidade-crença.
- **Cadeias de raciocínio mais curtas.** Menos atualizações de ToM por turno reduzem alucinação acumulada.
- **Armazenamento ToM externo.** Mantenha o modelo fora do contexto do LLM; injete só partes relevantes por turno.

### Onde ToM falha em produção

- **Cenários adversariais.** Agents com bom ToM são mais fáceis de manipular (você pode modelar o que eles modelam de você, depois explorar).
- **Times heterogêneos.** Quando modelos são diferentes, o modelo ToM que funciona pra um oponente não generaliza.
- **Tarefas dependentes de ground-truth.** ToM é sobre crenças; se correção depende de fatos, ToM pode ser distração.

### A coordenação que você realmente pode medir

Três sinais práticos de que a coordenação do time é real em vez de enfeite de prompt:

1. **Complementaridade ao longo do tempo.** Em uma tarefa multi-turn, as ações dos agentes cobrem subtarefas disjuntas?
2. **Antecipação.** A ação do agente A no turno T+1 depende de uma previsão sobre a ação do B no T+2 que se mostrou correta?
3. **Correção.** Quando A lê errado a crença de B no turno T, A corrige até o turno T+2?

Isso é mensurável num sistema multi-agent logado. É a versão substantiva da narrativa de "coordenação."

## Construa

`code/main.py` implementa:

- `ToMAgent` — rastreia crenças próprias e modelos de crenças por outro agent.
- Tarefa cooperativa: três agentes devem coletar três tokens de três caixas; cada caixa comporta um token. Agents não podem comunicar; inferem intenção das ações uns dos outros.
- Duas configurações: `zeroth_order` (sem ToM) e `first_order` (ToM com modelo de crença de um nível).
- Medição em 200 trials randomizados: taxa de conclusão, taxa de duplicação (dois agentes alvejando a mesma caixa), turnos médios até conclusão.

Execute:

```
python3 code/main.py
```

Saída esperada: agentes de ordem-zero duplicam esforço em ~35% e completam ~60% dos trials em 10 turnos. Agents com ToM de primeira ordem duplicam em ~5% e completam ~95%. O delta é o efeito de coordenação mensurável.

## Use

`outputs/skill-tom-auditor.md` é uma skill que audita a afirmação de "coordenação emergente" de um sistema multi-agent. Verifica enfeite de prompt, significância estatística contra controle, e complementaridade medida.

## Deploy

Checklist de afirmações de coordenação:

- **Condição controle.** Uma versão do seu sistema sem o prompt de coordenação. Meça ambas.
- **Teste estatístico.** A diferença entre sistema e controle é significativa a `p < 0.05` na sua métrica?
- **Medida de complementaridade.** Disjunção de ações ao longo do tempo, não só sucesso final.
- **Log de casos de falha.** Quando agentes descoordenam, como está o estado ToM?
- **Divulgação de capacidade do modelo.** Se o efeito some em modelos menores, diga.

## Exercícios

1. Execute `code/main.py`. Confirme que ToM de primeira ordem reduz taxa de duplicação em ~7x. A diferença persiste quando você escala pra 5 agentes e 5 caixas?
2. Implemente ToM de segunda ordem (agent A modela o que B acha de C). Melhora sobre primeira ordem? Em quais tarefas?
3. Injete uma **alucinação** no estado ToM: inverta aleatoriamente uma crença por turno. Quanto isso degrada performance de primeira ordem?
4. Leia Li et al. (arXiv:2310.10701). Reproduza o achado de "degradação de longo horizonte": à medida que turnos crescem de 10 pra 30, como muda a performance do seu ToM de primeira ordem?
5. Leia Riedl 2025 (arXiv:2510.05174). Implemente a estatística de sinergia de alta ordem nos seus logs de simulação. O efeito está presente sem a condição de prompt ToM?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Theory of Mind | "Entender mentes alheias" | A capacidade de modelar crenças de outro agent. Graduada por ordem (0, 1, 2+). |
| Teste Sally-Anne | "O teste de crença falsa" | Psicologia do desenvolvimento de 1985; LLMs passam versões simples, falham em complexas. |
| ToM de primeira ordem | "A acredita em X" | Modelar as crenças de um outro sobre fatos. |
| ToM de segunda ordem | "A acredita que B acredita em X" | Modelagem recursiva um nível mais fundo. |
| Diferenciação ligada a identidade | "Papéis estáveis ao longo do tempo" | Métrica de Riedl: papéis persistem, não são aleatórios. |
| Complementaridade direcionada a objetivos | "Ações disjuntas" | Agents alvejam subtarefas diferentes, não a mesma. |
| Sinergia de alta ordem | "Grupo excede qualquer subconjunto" | Medida estatística de Riedl pra coordenação real. |
| Ilusão de coordenação | "Parece coordenado" | Aparência enfeita de coordenação sem sinal mensurável. |

## Leitura Complementar

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) — ToM emergente em jogos cooperativos; modos de falha de longo horizonte
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) — medição em escala populacional; prompt ToM é a condição load-bearing
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) — a origem do conceito ToM em 1978
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-autistic-child-have-a-theory-of-mind/) — o paper Sally-Anne (1985)
