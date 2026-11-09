# RL multi-agente

> O RL de agente único assume que o ambiente é estacionário. Coloque dois agentes de aprendizagem no mesmo mundo e essa suposição quebra: cada agente é parte do ambiente do outro, e ambos estão mudando.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## O problema

Um robô que aprende a navegar em uma sala é um problema de RL de um único agente. Uma equipe de futebol não é.

Em cada ambiente multi-agente, a partir da perspectiva de qualquer agente, os outros agentes são parte do ambiente. À medida que aprendem e mudam o comportamento, o ambiente torna-se não-estacionário. A propriedade Markov  "o próximo estado depende apenas do estado atual e da minha ação"  é violada porque o próximo estado também depende do que os outros agentes escolheram, e suas políticas estão movendo alvos.

O que é preciso é que os agentes se perseguam uns aos outros em circuitos, nunca convergem para uma política estável.

Aplicações 2026: enxames de robôs, roteamento de tráfego, frotas de veículos autônomos, simuladores de mercado, sistemas LLM multi-agente (fase 16), e qualquer jogo com mais de um jogador inteligente.

## O conceito

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**Uma generalização do MDP: estados $S$, uma acção conjunta $a = (a_1, \ldots, a_n)$, transição $P(s' \mid s, a)$, e recompensas por agente $R_i(s, a, s')$Cada agente .$i$maximiza o seu próprio retorno sob a sua própria política $\pi_i$Se as recompensas forem idênticas, é o caso.**fully cooperative**Se for zero, é o mesmo.**adversarial**Se misturado, é.**general-sum**- Não .

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$do agente .$i$A visão depende de$\pi_{-i}$, que está a mudar.
- **Credit assignment.**Com uma recompensa compartilhada, qual agente causou isso?
- **Exploration coordination.**Os agentes devem explorar estratégias complementares, não explorar redundantemente o mesmo estado.
- **Scalability.**O espaço de acção comum cresce exponencialmente em $n$- Não .
- **Partial observability.**Cada agente vê apenas a sua própria observação; o estado global está oculto.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**Cada agente aprende sua própria Q ou política, tratando os outros como parte do ambiente. Simples, às vezes funciona (especialmente com repetição de experiência agindo como um truque de modelagem de agente suave). Convergência teórica: nenhuma. Na prática: bom para tarefas soltos, ruim para as fortemente acopladas.

**2. Centralized training, decentralized execution (CTDE).**O paradigma moderno mais comum.$\pi_i$que as condições da observação local $o_i$ execução descentralizada padrão na implantação.$Q(s, a_1, \ldots, a_n)$Condições relativas ao estado global completo e a acção conjunta.
- **MADDPG**(Lowe et al. 2017): DDPG com um crítico centralizado por agente.
- **COMA**(Foerster et al. 2017): base contrafactual  perguntar "qual seria a minha recompensa se eu tivesse tomado medidas $a'$"Em vez disso?"
- **MAPPO**- Não .**IPPO**com crítico compartilhado (Yu et al. 2022): PPO com função de valor centralizada. Dominant em 2026 para a MARL cooperativa.
- **QMIX**(Rashid et al. 2018): decomposição do valor  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$com mistura monótona.

**3. Self-play.**Duas cópias do mesmo agente jogam um ao outro. A política do adversário é a minha política de um snapshot passado. AlphaGo / AlphaZero / MuZero. OpenAI Five. Funciona melhor para jogos de soma zero; o sinal de treinamento é simétrico.

**4. League play.**Uma extensão do auto-jogo para ambientes de soma geral / adversária: manter uma população de políticas passadas e atuais, amostrar um adversário da liga, treinar contra eles. Adiciona exploradores (especializados em vencer o melhor atual) e exploradores principais (especializados em vencer exploradores). AlphaStar (StarCraft II). Necessário quando o jogo admite ciclos de estratégia "rock-paper-scissors".

**Communication.**Permita que os agentes enviem mensagens aprendidas .$m_i$Foerster et al. (2016) mostrou que a comunicação inter-agente diferenciável pode ser treinada de ponta a ponta. Os sistemas multi-agente baseados em LLM de hoje (Fase 16) comunicam essencialmente em linguagem natural.

```figure
f3-marl-orbit
```

## Construí-lo

Esta lição usa um GridWorld 6×6 com dois agentes cooperativos. Eles começam em cantos opostos e devem alcançar um objetivo compartilhado.`-1`por passo enquanto qualquer um dos agentes ainda está em movimento,`+10`Quando ambos chegarem.`code/main.py`- Não .

### Passo 1: o ambiente multi-agente

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

O espaço de acção comum é`|A|² = 16`O estado global é de duas posições.

### Passo 2: aprendizagem Q independente

Cada agente executa sua própria tabela Q teclada em estado conjunto. Em cada passo: ambos escolhem ações ε-compassivas, coletam transição conjunta, cada um atualiza seu próprio Q com a recompensa compartilhada.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

Funciona nessa tarefa porque as recompensas são densas e alinhadas.

### Passo 3: Q centralizado com atualização de valor decomposto

Use um Q em vez de acções conjuntas $Q(s, a_1, a_2)$Atualizar a partir de recompensa compartilhada. Descentralize na execução marginalizando: $\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$. Troca espaço de acção comum exponencial para uma visão global *correcta* .

### Passo 4: simples jogo próprio (adversário 2 agente)

O mesmo agente, dois papéis.$K$O que é que é que é o que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é que é?

## Encurralagens

- **Non-stationary replay.**Repetição de experiências com agentes independentes é pior do que um agente único porque antigas transições foram geradas por oponentes agora obsoletos.
- **Credit assignment ambiguity.**Recompensa compartilhada após um longo episódio; não há forma clara de dizer qual agente contribuiu.
- **Policy drift / chasing.**A melhor resposta de cada agente muda com a atualização do outro.
- **Reward hacking via coordination.**Agentes encontram explorações coordenadas que o designer não antecipou. Agentes de leilão convergem para zero.
- **Exploration redundancy.**Os dois agentes exploram os mesmos pares de ações de estado.
- **League cycles.**O auto-joco puro pode ficar preso num ciclo de dominação.
- **Sample explosion.** `n`Ações conjuntas: Ações de base de dados:

## Usá-lo

O mapa de aplicação MARL 2026:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

Em 2026, a maior área de crescimento da MARL é a base de LLM: enxames de agentes de modelos de linguagem que negociam, debatem, construem software.

## Envia-o

Salva como`outputs/skill-marl-architect.md`- Não .

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## Exercícios

1. **Easy.**Treinar aprendizagem Q independente na cooperativa GridWorld. Quantos episódios até o retorno médio > 0?
2. **Medium.**Adicione uma tarefa de "coordenação": o objetivo é alcançado apenas quando ambos os agentes pisam sobre ele na mesma curva.
3. **Hard.**Implementar um critico centralizado para a formação no estilo MAPPO e comparar a velocidade de convergência com a PPO independente na tarefa de coordenação.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## Mais leitura

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE com um crítico centralizado.
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) Linhas de base contrafactuais para a atribuição de crédito.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) decomposição de valores com monotonia.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955)O PPO é surpreendentemente forte para o MARL.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)- Liga de jogo em escala.
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) puro auto-jogo em jogos de soma zero.
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) inclui o curto tratamento do manual das configurações de agentes múltiplos e o problema de não estacionalidade que o CTDE é concebido para resolver.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) Pesquisa que abrange a LMP cooperativa, competitiva e mista com resultados de convergência.
