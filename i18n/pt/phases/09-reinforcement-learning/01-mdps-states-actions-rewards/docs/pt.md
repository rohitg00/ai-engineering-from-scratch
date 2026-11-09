# MDPs, Estados, Ações e Recompensas

> Um processo de decisão Markov é de cinco coisas: estados, ações, transições, recompensas, um desconto. Tudo no RL  Q-learning, PPO, DPO, GRPO  otimiza sobre esta forma. Aprenda uma vez, leia o resto do aprendizado de reforço gratuitamente.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## O problema

Você está escrevendo um bot de xadrez, ou um planejador de estoque, ou um agente de negociação, ou o loop PPO que treina um modelo de raciocínio, quatro domínios diferentes, um fato surpreendente: todos os quatro colapso para o mesmo objeto matemático.

A aprendizagem supervisionada dá-lhe`(x, y)`O aprendizado de reforço não dá rótulos, apenas um fluxo de estados, as ações que você fez e uma recompensa escalar. A mudança ganhou o jogo? A decisão de reabastecimento economizou dinheiro? O comércio fez lucro? O token que o LLM acabou de produzir levou a uma recompensa maior do juiz?

Você não pode aprender com este fluxo até que você formalize. "O que eu vi", "o que eu fiz", "o que aconteceu depois", "o quão bom foi"  cada um tem que se tornar um objeto sobre o qual você pode raciocinar. Essa formalização é um processo de decisão de Markov. Todo algoritmo RL nesta fase, incluindo os ciclos RLHF e GRPO no final, otimiza sobre esta forma.

## O conceito

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$Tudo o que o agente precisa decidir, no GridWorld, a célula, no xadrez, o tabuleiro, no LLM, a janela de contexto, mais qualquer memória.
- **Actions** $A$As escolhas, move-se para cima/para baixo/para esquerda/direita, joga um movimento, emite um token.
- **Transitions** $P(s' \mid s, a)$- Dado o estado .$s$e ação $a$Determinista no xadrez, estocástico no inventário, quase determinista na decodificação LLM.
- **Rewards** $R(s, a, s')$O sinal escalar. Ganho = +1, perda = -1. receita menos custo. O termo da relação log-probabilidade em GRPO.
- **Discount** $\gamma \in [0, 1)$Quanto é que a recompensa futura conta contra o presente?$\gamma = 0.99$compra um horizonte de ~ 100 passos; $\gamma = 0.9$- Compre 10 dólares.

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$O futuro depende apenas do estado presente. Se não o fizer, a representação do estado é incompleta.

**Policies and returns.**Uma política$\pi(a \mid s)$Mapa de estados para distribuições de ação.$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$O valor do valor de uma remuneração é a soma descontada das recompensas futuras.$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$é o rendimento esperado a partir de $s$Política$\pi$O valor Q.$Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$O algoritmo RL estimou um destes dois, e depois melhorou $\pi$- De acordo com isso.

**The Bellman equations.**As equações de ponto fixo que tudo nesta fase usa:

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

Estes divididos esperados retornam para "a recompensa deste passo" mais "valor descontado do lugar onde você aterrissa". Recursivo. Todo algoritmo na Fase 9 ou itera esta equação para convergência (programação dinâmica), amostras dele (Monte Carlo), ou inicializa um passo (diferência temporal).

```figure
discount-horizon
```

## Construí-lo

### Passo 1: um pequeno MDP determinista

Um GridWorld 4x4. Agente começa em cima à esquerda, terminal em baixo à direita, recompensa de -1 por passo, ações.`{up, down, left, right}`- Veja .`code/main.py`- Não .

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

Cinco linhas, é o ambiente inteiro, transições deterministas, penaltis constante, estado terminal absorvente.

### Passo 2: elaboração de uma política

Uma política é uma função da distribuição do estado para a ação.

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

Execute a política aleatória 1000 vezes. Retorno médio é de cerca de -60 a -80 para esta placa 4×4. Retorno ideal é -6 (caminho de linha reta para baixo para a direita). Fechar essa lacuna é tudo na Fase 9.

### Passo 3: computação `V^π`exatamente através da equação de Bellman

Para pequenos MDPs, a equação de Bellman é um sistema linear.

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

Este é o primeiro algoritmo em Sutton & Barto e a base teórica de cada método RL que segue.

### Passo 4:`γ`é um hiperparâmetro com significado físico

O horizonte eficaz é aproximadamente $1 / (1 - \gamma)$- Não .$\gamma = 0.9$→ 10 passos. $\gamma = 0.99$→ 100 passos. $\gamma = 0.999$→ 1000 passos.

O agente atua de forma miope, muito baixo e a atribuição de crédito torna-se ruidosa, porque muitos passos iniciais compartilham a responsabilidade pela recompensa de futuro.$\gamma = 1$Os controles utilizam os seguintes métodos:`0.95–0.99`. Jogos de estratégia de longo horizonte usam`0.999`- Não .

## Encurralagens

- **Non-Markovian state.**Se você precisar das últimas três observações para decidir, o "estado" não é apenas a observação atual.
- **Sparse rewards.**Os recompensas apenas para vencer tornam a aprendizagem quase impossível em grandes espaços de estado.
- **Reward hacking.**Otimizar uma recompensa por proxy geralmente produz comportamento patológico. O agente de corrida de barcos da OpenAI gira em círculos coletando powerups para sempre em vez de terminar a corrida. Sempre defina a recompensa do resultado alvo, não do proxy.
- **Discount mis-spec.** $\gamma = 1$Em uma tarefa de horizonte infinito, cada valor é infinito.$\gamma < 1$- Não .
- **Reward scale.**Os valores de {+100, -100} vs {+1, -1} dão políticas ótimas idênticas, mas magnitudes de gradiente muito diferentes.`[-1, 1]`- antes de ligar ao PPO/DQN.

## Usá-lo

A pilha 2026 reduz cada oleoduto RL a um MDP antes de tocar o código:

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

Escreva os cinco tuples antes de escrever qualquer loop de treinamento. A maioria dos relatórios de bugs "RL não funciona" remonta a uma formulação MDP que foi quebrada no papel.

## Envia-o

Salva como`outputs/skill-mdp-modeler.md`- Não .

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## Exercícios

1. **Easy.**Implementar o 4x4 GridWorld e a implementação de políticas aleatórias em `code/main.py`- Exercer 10.000 episódios. Relatar média e STD de retorno. Comparar com o retorno ideal (-6).
2. **Medium.**Corra .`policy_evaluation`com$\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$Para a política uniforme aleatória.`V`Explique por que os valores de estado perto do terminal crescem mais rápido com a maior$\gamma$- Não .
3. **Hard.**Virar a GridWorld estocástica: cada ação desliza para uma direção adjacente com probabilidade $p = 0.1$Reevaluar a política de uniforme.`V[start]`- Melhor ou pior?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MDP | "Reinforcement learning setup" | Tuple $(S, A, P, R, \gamma)$ satisfying the Markov property. |
| State | "What the agent sees" | Sufficient statistic for future dynamics under the chosen policy class. |
| Policy | "Agent's behavior" | Conditional distribution $\pi(a \mid s)$ or deterministic map $s \to a$. |
| Return | "Total reward" | Discounted sum $\sum \gamma^t r_t$ from the current step. |
| Value | "How good a state is" | Expected return under $\pi$ starting from $s$. |
| Q-value | "How good an action is" | Expected return under $\pi$ starting from $s$ with first action $a$. |
| Bellman equation | "Dynamic programming recursion" | Fixed-point decomposition of value / Q into one-step reward plus discounted successor value. |
| Discount $\gamma$ | "Future vs present" | Geometric weight on far-future reward; effective horizon $\approx 1/(1-\gamma)$. |

## Mais leitura

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)O capítulo 3 abrange as MDPs e as equações de Bellman; o capítulo 1 motiva a hipótese de recompensa que subjacente a cada lição subsequente.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) a origem da equação de Bellman.
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) Primer MDP conciso a partir de um ângulo de RL profundo.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) a referência de investigação operacional sobre os MDP e os métodos de solução exatas.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) a mais limpa derivação dos MDPs como especialização em programação dinâmica.
