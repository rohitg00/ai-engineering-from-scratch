# MARL — MADDPG, QMIX, MAPPO

> A herança do aprendizado por reforço em coordenação multi-agente, que ainda informa sistemas LLM-agent em 2026. **MADDPG** (Lowe et al., NeurIPS 2017, arXiv:1706.02275) introduziu Treinamento Centralizado, Execução Descentralizada (CTDE): cada critic vê estados e ações de todos agentes durante o treinamento; no teste só os atores locais rodam. Funciona pra cenários cooperativos, competitivos e mistos. **QMIX** (Rashid et al., ICML 2018, arXiv:1803.11485) é decomposição de valor com uma mixing network monotônica; Qs por agente se combinam em Q conjunto pra que `argmax` distribua limpo — dominante no StarCraft Multi-Agent Challenge (SMAC). **MAPPO** (Yu et al., NeurIPS 2022, arXiv:2103.01955) é PPO com função de valor centralizada; "surpreendentemente eficaz" em particle-world, SMAC, Google Research Football, Hanabi com mínimo tuning. Esses são a base pra treinar políticas de equipes de agentes que precisam agir descentralizadamente. MAPPO é o **baseline cooperativo-MARL padrão em 2026**. Esta aula constrói cada um a partir de um grid-world simples e fixa as três ideias na memória muscular antes de tocar no treinamento de LLM-agent.

**Tipo:** Aprender
**Idiomas:** Python (stdlib, implementações pequenas sem NumPy)
**Pré-requisitos:** Fase 09 (Aprendizado por Reforço), Fase 16 · 09 (Redes Swarm Paralelas)
**Tempo:** ~90 minutos

## Problema

Sistemas LLM-agent cada vez mais treinam políticas para coordenação entre agents: quando ceder, quando agir, qual peer chamar. A literatura que diz como treinar tais políticas é o Aprendizado por Reforço Multi-Agente (MARL), que antecede a onda de LLMs e tem um conjunto pequeno de algoritmos dominantes.

Ler artigos de MARL sem o vocabulário de padrões é doloroso. Treinamento centralizado com execução descentralizada (CTDE), decomposição de valor e critics centralizados não são buzzwords — são respostas eespecificaçãoíficas pra problemas eespecificaçãoíficos:

- RL independente (cada agente aprende sozinho) é não-estacionário da perespecificaçãotiva de cada agent. Ruim.
- RL centralizado (um agente controla tudo) não escala e viola restrições de execução.
- CTDE pega o melhor dos dois: treina com informação global, despacha com políticas locais.

## Conceito

### Três ambientes que os artigos usam

- **Particle World (ambiente multi-agente de partículas).** Física 2D simples com tarefas cooperativas/competitivas. Testbed original do MADDPG.
- **StarCraft Multi-Agent Challenge (SMAC).** Microgerenciamento cooperativo, observação parcial. Testbed do QMIX. Ações discretas, estados contínuos.
- **Google Research Football, Hanabi, MPE.** Baselines do MAPPO.

Ambientes diferentes têm tipos de ação/observação diferentes. Os algoritmos escolhem de acordo.

### MADDPG (2017) — o padrão CTDE

Cada agente `i` tem um ator `mu_i(o_i)` que mapeia sua observação para ação. Cada agente também tem um critic `Q_i(x, a_1, ..., a_n)` que vê todas observações e todas ações durante o treinamento. O ator é atualizado por policy gradient contra a avaliação do critic.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) em a_i=mu_i(o_i)]
critic update:   TD em Q_i(x, a_1..n) dado estimativa de estado conjunta seguinte
```

Por que CTDE: no treinamento, a gente conhece todas ações; usa isso pra reduzir variância em cada critic. No deploy, cada agente só vê `o_i` e chama `mu_i(o_i)`.

Modo de falha: critics crescem com N agentes (input inclui todas ações). Não escala passando ~10 agentes sem aproximações.

### QMIX (2018) — decomposição de valor

Só cooperativo. Recompensa global é soma de uma função monótona dos Q-values por agent:

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

A monotonicidade garante que `argmax_a Q_tot` pode ser computado por cada agente escolhendo `argmax_{a_i} Q_i` independentemente. Essa é **exatamente a propriedade de execução descentralizada** que você precisa. No treinamento, uma mixing network produz `Q_tot` a partir dos Qs por agent.

Por que QMIX vence no SMAC: microgerenciamento cooperativo do StarCraft tem agentes homogêneos, observações locais, recompensa global — encaixe perfeito pra decomposição de valor.

Modo de falha: a restrição de monotonicidade é restritiva; algumas tarefas têm estruturas de recompensa não decomponíveis monotonamente (um agente se sacrificando pela equipe). Extensões (QTRAN, QPLEX) relaxam isso.

### MAPPO (2022) — o default esquecido

Multi-Agent PPO: PPO com função de valor centralizada. Cada agente tem sua política; todos agentes compartilham (ou têm por agent) funções de valor que vêem o estado completo. Yu et al. 2022 compararam MAPPO contra MADDPG, QMIX e suas extensões em cinco benchmarks e acharam:

- MAPPO iguala ou supera métodos off-policy de MARL em particle-world, SMAC, Google Research Football, Hanabi, MPE.
- Mínimo tuning de hiperparâmetros necessário.
- Treinamento estável; reproduzível entre seeds.

A comunidade subestimou MARL on-policy até este artigo. Em 2026, MAPPO é o baseline padrão pra MARL cooperativa; qualquer novo método precisa superá-lo.

### Por que engenheiros de LLM-agent devem se importar

Três usos diretos:

1. **Treinamento de router.** Um meta-agent escolhe qual sub-agent lida com uma tarefa. Isso é um problema de MARL com N sub-agents descentralizados e um router centralizado. MAPPO se encaixa.
2. **Emergência de papéis.** Em simulações de agentes generativos, treinar agentes pra adotar papéis complementares ao longo do tempo é um problema de MARL disfarçado. Decomposição de valor estilo QMIX força complementaridade por construção.
3. **Uso de ferramentas multi-agente.** Quando agentes compartilham ferramentas e competem por orçamento, treiná-los via CTDE produz políticas locais despacháveis que respeitam restrições de recursos.

Caveat prático: em 2026, a maioria dos sistemas LLM-agent em produção faz prompt das suas políticas ao invés de treiná-las. MARL entra quando você tem (a) muitos dados de interação, (b) um sinal claro de recompensa, e (c) disposição pra investir em infraestrutura de treinamento.

### CTDE como padrão de design além do RL

Mesmo sem treinar, CTDE é um padrão de arquitetura útil:

- Durante o *design*, assume visibilidade total da equipe.
- Em *runtime*, força execução descentralizada: cada agente só vê `o_i`.

O padrão força você a manter estado por agente explícito e a pensar em observabilidade parcial desde o começo. Muitos sistemas multi-agente em produção assumem silenciosamente estado compartilhado em toda parte — a disciplina de CTDE previne isso.

### O problema de não-estacionaridade

Quando múltiplos agentes aprendem simultaneamente, o ambiente de cada agente (que inclui as políticas dos outros) é não-estacionário. Provas clássicas de agente único quebram. Os algoritmos de MARL nesta aula todos lidam com isso:

- MADDPG: critic global vê todas ações, então sua estimativa de valor é estacionária.
- QMIX: decomposição de valor move o aprendizado pra um espaço Q-junto onde optimalidade é bem definida.
- MAPPO: a função de valor centralizada suaviza variância das mudanças de política dos outros.

Em sistemas LLM-agent, não-estacionaridade se manifesta como "meu agente funcionava no mês passado, agora aquele outro agente upstream mudou, o meu desandou." Treinar MARL com CTDE é a correção princípiada; correções no nível de prompt são mais rápidas mas menos duráveis.

### O que esta aula NÃO cobre

Treinar redes reais é um assunto da Fase 09. Esta aula constrói versões com políticas scriptadas que demonstram os padrões CTDE, decomposição-de-valor e valor-centralizado sem atualizações de gradiente. O objetivo é internalizar os padrões antes de usar uma biblioteca MARL completa (PyMARL, MARLlib, RLlib multi-agent).

## Construir

`code/main.py` implementa três demonstrações de padrões, todas em um grid-world cooperativo minúsculo de 2 agents:

- Ambiente: 2 agentes em um grid 4x4, uma pellet de recompensa. Recompensa = 1 se qualquer agente alcança a pellet; tarefa termina.
- `IndependentAgents` — cada agente trata os outros como ambiente. Baseline.
- `MADDPGStyle` — critic centralizado computa valor conjunto; políticas dos atores atualizam a partir dele. Melhoria de política scriptada.
- `QMIXStyle` — decomposição de valor com mixer monótono.
- `MAPPOStyle` — função de valor centralizada; políticas atualizam contra o baseline compartilhado.

Todos quatro rodam os mesmos episódios e reportam média de passos-ao-objetivo. As variantes CTDE convergem pra caminhos mais curtos que o baseline independente.

Execute:

```
python3 code/main.py
```

Saída esperada: agentes independentes levam ~6 passos em média; variantes CTDE convergem pra ~3.5 passos (o ótimo pra grid 4x4 é 3). A diferença de padrão aparece mesmo com políticas scriptadas.

## Usar

`outputs/skill-marl-picker.md` é uma skill que escolhe um algoritmo de MARL pra uma dada tarefa multi-agente: cooperativa vs competitiva, homogênea vs heterogênea, tipo de espaço de ação, escala, sinal de recompensa.

## Em produção

MARL em produção é raro. Quando você usar:

- **Comece com MAPPO.** O artigo de 2022 estabeleceu esse como baseline; reproduzi-lo primeiro economiza semanas perseguindo métodos mais sofisticados.
- **Logue a observação e o fluxo de ações de cada agent.** Debugar MARL sem rastros por agente é desesperador.
- **Separe código de treinamento de código de execução.** CTDE é uma disciplina; deixe o caminho de execução realmente só ver `o_i`.
- **Cuidado com reward shaping.** MARL é extremamente sensível a design de recompensa. Um bug de coordenação no shaping e agentes aprendem a explorá-lo. Rode testes adversariais.
- **Pra LLM agents**, considere políticas no nível de prompt primeiro. Só invista em treinamento MARL quando dados de interação + sinal de recompensa + infraestrutura estiverem todos presentes.

## Exercícios

1. Execute `code/main.py`. Meça a diferença de passos-ao-objetivo entre agentes independentes e estilo MAPPO. A diferença cresce ou diminui em um grid 6x6?
2. Implemente uma variante competitiva: dois agents, uma pellet, só o primeiro a alcançar ganha recompensa. Qual padrão lida com competição limpadamente? MADDPG historicamente.
3. Leia MADDPG (arXiv:1706.02275) Seção 3. Implemente exatamente a regra de atualização do critic em pseudocódigo com suas próprias palavras.
4. Leia MAPPO (arXiv:2103.01955). Por que os autores argumentam que valor centralizado + PPO supera MARL off-policy nos seus benchmarks? Liste as três alegações mais fortes.
5. Aplique CTDE como padrão de design a um sistema LLM-agent hipotético (ex: agente de pesquisa + resumidor + codificador). Qual é a informação conjunta disponível no design que não está disponível no runtime?

## Termos-chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Aprendizado por reforço para sistemas multi-agente. |
| CTDE | "Treinamento Centralizado, Execução Descentralizada" | Treina com informação global; despacha com políticas locais. |
| MADDPG | "Multi-Agent DDPG" | CTDE com critic por agente vendo todas observações + ações. |
| QMIX | "Decomposição de valor" | Mistura monótona de Qs por agent. Cooperativo. |
| MAPPO | "Multi-Agent PPO" | PPO com função de valor centralizada. Baseline padrão 2026. |
| Decomposição de valor | "Soma de Qs individuais" | Q conjunto representado como função monótona dos Qs por agent. |
| Não-estacionaridade | "Alvos em movimento" | Ambiente de cada agente muda enquanto outros aprendem. O problema central do MARL. |
| On-policy / off-policy | "Aprende do atual / replay" | PPO é on-policy (MAPPO); DDPG e Q-learning são off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Benchmark de microgerenciamento cooperativo; casa do QMIX. |

## Leitura Adicional

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG; NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX; ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO; NeurIPS 2022
- [Post do BAIR blog sobre MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — enquadramento legível do resultado do MAPPO
- [Repositório SMAC](https://github.com/oxwhirl/smac) — StarCraft Multi-Agent Challenge
